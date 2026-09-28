import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkDrift } from '../lib/workDriftScene';
import { approach, clamp, prefersReduced } from '../lib/smooth';
import './work.css';

/**
 * PORTFOLIO — SCROLL
 *
 * 프로젝트마다 이름, 번호, 드라이아이스 표본이 한 덩어리로 묶여 끝없이 흘러간다.
 * 이름이나 표본을 가리키면 표본이 승화하듯 사라지고 뒤에서 큰 미리보기가 열린다.
 * 누르면 그 미리보기가 화면 전체로 열리며 프로젝트로 들어간다.
 * 뒤에는 드라이아이스 파편이 깊이별로 다른 속도로 떠다닌다.
 */

/* 덩어리 배치 — x 는 덩어리의 왼쪽 위치(vw), lines 는 [글자, 덩어리 안 들여쓰기(em)].
   덩어리끼리는 좌우로 엇갈리고, 덩어리 안의 줄은 바짝 붙는다. */
const BLOCKS = {
  odit: { x: 34, lines: [['ODIT', 0]] },
  tchaikim: { x: 9, lines: [['TCHAI', 0], ['KIM', 0.9]] },
  nuri: { x: 30, lines: [['문화누리', 0], ['카드', 0.55]] },
  walga: { x: 12, lines: [['왈가', 0], ['왈봇', 0.7]] },
};

/* 원래 FIELD 에 있던 네 개의 드라이아이스 표본 — 이제 각 이름 덩어리에 붙어 다닌다 */
const SPECIMEN = {
  odit: { src: '/specimens/odit-cut.png', w: 24, x: 62, y: -6 },
  tchaikim: { src: '/specimens/tchaikim-cut.png', w: 20, x: 70, y: -2 },
  nuri: { src: '/specimens/nuri-cut.png', w: 20, x: 74, y: 8 },
  walga: { src: '/specimens/walga-cut.png', w: 27, x: 58, y: 4 },
};

/* 가운데 창에 비치는 화면. 화면 자료가 없는 프로젝트는 표본 사진으로 둔다. */
const PREVIEW = {
  odit: { kind: 'image', src: '/cases/odit-preview.jpg' },
  tchaikim: { kind: 'video', src: '/cases/tchaikim-scroll.webm', poster: '/cases/tchaikim-scroll-poster.jpg' },
  nuri: { kind: 'image', src: '/specimens/nuri.png', note: 'CASE STUDY IN PREPARATION' },
  walga: { kind: 'image', src: '/cases/walga/boards/01-cover.webp' },
};

const SETS = 3;
const LAUNCH_MS = 820;

/* 알갱이 전환 — 노이즈 값이 문턱보다 큰 픽셀만 남긴다. 밀도 d 가 0 이면 아무것도, 1 이면 전부 보인다.
   실측: 문턱 0.74 에서 약 1%, 0.44 에서 약 65%, 0.2 이하면 전부 남는다. */
const GRAIN_SLOPE = 36;
const grainIntercept = (density) => -(0.74 - 0.54 * density) * GRAIN_SLOPE;
const TEXT_GRAIN = 0.46; // 가리킨 이름은 점이 절반쯤만 남아 이미지 위로 자글자글하게 비친다

/** 글자를 한 자씩 나눈다 — 스크롤로 들어올 때 차례로 올라온다 */
const chars = (text, offset = 0) => [...text].map((char, c) => (
  <span className="work-ch" key={c} style={{ '--c': c + offset }}>{char}</span>
));

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
  const windowRef = useRef(null);
  const imgGrainRef = useRef(null);
  const imgNoiseRef = useRef(null);
  const textGrainRef = useRef(null);
  const textNoiseRef = useRef(null);
  const grain = useRef({ img: 0, text: 0, textIndex: null });

  // 미리보기는 가리킬 때만 열린다
  const shown = hoverIndex;

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

      // 알갱이 — 이미지는 점이 모이며 나타나고, 가리킨 이름은 점으로 흩어진다
      const g = grain.current;
      const hovered = hoverRef.current;
      const launchingNow = launchingRef.current !== null;
      const imgTarget = hovered !== null || launchingNow ? 1 : 0;
      g.img = reduced ? imgTarget : approach(g.img, imgTarget, dt, imgTarget ? 0.2 : 0.09);
      if (hovered !== null) g.textIndex = hovered;
      const textTarget = hovered !== null && !launchingNow ? 1 : 0;
      g.text = reduced ? textTarget : approach(g.text, textTarget, dt, 0.14);
      const jitter = Math.floor(now / 70) % 97; // 바뀌는 동안 점이 살아서 끓어오르게
      const win = windowRef.current;
      if (win) {
        const settledImg = g.img > 0.995;
        win.style.visibility = g.img < 0.004 ? 'hidden' : 'visible';
        win.style.filter = settledImg ? 'none' : 'url(#work-grain-img)';
        imgGrainRef.current?.setAttribute('intercept', grainIntercept(g.img).toFixed(3));
        if (!settledImg) imgNoiseRef.current?.setAttribute('seed', String(jitter));
      }
      const textDensity = 1 - (1 - TEXT_GRAIN) * g.text;
      textGrainRef.current?.setAttribute('intercept', grainIntercept(textDensity).toFixed(3));
      if (g.text > 0.004 && g.text < 0.99) textNoiseRef.current?.setAttribute('seed', String(jitter));
      track.querySelectorAll('.work-row').forEach((row) => {
        const on = g.text > 0.004 && Number(row.dataset.index) === g.textIndex;
        const want = on ? 'url(#work-grain-text)' : '';
        if (row.style.filter !== want) row.style.filter = want;
      });

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

  // 사라지는 동안에도 마지막 프로젝트의 배지와 캡션을 유지한다
  const lastShown = useRef(0);
  if (shown !== null) lastShown.current = shown;
  const previewSpec = specs[lastShown.current];

  return (
    <div
      ref={rootRef}
      className={`work ${launching !== null ? 'is-launching' : ''} ${hoverIndex !== null ? 'is-hovering' : ''}`}
    >
      <div ref={driftHostRef} className="work__drift" aria-hidden="true" />

      <svg className="work__filters" aria-hidden="true" focusable="false">
        <filter id="work-grain-img" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence ref={imgNoiseRef} type="fractalNoise" baseFrequency="0.62" numOctaves="1" seed="2" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="field" />
          <feComponentTransfer in="field" result="mask">
            <feFuncA ref={imgGrainRef} type="linear" slope={GRAIN_SLOPE} intercept={grainIntercept(0)} />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
        <filter id="work-grain-text" x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence ref={textNoiseRef} type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="5" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="field" />
          <feComponentTransfer in="field" result="mask">
            <feFuncA ref={textGrainRef} type="linear" slope={GRAIN_SLOPE} intercept={grainIntercept(1)} />
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
                    <span className="work-row__block" style={{ '--x': `${BLOCKS[spec.id].x}vw` }}>
                      <img
                        className="work-row__specimen work-hit"
                        src={SPECIMEN[spec.id].src}
                        alt=""
                        draggable="false"
                        aria-hidden="true"
                        style={{ '--sw': `${SPECIMEN[spec.id].w}vw`, '--sx': `${SPECIMEN[spec.id].x}%`, '--sy': `${SPECIMEN[spec.id].y}%` }}
                      />
                      <span className="work-row__meta sys" aria-hidden="true" style={{ '--c': 0 }}>
                        <span>{spec.no} / {String(specs.length).padStart(2, '0')}</span>
                        <span>{spec.role}</span>
                        <span>{spec.year}</span>
                      </span>
                      {BLOCKS[spec.id].lines.map(([text, indent], lineIndex, all) => (
                        <span key={text} className="work-row__line work-hit" style={{ '--indent': `${indent}em`, '--l': lineIndex }} aria-hidden="true">
                          {chars(text)}
                          {lineIndex === all.length - 1 && (
                            <span className="work-ch" style={{ '--c': text.length }}><i className="work-row__dot" /></span>
                          )}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <p className="work__foot" aria-hidden="true">
        Selected work 2025 / 2026.<br />UX/UI design and frontend.
      </p>
      <p className="work__scroll sys" aria-hidden="true"><i />SCROLL</p>
    </div>
  );
}
