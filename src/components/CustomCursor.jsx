import { useEffect, useRef } from 'react';
import './cursor.css';

/**
 * CURSOR — 시스템 화살표 옆을 따라다니는 점 하나.
 *
 * K95 의 커서를 옮겨 왔다. 화살표는 그대로 두고(숨기면 느린 기기에서 조작감이 무너진다),
 * difference 로 섞인 흰 점이 약간 늦게 따라온다.
 *   a · button · [data-hover]   점이 속이 빈 링으로 커진다
 *   [data-cursor="LABEL"]        링 오른쪽에 유리 알약 라벨이 한 박자 늦게 붙는다
 *   [data-cursor-off]            그 안에서는 DOM 으로 판단하지 않는다(장면이 직접 알린다)
 *
 * 3D 장면처럼 DOM 이 없는 곳은 이벤트로 알린다.
 *   setCursor({ active: true, label: 'VIEW PROJECT' })  /  setCursor(null)
 */
const EVENT = 'app-cursor';
export const setCursor = (state) => window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));

/* 60fps 기준으로 한 프레임에 남은 거리의 몇 %를 좁히는지. 프레임이 달라도 같은 속도로 느껴지게 dt 로 보정한다. */
const DOT_EASE = 0.16;
const LABEL_EASE = 0.1;
const FRAME = 1000 / 60;
const follow = (ease, dt) => 1 - Math.pow(1 - ease, Math.min(dt, FRAME * 4) / FRAME);

export default function CustomCursor() {
  const dotRef = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dot = dotRef.current;
    const label = labelRef.current;

    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    const tag = { x: -100, y: -100 };
    let dom = null;       // 가리키는 DOM 요소가 정한 상태
    let scene = null;     // 장면이 알려 온 상태 — DOM 보다 우선
    let shown = '';
    let seen = false;
    let raf = 0;
    let last = performance.now();

    const apply = () => {
      const state = scene || dom;
      dot.classList.toggle('is-hovering', Boolean(state?.active));
      const text = state?.label || '';
      if (text) {
        if (text !== shown) label.textContent = text;
        shown = text;
      }
      label.classList.toggle('is-visible', Boolean(text));
    };

    const read = (el) => {
      if (!(el instanceof Element) || el.closest('[data-cursor-off]')) return null;
      const labelled = el.closest('[data-cursor]');
      if (labelled) return { active: true, label: labelled.dataset.cursor };
      if (el.closest('a, button, [data-hover], summary, label[for]')) return { active: true };
      return null;
    };

    const onMove = (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (!seen) {
        // 처음 들어올 때 화면 구석에서 날아오지 않게 제자리에 놓는다
        seen = true;
        Object.assign(pos, target);
        Object.assign(tag, target);
        dot.classList.add('is-on');
      }
    };
    const onOver = (event) => { dom = read(event.target); apply(); };
    const onScene = (event) => { scene = event.detail || null; apply(); };
    const onLeave = () => { seen = false; dot.classList.remove('is-on'); label.classList.remove('is-visible'); };
    const onEnter = () => apply();

    const tick = (now) => {
      const dt = now - last;
      last = now;
      const kd = reduced.matches ? 1 : follow(DOT_EASE, dt);
      const kl = reduced.matches ? 1 : follow(LABEL_EASE, dt);
      pos.x += (target.x - pos.x) * kd;
      pos.y += (target.y - pos.y) * kd;
      tag.x += (target.x - tag.x) * kl;
      tag.y += (target.y - tag.y) * kl;
      dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      label.style.transform = `translate3d(${tag.x + 30}px, ${tag.y}px, 0) translateY(-50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);
    window.addEventListener(EVENT, onScene);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      window.removeEventListener(EVENT, onScene);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor" aria-hidden="true" />
      <div ref={labelRef} className="cursor-label" aria-hidden="true" />
    </>
  );
}
