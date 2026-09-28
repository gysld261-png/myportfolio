import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

/**
 * WORK 스크롤 뒤를 떠다니는 드라이아이스 파편.
 *
 * 면을 칠하지 않고 모서리만 그린다. 실선과 점선을 섞어 결정의 윤곽처럼 읽히게 하고,
 * 안쪽은 아주 옅게만 채워 겹칠 때 두께가 느껴지게 한다.
 * 깊이마다 스크롤을 따라가는 속도가 달라서, 글자가 지나가는 동안 공간이 생긴다.
 * 파편은 위아래로 이어 붙인 띠 안에서 돌기 때문에 스크롤이 끝없이 이어져도 비지 않는다.
 */

const FROST = 0xcfdfe4;
const BAND = 26; // 파편이 되풀이되는 세로 길이(월드 단위)

function shardGeometry(rand, stretch) {
  const points = [];
  const count = 9 + Math.floor(rand() * 7);
  for (let i = 0; i < count; i += 1) {
    const u = rand() * Math.PI * 2;
    const v = Math.acos(2 * rand() - 1);
    const r = 0.72 + rand() * 0.38;
    points.push(new THREE.Vector3(
      Math.sin(v) * Math.cos(u) * r,
      Math.cos(v) * r * stretch,
      Math.sin(v) * Math.sin(u) * r * 0.78,
    ));
  }
  return new ConvexGeometry(points);
}

// 결정적 난수 — 새로고침해도 같은 배치
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function vaporTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createWorkDrift(host) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0d0e, 8, 26);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  const rand = seeded(20260928);
  const shards = [];
  const disposables = [];

  const LAYOUT = [
    // x, y(띠 안), z, 크기, 늘임, 점선
    [-6.2, 2.4, -1.5, 1.35, 1.1, false],
    [5.8, -3.1, -0.5, 1.05, 1, true],
    [-2.4, -7.8, -4, 0.7, 1.3, true],
    [3.2, 7.4, -6, 1.6, 0.9, false],
    [7.4, 11.2, -3, 0.55, 2.8, false],   // 막대처럼 길쭉한 조각
    [-7.6, -12.4, -2, 0.5, 3.2, true],
    [0.8, -1.2, -9, 2.2, 1, true],
    [-4.8, 9.6, -7.5, 1.1, 1.2, false],
    [4.6, -10.8, -8, 1.3, 1, false],
    [-1.2, 12.2, -2.5, 0.42, 1, true],
    [2.1, 4.1, -1, 0.3, 1, false],
    [-5.4, -4.6, -10, 1.8, 1.1, false],
    [6.6, 3.8, -11, 1.4, 1.4, true],
    [-3.6, 5.2, 0.5, 0.26, 1, true],
  ];

  const fillMaterial = new THREE.MeshBasicMaterial({ color: FROST, transparent: true, opacity: 0.025, depthWrite: false });
  disposables.push(fillMaterial);

  LAYOUT.forEach(([x, y, z, size, stretch, dashed], i) => {
    const geometry = shardGeometry(rand, stretch);
    const edgesGeometry = new THREE.EdgesGeometry(geometry, 1);
    const material = dashed
      ? new THREE.LineDashedMaterial({ color: FROST, dashSize: 0.07, gapSize: 0.06, transparent: true, opacity: 0.62 })
      : new THREE.LineBasicMaterial({ color: FROST, transparent: true, opacity: 0.7 });
    const lines = new THREE.LineSegments(edgesGeometry, material);
    if (dashed) lines.computeLineDistances();
    const group = new THREE.Group();
    group.add(lines, new THREE.Mesh(geometry, fillMaterial));
    group.scale.setScalar(size);
    group.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    scene.add(group);
    disposables.push(geometry, edgesGeometry, material);
    shards.push({
      group,
      x,
      y,
      z,
      depth: 0.55 + (z + 11) / 12 * 0.75, // 가까울수록 스크롤을 빨리 따라간다
      spin: new THREE.Vector3((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.2),
      phase: i * 1.7,
    });
  });

  // 파편 사이를 흐르는 냉기 — 아주 옅게
  const vaporCount = 70;
  const vaporGeometry = new THREE.BufferGeometry();
  const vaporBase = new Float32Array(vaporCount * 3);
  for (let i = 0; i < vaporCount; i += 1) {
    vaporBase[i * 3] = (rand() - 0.5) * 18;
    vaporBase[i * 3 + 1] = (rand() - 0.5) * BAND;
    vaporBase[i * 3 + 2] = -2 - rand() * 9;
  }
  vaporGeometry.setAttribute('position', new THREE.BufferAttribute(vaporBase.slice(), 3));
  const vaporMap = vaporTexture();
  const vaporMaterial = new THREE.PointsMaterial({
    map: vaporMap, size: 2.6, color: 0xafc2c8, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const vapor = new THREE.Points(vaporGeometry, vaporMaterial);
  scene.add(vapor);
  disposables.push(vaporGeometry, vaporMaterial, vaporMap);

  const state = { scroll: 0, velocity: 0, pointer: new THREE.Vector2(), pointerTarget: new THREE.Vector2(), paused: false, unitsPerPx: 0.01 };

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.updateProjectionMatrix();
    // z=0 평면에서 1px 이 몇 월드 단위인지 — 글자와 파편이 같은 속도감으로 움직이게
    state.unitsPerPx = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z) / Math.max(1, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const wrap = (value) => ((((value + BAND / 2) % BAND) + BAND) % BAND) - BAND / 2;

  let frame = 0;
  let last = performance.now();
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.paused || document.hidden) return;
    const t = now / 1000;
    state.pointer.lerp(state.pointerTarget, 1 - Math.exp(-dt * 3));
    const scrollUnits = state.scroll * state.unitsPerPx;
    const kick = reduced ? 0 : state.velocity;

    shards.forEach((s) => {
      s.group.position.set(
        s.x + state.pointer.x * s.depth * 0.5,
        wrap(s.y + scrollUnits * s.depth) + Math.sin(t * 0.4 + s.phase) * 0.12,
        s.z,
      );
      if (!reduced) {
        s.group.rotation.x += (s.spin.x + kick * 0.9) * dt;
        s.group.rotation.y += (s.spin.y + kick * 1.4) * dt;
        s.group.rotation.z += s.spin.z * dt;
      }
    });

    const positions = vaporGeometry.attributes.position.array;
    for (let i = 0; i < vaporCount; i += 1) {
      positions[i * 3] = vaporBase[i * 3] + Math.sin(t * 0.15 + i) * 0.6;
      positions[i * 3 + 1] = wrap(vaporBase[i * 3 + 1] + scrollUnits * 0.7 + t * 0.12);
    }
    vaporGeometry.attributes.position.needsUpdate = true;

    camera.position.x = state.pointer.x * 0.35;
    camera.position.y = -state.pointer.y * 0.25;
    camera.lookAt(0, 0, -4);
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);

  return {
    /** scroll: 누적 스크롤(px), velocity: -1~1 */
    setScroll(scroll, velocity) {
      state.scroll = scroll;
      state.velocity = velocity;
    },
    setPointer(x, y) { state.pointerTarget.set(x, y); },
    setPaused(value) { state.paused = value; },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
