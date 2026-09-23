/**
 * 부드러운 값 추적 / 스크롤.
 *
 * 휠 이벤트는 띄엄띄엄 들어온다. 마우스 휠은 한 번에 크게, 트랙패드는 잘게.
 * 그 값을 화면에 그대로 반영하면 "따다닥" 끊긴다.
 * 그래서 들어온 값은 목표(target)에만 더하고, 실제 값은 매 프레임 목표를 쫓아간다.
 *
 * 프레임레이트에 상관없이 같은 속도로 수렴하도록 지수 감쇠를 쓴다.
 *   k = 1 - exp(-dt / tau)
 * tau 가 작을수록 빠르게 붙고, 클수록 더 미끄러진다.
 */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const approach = (current, target, dt, tau) =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

export const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 스크롤 컨테이너에 관성을 입힌다.
 * 휠만 가로챈다 — 터치는 OS 관성이 이미 좋아서 건드리지 않는다.
 *
 * @returns {() => void} 해제 함수
 */
export function attachSmoothScroll(el, { tau = 0.19, multiplier = 1 } = {}) {
  if (!el || prefersReduced()) return () => {};

  let target = el.scrollTop;
  let raf = 0;
  let last = 0;
  let running = false;

  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const tick = (now) => {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;

    const next = approach(el.scrollTop, target, dt, tau);
    // 1px 아래로 내려오면 멈춘다. 계속 돌면 배터리만 먹는다.
    if (Math.abs(target - next) < 0.4) {
      el.scrollTop = target;
      stop();
      return;
    }
    el.scrollTop = next;
    raf = requestAnimationFrame(tick);
  };

  const onWheel = (e) => {
    // 가로 스크롤이나 확대 제스처는 그대로 둔다
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;

    // deltaMode 0=픽셀, 1=줄, 2=페이지. 브라우저마다 달라서 픽셀로 맞춘다.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
    const delta = e.deltaY * unit * multiplier;

    const nextTarget = clamp(target + delta, 0, max);
    // 끝에 닿았는데 더 밀면 부모(=섹션 전환)에게 넘긴다
    if (nextTarget === target) return;

    e.preventDefault();
    target = nextTarget;

    if (!running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  // 코드가 직접 scrollTop 을 바꾼 경우(프로젝트 전환 등) 목표도 같이 옮긴다
  const sync = () => {
    if (!running) target = el.scrollTop;
  };

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('scroll', sync, { passive: true });

  return () => {
    stop();
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('scroll', sync);
  };
}
