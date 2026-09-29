import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeNoise, createSky, createTerrain, createSnowfall } from './heroEnvironment';
import { createIceShard } from './iceBlockScene';
import { ICE_ATTENUATION, createTrail, createWorkIceMaterial, createSmoke, createSmokeTexture } from './workIceScene';

/* ABOUT 지도 — MAIN 의 눈밭을 칼로 자른 단면.

   위쪽 1/3 은 MAIN 과 같은 하늘·먼 산·눈발이고, 그 아래는 눈밭 속이다.
   드라이아이스는 이산화탄소 눈을 눌러 다져 만든다 — 그래서 단면은 눈 → 다져진 눈 → 단단한 층으로
   거의 수평하게 쌓이고, 색은 청록빛 없이 불투명한 흰회색이다(푸른빛은 물 얼음·바닷속으로 읽힌다).
   단면의 윗선은 MAIN 눈밭의 실제 굴곡(같은 노이즈, 같은 시드)을 따르고, 그 위로 승화 연기가 낮게 흐른다.

   키워드마다 PORTFOLIO 얼음과 같은 재질의 드라이아이스 덩어리가 눈밭에 반쯤 묻혀 있다(BLOCKS).
   카메라는 단면(z=0)을 정면으로 본다. 단위는 MAIN 과 같이 "z=0 에서 1 = 1px" 이라
   단면 위의 좌표가 곧 화면 px 이다(화면 가운데가 원점, y 는 위가 +). */

const FOV = 35; // MAIN 히어로와 같다
const FACE_DEPTH = 5200; // 단면이 내려가는 깊이 (px)
const GLOW = new THREE.Vector3(0.38, 0.87, 0.84);

/* 키워드마다 눈밭에 반쯤 묻힌 드라이아이스 덩어리 — PORTFOLIO 얼음과 같은 재질·연기.
   shape: 파편 크기(가로·세로·깊이), seed: 깎인 모양, rot: 기본 기울기, size: 덩어리 크기 비율, sink: 묻힌 정도(0~1).
   비슷한 덩어리가 한 줄로 서면 묘비처럼 읽혀서, 모양(낮고 넓은·가늘고 긴·누운)·기울기·묻힌 깊이를 확 다르게 둔다.
   ABOUT 이 가장 크다. 나중에 컬러 아이콘을 속에 넣을 자리다 */
const BLOCKS = {
  observe: { shape: [1.7, 1.05, 1.25], seed: 11, rot: [0.22, 0.7, -0.18], size: 0.66, sink: 0.42 },
  structure: { shape: [0.85, 2.0, 0.9], seed: 19, rot: [0.06, -0.3, 0.26], size: 0.98, sink: 0.3 },
  hyomin: { shape: [1.45, 1.75, 1.3], seed: 3, rot: [0.16, -0.5, -0.1], size: 1.12, sink: 0.26 },
  build: { shape: [1.55, 1.25, 1.5], seed: 29, rot: [0.35, 0.95, 0.22], size: 0.74, sink: 0.36 },
  detail: { shape: [1.05, 1.6, 1.0], seed: 37, rot: [-0.08, -0.85, -0.3], size: 0.86, sink: 0.34 },
};
const FROST_REST = 0.92;   // 평소 — 서리가 껴 뿌옇다
const FROST_CLEAR = 0.38;  // 가리키면 — 서리가 걷혀 속이 비친다

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

  // 드라이아이스 덩어리 — MAIN·PORTFOLIO 얼음과 같은 환경광·조명·재질
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.15);
  keyLight.position.set(-420, 560, 720);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xdce4e8, 2.8);
  rimLight.position.set(520, 120, -280);
  scene.add(rimLight);
  scene.add(new THREE.HemisphereLight(0xe2e7e9, 0x1c1f21, 0.62));
  const trail = createTrail(renderer);           // 얼음 재질이 읽는 손자국 버퍼 — 여기선 문지르지 않는다
  trail.uniforms.uPoint.value.set(-10, -10);
  const smokeTexture = createSmokeTexture();
  const blocks = Object.keys(keys).map((id) => {
    const cfg = BLOCKS[id];
    const geometry = createIceShard({ width: cfg.shape[0], height: cfg.shape[1], depth: cfg.shape[2], seed: cfg.seed });
    const material = createWorkIceMaterial(trail.sample);
    material.opacity = 1;                        // 공용 재질은 0 에서 시작한다(등장 연출용)
    material.userData.ice.uTouchFog.value = 0;
    material.userData.ice.uFrost.value = FROST_REST;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    // 연기는 덩어리를 따라가되 같이 구르지 않도록 따로 둔다
    const smoke = createSmoke(cfg.shape, cfg.seed, smokeTexture, { count: 18, strength: 1.2, spread: 1.3, wisps: 24 });
    // 공용 연기는 깊이 검사를 끄고 그린다. 여기선 덩어리가 단면 뒤 눈밭에 있어서, 켜 두어야
    // 흘러내린 연기가 단면(지층)에 가려 눈 위에만 보인다 — 끄면 땅속에 연기가 있는 것처럼 보였다
    smoke.group.traverse((node) => { if (node.material) node.material.depthTest = true; });
    scene.add(smoke.group);
    return { id, cfg, group, geometry, material, smoke, spin: 0, lift: 0 };
  });
  let blockUnit = 100;                           // 덩어리 높이(px) — 화면 크기에 맞춘다

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
    trail.resize(width, height);
    blockUnit = width < height
      ? THREE.MathUtils.clamp(width * 0.15, 40, 64)
      : THREE.MathUtils.clamp(height * 0.17, 70, 130);
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

      // 덩어리 — 평소엔 서리가 껴 천천히 돌고 바닥에서 연기가 흐른다.
      // 가리키면(glow 가 오르면) 서리가 걷혀 투명해지고, 연기가 피어오르고, 살짝 떠오른다
      trail.step(dt);
      const narrow = width < height;
      blocks.forEach((b) => {
        const k = keyWorld[b.id];
        if (!k) return;
        const g = glow[b.id] ?? 0.5;
        const hover = THREE.MathUtils.clamp((g - 0.5) / 0.5, 0, 1);
        const scale = (blockUnit * b.cfg.size) / b.cfg.shape[1];
        const px = blockUnit * b.cfg.size;
        b.lift = THREE.MathUtils.damp(b.lift, hover * px * 0.12, 5, dt);
        b.spin += dt * (0.16 + hover * 0.7);
        // 넓은 화면: 지표선 뒤 눈밭에 아랫부분이 묻힌다(단면과 눈밭이 가린다)
        // 좁은 화면: 눈 속 제자리에 박혀 뒤쪽 절반이 단면 속에 들어간다
        const x = k.x;
        const y = narrow ? k.y : surface + duneAt(x) + px * (0.5 - b.cfg.sink);
        const z = narrow ? 10 : -px * 0.95;   // 덩어리 앞면이 단면 앞으로 튀어나와 이름표를 가리지 않게
        b.group.position.set(x, y + b.lift + Math.sin(time * 0.5 + b.cfg.seed) * 1.5, z);
        b.group.scale.setScalar(scale);
        b.group.rotation.set(
          b.cfg.rot[0] + Math.sin(time * 0.31 + b.cfg.seed) * 0.03,
          b.cfg.rot[1] + b.spin,
          b.cfg.rot[2],
        );
        b.material.attenuationDistance = ICE_ATTENUATION * scale;
        b.material.userData.ice.uFrost.value = THREE.MathUtils.lerp(FROST_REST, FROST_CLEAR, hover);
        b.smoke.group.position.copy(b.group.position);
        b.smoke.group.scale.setScalar(scale);
        // 다른 키워드로 내려가는 동안(glow 가 바닥)엔 연기도 잦아든다
        b.smoke.update(dt * (1 + hover), THREE.MathUtils.clamp(g / 0.5, 0.25, 1), 0, hover * 0.9, null);
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
    /** 키워드 덩어리의 화면 크기(px) — 버튼이 덩어리를 덮도록 */
    blockSize(id) {
      const cfg = BLOCKS[id];
      if (!cfg) return { w: 0, h: 0 };
      const h = blockUnit * cfg.size;
      return { w: h * (cfg.shape[0] / cfg.shape[1]) * 1.2, h: h * 1.1 };
    },
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
      blocks.forEach((b) => {
        b.geometry.dispose();
        b.material.dispose();
        b.smoke.dispose();
      });
      smokeTexture.dispose();
      trail.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
