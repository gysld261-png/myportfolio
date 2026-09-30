import { useEffect, useRef, useState } from 'react';

/* 드라이아이스의 승화점과 사람의 체온 — CONTACT 가 열리면 그 사이를 오간다 */
export const COLD = -78.5;
export const WARM = 36.5;
/* 데워지는 데는 시간이 걸린다 — 천천히 오르기 시작해 빨라졌다가 체온 근처에서 늦춰진다 */
const DURATION = 1500;

const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** warm 이 바뀌면 현재 온도에서 목표 온도까지 숫자를 굴린다. 모션 감소 설정에서는 바로 도착한다. */
export default function useWarmth(warm) {
  const [temp, setTemp] = useState(warm ? WARM : COLD);
  const tempRef = useRef(temp);
  tempRef.current = temp;

  useEffect(() => {
    const to = warm ? WARM : COLD;
    const from = tempRef.current;
    if (from === to) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTemp(to);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      setTemp(t < 1 ? from + (to - from) * easeInOut(t) : to);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [warm]);

  return temp;
}

/** 0(승화점) → 1(체온). 색·빛·서리선이 이 값을 따라 같이 데워진다 */
export const warmthOf = (t) => Math.min(1, Math.max(0, (t - COLD) / (WARM - COLD)));

/** −78.5°C 처럼 진짜 마이너스 기호로 적는다 */
export const formatTemp = (t) => `${t < 0 ? '−' : ''}${Math.abs(t).toFixed(1)}°C`;
