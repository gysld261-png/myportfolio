import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ABOUT 키워드마다 다른 드라이아이스 형태. 드라이아이스가 실제로 쓰이는 모양에서 골랐다.

   brick    모서리가 둥근 벽돌 — 가장 흔한 드라이아이스 덩어리(ABOUT)
   plates   비껴 쌓인 얇은 판 세 장 — 쌓여 온 층(BACKGROUND)
   crystals 여러 방향으로 솟은 육각 결정 기둥 묶음(SKILLS)
   pellets  원기둥 알갱이(펠릿) 더미 — 실제로 흔한 드라이아이스 형태(APPROACH)
   spires   길고 뾰족한 결정 첨탑 두 개(WORK)

   모두 가운데로 옮기고 높이 1 로 맞춘다 — 크기는 장면에서 정한다. 얼음 재질의 서리·승화 셰이더는
   물체 좌표(vIcePos)를 쓰므로 어떤 모양이든 그대로 먹는다. */

const put = (geometry, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) => {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s),
  );
  const g = (geometry.index ? geometry.toNonIndexed() : geometry).applyMatrix4(m);
  // 합칠 때 속성이 같아야 한다 — 위치·법선·UV 만 남긴다
  Object.keys(g.attributes).forEach((name) => { if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name); });
  return g;
};

// 모서리를 둥글린 상자 — 사각형을 둥근 모서리로 뽑아낸다
const roundedBox = (w, h, d, bevel) => {
  const shape = new THREE.Shape();
  const x = -w / 2 + bevel; const y = -h / 2 + bevel;
  shape.moveTo(x, y);
  shape.lineTo(x + w - bevel * 2, y);
  shape.lineTo(x + w - bevel * 2, y + h - bevel * 2);
  shape.lineTo(x, y + h - bevel * 2);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1,
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return g;
};

// 끝이 뾰족한 육각 기둥 — 기둥과 꼭지를 한 몸으로
const hexPrism = (radius, height, tip) => {
  const body = new THREE.CylinderGeometry(radius, radius * 1.05, height, 6, 1);
  const cap = new THREE.ConeGeometry(radius, tip, 6, 1);
  return mergeGeometries([put(body), put(cap, { p: [0, height / 2 + tip / 2, 0] })]);
};

const BUILDERS = {
  brick(rand) {
    return [put(roundedBox(1.55, 1.05, 1.1, 0.12), { r: [0.04, 0.2 + rand() * 0.1, 0.03] })];
  },
  plates(rand) {
    return [0, 1, 2].map((n) => put(roundedBox(1.7 - n * 0.22, 0.26, 1.15 - n * 0.12, 0.05), {
      p: [(rand() - 0.5) * 0.22, n * 0.3, (rand() - 0.5) * 0.18],
      r: [(rand() - 0.5) * 0.06, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.08],
    }));
  },
  crystals(rand) {
    const tilts = [[0, 0], [0.42, 0.3], [-0.38, -0.5], [0.25, 2.2], [-0.3, 3.4]];
    return tilts.map(([tilt, turn], n) => {
      const h = n === 0 ? 1.35 : 0.7 + rand() * 0.45;
      const r = n === 0 ? 0.2 : 0.11 + rand() * 0.07;
      const g = hexPrism(r, h, r * 1.6);
      g.translate(0, h / 2, 0); // 밑동을 원점에 — 기울여도 한 점에서 솟는다
      return put(g, { r: [tilt * Math.cos(turn), rand() * Math.PI, tilt * Math.sin(turn)] });
    });
  },
  pellets(rand) {
    const parts = [];
    for (let n = 0; n < 11; n += 1) {
      const layer = n < 6 ? 0 : n < 10 ? 1 : 2;
      const spread = [0.55, 0.36, 0.1][layer];
      const angle = rand() * Math.PI * 2;
      parts.push(put(new THREE.CylinderGeometry(0.13, 0.13, 0.46 + rand() * 0.14, 14, 1), {
        p: [Math.cos(angle) * spread * rand(), layer * 0.22, Math.sin(angle) * spread * rand()],
        r: [Math.PI / 2 + (rand() - 0.5) * 0.9, rand() * Math.PI, (rand() - 0.5) * 0.9],
      }));
    }
    return parts;
  },
  spires(rand) {
    const tall = new THREE.CylinderGeometry(0.02, 0.28, 1.9, 5, 1);
    const short = new THREE.CylinderGeometry(0.015, 0.2, 1.15, 5, 1);
    return [
      put(tall, { p: [0, 0.95, 0], r: [0.04, rand(), -0.08] }),
      put(short, { p: [0.3, 0.55, 0.08], r: [0.1, rand() * 2, -0.42] }),
    ];
  },
};

/** 형태 이름 → 가운데 정렬·높이 1 의 도형. 가로·깊이 비율(aspect)도 함께 돌려준다 */
export function createDryIceForm(kind, rand) {
  const geometry = mergeGeometries(BUILDERS[kind](rand));
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const h = box.max.y - box.min.y || 1;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
  geometry.scale(1 / h, 1 / h, 1 / h);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  return { geometry, size: [b.max.x - b.min.x, 1, b.max.z - b.min.z] };
}

/** 깨질 때 튀는 조각 — 얇고 날카로운 판. 돌멩이처럼 뭉툭하지 않게 길쭉한 삼각·사각으로 만든다 */
export function createIceSliver(rand) {
  const corners = 3 + Math.floor(rand() * 2);
  const stretch = 1.4 + rand() * 1.4;                   // 한쪽으로 길쭉하게
  const shape = new THREE.Shape();
  for (let c = 0; c < corners; c += 1) {
    const a = (c / corners) * Math.PI * 2 + (rand() - 0.5) * 0.9;
    const r = 0.55 + rand() * 0.45;
    const x = Math.cos(a) * r * stretch;
    const y = Math.sin(a) * r;
    if (c === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const thickness = 0.1 + rand() * 0.12;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 1,
  });
  g.center();
  g.computeVertexNormals();
  return g;
}
