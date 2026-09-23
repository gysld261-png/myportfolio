import { useCallback, useEffect, useRef, useState } from 'react';
import { createField } from '../lib/field';
import { SPECIMENS, FIELD_LAYOUT, byId } from '../data/specimens';
import StateReadout from '../components/StateReadout';
import ProjectDetail from './ProjectDetail';
import './portfolio.css';

/* 깨지는 걸 보고, 그 틈으로 들어가고, 그 다음에 상세다. CSS 의 field-plunge 와 맞춰 둔다. */
const ENTRY_MS = 1180;

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
  const [hud, setHud] = useState({ state: 'SOLID', temp: 'LOW', tempValue: 0 });
  /* 깨진 얼음 안으로 밀고 들어가는 중 — { id, x, y } 는 깨진 지점이다 */
  const [entering, setEntering] = useState(null);
  const entryTimer = useRef(0);

  const sectionRef = useRef(null);
  const listSceneRef = useRef(null);
  const wheelLock = useRef(0);

  const visibleSpecimens = SPECIMENS;
  const visibleLayout = FIELD_LAYOUT;

  /* 선택해도 배치는 건드리지 않는다.
     표본이 제자리로 돌아왔다가 가운데로 날아오면, 깨진 것이 없던 일이 된다.
     깨진 자리 그대로 두고 화면이 그리로 들어간다. */
  const fieldLayout = visibleLayout;

  const activeSpec = visibleSpecimens[activeIndex] || visibleSpecimens[0];

  const select = useCallback((id) => {
    if (id) setMode('field');
    setSelected(id);
    // 상세가 열리면 레이아웃이 바뀌므로 섹션을 다시 뷰포트에 맞춘다
    if (id) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const target = id ? `#/project/${id}` : '#/portfolio';
    if (window.location.hash !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  /* 얼음이 깨지는 걸 다 보여준 다음에 상세를 연다.
     field 는 깨진 지점을 알려주고, 언제 넘어갈지는 여기서 정한다. */
  const beginEntry = useCallback((id, point) => {
    if (entryTimer.current) return;
    setEntering({ id, x: point?.x ?? 0, y: point?.y ?? 0 });
    entryTimer.current = window.setTimeout(() => {
      entryTimer.current = 0;
      select(id);
    }, ENTRY_MS);
  }, [select]);

  useEffect(() => () => { if (entryTimer.current) window.clearTimeout(entryTimer.current); }, []);

  // 뒤로가기로 상세를 닫을 수 있어야 한다
  useEffect(() => {
    const onPop = () => setSelected(hashId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* 닫고 나오면 깨졌던 덩어리가 다시 붙고 화면도 물러난다 */
  useEffect(() => {
    if (selected) return;
    if (entryTimer.current) { window.clearTimeout(entryTimer.current); entryTimer.current = 0; }
    setEntering(null);
    fieldRef.current?.resetBursts();
  }, [selected]);

  useEffect(() => {
    if (mode !== 'field') return undefined;
    const items = fieldLayout.map((l) => ({ ...l, spec: byId(l.id) }));
    const field = createField(canvasRef.current, {
      items,
      spatial: true,
      interactive: true,
      onState: setHud,
      onSelect: beginEntry,
    });
    fieldRef.current = field;
    return () => { field.destroy(); fieldRef.current = null; };
  }, [fieldLayout, mode, beginEntry]);

  useEffect(() => {
    if (mode === 'field') fieldRef.current?.setFocus(selected ? -1 : activeIndex);
  }, [activeIndex, mode, selected]);

  const moveActive = useCallback((direction) => {
    setActiveIndex((current) => Math.max(0, Math.min(visibleSpecimens.length - 1, current + direction)));
  }, [visibleSpecimens.length]);

  const handleWheel = useCallback((event) => {
    if (selected || entering || Math.abs(event.deltaY) < 12) return;
    const now = performance.now();
    if (now - wheelLock.current < 360) return;
    wheelLock.current = now;
    moveActive(event.deltaY > 0 ? 1 : -1);
  }, [entering, moveActive, selected]);

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
      if (selected || entering) return;
      if (['ArrowDown', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        moveActive(1);
      }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        moveActive(-1);
      }
      if (event.key === 'Enter' && activeSpec) select(activeSpec.id);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSpec, entering, moveActive, select, selected]);

  return (
    <section ref={sectionRef} className={`screen portfolio ${selected ? 'is-open' : ''}`}>
      <div
        className={`portfolio__stage portfolio__stage--${mode} ${entering ? 'is-entering' : ''}`}
        style={entering ? { '--zx': `${entering.x}px`, '--zy': `${entering.y}px` } : undefined}
        onWheel={handleWheel}
        onPointerMove={handleListPointerMove}
        onPointerLeave={resetListPointer}
      >
        {mode === 'field' ? (
          <>
            <canvas ref={canvasRef} className="field-canvas" />
            {/* hover 없이도 키보드로 같은 정보에 도달해야 한다 */}
            <ul className="portfolio__a11y">
              {fieldLayout.map((l, i) => {
                const s = byId(l.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onFocus={() => fieldRef.current?.setFocus(i)}
                      onBlur={() => fieldRef.current?.setFocus(-1)}
                      onClick={() => select(s.id)}
                    >
                      {s.no} {s.ko} — {s.role} {s.year}
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
                    className={`plist__row ${index === activeIndex ? 'is-active' : ''} ${selected === s.id ? 'is-selected' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => index === activeIndex ? select(s.id) : setActiveIndex(index)}
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
    </section>
  );
}
