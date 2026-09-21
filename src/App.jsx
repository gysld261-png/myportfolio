import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from './components/Nav';
import Intro from './components/Intro';
import Main from './sections/Main';
import About from './sections/About';
import Portfolio from './sections/Portfolio';
import Contact from './sections/Contact';

const routeFromLocation = () => {
  if (window.location.hash === '#/about') return 'about';
  if (window.location.hash === '#/portfolio') return 'portfolio';
  if (window.location.hash.startsWith('#/project/')) return 'portfolio';
  return 'main';
};

const routeFor = (view) => {
  if (view === 'about') return `${window.location.pathname}#/about`;
  if (view === 'portfolio') return `${window.location.pathname}#/portfolio`;
  return window.location.pathname;
};

/**
 * 세로 문서가 아니라 하나의 고정된 전시 공간이다.
 * INTRO → MAIN → (scroll) ABOUT, PORTFOLIO 는 탭으로만 진입한다.
 */
export default function App() {
  const initialView = useRef(routeFromLocation());
  const [current, setCurrent] = useState(initialView.current);
  const [contactOpen, setContactOpen] = useState(false);
  const [intro, setIntro] = useState(initialView.current === 'main' ? 'active' : 'done');
  const [mainExit, setMainExit] = useState(0);
  const mainExitRef = useRef(0);
  const exitTimer = useRef(0);
  const mainReadyAt = useRef(0);
  const touchStart = useRef(null);

  const go = useCallback((id, { replace = false } = {}) => {
    if (id === 'contact') {
      setContactOpen(true);
      return;
    }
    if (!['main', 'about', 'portfolio'].includes(id)) return;

    setContactOpen(false);
    setCurrent(id);
    mainExitRef.current = 0;
    setMainExit(0);
    window.clearTimeout(exitTimer.current);
    const target = routeFor(id);
    if (replace) window.history.replaceState(null, '', target);
    else if (`${window.location.pathname}${window.location.hash}` !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  const finishMain = useCallback(() => {
    mainExitRef.current = 1;
    setMainExit(1);
    window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = 0;
      go('about');
    }, 520);
  }, [go]);

  useEffect(() => {
    if (intro === 'done') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = intro === 'active'
      ? window.setTimeout(() => setIntro('leaving'), reduced ? 80 : 1180)
      : window.setTimeout(() => setIntro('done'), reduced ? 160 : 700);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (intro === 'done' && current === 'main') mainReadyAt.current = performance.now();
  }, [current, intro]);

  useEffect(() => {
    const onPop = () => {
      mainExitRef.current = 0;
      setMainExit(0);
      setCurrent(routeFromLocation());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (contactOpen || intro !== 'done') return;
      if (current === 'main' && ['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        finishMain();
      }
      if (event.key === 'Escape' && current !== 'main') go('main');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contactOpen, current, finishMain, go, intro]);

  const onWheel = useCallback((event) => {
    if (current !== 'main' || contactOpen || intro !== 'done') return;
    if (performance.now() - mainReadyAt.current < 650) return;

    const step = Math.max(-0.12, Math.min(0.12, event.deltaY / 760));
    const next = Math.max(0, Math.min(1, mainExitRef.current + step));
    mainExitRef.current = next;
    setMainExit(next);

    if (next >= 0.985 && !exitTimer.current) {
      finishMain();
    } else if (next < 0.985 && exitTimer.current) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = 0;
    }
  }, [contactOpen, current, finishMain, intro]);

  const onTouchStart = useCallback((event) => {
    touchStart.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchEnd = useCallback((event) => {
    if (current !== 'main' || touchStart.current == null || intro !== 'done') return;
    const end = event.changedTouches[0]?.clientY ?? touchStart.current;
    if (touchStart.current - end > 54) {
      finishMain();
    }
    touchStart.current = null;
  }, [current, finishMain, intro]);

  return (
    <div
      className={`app-shell app-shell--${current} app-shell--intro-${intro}`}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Nav current={contactOpen ? 'contact' : current} onGo={go} />

      <main key={current} className={`app-stage app-stage--${current}`}>
        {current === 'main' && (
          <Main
            introEntrance={intro !== 'done'}
            transitionProgress={mainExit}
            onScrollCue={finishMain}
          />
        )}
        {current === 'about' && <About onGoMain={() => go('main')} />}
        {current === 'portfolio' && <Portfolio />}
      </main>

      <Contact open={contactOpen} onClose={() => setContactOpen(false)} />
      {intro !== 'done' && <Intro phase={intro} onSkip={() => setIntro('leaving')} />}
    </div>
  );
}
