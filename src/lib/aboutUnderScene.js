import * as THREE from 'three';
import { makeNoise, createSky, createTerrain, createSnowfall } from './heroEnvironment';

/* ABOUT 지도 — MAIN 의 눈밭을 칼로 자른 단면.

   위쪽 1/3 은 MAIN 과 같은 하늘·먼 산·눈발이고, 그 아래는 눈밭 속이다.
   드라이아이스는 이산화탄소 눈을 눌러 다져 만든다 — 그래서 단면은 눈 → 다져진 눈 → 단단한 층으로
   거의 수평하게 쌓이고, 색은 청록빛 없이 불투명한 흰회색이다(푸른빛은 물 얼음·바닷속으로 읽힌다).
   단면의 윗선은 MAIN 눈밭의 실제 굴곡(같은 노이즈, 같은 시드)을 따르고, 그 위로 승화 연기가 낮게 흐른다.

   키워드는 층 속에 박힌 하얀 드라이아이스 조각이고, 조각 위로 짧은 금이 각지게 꺾인다.
   카메라는 단면(z=0)을 정면으로 본다. 단위는 MAIN 과 같이 "z=0 에서 1 = 1px" 이라
   단면 위의 좌표가 곧 화면 px 이다(화면 가운데가 원점, y 는 위가 +). */

const FOV = 35; // MAIN 히어로와 같다
const FACE_DEPTH = 5200; // 단면이 내려가는 깊이 (px)
const GLOW = new THREE.Vector3(0.38, 0.87, 0.84);

const MIST_VERT = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FACE_VERT = `
attribute float aTop;
varying vec3 vWorld;
varying float vTop;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vTop = aTop;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FACE_FRAG = `
uniform vec4 uKeys[5];      // x, y, 밝기, 0
uniform vec3 uBg;
uniform vec3 uGlow;
varying vec3 vWorld;
varying float vTop;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
// 드라이아이스 조각 — 모서리가 비스듬히 잘린 납작한 육각형
float chunk(vec2 p, vec2 size, float tilt) {
  float c = cos(tilt), s = sin(tilt);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p = abs(p);
  return max(p.y - size.y, (p.x * 0.86 + p.y * 0.5) - size.x);
}

void main() {
  float x = vWorld.x;
  float d = max(0.0, vTop - vWorld.y);   // 지표에서 잰 깊이 (px)

  // 눌려 다져진 층 — 자로 그은 듯 곧으면 폼보드 단면처럼 보인다.
  // 층 경계는 크게 휘고(낮은 주파수) 잘게 떨리며(높은 주파수), 두께도 층마다 제각각이다.
  float bend = (fbm(vec2(x * 0.0011, 1.3)) - 0.5) * 70.0 + (noise(vec2(x * 0.007, 4.0)) - 0.5) * 9.0;
  float dl = d + bend * smoothstep(0.0, 80.0, d);         // 지표 바로 밑은 덜 휜다
  // 층 번호를 노이즈로 늘였다 줄였다 — 얇은 층과 두꺼운 층이 섞인다
  float t = dl / 30.0 + fbm(vec2(dl * 0.011, 7.0)) * 2.2;
  float layerId = floor(t);
  float within = fract(t);
  float layerTone = hash(vec2(layerId, 3.1));

  // 눈 → 다져진 눈 → 단단한 드라이아이스. 청록빛 없이 중립적인 흰회색
  vec3 snow = vec3(0.26, 0.27, 0.275);
  vec3 packed = vec3(0.13, 0.135, 0.14);
  vec3 solid = vec3(0.07, 0.075, 0.08);
  vec3 col = mix(snow, packed, smoothstep(0.0, 130.0, d));
  col = mix(col, solid, smoothstep(80.0, 480.0, d));
  // 층마다 밝기 차 + 한 층 안에서도 위가 조금 밝다(눌리며 생긴 밀도 차)
  // 층 무늬는 거의 숨긴다 — 또렷하면 케이크 단면처럼 보이고 다른 페이지의 어두운 공기와 따로 논다
  col *= 0.97 + 0.06 * layerTone;
  col *= 0.99 + 0.02 * (1.0 - within);
  // 옆으로 번지는 얼룩 — 같은 층이라도 자리마다 다져진 정도가 다르다
  float mottle = fbm(vec2(x * 0.004, dl * 0.02));
  col *= 0.88 + 0.24 * mottle;   // 대신 구름처럼 번지는 얼룩으로 깊이를 준다

  // 층 경계 — 가는 선이 끊겼다 이어진다. 몇몇 경계만 먼지가 낀 듯 조금 더 짙다
  float edge = min(within, 1.0 - within) * 30.0;
  float gap = smoothstep(0.35, 0.6, noise(vec2(x * 0.012, layerId)));
  float dusty = step(0.78, hash(vec2(layerId, 8.2)));
  col -= (0.004 + 0.008 * dusty) * (1.0 - smoothstep(0.0, 1.4, edge)) * gap * (1.0 - smoothstep(380.0, 1500.0, d));

  // 빛이 스며든 자리 — 지표 아래가 반투명하게 밝아 속이 있는 물질로 읽힌다
  float glowIn = exp(-d / 120.0) * (0.55 + 0.45 * fbm(vWorld.xy * 0.006 + 2.0));
  col += vec3(0.13, 0.135, 0.14) * glowIn;

  // 눈 알갱이와 작은 기포 — 얕을수록 거칠고, 깊은 곳엔 어두운 기포 점이 드문드문
  float grain = hash(floor(vec2(x, dl) / 1.6));
  col += (grain - 0.5) * 0.05 * (1.0 - smoothstep(60.0, 700.0, d));
  col += step(0.985, grain) * 0.07 * (1.0 - smoothstep(0.0, 260.0, d));
  float pore = step(0.993, hash(floor(vWorld.xy / 2.4) + 5.0));
  col -= pore * 0.05 * smoothstep(40.0, 200.0, d) * (1.0 - smoothstep(600.0, 1400.0, d));

  // 자른 면의 결 — 칼날이 지나간 방향으로 아주 옅은 세로 긁힘
  col += (noise(vec2(x * 0.32, d * 0.003)) - 0.5) * 0.022 * (1.0 - smoothstep(200.0, 1200.0, d));

  // 지표 — 두께가 일정한 띠가 아니라 울퉁불퉁한 눈 껍질. 껍질 바로 밑엔 옅은 그늘이 진다
  float crust = 5.0 + 9.0 * fbm(vec2(x * 0.012, 3.3));
  col = mix(col, vec3(0.64, 0.66, 0.665), 1.0 - smoothstep(crust - 2.5, crust + 1.5, d));
  col *= 1.0 - 0.16 * exp(-max(d - crust, 0.0) / 12.0) * step(crust, d);

  // 세로 금 — 각지게 꺾이며 얕은 층에만
  float seg = floor(d / 70.0);
  float fx = x + (hash(vec2(seg, floor(x / 260.0))) - 0.5) * 40.0 * fract(d / 70.0);
  float frac = abs(fract(fx / 260.0) - 0.5) * 260.0;
  float fOn = step(0.72, hash(vec2(floor(x / 260.0), 9.0)));
  col -= 0.05 * fOn * (1.0 - smoothstep(0.0, 1.1, frac)) * smoothstep(40.0, 120.0, d) * (1.0 - smoothstep(500.0, 1100.0, d));

  // 키워드 — 눈 속에 반쯤 묻힌 글자(DOM) 아래로 빛이 은은하게 새어 나온다.
  // 예전의 흰 조각은 어둠 속에서 팝콘처럼 읽혀 뺐다. 여기서는 빛만 그린다
  for (int i = 0; i < 5; i++) {
    vec2 k = uKeys[i].xy;
    float g = uKeys[i].z;
    vec2 v = vWorld.xy - k;
    // 가로로 넓고 아래로 짧게 번지는 빛 — 글자 폭을 따라 눈 속이 밝아진다
    vec2 e = v / vec2(95.0 + 30.0 * g, 30.0 + 14.0 * g);
    float light = exp(-dot(e, e));
    // 눈 결을 따라 빛이 고르지 않게 스민다
    light *= 0.75 + 0.5 * fbm(vWorld.xy * 0.012 + float(i) * 3.7);
    col += uGlow * light * (0.004 + 0.2 * g * g * g);   // 평소(g≈0.5)엔 거의 없고, 가리키면(g=1) 밝아진다
    col += vec3(0.55) * light * 0.06 * g * g * g;
  }

  // 깊어질수록 페이지 배경색으로 가라앉는다
  col = mix(col, uBg, smoothstep(420.0, 1900.0, d));
  gl_FragColor = vec4(col, 1.0);
}
`;

/* 승화 연기 — 지표를 따라 낮게 흐르는 하얀 기체. 드라이아이스를 가장 확실하게 알려주는 표시.
   평소엔 아주 옅고, 커서가 움직이면 잠깐 짙어진다(상시 연무를 깔지 않는다는 규칙) */
const MIST_FRAG = `
uniform float uTime;
uniform float uStrength;
uniform float uSurface;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p = p * 2.02 + 7.3; a *= 0.5; }
  return v;
}

void main() {
  float h = vWorld.y - uSurface;                 // 지표에서 위로 잰 높이
  float x = vWorld.x;

  // 지표에 붙어 옆으로 천천히 흐르는 층 — 무거운 기체라 낮게 깔린다
  vec2 q = vec2(x * 0.0032 - uTime * 0.03, h * 0.01);
  vec2 w = vec2(fbm(q * 1.4 + uTime * 0.02), fbm(q * 1.4 - uTime * 0.017 + 4.1));
  float n = fbm(q + w * 1.1);
  float floorBand = exp(-max(h, 0.0) / 60.0) * smoothstep(-36.0, 4.0, h);
  float low = floorBand * smoothstep(0.3, 0.82, n);

  // 그 위로 가늘게 피어올라 흩어지는 가닥 — 올라갈수록 옆으로 퍼지며 사라진다
  vec2 r = vec2(x * 0.006 + sin(h * 0.012 + uTime * 0.4) * 0.35, (h - uTime * 16.0) * 0.009);
  float strand = fbm(r + w * 0.8);
  float rise = smoothstep(0.52, 0.86, strand) * exp(-max(h, 0.0) / 150.0) * smoothstep(0.0, 30.0, h);

  float a = (low * 0.9 + rise * 0.55) * uStrength;
  vec3 color = mix(vec3(0.66, 0.7, 0.72), vec3(0.92, 0.94, 0.945), smoothstep(0.4, 0.85, n));
  gl_FragColor = vec4(color * a, a);
}
`;

export function createUnderSnow(host, { keys }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // MAIN 과 같은 톤
  renderer.toneMappingExposure = 1.08;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x0b0d0e, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a2125, 2400, 8600);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 16000);

  const noise = makeNoise(29); // MAIN 눈밭과 같은 시드 — 같은 굴곡
  const sky = createSky();
  scene.add(sky);
  const terrain = createTerrain(noise);
  // 단면 앞쪽(z > 0)의 눈밭은 잘라 낸다
  terrain.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  scene.add(terrain);
  // 시드가 다른 눈발 두 겹 — 앞쪽을 잘라 내 줄어든 밀도를 채운다
  const snows = [createSnowfall(41), createSnowfall(73)];
  // 멀리 있는 눈송이가 장면 안개(scene.fog)에 묻혀 사라지지 않게 눈만 안개에서 뺀다.
  // 이 카메라에선 MAIN 크기(7)면 눈송이가 1~4px 라 거의 안 보인다. 크게 키우면 카메라 바로 앞 눈송이가
  // 크고 흐릿한 동그라미(거품)가 되므로, 앞쪽은 잘라 내고(resize) 남은 눈송이를 키워 2~5px 점으로 보이게 한다.
  // 공용 설정(heroEnvironment)은 MAIN 그대로다
  snows.forEach((snow) => {
    snow.object.material.size = 18;
    snow.object.material.opacity = 0.8;
    snow.object.material.fog = false;
    scene.add(snow.object);
  });
  const moon = new THREE.DirectionalLight(0xb9c7d0, 0.8);
  moon.position.set(900, 1400, -2200);
  scene.add(moon);

  // 단면 — 윗선은 눈밭의 z=0 높이(heroEnvironment createTerrain 의 dunes 항)를 따른다
  const duneAt = (x) => (noise(x / 900 + 3.1, 1.7, 4) - 0.5) * 70;
  const faceGeometry = new THREE.PlaneGeometry(1, 1, 240, 1);
  const tops = new Float32Array(faceGeometry.attributes.position.count);
  faceGeometry.setAttribute('aTop', new THREE.BufferAttribute(tops, 1));
  const keyUniform = Array.from({ length: 5 }, () => new THREE.Vector4());
  const faceMaterial = new THREE.ShaderMaterial({
    vertexShader: FACE_VERT,
    fragmentShader: FACE_FRAG,
    uniforms: {
      uKeys: { value: keyUniform },
      uBg: { value: new THREE.Vector3(0.043, 0.051, 0.055) },
      uGlow: { value: GLOW },
    },
    toneMapped: false,
    fog: false,
  });
  const face = new THREE.Mesh(faceGeometry, faceMaterial);
  scene.add(face);

  const mistMaterial = new THREE.ShaderMaterial({
    vertexShader: MIST_VERT,
    fragmentShader: MIST_FRAG,
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0.3 }, uSurface: { value: 0 } },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const mistGeometry = new THREE.PlaneGeometry(1, 1);
  const mist = new THREE.Mesh(mistGeometry, mistMaterial);
  mist.renderOrder = 2;
  scene.add(mist);

  let width = 1; let height = 1; let surface = 0;
  const keyWorld = {};                // 키워드 결정의 단면 위 자리 (px)
  const layoutKeys = () => {
    const narrow = width < height;
    const reach = Math.min(width * 0.36, width / 2 - (narrow ? 118 : 160));
    Object.entries(keys).forEach(([id, k]) => {
      const kx = narrow ? k.tall[0] : k.wide[0];
      const kd = narrow ? k.tall[1] : k.wide[1];
      const x = kx * reach;
      keyWorld[id] = { x, y: surface + duneAt(x) - kd * height, depth: kd };
    });
  };

  const resize = () => {
    // 레이아웃 크기로 잰다. getBoundingClientRect 는 transform 까지 포함해서,
    // ABOUT 이 확대된 채 들어오는 연출 도중에 재면 그 크기로 굳어 버린다
    // (transform 은 레이아웃을 안 바꿔 ResizeObserver 가 다시 부르지 않는다 → 핀과 조각이 어긋났다)
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width <= 900 ? 1.1 : 1.35));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, 0, (height / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.updateProjectionMatrix();
    // 지표선은 화면 위에서 60% 자리 — 그 위로 MAIN 의 하늘과 먼 산이 넓게 보인다
    surface = height * (width < height ? 0.2 : -0.1);
    terrain.position.y = surface;
    // 눈은 지표 위, 카메라에서 어느 정도 떨어진 곳(z ≤ −200)에만 내린다
    snows.forEach((snow) => {
      snow.object.position.y = surface + 200;
      snow.object.material.clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -(surface - 30)),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), -200),
      ];
    });
    const distance = camera.position.z + 7600;
    const viewH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    sky.position.set(0, surface * 0.4, -7600);
    sky.scale.set(viewH * camera.aspect * 1.3, viewH * 1.3, 1);
    // 단면 — 화면 폭보다 넓게, 지표선에서 FACE_DEPTH 만큼 아래로
    const faceW = width * 2.4;
    const pos = faceGeometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const u = (i % 241) / 240;
      const x = (u - 0.5) * faceW;
      const top = surface + duneAt(x);
      tops[i] = top;
      pos.setXYZ(i, x, i < 241 ? top : top - FACE_DEPTH, 0);
    }
    pos.needsUpdate = true;
    faceGeometry.attributes.aTop.needsUpdate = true;
    faceGeometry.computeBoundingSphere();
    mist.scale.set(faceW, 400, 1);
    mist.position.set(0, surface + 160, 2);
    mistMaterial.uniforms.uSurface.value = surface;
    layoutKeys();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const projected = new THREE.Vector3();
  let time = 0;
  let lookX = 0; let lookY = 0;

  return {
    /** 한 장면 — glow: 키워드별 밝기, drop: 카메라가 내려간 거리(px), look: 커서 시차(-0.5~0.5), mist: 승화 연기 세기 */
    render(dt, { glow, drop, look, mist: mistStrength = 0.3 }) {
      time += dt;
      mistMaterial.uniforms.uTime.value = time;
      mistMaterial.uniforms.uStrength.value = mistStrength;
      snows.forEach((snow) => snow.update(dt, time, 0));
      lookX = THREE.MathUtils.damp(lookX, look.x * 40, 2.2, dt);
      lookY = THREE.MathUtils.damp(lookY, -look.y * 20, 2.2, dt);
      camera.position.x = lookX;
      camera.position.y = lookY - drop;
      Object.keys(keys).forEach((id, i) => {
        const k = keyWorld[id];
        keyUniform[i].set(k.x, k.y, glow[id] || 0, 0);
      });
      renderer.render(scene, camera);
    },
    /** 단면 위의 점 → 화면 px */
    toScreen(x, y) {
      projected.set(x, y, 0).project(camera);
      return [(projected.x * 0.5 + 0.5) * width, (-projected.y * 0.5 + 0.5) * height];
    },
    key(id) { return keyWorld[id]; },
    /** 키워드의 가로 자리를 바깥에서 정한다 — 글자 폭을 재서 틈을 고르게 맞출 때 */
    placeKey(id, x) {
      const k = keyWorld[id];
      if (!k) return;
      k.x = x;
      k.y = surface + duneAt(x) - k.depth * height;
    },
    surfaceAt(x) { return surface + duneAt(x); },
    size() { return { width, height }; },
    dispose() {
      observer.disconnect();
      snows.forEach((snow) => snow.dispose());
      sky.geometry.dispose();
      sky.material.dispose();
      terrain.geometry.dispose();
      terrain.material.dispose();
      faceGeometry.dispose();
      faceMaterial.dispose();
      mistGeometry.dispose();
      mistMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
