import { useEffect, useRef, useState } from 'react';

/**
 * 프레임 가장자리에서 자라나는 성에.
 *
 * 마우스로 걷어내는 안개가 아니다 — 시간이 지나면 스스로 자란다.
 * 그래서 hover 가 없는 터치·키보드 환경에서도 똑같이 동작하고,
 * 타이포가 놓인 영역은 건드리지 않으므로 첫 화면 가독성을 해치지 않는다.
 */
export default function FrostEdge({ paused = false }) {
  const [grow, setGrow] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGrow(0.55);
      return undefined;
    }
    if (paused) return undefined;

    if (elapsed.current >= 46000) return undefined;
    const started = performance.now();
    let timer;
    const tick = () => {
      const total = elapsed.current + performance.now() - started;
      setGrow(Math.min(1, total / 46000));
      if (total < 46000) timer = window.setTimeout(tick, 250);
    };
    timer = window.setTimeout(tick, 250);
    return () => {
      window.clearTimeout(timer);
      elapsed.current = Math.min(46000, elapsed.current + performance.now() - started);
    };
  }, [paused]);

  return (
    <>
      <div className="frost" style={{ '--grow': grow }} aria-hidden="true">
        <div className="frost__bloom" />
        <div className="frost__grain" />
      </div>
      <svg className="frost__defs" aria-hidden="true" focusable="false">
        <filter id="frost-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="3" seed="7" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
    </>
  );
}
