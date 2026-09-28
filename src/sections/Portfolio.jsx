import { useCallback, useEffect, useRef, useState } from 'react';
import { SPECIMENS, byId } from '../data/specimens';
import StateReadout from '../components/StateReadout';
import ProjectDetail from './ProjectDetail';
import WorkScroll from './WorkScroll';
import { createListPrism } from '../lib/listPrismScene';
import './portfolio.css';

/* LIST 프리즘의 네 면 — 목록 순서와 같다.
   화면 자료가 없는 프로젝트는 표지(card)로 둔다. 화면이 생기면 { kind: 'image', src } 로 바꾸면 된다. */
const PRISM_FACES = {
  odit: { kind: 'image', src: '/cases/odit-preview.jpg' }, // odit-web 홈·이야기 상세·연결 화면 캡처
  tchaikim: { kind: 'video', src: '/cases/tchaikim-scroll.webm', poster: '/cases/tchaikim-scroll-poster.jpg' },
  nuri: { kind: 'card', card: { title: '문화누리카드', meta: '03 / UX/UI / 2025', note: 'CASE STUDY IN PREPARATION' } },
  walga: { kind: 'image', src: '/cases/walga/boards/01-cover.webp' },
};

const hashId = () => {
  const m = window.location.hash.match(/^#\/project\/([\w-]+)$/);
  return m && byId(m[1]) ? m[1] : null;
};

/**
 * PORTFOLIO — SCROLL / LIST
 *
 * SCROLL 은 이름이 끝없이 흘러가고 가운데 창에 화면이 비친다(WorkScroll).
 * LIST 는 장식적 보조 화면이 아니라 모든 프로젝트 정보에 도달하는 완전한 대체 경로다.
 */
export default function Portfolio() {
  const [mode, setMode] = useState('field');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState(hashId);
  const hud = { state: 'SOLID', temp: 'LOW', tempValue: 0 };
  const returnTarget = useRef(selected);
  const currentState=useRef({selected,activeIndex});currentState.current={selected,activeIndex};

  const sectionRef = useRef(null);
  const listSceneRef = useRef(null);
  const prismHostRef = useRef(null);
  const prismRef = useRef(null);
  const [zooming, setZooming] = useState(null);
  const wheelLock = useRef(0);

  const visibleSpecimens = SPECIMENS;
  const activeSpec = visibleSpecimens[activeIndex] || visibleSpecimens[0];

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (!returnTarget.current) return;
      sectionRef.current?.querySelector(`[data-project="${returnTarget.current}"]`)?.focus({ preventScroll: true });
    });
  }, []);

  const select = useCallback((id) => {
    if (id) {
      returnTarget.current = id;
      setActiveIndex(SPECIMENS.findIndex(s => s.id === id));
    }
    setSelected(id);
    if (!id) restoreFocus();
    const target = id ? `#/project/${id}` : '#/portfolio';
    if (window.location.hash !== target) {
      window.history.pushState(null, '', target);
    }
  }, [restoreFocus]);

  // Warm the case image while the field itself prepares its four textured meshes.
  useEffect(() => {
    const image = new Image();
    image.src = '/cases/tchaikim-home.jpg';
  }, []);

  // 뒤로가기로 상세를 닫을 수 있어야 한다
  useEffect(() => {
    const onPop = () => {
      const id = hashId();
      setSelected(id);
      if (id) {
        returnTarget.current = id;
        setActiveIndex(SPECIMENS.findIndex(s => s.id === id));
      } else restoreFocus();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [restoreFocus]);

  const moveActive = useCallback((direction) => {
    setActiveIndex((current) => Math.max(0, Math.min(visibleSpecimens.length - 1, current + direction)));
  }, [visibleSpecimens.length]);

  const handleWheel = useCallback((event) => {
    if (mode !== 'list' || selected || Math.abs(event.deltaY) < 12) return;
    const now = performance.now();
    if (now - wheelLock.current < 360) return;
    wheelLock.current = now;
    moveActive(event.deltaY > 0 ? 1 : -1);
  }, [mode, moveActive, selected]);

  const handleListPointerMove = useCallback((event) => {
    if (mode !== 'list') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    prismRef.current?.setPointer(
      (event.clientX - bounds.left) / bounds.width - 0.5,
      (event.clientY - bounds.top) / bounds.height - 0.5,
    );
  }, [mode]);

  const resetListPointer = useCallback(() => prismRef.current?.setPointer(0, 0), []);

  // LIST 프리즘 — 모드에 들어올 때 만들고 나갈 때 버린다
  useEffect(() => {
    if (mode !== 'list' || !prismHostRef.current) return undefined;
    const prism = createListPrism(prismHostRef.current, SPECIMENS.map((s) => ({ id: s.id, ...PRISM_FACES[s.id] })));
    prismRef.current = prism;
    const state = currentState.current;
    prism.setActive(state.activeIndex);
    return () => {
      prism.dispose();
      prismRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    prismRef.current?.setActive(activeIndex);
  }, [activeIndex]);

  // 상세가 열려 있는 동안은 멈추고, 닫히면 화면을 채웠던 면에서 뒤로 물러난다
  useEffect(() => {
    const prism = prismRef.current;
    if (!prism) return;
    prism.setPaused(Boolean(selected));
    if (!selected) {
      setZooming(null);
      prism.zoomOut();
    }
  }, [selected, mode]);

  const openFromList = useCallback((id) => {
    const prism = prismRef.current;
    if (!prism || zooming) {
      if (!zooming) select(id);
      return;
    }
    const index = SPECIMENS.findIndex((s) => s.id === id);
    setActiveIndex(index);
    setZooming(id);
    prism.zoomIn(index).then(() => select(id));
  }, [select, zooming]);

  useEffect(() => {
    const handleKey = (event) => {
      if (selected || mode !== 'list') return;
      if (event.target.closest('button, a, input, textarea, select')) return;
      if (['ArrowDown', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        moveActive(1);
      }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        moveActive(-1);
      }
      if (event.key === 'Enter' && activeSpec) {
        event.preventDefault();
        openFromList(activeSpec.id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSpec, mode, moveActive, openFromList, selected]);

  return (
    <section ref={sectionRef} className={`screen portfolio ${selected ? 'is-open' : ''}`}>
      <div
        className={`portfolio__stage portfolio__stage--${mode}`}
        inert={selected ? '' : undefined}
        aria-hidden={selected ? true : undefined}
        onWheel={handleWheel}
        onPointerMove={handleListPointerMove}
        onPointerLeave={resetListPointer}
      >
        {mode === 'field' ? (
          <WorkScroll
            specs={visibleSpecimens}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onOpen={select}
            paused={Boolean(selected)}
          />
        ) : (
          <div
            ref={listSceneRef}
            className={`plist-scene plist-scene--${activeSpec.id} ${zooming ? 'is-zooming' : ''}`}
            style={{ '--active-index': activeIndex }}
          >
            <div ref={prismHostRef} className="plist-prism" aria-hidden="true" />
            <p className="plist-caption sys" aria-hidden="true" key={activeSpec.id}>
              <span>{activeSpec.no} / {String(SPECIMENS.length).padStart(2, '0')}</span>
              <span>{activeSpec.role}</span>
            </p>

            <ul className="plist">
              {visibleSpecimens.map((s, index) => (
                <li key={s.id}>
                  <button
                    type="button"
                    data-project={s.id}
                    className={`plist__row ${index === activeIndex ? 'is-active' : ''} ${selected === s.id ? 'is-selected' : ''}`}
                    onMouseEnter={() => { if (!zooming) setActiveIndex(index); }}
                    onFocus={() => { if (!zooming) setActiveIndex(index); }}
                    onClick={() => openFromList(s.id)}
                  >
                    <span className="plist__no sys">{s.no}</span>
                    <span className="plist__name">{s.ko}</span>
                    <span className="plist__meta sys">{s.tag} / {s.year}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <header className="portfolio__head">
          <span className="sys sys--lit">PROJECTS</span>
          <span className="sys">/ {String(SPECIMENS.length).padStart(2, '0')}</span>
          <p className="portfolio__hint">
            스크롤로 프로젝트를 탐색하고 선택하세요
          </p>
        </header>

        <StateReadout
          side="left"
          state={selected ? 'SELECTED' : hud.state}
          temp={hud.temp}
          level={hud.tempValue}
        />

        {/* 두 모드는 동일한 프로젝트와 선택 상태를 공유한다 */}
        <div className={`viewtoggle ${mode === 'list' ? 'is-list' : 'is-field'}`} role="group" aria-label="보기 방식">
          <button type="button" className={mode === 'field' ? 'is-on' : ''} onClick={() => setMode('field')}>
            SCROLL
          </button>
          <button type="button" className={mode === 'list' ? 'is-on' : ''} onClick={() => setMode('list')}>
            LIST
          </button>
        </div>

        <div className="portfolio__rail" aria-hidden="true">
          {visibleSpecimens.map((spec, index) => (
            <span key={spec.id} className={index === activeIndex ? 'is-active' : ''} />
          ))}
        </div>

        <div className="portfolio__active" aria-live="polite">
          <span className="sys">ACTIVE SPECIMEN</span>
          <b>{activeSpec?.no}</b>
        </div>
      </div>

      <ProjectDetail
        spec={selected ? byId(selected) : null}
        onClose={() => select(null)}
        onSwitch={select}
      />
    </section>
  );
}
