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

const pathBetween = (from, to) => {
  const bend = from.y + (to.y - from.y) * 0.46;
  const drift = from.x < to.x ? 12 : -12;
  return `M ${from.x} ${from.y} C ${from.x + drift} ${bend}, ${to.x - drift} ${bend + 18}, ${to.x} ${to.y}`;
};

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
  return (
    <div className="about-room-visual about-room-visual--identity" aria-hidden="true">
      <span>PHM</span>
      <i /><i /><i />
    </div>
  );
}

/**
 * 관찰 지도 — 어두운 관측실 한가운데 놓인 드라이아이스 결정 한 조각.
 *
 *   결정    CO₂ 고체의 실제 구조(면심입방)를 따른다. 격자점마다 O=C=O 분자가 네 방향 중 하나로 누워 있다
 *   키워드  정육면체의 꼭짓점 넷(정사면체 배치)에 박혀 있고, 가운데 빈자리에 ABOUT 이 선다
 *   승화    바깥 껍질의 분자는 천천히 떨어져 나갔다가 다시 붙는다. 떨어진 분자는 위로 떠오르다 흩어진다
 *   공간    위에서 내려오는 조명 한 줄기, 바닥의 빛 웅덩이와 격자, 그 위에 맺히는 결정의 그림자
 *   조작    결정만 천천히 돈다. 좌우로 끌면 결정이 돌고, 위아래로 끌면 내려다보는 각도가 바뀐다
 *   진입    방을 고르면 격자가 풀리며 분자가 흩어지고, 돌아오면 다시 응집한다
 *
 * 선은 캔버스에 그리고, 키워드만 DOM 버튼으로 남겨 읽기·포커스·클릭을 지킨다.
 * 매 프레임 React 상태를 바꾸지 않고 DOM 과 캔버스를 직접 만진다.
 */
const WORLD_OFFSET = { x: 80, y: 4 };   // 지도 화면일 때 .about-world 의 위치 (vw, vh)
const FOCAL = 6.5;                       // 원근 — 바닥이 멀어지는 느낌이 날 만큼만
const AUTO_SPIN = 0.07;                  // 결정의 자동 회전 (rad/s)
const REST_PITCH = -0.36;                // 기본으로 내려다보는 각도
const FLOOR = 2.3;                       // 바닥 높이 (격자 반변 = 1)
const LAMP = -4.6;                       // 조명 높이 — 화면 위쪽 바깥
const POOL = 2.2;                        // 바닥에 맺히는 빛 웅덩이 반지름
const MOLECULE = 0.13;                   // O=C=O 반 길이

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };

/* CO₂ 결정(Pa3)에서 분자는 네 개의 대각선 방향으로 나뉘어 눕는다 — 격자점의 짝홀로 방향이 정해진다 */
const AXES = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(unit);
const axisOf = ([x, y, z]) => {
  const m = [Math.abs(x) % 2, Math.abs(y) % 2, Math.abs(z) % 2];
  if (m[0] + m[1] + m[2] === 3) return AXES[0];
  return AXES[1 + m.indexOf(1)];
};

/* 키워드가 박힌 꼭짓점 — 서로 가장 멀리 떨어진 정사면체 배치라 어느 각도에서도 겹치지 않는다 */
const KEY_SITES = {
  observe: [-1, -1, 1],
  structure: [1, -1, -1],
  build: [1, 1, 1],
  detail: [-1, 1, -1],
};

/* 격자점 — 단위 정육면체 14개(꼭짓점 8 + 면 중심 6)와 그 바깥 껍질 24개.
   좌표는 반변 1 기준 정수이고, 면심입방이라 x+y+z 가 홀수인 자리만 쓴다 */
const SITES = (() => {
  const list = [];
  for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x + y + z) % 2 !== 1) continue;
        const twos = [x, y, z].filter((c) => Math.abs(c) === 2).length;
        if (twos > 1) continue;
        const p = [x, y, z];
        const key = Object.keys(KEY_SITES).find((id) => KEY_SITES[id].every((c, i) => c === p[i])) || null;
        const outer = twos === 1;
        list.push({
          p,
          key,
          outer,
          axis: axisOf(p),
          normal: outer ? p.map((c) => (Math.abs(c) === 2 ? Math.sign(c) : 0)) : unit(p),
          phase: Math.random() * Math.PI * 2,
          rate: 0.12 + Math.random() * 0.2,
          scatter: unit([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
          presence: 1,
          room: [0, 0, 0],
          scr: [0, 0, 0, 0],
        });
      }
    }
  }
  return list;
})();
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
/* 최근접 이웃(거리 √2)끼리는 옅은 결합선, 단위 정육면체의 모서리는 조금 더 또렷한 틀 */
const BONDS = [];
const EDGES = [];
SITES.forEach((a, i) => SITES.forEach((b, j) => {
  if (j <= i) return;
  const d = dist2(a.p, b.p);
  if (d === 2) BONDS.push([a, b]);
  const corner = (s) => s.p.every((c) => Math.abs(c) === 1);
  if (d === 4 && corner(a) && corner(b)) EDGES.push([a, b]);
}));

function useConstellation(phase) {
  const canvasRef = useRef(null);
  const nodeRefs = useRef({});
  const worldPos = useRef({});             // 키워드의 현재 위치 (world vw/vh) — 방으로 가는 경로의 출발점
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const view = useRef({ yaw: 0.5, pitch: REST_PITCH, vYaw: AUTO_SPIN, vPitch: 0, spread: 0, clock: 0 });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const running = phase === 'map' || phase === 'travel' || phase === 'return';

  useEffect(() => {
    if (!running) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = prefersReduced();
    const v = view.current;
    if (phaseRef.current === 'return') v.spread = 1;   // 흩어진 상태에서 다시 응집한다
    if (reduced) SITES.forEach((s) => { s.presence = s.outer && Math.sin(s.phase) > 0.3 ? 0 : 1; });
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const drift = [];                      // 결정에서 떨어져 나간 분자
    const motes = reduced ? [] : Array.from({ length: 26 }, () => ({
      p: [(Math.random() - 0.5) * 3.6, LAMP + 1 + Math.random() * (FLOOR - LAMP - 1), (Math.random() - 0.5) * 3.6],
      v: [(Math.random() - 0.5) * 0.04, -0.02 - Math.random() * 0.05, (Math.random() - 0.5) * 0.04],
      tw: Math.random() * Math.PI * 2,
    }));
    let W = 0; let H = 0; let dpr = 1;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onMove = (event) => {
      pointer.x = event.clientX / W - 0.5;
      pointer.y = event.clientY / H - 0.5;
      const d = drag.current;
      if (!d) return;
      const dx = event.clientX - d.x;
      const dy = event.clientY - d.y;
      d.x = event.clientX; d.y = event.clientY;
      if (Math.hypot(event.clientX - d.sx, event.clientY - d.sy) > 6) d.moved = true;
      const dt = Math.max(0.008, (event.timeStamp - d.t) / 1000);
      d.t = event.timeStamp;
      const k = 3.4 / Math.max(W, 1);
      v.yaw += dx * k;
      v.pitch = Math.max(-0.95, Math.min(-0.02, v.pitch - dy * k * 0.6));
      v.vYaw = (dx * k) / dt;
      v.vPitch = (-dy * k * 0.6) / dt;
    };
    const onUp = () => {
      if (!drag.current) return;
      suppressClick.current = drag.current.moved;
      drag.current = null;
      document.documentElement.classList.remove('is-dragging-map');
    };

    // 바깥 껍질의 분자가 떨어져 나가는 순간 — 방 좌표로 떼어내 위로 띄운다
    const emit = (site) => {
      const n = site.normal;
      const cyw = Math.cos(v.yaw); const syw = Math.sin(v.yaw);
      drift.push({
        p: [...site.room],
        v: [(n[0] * cyw + n[2] * syw) * 0.14, -0.16 - Math.random() * 0.1, (-n[0] * syw + n[2] * cyw) * 0.14],
        th: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.6,
        life: 0,
        max: 5 + Math.random() * 3,
      });
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ph = phaseRef.current;
      const cx = W * 0.5;
      const cy = H * 0.43;
      const U = Math.min(W * 0.3, H * 0.34) / 1.75;

      // 회전 — 끄는 동안은 손을 따르고, 놓으면 관성이 풀리며 자동 회전으로 돌아온다
      if (!drag.current) {
        const auto = reduced ? 0 : AUTO_SPIN;
        v.vYaw += (auto - v.vYaw) * (1 - Math.exp(-dt * 1.2));
        v.vPitch *= Math.exp(-dt * 3);
        v.yaw += v.vYaw * dt;
        v.pitch += v.vPitch * dt;
        v.pitch += (REST_PITCH - v.pitch) * (1 - Math.exp(-dt * 0.8));
        v.pitch = Math.max(-0.95, Math.min(-0.02, v.pitch));
      }
      if (!reduced && ph === 'map') v.clock += dt;
      pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
      pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
      const target = ph === 'travel' ? 1 : 0;
      v.spread = reduced ? target : v.spread + (target - v.spread) * (1 - Math.exp(-dt * (target ? 2.4 : 1.8)));
      const open = 1 + v.spread * v.spread * 0.6;   // 방으로 갈 때 격자가 풀린다
      const fade = 1 - v.spread;

      // 결정은 yaw 로 돌고, 방(바닥·조명)은 제자리 — 카메라만 커서를 따라 살짝 흔들린다
      const cyw = Math.cos(v.yaw); const syw = Math.sin(v.yaw);
      const camYaw = pointer.sx * 0.28;
      const ccy = Math.cos(camYaw); const scy = Math.sin(camYaw);
      const pitch = v.pitch + pointer.sy * 0.16;
      const cp = Math.cos(pitch); const sp = Math.sin(pitch);
      // 방 좌표 → 화면. out: [x, y, depth(0 뒤 ~ 1 앞), scale]
      const project = (p, out) => {
        const x1 = p[0] * ccy + p[2] * scy;
        const z1 = -p[0] * scy + p[2] * ccy;
        const y2 = p[1] * cp - z1 * sp;
        const z2 = p[1] * sp + z1 * cp;
        const s = FOCAL / Math.max(0.8, FOCAL - z2);
        out[0] = cx + x1 * U * s;
        out[1] = cy + y2 * U * s;
        out[2] = clamp01((z2 + 1.8) / 3.6);
        out[3] = s;
        return out;
      };
      // 조명이 결정을 바닥에 비춘 자리
      const tmp = [0, 0, 0];
      const shadow = (q, out) => {
        const t = (FLOOR - LAMP) / Math.max(0.3, q[1] - LAMP);
        tmp[0] = q[0] * t; tmp[1] = FLOOR; tmp[2] = q[2] * t;
        return project(tmp, out);
      };
      // 조명 원뿔 안에 있을수록 1
      const lit = (p) => {
        const reach = 0.35 + (POOL - 0.35) * clamp01((p[1] - LAMP) / (FLOOR - LAMP));
        return 1 - smooth(0.55, 1.05, Math.hypot(p[0], p[2]) / reach);
      };
      const a = [0, 0, 0, 0];
      const b = [0, 0, 0, 0];

      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';

      // 1. 바닥 격자 — 빛 웅덩이 근처만 보이고 멀어질수록 어둠에 묻힌다
      const GRID = 0.6; const EXT = 4.8; const STEPS = 24;
      ctx.lineWidth = 1;
      for (let k = -8; k <= 8; k++) {
        const c = k * GRID;
        for (let dir = 0; dir < 2; dir++) {
          for (let i = 0; i <= STEPS; i++) {
            const t = -EXT + (i / STEPS) * EXT * 2;
            const px = dir ? t : c; const pz = dir ? c : t;
            tmp[0] = px; tmp[1] = FLOOR; tmp[2] = pz;
            project(tmp, b);
            if (i > 0) {
              const tm = t - EXT / STEPS;   // 조각 가운데
              const r = dir ? Math.hypot(tm, pz) : Math.hypot(px, tm);
              const alpha = (0.06 * (1 - smooth(1.4, EXT, r)) + 0.12 * (1 - smooth(0.3, POOL * 1.15, r))) * fade;
              if (alpha > 0.003) {
                ctx.strokeStyle = `rgba(175, 194, 200, ${alpha})`;
                ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
              }
            }
            a[0] = b[0]; a[1] = b[1];
          }
        }
      }

      // 2. 빛 웅덩이
      project([0, FLOOR, 0], a);
      const pcx = a[0]; const pcy = a[1];
      project([POOL * 1.3, FLOOR, 0], b);
      const rx = Math.max(1, Math.hypot(b[0] - pcx, b[1] - pcy));
      project([0, FLOOR, POOL * 1.3], b);
      const ry = Math.max(1, Math.abs(b[1] - pcy));
      ctx.save();
      ctx.translate(pcx, pcy); ctx.scale(1, ry / rx);
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      pool.addColorStop(0, `rgba(196, 220, 228, ${0.1 * fade})`);
      pool.addColorStop(0.5, `rgba(196, 220, 228, ${0.04 * fade})`);
      pool.addColorStop(1, 'rgba(196, 220, 228, 0)');
      ctx.fillStyle = pool;
      ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // 3. 조명 원뿔 — 화면 위 바깥의 조명에서 웅덩이로 떨어지는 빛. 겹쳐 그려 가장자리를 부드럽게
      project([0, LAMP, 0], a);
      [1, 0.72, 0.44].forEach((w) => {
        const cone = ctx.createLinearGradient(0, a[1], 0, pcy);
        cone.addColorStop(0, 'rgba(196, 220, 228, 0)');
        cone.addColorStop(1, `rgba(196, 220, 228, ${0.016 * fade})`);
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(a[0] - U * 0.3 * w, a[1]);
        ctx.lineTo(a[0] + U * 0.3 * w, a[1]);
        ctx.lineTo(pcx + rx * 0.78 * w, pcy);
        ctx.ellipse(pcx, pcy, rx * 0.78 * w, ry * 0.78 * w, 0, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
      });

      // 4. 격자점 위치 — 열에 떨리고, 바깥 껍질은 떨어져 나갔다 다시 붙는다
      SITES.forEach((site) => {
        if (site.outer && !reduced) {
          const pres = 1 - smooth(0.2, 0.85, Math.sin(v.clock * site.rate + site.phase));
          if (pres < 0.5 && site.presence >= 0.5 && ph === 'map') emit(site);
          site.presence = pres;
        }
        const j = reduced ? 0 : 0.014;
        const away = site.outer ? (1 - site.presence) * 0.4 : 0;
        const x = site.p[0] * open + site.scatter[0] * v.spread * 1.6 + site.normal[0] * away + Math.sin(v.clock * 3.1 + site.phase) * j;
        const y = site.p[1] * open + site.scatter[1] * v.spread * 1.6 + site.normal[1] * away + Math.sin(v.clock * 2.7 + site.phase * 1.3) * j;
        const z = site.p[2] * open + site.scatter[2] * v.spread * 1.6 + site.normal[2] * away + Math.sin(v.clock * 3.4 + site.phase * 0.7) * j;
        site.room[0] = x * cyw + z * syw;
        site.room[1] = y;
        site.room[2] = -x * syw + z * cyw;
        project(site.room, site.scr);
      });

      // 5. 바닥의 그림자 — 빛 웅덩이 안에서만 보인다. 넓고 옅게 한 번, 좁고 짙게 한 번
      ctx.save();
      ctx.beginPath(); ctx.ellipse(pcx, pcy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      [[6, 0.1], [1.2, 0.28]].forEach(([width, alpha]) => {
        ctx.lineWidth = width;
        ctx.strokeStyle = `rgba(2, 4, 6, ${alpha * fade})`;
        ctx.beginPath();
        EDGES.forEach(([p, q]) => {
          shadow(p.room, a); ctx.moveTo(a[0], a[1]);
          shadow(q.room, b); ctx.lineTo(b[0], b[1]);
        });
        ctx.stroke();
      });
      ctx.restore();

      // 6. 떨어져 나간 분자와 빛 속 먼지 — 조명 원뿔 안에서만 보인다
      for (let i = drift.length - 1; i >= 0; i--) {
        const m = drift[i];
        m.life += dt;
        if (m.life > m.max) { drift.splice(i, 1); continue; }
        m.v[1] -= 0.02 * dt;
        m.p[0] += m.v[0] * dt; m.p[1] += m.v[1] * dt; m.p[2] += m.v[2] * dt;
        m.th += m.spin * dt;
        const life = smooth(0, 0.4, m.life) * (1 - smooth(m.max * 0.45, m.max, m.life));
        const alpha = life * (0.18 + 0.7 * lit(m.p)) * fade;
        project(m.p, a);
        const len = MOLECULE * 0.8 * U * a[3];
        const ex = Math.cos(m.th) * len; const ey = Math.sin(m.th) * len * 0.55;
        ctx.strokeStyle = `rgba(200, 222, 228, ${alpha * 0.7})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(a[0] - ex, a[1] - ey); ctx.lineTo(a[0] + ex, a[1] + ey); ctx.stroke();
        ctx.fillStyle = `rgba(222, 240, 244, ${alpha})`;
        ctx.beginPath(); ctx.arc(a[0], a[1], 1.2, 0, Math.PI * 2); ctx.fill();
      }
      motes.forEach((m) => {
        m.p[0] += m.v[0] * dt; m.p[1] += m.v[1] * dt; m.p[2] += m.v[2] * dt;
        if (m.p[1] < LAMP + 1) m.p[1] = FLOOR - 0.1;
        if (Math.abs(m.p[0]) > 2.4) m.v[0] *= -1;
        if (Math.abs(m.p[2]) > 2.4) m.v[2] *= -1;
        m.tw += dt * 0.8;
        const alpha = lit(m.p) * (0.12 + 0.18 * Math.sin(m.tw) ** 2) * fade;
        if (alpha < 0.01) return;
        project(m.p, a);
        ctx.fillStyle = `rgba(214, 234, 240, ${alpha})`;
        ctx.beginPath(); ctx.arc(a[0], a[1], 0.5 + 0.7 * a[2], 0, Math.PI * 2); ctx.fill();
      });

      // 7. 결정 — 틀, 결합선, 분자 순. 위에서 빛을 받아 윗면이 조금 더 밝다
      const shade = (site) => 0.78 + 0.22 * clamp01((1 - site.room[1]) / 2);
      EDGES.forEach(([p, q]) => {
        const depth = (p.scr[2] + q.scr[2]) / 2;
        const front = depth * depth;
        ctx.strokeStyle = `rgba(200, 222, 228, ${(0.1 + 0.42 * front) * shade(p) * fade})`;
        ctx.lineWidth = 0.6 + 1.1 * front;
        ctx.beginPath(); ctx.moveTo(p.scr[0], p.scr[1]); ctx.lineTo(q.scr[0], q.scr[1]); ctx.stroke();
      });
      BONDS.forEach(([p, q]) => {
        const pres = Math.min(p.presence, q.presence);
        if (pres < 0.02) return;
        const depth = (p.scr[2] + q.scr[2]) / 2;
        ctx.strokeStyle = `rgba(200, 222, 228, ${(0.02 + 0.12 * depth * depth) * pres * fade})`;
        ctx.lineWidth = 0.5 + 0.4 * depth;
        ctx.beginPath(); ctx.moveTo(p.scr[0], p.scr[1]); ctx.lineTo(q.scr[0], q.scr[1]); ctx.stroke();
      });
      const order = [...SITES].sort((p, q) => p.scr[2] - q.scr[2]);
      order.forEach((site) => {
        if (site.presence < 0.02) return;
        const depth = site.scr[2];
        const alpha = (0.22 + 0.78 * depth) * site.presence * shade(site) * fade;
        const ax = site.axis;
        const rx0 = ax[0] * cyw + ax[2] * syw; const rz0 = -ax[0] * syw + ax[2] * cyw;
        const len = MOLECULE * (site.key ? 1.25 : 1);
        tmp[0] = site.room[0] + rx0 * len; tmp[1] = site.room[1] + ax[1] * len; tmp[2] = site.room[2] + rz0 * len;
        project(tmp, a);
        tmp[0] = site.room[0] - rx0 * len; tmp[1] = site.room[1] - ax[1] * len; tmp[2] = site.room[2] - rz0 * len;
        project(tmp, b);
        const rgb = site.key ? '157, 222, 215' : '200, 222, 228';
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.8})`;
        ctx.lineWidth = 0.7 + 0.9 * depth;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        const ro = (0.9 + 1.1 * depth) * site.scr[3];
        ctx.beginPath(); ctx.arc(a[0], a[1], ro, 0, Math.PI * 2); ctx.arc(b[0], b[1], ro, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${site.key ? '214, 250, 244' : '226, 242, 246'}, ${alpha})`;
        ctx.beginPath(); ctx.arc(site.scr[0], site.scr[1], (1.2 + 1.3 * depth) * site.scr[3], 0, Math.PI * 2); ctx.fill();
        if (site.key) {
          ctx.strokeStyle = `rgba(157, 222, 215, ${(0.12 + 0.4 * depth) * fade})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(site.scr[0], site.scr[1], 8 + 4 * depth, 0, Math.PI * 2); ctx.stroke();
        }
      });

      // 가운데 빈자리 — ABOUT 이 서는 조준점
      ctx.strokeStyle = `rgba(175, 194, 200, ${0.22 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy);
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
      ctx.stroke();

      // 키워드 버튼 — 지도에서만 따라 움직인다. 방으로 가는 동안엔 고른 자리에 멈춰 있어야 경로가 맞는다
      if (ph !== 'map') return;
      SITES.forEach((site) => {
        if (!site.key) return;
        const el = nodeRefs.current[site.key];
        const item = CHAMBERS.find((c) => c.id === site.key);
        if (!el || !item) return;
        const depth = site.scr[2];
        const wx = (site.scr[0] / W) * 100 + WORLD_OFFSET.x;
        const wy = (site.scr[1] / H) * 100 + WORLD_OFFSET.y;
        worldPos.current[item.id] = { x: wx, y: wy };
        el.style.translate = `${(((wx - item.map.x) * W) / 100).toFixed(1)}px ${(((wy - item.map.y) * H) / 100).toFixed(1)}px`;
        el.style.setProperty('--depth', depth.toFixed(3));
        el.style.zIndex = String(3 + Math.round(depth * 10));
        el.toggleAttribute('data-behind', depth < 0.3);
      });
      // 가운데 키워드는 격자 중심에 고정 — 화면 가운데 조준점과 맞춘다
      const core = nodeRefs.current.hyomin;
      const coreItem = CHAMBERS.find((c) => c.id === 'hyomin');
      if (core && coreItem) {
        const wx = (cx / W) * 100 + WORLD_OFFSET.x;
        const wy = (cy / H) * 100 + WORLD_OFFSET.y;
        core.style.translate = `${(((wx - coreItem.map.x) * W) / 100).toFixed(1)}px ${(((wy - coreItem.map.y) * H) / 100).toFixed(1)}px`;
        worldPos.current.hyomin = { x: wx, y: wy };
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', resize);
      drag.current = null;
      document.documentElement.classList.remove('is-dragging-map');
    };
  }, [running]);

  const startDrag = useCallback((event) => {
    if (phaseRef.current !== 'map' || event.button > 0) return;
    drag.current = { sx: event.clientX, sy: event.clientY, x: event.clientX, y: event.clientY, t: event.timeStamp, moved: false };
    suppressClick.current = false;
    view.current.vYaw = 0;
    view.current.vPitch = 0;
    document.documentElement.classList.add('is-dragging-map');
  }, []);

  // 끌고 난 뒤의 클릭은 방 이동으로 치지 않는다
  const consumeDragClick = useCallback(() => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  }, []);
  const isDragging = useCallback(() => Boolean(drag.current?.moved), []);

  return { canvasRef, nodeRefs, worldPos, startDrag, consumeDragClick, isDragging };
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
  const motion = useConstellation(phase);
  // 별자리가 돌고 있어서 키워드의 자리가 매번 다르다 — 누른 순간의 자리에서 경로가 출발한다
  const [origin, setOrigin] = useState(null);

  const enter = useCallback((id) => {
    if (phase !== 'map') return;
    const item = CHAMBERS.find((c) => c.id === id);
    setOrigin(motion.worldPos.current[id] || item?.map || null);
    setSelected(id);
    setPhase('travel');
  }, [motion.worldPos, phase]);

  const leave = useCallback(() => {
    if (!chamber || phase === 'travel' || phase === 'impact') return;
    setPhase('return');
  }, [chamber, phase]);

  useEffect(() => {
    if (phase === 'travel') {
      const timer = window.setTimeout(() => setPhase('impact'), 1380);
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

  const from = origin || chamber?.map;
  const style = chamber ? {
    '--camera-x': `${CAMERA.x - chamber.room.x}vw`,
    '--camera-y': `${CAMERA.y - chamber.room.y}vh`,
    '--probe-x': `${from.x}vw`,
    '--probe-y': `${from.y}vh`,
    '--probe-dx': `${chamber.room.x - from.x}vw`,
    '--probe-dy': `${chamber.room.y - from.y}vh`,
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
      // 지도 어디를 잡아도 별자리가 돈다
      onPointerDown={motion.startDrag}
      // 별자리를 돌리는 손가락이 App 의 'ABOUT 에서 아래로 끌면 MAIN' 제스처로 새지 않게
      onTouchMove={(event) => { if (motion.isDragging()) event.stopPropagation(); }}
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
            onClick={() => { if (!motion.consumeDragClick()) enter(item.id); }}
            aria-label={`${item.label} 섹션으로 이동`}
          >
            <span className="about-node__index sys">{item.no}</span>
            <strong>{item.label}</strong>
            <i aria-hidden="true" />
            {visited.has(item.id) && <em className="about-node__visited sys" aria-hidden="true">OBSERVED</em>}
          </button>
        ))}

        {chamber && (
          <>
            <svg className="about-route" viewBox="0 0 260 310" preserveAspectRatio="none" aria-hidden="true">
              <path d={pathBetween(from, chamber.room)} pathLength="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="about-probe" aria-hidden="true" />
            <span className="about-impact" aria-hidden="true"><i /><i /><i /></span>
          </>
        )}

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
          </article>
        ))}
      </div>

      <div className="about-map-intro">
        <p className="sys">ABOUT / OBSERVATION MAP</p>
        <p>하나의 결정을 이루는 다섯 개의 분자.<br />빛 아래에서 하나를 골라 주세요.</p>
      </div>

      <div className="about-hud" aria-hidden="true">
        <span className="sys">CHAMBER {chamber?.no || '--'} / 05</span>
        <i />
        <span className="sys">OBSERVED {String(visited.size).padStart(2, '0')} / 05</span>
      </div>

      <button type="button" className="about-back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about-instruction sys">
        {phase === 'map' && 'DRAG TO ROTATE · CLICK TO DESCEND'}
        {phase === 'travel' && `FOLLOWING ${chamber?.label} SIGNAL`}
        {phase === 'impact' && 'IMPACT · LIGHTING CHAMBER'}
        {phase === 'reveal' && 'ESC · RETURN TO MAP'}
        {phase === 'return' && 'ASCENDING TO OBSERVATION MAP'}
      </p>
    </section>
  );
}
