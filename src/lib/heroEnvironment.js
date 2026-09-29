import * as THREE from 'three';
import { seeded } from './workIceScene';

/* 메인 첫 화면의 배경 — 달빛 아래 어두운 빙원.
   가까운 바닥은 낮은 눈 둔덕, 멀어질수록 솟아 안개 속 산등성이가 된다.
   하늘은 위쪽이 페이지 배경(--bg)과 같은 색이라 내비게이션 쪽과 이음새 없이 이어진다.
   단위는 히어로 장면과 같은 "z=0 에서 1 = 1px" 이다. */

const SKY_TOP = new THREE.Color(0x0b0d0e); // --bg
const HORIZON = new THREE.Color(0x1f272c);
const FOG = 0x1a2125;

export function makeNoise(seed) {
  const rand = seeded(seed);
  const size = 256;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i += 1) table[i] = rand();
  const at = (x, y) => table[((y & (size - 1)) * size) + (x & (size - 1))];
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, octaves = 5) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i += 1) {
      sum += value(x * freq, y * freq) * amp;
      freq *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };
}

export function createSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: SKY_TOP },
      uHorizon: { value: HORIZON },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      varying vec2 vUv;
      void main() {
        // 지평선 근처만 옅게 밝고, 위로 갈수록 페이지 배경색으로 가라앉는다
        float t = smoothstep(0.38, 0.95, vUv.y);
        vec3 color = mix(uHorizon, uTop, t);
        // 달빛이 번진 자리
        float moon = exp(-pow(distance(vUv, vec2(0.68, 0.62)) * 3.2, 2.0));
        color += vec3(0.05, 0.06, 0.065) * moon;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.renderOrder = -10;
  return mesh;
}

export function createTerrain(noise) {
  const width = 16000;
  const depth = 9000;
  const geometry = new THREE.PlaneGeometry(width, depth, 220, 150);
  geometry.rotateX(-Math.PI / 2);
  // 카메라 바로 앞(z≈+1000)부터 먼 산(z≈-8000)까지 덮는다
  geometry.translate(0, 0, -3500);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    // 앞쪽(z 큼)은 거의 평평한 눈밭, 뒤로 갈수록 산이 된다
    const far = THREE.MathUtils.smoothstep(-z, 2600, 7400);
    const dunes = noise(x / 900 + 3.1, z / 700 + 1.7, 4) - 0.5;
    const ridge = 1 - Math.abs(noise(x / 2600 + 11, z / 1800 + 5, 5) * 2 - 1);
    const height = dunes * 70 + far * (ridge * ridge * 1700 + (noise(x / 1100, z / 900 + 9, 4) - 0.4) * 300);
    position.setY(i, height);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    // 흰 글자가 읽히도록 눈밭은 어둡게 — 결과 능선만 달빛에 드러난다
    color: 0x12171a,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.12,
  });
  // 눈 표면의 잔결 — 법선을 조금 흔들어 달빛에 반짝이는 결을 만든다
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWorld;
float snowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float snowNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(snowHash(i), snowHash(i + vec2(1, 0)), f.x), mix(snowHash(i + vec2(0, 1)), snowHash(i + vec2(1, 1)), f.x), f.y);
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 p = vWorld.xz;
  float gx = snowNoise(p * 0.05 + vec2(0.7, 0.0)) - snowNoise(p * 0.05 - vec2(0.7, 0.0));
  float gz = snowNoise(p * 0.05 + vec2(0.0, 0.7)) - snowNoise(p * 0.05 - vec2(0.0, 0.7));
  normal = normalize(normal + vec3(gx, 0.0, gz) * 0.12);
}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
{
  // 드문드문 반짝이는 눈 결정
  float glint = step(0.985, snowHash(floor(vWorld.xz * 0.35)));
  gl_FragColor.rgb += glint * 0.18 * (1.0 - smoothstep(-400.0, -3500.0, vWorld.z));
}`);
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  return mesh;
}

export function createSnowfall(seed) {
  const count = 520;
  const rand = seeded(seed);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (rand() - 0.5) * 5200;
    positions[i * 3 + 1] = rand() * 1400 - 500;
    positions[i * 3 + 2] = -rand() * 3800 + 500;
    speeds[i] = 10 + rand() * 26;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.PointsMaterial({
    map: texture,
    color: 0xdfe8ec,
    size: 7,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    object: points,
    update(dt, time, wind) {
      for (let i = 0; i < count; i += 1) {
        const k = i * 3;
        positions[k] += (Math.sin(time * 0.4 + i) * 6 + wind) * dt;
        positions[k + 1] -= speeds[i] * dt;
        if (positions[k + 1] < -520) {
          positions[k + 1] += 1900;
          positions[k] = (rand() - 0.5) * 5200;
        }
        if (positions[k] > 2600) positions[k] -= 5200;
        if (positions[k] < -2600) positions[k] += 5200;
      }
      geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

export function createHeroEnvironment(scene) {
  scene.fog = new THREE.Fog(FOG, 2400, 8600);
  const group = new THREE.Group();
  scene.add(group);

  const sky = createSky();
  group.add(sky);
  const terrain = createTerrain(makeNoise(29));
  group.add(terrain);
  const snow = createSnowfall(41);
  group.add(snow.object);

  // 달빛: 빙원 전체를 비스듬히 비추는 차가운 빛 (얼음 조명과 별도로 바닥 결을 살린다)
  const moon = new THREE.DirectionalLight(0xb9c7d0, 0.8);
  moon.position.set(900, 1400, -2200);
  group.add(moon);

  return {
    // 카메라와 화면 크기에 맞춰 바닥 높이와 하늘판을 다시 놓는다
    layout(camera, height) {
      terrain.position.y = -height * 0.5;
      const distance = camera.position.z + 7600;
      const viewH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      sky.position.set(0, 0, -7600);
      sky.scale.set(viewH * camera.aspect * 1.2, viewH * 1.2, 1);
      snow.object.position.y = -height * 0.1;
    },
    update(dt, time, wind = 0) {
      snow.update(dt, time, wind);
    },
    dispose() {
      scene.fog = null;
      sky.geometry.dispose();
      sky.material.dispose();
      terrain.geometry.dispose();
      terrain.material.dispose();
      snow.dispose();
    },
  };
}
