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
 * 스크롤 속도를 CSS 변수로 흘려보낸다.
 *
 * 관성만으로는 "미끄러진다"까지만 간다. 울렁이려면 화면이 속도를 알아야 한다.
 * 빠르게 내릴수록 이미지가 늘어나고 줄이 기울게, 멈추면 0 으로 돌아오게.
 *
 * --sv   부호 있는 속도 (-1 ~ 1). 방향까지 쓴다.
 * --sva  절대값 (0 ~ 1). 늘어남처럼 방향이 상관없는 곳에 쓴다.
 *
 * 값은 지수 감쇠로 따라가므로 휠이 띄엄띄엄 들어와도 덜컥거리지 않는다.
 *
 * @returns {() => void} 해제 함수
 */
export function attachScrollVelocity(el, { max = 2400, tau = 0.07 } = {}) {
  if (!el || prefersReduced()) return () => {};

  let vel = 0;
  let lastTop = el.scrollTop;
  let lastT = 0;
  let raf = 0;
  let idle = 0;

  const write = () => {
    el.style.setProperty('--sv', vel.toFixed(4));
    el.style.setProperty('--sva', Math.abs(vel).toFixed(4));
  };

  const tick = (now) => {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    lastT = now;

    const top = el.scrollTop;
    const raw = (top - lastTop) / dt;   // px/s
    lastTop = top;

    const target = clamp(raw / max, -1, 1);
    /* 붙을 땐 빠르게, 돌아올 땐 느리게.
       대칭으로 두면 멈추는 순간 딱 끊겨서 울렁이 아니라 딸깍이 된다.
       여운은 되돌아오는 쪽에 있다. */
    const t = Math.abs(target) > Math.abs(vel) ? tau : tau * 2.8;
    vel = approach(vel, target, dt, t);
    write();

    /* 멈춘 뒤에도 바로 끄지 않는다 — 0 으로 돌아오는 동안이 여운이다 */
    if (Math.abs(vel) < 0.003 && Math.abs(raw) < 12) {
      idle += 1;
      if (idle > 8) {
        vel = 0;
        write();
        raf = 0;
        return;
      }
    } else {
      idle = 0;
    }
    raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf) return;
    lastT = 0;
    idle = 0;
    raf = requestAnimationFrame(tick);
  };

  el.addEventListener('scroll', wake, { passive: true });
  return () => {
    if (raf) cancelAnimationFrame(raf);
    el.removeEventListener('scroll', wake);
    el.style.removeProperty('--sv');
    el.style.removeProperty('--sva');
  };
}

/**
 * 스크롤 트리거 — 덩어리가 화면에 들어오면 한 번 올라오며 드러나고,
 * 사진은 지나가는 동안 프레임 안에서 스크롤보다 느리게 흐른다(패럴랙스).
 *
 * GSAP ScrollTrigger 를 들이지 않는 이유: 관성 스크롤·속도 울렁임이 이미 이 파일에 있고,
 * 필요한 건 "들어왔다(is-in)"와 "지금 어디쯤(--py)" 두 값뿐이다.
 *
 * --py   -1(화면 아래) ~ 1(화면 위). 사진이 화면 가운데일 때 0.
 *
 * @returns {() => void} 해제 함수
 */
export function attachScrollReveal(el, {
  selector = '[data-reveal]',
  parallax = '.shot',
} = {}) {
  if (!el || prefersReduced()) return () => {};

  el.classList.add('has-reveal');
  const items = [...el.querySelectorAll(selector)];

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);   // 한 번 드러난 건 다시 숨기지 않는다 — 되돌아 읽을 때 방해된다
    });
  }, { root: el, rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  items.forEach((item) => io.observe(item));

  /* 패럴랙스는 화면 안에 있는 사진만 계산한다 */
  const shots = [...el.querySelectorAll(parallax)];
  const visible = new Set();
  const vio = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    schedule();
  }, { root: el, rootMargin: '20% 0px' });
  shots.forEach((shot) => vio.observe(shot));

  let raf = 0;
  const sync = () => {
    raf = 0;
    const view = el.getBoundingClientRect();
    const mid = view.top + view.height / 2;
    visible.forEach((shot) => {
      const box = shot.getBoundingClientRect();
      const center = box.top + box.height / 2;
      const p = clamp((mid - center) / ((view.height + box.height) / 2), -1, 1);
      shot.style.setProperty('--py', p.toFixed(4));
    });
  };
  function schedule() {
    if (!raf) raf = requestAnimationFrame(sync);
  }

  el.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    vio.disconnect();
    el.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    el.classList.remove('has-reveal');
    items.forEach((item) => item.classList.remove('is-in'));
    shots.forEach((shot) => shot.style.removeProperty('--py'));
  };
}

/**
 * 스크롤 컨테이너에 관성을 입힌다.
 * 휠만 가로챈다 — 터치는 OS 관성이 이미 좋아서 건드리지 않는다.
 *
 * @returns {() => void} 해제 함수
 */
export function attachSmoothScroll(el, { tau = 0.19, multiplier = 1, controls = null } = {}) {
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
  // 직접 스크롤 위치를 잡는 동안 남은 휠 관성이 다시 끌어당기지 않게 한다.
  const takeControl = () => { stop(); target = el.scrollTop; };

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('scroll', sync, { passive: true });
  controls?.addEventListener('pointerdown', takeControl, true);
  controls?.addEventListener('keydown', takeControl, true);

  return () => {
    stop();
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('scroll', sync);
    controls?.removeEventListener('pointerdown', takeControl, true);
    controls?.removeEventListener('keydown', takeControl, true);
  };
}
