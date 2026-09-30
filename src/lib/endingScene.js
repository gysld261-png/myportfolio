import * as THREE from 'three';

/* 엔딩 장면 — 드라이아이스 결정 하나가 선(SOLID) → 면(SUBLIMATION) → 점(GAS)으로 승화한다.
   레퍼런스(seunghyuk.com/contact)의 LINE → PLANE → DOT 흐름을 우리 소재로 옮겼다.
   진행도 p(0~1)는 스크롤이 정하고, 드래그로 돌려 볼 수 있다.

     0.00–0.06  가운데 작은 표식만
     0.06–0.38  선 — 결정이 자라며 안을 가로지르는 선이 빽빽해진다
     0.38–0.62  면 — 면이 차오르고, 한가운데서 결정이 판처럼 눌렸다 다시 펴진다
     0.62–1.00  점 — 선과 면이 흩어지고 점만 남아 위로 천천히 떠오른다 */

const LINE_COUNT = 420;
const DOT_COUNT = 2600;
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* 결정 — 위아래가 뾰족한 불규칙한 쌍뿔. 적도 꼭짓점 아홉 개를 조금씩 흔들어 얼음 조각처럼 */
function crystal(rand) {
  const top = new THREE.Vector3(0.05, 1.3, 0.02);
  const bottom = new THREE.Vector3(-0.04, -1.35, 0);
  const ring = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + (rand() - 0.5) * 0.3;
    const r = 0.82 + rand() * 0.2;
    return new THREE.Vector3(Math.cos(a) * r, (rand() - 0.5) * 0.16, Math.sin(a) * r);
  });
  const faces = [];
  ring.forEach((v, i) => {
    const n = ring[(i + 1) % ring.length];
    faces.push([top, v, n], [bottom, n, v]);
  });
  return { top, bottom, ring, faces };
}

const onFace = (rand, [a, b, c]) => {
  let u = rand(); let v = rand();
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  return a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
};

export function createEndingScene(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7.4);

  const rand = seeded(20260930);
  const shape = crystal(rand);
  const group = new THREE.Group();
  scene.add(group);
  const white = new THREE.Color(0xe6f1ef);

  // 선 — 겉면의 점들을 잇는 긴 선. 가운데를 가로지르는 선이 많아야 레퍼런스처럼 빽빽한 거미줄이 된다
  const linePos = new Float32Array(LINE_COUNT * 6);
  for (let i = 0; i < LINE_COUNT; i++) {
    const f1 = shape.faces[Math.floor(rand() * shape.faces.length)];
    const f2 = shape.faces[Math.floor(rand() * shape.faces.length)];
    const a = i < 60 ? (rand() < 0.5 ? shape.top : shape.bottom) : onFace(rand, f1);   // 꼭짓점에서 뻗는 선을 조금 섞는다
    const b = onFace(rand, f2);
    linePos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: white, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  group.add(lines);

  // 윤곽 — 결정의 모서리
  const edgePos = [];
  shape.ring.forEach((v, i) => {
    const n = shape.ring[(i + 1) % shape.ring.length];
    edgePos.push(v.x, v.y, v.z, n.x, n.y, n.z, shape.top.x, shape.top.y, shape.top.z, v.x, v.y, v.z, shape.bottom.x, shape.bottom.y, shape.bottom.z, v.x, v.y, v.z);
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: white, transparent: true, opacity: 0, depthWrite: false });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // 면 — 반투명하게 겹쳐 쌓인다
  const facePos = [];
  shape.faces.forEach(([a, b, c]) => facePos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z));
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(facePos, 3));
  const faceMat = new THREE.MeshBasicMaterial({ color: white, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  group.add(new THREE.Mesh(faceGeo, faceMat));

  // 적도의 판 — 결정이 눌릴 때 한 장의 빛나는 판으로 모인다(레퍼런스의 가로 한 줄)
  const discPos = [];
  for (let i = 0; i < 90; i++) {
    const a1 = rand() * Math.PI * 2; const a2 = a1 + Math.PI * (0.4 + rand() * 1.2);
    const r1 = 0.3 + rand() * 0.75; const r2 = 0.3 + rand() * 0.75;
    discPos.push(Math.cos(a1) * r1, 0, Math.sin(a1) * r1, Math.cos(a2) * r2, 0, Math.sin(a2) * r2);
  }
  const discGeo = new THREE.BufferGeometry();
  discGeo.setAttribute('position', new THREE.Float32BufferAttribute(discPos, 3));
  const discMat = new THREE.LineBasicMaterial({ color: white, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  group.add(new THREE.LineSegments(discGeo, discMat));

  // 점 — 겉면과 속에 흩어진 알갱이. 승화하며 위로, 바깥으로 풀려난다
  const dotBase = new Float32Array(DOT_COUNT * 3);
  const dotDrift = new Float32Array(DOT_COUNT * 3);
  for (let i = 0; i < DOT_COUNT; i++) {
    const p = onFace(rand, shape.faces[Math.floor(rand() * shape.faces.length)]).multiplyScalar(i % 3 === 0 ? 0.35 + rand() * 0.6 : 1);
    dotBase.set([p.x, p.y, p.z], i * 3);
    dotDrift.set([(rand() - 0.5) * 0.9, 0.4 + rand() * 1.4, (rand() - 0.5) * 0.9], i * 3);
  }
  const dotPos = new Float32Array(dotBase);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  const dotMat = new THREE.PointsMaterial({ color: white, size: 0.018, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  group.add(new THREE.Points(dotGeo, dotMat));

  // 떠다니는 글자가 붙을 점들
  const labelPoints = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(...dotBase.slice(((i * 331) % DOT_COUNT) * 3, ((i * 331) % DOT_COUNT) * 3 + 3)));

  let width = 1; let height = 1;
  const resize = () => {
    width = host.clientWidth || window.innerWidth; height = host.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let progress = 0;
  let spin = 0; let dragX = 0; let dragY = 0; let dragVX = 0;
  const projected = new THREE.Vector3();

  return {
    setProgress(p) { progress = p; },
    drag(dx, dy) { dragVX += dx * 0.004; dragY = Math.max(-0.6, Math.min(0.6, dragY + dy * 0.003)); },
    /** 떠다니는 글자 자리(화면 px)와 보일 정도 */
    labels() {
      return labelPoints.map((pt, i) => {
        const drift = smooth(0.62, 1, progress) * (0.3 + (i % 3) * 0.2);
        projected.set(pt.x * 1.1, pt.y + drift, pt.z * 1.1).applyMatrix4(group.matrixWorld).project(camera);
        return { x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height, z: projected.z };
      });
    },
    render(dt) {
      const p = progress;
      spin += dt * 0.18 + dragVX; dragVX *= Math.exp(-dt * 3); dragX += dragVX;
      // 자라기 — 처음엔 한 점에서 커진다
      const grow = 0.05 + 0.95 * smooth(0.04, 0.3, p);
      // 눌리기 — 면 단계 한가운데서 판처럼 납작해졌다 다시 선다
      const flat = 1 - 0.94 * Math.exp(-(((p - 0.5) / 0.045) ** 2));
      group.scale.set(grow, grow * flat, grow);
      group.rotation.set(0.28 + dragY, spin, 0);

      // 선: 늘어나다가(0.06~0.4) 점 단계에서 흩어진다
      const lineIn = smooth(0.06, 0.4, p); const lineOut = 1 - smooth(0.62, 0.8, p);
      lineGeo.setDrawRange(0, Math.floor(LINE_COUNT * (0.15 + 0.85 * lineIn)) * 2);
      lineMat.opacity = 0.34 * lineIn * lineOut;
      edgeMat.opacity = 0.55 * smooth(0.05, 0.2, p) * lineOut;
      faceMat.opacity = 0.09 * smooth(0.38, 0.52, p) * (1 - smooth(0.58, 0.7, p));
      discMat.opacity = 0.9 * Math.exp(-(((p - 0.5) / 0.05) ** 2));

      // 점: 선이 흩어지는 자리에서 나타나 위로 풀려난다
      const dotIn = smooth(0.58, 0.72, p);
      const gas = smooth(0.66, 1, p);
      dotMat.opacity = 0.85 * dotIn;
      const t = performance.now() / 1000;
      for (let i = 0; i < DOT_COUNT; i++) {
        const k = i * 3;
        const wob = Math.sin(t * 0.6 + i) * 0.015 * gas;
        dotPos[k] = dotBase[k] + dotDrift[k] * gas * 0.6 + wob;
        dotPos[k + 1] = dotBase[k + 1] + dotDrift[k + 1] * gas * 0.35;
        dotPos[k + 2] = dotBase[k + 2] + dotDrift[k + 2] * gas * 0.6;
      }
      dotGeo.attributes.position.needsUpdate = dotIn > 0.001;
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      [lineGeo, edgeGeo, faceGeo, discGeo, dotGeo].forEach((g) => g.dispose());
      [lineMat, edgeMat, faceMat, discMat, dotMat].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
