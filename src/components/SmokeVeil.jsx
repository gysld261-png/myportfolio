import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createSmokeRenderer } from '../lib/smokeVeil';
import { sublimationFront, sublimationSmoke } from '../lib/sublimation';

const CLEAR_DURATION = 3400;

/** 차오름 → 화면 교체 → 걷힘까지 같은 GPU 컨텍스트와 시간축을 이어 쓴다. */
export default function SmokeVeil({ progress = 0, active = true, clearing = false, onDone }) {
  const canvasRef = useRef(null);
  const controlRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = { progress, active, clearing, onDone };

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let smoke = null;
    try { smoke = reduced ? null : createSmokeRenderer(canvas); } catch { /* 보조 효과만 생략 */ }
    // 첫 실제 드로우의 드라이버 컴파일까지 유휴 시간에 끝낸다.
    smoke?.draw({ gather: 0, progress: 0 });
    smoke?.clear();

    let raf = 0;
    let drawn = false;
    let started = null;
    let finished = false;
    const frame = (now = performance.now()) => {
      raf = 0;
      const state = stateRef.current;
      if (!state.active) return;
      if (state.clearing) {
        if (finished) return;
        if (started === null) started = now;
        const duration = smoke ? CLEAR_DURATION : reduced ? 160 : 480;
        const release = Math.min(1, (now - started) / duration);
        smoke?.draw({ gather: 1, progress: release });
        drawn = Boolean(smoke);
        if (release >= 1) {
          finished = true;
          state.onDone?.();
          return;
        }
      } else {
        const gather = sublimationSmoke(state.progress);
        if (gather <= 0.001 || !smoke) {
          if (drawn) smoke?.clear();
          drawn = false;
          return; // 메인이 가만히 있을 땐 빈 캔버스 RAF도 돌리지 않는다.
        }
        smoke.draw({ gather, progress: 0 });
        drawn = true;
      }
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (drawn) smoke?.clear();
      drawn = false;
    };
    controlRef.current = {
      sync: (restart = false) => {
        if (restart) {
          cancelAnimationFrame(raf);
          raf = 0;
          started = null;
          finished = false;
        }
        canvas.parentElement.classList.toggle('smoke-passage--plain', !smoke && stateRef.current.clearing);
        if (!stateRef.current.active) stop();
        else if (!raf) frame();
      },
    };
    controlRef.current.sync(true);
    return () => {
      stop();
      controlRef.current = null;
      smoke?.dispose();
    };
  }, []);

  // handoff의 첫 프레임은 paint 전에 채운다. 새 렌더러를 만들거나 연기를 비우지 않는다.
  useLayoutEffect(() => { controlRef.current?.sync(true); }, [active, clearing]);
  useLayoutEffect(() => { controlRef.current?.sync(); }, [progress]);

  return createPortal(
    <div
      className={`smoke-passage smoke-veil ${clearing ? 'smoke-veil--clearing' : ''}`}
      style={{ '--smoke-front': `${sublimationFront(progress) * 100}%`, visibility: active ? undefined : 'hidden' }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>,
    document.body,
  );
}
