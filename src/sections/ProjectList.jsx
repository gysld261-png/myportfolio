import { useEffect, useRef, useState } from 'react';
import { getCase } from '../data/cases';
import './project-list.css';

const COPY = {
  walga: { title: '왈가왈봇', logo: '/cases/logos/walga-list.png', description: 'AI의 판단과 사람들의 투표를 나란히 비교하는 고민 판결 서비스.', role: 'PM · UX/UI · Frontend', type: 'TEAM PROJECT', image: '/cases/walga/boards/main.webp' },
  odit: { title: 'ODIT', logo: '/cases/logos/odit-list.png', description: '사건·인물·시대·장소를 연결하며 나만의 역사 탐색을 이어가는 앱.', role: 'UX/UI · App Design', type: 'PERSONAL PROJECT', image: '/cases/odit/main-v1.webp' },
  tchaikim: { title: 'TCHAIKIM', logo: '/cases/logos/tchaikim-list.png', description: '한복 브랜드의 영문 웹사이트 리디자인. Shop과 메인 핵심 섹션을 설계하고 구현했습니다.', role: 'UI Design · Frontend · Design System', type: 'TEAM PROJECT', image: '/cases/tchaikim/hero-mockup.webp' },
};

/** The DOM is the complete navigation; WebGL only supplies the spatial presentation. */
export default function ProjectList({ specs, activeIndex, onActiveChange, onOpen, paused }) {
  const host = useRef(null);
  const preview = useRef(null);
  const scene = useRef(null);
  const [displayedIndex, setDisplayedIndex] = useState(activeIndex);
  const [phase, setPhase] = useState('idle');
  const [connection, setConnection] = useState(null);
  const flowKey = useRef(0);
  const finishTimer = useRef(0);
  const current = useRef({ activeIndex: displayedIndex, requestedIndex: activeIndex, paused });
  current.current = { activeIndex: displayedIndex, requestedIndex: activeIndex, paused };
  const [renderState, setRenderState] = useState('loading');
  const spec = specs[displayedIndex] || specs[0];
  const copy = COPY[spec.id];
  const caseData = getCase(spec.id);

  useEffect(() => {
    let disposed = false;
    let instance;
    import('../lib/projectListScene').then(({ createProjectListScene }) => {
      if (disposed) return;
      try {
        instance = createProjectListScene(host.current, preview.current, specs.map(s => COPY[s.id].image), state => { if (!disposed) setRenderState(state); });
        scene.current = instance;
        instance.setActive(current.current.activeIndex);
        instance.setPaused(current.current.paused);
      } catch (error) {
        // Context creation can fail on devices without WebGL. Keep the real image and all controls.
        setRenderState('fallback');
        console.warn('Spatial project view unavailable:', error);
      }
    }).catch(() => { if (!disposed) setRenderState('fallback'); });
    return () => { disposed = true; instance?.dispose(); scene.current = null; };
  }, [specs]);

  // The connecting line leads; only swap the actual project when it reaches the next node.
  // Replacing the pending line and clearing its timer makes rapid clicks resolve to the latest request.
  useEffect(() => {
    const from = current.current.activeIndex;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => {
      clearTimeout(finishTimer.current);
      setDisplayedIndex(activeIndex); setPhase('idle'); setConnection(null);
    };
    if (from === activeIndex || motion.matches) { settle(); return undefined; }
    setConnection({ from, to: activeIndex, key: ++flowKey.current });
    setPhase('leaving');
    const onMotion = () => { if (motion.matches) settle(); };
    motion.addEventListener('change', onMotion);
    return () => { clearTimeout(finishTimer.current); motion.removeEventListener('change', onMotion); };
  }, [activeIndex]);
  useEffect(() => { scene.current?.setActive(displayedIndex); }, [displayedIndex]);
  useEffect(() => { scene.current?.setPaused(paused); }, [paused]);

  const finishConnection = () => {
    if (!connection || phase !== 'leaving' || connection.key !== flowKey.current ||
      connection.to !== current.current.requestedIndex || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setDisplayedIndex(connection.to);
    setPhase('arriving');
    finishTimer.current = setTimeout(() => { setPhase('idle'); setConnection(null); }, 1100);
  };

  const move = (direction) => onActiveChange((activeIndex + direction + specs.length) % specs.length);
  const keyboard = (event) => {
    if (paused || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = (activeIndex + (event.key === 'ArrowRight' ? 1 : -1) + specs.length) % specs.length;
      onActiveChange(next);
      host.current?.parentElement.querySelector(`[data-project="${specs[next].id}"]`)?.focus({ preventScroll: true });
    }
  };

  return (
    <div className={`project-list is-${renderState} project-list--${spec.id} is-${phase}`} onKeyDown={keyboard}
      onPointerMove={event => {
        if (event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        scene.current?.setPointer((event.clientX - rect.left) / rect.width - .5, (event.clientY - rect.top) / rect.height - .5);
      }} onPointerLeave={() => scene.current?.setPointer(0, 0)}>
      <div ref={host} className="project-list__space" aria-hidden="true" />
      <div className="project-list__layout">
        <div className="project-list__exhibit">
          <button ref={preview} type="button" className="project-list__preview" disabled={phase === 'leaving'}
            onClick={() => onOpen(spec.id)} aria-label={`${copy.title} 프로젝트 자세히 보기`} data-cursor="VIEW PROJECT">
            <img src={copy.image} alt={`${copy.title} 대표 화면`} decoding="async" />
          </button>
          <div className="project-list__coordinate" aria-hidden="true"><span>SELECTED WORK / {spec.no}</span><span>−78.5°C · SOLID</span></div>
        </div>

        <aside className="project-list__index" aria-label="프로젝트 미리보기" aria-busy={phase === 'leaving'}>
          <div className="project-list__information" key={spec.id} aria-live="polite" aria-atomic="true">
            <p className="project-list__eyebrow">OBSERVATION ARCHIVE · {copy.type}</p>
            <h2><span aria-hidden="true">{spec.no}</span><img className="project-list__logo" src={copy.logo} alt={copy.title} /></h2>
            <p className="project-list__description">{copy.description}</p>
            <div className="project-list__metadata"><span>{copy.role}</span><span>{caseData?.year || spec.year}</span></div>
          </div>

          <div className="project-list__thumbnails" role="group" aria-label="프로젝트 선택">
            {specs.map((item, index) => (
              <button key={item.id} type="button" data-project={item.id} aria-pressed={activeIndex === index}
                className={`project-list__thumbnail ${activeIndex === index ? 'is-active' : ''}`}
                onClick={() => onActiveChange(index)} aria-label={`${COPY[item.id].title} 미리보기`}>
                <span className="project-list__thumbnail-image"><img src={COPY[item.id].image} alt="" decoding="async" /></span>
                <span className="project-list__thumbnail-name"><span>{item.no}</span>{COPY[item.id].title}</span>
              </button>
            ))}
          </div>

          <div className="project-list__progress" aria-hidden="true">
            <div className="project-list__progress-heading"><span>WORK</span><span>{spec.no} / {String(specs.length).padStart(2, '0')}</span></div>
            <div className="project-list__line">
              <span className="project-list__line-fill" style={{ width: `${(displayedIndex + .5) / specs.length * 100}%` }} />
              {connection && <span key={connection.key} className="project-list__line-travel" onAnimationEnd={finishConnection} style={{
                left: `${(Math.min(connection.from, connection.to) + .5) / specs.length * 100}%`,
                width: `${Math.abs(connection.to - connection.from) / specs.length * 100}%`,
                transformOrigin: connection.to > connection.from ? 'left' : 'right',
              }} />}
              {specs.map((item, index) => <span key={item.id} className={`project-list__line-node ${displayedIndex === index ? 'is-active' : ''}`} style={{ left: `${(index + .5) / specs.length * 100}%` }} />)}
            </div>
          </div>

          <div className="project-list__controls">
            <div className="project-list__steps"><button type="button" aria-label="이전 프로젝트" onClick={() => move(-1)}>←</button><button type="button" aria-label="다음 프로젝트" onClick={() => move(1)}>→</button></div>
            <button type="button" className="project-list__view" disabled={phase === 'leaving'} onClick={() => onOpen(spec.id)}>VIEW PROJECT <span aria-hidden="true">↗</span></button>
          </div>
        </aside>
      </div>
      <div className="project-list__baseline" aria-hidden="true"><span>PORTFOLIO / SELECTED WORKS</span><span>CLICK TO EXPLORE</span></div>
    </div>
  );
}
