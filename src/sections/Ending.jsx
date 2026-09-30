import { useEffect, useRef, useState } from 'react';
import { prefersReduced } from '../lib/smooth';
import './ending.css';

/**
 * ENDING — 마지막 얼음까지 승화하고 남는 것. (레퍼런스: seunghyuk.com/contact)
 *
 * 관측창이 점으로 닫히면 그 점이 가운데 작은 표식으로 남고, 스크롤할수록 드라이아이스 결정 하나가
 * 선(SOLID) → 면(SUBLIMATION) → 점(GAS)으로 승화한다. 아래엔 상태 이름이 하나씩 쌓이고,
 * 점으로 흩어질 때 "THIS IS EVERYTHING I'VE MADE", 마지막엔 점 구름 위에 연락처 한 줄이 남는다.
 * 전부 스크롤이 진행시키고(자동 재생 없음), 드래그로 결정을 돌려 볼 수 있다.
 * 맨 처음에서 위로 더 굴리면 창이 다시 열리며 포트폴리오로 돌아간다(onExit).
 */

const STATES = [['SOLID', 0.1], ['SUBLIMATION', 0.38], ['GAS', 0.62]];
const LABELS = ['왈가왈봇', 'ODIT', 'TCHAIKIM', 'PM · IA', 'UI DESIGN', 'FRONTEND', 'DESIGN SYSTEM', '2026'];
const WHEEL_SPAN = 5;        // 처음부터 끝까지 화면 높이의 몇 배를 굴리는지
const EXIT_PULL = 220;       // 맨 처음에서 위로 이만큼(px) 더 굴리면 돌아간다

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export default function Ending({ active, onExit, onGoMain }) {
  const hostRef = useRef(null);
  const rootRef = useRef(null);
  const labelRefs = useRef([]);
  const [final, setFinal] = useState(false);
  const p = useRef({ target: 0, value: 0, back: 0 });
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    if (!active) return undefined;
    const reduced = prefersReduced();
    const root = rootRef.current;
    let scene = null;
    let cancelled = false;
    import('../lib/endingScene').then(({ createEndingScene }) => {
      if (cancelled) return;
      try { scene = createEndingScene(hostRef.current); } catch { scene = null; }
    });
    const s = p.current;
    s.target = s.value = reduced ? 1 : 0;

    let raf = 0; let last = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      s.value += (s.target - s.value) * (1 - Math.exp(-dt / 0.32));
      if (Math.abs(s.target - s.value) < 0.0005) s.value = s.target;
      const v = s.value;
      // 글과 표식은 CSS 변수 하나(--p)로 — 각 요소가 자기 구간을 스스로 계산한다
      root.style.setProperty('--p', v.toFixed(4));
      STATES.forEach(([, at], i) => root.style.setProperty(`--s${i}`, (smooth(at, at + 0.05, v) * (1 - smooth(0.84, 0.9, v))).toFixed(3)));
      root.style.setProperty('--mark', (1 - smooth(0.02, 0.09, v)).toFixed(3));
      root.style.setProperty('--say', (smooth(0.66, 0.71, v) * (1 - smooth(0.8, 0.85, v))).toFixed(3));
      root.style.setProperty('--end', smooth(0.86, 0.93, v).toFixed(3));
      setFinal(v > 0.88);
      if (scene) {
        scene.setProgress(v);
        scene.render(dt);
        // 떠다니는 글자 — 흩어진 점에 붙어 함께 떠오른다
        const pts = scene.labels();
        // 마지막 줄이 나오면 옅어진다 — 연락처 글자와 겹쳐 읽히지 않게
        const show = smooth(0.66, 0.75, v) * (1 - 0.7 * smooth(0.84, 0.92, v));
        labelRefs.current.forEach((el, i) => {
          if (!el) return;
          const q = pts[i];
          el.style.transform = `translate3d(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px, 0)`;
          el.style.opacity = (show * (0.35 + 0.65 * ((i * 37) % 10) / 10)).toFixed(3);
        });
      }
    };
    raf = requestAnimationFrame(tick);

    const onWheel = (event) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1;
      const d = event.deltaY * unit;
      // 맨 처음에서 위로 더 — 창을 다시 연다
      if (d < 0 && s.target <= 0 && s.value < 0.01) {
        s.back += -d;
        if (s.back > EXIT_PULL) { s.back = 0; exitRef.current(); }
        return;
      }
      s.back = 0;
      s.target = Math.min(1, Math.max(0, s.target + d / (window.innerHeight * WHEEL_SPAN)));
    };
    // 드래그 — 가로는 결정을 돌리고, 터치의 세로는 스크롤처럼 진행시킨다
    let drag = null;
    const onDown = (event) => { if (event.target.closest('a, button')) return; drag = { x: event.clientX, y: event.clientY, touch: event.pointerType !== 'mouse' }; root.classList.add('is-dragging'); };
    const onMove = (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      scene?.drag(dx, drag.touch ? 0 : dy);
      if (drag.touch) s.target = Math.min(1, Math.max(0, s.target - dy / (window.innerHeight * WHEEL_SPAN * 0.5)));
    };
    const onUp = () => { drag = null; root.classList.remove('is-dragging'); };
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); exitRef.current(); }
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); s.target = Math.min(1, s.target + 0.1); }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (s.target <= 0) exitRef.current(); else s.target = Math.max(0, s.target - 0.1);
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey, true);
      scene?.dispose();
    };
  }, [active]);

  return (
    <section ref={rootRef} className={`ending ${active ? 'is-active' : ''} ${final ? 'is-final' : ''}`} aria-label="엔딩">
      <div ref={hostRef} className="ending__scene" aria-hidden="true" />
      <span className="ending__mark" aria-hidden="true" />

      <div className="ending__labels" aria-hidden="true">
        {LABELS.map((t, i) => <span key={t} ref={(el) => { labelRefs.current[i] = el; }} className="sys">{t}</span>)}
      </div>

      <p className="ending__say">
        <span>Always learning, always making</span>
        <small>계속 배우고, 계속 만듭니다</small>
      </p>

      <ul className="ending__states sys" aria-hidden="true">
        {STATES.map(([name], i) => <li key={name} style={{ opacity: `var(--s${i})` }}>{name}</li>)}
      </ul>

      <nav className="ending__contact" aria-label="연락처" aria-hidden={!final}>
        <strong>PARK HYOMIN</strong>
        <a href="mailto:gysld261@gmail.com" tabIndex={final ? 0 : -1}>gysld261@gmail.com</a>
        <a href="https://github.com/gysld261-png" target="_blank" rel="noreferrer" tabIndex={final ? 0 : -1}>GITHUB</a>
        <button type="button" onClick={onGoMain} tabIndex={final ? 0 : -1}>↺ MAIN</button>
      </nav>

      <button type="button" className="ending__esc sys" onClick={onExit} aria-label="엔딩 닫고 포트폴리오로">← PORTFOLIO</button>
      <p className="ending__hint sys" aria-hidden="true">SCROLL · DRAG</p>
    </section>
  );
}
