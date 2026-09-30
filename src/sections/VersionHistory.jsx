import { useCallback, useEffect, useRef, useState } from 'react';
import PanZoom from './PanZoom';
import './version-history.css';

/**
 * APPROACH — GitHub Pull Request.
 * TCHAIKIM Shop(혼자 디자인한 페이지)을 "구매자 기준으로 다시 정리한" PR 하나로 보여 준다.
 * 01 BACKGROUND 가 디자이너의 Figma 캔버스였다면, 여기는 만든 것을 고쳐 나간 기록(커밋)이다.
 *
 *   오른쪽 Commits  base(v1) → 커밋 4개 → HEAD(지금). 가리키면 그 커밋이 왼쪽 미리보기와 방 왼쪽 글에 뜬다
 *   미리보기        커밋마다 보여 주는 방식이 다르다
 *                   page    그 버전의 Shop 한 장을 천천히 훑는다
 *                   note    관찰 — 구매자가 되어 실제 쇼핑몰과 나란히 본 것, PR 코멘트처럼
 *                   order   before·after 페이지 지도를 나란히 — 옮긴 구역을 선으로 잇는다
 *                   compare 같은 자리의 상품 카드 before·after
 *   page·order 는 Figma 처럼 확대·이동(PanZoom). page 는 처음 한 번 천천히 끝까지 내려간 뒤 직접 스크롤.
 *   가만히 두면 base → HEAD 순서로 혼자 넘어가다가, 커밋을 고르거나 미리보기를 만지면 그 뒤로는 사람이 넘긴다.
 *
 * 구역 좌표는 Figma 원본 프레임(1920 폭) 기준 — before 67:1406, after 278:1096.
 */
const PAGE = {
  v1: { src: '/about/approach/shop-v1.webp', h: 10877 },
  v2: { src: '/about/approach/shop-v2.webp', h: 13111 },
};
const MAP = {
  v1: [
    ['hero', 'Hero', 0, 1247], ['intro', 'Intro', 1247, 1805], ['filter', 'Search · Filter', 1880, 2000],
    ['new', 'New', 2082, 3097], ['all', 'All', 3204, 5473], ['story', 'Garment Story', 5540, 6855],
    ['motif', 'Motif', 6855, 9858], ['footer', 'Footer', 9858, 10877],
  ],
  v2: [
    ['hero', 'Hero', 0, 1770], ['intro', 'Intro', 1770, 2490], ['story', 'Garment Story', 2490, 3990],
    ['new', 'New', 3990, 6200], ['filter', 'Search · Filter', 6200, 6430], ['all', 'All', 6525, 8820],
    ['motif', 'Motif', 9039, 12079], ['footer', 'Footer', 12079, 13111],
  ],
};

// 시간 순서(base → HEAD). 커밋 목록도 이 순서 — GitHub PR 의 Commits 탭처럼 위에서 아래로
export const VERSIONS = [
  {
    id: 'v1', tag: 'BASE', label: 'main — 첫 Shop 시안', view: { mode: 'page', page: 'v1' },
    title: '예쁘다고 본 대로 만든 첫 시안',
    text: '레퍼런스에서 예쁘다고 본 것들로 시작했습니다. 상품 목록이 먼저 나오고, 옷의 이야기는 목록을 다 본 뒤에야 나왔습니다.',
  },
  {
    id: 'observe', tag: 'OBSERVE', label: 'docs: 구매자가 되어 다시 보기', view: { mode: 'note' },
    title: '만든 사람이 아니라, 사는 사람의 눈으로',
    text: '실제 쇼핑몰들을 구매자처럼 둘러보고 제 Shop과 나란히 놓았습니다. 처음 보는 이름의 옷은 무엇인지부터 알아야 고를 수 있었고, 상품은 꾸밈보다 옷이 정확히 보이는 쪽이 비교하기 쉬웠습니다.',
  },
  {
    id: 'story', tag: 'STRUCTURE', label: 'refactor: Garment Story를 목록 앞으로', view: { mode: 'order', section: 'story' },
    title: '옷을 먼저 이해하고 고르게',
    text: '목록 뒤에 있던 Garment Story를 New 앞으로 올렸습니다. 이름이 낯선 옷을 이야기로 먼저 읽고, 그다음 상품으로 내려갑니다.',
  },
  {
    id: 'filter', tag: 'STRUCTURE', label: 'refactor: 검색 · 필터를 All 위로', view: { mode: 'order', section: 'filter' },
    title: '필터는 걸러지는 목록 바로 위에',
    text: 'New 위에 있던 검색과 필터를, 실제로 걸러지는 All 목록 바로 위로 옮겼습니다.',
  },
  {
    id: 'card', tag: 'REFINE', label: 'style: 상품 카드 — 각진 사진 · 가격 · 색상', view: { mode: 'compare' },
    title: '예쁜 카드보다, 사는 사람의 카드',
    text: '레퍼런스를 보고 모서리를 크게 둥글렸지만, 실제 쇼핑몰들을 보니 각진 이미지가 옷을 더 정확하게 보여 줬습니다. 예쁘다고 생각한 대로가 아니라 구매자라 생각하고 고쳤습니다. 가격과 색상을 카드에 올리고, New는 네 벌로 늘렸습니다.',
  },
  {
    id: 'v2', tag: 'HEAD', label: 'Merged — 지금의 Shop', view: { mode: 'page', page: 'v2' },
    title: '이해하고, 비교하고, 고르는 순서로',
    text: '옷 이야기 → New → 필터 → All. 처음 보는 옷도 이야기로 이해한 뒤 비교해서 고를 수 있는 흐름이 되었습니다.',
  },
];
const COMMITS = VERSIONS.filter((v) => v.tag !== 'BASE' && v.tag !== 'HEAD').length;

const STEP = 5600;          // 커밋 하나에 머무는 시간(ms) — 페이지(base·HEAD)는 끝까지 내려간 뒤 넘어간다
const PAGE_SCROLL = 11000;  // base·HEAD 페이지를 처음 한 번 끝까지 내려가는 시간(ms)
const PAGE_HOLD = 2600;     // 다 내려간 뒤 머무는 시간(ms)

// GitHub Octicons(MIT) — repo · git-merge · git-commit
const ICON = {
  repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
  merge: 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z',
  commit: 'M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z',
};
const Octicon = ({ name }) => <svg viewBox="0 0 16 16" aria-hidden="true"><path d={ICON[name]} /></svg>;

/* order — before·after 페이지 두 장을 한 캔버스에 나란히(디자인 좌표 그대로). Figma 처럼 확대·이동해 볼 수 있다.
   구역 표시·이름·잇는 선은 화면 좌표 레이어에 그려, 확대해도 굵기·글자 크기가 그대로다 */
const GAP = 2800;                        // 두 페이지 사이 — 구역 이름과 잇는 선이 지나갈 자리
const ORDER_W = 1920 * 2 + GAP;
const ORDER_H = PAGE.v2.h;
const PAGE_X = { v1: 0, v2: 1920 + GAP };

function OrderView({ section, onInteract }) {
  const world = (
    <>
      {['v1', 'v2'].map((page) => (
        <img
          key={page}
          className="vh-order__page"
          src={PAGE[page].src}
          alt={page === 'v1' ? '수정 전 Shop 전체' : '수정 후 Shop 전체'}
          draggable="false"
          style={{ left: PAGE_X[page], width: 1920, height: PAGE[page].h }}
        />
      ))}
    </>
  );
  const overlay = (v) => {
    const at = (page, top, bottom) => ({
      x: v.x + PAGE_X[page] * v.s,
      y: v.y + top * v.s,
      w: 1920 * v.s,
      h: Math.max(2, (bottom - top) * v.s),
    });
    const on = {};
    return (
      <div className="vh-order__overlay">
        {['v1', 'v2'].map((page) => {
          const head = at(page, 0, 0);
          return (
            <div key={page}>
              <p className={`vh-order__tag vh-order__tag--${page}`} style={{ left: head.x + head.w / 2, top: head.y - 8 }}>
                {page === 'v1' ? '− before' : '+ after'}
              </p>
              {MAP[page].map(([id, name, top, bottom]) => {
                const r = at(page, top, bottom);
                if (id === section) on[page] = r;
                return (
                  <div key={id}>
                    <span
                      className={`vh-zone vh-zone--${page} ${id === section ? 'is-on' : ''}`}
                      style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                    />
                    <i
                      className={`vh-zone__name vh-zone__name--${page} ${id === section ? 'is-on' : ''}`}
                      style={{ left: page === 'v1' ? r.x - 8 : r.x + r.w + 8, top: r.y + r.h / 2 }}
                    >
                      {name}
                    </i>
                  </div>
                );
              })}
            </div>
          );
        })}
        {on.v1 && on.v2 && (() => {
          const x1 = on.v1.x + on.v1.w; const y1 = on.v1.y + on.v1.h / 2;
          const x2 = on.v2.x; const y2 = on.v2.y + on.v2.h / 2;
          const mid = (x1 + x2) / 2;
          return (
            <svg className="vh-order__link" aria-hidden="true">
              <path d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`} />
            </svg>
          );
        })()}
      </div>
    );
  };
  return (
    <PanZoom
      width={ORDER_W}
      height={ORDER_H}
      world={world}
      overlay={overlay}
      onInteract={onInteract}
      label="수정 전·후 Shop 페이지 구조 비교 — 확대·이동 가능"
    />
  );
}

/* page — 그 버전의 Shop 한 장. 폭에 맞춰 두고, 처음 한 번 천천히 끝까지 내려간 뒤 사람이 직접 스크롤한다 */
function PageView({ page, onInteract, onAutoEnd }) {
  const { src, h } = PAGE[page];
  return (
    <div className="vh-file">
      <p className="vh-file__head">
        <b>shop.html</b>
        <span className={page === 'v1' ? 'is-base' : 'is-head'}>{page === 'v1' ? 'main · before' : 'HEAD · after'}</span>
      </p>
      <div className="vh-file__body">
        <PanZoom
          width={1920}
          height={h}
          fit="width"
          pad={0}
          auto={PAGE_SCROLL}
          onAutoEnd={onAutoEnd}
          onInteract={onInteract}
          world={<img className="vh-page__img" src={src} alt={page === 'v1' ? '수정 전 Shop 전체 화면' : '수정 후 Shop 전체 화면'} draggable="false" />}
          label="Shop 전체 화면 — 스크롤·확대 가능"
        />
      </div>
    </div>
  );
}

function Preview({ entry, onInteract, onAutoEnd }) {
  const { view } = entry;
  if (view.mode === 'page') return <PageView page={view.page} onInteract={onInteract} onAutoEnd={onAutoEnd} />;
  if (view.mode === 'note') {
    return (
      <div className="vh-note">
        <article className="vh-comment">
          <header><b className="vh-avatar">H</b><strong>Park Hyomin</strong> commented</header>
          <div className="vh-comment__body">
            <p className="vh-comment__title">실제 쇼핑몰과 나란히 놓고 본 것</p>
            <ul>
              <li><b>철릭 · 배자 · 거들</b> 처음 보는 이름 — 무슨 옷인지부터 알아야 고른다</li>
              <li><b>상품 카드</b> 둥근 모서리보다 각진 이미지가 옷을 정확히 보여 준다</li>
            </ul>
            <p className="vh-comment__todo">→ 옷을 이해하는 순서부터, 사는 사람의 눈으로 다시 정리하기</p>
          </div>
        </article>
      </div>
    );
  }
  if (view.mode === 'order') return <OrderView section={view.section} onInteract={onInteract} />;
  return (
    <div className="vh-compare">
      <figure>
        <img src="/about/approach/card-v1.webp" alt="before 상품 카드 — 둥근 모서리, 초록 포인트, 사진 위 아이콘" draggable="false" />
        <figcaption className="is-base">− 둥근 카드</figcaption>
      </figure>
      <span className="vh-compare__arrow" aria-hidden="true">→</span>
      <figure>
        <img src="/about/approach/card-v2.webp" alt="after 상품 카드 — 각진 사진, 가격, 색상 스와치, 태그" draggable="false" />
        <figcaption className="is-head">+ 각진 사진 · 가격 · 색상</figcaption>
      </figure>
    </div>
  );
}

export default function VersionHistory({ active, current, onSelect }) {
  const index = Math.max(0, VERSIONS.findIndex((v) => v.id === current));
  const entry = VERSIONS[index];
  const indexRef = useRef(index);
  indexRef.current = index;
  const [manual, setManual] = useState(false);   // 한 번이라도 직접 고르거나 만졌으면 혼자 넘기지 않는다
  const manualRef = useRef(manual);
  manualRef.current = manual;
  const holdRef = useRef(0);

  useEffect(() => { if (!active) setManual(false); }, [active]);

  const advance = useCallback(() => {
    onSelect(VERSIONS[(indexRef.current + 1) % VERSIONS.length].id);
  }, [onSelect]);

  // 커밋마다 머물다 다음으로. 페이지(base·HEAD)는 끝까지 내려간 뒤(onAutoEnd) 잠깐 머물고 넘어간다
  useEffect(() => {
    window.clearTimeout(holdRef.current);
    if (!active || manual || entry.view.mode === 'page') return undefined;
    const timer = window.setTimeout(advance, STEP);
    return () => window.clearTimeout(timer);
  }, [active, manual, entry.id, entry.view.mode, advance]);
  useEffect(() => () => window.clearTimeout(holdRef.current), []);

  const onAutoEnd = useCallback(() => {
    if (manualRef.current) return;
    window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => { if (!manualRef.current) advance(); }, PAGE_HOLD);
  }, [advance]);
  const onInteract = useCallback(() => { window.clearTimeout(holdRef.current); setManual(true); }, []);

  const choose = (id) => {
    onInteract();
    if (id !== current) onSelect(id);
  };

  return (
    <div className="about-room-visual about-room-visual--history">
      <div className="gh">
        <header className="gh__top">
          <Octicon name="repo" />
          <p className="gh__repo"><span>gysld261-png /</span> <b>tchaikimm</b></p>
          <span className="gh__nav">Pull requests</span>
        </header>

        <div className="gh__pr">
          <p className="gh__title">Shop: 구매 흐름 기준으로 다시 정리</p>
          <p className="gh__meta">
            <span className="gh__merged"><Octicon name="merge" /> Merged</span>
            <span><b>Park Hyomin</b> merged {COMMITS} commits into <code>main</code></span>
          </p>
          <nav className="gh__tabs" aria-hidden="true">
            <span>Conversation</span>
            <span className="is-on">Commits <em>{COMMITS}</em></span>
            <span>Files changed</span>
          </nav>
        </div>

        <div className="vh__stage" key={entry.id}>
          <Preview entry={entry} onInteract={onInteract} onAutoEnd={onAutoEnd} />
        </div>

        <aside className="vh__panel">
          <ol>
            {VERSIONS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`vh-entry vh-entry--${item.tag.toLowerCase()} ${item.id === entry.id ? 'is-current' : ''}`}
                  onPointerEnter={() => choose(item.id)}
                  onFocus={() => choose(item.id)}
                  onClick={() => choose(item.id)}
                  aria-pressed={item.id === entry.id}
                >
                  <i aria-hidden="true"><Octicon name={item.tag === 'HEAD' ? 'merge' : 'commit'} /></i>
                  <b>{item.label}</b>
                  <span><em>{item.tag}</em> Park Hyomin</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

/* 왼쪽 문장 아래 — 지금 고른 커밋 */
export function VersionReadout({ current, children }) {
  const index = Math.max(0, VERSIONS.findIndex((v) => v.id === current));
  const entry = VERSIONS[index];
  return (
    <div className="core-readout vh-readout" key={entry.id} aria-live="polite">
      <p className="core-readout__meta sys">
        {entry.tag}
        <span>{String(index + 1).padStart(2, '0')} / {String(VERSIONS.length).padStart(2, '0')}</span>
        <span>TCHAIKIM SHOP</span>
      </p>
      <b className="core-readout__name">{entry.title}</b>
      <p className="core-readout__hint">{entry.text}</p>
      {children}
    </div>
  );
}
