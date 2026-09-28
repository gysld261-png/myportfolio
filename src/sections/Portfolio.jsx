import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { SPECIMENS, FIELD_LAYOUT, byId } from '../data/specimens';
import StateReadout from '../components/StateReadout';
import ProjectDetail from './ProjectDetail';
import './portfolio.css';

const FIELD_MEDIA = {
  odit: { src: '/specimens/odit-cut.png', aspect: '1.168', width: '118%', left: '-9.7%', top: '-3.8%' },
  tchaikim: { src: '/specimens/tchaikim-cut.png', aspect: '0.332', width: '413.5%', left: '-150.3%', top: '-2%' },
  nuri: { src: '/specimens/nuri-cut.png', aspect: '1.298', width: '116.1%', left: '-7.9%', top: '-6.4%' },
  walga: { src: '/specimens/walga-cut.png', aspect: '1.473', width: '126%', left: '-12.7%', top: '-15.8%' },
};

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
  const fieldVisualsRef = useRef(null);
  const fieldRef = useRef(null);
  const [mode, setMode] = useState('field');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState(hashId);
  const hud = { state: 'SOLID', temp: 'LOW', tempValue: 0 };
  const returnTarget = useRef(selected);
  const currentState=useRef({selected,activeIndex});currentState.current={selected,activeIndex};

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

  useEffect(() => {
    if (mode !== 'field') return undefined;
    const host = fieldVisualsRef.current;
    if (!host) return undefined;
    const pointerHost = host.parentElement;
    const cards = [...host.querySelectorAll('.photo-specimen')];
    const transitionFog = pointerHost.querySelector('.portfolio__fog-transition');
    const transitionPuffs = transitionFog ? [...transitionFog.querySelectorAll('i')] : [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let transitioning = false;
    let paused = false;
    const context = gsap.context(() => {
      if (!reduced) {
        gsap.fromTo(cards,
          { opacity: 0, y: 28, scale: 0.92, filter: 'blur(12px)' },
          { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.05, stagger: 0.09, ease: 'expo.out' });
      }
    }, host);

    const setFocus = (index) => {
      cards.forEach((card, cardIndex) => {
        card.dataset.active = String(cardIndex === index);
        gsap.to(card, {
          scale: 1,
          opacity: index < 0 || cardIndex === index ? 1 : 0.74,
          duration: reduced ? 0 : 0.42,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      });
    };

    const choose = (id) => {
      const index = fieldLayout.findIndex((item) => item.id === id);
      if (index < 0 || transitioning || paused) return false;
      transitioning = true;
      setFocus(index);
      if (reduced || !transitionFog) {
        select(id);
        return true;
      }
      const stageBounds = pointerHost.getBoundingClientRect();
      const specimenBounds = cards[index].getBoundingClientRect();
      transitionFog.style.setProperty('--fog-x', `${specimenBounds.left + specimenBounds.width * 0.5 - stageBounds.left}px`);
      transitionFog.style.setProperty('--fog-y', `${specimenBounds.top + specimenBounds.height * 0.54 - stageBounds.top}px`);
      gsap.set(transitionFog, { opacity: 1, visibility: 'visible' });
      gsap.set(transitionPuffs, { opacity: 0, scale: 0.18, xPercent: -50, yPercent: -50 });
      const timeline = gsap.timeline();
      timeline.to(cards, {
        opacity: (cardIndex) => cardIndex === index ? 1 : 0.1,
        scale: (cardIndex) => cardIndex === index ? 1.13 : 0.94,
        filter: (cardIndex) => cardIndex === index ? 'blur(0px)' : 'blur(8px)',
        duration: 0.72,
        ease: 'power3.inOut',
        stagger: 0.025,
      }, 0);
      timeline.to(cards[index], { y: -18, duration: 0.82, ease: 'power3.inOut' }, 0);
      timeline.to(transitionPuffs, {
        opacity: (puffIndex) => 0.76 - puffIndex * 0.055,
        scale: (puffIndex) => 4.45 + puffIndex * 0.27,
        rotation: (puffIndex) => (puffIndex % 2 ? 1 : -1) * (12 + puffIndex * 7),
        duration: 0.98,
        stagger: 0.035,
        ease: 'power2.in',
      }, 0.08);
      timeline.call(() => select(id), null, 0.94);
      return true;
    };

    const move = (event) => {
      if (paused || reduced) return;
      const bounds = host.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      gsap.to(pointerHost, {
        '--field-light-x': `${50 + x * 9}%`,
        '--field-light-y': `${47 + y * 7}%`,
        duration: 1.15,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };
    const leave = () => {
      if (reduced) return;
      gsap.to(pointerHost, {
        '--field-light-x': '50%',
        '--field-light-y': '47%',
        duration: 1.3,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };

    pointerHost.addEventListener('pointermove', move);
    pointerHost.addEventListener('pointerleave', leave);
    const field = {
      select: choose,
      setFocus,
      setPaused(value) {
        paused = value;
        if (!value) {
          transitioning = false;
          gsap.set(transitionFog, { opacity: 0, visibility: 'hidden' });
          gsap.to(cards, { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: reduced ? 0 : 0.5, ease: 'power3.out' });
        }
      },
    };
    fieldRef.current = field;
    const state = currentState.current;
    field.setFocus(state.selected ? -1 : state.activeIndex);
    field.setPaused(Boolean(state.selected));

    return () => {
      pointerHost.removeEventListener('pointermove', move);
      pointerHost.removeEventListener('pointerleave', leave);
      context.revert();
      cards.forEach((card) => gsap.killTweensOf(card));
      gsap.killTweensOf(pointerHost);
      fieldRef.current = null;
    };
  }, [fieldLayout, mode, select]);

  useEffect(() => {
    if (mode === 'field') fieldRef.current?.setFocus(selected ? -1 : activeIndex);
  }, [activeIndex, mode, selected]);

  useEffect(() => {
    fieldRef.current?.setPaused(Boolean(selected));
  }, [selected, mode]);

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
      if (selected) return;
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
        if (!fieldRef.current?.select(activeSpec.id)) select(activeSpec.id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeSpec, moveActive, select, selected]);

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
            <ul ref={fieldVisualsRef} className="portfolio__specimens">
              {fieldLayout.map((l, i) => {
                const s = byId(l.id);
                const media = FIELD_MEDIA[s.id];
                return (
                  <li
                    key={s.id}
                    className={`photo-specimen-item photo-specimen-item--${s.id}`}
                    style={{ '--field-x': `${l.cx * 100}%`, '--field-y': `${l.cy * 100}%` }}
                  >
                    <button
                      type="button"
                      data-project={s.id}
                      className={`photo-specimen photo-specimen--${s.id}`}
                      onPointerEnter={() => fieldRef.current?.setFocus(i)}
                      onPointerLeave={() => fieldRef.current?.setFocus(activeIndex)}
                      onFocus={() => fieldRef.current?.setFocus(i)}
                      onBlur={() => fieldRef.current?.setFocus(-1)}
                      onClick={() => { if (!fieldRef.current?.select(s.id)) select(s.id); }}
                    >
                      <span
                        className="photo-specimen__visual"
                        aria-hidden="true"
                        style={{ '--media-aspect': media.aspect, '--media-width': media.width, '--media-left': media.left, '--media-top': media.top }}
                      >
                        <span className="photo-specimen__backdrop" />
                        <span className="photo-specimen__mist">
                          {[0, 1, 2, 3, 4, 5].map((mistIndex) => <i key={mistIndex} style={{ '--mist-index': mistIndex }} />)}
                        </span>
                        <img className="photo-specimen__frost" src={media.src} alt="" draggable="false" />
                        <img className="photo-specimen__image" src={media.src} alt="" draggable="false" />
                      </span>
                      <span className="photo-specimen__caption">
                        <span className="specimen__number">{s.no}</span><span>{s.ko}</span><span className="specimen__arrow" aria-hidden="true">↗</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
                    onClick={() => select(s.id)}
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

        <div className="portfolio__fog-transition" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((fogIndex) => <i key={fogIndex} />)}
        </div>

        <header className="portfolio__head">
          <span className="sys sys--lit">PROJECTS</span>
          <span className="sys">/ {String(SPECIMENS.length).padStart(2, '0')}</span>
          <p className="portfolio__hint">
            {mode === 'field' ? '표본을 선택하면 프로젝트 상세를 볼 수 있습니다' : '스크롤로 프로젝트를 탐색하고 선택하세요'}
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
