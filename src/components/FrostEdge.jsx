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
  const raf = useRef(0);
  const started = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGrow(0.55);
      return undefined;
    }
    if (paused) return undefined;

    started.current = performance.now();
    let last = 0;

    const tick = (now) => {
      /* 4Hz 로만 갱신한다 — 성에는 천천히 자란다. 매 프레임 리렌더할 이유가 없다. */
      if (now - last > 250) {
        const elapsed = (now - started.current) / 1000;
        setGrow(Math.min(1, elapsed / 46));
        last = now;
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
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
