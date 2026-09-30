import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ABOUT 키워드마다 다른 드라이아이스 형태. 드라이아이스가 실제로 쓰이는 모양에서 골랐다.

   brick    승화하며 모서리가 무너진 덩어리 — 가장 흔한 드라이아이스 블록(ABOUT)
   plates   가장자리가 들쭉날쭉 깨진 판 세 장이 비껴 쌓인 것 — 쌓여 온 층(BACKGROUND)
   crystals 여러 방향으로 솟은 육각 기둥 묶음(SKILLS) — 윤곽은 결정, 겉은 거칠고 끝 몇 개는 부러졌다
   pellets  끝이 녹아 둥글어진 원기둥 알갱이(펠릿) 더미(APPROACH)
   spires   세로로 쪼개진 길쭉한 조각 두 개가 기대 선 것(WORK)

   반듯한 기본 도형(상자·원기둥)을 그대로 쓰면 스티로폼을 깎아 놓은 것처럼 보였다.
   그래서 결정 외의 형태는 면을 촘촘하게 나눈 뒤 erode 로 다듬는다:
     1. 큰 굴곡 — 눌러 뭉친 덩어리의 울퉁불퉁한 몸
     2. 잔 굴곡 — 승화하며 거칠어진 겉
     3. 쪼개진 면 — 한두 군데를 평평하게 잘라, 부서져 나간 단면을 남긴다
   법선은 부드럽게 둬 녹아 둥글어진 느낌을 낸다.

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
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
};

/* ── 3D 값 노이즈 — 형태를 다듬는 데만 쓴다 ── */
const createNoise3 = (rand) => {
  const size = 256;
  const perm = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const values = Float32Array.from({ length: size }, () => rand() * 2 - 1);
  const at = (x, y, z) => values[perm[(perm[(perm[x & 255] + y) & 255] + z) & 255]];
  const s = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const noise = (x, y, z) => {
    const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
    const u = s(x - xi); const v = s(y - yi); const w = s(z - zi);
    return lerp(
      lerp(lerp(at(xi, yi, zi), at(xi + 1, yi, zi), u), lerp(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), u), lerp(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), u), v),
      w,
    );
  };
  // 여러 겹 — 낮은 주파수가 몸, 높은 주파수가 겉
  return (x, y, z, octaves = 3) => {
    let sum = 0; let amp = 1; let freq = 1; let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      sum += noise(x * freq, y * freq, z * freq) * amp;
      norm += amp; amp *= 0.5; freq *= 2.1;
    }
    return sum / norm;
  };
};

/** 면을 촘촘하게 나눈 둥근 상자 — 상자를 안쪽 상자 + 반지름으로 부풀려 모서리를 굴린다 */
const softBox = (w, h, d, radius, seg = 14) => {
  const g = new THREE.BoxGeometry(w, h, d, seg, Math.max(4, Math.round(seg * h / w)), Math.max(4, Math.round(seg * d / w)));
  const pos = g.attributes.position;
  const hx = w / 2 - radius; const hy = h / 2 - radius; const hz = d / 2 - radius;
  const p = new THREE.Vector3(); const inner = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i);
    inner.set(THREE.MathUtils.clamp(p.x, -hx, hx), THREE.MathUtils.clamp(p.y, -hy, hy), THREE.MathUtils.clamp(p.z, -hz, hz));
    p.sub(inner);
    if (p.lengthSq() > 1e-9) p.setLength(radius);
    p.add(inner);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  return g;
};

/** 면을 촘촘하게 나눈 캡슐형 원기둥(펠릿) */
const softPellet = (radius, length) => {
  // 끝이 평평한 원기둥 — 캡슐처럼 둥글면 마시멜로로 읽혔다. 모서리만 살짝 굴린다
  const g = new THREE.CylinderGeometry(radius, radius, length, 16, 6, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const edge = Math.max(0, Math.abs(y) - (length / 2 - radius * 0.35)) / (radius * 0.35);
    const k = 1 - Math.min(1, edge) ** 2 * 0.12;
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  return g;
};

/**
 * 자연스럽게 다듬기 — 큰 굴곡, 잔 굴곡, 쪼개진 면.
 * lump: 큰 굴곡 세기, grain: 잔 굴곡 세기, cuts: 쪼개진 면 수
 */
const erode = (geometry, rand, { lump = 0.07, grain = 0.018, cuts = 1, scale = 1.6 } = {}) => {
  let g = geometry;
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);                  // 이음매가 벌어지지 않게 꼭짓점을 공유시킨다
  g.computeVertexNormals();
  const noise = createNoise3(rand);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const p = new THREE.Vector3(); const n = new THREE.Vector3();
  const off = [rand() * 50, rand() * 50, rand() * 50];

  // 쪼개진 면 — 몸 가장자리 쪽을 지나는 평면. 평면 밖의 꼭짓점을 평면 위로 눌러 납작한 단면을 만든다
  g.computeBoundingBox();
  const size = new THREE.Vector3(); g.boundingBox.getSize(size);
  const planes = Array.from({ length: cuts }, () => {
    const dir = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.8, rand() - 0.5).normalize();
    const reach = Math.abs(dir.x) * size.x + Math.abs(dir.y) * size.y + Math.abs(dir.z) * size.z;
    return { dir, dist: reach * (0.3 + rand() * 0.12) };
  });

  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const x = p.x * scale + off[0]; const y = p.y * scale + off[1]; const z = p.z * scale + off[2];
    const body = noise(x, y, z, 2) * lump;               // 울퉁불퉁한 몸
    const skin = noise(x * 5.5, y * 5.5, z * 5.5, 2) * grain; // 거친 겉
    p.addScaledVector(n, body + skin);
    planes.forEach(({ dir, dist }) => {
      const over = p.dot(dir) - dist;
      if (over > 0) p.addScaledVector(dir, -over * 0.92);     // 완전히 평평하진 않게 — 깨진 면에도 결이 남는다
    });
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
};

// 끝이 뾰족한 육각 기둥 — 기둥과 꼭지를 한 몸으로 (결정 전용, 각진 면 그대로)
const hexPrism = (radius, height, tip, seg = 1) => {
  const body = new THREE.CylinderGeometry(radius, radius * 1.05, height, 6, seg);
  const cap = new THREE.ConeGeometry(radius, tip, 6, Math.max(1, Math.round(seg / 2)));
  return mergeGeometries([put(body), put(cap, { p: [0, height / 2 + tip / 2, 0] })]);
};

const BUILDERS = {
  brick(rand) {
    const g = erode(softBox(1.55, 1.05, 1.1, 0.07, 18), rand, { lump: 0.045, grain: 0.016, cuts: 3, scale: 1.3 });
    return [put(g, { r: [0.04, 0.2 + rand() * 0.1, 0.03] })];
  },
  plates(rand) {
    return [0, 1, 2].map((n) => {
      // 판은 얇아서 두께 방향으로는 덜 흔들고, 가장자리를 크게 뜯어 깨진 판으로
      const g = erode(softBox(1.7 - n * 0.22, 0.26, 1.15 - n * 0.12, 0.035, 16), rand, { lump: 0.04, grain: 0.012, cuts: 2, scale: 2.2 });
      return put(g, {
        p: [(rand() - 0.5) * 0.22, n * 0.29, (rand() - 0.5) * 0.18],
        r: [(rand() - 0.5) * 0.08, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.1],
      });
    });
  },
  crystals(rand) {
    const tilts = [[0, 0], [0.42, 0.3], [-0.38, -0.5], [0.25, 2.2], [-0.3, 3.4]];
    return tilts.map(([tilt, turn], n) => {
      const h = n === 0 ? 1.35 : 0.7 + rand() * 0.45;
      const r = n === 0 ? 0.2 : 0.11 + rand() * 0.07;
      // 육각 기둥의 윤곽은 살리되, 드라이아이스라 겉은 거칠고 끝 몇 개는 부러져 있다
      const g = erode(hexPrism(r, h, r * 1.6, 8), rand, { lump: 0.014, grain: 0.007, cuts: rand() < 0.5 ? 1 : 0, scale: 4 });
      g.translate(0, h / 2, 0); // 밑동을 원점에 — 기울여도 한 점에서 솟는다
      return put(g, { r: [tilt * Math.cos(turn), rand() * Math.PI, tilt * Math.sin(turn)] });
    });
  },
  pellets(rand) {
    const parts = [];
    for (let n = 0; n < 26; n += 1) {
      const layer = n < 12 ? 0 : n < 20 ? 1 : n < 24 ? 2 : 3;
      const spread = [0.62, 0.44, 0.26, 0.08][layer];
      const angle = rand() * Math.PI * 2;
      const len = 0.26 + rand() * 0.16;
      // 잘게 녹아 끝이 뭉개지고 몸이 살짝 휘었다
      const g = erode(softPellet(0.07 + rand() * 0.015, len), rand, { lump: 0.012, grain: 0.006, cuts: rand() < 0.4 ? 1 : 0, scale: 3 });
      parts.push(put(g, {
        p: [Math.cos(angle) * spread * (0.4 + rand() * 0.6), layer * 0.12, Math.sin(angle) * spread * 0.45 * (0.4 + rand() * 0.6)],   // 앞뒤로는 좁게 — 단면 밖으로 삐져나오지 않게
        r: [Math.PI / 2 + (rand() - 0.5) * 0.9, rand() * Math.PI, (rand() - 0.5) * 0.9],
      }));
    }
    return parts;
  },
  spires(rand) {
    // 세로로 쪼개진 길쭉한 조각 — 위로 갈수록 가늘어지고, 쪼개진 면이 여러 개
    const slab = (w, h, d) => {
      const g = softBox(w, h, d, Math.min(w, d) * 0.1, 12);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const t = THREE.MathUtils.clamp(pos.getY(i) / h + 0.5, 0, 1);   // 0 밑동 → 1 꼭대기 (음수면 거듭제곱이 NaN)
        const taper = 1 - t ** 1.3 * 0.94;
        pos.setX(i, pos.getX(i) * taper);
        pos.setZ(i, pos.getZ(i) * taper);
      }
      const e = erode(g, rand, { lump: 0.03, grain: 0.014, cuts: 3, scale: 1.4 });
      // 꼭대기를 비스듬히 쪼갠다 — 둥근 기둥 머리가 아니라 부러진 끝
      const pos2 = e.attributes.position;
      const cut = new THREE.Vector3(rand() < 0.5 ? 0.8 : -0.8, 1, (rand() - 0.5) * 0.6).normalize();
      const top = h * (0.28 + rand() * 0.08);
      for (let i = 0; i < pos2.count; i += 1) {
        const q = new THREE.Vector3().fromBufferAttribute(pos2, i);
        const over = q.dot(cut) - top;
        if (over > 0) { q.addScaledVector(cut, -over); pos2.setXYZ(i, q.x, q.y, q.z); }
      }
      e.computeVertexNormals();
      return e;
    };
    return [
      put(slab(0.5, 1.8, 0.36), { p: [0, 0.9, 0], r: [0.04, rand(), -0.07] }),
      put(slab(0.38, 1.1, 0.28), { p: [0.34, 0.55, 0.1], r: [0.1, rand() * 2, -0.38] }),
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
  // 결정은 각진 면 그대로(면마다 법선을 새로), 나머지는 erode 가 만든 부드러운 법선을 지킨다
  geometry.computeBoundingBox();
  const b = geometry.boundingBox;
  return { geometry, size: [b.max.x - b.min.x, 1, b.max.z - b.min.z] };
}

/* 깨질 때 떨어지는 덩이 — 형태마다 부서지는 모양이 다르다. 모두 크기 약 1 로 만들고 장면에서 줄인다.
   brick    쪼개진 면이 여럿인 두툼한 각덩이
   plates   얇게 벗겨진 판 조각 — 층이 한 장씩 떨어져 나간다
   crystals 부러진 육각 기둥 토막
   pellets  펠릿 알갱이 그대로 — 더미가 무너지며 굴러 흩어진다
   spires   길고 가는 쪼가리 — 세로 결을 따라 쪼개진다 */
const FRAGMENTS = {
  brick(rand) {
    const g = softBox(1, 0.62 + rand() * 0.3, 0.75 + rand() * 0.25, 0.05, 6);
    return erode(g, rand, { lump: 0.06, grain: 0.022, cuts: 2 + Math.floor(rand() * 2), scale: 2 });
  },
  plates(rand) {
    const g = softBox(1, 0.13 + rand() * 0.06, 0.6 + rand() * 0.4, 0.03, 8);
    return erode(g, rand, { lump: 0.07, grain: 0.012, cuts: 2, scale: 2.4 });
  },
  crystals(rand) {
    const h = 0.7 + rand() * 0.6;
    const g = new THREE.CylinderGeometry(0.28, 0.28, h, 6, 4);
    return erode(g, rand, { lump: 0.02, grain: 0.012, cuts: 2, scale: 3 });   // 양 끝이 비스듬히 부러진 토막
  },
  pellets(rand) {
    return erode(softPellet(0.26, 0.9 + rand() * 0.4), rand, { lump: 0.02, grain: 0.012, cuts: rand() < 0.4 ? 1 : 0, scale: 3 });
  },
  spires(rand) {
    const g = softBox(0.22, 1.4 + rand() * 0.5, 0.16, 0.03, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const t = THREE.MathUtils.clamp(pos.getY(i) / 1.6 + 0.5, 0, 1);
      const taper = 1 - Math.abs(t - 0.45) * 1.2;   // 가운데가 두껍고 양 끝이 가늘다
      pos.setX(i, pos.getX(i) * taper);
      pos.setZ(i, pos.getZ(i) * taper);
    }
    return erode(g, rand, { lump: 0.03, grain: 0.01, cuts: 2, scale: 2.5 });
  },
};

/** 형태에 맞는 부서진 덩이 하나 */
export function createDryIceChunk(rand, kind = 'brick') {
  const g = (FRAGMENTS[kind] || FRAGMENTS.brick)(rand);
  g.center();
  return g;
}

/* '펑' 할 때 터지는 가루 — 둥근 점이 아니라 제각각의 모양. 크기 약 1.
   flake    얇고 들쭉날쭉한 눈 조각
   grain    각진 알갱이
   splinter 가늘고 긴 가시 */
export function createPowderGeometries() {
  const rand = (() => { let s = 97; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const flakeShape = new THREE.Shape();
  const corners = 7;
  for (let c = 0; c < corners; c += 1) {
    const a = (c / corners) * Math.PI * 2;
    const r = 0.3 + rand() * 0.25;
    if (c === 0) flakeShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else flakeShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  flakeShape.closePath();
  const flake = new THREE.ExtrudeGeometry(flakeShape, { depth: 0.06, bevelEnabled: false });
  flake.center();
  const grain = new THREE.IcosahedronGeometry(0.4, 0);
  const splinter = new THREE.ConeGeometry(0.1, 1, 4, 1);
  [flake, grain, splinter].forEach((g) => g.computeVertexNormals());
  return { flake, grain, splinter };
}
