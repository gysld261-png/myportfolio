import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Figma 처럼 움직이는 작은 캔버스.
 *   Ctrl(⌘) + 휠 / 트랙패드 핀치   커서 자리를 기준으로 확대·축소
 *   휠                             위아래 이동 (트랙패드는 가로도)
 *   Shift + 휠                     가로 이동
 *   Space + 드래그 · 그냥 드래그 · 가운데 버튼 드래그   손바닥 이동
 *   Shift + 0 = 100%   Shift + 1 = 화면에 맞춤   + / − = 확대 / 축소 (캔버스 위에 커서가 있을 때)
 *
 * 내용은 '디자인 좌표'(width × height)로 그리고, 화면에는 view { x, y, s } 로 옮겨 그린다.
 *   world    디자인 좌표 그대로의 내용 — 통째로 확대된다
 *   overlay  (view) => 화면 좌표 레이어 — 글자·선처럼 확대돼도 크기가 그대로여야 하는 것
 * auto     > 0 이면 처음 한 번, 맨 위에서 맨 아래까지 그 시간(ms) 동안 천천히 내려간다. 손을 대면 멈춘다
 */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MAX_SCALE = 4;
const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function PanZoom({ width, height, fit = 'contain', pad = 18, auto = 0, onAutoEnd, onInteract, world, overlay, label }) {
  const rootRef = useRef(null);
  const sizeRef = useRef(null);
  const [view, setView] = useState(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitRef = useRef(null);
  const autoRef = useRef(0);
  const hoverRef = useRef(false);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoOn, setAutoOn] = useState(auto > 0 && !REDUCED);

  const fitView = useCallback((size) => {
    const s = fit === 'width'
      ? (size.w - pad * 2) / width
      : Math.min((size.w - pad * 2) / width, (size.h - pad * 2) / height);
    return { s, x: (size.w - width * s) / 2, y: fit === 'width' ? pad : (size.h - height * s) / 2 };
  }, [fit, pad, width, height]);

  // 내용이 화면 밖으로 다 사라지지 않게 — 가장자리 40px 은 늘 남긴다
  const bound = useCallback((v) => {
    const size = sizeRef.current;
    if (!size) return v;
    const m = 40;
    return { s: v.s, x: clamp(v.x, m - width * v.s, size.w - m), y: clamp(v.y, m - height * v.s, size.h - m) };
  }, [width, height]);

  const stopAuto = useCallback(() => {
    if (autoRef.current) { cancelAnimationFrame(autoRef.current); autoRef.current = 0; }
    setAutoOn(false);
  }, []);

  const touched = useCallback(() => {
    stopAuto();
    onInteract?.();
  }, [onInteract, stopAuto]);

  const zoomAt = useCallback((factor, cx, cy) => {
    const v = viewRef.current;
    const fitS = fitRef.current?.s || v.s;
    const s = clamp(v.s * factor, fitS * 0.5, MAX_SCALE);
    setView(bound({ s, x: cx - (cx - v.x) * (s / v.s), y: cy - (cy - v.y) * (s / v.s) }));
  }, [bound]);

  // 크기 재기 — 처음엔 화면에 맞춘다. 창 크기가 바뀌면 다시 맞춘다
  useLayoutEffect(() => {
    const el = rootRef.current;
    const measure = () => {
      const size = { w: el.clientWidth, h: el.clientHeight };
      if (!size.w || !size.h) return;
      const first = !sizeRef.current;
      const changed = first || size.w !== sizeRef.current.w || size.h !== sizeRef.current.h;
      sizeRef.current = size;
      fitRef.current = fitView(size);
      if (changed) setView(fitRef.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitView]);

  // 처음 한 번 천천히 끝까지 — 끝나면 그 자리에 멈추고 사람이 직접 움직인다
  useEffect(() => {
    if (!auto || !view || autoRef.current || !autoOn) return undefined;
    const size = sizeRef.current;
    const start = view.y;
    const end = Math.min(start, size.h - pad - height * view.s);
    if (end >= start) { setAutoOn(false); onAutoEnd?.(); return undefined; }
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / auto);
      setView((v) => ({ ...v, y: start + (end - start) * ease(t) }));
      if (t < 1) autoRef.current = requestAnimationFrame(step);
      else { autoRef.current = 0; setAutoOn(false); onAutoEnd?.(); }
    };
    autoRef.current = requestAnimationFrame(step);
    return undefined;
  }, [auto, autoOn, view, pad, height, onAutoEnd]);
  useEffect(() => () => { if (autoRef.current) cancelAnimationFrame(autoRef.current); }, []);

  // 휠 — 페이지가 같이 움직이지 않게 passive:false 로 받는다
  useEffect(() => {
    const el = rootRef.current;
    const onWheel = (event) => {
      if (!viewRef.current) return;
      event.preventDefault();
      touched();
      const k = event.deltaMode === 1 ? 16 : 1;
      const dx = event.deltaX * k;
      const dy = event.deltaY * k;
      const v = viewRef.current;
      if (event.ctrlKey || event.metaKey) {
        const r = el.getBoundingClientRect();
        zoomAt(Math.exp(-dy * 0.0024), event.clientX - r.left, event.clientY - r.top);
      } else if (event.shiftKey) {
        setView(bound({ ...v, x: v.x - (dx || dy) }));
      } else {
        setView(bound({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [bound, touched, zoomAt]);

  // 키 — 커서가 캔버스 위에 있을 때만
  useEffect(() => {
    const onDown = (event) => {
      if (!hoverRef.current || !viewRef.current) return;
      const size = sizeRef.current;
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) setSpace(true);
        return;
      }
      if (event.shiftKey && (event.code === 'Digit0' || event.code === 'Numpad0')) {
        event.preventDefault(); touched();
        const v = viewRef.current;
        zoomAt(1 / v.s, size.w / 2, size.h / 2);
      } else if (event.shiftKey && (event.code === 'Digit1' || event.code === 'Numpad1')) {
        event.preventDefault(); touched();
        setView(fitRef.current);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault(); touched();
        zoomAt(1.25, size.w / 2, size.h / 2);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault(); touched();
        zoomAt(1 / 1.25, size.w / 2, size.h / 2);
      }
    };
    const onUp = (event) => { if (event.code === 'Space') setSpace(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [touched, zoomAt]);

  // 손바닥 이동
  const drag = useRef(null);
  const onPointerDown = (event) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target.closest('.pz__bar')) return;
    event.preventDefault();
    touched();
    const v = viewRef.current;
    drag.current = { px: event.clientX, py: event.clientY, x: v.x, y: v.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event) => {
    if (!drag.current) return;
    const d = drag.current;
    setView((v) => bound({ ...v, x: d.x + event.clientX - d.px, y: d.y + event.clientY - d.py }));
  };
  const onPointerUp = () => { drag.current = null; setDragging(false); };

  const zoomButton = (factor) => () => {
    touched();
    const size = sizeRef.current;
    zoomAt(factor, size.w / 2, size.h / 2);
  };

  return (
    <div
      ref={rootRef}
      className={`pz ${space ? 'is-space' : ''} ${dragging ? 'is-dragging' : ''}`}
      onPointerEnter={() => { hoverRef.current = true; }}
      onPointerLeave={() => { hoverRef.current = false; setSpace(false); }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label={label}
    >
      {view && (
        <>
          <div className="pz__world" style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
            {world}
          </div>
          {overlay?.(view)}
        </>
      )}
      <p className={`pz__hint ${autoOn ? 'is-auto' : ''}`} aria-hidden="true">
        {autoOn ? 'AUTO SCROLL · 손을 대면 멈춥니다' : `${IS_MAC ? '⌘' : 'Ctrl'} + 스크롤 확대 · Shift + 스크롤 가로 · Space + 드래그 이동`}
      </p>
      <div className="pz__bar">
        <button type="button" onClick={zoomButton(1 / 1.25)} aria-label="축소">−</button>
        <span>{view ? Math.round(view.s * 100) : 0}%</span>
        <button type="button" onClick={zoomButton(1.25)} aria-label="확대">+</button>
        <button type="button" className="pz__fit" onClick={() => { touched(); setView(fitRef.current); }} aria-label="화면에 맞추기 (Shift+1)">Fit</button>
      </div>
    </div>
  );
}
