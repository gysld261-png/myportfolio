import { useCallback, useEffect, useRef, useState } from 'react';
import Nav from './components/Nav';
import Intro from './components/Intro';
import Main from './sections/Main';
import About from './sections/About';
import Portfolio from './sections/Portfolio';
import Contact from './sections/Contact';
import SplashCursor from './components/SplashCursor';
import SmokeVeil from './components/SmokeVeil';
import CustomCursor from './components/CustomCursor';
import Ending from './sections/Ending';
import EndFreeze from './components/EndFreeze';
import { approach, clamp, prefersReduced } from './lib/smooth';

const routeFromLocation = () => {
  if (window.location.hash === '#/about' || window.location.hash.startsWith('#/about/')) return 'about';
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
const EXIT_TAU = 0.34;
/* 휠을 멈췄을 때 이보다 많이 밀었으면 ABOUT 까지 넘긴다 (연기가 화면 대부분을 덮는 지점) */
const WHEEL_COMMIT = 0.72;
/* ABOUT 지도에서 이만큼 위로 밀어야 MAIN 으로 돌아간다 — 트랙패드 한 번 튕긴 것으로는 넘어가지 않게 */
const BACK_THRESHOLD = 160;
const BACK_THRESHOLD_TOUCH = 90;
const REWIND_DURATION = 1100;
/* 지도 화면일 때만 되돌아간다. 방 안에서의 스크롤은 방 내용을 읽는 데 쓴다 */
const aboutOnMap = () => Boolean(document.querySelector('.about--map:not([aria-hidden="true"])'));

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
  // MAIN은 한 번 준비한 뒤 보관한다. 숨겨진 장면의 GPU 루프는 따로 멈춘다.
  const [mainCached, setMainCached] = useState(initialView.current === 'main');
  const [aboutCached, setAboutCached] = useState(initialView.current === 'about');
  const [aboutEntry, setAboutEntry] = useState(0);
  /* 'ice' — MAIN 에서 얼음을 통과해 ABOUT 에 도착했다. 탭으로 들어올 땐 없다.
     다음 이동 전까지 유지한다 — 연기가 걷힌 뒤 떼면 ABOUT 의 등장 애니메이션이
     기본값(fog-clear)으로 바뀌면서 한 번 더 재생돼 화면이 두 번 번쩍인다. */
  const [arrival, setArrival] = useState(null);
  /* 같은 연기 캔버스가 ABOUT 위에서 걷히는 동안만 true */
  const [passage, setPassage] = useState(false);
  /* ABOUT 의 방에서 프로젝트로 건너왔을 때 — 상세에 '그 방으로 돌아가기'를 띄운다 */
  const [origin, setOrigin] = useState(null);
  /* 엔딩 단계 — idle · pull(미는 중) · closing(끝까지 닫히는 중) · credits · opening(다시 열리는 중) */
  const [ending, setEnding] = useState('idle');
  const endingRef = useRef('idle');
  endingRef.current = ending;
  const shellRef = useRef(null);

  const exitTarget = useRef(0);     // 휠이 미는 값
  const exitValue = useRef(0);      // 화면에 실제로 그려지는 값
  const exitTimer = useRef(0);
  const mainReadyAt = useRef(0);
  const touchPrev = useRef(null);
  const wheelIdle = useRef(0);      // 휠이 멈춘 뒤 끝까지 넘길지 판단하는 타이머
  const backAccum = useRef(0);      // ABOUT 에서 위로 민 양
  const backAt = useRef(0);
  const rewindStarted = useRef(0);

  useEffect(() => {
    if (mainCached || current !== 'about') return undefined;
    // About 직접 진입도 메인 복귀 직전에 셰이더를 만들지 않도록 미리 준비한다.
    const warm = () => setMainCached(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 250);
    return () => window.clearTimeout(id);
  }, [current, mainCached]);

  useEffect(() => {
    if (aboutCached || current !== 'main') return undefined;
    // 전환 한가운데 PMREM·얼음 셰이더·방 UI를 만들지 않는다.
    // 인트로/메인 유휴 시간에 첫 프레임까지 준비하고, 숨겨진 GPU 루프는 멈춘다.
    const warm = () => setAboutCached(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 1000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 250);
    return () => window.clearTimeout(id);
  }, [current, aboutCached]);

  /* 브라우저 탭을 벗어났을 때만 짧은 메시지를 보여주고,
     다시 돌아오면 포트폴리오 제목으로 즉시 복원한다. */
  useEffect(() => {
    const defaultTitle = '박효민 — Portfolio';
    const awayTitle = '잠깐, 아직 남았어요.';
    const syncTabTitle = () => {
      document.title = document.hidden ? awayTitle : defaultTitle;
    };

    syncTabTitle();
    document.addEventListener('visibilitychange', syncTabTitle);
    return () => {
      document.removeEventListener('visibilitychange', syncTabTitle);
      document.title = defaultTitle;
    };
  }, []);

  /* 프로젝트를 누르는 순간 모듈 다운로드·대형 이미지 디코딩·셰이더 컴파일이 한꺼번에
     겹치지 않도록, 메인 화면의 유휴 시간에 다음 장면과 표지를 미리 준비한다. */
  useEffect(() => {
    let idleId = 0;
    let timerId = 0;
    const images = [];
    const warm = () => {
      import('./lib/workIceScene').catch(() => {});
      [
        '/cases/walga-logo.svg',
        '/cases/odit-logo.svg',
        '/cases/tchaikim-logo.svg',
        '/cases/walga/boards/main.webp',
        '/cases/tchaikim/hero-mockup.webp',
        '/cases/odit/main-v1.webp',
        '/cases/odit-preview.jpg',
      ].forEach((src) => {
        const image = new Image();
        image.decoding = 'async';
        image.src = src;
        image.decode?.().catch(() => {});
        images.push(image);
      });
    };

    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(warm, { timeout: 1800 });
    else timerId = window.setTimeout(warm, 900);
    return () => {
      if (idleId) window.cancelIdleCallback(idleId);
      window.clearTimeout(timerId);
    };
  }, []);

  /**
   * rewind: MAIN 으로 되돌아갈 때 승화를 거꾸로 재생한다.
   * 진행도를 1 에서 시작해 0 으로 풀면 안개가 걷히고 얼음이 다시 굳는다.
   */
  /* project: 포트폴리오로 가면서 그 프로젝트 상세를 바로 연다 (ABOUT 키워드의 근거 칩에서 쓴다) */
  /* from: ABOUT 방에서 왔을 때 { chamber, label }. chamber: ABOUT 으로 갈 때 바로 열 방 */
  const go = useCallback((id, { replace = false, rewind = false, via = null, project = null, from = null, chamber = null } = {}) => {
    if (id === 'contact') {
      setContactOpen(true);
      return;
    }
    if (!['main', 'about', 'portfolio'].includes(id)) return;

    setContactOpen(false);
    // 어디로 가든 관측창은 다시 활짝 연 상태로 시작한다
    setEnding('idle');
    setCurrent(id);
    if (id === 'main') setMainCached(true);
    if (id === 'about') {
      setAboutCached(true);
      setAboutEntry((entry) => entry + 1);
    }
    setOrigin(id === 'portfolio' ? from : null);
    backAccum.current = 0;
    backAt.current = 0;
    rewindStarted.current = 0;
    window.clearTimeout(wheelIdle.current);
    setArrival(id === 'about' && via === 'ice' ? 'ice' : null);
    setPassage(id === 'about' && via === 'ice');
    if (id === 'main' && rewind && !prefersReduced()) {
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
    // Portfolio 는 마운트될 때 주소의 #/project/:id 를 읽어 상세를 연다
    const target = id === 'portfolio' && project ? `${window.location.pathname}#/project/${project}`
      : id === 'about' && chamber ? `${window.location.pathname}#/about/${chamber}`
        : routeFor(id);
    if (replace) window.history.replaceState(null, '', target);
    else if (`${window.location.pathname}${window.location.hash}` !== target) {
      window.history.pushState(null, '', target);
    }
  }, []);

  // 숨겨진 About은 진행도 갱신 때마다 다시 렌더링하지 않도록 콜백도 고정한다.
  const aboutToMain = useCallback(() => go('main', { rewind: true }), [go]);
  const aboutToPortfolio = useCallback(() => go('portfolio'), [go]);
  const aboutToProject = useCallback((project, from) => go('portfolio', { project, from }), [go]);
  const finishPassage = useCallback(() => setPassage(false), []);

  /* 버튼·키보드로 한 번에 넘어갈 때도 값을 순간이동시키지 않고 목표만 올린다 */
  const requestExit = useCallback(() => {
    if (rewinding) return;
    exitTarget.current = 1;
  }, [rewinding]);

  const leaveIntro = useCallback(() => setIntro((now) => (now === 'active' ? 'leaving' : now)), []);

  useEffect(() => {
    if (intro === 'done') return undefined;
    const reduced = prefersReduced();
    // 인트로(얼음판)는 깨질 때 onLeave 를 부른다. 스스로 깨지지 않으니 active 에는 시간 제한을 두지 않는다
    // — 움직임 줄이기에서만 얼음판을 건너뛴다.
    if (intro === 'active' && !reduced) return undefined;
    const timer = intro === 'active'
      ? window.setTimeout(() => setIntro('leaving'), 80)
      : window.setTimeout(() => setIntro('done'), reduced ? 160 : 560);
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

      if (rewinding && !rewindStarted.current) rewindStarted.current = now;
      const rewindTime = clamp((now - rewindStarted.current) / REWIND_DURATION, 0, 1);
      // 복귀는 휠 추적과 분리한 한 번의 곡선: 시작·끝이 부드럽고 잔여 휠에 흔들리지 않는다.
      let next = rewinding
        ? 1 - rewindTime * rewindTime * (3 - 2 * rewindTime)
        : clamp(approach(exitValue.current, exitTarget.current, dt, EXIT_TAU), 0, 1);
      // 지수 감쇠는 목표에 영원히 도달하지 않는다. 가까워지면 붙여준다.
      // 안 그러면 0.03 쯤에서 멈춰 글자가 계속 흐릿한 채로 남는다.
      if (Math.abs(next - exitTarget.current) < 0.004) next = exitTarget.current;
      if (Math.abs(next - exitValue.current) > 0.0003) {
        exitValue.current = next;
        setMainExit(next);
      }

      if (rewinding && rewindTime >= 1) setRewinding(false);

      // 연기가 화면을 다 덮은 뒤에 ABOUT 이 그 자리에 나타난다.
      // 목표가 1 일 때만 — 되감는 중에 1 을 지나며 다시 넘어가면 무한 왕복이 된다.
      // 지수 추적은 1 근처에서 아주 느려져, 0.975 까지 기다리면 연기가 덮인 채 한동안 정지해 보인다.
      // 연기는 0.94 에서 이미 화면을 다 덮으므로(SmokeVeil gather ≈ 0.996) 거기서 바로 넘긴다.
      if (next >= 0.94 && exitTarget.current >= 0.999 && !exitTimer.current) {
        exitTimer.current = window.setTimeout(() => {
          exitTimer.current = 0;
          go('about', { via: 'ice' });
        }, 40);
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
      setRewinding(false);
      rewindStarted.current = 0;
      backAccum.current = 0;
      window.clearTimeout(wheelIdle.current);
      setArrival(null);
      setPassage(false);
      const next = routeFromLocation();
      if (next !== 'portfolio') setOrigin(null);
      setEnding('idle');
      setCurrent(next);
      if (next === 'main') setMainCached(true);
      if (next === 'about') {
        setAboutCached(true);
        setAboutEntry((entry) => entry + 1);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (contactOpen || intro !== 'done' || rewinding) return;
      if (current === 'main' && ['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        requestExit();
      }
      if (current === 'main' && ['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        exitTarget.current = 0;
      }
      if (event.key === 'Escape' && current !== 'main') {
        go('main', { rewind: current === 'about' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contactOpen, current, go, intro, requestExit, rewinding]);

  const onWheel = useCallback((event) => {
    if (contactOpen || intro !== 'done' || rewinding) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    const delta = clamp(event.deltaY * unit, -180, 180);

    if (current === 'about') {
      if (delta < 0 && aboutOnMap()) {
        const now = performance.now();
        if (now - backAt.current > 240) backAccum.current = 0;
        backAt.current = now;
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

    // 휠을 멈췄을 때 연기가 이미 화면 대부분을 덮었다면 끝까지 넘긴다.
    // 안 그러면 0.9 언저리에서 손을 떼는 순간 연기만 가득한 화면에 갇혀 '고장 났나?' 싶어진다.
    // 덜 밀었을 때는 그 자리에 둔다 — 승화를 중간에서 멈춰 보는 것도 이 화면의 재미다.
    // 위로 되감는 중이었다면 넘기지 않는다
    window.clearTimeout(wheelIdle.current);
    if (delta <= 0) return;
    wheelIdle.current = window.setTimeout(() => {
      if (exitTarget.current > WHEEL_COMMIT && exitTarget.current < 1) exitTarget.current = 1;
    }, 200);
  }, [contactOpen, current, go, intro, rewinding]);

  const onTouchStart = useCallback((event) => {
    backAccum.current = 0;
    touchPrev.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchMove = useCallback((event) => {
    if (touchPrev.current == null || intro !== 'done' || contactOpen || rewinding) return;
    const y = event.touches[0]?.clientY ?? touchPrev.current;
    const delta = touchPrev.current - y;
    touchPrev.current = y;

    if (current === 'about') {
      if (delta < 0 && aboutOnMap()) {
        backAccum.current += -delta;
        if (backAccum.current > BACK_THRESHOLD_TOUCH) go('main', { rewind: true });
      } else {
        backAccum.current = 0;
      }
      return;
    }
    if (current !== 'main') return;
    exitTarget.current = clamp(exitTarget.current + delta / 420, 0, 1);
  }, [current, go, intro, contactOpen, rewinding]);

  const onTouchEnd = useCallback(() => {
    if (rewinding) { touchPrev.current = null; return; }
    // 절반 넘게 밀었으면 끝까지, 아니면 제자리로 — 어중간하게 멈추지 않는다
    if (current === 'main' && !rewinding && exitTarget.current > 0.42) exitTarget.current = 1;
    else if (current === 'main') exitTarget.current = 0;
    touchPrev.current = null;
  }, [current, rewinding]);

  /* ── 엔딩: 관측창 ──
     진행도(0 열림 → 1 닫힘)는 WorkScroll 이 준다 — 마지막 얼음 뒤로 더 내린 양이다. 되돌아가지 않고 민 만큼 머문다.
     창은 화면 가운데, 마지막 얼음이 위로 빠져나간 빈 자리에서 닫힌다.
     반지름은 가운데서 모서리까지 × (1 − v)^1.35 — 처음엔 빨리 오므라들고 끝에선 천천히 조여 '슉' 하고 닫힌다 */
  /* 다시 얼어붙기(EndFreeze) — 인트로에서 깬 얼음이, 끝에서 다시 언다.
     --freeze: 가장자리부터 서리 결정·얼음 막이 안쪽으로. --dark: 거의 다 얼면 얼음 너머가 까맣게 가라앉는다 */
  const applyIris = useCallback((v) => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.style.setProperty('--iris-p', v.toFixed(4));
    shell.style.setProperty('--freeze', Math.min(1, v * 1.12).toFixed(4));
    shell.style.setProperty('--dark', (Math.max(0, (v - 0.7) / 0.3) ** 1.4).toFixed(4));
  }, []);

  const endControl = useRef(null);   // WorkScroll 이 채운다 — rewind(): 빈 공간을 거두고 마지막 얼음으로
  const endArmed = useRef(true);     // 엔딩에서 막 돌아온 직후엔 다 닫힌 상태라 곧바로 다시 들어가지 않게

  const onEndProgress = useCallback((v) => {
    const st = endingRef.current;
    if (st === 'credits') return;
    applyIris(v);
    if (v < 0.9) endArmed.current = true;
    if (v >= 0.985 && endArmed.current) { endArmed.current = false; setEnding('credits'); return; }
    if (v > 0.001 && st === 'idle') setEnding('pull');
    else if (v <= 0.001 && st !== 'idle') setEnding('idle');
  }, [applyIris]);

  const exitEnding = useCallback(() => {
    setEnding('opening');
    endControl.current?.rewind();
  }, []);

  // 엔딩에서 '처음으로' — 창을 연 상태로 되돌리고 MAIN 으로
  const endToMain = useCallback(() => { go('main'); }, [go]);

  return (
    <div
      ref={shellRef}
      className={`app-shell app-shell--${current} app-shell--intro-${intro} ${arrival === 'ice' ? 'app-shell--arrive-ice' : ''} ${ending !== 'idle' ? 'app-shell--ending' : ''}`}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Nav
        current={contactOpen ? 'contact' : current}
        onGo={go}
        progress={current === 'main' ? mainExit : 0}
      />

      <main className={`app-stage app-stage--${current}`}>
        {mainCached && (
          <Main
            active={current === 'main'}
            introEntrance={intro !== 'done'}
            transitionProgress={mainExit}
            rewinding={rewinding}
            onScrollCue={requestExit}
          />
        )}
        {aboutCached && (
          <About
            active={current === 'about'}
            entry={aboutEntry}
            onGoMain={aboutToMain}
            onGoPortfolio={aboutToPortfolio}
            onOpenProject={aboutToProject}
          />
        )}
        {current === 'portfolio' && (
          <Portfolio
            returnTo={origin ? {
              label: origin.label,
              onBack: () => go('about', { chamber: origin.chamber }),
            } : null}
            onEndProgress={onEndProgress}
            endControlRef={endControl}
            suspended={ending === 'credits'}
          />
        )}
      </main>

      {/* 다시 얼어붙기와 엔딩 — 끝에서 더 내리기 시작하면 나타난다 */}
      {ending !== 'idle' && <EndFreeze />}
      {(ending === 'credits' || ending === 'opening') && (
        <Ending active={ending === 'credits'} onExit={exitEnding} onGoMain={endToMain} />
      )}

      {/* 연기 통과 — MAIN 의 마지막 연기 화면을 이어받아 연기 밖으로 빠져나온다 */}
      {mainCached && (
        <SmokeVeil
          progress={mainExit}
          active={current === 'main' || (current === 'about' && passage)}
          clearing={current === 'about' && passage}
          onDone={finishPassage}
        />
      )}

      {/* ── 커서 유체 — MAIN 에서만 ──
           연기는 어두운 배경에 빛을 더하는 방식이라, 밝은 글자의 대비를 만들어 주는
           바로 그 어둠을 없앤다. 본문 위에서 재 보면 14.6:1 → 10.3:1 로 떨어진다.
           z-index 를 낮춰 글자 뒤로 보내도 배경이 밝아지는 건 같고(게다가 각 화면 배경이
           불투명이라 아예 안 보이게 된다), screen 블렌드도 배경을 같이 올려서 소용없다.
           설정으로 풀 수 없는 문제라 범위로 푼다.

           MAIN 은 얼음 하나에 큰 글씨 세 줄뿐이고 자체 안개가 없다.
           FIELD 는 field.js 가, ABOUT 은 입자와 열기 글로우가 이미 커서에 반응하고 있어서
           여기에 얹으면 안개가 두세 겹이 된다.
           CONTACT 가 열려 있을 때도 끈다 — 그때는 읽고 연락하는 화면이다.

           빼려면 이 블록과 위의 import 한 줄만 지우면 된다. */}
      {intro === 'done' && mainCached && (
        <SplashCursor active={current === 'main' && !contactOpen && !rewinding && mainExit <= 0.01} />
      )}

      <Contact open={contactOpen} onClose={() => setContactOpen(false)} />
      {intro !== 'done' && <Intro phase={intro} onLeave={leaveIntro} />}
      {/* 따라다니는 점 — 링크 위에서 링, 표본·보드 위에서 라벨이 붙는다 */}
      <CustomCursor />
    </div>
  );
}
