import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { byId } from '../data/specimens';
import { prefersReduced } from '../lib/smooth';
import { createUnderSnow } from '../lib/aboutUnderScene';
import { createRoomFog, TRAIL, TRAIL_LIFE } from '../lib/roomFog';
import FigmaBoard, { StripReadout } from './FigmaBoard';
import SkillsToolkit from './SkillsToolkit';
import VersionHistory, { VersionReadout } from './VersionHistory';
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
    eyebrow: 'BACKGROUND / WORKING FILE 01',
    title: '지나온 작업도\n다시 들여다봅니다',
    note: '좋은 평가를 받은 결과물이라도, 사용자에 대한 근거가 달라지면 다시 질문합니다. 시각디자인에서 UX/UI로, 다시 구현으로 이어 온 작업을 꺼내 들여다보며 지금의 기준을 만들었습니다.',
    /* Figma 화면의 Section — 하나가 한 시기. 여기는 최근 순으로 적고, 화면에는 뒤집어 오래된 것부터 위에서 아래로 놓는다.
       at     시작한 달 — 기록의 온도(00 ABOUT 이력과 같은 눈금)
       images 필름에 담긴 작업물 { src, label } — 왼쪽 기록에도 크게 뜨고, 누르면 확대된다
              thumb·focus 는 가로로 넓은 Figma 캔버스 칸 전용 — 따로 자른 이미지 / 채울 때 기준점(object-position)
       [초안] 문구·날짜는 확정 전이다. */
    strips: [
      {
        /* parent — 그 시기 안에서 한 일. 번호가 02-1 처럼 붙고, 레이어 패널에서 한 칸 들어간다 */
        id: 'team', parent: 'bootcamp', at: '2026.05', period: '2026.05 — 09', name: '팀 프로젝트',
        kept: '제 생각을 정답으로 두지 않고, 사용자의 행동을 근거로 문제를 정의하고 고칩니다. 왈가왈봇과 TCHAIKIM은 그 기준으로 기획부터 구현까지 맡은 프로젝트입니다.',
        images: [
          { src: '/cases/walga-screens.jpg', label: '왈가왈봇' },
          { src: '/cases/tchaikim-home.jpg', label: 'TCHAIKIM' },
        ],
        projects: ['walga', 'tchaikim'],
      },
      {
        id: 'bootcamp', at: '2026.04', period: '2026.04 — 10', name: 'AI활용 UI/UX 부트캠프',
        kept: '6개월 동안 HTML·CSS·JavaScript·React(TypeScript)와 Figma를 익혔습니다. 화면을 그리는 데서 멈추지 않고 직접 만들어 사용자가 실제로 어떻게 쓰는지 확인하게 되었고, 팀 프로젝트 TCHAIKIM으로 최우수상을 받았습니다.',
        images: [
          { src: '/cases/odit/main-v1.webp', label: 'ODIT · 개인 프로젝트' },
          { src: '/cases/odit-preview.jpg', label: 'ODIT · 주요 화면' },
        ],
        projects: ['odit'],
      },
      {
        id: 'major', at: '2022.03', period: '2022 — 2026.02', name: '시각디자인 전공',
        kept: '캐릭터 · 포스터 · 편집 · 브랜딩처럼 하나의 결과물을 완성하는 과목들 사이에서 UX/UI를 처음 만났습니다. 사용자의 시선과 행동을 기준으로 정보를 구조화하고 계속 고쳐 나간다는 점에 끌렸고, 편집 · 브랜딩 · UX/UI 작업으로 졸업전시 우수상을 받았습니다.',
        images: [
          { src: '/about/background/editorial.webp', thumb: '/about/background/editorial-row.webp', label: '편집 디자인' },
          { src: '/about/background/branding.webp', focus: '50% 8%', label: '브랜딩 디자인' },
        ],
      },
    ],
  },
  {
    id: 'structure', no: '02', label: 'SKILLS', type: 'skills',
    map: { x: 167, y: 29 }, room: { x: 207, y: 177 },
    eyebrow: 'SKILLS / TOOLKIT 02',
    title: '보기 쉽게,\n쓰는 재미까지.',
    note: '사용자 흐름을 꼼꼼히 살피고, 보기 쉽고 이해하기 편한 화면을 고민합니다.\n그 흐름에 어울리는 색과 인터랙션으로 저만의 재미를 더합니다.',
    projects: ['tchaikim', 'walga'],
    skills: [
      {
        no: '01', label: 'UX/UI DESIGN',
        items: [{ name: 'Figma', icon: 'figma', annotation: 'MCP 연동' }, { name: '프로토타이핑', icon: 'prototype' }],
        detail: '사용자 흐름을 살피고, 와이어프레임부터 화면과 프로토타입까지 연결합니다.',
        scope: 'Auto Layout · Variants',
      },
      {
        no: '02', label: 'FRONTEND',
        items: [{ name: 'HTML5', icon: 'html5' }, { name: 'JavaScript', icon: 'javascript' }, { name: 'TypeScript', icon: 'typescript' }, { name: 'React', icon: 'react' }],
        detail: '화면을 직접 구현하며 불편한 부분을 찾고, 사용에 필요한 동작과 인터랙션을 다듬습니다.',
      },
      {
        no: '03', label: 'VISUAL DESIGN',
        items: [{ name: 'Adobe Photoshop', icon: 'photoshop' }, { name: 'Adobe Illustrator', icon: 'illustrator' }, { name: 'Adobe InDesign', icon: 'indesign', level: '기초 활용' }],
        detail: '브랜딩의 색과 그래픽을 만들고, 사진 보정과 목업 작업으로 결과물을 구체화합니다.',
      },
      {
        no: '04', label: 'WORKFLOW',
        items: [{ name: 'GitHub', icon: 'github' }],
        detail: '팀원들과 디자인을 맞춰가고, 구현하면서 발견한 문제를 다시 화면에 반영합니다.',
        extra: 'Figma MCP와 AI 에이전트를 연결해 구현 작업에 활용하고, 결과를 직접 확인하며 다듬습니다.',
      },
    ],
  },
  {
    id: 'build', no: '03', label: 'APPROACH', type: 'build',
    map: { x: 171, y: 66 }, room: { x: 199, y: 263 },
    eyebrow: 'APPROACH / PROCESS 03',
    title: '예쁜 것보다,\n쓰는 사람 쪽으로',
    note: '패션도, 무언갈 판매하는 페이지도 처음이었습니다. 레퍼런스를 따라가기 바빴고, 제 눈에 예뻐 보이는 대로 Shop을 만들었습니다. 그런데 막상 적용해 보니, 보기엔 예뻐도 쇼핑몰로서는 어딘가 어색했습니다.\n\n그때부터 "이 페이지에 들어온 사람이 상품 상세까지 가고 싶을까, 옷을 사고 싶을까"를 기준으로 다시 고쳤습니다. 다들 쓰는 쇼핑몰 레이아웃에는 이유가 있었고, 쓰는 사람의 편리를 위해 내려놓아야 할 것도 있었습니다. 지금은 만들고 나면 사용자 입장에서 한 번 더 꼼꼼히 들여다봅니다.',
    projects: ['tchaikim'],
    tags: ['OBSERVE', 'STRUCTURE', 'BUILD', 'REFINE'],
    versions: true,   // 오른쪽 — TCHAIKIM Shop 을 고친 과정, GitHub PR 화면(VersionHistory.jsx)
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
const DESCEND = 2.2;                     // 내려가는 시간 (s) — 가속·착지의 무게는 유지하고 여유를 준다
const ASCEND = 1.7;                      // 지도 복귀 (s) — 땅이 위에서 내려와 자리 잡는 장면을 더 길게
const FOG_IN = 1.8;                      // 방에 닿은 뒤 바닥 연기가 차오르는 시간 (s)
const DEG_PER_PX = 1.5 / 160;            // 깊이 눈금 — 160px 내려갈 때마다 1.5°C 차가워진다
/* 키워드 자리 — [가로(지표 폭 대비), 지표에서의 깊이(화면 높이 대비)]
   넓은 화면: 00 ABOUT부터 번호 순으로 지표선 위에 한 줄로 서고, 아랫부분이 눈에 묻힌다.
              깊이는 글자 밑에서 새어 나오는 빛의 자리라 지표 바로 아래다.
   좁은 화면: 한 줄에 다 안 들어가서 눈 속 깊이별로 나눠 둔다(묻지 않고 다 보인다). */
const KEYS = {
  hyomin: { wide: [-0.9, 0.03], tall: [-0.7, 0.12] },
  observe: { wide: [-0.45, 0.03], tall: [0.62, 0.2] },
  structure: { wide: [0, 0.03], tall: [-0.05, 0.3] },
  build: { wide: [0.45, 0.03], tall: [0.55, 0.4] },
};
/* 넓은 화면인지 — aboutUnderScene 의 layoutKeys 와 같은 기준 */
const isWide = () => window.innerWidth >= window.innerHeight;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function useUnderSnow(phase, selected, visible) {
  const hostRef = useRef(null);            // three 장면이 들어갈 자리
  const overlayRef = useRef(null);         // 깊이 눈금
  const fogRef = useRef(null);             // 방 안 바닥 연기
  const nodeRefs = useRef({});
  const hoverRef = useRef(null);           // 커서나 포커스가 머문 키워드
  const phaseRef = useRef(phase);
  const selectedRef = useRef(selected);
  const visibleRef = useRef(visible);
  const controlRef = useRef(null);
  visibleRef.current = visible;
  phaseRef.current = phase;
  selectedRef.current = selected;

  useEffect(() => {
    const host = hostRef.current;
    const overlay = overlayRef.current;
    if (!host || !overlay) return undefined;
    const reduced = prefersReduced();
    let scene = null;
    try {
      // 가리키면 덩어리가 이 이름 모양의 얼음 글자로 바뀐다
      const labels = Object.fromEntries(CHAMBERS.map((item) => [item.id, item.label]));
      scene = createUnderSnow(host, { keys: KEYS, labels });
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
    // 방 주소(#/about/:id)로 바로 들어오면 이미 깊은 곳에 있다
    let descent = phaseRef.current === 'map' ? 0 : 1;
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let layoutDirty = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      overlay.width = W * dpr; overlay.height = H * dpr;
      layoutDirty = true;
    };
    resize();
    const onMove = (event) => {
      if (!visibleRef.current) return;
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
      raf = 0;
      if (visibleRef.current) raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const ph = visibleRef.current ? phaseRef.current : 'map';
      const sel = visibleRef.current ? selectedRef.current : null;
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
      octx.font = '500 10px "Pretendard Variable", sans-serif';
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
      // 넓은 화면 — 버튼 폭을 재서 덩어리 사이의 틈이 똑같도록 가로 자리를 정한다.
      // 가운데 정렬로 모으고, 틈은 너무 좁거나 넓지 않게 묶어 둔다
      if (wide && layoutDirty) {
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
      const updateSize = layoutDirty;
      layoutDirty = false;
      CHAMBERS.forEach((item) => {
        const k = scene.key(item.id);
        const el = nodeRefs.current[item.id];
        if (!k || !el) return;
        const [px, py] = wide ? scene.toScreen(k.x, scene.surfaceAt(k.x)) : scene.toScreen(k.x, k.y);
        const wx = (px / W) * 100 + WORLD_OFFSET.x;
        const wy = (py / H) * 100 + WORLD_OFFSET.y;
        el.style.translate = `${(((wx - item.map.x) * W) / 100).toFixed(1)}px ${(((wy - item.map.y) * H) / 100).toFixed(1)}px`;

        // 버튼이 덩어리를 덮도록 크기를 맞춘다
        if (updateSize) {
          const size = scene.blockSize(item.id);
          el.style.setProperty('--obj-w', `${size.w.toFixed(0)}px`);
          el.style.setProperty('--obj-h', `${size.h.toFixed(0)}px`);
        }
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('resize', resize);
    // 글꼴/화면 크기 변경 때만 폭을 잰다. 매 프레임 읽기·쓰기가 교차하는 강제 레이아웃을 피한다.
    const observer = new ResizeObserver(() => {
      layoutDirty = true;
      if (!raf) tick(performance.now());
    });
    Object.values(nodeRefs.current).forEach((node) => { if (node) observer.observe(node); });
    const resetView = (room) => {
      descent = room ? 1 : 0;
      hoverRef.current = null;
      pointer.x = 0; pointer.y = 0; pointer.sx = 0; pointer.sy = 0;
      trail.length = 0;
      fogAmount = 0;
      if (fogDrawn) fog?.clear();
      fogDrawn = false;
      layoutDirty = true;
    };
    controlRef.current = {
      resetView,
      sync: () => {
        cancelAnimationFrame(raf);
        raf = 0;
        last = performance.now();
        if (visibleRef.current) tick(last);
        else resetView(null);
      },
    };
    // 숨겨진 상태에서도 첫 장면을 한 번 그려 셰이더를 준비한 뒤 RAF를 쉰다.
    tick(last);
    return () => {
      cancelAnimationFrame(raf);
      controlRef.current = null;
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      scene?.dispose();
      fog?.dispose();
    };
  }, []);

  useLayoutEffect(() => { controlRef.current?.sync(); }, [visible]);

  return { hostRef, overlayRef, fogRef, nodeRefs, hoverRef, controlRef };
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

/* BACKGROUND 필름 스트립 — 오래된 것부터. 이력 기록과 같은 온도 눈금을 쓴다(오래될수록 차갑다) */
const STRIPS = (() => {
  const ordered = [...(CHAMBERS.find((item) => item.strips)?.strips || [])].reverse();
  const numbers = {};
  const children = {};
  let top = 0;
  return ordered.map((strip) => {
    let no;
    if (strip.parent && numbers[strip.parent]) {
      children[strip.parent] = (children[strip.parent] || 0) + 1;
      no = `${numbers[strip.parent]}-${children[strip.parent]}`;
    } else {
      top += 1;
      no = String(top).padStart(2, '0');
    }
    numbers[strip.id] = no;
    return { ...strip, no, temp: tempAt(strip.at) };
  });
})();

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

/* 주소의 #/about/:id — 프로젝트를 보고 뒤로 오거나 새로고침해도 그 방으로 돌아온다 */
const chamberFromHash = () => {
  const m = window.location.hash.match(/^#\/about\/([\w-]+)$/);
  return m && CHAMBERS.some((item) => item.id === m[1]) ? m[1] : null;
};
/* 방 사이를 옮겨 다니는 순서 — 번호 순 */
const ROOM_ORDER = [...CHAMBERS].sort((a, b) => a.no.localeCompare(b.no));
const ROOM_COUNT = String(ROOM_ORDER.length).padStart(2, '0');

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

function About({ active = true, entry = 0, onGoMain, onGoPortfolio, onOpenProject }) {
  const [selected, setSelected] = useState(chamberFromHash);
  const [phase, setPhase] = useState(() => (chamberFromHash() ? 'reveal' : 'map'));
  const [visited, setVisited] = useState(() => new Set(selected ? [selected] : []));
  const chamber = useMemo(() => CHAMBERS.find((item) => item.id === selected) || null, [selected]);
  const motion = useUnderSnow(phase, selected, active);
  // BACKGROUND Figma 화면 — 고른 Frame 의 시기(왼쪽 기록에 뜬다)
  const [strip, setStrip] = useState(null);
  // APPROACH Figma 버전 기록 — 고른 기록(왼쪽 글에도 뜬다)
  const [version, setVersion] = useState('v1');
  const [zoom, setZoom] = useState(null);   // 크게 보는 작업물 이미지 { src, label }
  const modalClose = useRef(null);          // 방 안에 열린 작은 창(Figma 공유 창)을 닫는 함수
  const onModal = useCallback((close) => { modalClose.current = close; }, []);
  const pendingRoute = useRef(undefined);

  // 캐시된 방은 재진입 주소에 맞춘다. 사용자 문구/방 구성은 바꾸지 않는다.
  useLayoutEffect(() => {
    if (!active) {
      setSelected(null);
      setPhase('map');
      setZoom(null);
      modalClose.current = null;
      return;
    }
    const room = chamberFromHash();
    pendingRoute.current = room;
    motion.controlRef.current?.resetView(room);
    setSelected(room);
    setPhase(room ? 'reveal' : 'map');
    setVisited(new Set(room ? [room] : []));
    setZoom(null);
    setStrip(null);
    setVersion('v1');
    modalClose.current = null;
  }, [active, entry]);

  const enter = useCallback((id) => {
    if (phase !== 'map') return;
    setSelected(id);
    setPhase('travel');
  }, [phase]);

  const leave = useCallback(() => {
    if (!chamber || phase === 'travel' || phase === 'impact') return;
    setPhase('return');
  }, [chamber, phase]);

  /* 방 안에서 다른 방으로 바로 옮긴다 — 지도로 떠올랐다 다시 내려가지 않고, 전등만 다시 켠다 */
  const switchTo = useCallback((id) => {
    if (phase !== 'reveal' || id === selected) return;
    setSelected(id);
    setPhase('impact');
  }, [phase, selected]);

  const roomIndex = ROOM_ORDER.findIndex((item) => item.id === selected);
  const nextRoom = ROOM_ORDER[(roomIndex + 1) % ROOM_ORDER.length];
  const prevRoom = ROOM_ORDER[(roomIndex - 1 + ROOM_ORDER.length) % ROOM_ORDER.length];

  // 지금 있는 방을 주소에 남긴다 — 프로젝트 상세에서 뒤로 가면 이 방으로 돌아온다
  useEffect(() => {
    if (!active || !window.location.hash.startsWith('#/about')) return;
    // 주소 동기화 layout effect가 반영되기 전 이전 방으로 주소를 덮지 않는다.
    if (pendingRoute.current !== undefined && selected !== pendingRoute.current) return;
    pendingRoute.current = undefined;
    const target = phase === 'reveal' && selected ? `#/about/${selected}` : phase === 'map' ? '#/about' : null;
    if (target && window.location.hash !== target) {
      window.history.replaceState(null, '', `${window.location.pathname}${target}`);
    }
  }, [active, phase, selected]);

  useEffect(() => {
    if (!active) return undefined;
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
      }, ASCEND * 1000 + 60); // 캔버스가 자리 잡은 뒤 지도 입력을 돌려준다
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [active, phase, selected]);

  useEffect(() => {
    if (!active || !chamber) return undefined;
    // 방이 열려 있는 동안 Esc 는 '지도로'만 뜻한다.
    // App 도 window 에서 Esc 를 받아 MAIN 으로 보내므로, 캡처 단계에서 먼저 받고 거기서 멈춘다.
    const onKeyDown = (event) => {
      // Contact 모달의 ESC/방향키는 뒤의 방을 조작하지 않는다.
      if (event.target instanceof Element && event.target.closest('.contact[open]')) return;
      // 작업물을 크게 보고 있으면 Esc 는 그것만 닫는다
      if (zoom) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          setZoom(null);
        }
        return;
      }
      // 공유 창이 열려 있으면 Esc 는 그 창만 닫고, 방향키로 방을 옮기지도 않는다
      if (modalClose.current) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          modalClose.current();
        }
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        switchTo(event.key === 'ArrowRight' ? nextRoom.id : prevRoom.id);
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      leave();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, chamber, leave, nextRoom, prevRoom, switchTo, zoom]);

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
      aria-hidden={!active}
      inert={!active ? '' : undefined}
      style={style}
      onClick={(event) => {
        if (phase === 'reveal' && !event.target.closest('.about-room, .about-rooms')) leave();
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
            {item.skills ? (
              <SkillsToolkit
                groups={item.skills}
                title={item.title}
                intro={item.note}
                active={active && selected === item.id && phase === 'reveal'}
              />
            ) : <>
            {item.strips ? (
              <FigmaBoard
                strips={STRIPS}
                active={active && selected === item.id && phase === 'reveal'}
                current={strip}
                onHover={setStrip}
                onZoom={setZoom}
                onModal={onModal}
              />
            ) : item.versions ? (
              <VersionHistory
                active={active && selected === item.id && phase === 'reveal'}
                current={version}
                onSelect={setVersion}
              />
            ) : <ChamberVisual type={item.type} />}
            <div className="about-room__content">
              <div className="about-room__main">
                <p className="about-room__eyebrow sys">{item.eyebrow}</p>
                {/* 줄마다 아래에서 올라온다 */}
                <h2>
                  {item.title.split('\n').map((line) => <span key={line}>{line}</span>)}
                </h2>
                <p className="about-room__note">{item.note}</p>
                {item.strips ? (
                  <StripReadout strips={STRIPS} current={strip} onZoom={setZoom}>
                    <ProjectEvidence
                      ids={STRIPS.find((entry) => entry.id === strip)?.projects}
                      onOpenProject={(project) => onOpenProject?.(project, { chamber: item.id, label: item.label })}
                    />
                  </StripReadout>
                ) : item.versions ? (
                  <VersionReadout current={version} />
                ) : (
                  <ul className="about-room__tags sys">
                    {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                )}
                <ProjectEvidence
                  ids={item.projects}
                  onOpenProject={(project) => onOpenProject?.(project, { chamber: item.id, label: item.label })}
                />
              </div>
              {item.record && <ProfileRecord record={item.record} />}
            </div>
            </>}
          </article>
        ))}
      </div>

      {zoom && (
        <div
          className="about-zoom"
          role="dialog"
          aria-modal="true"
          aria-label={`${zoom.label} 크게 보기`}
          onClick={(event) => { event.stopPropagation(); setZoom(null); }}
        >
          <img src={zoom.src} alt={zoom.label} draggable="false" />
          <p className="sys">{zoom.label} · CLICK OR ESC TO CLOSE</p>
        </div>
      )}

      <div className="about-map-intro">
        <p className="sys">ABOUT / UNDER THE SNOW 00</p>
        <p>눈밭에 네 개의 이야기가 묻혀 있습니다.<br />하나를 골라 그 아래로 내려가 보세요.</p>
      </div>

      <div className="about-hud" aria-hidden="true">
        <span className="sys">CHAMBER {chamber?.no || '--'} / {ROOM_COUNT}</span>
        <i />
        <span className="sys">OBSERVED {String(visited.size).padStart(2, '0')} / {ROOM_COUNT}</span>
      </div>

      {/* 방 안의 길잡이 — 지도로 돌아가기, 다른 방으로 바로 가기, 포트폴리오 */}
      <nav
        className={`about-rooms ${phase === 'reveal' || phase === 'impact' ? 'is-on' : ''}`}
        aria-label="ABOUT 방 이동"
        aria-hidden={phase !== 'reveal'}
        inert={phase !== 'reveal' ? '' : undefined}
      >
        <button type="button" className="about-rooms__map sys" onClick={leave}>
          <i aria-hidden="true">←</i> MAP
        </button>
        <ol>
          {ROOM_ORDER.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`sys ${selected === item.id ? 'is-current' : ''} ${visited.has(item.id) ? 'is-visited' : ''}`}
                aria-current={selected === item.id ? 'true' : undefined}
                aria-label={`${item.label} 방으로 이동`}
                onClick={() => switchTo(item.id)}
              >
                <span className="about-rooms__no">{item.no}</span>
                <span className="about-rooms__label">{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="about-rooms__next sys"
          onClick={onGoPortfolio}
          aria-label="포트폴리오 페이지로 이동"
        >
          <span className="about-rooms__label">PORTFOLIO</span> <i aria-hidden="true">→</i>
        </button>
      </nav>

      <button type="button" className="about-back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about-instruction sys">
        {phase === 'map' && 'HOVER TO UNEARTH · CLICK TO DESCEND'}
        {phase === 'travel' && `FOLLOWING ${chamber?.label} SIGNAL`}
        {phase === 'impact' && 'IMPACT · LIGHTING CHAMBER'}
        {phase === 'return' && 'ASCENDING TO OBSERVATION MAP'}
      </p>
    </section>
  );
}

export default memo(About);
