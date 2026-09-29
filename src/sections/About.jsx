import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { byId } from '../data/specimens';
import { prefersReduced } from '../lib/smooth';
import ScrambleText from '../components/ScrambleText';
import './about.css';

const MAP_CENTER = { x: 130, y: 48 };
const CAMERA = { x: 50, y: 44 };

const CHAMBERS = [
  {
    id: 'hyomin', no: '00', label: 'ABOUT', type: 'identity',
    map: { x: 130, y: 46 }, room: { x: 130, y: 157 },
    eyebrow: 'ABOUT / PROFILE 00',
    title: '차분하게 관찰하고,\n끝까지 작동하게',
    note: '사용자의 말과 행동에서 반복되는 신호를 찾고, 흩어진 정보를 구조와 화면으로 정리합니다. Figma에서 끝내지 않고 직접 구현하며 사용 중 생기는 문제까지 다듬습니다.',
    tags: ['PM', 'UX/UI DESIGN', 'FRONTEND'],
    record: {
      status: 'Open To Work',
      email: 'gysld261@gmail.com',
      groups: [
        {
          label: 'EDUCATION',
          rows: [
            { at: '2026.04', text: '이젠아카데미 AI활용 UI/UX 부트캠프', sub: '이젠아카데미DX교육센터 강남 · 2026.10 수료 예정' },
            { at: '2026.02', text: '인덕대학교 시각디자인학과 졸업' },
          ],
        },
        {
          label: 'AWARDS',
          rows: [
            { at: '2026.08', text: 'AI활용 UI/UX 부트캠프 최우수상', sub: '이젠아카데미DX교육센터 강남' },
            { at: '2025.11', text: '시각디자인학과 2025 졸업전시회 우수상', sub: '인덕대학교' },
            { at: '2025.07', text: '커뮤니케이션디자인국제공모전 입상', sub: '한국커뮤니케이션디자인협회' },
          ],
        },
      ],
    },
  },
  {
    id: 'observe', no: '01', label: 'BACKGROUND', type: 'observe',
    map: { x: 92, y: 29 }, room: { x: 54, y: 178 },
    eyebrow: 'BACKGROUND / RANGE 01',
    title: '기획부터 구현까지,\n경계를 넘나듭니다',
    note: 'PM과 IA로 방향과 흐름을 정리하고, UI 디자인과 프론트엔드 구현으로 결과를 직접 확인해 왔습니다. 역할을 나누기보다 필요한 일을 연결하며 프로젝트를 완성합니다.',
    projects: ['walga', 'tchaikim'],
    tags: ['PM', 'IA', 'UI DESIGN', 'FRONTEND'],
  },
  {
    id: 'structure', no: '02', label: 'SKILLS', type: 'skills',
    map: { x: 167, y: 29 }, room: { x: 207, y: 177 },
    eyebrow: 'SKILLS / TOOLKIT 02',
    title: '도구보다,\n연결하는 능력',
    note: '문제를 구조화하고 화면으로 설계한 뒤 직접 구현합니다. AI는 탐색과 제작 속도를 높이는 도구로 사용하고, 결과는 직접 판단하고 수정합니다.',
    projects: ['tchaikim', 'walga'],
    skills: [
      {
        no: '01', label: 'UX/UI DESIGN',
        items: ['Figma', 'User Flow', 'Wireframe', 'Prototype', 'Design System'],
        detail: '사용자 흐름을 구조화하고 인터페이스와 시스템으로 전개',
      },
      {
        no: '02', label: 'FRONTEND',
        items: ['React', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Responsive Web'],
        detail: '반응형 화면과 인터랙션을 실제 웹으로 구현',
      },
      {
        no: '03', label: 'VISUAL & WORKFLOW',
        items: ['Photoshop', 'Illustrator', 'Git/GitHub', 'Handoff'],
        detail: '시각 자료 제작부터 버전 관리와 디자인·개발 전달까지 연결',
      },
      {
        no: '04', label: 'AI-ASSISTED',
        items: ['ChatGPT', 'Claude', 'Codex'],
        detail: '자료 정리·아이디어 탐색·UX 카피·구현 보조 후 직접 검증',
      },
    ],
  },
  {
    id: 'build', no: '03', label: 'APPROACH', type: 'build',
    map: { x: 171, y: 66 }, room: { x: 199, y: 263 },
    eyebrow: 'APPROACH / PROCESS 03',
    title: '관찰하고 구조화한 뒤,\n직접 구현하고 다듬습니다',
    note: '화면을 먼저 만들기보다 문제를 좁히고 사용자 흐름을 정리합니다. 구현 과정에서 발견한 문제를 다시 디자인에 반영하며 완성도를 높입니다.',
    projects: ['tchaikim', 'walga'],
    tags: ['OBSERVE', 'STRUCTURE', 'BUILD', 'REFINE'],
  },
  {
    id: 'detail', no: '04', label: 'WORK', type: 'detail',
    map: { x: 91, y: 68 }, room: { x: 63, y: 260 },
    eyebrow: 'WORK / EVIDENCE 04',
    title: '결과보다 과정을\n프로젝트로 증명합니다',
    note: '왈가왈봇에서는 PM·IA·UI·프론트엔드를 맡아 사건 접수와 투표 흐름을 설계했고, TCHAIKIM에서는 브랜드 구조와 쇼핑 경험을 웹 인터랙션으로 구현했습니다.',
    projects: ['walga', 'tchaikim'],
    tags: ['CASE STUDY', 'TEAM PROJECT', 'WEB'],
  },
];

function ChamberVisual({ type }) {
  if (type === 'observe') {
    return (
      <div className="about-room-visual about-room-visual--observe" aria-hidden="true">
        <span className="scan-line" />
        {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--i': i }} />)}
        <b>REPEATED SIGNAL / 03</b>
      </div>
    );
  }
  if (type === 'skills') {
    return (
      <div className="about-room-visual about-room-visual--skills" aria-hidden="true">
        <svg className="skill-web" viewBox="0 0 480 600" preserveAspectRatio="xMidYMid meet">
          <g className="skill-web__lines">
            <path d="M240 300 L118 142 L365 126 L392 382 L145 465 Z" />
            <path d="M118 142 L145 465 M365 126 L145 465 M118 142 L392 382" />
          </g>
          <g className="skill-web__points">
            <circle cx="240" cy="300" r="7" />
            <circle cx="118" cy="142" r="5" />
            <circle cx="365" cy="126" r="5" />
            <circle cx="392" cy="382" r="5" />
            <circle cx="145" cy="465" r="5" />
          </g>
        </svg>
        <span className="skill-web__core">DESIGN<br />↔ CODE</span>
        <span className="skill-web__label skill-web__label--design">UX/UI</span>
        <span className="skill-web__label skill-web__label--front">FRONTEND</span>
        <span className="skill-web__label skill-web__label--flow">WORKFLOW</span>
        <span className="skill-web__label skill-web__label--ai">AI</span>
        <p className="sys">CONNECTED TOOLKIT / 04</p>
      </div>
    );
  }
  if (type === 'structure') {
    return (
      <div className="about-room-visual about-room-visual--structure" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ '--i': i }} />)}
        <span />
      </div>
    );
  }
  if (type === 'build') {
    return (
      <div className="about-room-visual about-room-visual--build" aria-hidden="true">
        <div className="build-code">
          {[72, 46, 84, 58, 66, 38].map((w, i) => <i key={i} style={{ '--w': `${w}%`, '--i': i }} />)}
        </div>
        <div className="build-frame"><i /><i /><i /></div>
      </div>
    );
  }
  if (type === 'detail') {
    return (
      <div className="about-room-visual about-room-visual--detail" aria-hidden="true">
        <span className="detail-lens"><i /><i /></span>
        <b>12.0</b><b>16.0</b><b>24.0</b>
      </div>
    );
  }
  return null;
}

/**
 * 관찰 지도 — 어둠 속에 떠 있는 얇은 드라이아이스 판과 다섯 개의 균열.
 *
 *   판      약간 위에서 내려다본 넓은 판. 앞쪽은 몇 장의 조각으로 깨져 두께 단면이 드러나고, 단면엔 세로 결이 있다
 *   실금    표면 전체에 가는 실금이 퍼져 있다. 앞쪽일수록 또렷하다
 *   균열    키워드마다 민트빛 균열이 하나씩 — 키워드는 균열의 입구다. 판 가장자리까지 닿은 균열은 단면을 타고 내려간다
 *   승화    균열에서 흰 기체가 조금씩 올라온다. 물 얼음이 아니라 드라이아이스라는 표시
 *   반응    커서를 올린 균열이 밝아지고, 고르면 그 균열 아래로 빛이 쏟아진다
 *   하강    판이 위로 빠져나가며 카메라가 빛줄기를 따라 내려간다. 점 격자·결·온도 눈금이 위로 흘러
 *           실제로 깊이 내려가는 속도감을 주고, 빛줄기는 방의 조명 자리로 옮겨가 그대로 방의 전등이 된다
 *
 * 판·실금·단면은 크기가 바뀔 때만 한 번 그려 두고(정적 레이어), 매 프레임엔 빛·기체·핀만 다시 그린다.
 * 모양은 시드 난수로 만들어 새로고침해도 같은 판이 나온다.
 */
const WORLD_OFFSET = { x: 80, y: 4 };   // 지도 화면일 때 .about-world 의 위치 (vw, vh)
const FOCAL = 9;                         // 원근 — 앞 조각이 조금 더 크게 보일 만큼만
const PITCH = -0.62;                     // 내려다보는 각도 — 표면이 충분히 보일 만큼
const SLAB_BACK = -3.3;                  // 판의 먼 가장자리
const SLAB_SIDE = 9.6;                   // 판의 좌우 끝 — 화면 밖까지 이어진다
const STEM = 34;                         // 핀 줄기 길이 (px)
const DESCEND = 1.45;                    // 내려가는 시간 (s) — About 의 travel 단계 길이와 맞춘다
const ASCEND = 1.1;                      // 돌아오는 시간 (s) — return 단계 길이와 맞춘다
/* 방마다 조명이 달린 가로 위치 — about.css 의 .about-room--* { --beam-x } 와 같은 값 */
const ROOM_BEAM_X = { hyomin: 0.7, observe: 0.72, structure: 0.48, build: 0.64, detail: 0.34 };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* 앞쪽 조각 — x 범위, 앞 가장자리 깊이(z), 두께 */
const PLATES = [
  { x0: -SLAB_SIDE, x1: -5.1, z: 1.3, depth: 0.42 },
  { x0: -5.1, x1: -2.5, z: 0.45, depth: 0.5 },
  { x0: -2.5, x1: 2.4, z: 1.55, depth: 0.62 },
  { x0: 2.4, x1: 4.9, z: 2.0, depth: 0.7 },
  { x0: 4.9, x1: SLAB_SIDE, z: 1.2, depth: 0.52 },
];
const plateAt = (x) => PLATES.find((p) => x >= p.x0 && x <= p.x1) || PLATES[PLATES.length - 1];

/* 키워드마다 균열 입구 — toEdge 는 판 가장자리까지 갈라져 단면을 타고 내려간다 */
const FISSURES = {
  hyomin: { x: 0.1, z: -0.4, toEdge: true, base: 0.7 },
  observe: { x: -4.5, z: -2.0, len: 1.8, heading: 0.5 },
  structure: { x: 4.3, z: -1.9, len: 2, heading: -0.35 },
  detail: { x: -6.3, z: 0.7, toEdge: true },
  build: { x: 5.7, z: 0.15, toEdge: true },
};
/* 세로로 긴 화면 — 판은 그대로 화면 밖까지 이어지고, 균열만 화면 안쪽으로 모은다.
   이름표가 핀 오른쪽으로 뻗으므로 오른쪽 여백을 더 둔다 */
const FISSURES_TALL = {
  hyomin: { x: 0.3, z: -0.5, toEdge: true, base: 0.7 },
  observe: { x: -2.1, z: -2.3, len: 1.4, heading: 0.35 },
  structure: { x: 1.0, z: -2.0, len: 1.5, heading: -0.25 },
  detail: { x: -2.2, z: 0.55, toEdge: true },
  build: { x: 1.4, z: 0.8, toEdge: true },
};

const buildSlab = (defs) => {
  const rand = seeded(20260929);
  const frontZ = (x) => plateAt(x).z;

  // 앞 가장자리 — 조각마다 살짝 들쭉날쭉하고, 조각 사이엔 안으로 파인 홈
  const edge = [];
  PLATES.forEach((plate, i) => {
    for (let x = plate.x0; x < plate.x1; x += 0.18) {
      edge.push({ x, z: plate.z + (rand() - 0.5) * 0.12, plate: i });
    }
    if (i < PLATES.length - 1) {
      const next = PLATES[i + 1];
      edge.push({ x: plate.x1, z: Math.min(plate.z, next.z) - 0.3, plate: i, notch: true });
    }
  });
  edge.push({ x: SLAB_SIDE, z: PLATES[PLATES.length - 1].z, plate: PLATES.length - 1 });

  // 조각의 단면 — 아래 가장자리는 고르지 않고, 세로 결이 드문드문 흘러내린다
  const walls = PLATES.map((plate, i) => {
    const top = edge.filter((p) => p.plate === i && !p.notch);
    let wobble = 0;
    const bottom = top.map((p) => {
      wobble += (rand() - 0.5) * 0.16;
      wobble *= 0.8;
      return { x: p.x, z: p.z + 0.04, y: plate.depth * (0.86 + wobble + rand() * 0.08) };
    });
    const grain = [];
    const count = Math.round((plate.x1 - plate.x0) * 5);
    for (let k = 0; k < count; k++) {
      const x = plate.x0 + rand() * (plate.x1 - plate.x0);
      const strong = rand() < 0.18;
      grain.push({ x, z: plate.z + (rand() - 0.5) * 0.08, len: plate.depth * (0.3 + rand() * 0.65), a: strong ? 0.2 + rand() * 0.12 : 0.04 + rand() * 0.07, lean: (rand() - 0.5) * 0.12 });
    }
    return { plate, top, bottom, grain };
  });

  // 실금 — 표면 위를 헤매는 가는 선. 판 밖으로 나가면 멈춘다
  const inside = (x, z) => Math.abs(x) < SLAB_SIDE - 0.2 && z > SLAB_BACK + 0.15 && z < frontZ(x) - 0.06;
  const walk = (x, z, angle, steps, step, turn) => {
    const pts = [{ x, z }];
    for (let s = 0; s < steps; s++) {
      angle += rand() < 0.14 ? (rand() - 0.5) * 1.6 : (rand() - 0.5) * turn;
      const nx = x + Math.cos(angle) * step;
      const nz = z + Math.sin(angle) * step * 0.7;
      if (!inside(nx, nz)) break;
      x = nx; z = nz;
      pts.push({ x, z });
    }
    return pts;
  };
  const cracks = [];
  for (let k = 0; k < 90; k++) {
    const x = (rand() * 2 - 1) * (SLAB_SIDE - 0.4);
    const z = SLAB_BACK + 0.2 + rand() * (frontZ(x) - SLAB_BACK - 0.4);
    cracks.push({ pts: walk(x, z, rand() * Math.PI * 2, 5 + Math.floor(rand() * 18), 0.26, 0.18), w: 1 });
  }
  // 조각 사이의 홈에서 판 안쪽으로 뻗는 큰 금
  edge.filter((p) => p.notch).forEach((p) => {
    cracks.push({ pts: walk(p.x, p.z - 0.05, -Math.PI / 2 + (rand() - 0.5) * 0.6, 12 + Math.floor(rand() * 10), 0.26, 0.25), w: 2.2 });
  });

  // 키워드 균열 — 입구에서 지그재그로 갈라진다
  const fissures = {};
  const kink = () => (rand() < 0.28 ? (rand() - 0.5) * 0.34 : (rand() - 0.5) * 0.08);
  Object.entries(defs).forEach(([id, f]) => {
    const pts = [{ x: f.x, z: f.z }];
    const branches = [];
    let { x, z } = f;
    let drift = (rand() - 0.5) * 0.06;
    const step = () => {
      x += drift + kink();
      pts.push({ x, z });
      if (rand() < 0.22) {
        const side = rand() < 0.5 ? -1 : 1;
        const br = [{ x, z }];
        let bx = x; let bz = z;
        for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
          bx += side * (0.08 + rand() * 0.12); bz += (rand() - 0.3) * 0.12;
          br.push({ x: bx, z: bz });
        }
        branches.push(br);
      }
    };
    if (f.toEdge) {
      while (z < frontZ(x) - 0.02) {
        z = Math.min(frontZ(x), z + 0.12 + rand() * 0.14);
        step();
      }
    } else {
      const lean = f.heading;
      for (let d = 0; d < f.len; d += 0.16) {
        z += 0.1 + rand() * 0.06;
        drift = lean * 0.12;
        step();
      }
    }
    const end = pts[pts.length - 1];
    fissures[id] = { pts, branches, edge: f.toEdge ? { x: end.x, z: end.z, depth: plateAt(end.x).depth } : null, base: f.base || 0.45 };
  });

  return { edge, walls, cracks, fissures };
};
const SLABS = { wide: buildSlab(FISSURES), tall: buildSlab(FISSURES_TALL) };

function useIceSlab(phase, selected) {
  const canvasRef = useRef(null);
  const nodeRefs = useRef({});
  const hoverRef = useRef(null);           // 커서나 포커스가 머문 키워드
  const phaseRef = useRef(phase);
  const selectedRef = useRef(selected);
  phaseRef.current = phase;
  selectedRef.current = selected;
  const running = phase === 'map' || phase === 'travel' || phase === 'return';

  useEffect(() => {
    if (!running) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const layer = document.createElement('canvas');   // 판·실금·단면을 한 번 그려 두는 정적 레이어
    const lctx = layer.getContext('2d');
    const reduced = prefersReduced();
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let slab = SLABS.wide;
    const glow = Object.fromEntries(Object.keys(FISSURES).map((id) => [id, slab.fissures[id].base]));
    const beam = Object.fromEntries(Object.keys(FISSURES).map((id) => [id, 0]));
    const vapor = [];
    let W = 0; let H = 0; let dpr = 1;
    let cx = 0; let cy = 0; let U = 1; let kx = 1;
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    // 하강 진행도 0(판 위) ~ 1(방 앞). 방에서 돌아올 땐 1 에서 출발한다
    let descent = phaseRef.current === 'return' ? 1 : 0;
    const streaks = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), len: 40 + Math.random() * 120, a: 0.04 + Math.random() * 0.08 }));

    const cp = Math.cos(PITCH); const sp = Math.sin(PITCH);
    // 판 좌표(x 좌우, y 아래로 두께, z 앞뒤) → 화면. 세로로 긴 화면에선 좌우만 좁혀 판 전체가 들어오게 한다
    const project = (x, y, z) => {
      const y2 = y * cp - z * sp;
      const z2 = y * sp + z * cp;
      const s = FOCAL / (FOCAL - z2);
      return [cx + x * kx * U * s, cy + y2 * U * s, s];
    };

    const paintLayer = () => {
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, W, H);
      lctx.lineCap = 'round';
      lctx.lineJoin = 'round';

      // 표면 — 먼 가장자리에서 앞으로 올수록 조금 밝아진다
      const back = project(0, 0, SLAB_BACK);
      const front = project(0, 0, 2);
      const surface = lctx.createLinearGradient(0, back[1], 0, front[1]);
      surface.addColorStop(0, 'rgba(160, 190, 196, 0)');
      surface.addColorStop(1, 'rgba(160, 190, 196, .085)');
      lctx.fillStyle = surface;
      lctx.beginPath();
      let p = project(-SLAB_SIDE, 0, SLAB_BACK); lctx.moveTo(p[0], p[1]);
      p = project(SLAB_SIDE, 0, SLAB_BACK); lctx.lineTo(p[0], p[1]);
      for (let i = slab.edge.length - 1; i >= 0; i--) { p = project(slab.edge[i].x, 0, slab.edge[i].z); lctx.lineTo(p[0], p[1]); }
      lctx.closePath();
      lctx.fill();
      // 먼 가장자리 윤곽
      lctx.strokeStyle = 'rgba(190, 214, 220, .12)';
      lctx.lineWidth = 1;
      lctx.beginPath();
      p = project(-SLAB_SIDE, 0, SLAB_BACK); lctx.moveTo(p[0], p[1]);
      for (let x = -SLAB_SIDE; x <= SLAB_SIDE; x += 0.5) { p = project(x, 0, SLAB_BACK + Math.sin(x * 1.7) * 0.05); lctx.lineTo(p[0], p[1]); }
      lctx.stroke();

      // 실금 — 앞쪽일수록 또렷하게
      slab.cracks.forEach(({ pts, w }) => {
        if (pts.length < 2) return;
        const near = (pts[0].z - SLAB_BACK) / (2 - SLAB_BACK);
        lctx.strokeStyle = `rgba(200, 224, 230, ${(0.05 + 0.16 * near) * (w > 1 ? 1.8 : 1)})`;
        lctx.lineWidth = w > 1 ? 1 : 0.7;
        lctx.beginPath();
        pts.forEach((pt, i) => { const q = project(pt.x, 0, pt.z); if (i) lctx.lineTo(q[0], q[1]); else lctx.moveTo(q[0], q[1]); });
        lctx.stroke();
      });

      // 단면 — 먼 조각부터. 반투명한 면, 세로 결, 윗모서리 하이라이트
      [...slab.walls].sort((a, b) => a.plate.z - b.plate.z).forEach(({ top, bottom, grain }) => {
        if (!top.length) return;
        const t0 = project(top[0].x, 0, top[0].z);
        const b0 = project(bottom[0].x, bottom[0].y, bottom[0].z);
        const face = lctx.createLinearGradient(0, t0[1], 0, b0[1]);
        face.addColorStop(0, 'rgba(150, 186, 192, .11)');
        face.addColorStop(1, 'rgba(150, 186, 192, .01)');
        lctx.fillStyle = face;
        lctx.beginPath();
        top.forEach((pt, i) => { const q = project(pt.x, 0, pt.z); if (i) lctx.lineTo(q[0], q[1]); else lctx.moveTo(q[0], q[1]); });
        for (let i = bottom.length - 1; i >= 0; i--) { const q = project(bottom[i].x, bottom[i].y, bottom[i].z); lctx.lineTo(q[0], q[1]); }
        lctx.closePath();
        lctx.fill();
        grain.forEach((g) => {
          const a = project(g.x, 0, g.z); const b = project(g.x + g.lean, g.len, g.z);
          lctx.strokeStyle = `rgba(200, 226, 232, ${g.a})`;
          lctx.lineWidth = 0.6;
          lctx.beginPath(); lctx.moveTo(a[0], a[1]); lctx.lineTo(b[0], b[1]); lctx.stroke();
        });
        lctx.strokeStyle = 'rgba(160, 196, 202, .1)';
        lctx.beginPath();
        bottom.forEach((pt, i) => { const q = project(pt.x, pt.y, pt.z); if (i) lctx.lineTo(q[0], q[1]); else lctx.moveTo(q[0], q[1]); });
        lctx.stroke();
        [[top[0], bottom[0]], [top[top.length - 1], bottom[bottom.length - 1]]].forEach(([t, bt]) => {
          const a = project(t.x, 0, t.z); const b = project(bt.x, bt.y, bt.z);
          lctx.strokeStyle = 'rgba(200, 226, 232, .16)';
          lctx.beginPath(); lctx.moveTo(a[0], a[1]); lctx.lineTo(b[0], b[1]); lctx.stroke();
        });
        lctx.strokeStyle = 'rgba(214, 236, 240, .42)';
        lctx.lineWidth = 1;
        lctx.beginPath();
        top.forEach((pt, i) => { const q = project(pt.x, 0, pt.z); if (i) lctx.lineTo(q[0], q[1]); else lctx.moveTo(q[0], q[1]); });
        lctx.stroke();
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      layer.width = W * dpr; layer.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wide = W > H * 1.1;
      slab = wide ? SLABS.wide : SLABS.tall;
      U = wide ? Math.min(W / 13, H / 6.2) : W / 6;
      // 가로 화면이 좁아질 때만 좌우를 조금 좁혀 가장 바깥 이름표(|x| 6.3)가 화면 안에 남게 한다
      kx = wide ? Math.min(1, (W / 2 - 150) / (6.3 * U)) : 1;
      cx = W * 0.5;
      cy = H * (wide ? 0.52 : 0.46);
      paintLayer();
    };
    resize();

    const onMove = (event) => {
      pointer.x = event.clientX / W - 0.5;
      pointer.y = event.clientY / H - 0.5;
    };

    // 균열을 따라 한 점 — 기체가 올라올 자리
    const along = (id) => {
      const pts = slab.fissures[id].pts;
      const pt = pts[Math.floor(Math.random() * pts.length)];
      return project(pt.x, 0, pt.z);
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const ph = phaseRef.current;
      const sel = selectedRef.current;
      const hover = ph === 'map' ? hoverRef.current : null;

      // 판 전체가 커서 반대쪽으로 몇 px 움직인다 — 깊이감만 살짝
      pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
      pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
      const ox = reduced ? 0 : -pointer.sx * 14;
      const oy = reduced ? 0 : -pointer.sy * 8;

      // 하강 — 고른 균열의 빛이 새는 자리를 축으로 판이 커지며 위로 빠져나간다
      const goingDown = ph === 'travel';
      if (reduced) descent = goingDown ? 1 : 0;
      else descent = Math.max(0, Math.min(1, descent + (goingDown ? dt / DESCEND : -dt / ASCEND)));
      const e = easeInOut(descent);
      const chosenF = sel ? slab.fissures[sel] : null;
      const anchorPt = chosenF ? (chosenF.edge ? project(chosenF.edge.x, chosenF.edge.depth * 0.9, chosenF.edge.z + 0.04) : (() => { const q = chosenF.pts[chosenF.pts.length - 1]; return project(q.x, 0, q.z); })()) : [cx, cy, 1];
      const ax = anchorPt[0]; const ay = anchorPt[1];
      const S = 1 + e * 0.55;
      const lift = e * H * 1.1;
      const tx = ax * (1 - S) + ox;
      const ty = ay * (1 - S) + oy - lift;
      const toScreen = (p) => [p[0] * S + tx, p[1] * S + ty];
      const scroll = e * H * 2.4;           // 배경이 위로 흘러가는 양

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 점 격자 — 내려가는 동안 위로 흘러간다. 판보다 멀리 있어 조금 느리다
      const dotShift = (((scroll * 0.45) % 36) + 36) % 36;
      ctx.fillStyle = `rgba(175, 194, 200, ${0.07 + 0.05 * Math.sin(Math.PI * e)})`;
      for (let x = 18; x < W; x += 36) for (let y = 18 - dotShift; y < H; y += 36) if (y > -1) ctx.fillRect(x, y, 1, 1);

      // 속도선 — 하강 중에만
      const rush = Math.sin(Math.PI * e);
      if (rush > 0.01) {
        streaks.forEach((st) => {
          const y = ((st.y * (H + 200) - scroll * 1.2) % (H + 200) + H + 200) % (H + 200) - 100;
          ctx.strokeStyle = `rgba(200, 226, 232, ${st.a * rush})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(st.x * W, y); ctx.lineTo(st.x * W, y + st.len * (0.4 + rush)); ctx.stroke();
        });
      }

      ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * tx, dpr * ty);
      ctx.globalAlpha = 1 - Math.max(0, Math.min(1, (e - 0.55) / 0.4));
      ctx.drawImage(layer, 0, 0, W, H);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      Object.entries(slab.fissures).forEach(([id, f]) => {
        const chosen = sel === id && ph !== 'return';
        const others = sel && sel !== id && ph === 'travel';
        const pulse = reduced ? 0 : Math.sin(clock * 1.3 + id.length) * 0.06;
        const targetGlow = chosen ? 1.25 : others ? 0.12 : f.base + (hover === id ? 0.45 : 0) + pulse;
        const targetBeam = chosen ? 1 : others ? 0 : (id === 'hyomin' ? 0.32 : 0) + (hover === id ? 0.35 : 0);
        const k = reduced ? 1 : 1 - Math.exp(-dt * (chosen ? 5 : 3));
        glow[id] += (targetGlow - glow[id]) * k;
        beam[id] += (targetBeam - beam[id]) * k;
        const g = glow[id];

        // 입구 둘레 표면이 은은하게 밝아진다
        const entry = project(f.pts[0].x, 0, f.pts[0].z);
        const halo = ctx.createRadialGradient(entry[0], entry[1], 0, entry[0], entry[1], 70 * entry[2]);
        halo.addColorStop(0, `rgba(157, 222, 215, ${0.1 * g})`);
        halo.addColorStop(1, 'rgba(157, 222, 215, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(entry[0] - 80, entry[1] - 80, 160, 160);

        // 균열 — 넓고 옅게, 좁고 짙게, 가운데는 거의 흰빛
        const trace = () => {
          ctx.beginPath();
          f.pts.forEach((pt, i) => { const q = project(pt.x, 0, pt.z); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
          if (f.edge) {
            const q = project(f.edge.x, f.edge.depth * 0.92, f.edge.z + 0.04);
            ctx.lineTo(q[0], q[1]);
          }
        };
        [[14, 0.06], [6, 0.2], [2.4, 0.55], [1.1, 1]].forEach(([width, alpha], i) => {
          ctx.strokeStyle = i === 3 ? `rgba(232, 255, 251, ${Math.min(1, alpha * g)})` : `rgba(157, 222, 215, ${Math.min(1, alpha * g)})`;
          ctx.lineWidth = width;
          trace();
          ctx.stroke();
        });
        ctx.strokeStyle = `rgba(157, 222, 215, ${Math.min(1, 0.45 * g)})`;
        ctx.lineWidth = 0.9;
        f.branches.forEach((br) => {
          ctx.beginPath();
          br.forEach((pt, i) => { const q = project(pt.x, 0, pt.z); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
          ctx.stroke();
        });

        // 가장자리까지 간 균열은 단면 아래로 빛을 흘린다
        // 내려가기 시작하면 고른 균열의 빛은 아래의 하강 빛줄기가 이어받는다
        const handoff = sel === id ? 1 - Math.min(1, e * 10) : 1;
        if (f.edge && beam[id] * handoff > 0.01) {
          const top = project(f.edge.x, f.edge.depth * 0.9, f.edge.z + 0.04);
          const reach = H * (0.18 + 0.42 * beam[id]);
          const b = beam[id] * handoff;
          [[34, 0.07], [11, 0.2], [2.6, 0.75]].forEach(([width, alpha]) => {
            const fall = ctx.createLinearGradient(0, top[1], 0, top[1] + reach);
            fall.addColorStop(0, `rgba(194, 255, 245, ${alpha * b})`);
            fall.addColorStop(1, 'rgba(157, 222, 215, 0)');
            ctx.fillStyle = fall;
            ctx.fillRect(top[0] - (width * top[2]) / 2, top[1], width * top[2], reach);
          });
        }

        // 기체 — 균열이 밝을수록 자주 올라온다
        if (!reduced && vapor.length < 120 && Math.random() < dt * (1.2 + 5 * g)) {
          const at = along(id);
          vapor.push({ x: at[0], y: at[1], vx: (Math.random() - 0.5) * 6, vy: -10 - Math.random() * 16, life: 0, max: 2.4 + Math.random() * 2.2, r: 0.8 + Math.random() * 1.4 });
        }

        // 핀 — 입구의 작은 원과 위로 선 줄기. 이름표(버튼)가 줄기 끝에 달린다
        const lift = hover === id || chosen ? 1 : 0.6;
        ctx.strokeStyle = `rgba(226, 240, 244, ${(ph === 'map' ? 0.55 : 0.2) * lift + 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(entry[0], entry[1] - 5); ctx.lineTo(entry[0], entry[1] - STEM); ctx.stroke();
        ctx.fillStyle = '#0b0d0e';
        ctx.beginPath(); ctx.arc(entry[0], entry[1], 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(236, 248, 250, ${0.6 + 0.4 * lift})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      });

      for (let i = vapor.length - 1; i >= 0; i--) {
        const v = vapor[i];
        v.life += dt;
        if (v.life > v.max) { vapor.splice(i, 1); continue; }
        v.x += v.vx * dt + Math.sin(v.life * 2 + i) * 0.15;
        v.y += v.vy * dt;
        v.r += dt * 1.4;
        const t = v.life / v.max;
        ctx.fillStyle = `rgba(226, 242, 246, ${0.2 * Math.sin(Math.PI * t)})`;
        ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 내려가는 빛줄기 — 판을 벗어나면 방의 조명 자리로 옮겨가 화면 끝까지 이어진다
      if (chosenF && e > 0.001) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const [sx0, sy0] = toScreen(anchorPt);
        const bx = sx0 + (W * (ROOM_BEAM_X[sel] ?? 0.5) - sx0) * easeInOut(Math.max(0, Math.min(1, (e - 0.4) / 0.5)));
        const top = Math.max(0, sy0);
        const strength = Math.min(1, e * 6);
        // 번짐은 폭을 달리한 옅은 기둥을 겹쳐 가장자리가 네모지지 않게 한다
        [[84, 0.018], [54, 0.026], [30, 0.045], [14, 0.14], [2.6, 0.9]].forEach(([width, alpha]) => {
          const col = ctx.createLinearGradient(0, top, 0, H);
          col.addColorStop(0, `rgba(214, 255, 248, ${alpha * strength})`);
          col.addColorStop(1, `rgba(157, 222, 215, ${alpha * strength * 0.35})`);
          ctx.fillStyle = col;
          ctx.fillRect(bx - width / 2, top, width, H - top);
        });
        // 빛이 판에서 벗어나기 전엔 새는 자리와 이어 준다
        if (sy0 > 0 && Math.abs(bx - sx0) > 1) {
          ctx.strokeStyle = `rgba(214, 255, 248, ${0.8 * strength})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(bx, Math.min(H, sy0 + 60)); ctx.stroke();
        }
        // 온도 눈금 — 내려갈수록 차가워진다. 빛줄기 왼쪽에 붙어 위로 흘러간다
        const show = Math.min(1, Math.max(0, (e - 0.08) / 0.2)) * (1 - Math.max(0, Math.min(1, (e - 0.86) / 0.14)));
        if (show > 0.01) {
          const gap = 58;
          ctx.font = '500 10px Archivo, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          const first = Math.floor(scroll / gap);
          for (let k = first; k < first + Math.ceil(H / gap) + 2; k++) {
            const y = k * gap - scroll + H * 0.2;
            if (k < 0 || y < top || y > H) continue;
            const major = k % 4 === 0;
            ctx.strokeStyle = `rgba(200, 226, 232, ${(major ? 0.5 : 0.24) * show})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx - (major ? 30 : 20), y); ctx.lineTo(bx - 10, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + 10, y); ctx.lineTo(bx + (major ? 18 : 14), y); ctx.stroke();
            if (major) {
              ctx.fillStyle = `rgba(157, 222, 215, ${0.7 * show})`;
              ctx.fillText(`−${(78.5 + k * 0.5).toFixed(1)}°`, bx - 38, y);
            }
          }
        }
      }

      // 이름표 — 핀 줄기 끝에 붙는다. 내려가는 동안엔 판과 함께 위로 빠져나간다
      CHAMBERS.forEach((item) => {
        const el = nodeRefs.current[item.id];
        const f = slab.fissures[item.id];
        if (!el || !f) return;
        const entry = toScreen(project(f.pts[0].x, 0, f.pts[0].z));
        const wx = (entry[0] / W) * 100 + WORLD_OFFSET.x;
        const wy = (entry[1] / H) * 100 + WORLD_OFFSET.y;
        el.style.translate = `${(((wx - item.map.x) * W) / 100).toFixed(1)}px ${(((wy - item.map.y) * H) / 100).toFixed(1)}px`;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
    };
  }, [running]);

  return { canvasRef, nodeRefs, hoverRef };
}

/**
 * 이력 기록 — 온도계 눈금 위에 날짜를 올린다.
 * 지금이 승화점(−78.5°C)이고, 한 달 거슬러 갈 때마다 2°C 씩 차가워진다.
 * 최근 일일수록 승화점에 가깝다 — 고체였던 시간이 쌓여 지금 기체로 풀려나가는 중이라는 뜻.
 */
const RECORD_AS_OF = '2026.09';
const SUBLIMATION_POINT = -78.5;
const DEG_PER_MONTH = 2;
const monthsOf = (ym) => { const [y, m] = ym.split('.').map(Number); return y * 12 + m; };
const tempLabel = (value) => `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}°`;
const tempAt = (ym) => tempLabel(SUBLIMATION_POINT - (monthsOf(RECORD_AS_OF) - monthsOf(ym)) * DEG_PER_MONTH);

function ProfileRecord({ record, play }) {
  let index = 0;
  return (
    <section className="profile-record" aria-label="학력, 교육, 수상 이력">
      <div className="profile-record__row profile-record__row--now" style={{ '--i': index++ }}>
        <span className="profile-record__temp sys" aria-hidden="true">
          <ScrambleText text={tempLabel(SUBLIMATION_POINT)} play={play} duration={700} delay={320} />
        </span>
        <div className="profile-record__body">
          <span className="profile-record__date sys">NOW</span>
          <div>
            <b>{record.status}</b>
            <a href={`mailto:${record.email}`}>{record.email} <i aria-hidden="true">↗</i></a>
          </div>
        </div>
      </div>
      {record.groups.map((group) => (
        <div className="profile-record__group" key={group.label}>
          <p className="profile-record__label sys">{group.label}</p>
          <ul>
            {group.rows.map((row) => (
              <li className="profile-record__row" key={row.text} style={{ '--i': index++ }}>
                <span className="profile-record__temp sys" aria-hidden="true">
                  <ScrambleText text={tempAt(row.at)} play={play} duration={700} delay={320 + index * 70} />
                </span>
                <div className="profile-record__body">
                  <span className="profile-record__date sys">{row.at}</span>
                  <div>
                    <b>{row.text}</b>
                    {row.sub && <small>{row.sub}</small>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="profile-record__legend sys" aria-hidden="true">−78.5°C SUBLIMATION = NOW · 1 MONTH = 2°C</p>
    </section>
  );
}

function ProjectEvidence({ ids, onOpenProject }) {
  if (!ids?.length) return null;
  return (
    <div className="about-room__evidence">
      <p className="sys">EVIDENCE</p>
      <ul>
        {ids.map((id) => {
          const project = byId(id);
          return (
            <li key={id}>
              <button type="button" onClick={() => onOpenProject?.(id)}>
                <span className="sys">{project.no}</span>
                <b>{project.ko}</b>
                <i aria-hidden="true">↗</i>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function About({ onGoMain, onOpenProject }) {
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('map');
  const [visited, setVisited] = useState(() => new Set());
  const chamber = useMemo(() => CHAMBERS.find((item) => item.id === selected) || null, [selected]);
  const motion = useIceSlab(phase, selected);

  const enter = useCallback((id) => {
    if (phase !== 'map') return;
    setSelected(id);
    setPhase('travel');
  }, [phase]);

  const leave = useCallback(() => {
    if (!chamber || phase === 'travel' || phase === 'impact') return;
    setPhase('return');
  }, [chamber, phase]);

  useEffect(() => {
    if (phase === 'travel') {
      // 캔버스의 하강(DESCEND)이 끝나는 순간 방의 전등이 켜진다
      const timer = window.setTimeout(() => setPhase('impact'), DESCEND * 1000);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'impact') {
      const timer = window.setTimeout(() => {
        setVisited((current) => {
          const next = new Set(current);
          if (selected) next.add(selected);
          return next;
        });
        setPhase('reveal');
      }, 460);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'return') {
      const timer = window.setTimeout(() => {
        setSelected(null);
        setPhase('map');
      }, 1120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase, selected]);

  useEffect(() => {
    if (!chamber) return undefined;
    // 방이 열려 있는 동안 Esc 는 '지도로'만 뜻한다.
    // App 도 window 에서 Esc 를 받아 MAIN 으로 보내므로, 캡처 단계에서 먼저 받고 거기서 멈춘다.
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      leave();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [chamber, leave]);

  const style = chamber ? {
    '--camera-x': `${CAMERA.x - chamber.room.x}vw`,
    '--camera-y': `${CAMERA.y - chamber.room.y}vh`,
    '--room-x': `${chamber.room.x}vw`,
    '--room-y': `${chamber.room.y}vh`,
  } : {};

  return (
    <section
      className={`screen about about--${phase}`}
      aria-label="About me"
      style={style}
      onClick={(event) => {
        if (phase === 'reveal' && !event.target.closest('.about-room')) leave();
      }}
    >
      <canvas ref={motion.canvasRef} className="about-constellation" aria-hidden="true" />

      <div className="about-world">

        {CHAMBERS.map((item) => (
          <button
            type="button"
            key={item.id}
            ref={(el) => { motion.nodeRefs.current[item.id] = el; }}
            className={`about-node about-node--${item.type} ${selected === item.id ? 'is-selected' : ''} ${visited.has(item.id) ? 'is-visited' : ''}`}
            style={{ left: `${item.map.x}vw`, top: `${item.map.y}vh` }}
            onDragStart={(event) => event.preventDefault()}
            onClick={() => enter(item.id)}
            // 이름표에 커서나 포커스가 머물면 그 균열이 밝아진다
            onPointerEnter={() => { motion.hoverRef.current = item.id; }}
            onPointerLeave={() => { if (motion.hoverRef.current === item.id) motion.hoverRef.current = null; }}
            onFocus={() => { motion.hoverRef.current = item.id; }}
            onBlur={() => { if (motion.hoverRef.current === item.id) motion.hoverRef.current = null; }}
            aria-label={`${item.label} 섹션으로 이동`}
          >
            <span className="about-node__index sys">{item.no}</span>
            <strong>{item.label}</strong>
            <i aria-hidden="true" />
            {visited.has(item.id) && <em className="about-node__visited sys" aria-hidden="true">OBSERVED</em>}
          </button>
        ))}

        {chamber && <span className="about-impact" aria-hidden="true"><i /><i /><i /></span>}

        {CHAMBERS.map((item) => (
          <article
            key={`${item.id}-room`}
            className={`about-room about-room--${item.type} ${selected === item.id ? 'is-active' : ''}`}
            style={{ left: `${item.room.x}vw`, top: `${item.room.y}vh` }}
            aria-hidden={selected !== item.id}
          >
            <div className="about-room__light" aria-hidden="true" />
            <ChamberVisual type={item.type} />
            <div className="about-room__content">
              <div className="about-room__main">
                <p className="about-room__eyebrow sys">
                  <ScrambleText text={item.eyebrow} play={phase === 'reveal' && selected === item.id} duration={620} />
                </p>
                {/* 줄이 아래에서 올라오는 기존 애니메이션은 그대로 두고, 글자만 섞였다 풀린다 */}
                <h2>
                  {item.title.split('\n').map((line, i) => (
                    <span key={line}>
                      <ScrambleText text={line} play={phase === 'reveal' && selected === item.id} duration={820} delay={120 + i * 90} />
                    </span>
                  ))}
                </h2>
                <p className="about-room__note">{item.note}</p>
                {item.skills ? (
                  <div className="about-skills">
                    {item.skills.map((group) => (
                      <section className="about-skill" key={group.label}>
                        <p className="about-skill__label sys"><span>{group.no}</span>{group.label}</p>
                        <ul>
                          {group.items.map((skill) => <li key={skill}>{skill}</li>)}
                        </ul>
                        <p className="about-skill__detail">{group.detail}</p>
                      </section>
                    ))}
                  </div>
                ) : (
                  <ul className="about-room__tags sys">
                    {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                )}
                <ProjectEvidence ids={item.projects} onOpenProject={onOpenProject} />
                <button type="button" className="about-room__return sys" onClick={leave}>← RETURN TO MAP</button>
              </div>
              {item.record && <ProfileRecord record={item.record} play={phase === 'reveal' && selected === item.id} />}
            </div>
          </article>
        ))}
      </div>

      <div className="about-map-intro">
        <p className="sys">ABOUT / DRY ICE SLAB 00</p>
        <p>다섯 개의 균열 아래에 제가 있습니다.<br />빛이 새는 틈을 골라 내려가 보세요.</p>
      </div>

      <div className="about-hud" aria-hidden="true">
        <span className="sys">CHAMBER {chamber?.no || '--'} / 05</span>
        <i />
        <span className="sys">OBSERVED {String(visited.size).padStart(2, '0')} / 05</span>
      </div>

      <button type="button" className="about-back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about-instruction sys">
        {phase === 'map' && 'SELECT A FISSURE · CLICK TO DESCEND'}
        {phase === 'travel' && `FOLLOWING ${chamber?.label} SIGNAL`}
        {phase === 'impact' && 'IMPACT · LIGHTING CHAMBER'}
        {phase === 'reveal' && 'ESC · RETURN TO MAP'}
        {phase === 'return' && 'ASCENDING TO OBSERVATION MAP'}
      </p>
    </section>
  );
}
