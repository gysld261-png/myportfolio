import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 얼음 블록 — 프로젝트 로고가 속에 갇힌 드라이아이스 표본.
 *
 * 모양:  상자를 노이즈로 비틀고, 모서리 몇 군데를 평면으로 깎아 쪼개진 면을 만든다.
 * 재질:  투과(transmission) + 분산(dispersion) + 무지개 막(iridescence).
 *        표면 결은 텍스처 없이 셰이더에서 노이즈로 법선을 흔들어 만든다 — 세로로 긁힌 결과 녹은 물결.
 * 속:    SVG 로고를 입체로 뽑아 가운데에 넣는다. 불투명이라 투과 패스에 그려져 굴절돼 보인다.
 */

// 결정적 난수 — 같은 씨앗이면 같은 얼음
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 값 노이즈(3D) — 모양 비틀기용
function makeNoise(rand) {
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const hash = (x, y, z) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const lerp = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
      lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
      zf,
    ) * 2 - 1;
  };
  return (x, y, z) => noise(x, y, z) * 0.6 + noise(x * 2.1, y * 2.1, z * 2.1) * 0.28 + noise(x * 4.3, y * 4.3, z * 4.3) * 0.12;
}

/** 깨진 얼음 덩어리 */
export function createIceChunk({ width = 1.5, height = 1.9, depth = 1.25, seed = 7 } = {}) {
  const rand = seeded(seed);
  const noise = makeNoise(rand);
  let geometry = new THREE.BoxGeometry(width, height, depth, 40, 52, 34);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);

  // 깎인 면 — 모서리 근처에 기울어진 평면을 두고 그 바깥은 평면 위로 눌러 붙인다
  const cuts = [];
  for (let i = 0; i < 9; i += 1) {
    const dir = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 1.4, rand() - 0.5).normalize();
    // 아래쪽을 더 많이 깎아 레퍼런스처럼 밑동이 부서진 느낌
    if (i < 3) dir.y = -Math.abs(dir.y) - 0.4;
    dir.normalize();
    const extent = Math.abs(dir.x) * width / 2 + Math.abs(dir.y) * height / 2 + Math.abs(dir.z) * depth / 2;
    cuts.push({ n: dir, d: extent * (0.64 + rand() * 0.2) });
  }

  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  const radial = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    // 1) 큰 비틀림 — 반듯한 상자가 아니라 한 덩어리의 얼음처럼
    radial.copy(v).normalize();
    const big = noise(v.x * 1.1 + 3, v.y * 1.1, v.z * 1.1);
    v.addScaledVector(radial, big * 0.17);
    // 2) 아래쪽일수록 울퉁불퉁 — 녹고 부서진 밑동
    const bottom = THREE.MathUtils.smoothstep(-v.y, 0.1, height / 2);
    v.addScaledVector(radial, noise(v.x * 3.2, v.y * 3.2, v.z * 3.2) * 0.16 * bottom);
    // 윗모서리도 살짝 이가 빠지게
    const top = THREE.MathUtils.smoothstep(v.y, height * 0.32, height / 2);
    v.addScaledVector(radial, noise(v.x * 5 + 9, v.y * 5, v.z * 5) * 0.07 * top);
    // 3) 깎인 면
    for (const cut of cuts) {
      const over = v.dot(cut.n) - cut.d;
      if (over > 0) v.addScaledVector(cut.n, -over);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** 표면 결과 서리를 셰이더에 심는다 */
export function icePhysical() {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xe6eef1,
    transmission: 1,
    thickness: 0.8,
    ior: 1.31,
    roughness: 0.14,
    dispersion: 3.5,
    iridescence: 0.45,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [120, 520],
    attenuationColor: new THREE.Color(0xc4d4dc),
    attenuationDistance: 3.2,
    // 어두운 배경에서도 얼음이 검은 유리가 되지 않도록 안쪽이 살짝 뿌옇게 빛난다
    sheen: 0.6,
    sheenColor: new THREE.Color(0xcfe0e8),
    sheenRoughness: 0.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
    specularIntensity: 1,
    envMapIntensity: 1.25,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIcePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIcePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vIcePos;
float iceHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float iceNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(iceHash(i), iceHash(i + vec3(1,0,0)), f.x), mix(iceHash(i + vec3(0,1,0)), iceHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(iceHash(i + vec3(0,0,1)), iceHash(i + vec3(1,0,1)), f.x), mix(iceHash(i + vec3(0,1,1)), iceHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// 세로로 긴 긁힘 + 잔물결
float iceRelief(vec3 p) {
  float streak = iceNoise(vec3(p.x * 26.0, p.y * 3.2, p.z * 26.0));
  float ripple = iceNoise(p * 9.0) * 0.6 + iceNoise(p * 21.0) * 0.4;
  return streak * 0.55 + ripple * 0.45;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
float frost = smoothstep(0.42, 0.78, iceNoise(vIcePos * 3.4) * 0.7 + iceNoise(vIcePos * 11.0) * 0.3);
roughnessFactor = mix(roughnessFactor, 0.62, frost * 0.85);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // 범프맵과 같은 방식(화면공간 미분) — 높이 h 의 기울기로 법선을 흔든다
  float h = iceRelief(vIcePos) * 0.028;
  vec3 sx = dFdx(-vViewPosition);
  vec3 sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal);
  vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  normal = normalize(abs(det) * normal - g);
}`);
  };
  material.customProgramCacheKey = () => 'ice-block-v1';
  return material;
}

/** SVG 로고를 입체로 */
export async function loadLogo(src, targetWidth, { compact = false } = {}) {
  const data = await new SVGLoader().loadAsync(src);
  const group = new THREE.Group();
  const materials = [];
  const geometries = [];
  data.paths.forEach((path) => {
    const color = path.userData?.style?.fill && path.userData.style.fill !== 'none' ? path.userData.style.fill : '#ffffff';
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setStyle(color),
      roughness: 0.45,
      metalness: 0,
      emissive: new THREE.Color().setStyle(color),
      emissiveIntensity: 0.35,
    });
    materials.push(material);
    path.toShapes(true).forEach((shape) => {
      const geometry = new THREE.ExtrudeGeometry(shape, compact
        ? { depth: 30, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 1.6, bevelSegments: 1, curveSegments: 4 }
        : { depth: 38, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 3, curveSegments: 10 });
      geometries.push(geometry);
      group.add(new THREE.Mesh(geometry, material));
    });
  });
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetWidth / size.x;
  group.children.forEach((mesh) => mesh.position.sub(center));
  const holder = new THREE.Group();
  holder.add(group);
  // SVG 는 y 가 아래로 자란다
  holder.scale.set(scale, -scale, scale);
  return { object: holder, dispose: () => { materials.forEach((m) => m.dispose()); geometries.forEach((g) => g.dispose()); } };
}

/** 얼음이 비칠 배경 — 가운데가 밝은 안개와 옅은 점 격자 */
function backdropTexture(light) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const base = light ? ['#c9d0d4', '#9aa3a9'] : ['#3a4449', '#0b0d0e'];
  const grad = g.createRadialGradient(512, 470, 40, 512, 512, 620);
  grad.addColorStop(0, base[0]);
  grad.addColorStop(1, base[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = light ? 'rgba(255,255,255,0.55)' : 'rgba(207,223,228,0.18)';
  for (let y = 16; y < 1024; y += 64) for (let x = 16; x < 1024; x += 64) g.fillRect(x, y, 2, 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createIceBlock(host, { logo, seed = 7, light = false } = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = light ? 1.0 : 1.12;
  renderer.transmissionResolutionScale = 1;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.05, 6.2);

  const bgTexture = backdropTexture(light);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: bgTexture, toneMapped: false }));
  backdrop.position.z = -3;
  scene.add(backdrop);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2.5, 3.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe6f0, 3);
  rim.position.set(3, 1, -2);
  scene.add(rim);

  const specimen = new THREE.Group();
  scene.add(specimen);
  const iceGeometry = createIceChunk({ seed });
  const iceMaterial = icePhysical();
  const ice = new THREE.Mesh(iceGeometry, iceMaterial);
  specimen.add(ice);

  let logoHandle = null;
  if (logo) {
    logoHandle = await loadLogo(logo, 1.18);
    logoHandle.object.position.set(0, 0.06, 0.18);
    logoHandle.object.rotation.set(0.05, -0.12, 0.04);
    specimen.add(logoHandle.object);
  }

  // 반짝이 — 모서리 쪽에 몇 개
  const sparkleGeometry = new THREE.BufferGeometry();
  const sparkleCount = 26;
  const sparklePos = new Float32Array(sparkleCount * 3);
  const rand = seeded(seed + 31);
  for (let i = 0; i < sparkleCount; i += 1) {
    sparklePos.set([(rand() - 0.5) * 1.5, (rand() - 0.5) * 1.9, 0.62 + rand() * 0.05], i * 3);
  }
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
  const sparkleMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.028, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  specimen.add(sparkles);

  specimen.rotation.set(0.12, -0.5, -0.12);

  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const onMove = (event) => {
    const b = host.getBoundingClientRect();
    pointerTarget.set((event.clientX - b.left) / b.width - 0.5, (event.clientY - b.top) / b.height - 0.5);
  };
  host.addEventListener('pointermove', onMove);

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let frame = 0;
  const start = performance.now();
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const t = (performance.now() - start) / 1000;
    pointer.lerp(pointerTarget, 0.05);
    if (!reduced) {
      specimen.rotation.y = -0.5 + Math.sin(t * 0.25) * 0.35 + pointer.x * 0.6;
      specimen.rotation.x = 0.12 + pointer.y * 0.35;
      specimen.position.y = Math.sin(t * 0.6) * 0.04;
      sparkleMaterial.opacity = 0.45 + Math.sin(t * 3.1) * 0.35;
    }
    renderer.render(scene, camera);
  };
  tick();

  return {
    renderer,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', onMove);
      logoHandle?.dispose();
      iceGeometry.dispose();
      iceMaterial.dispose();
      sparkleGeometry.dispose();
      sparkleMaterial.dispose();
      bgTexture.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

