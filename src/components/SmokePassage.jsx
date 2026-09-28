import { useLayoutEffect, useRef } from 'react';
import { createSmokeRenderer } from '../lib/smokeVeil';

/**
 * 연기 통과 — MAIN 의 스크롤 끝(연기로 덮인 화면)에서 ABOUT 으로 빠져나오는 순간.
 *
 * 둥근 구멍이 열리거나 찢어지는 게 아니다. 짙은 연기 속을 앞으로 걸어 나가면
 * 무거운 연기가 아래로 스르륵 가라앉으며 얇은 곳부터 옅어지고,
 * 그 너머의 ABOUT 이 드러난다.
 *
 * MAIN 에서 차오른 연기(SmokeVeil)와 같은 셰이더·같은 시계라 첫 장면이 그대로 이어진다.
 */
const DURATION = 2700;

export default function SmokePassage({ onDone }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // 화면에 그려지기 전에 첫 장면을 그려 둔다 — 한 프레임이라도 비면 ABOUT 이 번쩍 비친다
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smoke = !reduced && createSmokeRenderer(canvas);
    // WebGL 이 없거나 모션 축소면 CSS 페이드(.smoke-passage--plain)로 대신한다
    if (!smoke) {
      canvas.parentElement.classList.add('smoke-passage--plain');
      const t = window.setTimeout(() => doneRef.current?.(), 480);
      return () => window.clearTimeout(t);
    }

    let raf = 0;
    let start = 0;
    let finished = false;
    const frame = (now) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / DURATION);
      smoke.draw({ progress, gather: 1 });
      if (progress < 1) raf = requestAnimationFrame(frame);
      else if (!finished) {
        finished = true;
        doneRef.current?.();
      }
    };
    smoke.draw({ progress: 0, gather: 1 });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      smoke.dispose();
    };
  }, []);

  return (
    <div className="smoke-passage" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
