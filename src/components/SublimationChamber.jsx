import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * SUBLIMATION CHAMBER
 *
 * 메인은 "얼음 하나를 전시하는 곳"이 아니라 "거대한 얼음에 가까이 접근한 시점"이다.
 * - 전체 형태를 절대 보여주지 않는다. 표면의 일부와 균열 하나만 프레임에 걸린다.
 * - 마우스는 안개를 걷지 않는다. 조명의 각도만 바꾼다 → 표면 질감과 균열 깊이가 드러난다.
 * - 카메라는 회전하지 않고 아주 느리게 횡단한다. (스케일을 가늠할 수 없게)
 * - 승화는 시간이 지나면 스스로 진행된다. hover 에 의존하지 않으므로 터치·키보드에서도 동일하다.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clamp01 = (v) => clamp(v, 0, 1);

/* ── 결정론적 value noise — 외부 의존성 없이 얼음 결을 만든다 ── */
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * vnoise(x * freq, y * freq);
    norm += amp;
    freq *= 2.07;
    amp *= 0.5;
  }
  return sum / norm;
}

/* ── 균열 ──
   화면을 길게 가로지르도록 대각선으로 놓는다.
   n = (cos θ, sin θ) 방향 좌표를 a, 균열이 달리는 방향 좌표를 b 라 하면
   균열의 중심선은 a = fissureCenter(b) 이고, 표면상의 거리는 |a - fissureCenter(b)| 이다. */
const FIS_DIR = 1.02;
const FIS_COS = Math.cos(FIS_DIR);
const FIS_SIN = Math.sin(FIS_DIR);

const fisA = (px, py) => px * FIS_COS + py * FIS_SIN;
const fisB = (px, py) => -px * FIS_SIN + py * FIS_COS;
const fissureCenter = (b) => 3.5 + Math.sin(b * 0.2) * 1.55 + Math.sin(b * 0.49 + 1.7) * 0.48;

/* 균열 중심선 위의 한 점 — 내부 조명을 놓을 자리를 찾는 데 쓴다 */
function fissurePoint(b) {
  const a = fissureCenter(b);
  return [a * FIS_COS - b * FIS_SIN, a * FIS_SIN + b * FIS_COS];
}

/* 파편 실루엣 — 얼음 덩어리가 끝나는 지점. 직선이 아니라 파쇄면처럼 들쭉날쭉하다. */
const edgeAt = (py) => -2.1 + (fbm(py * 0.155 + 7.3, 2.1, 4) - 0.5) * 7.4 + Math.sin(py * 0.62) * 0.5;

/**
 * 표면 지오메트리를 직접 만든다.
 * PlaneGeometry 를 쓰지 않는 이유: 파쇄면 실루엣을 만들려면 경계 밖 삼각형을 아예 빼야 한다.
 * (z 를 뒤로 밀어 숨기는 방식은 결국 면이 렌더되어 '벽'처럼 보인다)
 */
function buildSurface({ width = 34, height = 30, segX = 104, segY = 92 }) {
  const cols = segX + 1;
  const rows = segY + 1;
  const originX = -8;
  const originY = -height / 2;

  const gx = new Float32Array(cols * rows);
  const gy = new Float32Array(cols * rows);
  const gz = new Float32Array(cols * rows);
  const inside = new Uint8Array(cols * rows);

  for (let j = 0; j < rows; j += 1) {
    const py = originY + (j / segY) * height;
    const edge = edgeAt(py);

    for (let i = 0; i < cols; i += 1) {
      const px = originX + (i / segX) * width;
      const k = j * cols + i;

      gx[k] = px;
      gy[k] = py;
      inside[k] = px > edge ? 1 : 0;

      /* 표면 기복 — 노이즈 도메인을 회전시켜 격자와 어긋나게 한다 (안 하면 복셀 계단처럼 보인다) */
      const rx = px * 0.906 - py * 0.423;
      const ry = px * 0.423 + py * 0.906;
      let z = (fbm(rx * 0.26 + 3.1, ry * 0.28, 4) - 0.5) * 3.2;
      z += (fbm(rx * 0.88 + 1.7, ry * 0.94 + 5.5, 3) - 0.5) * 0.62;
      z += (fbm(rx * 2.6, ry * 2.6 + 9.1, 2) - 0.5) * 0.16;

      /* 파쇄면 — 아주 약하게만 양자화한다. 강하게 하면 등고선/계단이 된다. */
      const stepped = Math.round(z * 1.15) / 1.15;
      z = z * 0.92 + stepped * 0.08;

      /* 균열 — 중심으로 갈수록 급격히 깊어진다 */
      const b = fisB(px, py);
      const fissureW = 2.6 + Math.sin(b * 0.26) * 0.62;
      const d = Math.abs(fisA(px, py) - fissureCenter(b));
      if (d < fissureW) {
        const t = 1 - d / fissureW;
        z -= Math.pow(t, 1.42) * 8.6;
      } else if (d < fissureW + 1.3) {
        /* 균열 입술 — 갈라질 때 솟아오른 테두리 */
        const t = 1 - (d - fissureW) / 1.3;
        z += Math.pow(t, 2.0) * 0.9;
      }

      /* 파쇄면 쪽으로 갈수록 살짝 주저앉는다 */
      const nearEdge = clamp01((px - edge) / 3.4);
      z -= (1 - nearEdge) * 1.15;

      gz[k] = z;
    }
  }

  const positions = [];
  const indices = [];
  const remap = new Int32Array(cols * rows).fill(-1);

  const pushVertex = (k) => {
    if (remap[k] !== -1) return remap[k];
    const id = positions.length / 3;
    positions.push(gx[k], gy[k], gz[k]);
    remap[k] = id;
    return id;
  };

  for (let j = 0; j < segY; j += 1) {
    for (let i = 0; i < segX; i += 1) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (!inside[a] || !inside[b] || !inside[c] || !inside[d]) continue;
      const ia = pushVertex(a);
      const ib = pushVertex(b);
      const ic = pushVertex(c);
      const id = pushVertex(d);
      indices.push(ia, ic, ib, ib, ic, id);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 균열 바닥에서 새어 나오는 빛.
 * 포인트 라이트만으로는 어두운 재질 + 안개에 묻히므로 발광 리본을 직접 깐다.
 * fog: false, AdditiveBlending — 깊이에 상관없이 '빛'으로 읽힌다.
 */
function buildFissureLight({ from = -15, to = 15, steps = 120, depth = -2.6, halfWidth = 0.34 }) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= steps; i += 1) {
    const b = from + ((to - from) * i) / steps;
    const a = fissureCenter(b);
    /* 중심선에서 법선 방향으로 ±halfWidth 만큼 벌린 두 점 */
    const ax = (a - halfWidth) * FIS_COS - b * FIS_SIN;
    const ay = (a - halfWidth) * FIS_SIN + b * FIS_COS;
    const bx = (a + halfWidth) * FIS_COS - b * FIS_SIN;
    const by = (a + halfWidth) * FIS_SIN + b * FIS_COS;
    /* 균열은 일정한 깊이가 아니다 — 얕은 구간은 빛이 더 가깝다 */
    const z = depth + Math.sin(b * 0.33 + 0.7) * 0.85;
    pos.push(ax, ay, z, bx, by, z);
    if (i < steps) {
      const o = i * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  return geometry;
}

/* 표면에 얹는 성에 결 — bump/roughness 로만 쓴다 */
function buildFrostMap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const n = fbm(x * 0.075, y * 0.075, 4) * 0.72 + fbm(x * 0.3, y * 0.3, 3) * 0.28;
      const v = clamp(Math.round(48 + n * 200), 0, 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.4, 2.4);
  return texture;
}

/* 표면에서 떨어져 나가는 미세한 가루 */
function buildMotes(count = 150) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = (hash2(i, 1.7) - 0.34) * 9.5;
    pos[i * 3 + 1] = (hash2(i, 5.1) - 0.5) * 7.2;
    pos[i * 3 + 2] = (hash2(i, 9.3) - 0.5) * 3.4 + 1.2;
    seed[i] = hash2(i, 13.9) * 100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.userData.seed = seed;
  geometry.userData.origin = pos.slice();
  return geometry;
}

export default function SublimationChamber({ onReadout, exitProgress = 0, introEntrance = false }) {
  const hostRef = useRef(null);
  const exitRef = useRef(exitProgress);
  exitRef.current = exitProgress;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 200);
    const camTarget = new THREE.Vector3(0.4, -0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    /* 냉기 — 멀어지는 표면이 배경색으로 녹아든다. 덩어리의 '끝'을 감추는 장치. */
    scene.fog = new THREE.Fog(0x0b0d0e, 10.5, 34);

    const group = new THREE.Group();
    group.rotation.set(-0.05, 0.22, -0.11);
    scene.add(group);

    const frostMap = buildFrostMap();
    const geometry = buildSurface({});
    const material = new THREE.MeshStandardMaterial({
      color: 0x4e5c63,
      roughness: 0.7,
      metalness: 0.0,
      bumpMap: frostMap,
      bumpScale: 0.14,
      roughnessMap: frostMap,
      flatShading: true,
      transparent: true,
      opacity: introEntrance ? 0 : 1,
      side: THREE.DoubleSide,
    });
    const surface = new THREE.Mesh(geometry, material);
    group.add(surface);

    /* ── 조명 — 이 씬의 주인공. 마우스는 여기에만 연결된다. ── */
    scene.add(new THREE.HemisphereLight(0x8ea7b0, 0x05080a, 0.2));

    const key = new THREE.DirectionalLight(0xe8f6ff, 2.15);
    key.position.set(-6, 5, 7);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x53707a, 0.42);
    fill.position.set(7, -2, 3);
    scene.add(fill);

    /* 균열 안쪽에서 새어 나오는 빛 — 두 지점에 두어 깊이를 만든다 */
    const glowA = new THREE.PointLight(0xd8eef7, 7.5, 15, 1.85);
    const glowB = new THREE.PointLight(0xa8cddc, 5.0, 12, 2.0);
    const [gax, gay] = fissurePoint(2.2);
    const [gbx, gby] = fissurePoint(-6.4);
    glowA.position.set(gax, gay, -1.25);
    glowB.position.set(gbx, gby, -1.8);
    group.add(glowA, glowB);

    /* 균열 안쪽의 발광 — 코어(밝고 좁음) + 번짐(어둡고 넓음) */
    const coreGeometry = buildFissureLight({ depth: -4.6, halfWidth: 0.075 });
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xeaf7ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const haloGeometry = buildFissureLight({ depth: -4.0, halfWidth: 0.52 });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x8fc3d8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    group.add(halo);

    /* ── 가루 ── */
    const moteGeometry = buildMotes(reduced ? 0 : 150);
    const moteMaterial = new THREE.PointsMaterial({
      color: 0xc9dee4,
      size: 0.028,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    scene.add(motes);

    const pointer = { x: 0, y: 0, has: false };
    const lightAim = { az: -0.5, el: 0.42 };
    const lightNow = { az: -0.5, el: 0.42 };

    let raf = 0;
    let lastReadout = 0;
    let lastFrame = 0;
    let mobile = false;
    const startedAt = performance.now();

    function resize() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      mobile = w < 760;
      if (mobile) {
        /* 모바일: 표면을 아래쪽으로 내려 타이포 공간을 비운다 */
        camera.position.set(0, 0, 11.2);
        group.position.set(-1.55, -1.0, 0);
        /* z 축으로 90° 가까이 돌리면 파쇄면 실루엣이 수평선이 된다 */
        group.rotation.set(-0.02, 0.16, -1.28);
        camTarget.set(0, -0.55, 0);
      } else {
        camera.position.set(0, 0, 9);
        group.position.set(2.05, -1.15, 0.1);
        group.rotation.set(-0.05, 0.22, -0.11);
        camTarget.set(0.4, -0.1, 0);
      }
      camera.lookAt(camTarget);
    }

    function onPointerMove(event) {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointer.has = true;
    }

    function onPointerLeave() {
      pointer.has = false;
    }

    function frame(now) {
      const t = now - startedAt;
      const exit = exitRef.current;
      const elapsed = t / 1000;

      /* 등장 — 조명이 서서히 들어온다 (형태가 페이드인하는 게 아니라 빛이 켜진다) */
      const rawIn = introEntrance ? clamp01((t - 420) / 1500) : 1;
      const entrance = 1 - Math.pow(1 - rawIn, 3);

      /* 마우스 → 광원 각도. 마우스가 없으면 아주 느린 자동 궤도로 돌아간다. */
      /* dt 기반 보간 — 프레임당 고정 비율로 하면 저사양 기기에서 조명이 끌려온다 */
      const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
      lastFrame = now;
      const k = 1 - Math.exp(-dt / 0.3);

      if (pointer.has) {
        lightAim.az = -0.5 + pointer.x * 1.5;
        lightAim.el = 0.28 + pointer.y * 0.78;
      } else if (!reduced) {
        lightAim.az = -0.5 + Math.sin(t * 0.000085) * 0.62;
        lightAim.el = 0.36 + Math.cos(t * 0.00006) * 0.2;
      }
      lightNow.az += (lightAim.az - lightNow.az) * k;
      lightNow.el += (lightAim.el - lightNow.el) * k;

      key.position.set(
        Math.sin(lightNow.az) * 9,
        Math.sin(lightNow.el) * 8 + 1.2,
        Math.cos(lightNow.az) * 7.2 + 1.5
      );
      key.intensity = (2.45 - Math.abs(lightNow.az) * 0.52) * entrance * (1 - exit * 0.7);
      fill.intensity = 0.42 * entrance;

      /* 균열 내부 빛 — 승화가 진행되면서 조금씩 강해진다 */
      const heat = clamp01(elapsed / 150);
      const pulse = reduced ? 1 : 1 + Math.sin(t * 0.0006) * 0.08;
      glowA.intensity = (5.0 + heat * 3.4) * pulse * entrance;
      glowB.intensity = (3.4 + heat * 2.2) * pulse * entrance;
      coreMaterial.opacity = entrance * (0.5 + heat * 0.26) * pulse * (1 - exit * 0.3);
      haloMaterial.opacity = entrance * (0.13 + heat * 0.1) * pulse * (1 - exit * 0.3);

      /* 카메라 — 회전하지 않고 표면을 아주 느리게 횡단한다 */
      if (!reduced) {
        const baseZ = mobile ? 11.2 : 9;
        camera.position.x = Math.sin(t * 0.000055) * 0.62;
        camera.position.y = Math.sin(t * 0.00004 + 1.1) * 0.24 + exit * 0.5;
        camera.position.z = baseZ - exit * 0.9;
        camera.lookAt(camTarget);
      }

      material.opacity = entrance * (1 - exit * 0.55);
      material.roughness = 0.7 + heat * 0.08;

      /* 가루 — 천천히 흘러내리며 좌우로 흔들린다 */
      if (!reduced) {
        const attr = moteGeometry.attributes.position;
        const origin = moteGeometry.userData.origin;
        const seed = moteGeometry.userData.seed;
        moteMaterial.opacity = entrance * (0.30 + heat * 0.34) * (1 - exit * 0.4);
        for (let i = 0; i < attr.count; i += 1) {
          const s = seed[i];
          const fall = ((t * 0.00013 * (0.5 + (s % 7) / 7) + s * 0.037) % 1);
          attr.setXYZ(
            i,
            origin[i * 3] + Math.sin(t * 0.00035 + s) * 0.34,
            origin[i * 3 + 1] + 3.6 - fall * 7.2,
            origin[i * 3 + 2] + Math.cos(t * 0.00028 + s) * 0.18
          );
        }
        attr.needsUpdate = true;
      }

      /* ── 계기값 — 시간 기반. 마우스가 없어도 화면은 살아 있다. ── */
      if (onReadout && now - lastReadout > 220) {
        const az = Math.round((-lightNow.az * 180) / Math.PI);
        onReadout({
          mass: 100 - Math.min(21.4, elapsed * 0.21),
          heat,
          temp: heat > 0.62 ? 'HIGH' : heat > 0.24 ? 'MID' : 'LOW',
          azimuth: az,
          lit: pointer.has,
        });
        lastReadout = now;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      material.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      frostMap.dispose();
      moteGeometry.dispose();
      moteMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [introEntrance, onReadout]);

  return <div ref={hostRef} className="chamber" aria-hidden="true" />;
}
