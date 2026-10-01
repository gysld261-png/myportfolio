import { useCallback, useEffect, useRef, useState } from 'react';
import { SPECIMENS, byId } from '../data/specimens';
import StateReadout from '../components/StateReadout';
import ProjectDetail from './ProjectDetail';
import WorkScroll from './WorkScroll';
import ProjectList from './ProjectList';
import './portfolio.css';

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
export default function Portfolio({ returnTo = null, onEndProgress = null, endControlRef = null, suspended = false }) {
  const [mode, setMode] = useState('field');
  /* 보기 전환 — 캡슐의 선택 칸이 먼저 넘어가고(pending), 지금 화면이 흐려지며 빠진 뒤 새 화면이 떠오른다 */
  const [pendingMode, setPendingMode] = useState(null);
  const [switched, setSwitched] = useState(false);
  const switchTimer = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState(hashId);
  // 얼음을 누른 순간부터 통과할 때까지, 상세 화면을 얼음 속에 미리 띄워 둔다(포털).
  const [portal, setPortal] = useState(null);
  const hud = { state: 'SOLID', temp: 'LOW', tempValue: 0 };
  const returnTarget = useRef(selected);
  const sectionRef = useRef(null);

  const visibleSpecimens = SPECIMENS;
  const activeSpec = visibleSpecimens[activeIndex] || visibleSpecimens[0];

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (!returnTarget.current) return;
      sectionRef.current?.querySelector(`[data-project="${returnTarget.current}"]`)?.focus({ preventScroll: true });
    });
  }, []);

  const select = useCallback((id) => {
    setPortal(null);
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

  const switchMode = useCallback((next) => {
    window.clearTimeout(switchTimer.current);
    if (next === mode) { setPendingMode(null); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMode(next);
      return;
    }
    setPendingMode(next);
    switchTimer.current = window.setTimeout(() => {
      setMode(next);
      setPendingMode(null);
      setSwitched(true);
    }, 340);
  }, [mode]);
  useEffect(() => () => window.clearTimeout(switchTimer.current), []);
  const shownMode = pendingMode ?? mode;

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

  return (
    <section ref={sectionRef} className={`screen portfolio ${selected ? 'is-open' : ''} ${portal && !selected ? 'is-portal' : ''}`}>
      <div
        className={`portfolio__stage portfolio__stage--${mode} ${pendingMode ? 'is_leaving' : ''} ${switched ? 'is_switched' : ''}`}
        inert={selected ? '' : undefined}
        aria-hidden={selected ? true : undefined}
      >
        {mode === 'field' ? (
          <WorkScroll
            specs={visibleSpecimens}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onOpen={select}
            onEnter={setPortal}
            paused={Boolean(selected) || suspended}
            onEndProgress={onEndProgress}
            endControlRef={endControlRef}
          />
        ) : (
          <ProjectList
            specs={visibleSpecimens}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onOpen={select}
            paused={Boolean(selected) || suspended}
          />
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
        <div className={`viewtoggle ui-segmented ${shownMode === 'list' ? 'is-list' : 'is-field'}`} role="group" aria-label="보기 방식">
          <button type="button" className={shownMode === 'field' ? 'is-on' : ''} aria-pressed={shownMode === 'field'} onClick={() => switchMode('field')}>
            SCROLL
          </button>
          <button type="button" className={shownMode === 'list' ? 'is-on' : ''} aria-pressed={shownMode === 'list'} onClick={() => switchMode('list')}>
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
        spec={selected ? byId(selected) : (portal ? byId(portal) : null)}
        portal={!selected && Boolean(portal)}
        onClose={returnTo?.onBack || (() => select(null))}
        onSwitch={select}
        returnTo={returnTo}
      />
    </section>
  );
}
