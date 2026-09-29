import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createSmokeRenderer } from '../lib/smokeVeil';
import { sublimationFront, sublimationSmoke } from '../lib/sublimation';

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
    let smoke = null;
    try {
      smoke = !reduced && createSmokeRenderer(canvas);
    } catch {
      // 연기는 보조 효과다. WebGL 실패가 메인 화면과 내비게이션까지 멈추게 하지 않는다.
      smoke = null;
    }
    if (!smoke) return undefined;

    let raf = 0;
    let drawn = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      // 기준선이 출발하는 순간부터 아래쪽에 연기가 모이고, 화면 위를 통과하면 꽉 찬다.
      const gather = sublimationSmoke(progressRef.current);
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
    <div
      className="smoke-passage smoke-veil"
      style={{ '--smoke-front': `${sublimationFront(progress) * 100}%` }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>,
    document.body,
  );
}
