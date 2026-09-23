import { useCallback, useEffect, useRef, useState } from 'react';
import { ENTRY } from '../lib/portfolioMotion';
import { SPECIMENS, FIELD_LAYOUT, byId } from '../data/specimens';
import StateReadout from '../components/StateReadout';
import ProjectDetail from './ProjectDetail';
import './portfolio.css';
const study=import.meta.env.DEV && new URLSearchParams(window.location.search).has('field-study');
const loadField=()=>import('../lib/portfolioScene');

const hashId = () => {
  const m = window.location.hash.match(/^#\/project\/([\w-]+)$/);
  return m && byId(m[1]) ? m[1] : null;
};

/**
 * PORTFOLIO — FIELD / LIST
 *
 * 2×2 카드 그리드를 쓰지 않는다. 화면 자체가 공간이고 그 안에 오브젝트가 놓인다.
 * LIST 는 장식적 보조 화면이 아니라 모든 프로젝트 정보에 도달하는 완전한 대체 경로다.
 */
export default function Portfolio() {
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const [mode, setMode] = useState('field');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState(hashId);
  const hud = { state: 'SOLID', temp: 'LOW', tempValue: 0 };
  const returnTarget = useRef(selected);
  const [reaction, setReaction] = useState(null);
  const reactionLock = useRef(false);
  const skipRef = useRef(null);
  const [studyTime,setStudyTime]=useState(0);
  const currentState=useRef({selected,reaction,activeIndex});currentState.current={selected,reaction,activeIndex};

  const sectionRef = useRef(null);
  const listSceneRef = useRef(null);
  const wheelLock = useRef(0);

  const visibleSpecimens = SPECIMENS;
  const visibleLayout = FIELD_LAYOUT;

  // Keep the specimens in place when returning from a project.
  const fieldLayout = visibleLayout;

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

  const clearReaction = useCallback(() => {
    reactionLock.current = false;
    setReaction(null);
  }, []);

  const cancelReaction = useCallback(() => {
    if(currentState.current.selected){fieldRef.current?.finish();return;}
    fieldRef.current?.cancelEntry();
    clearReaction();
    restoreFocus();
  }, [clearReaction, restoreFocus]);

  // Every specimen travels inside the same persistent 3D field.
  const beginEntry = useCallback((id) => {
    if (reactionLock.current || !byId(id)) return;
    returnTarget.current = id;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      select(id);
      return;
    }
    if (mode === 'field' && fieldRef.current?.startEntry(id)) {
      reactionLock.current = true;
      setReaction({ id });
      setStudyTime(0);
    } else {
      select(id);
    }
  }, [select, mode]);

  // Warm the case image while the field itself prepares its four textured meshes.
  useEffect(() => {
    const image = new Image();
    image.src = '/cases/tchaikim-home.jpg';
  }, []);

  // 뒤로가기로 상세를 닫을 수 있어야 한다
  useEffect(() => {
    const onPop = () => {
      fieldRef.current?.cancelEntry();
      clearReaction();
      const id = hashId();
      setSelected(id);
      if (id) {
        returnTarget.current = id;
        setActiveIndex(SPECIMENS.findIndex(s => s.id === id));
      } else restoreFocus();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [clearReaction, restoreFocus]);

  // Escape cancels an unfinished entry without triggering App's main shortcut.
  useEffect(() => {
    if (!reaction) return undefined;
    const nav=document.querySelector('.nav'),previousInert=nav?.inert;
    if(nav)nav.inert=true;
    const onKey = (event) => {
      if(event.key==='Tab') { event.preventDefault();skipRef.current?.focus({preventScroll:true});return; }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelReaction();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {window.removeEventListener('keydown', onKey, true);if(nav)nav.inert=previousInert;};
  }, [reaction, cancelReaction]);

  useEffect(() => {
    if (mode !== 'field') return undefined;
    const items = fieldLayout.map((l) => ({ ...l, spec: byId(l.id) }));
    let field,disposed=false;
    loadField().then(({createPortfolioScene})=>{
      if(disposed)return;
      field=createPortfolioScene(canvasRef.current, {
        items,
        onSelect: beginEntry,
        onCovered: select,
        onFinish: clearReaction,
        onUnavailable: id => { if(id)select(id);clearReaction(); },
        study,
      });
      fieldRef.current=field;
      sectionRef.current?.classList.remove('has-field-fallback');
      const state=currentState.current;
      field.setFocus(state.selected?-1:state.activeIndex);
      field.setPaused(Boolean(state.selected&&!state.reaction));
    }).catch(error=>{
      console.warn('3D field unavailable; retaining project navigation.',error);
      sectionRef.current?.classList.add('has-field-fallback');
    });
    return () => { disposed=true;field?.destroy();fieldRef.current=null; };
  }, [fieldLayout, mode, beginEntry, select, clearReaction]);

  useEffect(() => {
    if (mode === 'field') fieldRef.current?.setFocus(selected ? -1 : activeIndex);
  }, [activeIndex, mode, selected]);

  useEffect(() => {
    if(!selected&&!reaction)fieldRef.current?.reset();
    else fieldRef.current?.setPaused(Boolean(selected&&!reaction));
  }, [selected, reaction, mode]);

  const moveActive = useCallback((direction) => {
    setActiveIndex((current) => Math.max(0, Math.min(visibleSpecimens.length - 1, current + direction)));
  }, [visibleSpecimens.length]);

  const handleWheel = useCallback((event) => {
    if (selected || reactionLock.current || Math.abs(event.deltaY) < 12) return;
    const now = performance.now();
    if (now - wheelLock.current < 360) return;
    wheelLock.current = now;
    moveActive(event.deltaY > 0 ? 1 : -1);
  }, [moveActive, selected]);

  const handleListPointerMove = useCallback((event) => {
    if (mode !== 'list' || !listSceneRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    listSceneRef.current.style.setProperty('--slab-ry', `${x * 7}deg`);
    listSceneRef.current.style.setProperty('--slab-rx', `${y * -5}deg`);
    listSceneRef.current.style.setProperty('--slab-x', `${x * 16}px`);
    listSceneRef.current.style.setProperty('--slab-y', `${y * 12}px`);
  }, [mode]);

  const resetListPointer = useCallback(() => {
    if (!listSceneRef.current) return;
    listSceneRef.current.style.setProperty('--slab-ry', '0deg');
    listSceneRef.current.style.setProperty('--slab-rx', '0deg');
    listSceneRef.current.style.setProperty('--slab-x', '0px');
    listSceneRef.current.style.setProperty('--slab-y', '0px');
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (selected || reactionLock.current) return;
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
        beginEntry(activeSpec.id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSpec, moveActive, select, selected, mode, beginEntry]);

  return (
    <section ref={sectionRef} className={`screen portfolio ${selected ? 'is-open' : ''} ${reaction ? 'has-journey' : ''}`}>
      <div
        className={`portfolio__stage portfolio__stage--${mode} ${reaction ? 'is-reacting' : ''}`}
        inert={selected || reaction ? '' : undefined}
        aria-hidden={selected ? true : undefined}
        onWheel={handleWheel}
        onPointerMove={handleListPointerMove}
        onPointerLeave={resetListPointer}
      >
        {mode === 'field' ? (
          <>
            <canvas ref={canvasRef} className="field-canvas" aria-hidden="true" />
            {/* hover 없이도 키보드로 같은 정보에 도달해야 한다 */}
            <ul className="portfolio__specimens">
              {fieldLayout.map((l, i) => {
                const s = byId(l.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      data-project={s.id}
                      onFocus={() => fieldRef.current?.setFocus(i)}
                      onBlur={() => fieldRef.current?.setFocus(-1)}
                      onClick={() => beginEntry(s.id)}
                    >
                      <span className="specimen__number">{s.no}</span><span>{s.ko}</span><span className="specimen__arrow" aria-hidden="true">↗</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div
            ref={listSceneRef}
            className={`plist-scene plist-scene--${activeSpec.id}`}
            style={{ '--active-index': activeIndex }}
          >
            <div className="cryo-stage" aria-hidden="true">
              <div className="cryo-slab" key={activeSpec.id}>
                <div className="cryo-slab__depth" />
                <div className="cryo-slab__face">
                  <img src={activeSpec.image} alt="" />
                </div>
              </div>
              <div className="cryo-stage__caption">
                <span>{activeSpec.tag} SPECIMEN</span>
                <span>{activeSpec.role}</span>
              </div>
            </div>

            <ul className="plist">
              {visibleSpecimens.map((s, index) => (
                <li key={s.id}>
                  <button
                    type="button"
                    data-project={s.id}
                    className={`plist__row ${index === activeIndex ? 'is-active' : ''} ${selected === s.id ? 'is-selected' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => beginEntry(s.id)}
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
            {mode === 'field' ? '스크롤로 표본 사이를 이동하고, 가까이 가면 승화가 시작됩니다' : '스크롤로 프로젝트를 탐색하고 선택하세요'}
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
            FIELD
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
      {reaction && <div className="portfolio__journey">
        <span role="status" className="journey__status">{byId(reaction.id).ko} 프로젝트로 이동 중</span>
        <button ref={skipRef} className="journey__skip" type="button" onClick={()=>fieldRef.current?.finish()}>프로젝트 바로 보기</button>
      </div>}
      {study && reaction && <div className="field-study">
        <label>시간 <input aria-label="장면 시간" type="number" min="0" max={ENTRY.end} step=".1" value={studyTime} onChange={e=>{const t=Number(e.target.value)||0;setStudyTime(t);fieldRef.current?.seek(t);}}/></label>
        <button type="button" onClick={()=>fieldRef.current?.resume()}>재생</button>
      </div>}
    </section>
  );
}
