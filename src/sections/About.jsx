import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { byId } from '../data/specimens';
import { prefersReduced } from '../lib/smooth';
import { createUnderSnow } from '../lib/aboutUnderScene';
import { createRoomFog, TRAIL, TRAIL_LIFE } from '../lib/roomFog';
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
 * 관찰 지도 — MAIN 의 눈밭 밑. 장면은 lib/aboutUnderScene 이 그리고, 여기서는
 * 깊이 눈금(2D 오버레이), 키워드 덩어리를 덮는 버튼의 자리, 하강, 방 안 바닥 연기를 맡는다.
 *
 *   하강    키워드를 고르면 카메라가 단면을 따라 깊은 어둠까지 내려가고, 거기서 방의 전등이 켜진다.
 *           눈밭과 하늘이 위로 빠져나가고 오른쪽 깊이 눈금이 흘러 올라간다
 *   바닥    방 안 바닥엔 드라이아이스 기체가 낮게 깔려 흐른다. 마우스가 지나가면 밀려나며 피어오른다
 *   복귀    방에서 돌아오면 깊은 곳에서 다시 지표로 떠오른다
 */
const WORLD_OFFSET = { x: 80, y: 4 };   // 지도 화면일 때 .about-world 의 위치 (vw, vh)
const DESCEND = 1.6;                     // 내려가는 시간 (s) — travel 단계 길이
const ASCEND = 1.1;                      // 떠오르는 시간 (s) — return 단계 길이
const FOG_IN = 1.8;                      // 방에 닿은 뒤 바닥 연기가 차오르는 시간 (s)
const DEG_PER_PX = 1.5 / 160;            // 깊이 눈금 — 160px 내려갈 때마다 1.5°C 차가워진다
/* 키워드 자리 — [가로(지표 폭 대비), 지표에서의 깊이(화면 높이 대비)]
   넓은 화면: 다섯 단어가 지표선 위에 번호 순으로 한 줄로 서고, 아랫부분이 눈에 묻힌다.
              깊이는 글자 밑에서 새어 나오는 빛의 자리라 지표 바로 아래다.
   좁은 화면: 한 줄에 다 안 들어가서 눈 속 깊이별로 나눠 둔다(묻지 않고 다 보인다). */
const KEYS = {
  observe: { wide: [-0.9, 0.03], tall: [-0.7, 0.12] },
  structure: { wide: [-0.45, 0.03], tall: [0.62, 0.2] },
  hyomin: { wide: [0, 0.03], tall: [-0.05, 0.3] },
  build: { wide: [0.45, 0.03], tall: [0.55, 0.4] },
  detail: { wide: [0.9, 0.03], tall: [-0.6, 0.5] },
};
/* 넓은 화면인지 — aboutUnderScene 의 layoutKeys 와 같은 기준 */
const isWide = () => window.innerWidth >= window.innerHeight;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function useUnderSnow(phase, selected) {
  const hostRef = useRef(null);            // three 장면이 들어갈 자리
  const overlayRef = useRef(null);         // 깊이 눈금
  const fogRef = useRef(null);             // 방 안 바닥 연기
  const nodeRefs = useRef({});
  const hoverRef = useRef(null);           // 커서나 포커스가 머문 키워드
  const phaseRef = useRef(phase);
  const selectedRef = useRef(selected);
  phaseRef.current = phase;
  selectedRef.current = selected;

  useEffect(() => {
    const host = hostRef.current;
    const overlay = overlayRef.current;
    if (!host || !overlay) return undefined;
    const reduced = prefersReduced();
    let scene = null;
    try {
      scene = createUnderSnow(host, { keys: KEYS });
    } catch {
      scene = null; // WebGL 이 없으면 이름표만 기본 자리에 남는다
    }
    let fog = null;
    try {
      fog = !reduced && fogRef.current ? createRoomFog(fogRef.current) : null;
    } catch {
      fog = null; // 연기는 보조 효과다 — 실패해도 방은 그대로 열린다
    }
    const octx = overlay.getContext('2d');
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let stir = 0;                            // 커서가 움직인 만큼 쌓였다가 가라앉는다 — 연기의 세기
    const trail = [];                        // 방 안에서 마우스가 지나간 자리 — 바닥 연기가 그 자국을 따라 걷힌다
    let fogAmount = 0;
    let fogDrawn = false;
    const glow = Object.fromEntries(Object.keys(KEYS).map((id) => [id, 0.5]));
    let W = 0; let H = 0; let dpr = 1;
    let descent = 0;
    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      overlay.width = W * dpr; overlay.height = H * dpr;
    };
    resize();
    const onMove = (event) => {
      const nx = event.clientX / W - 0.5;
      const ny = event.clientY / H - 0.5;
      stir = Math.min(1, stir + Math.hypot(nx - pointer.x, ny - pointer.y) * 3);
      if (phaseRef.current === 'reveal') {
        const x = nx + 0.5; const y = 0.5 - ny;
        const prev = trail[trail.length - 1];
        if (!prev || Math.hypot(x - prev.x, y - prev.y) > 0.012) {
          trail.push({ x, y, born: performance.now() });
          if (trail.length > TRAIL) trail.shift();
        }
      }
      pointer.x = nx;
      pointer.y = ny;
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const ph = phaseRef.current;
      const sel = selectedRef.current;
      const hover = ph === 'map' ? hoverRef.current : null;
      pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
      pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));

      // 하강 진행도 — 방 안(impact·reveal)에서는 깊은 곳에 머문다
      if (ph === 'travel') descent += dt / DESCEND;
      else if (ph === 'map' || ph === 'return') descent -= dt / ASCEND;
      descent = reduced ? (ph === 'map' ? 0 : 1) : Math.max(0, Math.min(1, descent));
      const e = easeInOut(descent);

      stir *= Math.exp(-dt * 0.9);

      // 방 안 바닥 연기 — 방이 열리면 천천히 차오르고, 떠나면 빠르게 걷힌다
      if (fog) {
        const target = ph === 'reveal' ? 1 : 0;
        fogAmount += (target - fogAmount) * (1 - Math.exp(-dt * (target ? 3 / FOG_IN : 5)));
        if (fogAmount > 0.005) {
          const marks = trail
            .map((t) => ({ x: t.x, y: t.y, age: (now - t.born) / 1000 }))
            .filter((t) => t.age < TRAIL_LIFE);
          fog.draw({ time: clock, trail: marks, amount: fogAmount });
          fogDrawn = true;
        } else if (fogDrawn) {
          fog.clear();
          fogDrawn = false;
        }
      }

      const active = ph === 'map' || ph === 'travel' || ph === 'return';
      if (!active || !scene) return;

      Object.keys(KEYS).forEach((id) => {
        const chosen = sel === id && ph === 'travel';
        const others = sel && sel !== id && ph === 'travel';
        const pulse = reduced ? 0 : Math.sin(clock * 1.2 + id.length) * 0.05;
        const target = chosen ? 1.35 : others ? 0.15 : 0.5 + (hover === id ? 0.5 : 0) + pulse;
        glow[id] += (target - glow[id]) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
      });
      // 끝까지 내려가면 단면이 페이지 배경색으로 가라앉은 깊이에 닿는다 — 거기서 방의 전등이 켜진다
      const drop = e * H * 2.6;
      scene.render(dt, { glow, drop, look: { x: pointer.sx, y: pointer.sy }, mist: reduced ? 0 : 0.7 + 0.4 * stir });

      // 오버레이 — 깊이 눈금
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, W, H);
      octx.lineCap = 'round';

      // 깊이 눈금 — 오른쪽 가장자리. 지표가 −78.5°C, 내려갈수록 차가워진다
      const gx = W / 2 - (W < 700 ? 22 : 56);
      const top = scene.surfaceAt(gx);
      octx.font = '500 10px Archivo, sans-serif';
      octx.textAlign = 'right';
      octx.textBaseline = 'middle';
      for (let depth = 0; depth <= 5000; depth += 40) {
        const [sx, sy] = scene.toScreen(gx, top - depth);
        if (sy < -10 || sy > H + 10) continue;
        const major = depth % 160 === 0;
        octx.strokeStyle = `rgba(200, 226, 232, ${major ? 0.42 : 0.18})`;
        octx.lineWidth = 1;
        octx.beginPath(); octx.moveTo(sx - (major ? 14 : 7), sy); octx.lineTo(sx, sy); octx.stroke();
        // 지표(0) 라벨은 빼 둔다 — 같은 온도가 내비게이션에 있고, 지표선의 키워드와 겹친다
        if (major && depth > 0 && W >= 700) {
          octx.fillStyle = 'rgba(175, 194, 200, .5)';
          octx.fillText(`−${(78.5 + depth * DEG_PER_PX).toFixed(1)}°`, sx - 20, sy);
        }
      }
      {
        const [ax, ay] = scene.toScreen(gx, top);
        octx.strokeStyle = 'rgba(200, 226, 232, .22)';
        octx.beginPath(); octx.moveTo(ax, Math.max(0, ay)); octx.lineTo(ax, H); octx.stroke();
      }

      // 키워드 버튼 — 넓은 화면에선 지표선에 맞춘다(덩어리는 그 위, 이름표는 바로 아래).
      // 좁은 화면에선 눈 속 덩어리 자리에 둔다(about.css)
      const wide = isWide();
      // 넓은 화면 — 버튼 폭을 재서 다섯 덩어리 사이의 틈이 똑같도록 가로 자리를 정한다.
      // 가운데 정렬로 모으고, 틈은 너무 좁거나 넓지 않게 묶어 둔다
      if (wide) {
        const order = Object.keys(KEYS).sort((a, b) => KEYS[a].wide[0] - KEYS[b].wide[0]);
        const widths = order.map((id) => nodeRefs.current[id]?.offsetWidth || 0);
        const total = widths.reduce((sum, w) => sum + w, 0);
        const room = W - 2 * Math.max(W * 0.085, 110);   // 오른쪽 깊이 눈금 라벨과 겹치지 않게 양쪽을 같게 비운다
        const gap = Math.min(140, Math.max(20, (room - total) / (order.length - 1)));
        let cursor = (W - total - gap * (order.length - 1)) / 2;
        order.forEach((id, i) => {
          scene.placeKey(id, cursor + widths[i] / 2 - W / 2);
          cursor += widths[i] + gap;
        });
      }
      CHAMBERS.forEach((item) => {
        const k = scene.key(item.id);
        const el = nodeRefs.current[item.id];
        if (!k || !el) return;
        const [px, py] = wide ? scene.toScreen(k.x, scene.surfaceAt(k.x)) : scene.toScreen(k.x, k.y);
        const wx = (px / W) * 100 + WORLD_OFFSET.x;
        const wy = (py / H) * 100 + WORLD_OFFSET.y;
        el.style.translate = `${(((wx - item.map.x) * W) / 100).toFixed(1)}px ${(((wy - item.map.y) * H) / 100).toFixed(1)}px`;

        // 버튼이 덩어리를 덮도록 크기를 맞춘다
        const size = scene.blockSize(item.id);
        el.style.setProperty('--obj-w', `${size.w.toFixed(0)}px`);
        el.style.setProperty('--obj-h', `${size.h.toFixed(0)}px`);
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      scene?.dispose();
      fog?.dispose();
    };
  }, []);

  return { hostRef, overlayRef, fogRef, nodeRefs, hoverRef };
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

function ProfileRecord({ record }) {
  let index = 0;
  return (
    <section className="profile-record" aria-label="학력, 교육, 수상 이력">
      <div className="profile-record__row profile-record__row--now" style={{ '--i': index++ }}>
        <span className="profile-record__temp sys" aria-hidden="true">
          {tempLabel(SUBLIMATION_POINT)}
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
                  {tempAt(row.at)}
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
  const motion = useUnderSnow(phase, selected);

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
      <div ref={motion.hostRef} className="about-under" aria-hidden="true" />
      <canvas ref={motion.overlayRef} className="about-constellation" aria-hidden="true" />
      {/* 방 안 바닥 연기 — 방(.about-world)보다 먼저 두어 글자 뒤에 깔린다 */}
      <canvas ref={motion.fogRef} className="about-fog" aria-hidden="true" />

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
                <p className="about-room__eyebrow sys">{item.eyebrow}</p>
                {/* 줄마다 아래에서 올라온다 */}
                <h2>
                  {item.title.split('\n').map((line) => <span key={line}>{line}</span>)}
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
              {item.record && <ProfileRecord record={item.record} />}
            </div>
          </article>
        ))}
      </div>

      <div className="about-map-intro">
        <p className="sys">ABOUT / UNDER THE SNOW 00</p>
        <p>눈밭에 다섯 개의 이야기가 묻혀 있습니다.<br />하나를 골라 그 아래로 내려가 보세요.</p>
      </div>

      <div className="about-hud" aria-hidden="true">
        <span className="sys">CHAMBER {chamber?.no || '--'} / 05</span>
        <i />
        <span className="sys">OBSERVED {String(visited.size).padStart(2, '0')} / 05</span>
      </div>

      <button type="button" className="about-back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about-instruction sys">
        {phase === 'map' && 'HOVER TO UNEARTH · CLICK TO DESCEND'}
        {phase === 'travel' && `FOLLOWING ${chamber?.label} SIGNAL`}
        {phase === 'impact' && 'IMPACT · LIGHTING CHAMBER'}
        {phase === 'reveal' && 'ESC · RETURN TO MAP'}
        {phase === 'return' && 'ASCENDING TO OBSERVATION MAP'}
      </p>
    </section>
  );
}
