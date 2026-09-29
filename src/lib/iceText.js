import * as THREE from 'three';

/* 얼음 글자 — 사이트 글꼴(Archivo)로 캔버스에 단어를 그리고, 그 윤곽을 따서 입체로 뽑는다.
   three 에 딸린 글꼴 파일이 없고, 있어도 사이트 글꼴과 모양이 달라서 직접 만든다.

   1. 캔버스에 흰 글자를 그린다
   2. 마칭 스퀘어로 글자 경계를 따라 닫힌 윤곽선을 잇는다(안쪽이 늘 같은 쪽에 오도록 방향을 맞춘다)
   3. 가장 큰 윤곽과 같은 방향이면 바깥선, 반대면 구멍(A·O·B·R 의 속)으로 나눠 도형을 만든다
   4. 두께와 둥근 모서리를 주어 뽑아내고, 높이 1 에 맞춰 가운데로 옮긴다 */

const FONT_PX = 120;
const STEP = 2;          // 윤곽을 따는 격자 간격(px)
const SIMPLIFY = 0.7;    // 윤곽을 줄일 때 허용하는 오차(px)

function rasterize(text, family) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `600 ${FONT_PX}px ${family}`;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width + FONT_PX * 0.4);
  const height = Math.ceil(FONT_PX * 1.4);
  canvas.width = width;
  canvas.height = height;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, FONT_PX * 0.2, height / 2);
  const { data } = ctx.getImageData(0, 0, width, height);
  const cols = Math.floor(width / STEP) + 1;
  const rows = Math.floor(height / STEP) + 1;
  const field = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = Math.min(width - 1, i * STEP);
      const y = Math.min(height - 1, j * STEP);
      field[j * cols + i] = data[(y * width + x) * 4] / 255;
    }
  }
  return { field, cols, rows };
}

/* 칸마다 안쪽 모서리 조합 → 경계 선분(모서리: tl=8 tr=4 br=2 bl=1, 변: T R B L).
   안장(5·10)은 두 모서리를 따로 떨어진 것으로 본다 */
const CASES = {
  1: [['L', 'B', ['bl']]], 2: [['B', 'R', ['br']]], 3: [['L', 'R', ['br', 'bl']]],
  4: [['T', 'R', ['tr']]], 5: [['T', 'R', ['tr']], ['L', 'B', ['bl']]], 6: [['T', 'B', ['tr', 'br']]],
  7: [['T', 'L', ['tr', 'br', 'bl']]], 8: [['L', 'T', ['tl']]], 9: [['T', 'B', ['tl', 'bl']]],
  10: [['L', 'T', ['tl']], ['B', 'R', ['br']]], 11: [['T', 'R', ['tl', 'br', 'bl']]], 12: [['L', 'R', ['tl', 'tr']]],
  13: [['B', 'R', ['tl', 'tr', 'bl']]], 14: [['L', 'B', ['tl', 'tr', 'br']]],
};
const CORNER = { tl: [0, 0], tr: [1, 0], br: [1, 1], bl: [0, 1] };

function traceLoops({ field, cols, rows }) {
  const at = (i, j) => field[j * cols + i];
  const cross = (a, b) => (0.5 - a) / (b - a || 1e-6);
  const segments = [];
  for (let j = 0; j < rows - 1; j += 1) {
    for (let i = 0; i < cols - 1; i += 1) {
      const tl = at(i, j); const tr = at(i + 1, j); const br = at(i + 1, j + 1); const bl = at(i, j + 1);
      const code = (tl > 0.5 ? 8 : 0) | (tr > 0.5 ? 4 : 0) | (br > 0.5 ? 2 : 0) | (bl > 0.5 ? 1 : 0);
      const list = CASES[code];
      if (!list) continue;
      // 변 위의 경계점 — 이웃 칸과 정확히 같은 식으로 구해 이어 붙일 때 맞물린다
      const edge = {
        T: [i + cross(tl, tr), j],
        R: [i + 1, j + cross(tr, br)],
        B: [i + cross(bl, br), j + 1],
        L: [i, j + cross(tl, bl)],
      };
      list.forEach(([ea, eb, inside]) => {
        let p = edge[ea]; let q = edge[eb];
        // 안쪽이 늘 진행 방향의 왼쪽에 오도록 방향을 맞춘다
        const cx = i + inside.reduce((s, c) => s + CORNER[c][0], 0) / inside.length;
        const cy = j + inside.reduce((s, c) => s + CORNER[c][1], 0) / inside.length;
        const side = (q[0] - p[0]) * (cy - p[1]) - (q[1] - p[1]) * (cx - p[0]);
        if (side > 0) [p, q] = [q, p];
        segments.push([p, q]);
      });
    }
  }
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const byStart = new Map();
  segments.forEach((s) => byStart.set(key(s[0]), s));
  const loops = [];
  const used = new Set();
  segments.forEach((s) => {
    if (used.has(s)) return;
    const loop = [];
    let cur = s;
    while (cur && !used.has(cur)) {
      used.add(cur);
      loop.push(cur[0]);
      cur = byStart.get(key(cur[1]));
    }
    if (loop.length > 6) loops.push(loop.map(([x, y]) => [x * STEP, y * STEP]));
  });
  return loops;
}

// 거의 일직선인 점을 걷어 윤곽을 가볍게 한다(더글러스-포이커)
function simplify(points, eps) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a]; const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-6;
    let far = -1; let farD = 0;
    for (let k = a + 1; k < b; k += 1) {
      const d = Math.abs((bx - ax) * (ay - points[k][1]) - (ax - points[k][0]) * (by - ay)) / len;
      if (d > farD) { farD = d; far = k; }
    }
    if (farD > eps && far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

const area = (pts) => pts.reduce((s, p, k) => {
  const q = pts[(k + 1) % pts.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2;

const inside = (pt, poly) => {
  let hit = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a, a += 1) {
    const [xa, ya] = poly[a]; const [xb, yb] = poly[b];
    if ((ya > pt[1]) !== (yb > pt[1]) && pt[0] < ((xb - xa) * (pt[1] - ya)) / (yb - ya) + xa) hit = !hit;
  }
  return hit;
};

/** 단어 → 높이 1 에 맞춘 얼음 글자 도형. 글꼴이 준비된 뒤에 부른다 */
export function createIceWordGeometry(text, { family = 'Archivo', depth = 0.32 } = {}) {
  const loops = traceLoops(rasterize(text, family))
    // 닫힌 선을 그대로 넣으면 시작점과 끝점이 같아 기준선 길이가 0 이 되고, 모든 점이 지워진다.
    // 열린 선(첫 점 ~ 마지막 점, 서로 이웃한 두 점)으로 단순화한다
    .map((loop) => simplify(loop, SIMPLIFY))
    .filter((loop) => loop.length >= 3);
  if (!loops.length) return null;
  const areas = loops.map(area);
  const main = areas.reduce((m, a, k) => (Math.abs(a) > Math.abs(areas[m]) ? k : m), 0);
  const outerSign = Math.sign(areas[main]);
  const outers = []; const holes = [];
  loops.forEach((loop, k) => (Math.sign(areas[k]) === outerSign ? outers : holes).push(loop));
  // 캔버스는 y 가 아래로 커진다 — 뒤집어 도형으로 만든다
  const toVec = (loop) => loop.map(([x, y]) => new THREE.Vector2(x, -y));
  const shapes = outers.map((outer) => {
    const shape = new THREE.Shape(toVec(outer));
    holes.filter((hole) => inside(hole[0], outer)).forEach((hole) => shape.holes.push(new THREE.Path(toVec(hole))));
    return shape;
  });
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: FONT_PX * depth,
    bevelEnabled: true,
    bevelThickness: FONT_PX * 0.05,
    bevelSize: FONT_PX * 0.025,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const h = box.max.y - box.min.y || 1;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
  geometry.scale(1 / h, 1 / h, 1 / h);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

