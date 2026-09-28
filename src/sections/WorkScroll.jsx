import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkDrift } from '../lib/workDriftScene';
import { approach, clamp, prefersReduced } from '../lib/smooth';
import './work.css';

/**
 * PORTFOLIO — SCROLL
 *
 * 세 프로젝트가 각각 한 화면을 차지한다.
 * 얼음에 머물면 옆에 미리보기가 열리고, 누르면 얼음 내부로 진입한다.
 * 뒤에는 드라이아이스 파편이 깊이별로 다른 속도로 떠다닌다.
 */

/* 3D 블록의 DOM 앵커 — 실제 표본은 단일 WebGL 캔버스에서 이 위치를 따라간다. */
const SPECIMEN = {
  odit: { w: 34, x: 25, y: -3, ratio: 1.18 },
  tchaikim: { w: 29, x: 28, y: 0, ratio: 0.82 },
  walga: { w: 36, x: 24, y: 2, ratio: 1.12 },
};

/* 가운데 창에 비치는 화면. 화면 자료가 없는 프로젝트는 표본 사진으로 둔다. */
const PREVIEW = {
  odit: { kind: 'image', src: '/cases/odit-preview.jpg' },
  tchaikim: { kind: 'video', src: '/cases/tchaikim-scroll.webm', poster: '/cases/tchaikim-scroll-poster.jpg' },
  walga: { kind: 'image', src: '/cases/walga/boards/01-cover.webp' },
};

const SETS = 1;
const LAUNCH_MS = 1050;
const PREVIEW_DELAY = 620;

/* 알갱이 전환 — 노이즈 값이 문턱보다 큰 픽셀만 남긴다. 밀도 d 가 0 이면 아무것도, 1 이면 전부 보인다.
   실측: 문턱 0.74 에서 약 1%, 0.44 에서 약 65%, 0.2 이하면 전부 남는다. */
const GRAIN_SLOPE = 36;
const grainIntercept = (density) => -(0.74 - 0.54 * density) * GRAIN_SLOPE;

export default function WorkScroll({ specs, activeIndex, onActiveChange, onOpen, paused }) {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const driftHostRef = useRef(null);
  const iceHostRef = useRef(null);
  const iceFieldRef = useRef(null);
  const videoRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [launching, setLaunching] = useState(null);

  const scroll = useRef({ current: 0, target: 0, setHeight: 1, centers: [], ready: false, snapAt: 0 });
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hoverRef = useRef(null);
  const previewRef = useRef(null);
  previewRef.current = previewIndex;
  const launchingRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false });
  const windowRef = useRef(null);
  const imgGrainRef = useRef(null);
  const imgNoiseRef = useRef(null);
  const grain = useRef({ img: 0 });

  // 얼음을 충분히 본 뒤 오른쪽에 미리보기가 열린다.
  const shown = previewIndex;

  useEffect(() => {
    if (hoverIndex === null || launching !== null) {
      setPreviewIndex(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setPreviewIndex(hoverIndex), PREVIEW_DELAY);
    return () => window.clearTimeout(timer);
  }, [hoverIndex, launching]);

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
      const max = Math.max(0, s.setHeight - root.clientHeight);
      s.current = s.target = clamp(s.centers[activeRef.current] - root.clientHeight / 2, 0, max);
      s.ready = true;
    }
  }, []);

  // 네 표본은 렌더러 하나를 공유한다. 무한 스크롤의 복제 행은 DOM 앵커로만 사용한다.
  useEffect(() => {
    let cancelled = false;
    let field = null;
    import('../lib/workIceScene').then(({ createWorkIceField }) => (
      createWorkIceField(iceHostRef.current, rootRef.current, specs.map((spec) => spec.id))
    )).then((created) => {
      if (cancelled) {
        created.dispose();
        return;
      }
      field = created;
      iceFieldRef.current = created;
      created.setPaused(pausedRef.current);
    }).catch(() => {
      // WebGL을 만들 수 없는 환경에서도 텍스트 탐색과 상세 진입은 그대로 동작한다.
    });
    return () => {
      cancelled = true;
      iceFieldRef.current = null;
      field?.dispose();
    };
  }, [specs]);

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
      iceFieldRef.current?.setPaused(pausedRef.current);
      if (pausedRef.current || !s.ready) return;
      const prev = s.current;
      // Igloo처럼 휠 입력을 연속적인 타임라인 값으로 쌓는다. 목표점에 바로 점프하지 않고
      // 약 1초 동안 따라가므로 얼음의 퇴장과 다음 얼음의 진입을 눈으로 볼 수 있다.
      s.current = reduced ? s.target : approach(s.current, s.target, dt, 0.36);
      velocity = approach(velocity, clamp((s.current - prev) / Math.max(dt, 0.001) / 2600, -1, 1), dt, 0.08);

      // 휠을 놓으면 가장 가까운 관찰 지점으로 아주 늦게 정렬한다. 입력 중에는 절대
      // 프로젝트 단위로 강제 점프하지 않아 트랙패드의 작은 움직임도 그대로 보인다.
      if (!reduced && s.snapAt && now >= s.snapAt && Math.abs(s.target - s.current) < root.clientHeight * 0.2) {
        let nearest = 0;
        let nearestDistance = Infinity;
        const targetCenter = s.target + root.clientHeight / 2;
        s.centers.forEach((value, index) => {
          const distance = Math.abs(value - targetCenter);
          if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
        });
        s.target = clamp(s.centers[nearest] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
        s.snapAt = 0;
      }

      const max = Math.max(0, s.setHeight - root.clientHeight);
      s.target = clamp(s.target, 0, max);
      s.current = clamp(s.current, 0, max);
      track.style.transform = `translate3d(0, ${-s.current}px, 0)`;
      root.style.setProperty('--sv', velocity.toFixed(4));
      iceFieldRef.current?.setVelocity(velocity);
      iceFieldRef.current?.setInteraction(hoverRef.current, launchingRef.current);

      // 화면 가운데에 가장 가까운 이름
      const center = s.current + root.clientHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      s.centers.forEach((c, i) => {
        const d = Math.abs(c - center);
        if (d < bestDistance) { bestDistance = d; best = i; }
      });
      if (best !== activeRef.current) onActiveRef.current(best);

      // 레퍼런스처럼 라벨은 표본보다 먼저 흐려지고 중앙 부근에서만 또렷해진다.
      track.querySelectorAll('.work-row').forEach((row, index) => {
        const local = Math.abs((s.centers[index] - center) / Math.max(1, root.clientHeight));
        row.style.setProperty('--focus', (1 - clamp((local - 0.18) / 0.52, 0, 1)).toFixed(3));
      });

      drift.setScroll(s.current, velocity);

      // 알갱이 — 이미지는 점이 모이며 나타나고, 가리킨 이름은 점으로 흩어진다
      const g = grain.current;
      const hovered = previewRef.current;
      const launchingNow = launchingRef.current !== null;
      const imgTarget = hovered !== null || launchingNow ? 1 : 0;
      g.img = reduced ? imgTarget : approach(g.img, imgTarget, dt, imgTarget ? 0.2 : 0.09);
      const jitter = Math.floor(now / 70) % 97; // 바뀌는 동안 점이 살아서 끓어오르게
      const win = windowRef.current;
      if (win) {
        const settledImg = g.img > 0.995;
        win.style.visibility = g.img < 0.004 ? 'hidden' : 'visible';
        win.style.filter = settledImg ? 'none' : 'url(#work-grain-img)';
        imgGrainRef.current?.setAttribute('intercept', grainIntercept(g.img).toFixed(3));
        if (!settledImg) imgNoiseRef.current?.setAttribute('seed', String(jitter));
      }
      // 호버는 글자 위에 있는지로만 판단한다. 글자가 마우스 밑으로 흘러가도 바뀌어야 해서
      // pointerenter 대신 매 프레임(움직임이 있을 때만) 직접 확인한다.
      const p = pointer.current;
      if (launchingRef.current === null && (p.dirty || Math.abs(s.current - prev) > 0.2)) {
        p.dirty = false;
        const line = p.inside ? document.elementFromPoint(p.x, p.y)?.closest('.work-hit') : null;
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
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? root.clientHeight : 1;
      const raw = event.deltaY * unit;
      const delta = clamp(raw, -root.clientHeight * 0.72, root.clientHeight * 0.72);
      s.target = clamp(s.target + delta * 1.12, 0, Math.max(0, s.setHeight - root.clientHeight));
      s.snapAt = performance.now() + 260;
      pointer.current.dirty = true;
    };
    let touchY = null;
    const onPointerDown = (event) => { if (event.pointerType !== 'mouse') touchY = event.clientY; };
    const onPointerMove = (event) => {
      if (event.pointerType === 'mouse') Object.assign(pointer.current, { x: event.clientX, y: event.clientY, inside: true, dirty: true });
      const bounds = root.getBoundingClientRect();
      drift.setPointer((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5);
      iceFieldRef.current?.setPointer((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5);
      if (touchY === null) return;
      s.target = clamp(s.target + (touchY - event.clientY) * 1.6, 0, Math.max(0, s.setHeight - root.clientHeight));
      s.snapAt = 0;
      touchY = event.clientY;
    };
    const onPointerUp = () => {
      if (touchY !== null && s.centers.length) {
        let nearest = 0;
        let distance = Infinity;
        const center = s.target + root.clientHeight / 2;
        s.centers.forEach((value, index) => {
          const nextDistance = Math.abs(value - center);
          if (nextDistance < distance) { nearest = index; distance = nextDistance; }
        });
        activeRef.current = nearest;
        onActiveRef.current(nearest);
        s.target = clamp(s.centers[nearest] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
      }
      touchY = null;
    };
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

  // 화면에 들어오는 덩어리마다 글자가 아래에서 올라온다. 완전히 나가면 다시 내려가 기다린다.
  useEffect(() => {
    const root = rootRef.current;
    const rows = [...trackRef.current.querySelectorAll('.work-row')];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // className 은 React 가 다시 쓰므로(호버 때) 클래스 대신 data 속성에 기록한다
        if (entry.isIntersecting && entry.intersectionRatio > 0.12) entry.target.dataset.in = '';
        else if (!entry.isIntersecting) delete entry.target.dataset.in;
      });
    }, { root, threshold: [0, 0.12] });
    rows.forEach((row) => io.observe(row));
    return () => io.disconnect();
  }, []);

  // 한 번에 정확히 한 프로젝트 장면씩 이동한다.
  const step = useCallback((direction) => {
    const s = scroll.current;
    const root = rootRef.current;
    if (!s.ready || !root) return;
    const next = clamp(activeRef.current + direction, 0, s.centers.length - 1);
    activeRef.current = next;
    onActiveRef.current(next);
    s.target = clamp(s.centers[next] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
  }, []);

  const goTo = useCallback((index) => {
    const s = scroll.current;
    const root = rootRef.current;
    if (!s.ready || !root) return;
    const next = clamp(index, 0, s.centers.length - 1);
    activeRef.current = next;
    onActiveRef.current(next);
    s.target = clamp(s.centers[next] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
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
      setPreviewIndex(null);
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

  // 사라지는 동안에도 마지막 프로젝트의 배지와 캡션을 유지한다
  const lastShown = useRef(0);
  if (shown !== null) lastShown.current = shown;
  const previewSpec = specs[lastShown.current];

  return (
    <div
      ref={rootRef}
      className={`work ${launching !== null ? 'is-launching' : ''} ${hoverIndex !== null ? 'is-hovering' : ''} ${previewIndex !== null ? 'is-previewing' : ''}`}
    >
      <div ref={driftHostRef} className="work__drift" aria-hidden="true" />
      <div ref={iceHostRef} className="work__ice-field" aria-hidden="true" />

      <svg className="work__filters" aria-hidden="true" focusable="false">
        <filter id="work-grain-img" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence ref={imgNoiseRef} type="fractalNoise" baseFrequency="0.62" numOctaves="1" seed="2" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="field" />
          <feComponentTransfer in="field" result="mask">
            <feFuncA ref={imgGrainRef} type="linear" slope={GRAIN_SLOPE} intercept={grainIntercept(0)} />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
      </svg>

      <div className="work__preview" aria-hidden="true">
        <div ref={windowRef} className="work__window">
          {specs.map((spec, index) => {
            const media = PREVIEW[spec.id];
            return (
              <div key={spec.id} className={`work__media work__media--${spec.id} ${index === lastShown.current ? 'is-on' : ''}`}>
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
        <span className="work__badge" key={previewSpec.id}>{lastShown.current + 1} / {specs.length}</span>
        <p className="work__caption">{previewSpec.ko} /<br />{previewSpec.role.replace(' + ', ', ')}</p>
      </div>

      <div className="work__depth" aria-label={`프로젝트 ${activeIndex + 1} / ${specs.length}`}>
        <span className="work__depth-label sys">DEPTH</span>
        <ol>
          {specs.map((spec, index) => (
            <li key={spec.id} className={index === activeIndex ? 'is-active' : ''}>
              <button type="button" onClick={() => goTo(index)} aria-label={`${spec.ko}로 이동`}>0</button>
            </li>
          ))}
        </ol>
        <strong className="sys">{String(activeIndex + 1).padStart(2, '0')} / {String(specs.length).padStart(2, '0')}</strong>
      </div>

      <div className="work__viewport">
        <div ref={trackRef} className="work__track">
          {Array.from({ length: SETS }, (_, set) => (
            <ul key={set} className="work__set">
              {specs.map((spec, index) => (
                <li key={spec.id}>
                  <button
                    type="button"
                    data-project={spec.id}
                    tabIndex={0}
                    className={`work-row work-row--${spec.id} ${index === hoverIndex ? 'is-shown' : ''}`}
                    data-index={index}
                    onFocus={() => { if (launching === null) setHoverIndex(index); }}
                    onBlur={() => { if (launching === null) setHoverIndex(null); }}
                    onClick={() => launch(index)}
                    aria-label={`${spec.no} ${spec.ko} 프로젝트 보기`}
                  >
                    <span className="work-row__block">
                      <span
                        className="work-row__specimen work-hit"
                        aria-hidden="true"
                        data-ice-anchor={spec.id}
                        style={{
                          '--sw': `${SPECIMEN[spec.id].w}vw`,
                          '--sx': `${SPECIMEN[spec.id].x}%`,
                          '--sy': `${SPECIMEN[spec.id].y}%`,
                          '--sar': SPECIMEN[spec.id].ratio,
                        }}
                      />
                      <span className="work-row__meta sys" aria-hidden="true" style={{ '--c': 0 }}>
                        <span>{spec.no} / {String(specs.length).padStart(2, '0')}</span>
                        <span>{spec.role}</span>
                        <span>{spec.year}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <div className="work__ice-entry" aria-hidden="true"><i /><i /></div>

      <p className="work__foot" aria-hidden="true">
        Selected work 2025 / 2026.<br />UX/UI design and frontend.
      </p>
      <p className="work__scroll sys" aria-hidden="true"><i />SCROLL</p>
    </div>
  );
}
