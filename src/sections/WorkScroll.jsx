import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkDrift } from '../lib/workDriftScene';
import { approach, clamp, prefersReduced } from '../lib/smooth';
import './work.css';

/**
 * PORTFOLIO — SCROLL
 *
 * 프로젝트 이름이 거대한 글자로 끝없이 흘러간다. 화면 가운데에는 작은 창이 하나 고정되어 있고,
 * 가운데를 지나는 이름(또는 가리킨 이름)의 화면이 그 창에 비친다.
 * 이름을 누르면 창이 화면 전체로 열리며 프로젝트로 들어간다.
 * 뒤에는 드라이아이스 파편이 깊이별로 다른 속도로 떠다닌다.
 */

/* 줄 나눔과 들여쓰기 — 이름마다 다른 자리에 놓여 지그재그로 읽힌다 */
const LINES = {
  odit: [['ODIT', 30]],
  tchaikim: [['TCHAI', 4], ['KIM', 36]],
  nuri: [['문화누리', 30], ['카드', 12]],
  walga: [['왈가', 10], ['왈봇', 44]],
};

/* 가운데 창에 비치는 화면. 화면 자료가 없는 프로젝트는 표본 사진으로 둔다. */
const PREVIEW = {
  odit: { kind: 'image', src: '/cases/odit-preview.jpg' },
  tchaikim: { kind: 'video', src: '/cases/tchaikim-scroll.webm', poster: '/cases/tchaikim-scroll-poster.jpg' },
  nuri: { kind: 'image', src: '/specimens/midjourney/mnuri.png', note: 'IN PREPARATION' },
  walga: { kind: 'image', src: '/cases/walga/boards/01-cover.webp' },
};

const SETS = 3;
const LAUNCH_MS = 820;

export default function WorkScroll({ specs, activeIndex, onActiveChange, onOpen, paused }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const driftHostRef = useRef(null);
  const videoRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [launching, setLaunching] = useState(null);

  const scroll = useRef({ current: 0, target: 0, setHeight: 1, centers: [], ready: false });
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hoverRef = useRef(null);
  const launchingRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false });

  const shown = hoverIndex ?? activeIndex;

  // 첫 세트의 높이와 각 이름의 세로 중심을 잰다
  const measure = useCallback(() => {
    const track = trackRef.current;
    const root = rootRef.current;
    if (!track || !root) return;
    const firstSet = track.children[0];
    const s = scroll.current;
    s.setHeight = firstSet.offsetHeight || 1;
    s.centers = [...firstSet.querySelectorAll('.work-row')].map((row) => row.offsetTop + row.offsetHeight / 2);
    if (!s.ready) {
      s.current = s.target = s.centers[activeRef.current] - root.clientHeight / 2;
      s.ready = true;
    }
  }, []);

  // 루프 — 스크롤 값, 속도, 가운데 이름, 파편
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const reduced = prefersReduced();
    const drift = createWorkDrift(driftHostRef.current);
    const observer = new ResizeObserver(measure);
    observer.observe(track.children[0]);
    observer.observe(root);
    measure();

    const s = scroll.current;
    let last = performance.now();
    let velocity = 0;
    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drift.setPaused(pausedRef.current);
      if (pausedRef.current || !s.ready) return;
      const prev = s.current;
      s.current = reduced ? s.target : approach(s.current, s.target, dt, 0.11);
      velocity = approach(velocity, clamp((s.current - prev) / Math.max(dt, 0.001) / 2600, -1, 1), dt, 0.08);

      const H = s.setHeight;
      const offset = ((s.current % H) + H) % H;
      track.style.transform = `translate3d(0, ${-(offset + H)}px, 0)`;
      root.style.setProperty('--sv', velocity.toFixed(4));

      // 화면 가운데에 가장 가까운 이름
      const center = offset + root.clientHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      s.centers.forEach((c, i) => {
        const d = Math.min(Math.abs(c - center), Math.abs(c + H - center), Math.abs(c - H - center));
        if (d < bestDistance) { bestDistance = d; best = i; }
      });
      if (best !== activeRef.current) onActiveRef.current(best);

      drift.setScroll(s.current, velocity);

      // 호버는 글자 위에 있는지로만 판단한다. 글자가 마우스 밑으로 흘러가도 바뀌어야 해서
      // pointerenter 대신 매 프레임(움직임이 있을 때만) 직접 확인한다.
      const p = pointer.current;
      if (launchingRef.current === null && (p.dirty || Math.abs(s.current - prev) > 0.2)) {
        p.dirty = false;
        const line = p.inside ? document.elementFromPoint(p.x, p.y)?.closest('.work-row__line') : null;
        const next = line ? Number(line.closest('.work-row').dataset.index) : null;
        if (next !== hoverRef.current) {
          hoverRef.current = next;
          setHoverIndex(next);
        }
      }
    };
    frame = requestAnimationFrame(tick);

    const onWheel = (event) => {
      if (pausedRef.current) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? root.clientHeight : 1;
      s.target += event.deltaY * unit;
    };
    let touchY = null;
    const onPointerDown = (event) => { if (event.pointerType !== 'mouse') touchY = event.clientY; };
    const onPointerMove = (event) => {
      if (event.pointerType === 'mouse') Object.assign(pointer.current, { x: event.clientX, y: event.clientY, inside: true, dirty: true });
      const bounds = root.getBoundingClientRect();
      drift.setPointer((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5);
      if (touchY === null) return;
      s.target += (touchY - event.clientY) * 1.6;
      touchY = event.clientY;
    };
    const onPointerUp = () => { touchY = null; };
    const onPointerLeave = () => Object.assign(pointer.current, { inside: false, dirty: true });
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      drift.dispose();
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [measure]);

  // 이름 하나만큼 위아래로
  const step = useCallback((direction) => {
    const s = scroll.current;
    const root = rootRef.current;
    if (!s.ready || !root) return;
    const H = s.setHeight;
    const center = ((((s.target + root.clientHeight / 2) % H) + H) % H);
    const candidates = s.centers.flatMap((c) => [c - H, c, c + H]).sort((a, b) => a - b);
    const next = direction > 0
      ? candidates.find((c) => c > center + 4)
      : [...candidates].reverse().find((c) => c < center - 4);
    if (next !== undefined) s.target += next - center;
  }, []);

  const launch = useCallback((index) => {
    if (launching !== null) return;
    const spec = specs[index];
    setHoverIndex(index);
    hoverRef.current = index;
    launchingRef.current = index;
    setLaunching(index);
    window.setTimeout(() => onOpen(spec.id), prefersReduced() ? 0 : LAUNCH_MS);
  }, [launching, onOpen, specs]);

  // 상세에서 돌아오면 창이 다시 작아진다
  useEffect(() => {
    if (!paused) {
      setLaunching(null);
      launchingRef.current = null;
      hoverRef.current = null;
      setHoverIndex(null);
      pointer.current.dirty = true;
    }
  }, [paused]);

  useEffect(() => {
    if (paused) return undefined;
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select')) return;
      if (['ArrowDown', 'PageDown'].includes(event.key)) { event.preventDefault(); step(1); }
      if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); step(-1); }
      if (event.key === 'Enter' && !event.target.closest('button, a')) { event.preventDefault(); launch(activeRef.current); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [launch, paused, step]);

  // 영상은 창에 비칠 때만 돈다
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const on = !paused && specs[shown]?.id === 'tchaikim';
    if (on) video.play().catch(() => {});
    else video.pause();
  }, [paused, shown, specs]);

  const shownSpec = specs[shown] || specs[0];

  return (
    <div
      ref={rootRef}
      className={`work ${launching !== null ? 'is-launching' : ''} ${hoverIndex !== null ? 'is-hovering' : ''}`}
    >
      <div ref={driftHostRef} className="work__drift" aria-hidden="true" />

      <div className="work__window" aria-hidden="true">
        {specs.map((spec, index) => {
          const media = PREVIEW[spec.id];
          const on = index === shown;
          return (
            <div key={spec.id} className={`work__media work__media--${spec.id} ${on ? 'is-on' : ''}`}>
              {media.kind === 'video' ? (
                <video ref={videoRef} src={media.src} poster={media.poster} muted loop playsInline preload="metadata" />
              ) : (
                <img src={media.src} alt="" draggable="false" />
              )}
              {media.note && <span className="work__media-note sys">{media.note}</span>}
            </div>
          );
        })}
      </div>

      <div className="work__viewport">
        <div ref={trackRef} className="work__track">
          {Array.from({ length: SETS }, (_, set) => (
            <ul key={set} className="work__set" aria-hidden={set !== 1 ? true : undefined}>
              {specs.map((spec, index) => (
                <li key={spec.id}>
                  <button
                    type="button"
                    data-project={set === 1 ? spec.id : undefined}
                    tabIndex={set === 1 ? 0 : -1}
                    className={`work-row work-row--${spec.id} ${index === shown ? 'is-shown' : ''}`}
                    data-index={index}
                    onFocus={() => { if (launching === null) setHoverIndex(index); }}
                    onBlur={() => { if (launching === null) setHoverIndex(null); }}
                    onClick={() => launch(index)}
                    aria-label={`${spec.no} ${spec.ko} 프로젝트 보기`}
                  >
                    <span className="work-row__meta sys" aria-hidden="true">
                      <span>{spec.no}</span>
                      <span>{spec.role} / {spec.year}</span>
                    </span>
                    {LINES[spec.id].map(([text, indent], lineIndex, all) => (
                      <span key={text} className="work-row__line" style={{ '--indent': `${indent}vw` }} aria-hidden="true">
                        {text}
                        {lineIndex === all.length - 1 && <i className="work-row__dot" />}
                      </span>
                    ))}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <p className="work__counter sys" aria-hidden="true">
        <span key={shownSpec.id}>{shownSpec.no}</span> / {String(specs.length).padStart(2, '0')}
      </p>
      <p className="work__foot" aria-hidden="true">
        Selected work 2025 / 2026.<br />UX/UI design and frontend.
      </p>
      <p className="work__scroll sys" aria-hidden="true"><i />SCROLL</p>
    </div>
  );
}
