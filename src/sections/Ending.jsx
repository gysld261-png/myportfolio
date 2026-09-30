import { useEffect, useRef, useState } from 'react';
import { prefersReduced } from '../lib/smooth';
import SplashCursor from '../components/SplashCursor';
import './ending.css';

/* 같은 눈 가루가 계속 모이고 풀린다. 문장은 지나가고, 만드는 과정은 계속 남는다.
   진행은 세 정거장 — 모인 가루(0) → 한 번 내리면 퍼지며 문장(STATEMENT) → 한 번 더 내리거나 잠시 머물면 연락처(1).
   스크롤로 끝까지 끌고 가지 않는다. 한 번의 입력이 한 장면을 연다. */
const STATEMENT = .74;
const STOPS = [0, STATEMENT, 1];
const AUTO_NEXT = 2000;   // 문장에 도착하고 이만큼 머물면 저절로 연락처로
const STEP_LOCK = 1100;   // 트랙패드 관성 한 번이 두 장면을 넘기지 않게
const EXIT_PULL = 220;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function Ending({ active, onExit, onGoMain, onDrawn }) {
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const [phase, setPhase] = useState('scene');
  const [reduced, setReduced] = useState(prefersReduced);
  // 첫 장면을 그렸는지 — className 은 React 가 다시 쓰므로 classList 가 아니라 상태로 둔다
  const [drawn, setDrawn] = useState(false);
  const final = phase === 'contact';

  useEffect(() => {
    if (!active) return undefined;
    const root = rootRef.current;
    const motionReduced = prefersReduced();
    setReduced(motionReduced);
    const previousFocus = document.activeElement;
    const progress = { target: motionReduced ? 1 : 0, value: motionReduced ? 1 : 0, back: 0, stop: motionReduced ? 2 : 0, lockUntil: 0, swipe: 0 };
    let autoTimer = 0;
    let firstDrawn = false;
    // 한 정거장씩 — 문장에 도착하면 잠시 뒤 저절로 연락처로 넘어간다
    const goTo = (index) => {
      const next = Math.max(0, Math.min(STOPS.length - 1, index));
      window.clearTimeout(autoTimer);
      progress.stop = next;
      progress.target = STOPS[next];
      progress.lockUntil = performance.now() + STEP_LOCK;
      progress.back = 0;
      if (next === 1) autoTimer = window.setTimeout(() => { if (progress.stop === 1) goTo(2); }, AUTO_NEXT + 1400);   // 1.4s 는 문장까지 미끄러지는 시간
    };
    let currentPhase = motionReduced ? 'contact' : 'scene';
    setPhase(currentPhase);
    let scene = null;
    let cancelled = false;
    let frame = 0;
    let last = performance.now();
    let drag = null;
    let exiting = false;

    const exit = () => { if (!exiting) { exiting = true; onExit(); } };
    root.classList.remove('is-plain');
    root.focus({ preventScroll: true });

    const sync = (dt) => {
      const v = progress.value;
      root.style.setProperty('--say', (smooth(.61, .69, v) * (1 - smooth(.79, .85, v))).toFixed(4));
      root.style.setProperty('--contact', smooth(.86, .95, v).toFixed(4));
      root.style.setProperty('--hint', (1 - smooth(.84, .95, v)).toFixed(4));
      const nextPhase = v >= .86 ? 'contact' : v >= .61 ? 'statement' : 'scene';
      if (nextPhase !== currentPhase) { currentPhase = nextPhase; setPhase(nextPhase); }
      if (scene) {
        scene.setProgress(v);
        scene.render(dt);
        // 첫 장면을 실제로 그린 그 프레임에 알린다 — 포트폴리오 쪽 가루가 이때 물러나야 겹쳐 밝아지거나 비지 않는다
        if (!firstDrawn) { firstDrawn = true; setDrawn(true); onDrawn?.(); }
      }
    };

    const tick = (now) => {
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      // 정거장 사이는 천천히 미끄러진다 — 가루가 퍼지는 걸 지켜볼 시간
      progress.value += (progress.target - progress.value) * (1 - Math.exp(-dt / .55));
      if (Math.abs(progress.target - progress.value) < .0005) progress.value = progress.target;
      sync(dt);
      frame = requestAnimationFrame(tick);
    };
    sync(0);
    if (!motionReduced) frame = requestAnimationFrame(tick);

    import('../lib/endingScene').then(({ createEndingScene }) => {
      if (cancelled) return;
      try {
        scene = createEndingScene(hostRef.current);
        // 모션 감소 설정에서는 한 프레임만 그리고 반복 루프를 돌리지 않는다.
        if (motionReduced) sync(0);
      } catch {
        root.classList.add('is-plain');
        setDrawn(true); onDrawn?.();   // WebGL 이 없으면 가루 없이 바로 불투명한 엔딩으로
      }
    }).catch(() => { if (!cancelled) { root.classList.add('is-plain'); setDrawn(true); onDrawn?.(); } });

    // 한 번 내리면 다음 장면, 한 번 올리면 앞 장면. 첫 장면에서 더 올리면 포트폴리오로 돌아간다
    const step = (direction) => {
      if (motionReduced) { if (direction < 0) exit(); return; }
      if (performance.now() < progress.lockUntil) return;
      if (direction > 0 && progress.stop < STOPS.length - 1) goTo(progress.stop + 1);
      if (direction < 0 && progress.stop > 0) goTo(progress.stop - 1);
    };
    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault(); event.stopPropagation();
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = event.deltaY * unit;
      if (delta < 0 && progress.stop === 0 && progress.value < .01) {
        if (performance.now() < progress.lockUntil) return;
        progress.back += -delta;
        if (progress.back >= EXIT_PULL) exit();
        return;
      }
      if (Math.abs(delta) < 4) return;
      step(Math.sign(delta));
    };
    const onDown = (event) => {
      if (event.target.closest('a, button') || event.isPrimary === false || event.button > 0) return;
      drag = { x: event.clientX, y: event.clientY, touch: event.pointerType !== 'mouse' };
      root.classList.add('is-dragging');
    };
    const onMove = (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      if (!motionReduced) {
        scene?.drag(dx, drag.touch ? 0 : dy);
        // 손가락으로 쓸어 올리면 다음 장면(한 번에 한 장면)
        if (drag.touch) {
          progress.swipe += dy;
          if (Math.abs(progress.swipe) > 48) { step(progress.swipe < 0 ? 1 : -1); progress.swipe = 0; }
        }
      }
    };
    const onUp = () => { drag = null; progress.swipe = 0; root.classList.remove('is-dragging'); };
    const onKey = (event) => {
      if (event.key === 'Tab') {
        const controls = [...root.querySelectorAll('a[href], button:not([disabled])')].filter(el => !el.closest('[inert]'));
        const first = controls[0]; const end = controls[controls.length - 1];
        if (!first) return;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root || !root.contains(document.activeElement))) {
          event.preventDefault(); end.focus();
        } else if (!event.shiftKey && (document.activeElement === end || !root.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); exit(); }
      if (['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.target.closest('a, button'))) {
        event.preventDefault(); event.stopImmediatePropagation(); step(1);
      }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (motionReduced || progress.stop === 0) exit(); else step(-1);
      }
      if (event.key === 'End') { event.preventDefault(); event.stopImmediatePropagation(); goTo(STOPS.length - 1); }
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelled = true;
      window.clearTimeout(autoTimer);
      cancelAnimationFrame(frame);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey, true);
      scene?.dispose();
      if (root.contains(document.activeElement) && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [active, onExit, onDrawn]);

  return (
    <section ref={rootRef} className={`ending ${active ? 'is-active' : ''} ${drawn ? 'is-drawn' : ''} ${final ? 'is-final' : ''} ${reduced ? 'is-reduced' : ''}`}
      role="dialog" aria-modal={active ? true : undefined} aria-label="엔딩" aria-hidden={!active} inert={active ? undefined : ''} tabIndex={-1}>
      <div ref={hostRef} className="ending__scene" aria-hidden="true" />
      {/* 마지막 장면엔 메인의 커서 연기가 다시 — 처음 얼음을 문지르던 손길로 끝난다. 가루 위·글자 아래에 깔린다 */}
      <SplashCursor active={active && final && !reduced} Z_INDEX={0} />
      <div className="ending__message" aria-hidden={phase !== 'statement' && !reduced}>
        <p className="ending__say">Always learning, always making</p>
        <p className="ending__sub">계속 배우고, 계속 만듭니다</p>
      </div>
      <nav className="ending__contact" aria-label="연락처" aria-hidden={!final} inert={final ? undefined : ''}>
        <strong>PARK HYOMIN</strong>
        <div className="ending__links">
          <a href="mailto:gysld261@gmail.com">gysld261@gmail.com</a>
          <a href="https://github.com/gysld261-png" target="_blank" rel="noreferrer">GITHUB ↗</a>
        </div>
      </nav>
      <button type="button" className="ending__esc sys" onClick={onExit} aria-label="엔딩 닫고 포트폴리오로">← PORTFOLIO</button>
      <button type="button" className="ending__main sys" onClick={onGoMain} aria-hidden={!final} inert={final ? undefined : ''}>↺ MAIN</button>
      <p className="ending__hint sys" aria-hidden="true">SCROLL · DRAG</p>
    </section>
  );
}
