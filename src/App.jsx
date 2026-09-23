import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from './components/Nav';
import Intro from './components/Intro';
import Main from './sections/Main';
import About from './sections/About';
import Portfolio from './sections/Portfolio';
import Contact from './sections/Contact';
import { approach, clamp, prefersReduced } from './lib/smooth';

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

/* 휠 한 번에 진행되는 양. 작을수록 길게 밀어야 넘어간다. */
const WHEEL_SCALE = 1 / 1150;
/* 승화가 목표값을 따라가는 시간 상수. 클수록 더 미끄러진다. */
const EXIT_TAU = 0.26;
/* ABOUT 에서 이만큼 위로 밀어야 MAIN 으로 돌아간다 */
const BACK_THRESHOLD = 150;

/**
 * 세로 문서가 아니라 하나의 고정된 전시 공간이다.
 * INTRO → MAIN → (scroll) ABOUT, PORTFOLIO 는 탭으로만 진입한다.
 *
 * MAIN 의 승화 진행도는 휠 값을 직접 받지 않는다.
 * 휠은 목표값만 밀고, 실제 값은 매 프레임 목표를 쫓아간다 — 그래서 끊기지 않는다.
 */
export default function App() {
  const initialView = useRef(routeFromLocation());
  const [current, setCurrent] = useState(initialView.current);
  const [contactOpen, setContactOpen] = useState(false);
  const [intro, setIntro] = useState(initialView.current === 'main' ? 'active' : 'done');
  const [mainExit, setMainExit] = useState(0);
  const [rewinding, setRewinding] = useState(false);

  const exitTarget = useRef(0);     // 휠이 미는 값
  const exitValue = useRef(0);      // 화면에 실제로 그려지는 값
  const exitTimer = useRef(0);
  const mainReadyAt = useRef(0);
  const touchPrev = useRef(null);
  const backAccum = useRef(0);   // ABOUT 에서 위로 민 양

  /**
   * rewind: MAIN 으로 되돌아갈 때 승화를 거꾸로 재생한다.
   * 진행도를 1 에서 시작해 0 으로 풀면 안개가 걷히고 얼음이 다시 굳는다.
   */
  const go = useCallback((id, { replace = false, rewind = false } = {}) => {
    if (id === 'contact') {
      setContactOpen(true);
      return;
    }
    if (!['main', 'about', 'portfolio'].includes(id)) return;

    setContactOpen(false);
    setCurrent(id);
    backAccum.current = 0;
    if (id === 'main' && rewind) {
      exitValue.current = 1;
      exitTarget.current = 0;
      setMainExit(1);
      setRewinding(true);
    } else {
      exitTarget.current = 0;
      exitValue.current = 0;
      setMainExit(0);
      setRewinding(false);
    }
    window.clearTimeout(exitTimer.current);
    exitTimer.current = 0;
    const target = routeFor(id);
    if (replace) window.history.replaceState(null, '', target);
    else if (`${window.location.pathname}${window.location.hash}` !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  /* 버튼·키보드로 한 번에 넘어갈 때도 값을 순간이동시키지 않고 목표만 올린다 */
  const requestExit = useCallback(() => {
    exitTarget.current = 1;
  }, []);

  useEffect(() => {
    if (intro === 'done') return undefined;
    const reduced = prefersReduced();
    const timer = intro === 'active'
      ? window.setTimeout(() => setIntro('leaving'), reduced ? 80 : 1180)
      : window.setTimeout(() => setIntro('done'), reduced ? 160 : 700);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (intro === 'done' && current === 'main') mainReadyAt.current = performance.now();
  }, [current, intro]);

  /* ── 승화 진행도를 매 프레임 목표값 쪽으로 당긴다 ── */
  useEffect(() => {
    if (current !== 'main') return undefined;
    let alive = true;
    let raf = 0;
    let last = 0;

    const tick = (now) => {
      if (!alive) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;

      let next = clamp(approach(exitValue.current, exitTarget.current, dt, EXIT_TAU), 0, 1);
      // 지수 감쇠는 목표에 영원히 도달하지 않는다. 가까워지면 붙여준다.
      // 안 그러면 0.03 쯤에서 멈춰 글자가 계속 흐릿한 채로 남는다.
      if (Math.abs(next - exitTarget.current) < 0.004) next = exitTarget.current;
      if (Math.abs(next - exitValue.current) > 0.0003) {
        exitValue.current = next;
        setMainExit(next);
      }

      if (rewinding && next < 0.02) setRewinding(false);

      // 연기가 화면을 다 덮은 뒤에 ABOUT 이 그 자리에 나타난다.
      // 목표가 1 일 때만 — 되감는 중에 1 을 지나며 다시 넘어가면 무한 왕복이 된다.
      if (next >= 0.975 && exitTarget.current >= 0.999 && !exitTimer.current) {
        exitTimer.current = window.setTimeout(() => {
          exitTimer.current = 0;
          go('about');
        }, 620);
      } else if (next < 0.9 && exitTimer.current) {
        window.clearTimeout(exitTimer.current);
        exitTimer.current = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(exitTimer.current);
      exitTimer.current = 0;
    };
  }, [current, go, rewinding]);

  useEffect(() => {
    const onPop = () => {
      exitTarget.current = 0;
      exitValue.current = 0;
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
        requestExit();
      }
      if (current === 'main' && ['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        exitTarget.current = 0;
      }
      if (current === 'about' && ['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        go('main', { rewind: true });
      }
      if (event.key === 'Escape' && current !== 'main') {
        go('main', { rewind: current === 'about' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contactOpen, current, go, intro, requestExit]);

  const onWheel = useCallback((event) => {
    if (contactOpen || intro !== 'done') return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const delta = clamp(event.deltaY * unit, -180, 180);

    // ABOUT 에서 위로 밀면 MAIN 으로 되돌아간다.
    // 트랙패드 한 번 튕긴 것으로 넘어가지 않도록 일정량을 모은다.
    if (current === 'about') {
      if (delta < 0) {
        backAccum.current += -delta;
        if (backAccum.current > BACK_THRESHOLD) go('main', { rewind: true });
      } else {
        backAccum.current = 0;
      }
      return;
    }

    if (current !== 'main') return;
    if (performance.now() - mainReadyAt.current < 550) return;
    exitTarget.current = clamp(exitTarget.current + delta * WHEEL_SCALE, 0, 1);
  }, [contactOpen, current, go, intro]);

  const onTouchStart = useCallback((event) => {
    touchPrev.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchMove = useCallback((event) => {
    if (touchPrev.current == null || intro !== 'done') return;
    const y = event.touches[0]?.clientY ?? touchPrev.current;
    const delta = touchPrev.current - y;
    touchPrev.current = y;

    if (current === 'about') {
      if (delta < 0) {
        backAccum.current += -delta;
        if (backAccum.current > 90) go('main', { rewind: true });
      } else {
        backAccum.current = 0;
      }
      return;
    }
    if (current !== 'main') return;
    exitTarget.current = clamp(exitTarget.current + delta / 420, 0, 1);
  }, [current, go, intro]);

  const onTouchEnd = useCallback(() => {
    // 절반 넘게 밀었으면 끝까지, 아니면 제자리로 — 어중간하게 멈추지 않는다
    if (current === 'main' && exitTarget.current > 0.42) exitTarget.current = 1;
    else if (current === 'main') exitTarget.current = 0;
    touchPrev.current = null;
  }, [current]);

  return (
    <div
      className={`app-shell app-shell--${current} app-shell--intro-${intro}`}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Nav current={contactOpen ? 'contact' : current} onGo={go} />

      <main key={current} className={`app-stage app-stage--${current}`}>
        {current === 'main' && (
          <Main
            introEntrance={intro !== 'done'}
            transitionProgress={mainExit}
            rewinding={rewinding}
            onScrollCue={requestExit}
          />
        )}
        {current === 'about' && <About onGoMain={() => go('main', { rewind: true })} />}
        {current === 'portfolio' && <Portfolio />}
      </main>

      <Contact open={contactOpen} onClose={() => setContactOpen(false)} />
      {intro !== 'done' && <Intro phase={intro} onSkip={() => setIntro('leaving')} />}
    </div>
  );
}
