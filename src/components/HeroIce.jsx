import { useEffect, useRef } from 'react';

/**
 * 메인 첫 화면의 3D 얼음 (SPECIMEN 00).
 * 포트폴리오 표본과 같은 재질이고, 서리를 문질러 닦을 수 있다.
 * exitProgress(스크롤 승화 진행도)에 따라 김으로 풀려 사라진다.
 */
export default function HeroIce({ onReadout, onReady, initialEntrance = false, exitProgress = 0 }) {
  const hostRef = useRef(null);
  const exitRef = useRef(exitProgress);
  exitRef.current = exitProgress;
  const callbacks = useRef({ onReadout, onReady });
  callbacks.current = { onReadout, onReady };

  useEffect(() => {
    let cancelled = false;
    let scene = null;
    import('../lib/heroIceScene').then(({ createHeroIce }) => createHeroIce(hostRef.current, {
      initialEntrance,
      getExit: () => exitRef.current,
      onReadout: (value) => callbacks.current.onReadout?.(value),
      onReady: (value) => callbacks.current.onReady?.(value),
    })).then((created) => {
      if (cancelled) created.dispose();
      else scene = created;
    });
    return () => {
      cancelled = true;
      scene?.dispose();
    };
    // 등장 연출은 처음 마운트될 때 한 번만 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="ice-3d-hero" aria-hidden="true" />;
}
