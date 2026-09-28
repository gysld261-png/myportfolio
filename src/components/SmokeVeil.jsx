import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createSmokeRenderer } from '../lib/smokeVeil';

const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * MAIN 스크롤 승화 — 얼음 자리와 바닥에서 연기가 피어올라 화면을 채운다.
 * 다 채운 마지막 장면이 ABOUT 으로 빠져나오는 연기(SmokePassage)의 첫 장면과 같아서
 * 화면이 바뀌는 순간이 보이지 않는다. 되감을 때는 거꾸로 걷힌다.
 */
export default function SmokeVeil({ progress = 0 }) {
  const canvasRef = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const smoke = !reduced && createSmokeRenderer(canvas);
    if (!smoke) return undefined;

    let raf = 0;
    let drawn = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      // 글자가 빠지기 시작할 즈음부터 차올라, ABOUT 으로 넘어가는 지점(0.975)에서 꽉 찬다
      const gather = smooth(0.2, 0.97, progressRef.current);
      if (gather <= 0.001) {
        if (drawn) smoke.clear();
        drawn = false;
        return;
      }
      smoke.draw({ gather, progress: 0 });
      drawn = true;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      smoke.dispose();
    };
  }, []);

  return createPortal(
    <div className="smoke-passage smoke-veil" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>,
    document.body,
  );
}
