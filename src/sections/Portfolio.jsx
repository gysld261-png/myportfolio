import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createField } from '../lib/field';
import { SPECIMENS, FIELD_LAYOUT, byId } from '../data/specimens';
import StateReadout from '../components/StateReadout';
import ProjectDetail from './ProjectDetail';
import './portfolio.css';

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

  const sectionRef = useRef(null);
  const wheelLock = useRef(0);

  const visibleSpecimens = SPECIMENS;
  const visibleLayout = FIELD_LAYOUT;

  // 프로젝트 진입 순간에는 선택된 표본만 남긴 뒤, 전체 화면 상세로 전환한다.
  const fieldLayout = useMemo(() => {
    if (!selected) return visibleLayout;
    return visibleLayout
      .filter((layout) => layout.id === selected)
      .map((layout) => ({
        ...layout,
        cx: 0.36,
        cy: 0.53,
        z: 1,
        w: Math.max(layout.w * 1.3, layout.id === 'tchaikim' ? 0.175 : 0.18),
        ambient: true,
        detailFocus: true,
      }));
  }, [selected, visibleLayout]);

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

  // 뒤로가기로 상세를 닫을 수 있어야 한다
  useEffect(() => {
    const onPop = () => setSelected(hashId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (mode !== 'field') return undefined;
    const items = fieldLayout.map((l) => ({ ...l, spec: byId(l.id) }));
    const field = createField(canvasRef.current, {
      items,
      spatial: true,
      onState: setHud,
      onSelect: select,
    });
    fieldRef.current = field;
    return () => { field.destroy(); fieldRef.current = null; };
  }, [fieldLayout, mode, select]);

  useEffect(() => {
    if (mode === 'field') fieldRef.current?.setFocus(selected ? -1 : activeIndex);
  }, [activeIndex, mode, selected]);

  const moveActive = useCallback((direction) => {
    setActiveIndex((current) => Math.max(0, Math.min(visibleSpecimens.length - 1, current + direction)));
  }, [visibleSpecimens.length]);

  const handleWheel = useCallback((event) => {
    if (selected || Math.abs(event.deltaY) < 12) return;
    const now = performance.now();
    if (now - wheelLock.current < 360) return;
    wheelLock.current = now;
    moveActive(event.deltaY > 0 ? 1 : -1);
  }, [moveActive, selected]);

  useEffect(() => {
    const handleKey = (event) => {
      if (selected) return;
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
  }, [activeSpec, moveActive, select, selected]);

  return (
    <section ref={sectionRef} className={`screen portfolio ${selected ? 'is-open' : ''}`}>
      <div className="portfolio__stage" onWheel={handleWheel}>
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
          <ul className="plist" style={{ '--active-index': activeIndex }}>
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
