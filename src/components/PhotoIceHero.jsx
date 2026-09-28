import { useEffect, useRef } from 'react';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/**
 * 실사 드라이아이스를 중심 오브젝트로 쓰는 히어로.
 * 사진을 억지로 3D 회전시키지 않고, 시점 이동과 빛의 이동만 아주 작게 준다.
 */
export default function PhotoIceHero({ onReadout, onReady, initialEntrance = false, exitProgress = 0 }) {
  const hostRef = useRef(null);
  const exitRef = useRef(exitProgress);
  exitRef.current = exitProgress;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false };
    let frame = 0;
    let started = performance.now();
    let lastReadout = 0;

    const updatePointer = (event) => {
      const bounds = host.getBoundingClientRect();
      pointer.tx = clamp((event.clientX - bounds.left) / bounds.width, 0, 1) * 2 - 1;
      pointer.ty = clamp((event.clientY - bounds.top) / bounds.height, 0, 1) * 2 - 1;
      pointer.inside = true;
    };
    const resetPointer = () => {
      pointer.tx = 0;
      pointer.ty = 0;
      pointer.inside = false;
    };

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const still = reduced.matches;
      pointer.x += ((still ? 0 : pointer.tx) - pointer.x) * 0.055;
      pointer.y += ((still ? 0 : pointer.ty) - pointer.y) * 0.055;
      const entrance = initialEntrance && !still ? clamp((now - started - 120) / 1050) : 1;
      const exit = clamp(exitRef.current);

      host.style.setProperty('--ice-x', pointer.x.toFixed(4));
      host.style.setProperty('--ice-y', pointer.y.toFixed(4));
      host.style.setProperty('--ice-enter', entrance.toFixed(4));
      host.style.setProperty('--ice-exit', exit.toFixed(4));

      if (now - lastReadout > 140) {
        lastReadout = now;
        const activity = clamp(Math.hypot(pointer.x, pointer.y) * 0.72 + exit);
        onReadout?.({
          mass: 100 - exit * 18.5,
          heat: activity,
          temp: activity > 0.16 ? 'RISING' : 'LOW',
          azimuth: Math.round(36 + pointer.x * 21),
          lit: pointer.inside,
        });
      }
    };

    host.addEventListener('pointermove', updatePointer);
    host.addEventListener('pointerleave', resetPointer);
    frame = requestAnimationFrame(tick);
    onReady?.(true);

    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener('pointermove', updatePointer);
      host.removeEventListener('pointerleave', resetPointer);
    };
  }, [initialEntrance, onReadout, onReady]);

  return (
    <div ref={hostRef} className="ice-photo-hero" aria-hidden="true">
      <div className="ice-cube-hero__layout ice-photo-hero__layout">
        <div className="ice-photo-hero__object">
          <img
            className="ice-photo-hero__image ice-photo-hero__image--base"
            src="/hero/pexels-cottonbro-9694195.jpg"
            alt=""
            draggable="false"
          />
          <img
            className="ice-photo-hero__image ice-photo-hero__image--light"
            src="/hero/pexels-cottonbro-9694195.jpg"
            alt=""
            draggable="false"
          />
          <span className="ice-photo-hero__glint" />
        </div>
      </div>
    </div>
  );
}
