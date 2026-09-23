import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export function createIceGeometry() {
  const source = new RoundedBoxGeometry(2.35, 2.35, 2.35, 7, 0.085);
  // Keep the large planes calm; slight asymmetry bends the reflected light strips.
  const positions = source.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const wave = Math.sin(x * 2.4 + y * 1.7) * Math.sin(z * 2.2 - y * 1.1);
    positions.setXYZ(i, x + wave * 0.013, y + Math.sin(x * 2 + z * 2.5) * 0.012, z + wave * 0.019);
  }
  source.deleteAttribute('normal');
  source.deleteAttribute('uv');
  const geometry = mergeVertices(source, 0.0001);
  source.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const noise = /* glsl */`
  float iceHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float iceNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(iceHash(i), iceHash(i + vec3(1,0,0)), f.x),
      mix(iceHash(i + vec3(0,1,0)), iceHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(iceHash(i + vec3(0,0,1)), iceHash(i + vec3(1,0,1)), f.x),
      mix(iceHash(i + vec3(0,1,1)), iceHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float iceCloud(vec3 p) {
    return iceNoise(p) * 0.57 + iceNoise(p * 2.03 + 3.1) * 0.28 + iceNoise(p * 4.1) * 0.15;
  }
`;

/**
 * 드라이아이스 재질. 메인 큐브와 포트폴리오 표본이 같이 쓴다.
 *   positionScale  노이즈·성에를 계산하는 좌표 배율. 큐브(한 변 2.35) 기준으로 맞춰져 있어서
 *                  크기가 다른 덩어리는 이 값으로 결의 굵기를 큐브와 같게 맞춘다.
 *   edge           'box'      큐브 — 좌표로 모서리를 알고 거기에 성에가 두껍게 낀다
 *                  'fresnel'  모양이 제각각인 덩어리 — 윤곽(비스듬히 보이는 면)에 성에가 낀다
 */
export function createIceMaterial(uniforms, { positionScale = 1, edge = 'box', frostBase = 0.12, mottle = 0.35 } = {}) {
  const iceEdgeGlsl = edge === 'fresnel'
    ? 'float iceEdge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);'
    : `vec3 iceAbs = abs(vIcePosition);
      float iceMiddle = iceAbs.x + iceAbs.y + iceAbs.z - max(max(iceAbs.x, iceAbs.y), iceAbs.z) - min(min(iceAbs.x, iceAbs.y), iceAbs.z);
      float iceEdge = smoothstep(0.9, 1.18, iceMiddle);`;
  // 드라이아이스는 유리가 아니다 — 눈을 눌러 굳힌 하얀 결정 덩어리.
  // 몸통은 분필처럼 탁하고, 빛만 속으로 살짝 스며 뒤의 글자가 뿌옇게 번져 보인다.
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f6,
    metalness: 0,
    roughness: 0.5,
    transmission: 0.9,
    thickness: 2.4,
    ior: 1.3,
    attenuationColor: new THREE.Color(0xd9e5e8),
    attenuationDistance: 4,
    envMapIntensity: 0.85,
    specularIntensity: 0.45,
    sheen: 1,
    sheenColor: new THREE.Color(0xffffff),
    sheenRoughness: 0.85,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIcePosition;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvIcePosition = position * ${positionScale.toFixed(4)};`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', /* glsl */`
      #include <common>
      varying vec3 vIcePosition;
      uniform float uHeat;
      uniform vec3 uHeatPoint;
      ${noise}
    `).replace('#include <roughnessmap_fragment>', /* glsl */`
      #include <roughnessmap_fragment>
      ${iceEdgeGlsl}
      float iceClouds = smoothstep(0.35, 0.8, iceCloud(vIcePosition * 3.2 + 7.0));
      float iceGrain = iceNoise(vIcePosition * 42.0);
      float iceHeat = (1.0 - smoothstep(0.1, 0.95, distance(vIcePosition, uHeatPoint))) * uHeat;
      // 성에 층: 모서리일수록 두껍고, 커서(열)가 닿은 자리는 녹아서 속이 비친다
      float iceFrost = clamp(${frostBase.toFixed(3)} + iceEdge * 0.75 + iceClouds * ${mottle.toFixed(3)} + iceGrain * 0.12 - iceHeat * 0.55, 0.0, 1.0);
      roughnessFactor = mix(0.2, 0.9, iceFrost);
      diffuseColor.rgb = mix(vec3(0.70, 0.76, 0.78), vec3(0.97, 0.985, 0.99), iceFrost);
    `).replace('#include <normal_fragment_maps>', /* glsl */`
      #include <normal_fragment_maps>
      // 압축된 결정 알갱이 — 매끈한 면이 아니라 서리 낀 표면
      float iceRelief = iceCloud(vIcePosition * 6.0) * 0.006 + iceNoise(vIcePosition * 70.0) * 0.0014 * (0.4 + iceFrost);
      vec3 iceDx = dFdx(-vViewPosition);
      vec3 iceDy = dFdy(-vViewPosition);
      vec3 iceR1 = cross(iceDy, normal);
      vec3 iceR2 = cross(normal, iceDx);
      float iceDet = dot(iceDx, iceR1);
      vec3 iceGradient = sign(iceDet) * (dFdx(iceRelief) * iceR1 + dFdy(iceRelief) * iceR2);
      normal = normalize(abs(iceDet) * normal - iceGradient);
    `).replace('#include <emissivemap_fragment>', /* glsl */`
      #include <emissivemap_fragment>
      // 속으로 스며든 빛이 모서리에서 번져 나오는 차가운 광 (가짜 subsurface)
      totalEmissiveRadiance += vec3(0.62, 0.70, 0.74) * (0.035 + iceEdge * 0.09) * (1.0 - iceHeat * 0.5);
    `).replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace(
      'material.transmission = transmission;',
      'material.transmission = transmission * (1.0 - iceFrost * 0.5);'
    ));
  };
  material.customProgramCacheKey = () => `dry-ice-chalk-v3-${edge}-${positionScale.toFixed(4)}-${frostBase}-${mottle}`;
  return material;
}

export function createStudio(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101417);
  const cards = [
    { position: [-4, 3, 4], size: [2.2, 6], color: 0xe9f3f6, power: 5 },
    { position: [4, 1, 1], size: [0.65, 5], color: 0xc7dce6, power: 3.5 },
    { position: [0, 5, -2], size: [5, 2], color: 0xffffff, power: 4 },
    { position: [-1, -3, 2], size: [4, 0.4], color: 0xbed2d6, power: 1.6 },
    { position: [3, 2, -4], size: [2, 5], color: 0xf5f1e9, power: 3 },
    { position: [-5, -1, 4], size: [5, 5], color: 0xd7e6e9, power: 1.2 },
  ];
  for (const card of cards) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(card.color).multiplyScalar(card.power), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...card.size), material);
    mesh.position.set(...card.position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.04, 0.1, 30);
  scene.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  pmrem.dispose();
  return target;
}

export function paintBackdrop(canvas, host) {
  const width = host.clientWidth, height = host.clientHeight;
  const scale = Math.min(1.8, 3072 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0b0d0e';
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width * 0.61, height * 0.46, 0, width * 0.61, height * 0.46, height * 0.58);
  glow.addColorStop(0, 'rgba(125,155,169,0.055)');
  glow.addColorStop(1, 'rgba(125,155,169,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  const hostBounds = host.getBoundingClientRect();
  const title = host.parentElement.querySelector('.main__claim');
  if (!title) return;
  for (const line of title.children) {
    const bounds = line.getBoundingClientRect();
    const style = getComputedStyle(line);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.letterSpacing = style.letterSpacing;
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText(line.textContent);
    const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize) * 0.2;
    const x = bounds.left - hostBounds.left;
    const y = bounds.top - hostBounds.top + (bounds.height - ascent - descent) / 2 + ascent;
    ctx.fillStyle = style.color;
    ctx.fillText(line.textContent, x, y);
    const strokeWidth = parseFloat(style.webkitTextStrokeWidth);
    if (strokeWidth) {
      ctx.strokeStyle = style.webkitTextStrokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(line.textContent, x, y);
    }
  }
}

export function createVapor() {
  const count = 48;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.399963;
    positions.set([Math.cos(angle), Math.sin(angle), ((i * 0.618034) % 1) * 2 - 1], i * 3);
    seeds[i] = (i * 0.7548777) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 }, uPixelRatio: { value: 1 }, uHeatPoint: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */`
      uniform float uTime, uHeat, uPixelRatio;
      uniform vec3 uHeatPoint;
      attribute float aSeed;
      varying float vOpacity, vSeed;
      void main() {
        float life = fract(aSeed + uTime * 0.16);
        vec3 p = uHeatPoint * 1.025 + position * 0.14;
        p += vec3(position.x * life * 0.65, -life * 0.65, position.z * life * 0.4);
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = (30.0 + life * 60.0) * uPixelRatio * (5.0 / -view.z);
        vOpacity = sin(life * 3.14159) * uHeat * 0.075;
        vSeed = aSeed;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vOpacity, vSeed;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float alpha = exp(-dot(p, p) * 18.0) * (1.0 - smoothstep(0.28, 0.5, length(p)));
        alpha *= 0.65 + 0.35 * sin(p.x * 17.0 + sin(p.y * 13.0 + vSeed * 20.0));
        gl_FragColor = vec4(0.72, 0.81, 0.83, alpha * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/**
 * 드라이아이스에서 끊임없이 흘러내리는 냉기.
 * CO₂ 는 공기보다 무거워서 위로 피어오르지 않는다 — 아래 모서리에서 넘쳐
 * 흘러내리다가 속도를 잃고 옆으로 퍼진다. 큐브가 돌아도 연기는 중력을 따르므로
 * sculpture 가 아니라 scene(월드 공간)에 붙이고 uOrigin/uScale 로 따라가게 한다.
 */
export function createColdFog(count = 180) {
  const spawns = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const u = (i * 0.618034) % 1, v = (i * 0.7548777) % 1, w = (i * 0.5698403) % 1;
    // 아래 둘레 띠: x·z 는 큐브 폭 안, y 는 아래쪽 1/3 지점
    spawns.set([u * 2 - 1, v, w * 2 - 1], i * 3);
    seeds[i] = (i * 0.3819660) % 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(spawns, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uAmount: { value: 1 },
      uScale: { value: 1 },
      uOrigin: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */`
      uniform float uTime, uPixelRatio, uAmount, uScale;
      uniform vec3 uOrigin;
      attribute float aSeed;
      varying float vOpacity, vSeed, vLife;
      void main() {
        float speed = 0.055 + fract(aSeed * 7.31) * 0.04;
        float life = fract(aSeed + uTime * speed);
        // 큐브 아래쪽 절반에서 태어나 앞면을 타고 흘러내린다
        vec3 p = vec3(position.x * 1.05, -0.2 - position.y * 0.8, position.z * 1.05);
        // 떨어지는 속도는 점점 줄고(무거운 기체가 바닥에 닿는다) 대신 옆으로 번진다
        float fall = 1.0 - (1.0 - life) * (1.0 - life);
        p.y -= fall * 2.3;
        float side = position.x < 0.0 ? -1.0 : 1.0;
        p.x += side * pow(life, 1.6) * (0.9 + fract(aSeed * 3.7) * 0.9);
        p.z += position.z * life * 0.5 + 0.35;
        p.x += sin(uTime * 0.45 + aSeed * 31.0) * 0.18 * life;
        vec4 view = viewMatrix * vec4(uOrigin + p * uScale, 1.0);
        gl_Position = projectionMatrix * view;
        // 갓 넘친 냉기는 가늘고 옅게, 바닥으로 갈수록 넓고 짙게 고인다
        gl_PointSize = (70.0 + life * life * 520.0) * uScale * uPixelRatio * (4.0 / -view.z);
        vOpacity = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life)) * (0.05 + life * 0.1) * uAmount;
        vSeed = aSeed;
        vLife = life;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vOpacity, vSeed, vLife;
      float fogHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float fogNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(fogHash(i), fogHash(i + vec2(1, 0)), f.x), mix(fogHash(i + vec2(0, 1)), fogHash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        // 둥근 방울이 아니라 옆으로 길게 찢어진 결
        p.y *= 1.35;
        float body = exp(-dot(p, p) * 9.0) * (1.0 - smoothstep(0.3, 0.5, length(p)));
        vec2 q = p * 3.2 + vSeed * 17.0 + vec2(vLife * 1.4, 0.0);
        float wisp = fogNoise(q) * 0.6 + fogNoise(q * 2.1 + 5.0) * 0.4;
        float alpha = body * smoothstep(0.25, 0.85, wisp);
        gl_FragColor = vec4(0.86, 0.91, 0.93, alpha * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 2;
  return points;
}

/**
 * 카메라 바로 앞에 붙는 연기 막.
 * 얼음에 다가갈수록 가장자리부터 차올라, 끝에서는 연기 너머로 얼음이 비쳐 보이다가
 * 화면 전체가 연기로 덮인다 — 그 연기 속에서 ABOUT 이 나타난다.
 */
export function createFogVeil() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uAmount, uAspect;
      varying vec2 vUv;
      float veilHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float veilNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(veilHash(i), veilHash(i + vec2(1, 0)), f.x), mix(veilHash(i + vec2(0, 1)), veilHash(i + vec2(1, 1)), f.x), f.y);
      }
      float veilFbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += veilNoise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
        // 무거운 연기라 천천히 가라앉으며 옆으로 말린다
        vec2 flow = vec2(uTime * 0.035, uTime * 0.07);
        vec2 warp = vec2(veilFbm(p * 1.6 + flow), veilFbm(p * 1.6 - flow + 4.3));
        float n = veilFbm(p * 2.2 + warp * 1.4 + vec2(0.0, uTime * 0.09));
        float edge = smoothstep(0.12, 0.85, length(p * vec2(0.85, 1.15)));
        float density = smoothstep(0.0, 1.0, uAmount * 1.65 + edge * 0.5 - 0.62 + (n - 0.5) * 0.7);
        float alpha = density * (0.5 + 0.47 * uAmount);
        vec3 color = mix(vec3(0.42, 0.47, 0.49), vec3(0.76, 0.83, 0.85), clamp(n * 0.7 + uAmount * 0.45, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  return mesh;
}
