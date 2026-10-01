import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createWorkDrift } from '../lib/workDriftScene';
import { approach, clamp, prefersReduced } from '../lib/smooth';
import ScrambleText from '../components/ScrambleText';
import { setCursor } from '../components/CustomCursor';
import './work.css';

/**
 * PORTFOLIO — SCROLL
 *
 * 세 프로젝트가 각각 한 화면을 차지한다.
 * 얼음에 머물면 옆에 미리보기가 열리고, 누르면 얼음 내부로 진입한다.
 * 뒤에는 드라이아이스 파편이 깊이별로 다른 속도로 떠다닌다.
 */

/* 3D 블록의 DOM 앵커 — 실제 표본은 단일 WebGL 캔버스에서 이 위치를 따라간다. */
/* 세로로 긴 파편이라 폭은 줄여 화면 높이의 절반 남짓에 들게 한다. ratio 는 클릭 영역의 폭/높이. */
const SPECIMEN = {
  odit: { w: 17, x: 34, y: -3, ratio: 0.72 },
  tchaikim: { w: 15.5, x: 35, y: 0, ratio: 0.62 },
  walga: { w: 17.5, x: 34, y: 2, ratio: 0.76 },
};

/* 가운데 창에 비치는 화면. 화면 자료가 없는 프로젝트는 표본 사진으로 둔다. */
const PREVIEW = {
  odit: { kind: 'image', src: '/cases/odit/main-v1.webp' },
  tchaikim: { kind: 'video', src: '/cases/tchaikim-scroll.webm', poster: '/cases/tchaikim-scroll-poster.jpg' },
  walga: { kind: 'image', src: '/cases/walga/boards/01.webp' },
};

const SETS = 1;
// workIceScene 의 LAUNCH_DURATION 과 같아야 한다. 얼음 쪽은 지연 로딩이라 여기서 따로 둔다.
// 얼음 속으로 천천히 들어간 뒤(약 2.6초) 상세 화면으로 넘어간다.
const LAUNCH_MS = 2600;
const PREVIEW_DELAY = 620;

/* 연기 전환 — 느린 구름 노이즈(fractalNoise, 저주파)의 짙은 곳부터 이미지가 드러난다.
   진행도 p 가 0 이면 문턱이 구름보다 높아 아무것도, 1 이면 전부 보인다.
   경사가 완만해서(알갱이 때의 36 → 7) 경계가 점이 아니라 뭉게뭉게 번진다.
   경계 바로 앞에는 옅은 김(haze)이 먼저 피어오르고, 이미지는 연기에 밀리듯 일렁인다. */
const SMOKE_SLOPE = 5;
const smokeThreshold = (p) => 0.84 - 0.78 * p;         // 구름 값(대략 0.2~0.8) 기준 문턱
const smokeIntercept = (p, lead = 0) => -(smokeThreshold(p) - lead) * SMOKE_SLOPE;
const SMOKE_LEAD = 1.5;                                 // 김이 이미지보다 얼마나 앞서 피어나는지
const SMOKE_WARP = 20;                                   // 드러나는 동안 일렁임(px)

/* 엔딩 — 마지막 프로젝트 뒤로 더 내리는 구간. 마지막 얼음도 앞의 얼음처럼 위로 빠져나가 빈 공간이 되고,
   그만큼 관측창(App)이 닫힌다. 되돌아가지 않는다 — 멈추면 민 만큼 그 자리에 머문다.
   END_WHEEL 휠 px 을 밀면 끝까지(=1). 구간 길이는 화면 높이의 END_TRAVEL 배 */
const END_WHEEL = 2400;  // 승화를 천천히 지켜보게 — 예전(1100)의 두 배 넘게 밀어야 끝난다
const END_TRAVEL = 0.95;
const END_GLIDE = 0.92;  // 이만큼 넘게 밀면 나머지는 저절로 끝까지 — 거의 끝까지 손으로 민다
const END_OMEGA = 1.6;   // 엔딩 구간의 따라붙는 속도 — 목록(4.2)보다 훨씬 무겁게, 민 뒤에도 천천히 풀린다

export default function WorkScroll({ specs, activeIndex, onActiveChange, onOpen, onEnter, paused, onEndProgress, endControlRef, onReady, active = true }) {
  // 엔딩 진행도(0 열림 → 1 닫힘)를 App 에 알린다
  const endProgressRef = useRef(onEndProgress);
  endProgressRef.current = onEndProgress;
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
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useLayoutEffect(() => { iceFieldRef.current?.setPaused(paused); }, [paused]);
  const hoverRef = useRef(null);
  const previewRef = useRef(null);
  previewRef.current = previewIndex;
  const launchingRef = useRef(null);
  const launchTimerRef = useRef(0);
  const pointer = useRef({ x: 0, y: 0, inside: false, dirty: false });
  const windowRef = useRef(null);
  const smokeRefs = useRef({});
  const smokeRef = (key) => (el) => { smokeRefs.current[key] = el; };
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
    const previousHeight = s.viewportHeight || root.clientHeight;
    const previousMax = Math.max(0, s.setHeight - previousHeight);
    s.setHeight = firstSet.offsetHeight || 1;
    s.centers = [...firstSet.querySelectorAll('.work-row')].map((row) => row.offsetTop + row.offsetHeight / 2);
    const height = root.clientHeight;
    if (!s.ready) {
      const max = Math.max(0, s.setHeight - height);
      s.current = s.target = clamp(s.centers[activeRef.current] - height / 2, 0, max);
      s.ready = true;
    } else if (previousHeight !== height) {
      const ratio = height / Math.max(1, previousHeight);
      const max = Math.max(0, s.setHeight - height);
      s.current = s.current > previousMax
        ? max + (s.current - previousMax) * ratio
        : s.current * ratio;
      s.target = s.over > 0 ? max + s.over * height * END_TRAVEL : clamp(s.target * ratio, 0, max);
      s.vel = (s.vel || 0) * ratio;
    }
    s.viewportHeight = height;
  }, []);

  // 표본은 렌더러 하나를 공유한다. 현재 표본부터 준비하고 다른 로고를 기다리지 않는다.
  useEffect(() => {
    let cancelled = false;
    let field = null;
    import('../lib/workIceScene').then(({ createWorkIceField }) => {
      if (cancelled) return;
      const created = createWorkIceField(iceHostRef.current, rootRef.current, specs.map(spec => spec.id), {
        initialIndex: activeRef.current,
        onReady: () => readyRef.current?.(),
      });
      field = created;
      iceFieldRef.current = created;
      created.setPaused(pausedRef.current);
    }).catch(() => {
      // WebGL을 만들 수 없는 환경에서도 텍스트 탐색과 상세 진입은 그대로 동작한다.
      if (!cancelled) readyRef.current?.();
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
      const launchingNow = launchingRef.current !== null;
      drift.setPaused(pausedRef.current || launchingNow);
      iceFieldRef.current?.setPaused(pausedRef.current);
      if (pausedRef.current || !s.ready) return;
      const prev = s.current;
      // 지수 추적(approach)은 출발하는 순간 속도가 가장 빨라 얼음이 가볍게 튕겨 나간다.
      // 임계 감쇠 스프링은 천천히 가속했다가 미끄러지듯 멈춰 질량감이 생긴다.
      // Igloo 실측(넘어간 뒤 0.3초에 다음 얼음이 살짝, 1.3초에 거의 가운데, 약 2초에 정지)에 맞춘 값.
      if (reduced) {
        s.current = s.target;
        s.vel = 0;
      } else {
        const omega = (s.over || 0) > 0 || s.current > Math.max(0, s.setHeight - root.clientHeight) + 1 ? END_OMEGA : (s.snapped ? 3 : 4.2);
        const accel = omega * omega * (s.target - s.current) - 2 * omega * (s.vel || 0);
        s.vel = (s.vel || 0) + accel * dt;
        s.current += s.vel * dt;
      }
      velocity = approach(velocity, clamp((s.current - prev) / Math.max(dt, 0.001) / 2600, -1, 1), dt, 0.08);

      if (!reduced && s.snapAt && now >= s.snapAt && !(s.over > 0)) {
        // 휠을 놓으면 굴린 방향의 다음 프로젝트로 넘어가 가운데에 멈춘다. 제자리로
        // 되돌아가지 않는다. 트랙패드의 아주 작은 떨림(휠 반 칸 미만)만 무시한다.
        const from = s.snapIndex ?? activeRef.current;
        const pushed = s.push || 0;
        const nearest = Math.abs(pushed) > 40
          ? clamp(from + Math.sign(pushed), 0, s.centers.length - 1)
          : from;
        s.push = 0;
        s.snapIndex = nearest;
        s.target = clamp(s.centers[nearest] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
        s.snapAt = 0;
        s.snapped = true; // 목표 프로젝트가 정해지면 관성 대신 가운데에 또렷하게 붙는다
      }

      const max = Math.max(0, s.setHeight - root.clientHeight);
      // 엔딩 구간만큼은 끝을 넘어 더 올라갈 수 있다
      const endDist = root.clientHeight * END_TRAVEL;
      const limit = max + (s.over || 0) * endDist;
      s.target = clamp(s.target, 0, limit);
      s.current = clamp(s.current, 0, Math.max(limit, s.current > max ? s.current : max));
      const endV = clamp((s.current - max) / endDist, 0, 1);
      if (Math.abs(endV - (s.endV ?? 0)) > 0.0005 || (endV === 0 && s.endV > 0)) {
        s.endV = endV;
        endProgressRef.current?.(endV);
      }
      iceFieldRef.current?.setEnd(endV);
      // 엔딩 구간에서는 목록을 더 올리지 않는다 — 마지막 얼음이 가운데 머문 채 승화한다
      track.style.transform = `translate3d(0, ${-Math.min(s.current, max)}px, 0)`;
      root.style.setProperty('--sv', velocity.toFixed(4));
      iceFieldRef.current?.setVelocity(velocity);
      iceFieldRef.current?.setInteraction(hoverRef.current, launchingRef.current);

      // 전환이 시작된 뒤에는 상세 포털과 얼음 장면만 움직이면 된다.
      // 목록 측 DOM 탐색·SVG 필터 갱신·호버 판정을 계속 돌리면 같은 프레임을 두 번 쓴다.
      if (launchingNow) return;

      // 화면 가운데에 가장 가까운 이름
      const center = s.current + root.clientHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      s.centers.forEach((c, i) => {
        const d = Math.abs(c - center);
        if (d < bestDistance) { bestDistance = d; best = i; }
      });
      // 버튼·키보드로 고른 목적지는 도착 전 중간 프로젝트가 가로채지 않는다.
      if (s.programmatic && Math.abs(s.target - s.current) < 2) s.programmatic = false;
      if (!s.programmatic && best !== activeRef.current) onActiveRef.current(best);

      // 레퍼런스처럼 라벨은 표본보다 먼저 흐려지고 중앙 부근에서만 또렷해진다.
      track.querySelectorAll('.work-row').forEach((row, index) => {
        const local = Math.abs((s.centers[index] - center) / Math.max(1, root.clientHeight));
        row.style.setProperty('--focus', (1 - clamp((local - 0.18) / 0.52, 0, 1)).toFixed(3));
      });

      drift.setScroll(s.current, velocity);

      // 연기 — 이미지는 연기가 걷히듯 뭉게뭉게 드러나고, 떠날 때는 다시 연기로 흩어진다
      const g = grain.current;
      const hovered = previewRef.current;
      const imgTarget = hovered !== null || launchingNow ? 1 : 0;
      g.img = reduced ? imgTarget : approach(g.img, imgTarget, dt, imgTarget ? 0.3 : 0.16);
      const win = windowRef.current;
      if (win) {
        const k = g.img; // 0 = 연기 속에 숨음, 1 = 다 드러남
        const settledImg = k > 0.995;
        win.style.visibility = k < 0.004 ? 'hidden' : 'visible';
        win.style.filter = settledImg ? 'none' : 'url(#work-smoke-img)';
        if (!settledImg) {
          const f = smokeRefs.current;
          const t = now / 1000;
          // 구름장 자체가 천천히 흘러야 연기처럼 보인다. 필터 영역 여백(20%) 안에서만 오간다.
          f.offset?.setAttribute('dx', (Math.sin(t * 0.55) * 22).toFixed(1));
          f.offset?.setAttribute('dy', (Math.cos(t * 0.4) * 16 - 6).toFixed(1));
          f.warp?.setAttribute('scale', ((1 - k) * SMOKE_WARP).toFixed(1));
          f.mask?.setAttribute('intercept', smokeIntercept(k).toFixed(3));
          f.front?.setAttribute('intercept', smokeIntercept(k, SMOKE_LEAD).toFixed(3));
          // 김은 전환 한가운데서 가장 짙고, 다 나타났거나 다 사라졌을 땐 없다
          // 어두운 배경 위라 옅으면 회색 덩어리로 읽힌다 — 한가운데선 거의 불투명한 흰 김으로 올린다
          f.haze?.setAttribute('flood-opacity', Math.min(1, 1.25 * Math.sin(Math.PI * k)).toFixed(3));
        }
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

    /* 엔딩 구간을 민다(휠·터치 px). 받아 썼으면 true.
       마지막 프로젝트에 완전히 멈춘 뒤에만 들어간다 — 앞 프로젝트에서 넘어오던 관성(트랙패드)이 곧바로 끌려가지 않게.
       한 번 들어간 뒤엔 위아래 모두 여기서 받는다. 0 까지 돌아오면 원래 스크롤로 돌아간다 */
    const endMax = () => Math.max(0, s.setHeight - root.clientHeight);
    const pushEnd = (delta) => {
      if (!endProgressRef.current || !s.centers.length) return false;
      const lastIndex = s.centers.length - 1;
      const at = s.snapIndex ?? activeRef.current;
      // 마지막 프로젝트 끝에 닿아 있으면 들어간다. 예전엔 '완전히 멈춤(push 0, 속도 0)'까지 기다렸는데,
      // 트랙패드 관성처럼 휠이 계속 들어오면 push 가 0 이 되지 않아 입구에서 영영 막혔다
      const settled = at === lastIndex && s.target >= endMax() - 2 && Math.abs(endMax() - s.current) < 60;
      if (!((s.over || 0) > 0) && !(delta > 0 && settled)) return false;
      s.over = clamp((s.over || 0) + delta / END_WHEEL, 0, 1);
      // 70% 를 넘기면 손을 떼도 끝까지 스르륵 — 반쯤 어두운 채로 멈춰 들어가지 못하는 일이 없게
      if (delta > 0 && s.over > END_GLIDE) s.over = 1;
      s.target = endMax() + s.over * root.clientHeight * END_TRAVEL;
      s.snapAt = 0;
      s.push = 0;
      s.snapped = false;
      s.snapIndex = lastIndex;
      return true;
    };
    if (endControlRef) {
      endControlRef.current = {
        // 엔딩에서 돌아올 때 — 빈 공간이 다시 내려오며 마지막 얼음이 돌아온다
        // 엔딩을 빠져나오던 휠의 남은 관성이 앞 프로젝트까지 끌고 올라가지 않게 잠깐 입력을 쉰다
        rewind: () => { s.over = 0; s.target = endMax(); s.snapped = false; s.push = 0; s.snapAt = 0; s.lockUntil = performance.now() + 900; },
        // 키보드 — 한 번에 끝까지
        close: () => { s.over = 1; s.target = endMax() + root.clientHeight * END_TRAVEL; s.snapAt = 0; s.push = 0; s.snapped = false; },
        // 엔딩 구간에서 프로젝트를 열 때 — 오므라들던 관측창이 상세 위에 남지 않게 거둔다.
        // 전환이 있으면 목록이 제자리로 미끄러지며 창이 열리고, 곧바로 상세로 가면(now) 그 자리에서 연다
        reset: (now = false) => {
          if (!((s.over || 0) > 0) && !(s.endV > 0)) return;
          s.over = 0; s.target = endMax(); s.snapAt = 0; s.push = 0; s.snapped = false;
          if (now) {
            s.current = s.target; s.endV = 0;
            track.style.transform = `translate3d(0, ${-s.current}px, 0)`;
            endProgressRef.current?.(0);
          }
        },
      };
    }

    const onWheel = (event) => {
      if (pausedRef.current) return;
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      s.programmatic = false;
      if (s.lockUntil && performance.now() < s.lockUntil) return;
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? root.clientHeight : 1;
      if (pushEnd(event.deltaY * unit)) { pointer.current.dirty = true; return; }
      // 굴리는 동안은 누적 입력(push)만큼 얼음이 따라 움직이고, 포화 곡선이라 끝으로 갈수록
      // 묵직해진다. 휠을 놓으면 위의 정렬 단계에서 굴린 방향의 다음 프로젝트로 넘어간다.
      s.push = (s.push || 0) + event.deltaY * unit;
      const from = s.snapIndex ?? activeRef.current;
      const base = s.centers[from] - root.clientHeight / 2;
      const offset = Math.sign(s.push) * root.clientHeight * 0.95 * Math.tanh(Math.abs(s.push) / 450);
      s.target = clamp(base + offset, 0, Math.max(0, s.setHeight - root.clientHeight));
      s.snapAt = performance.now() + 220;
      s.snapped = false;
      pointer.current.dirty = true;
    };
    let touchY = null;
    const onPointerDown = (event) => {
      if (!pausedRef.current && event.pointerType !== 'mouse') { touchY = event.clientY; s.programmatic = false; }
    };
    const onPointerMove = (event) => {
      if (pausedRef.current) return;
      if (event.pointerType === 'mouse') Object.assign(pointer.current, { x: event.clientX, y: event.clientY, inside: true, dirty: true });
      const bounds = root.getBoundingClientRect();
      drift.setPointer((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5);
      iceFieldRef.current?.setPointer((event.clientX - bounds.left) / bounds.width - 0.5, (event.clientY - bounds.top) / bounds.height - 0.5);
      if (touchY === null) return;
      // 터치 — 마지막 프로젝트 끝에서 더 끌어올리면 엔딩 구간으로
      const max = endMax();
      const drag = touchY - event.clientY;
      if (s.target >= max - 1 || (s.over || 0) > 0) {
        const lastIndex = s.centers.length - 1;
        if (drag > 0 && !((s.over || 0) > 0)) { s.snapIndex = lastIndex; s.push = 0; s.vel = 0; s.current = s.target; }
        if (pushEnd(drag * 2)) { touchY = event.clientY; return; }
      }
      s.target = clamp(s.target + drag * 1.6, 0, max);
      s.snapAt = 0;
      touchY = event.clientY;
    };
    const onPointerUp = () => {
      if (touchY !== null && !pausedRef.current && !(s.over > 0) && s.centers.length) {
        let nearest = 0;
        let distance = Infinity;
        const center = s.target + root.clientHeight / 2;
        s.centers.forEach((value, index) => {
          const nextDistance = Math.abs(value - center);
          if (nextDistance < distance) { nearest = index; distance = nextDistance; }
        });
        activeRef.current = nearest;
        s.snapIndex = nearest;
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
    const onPointerCancel = () => { touchY = null; };
    window.addEventListener('pointercancel', onPointerCancel);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      drift.dispose();
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
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
    s.snapIndex = next;
    s.push = 0;
    s.snapAt = 0;
    s.snapped = true;
    s.programmatic = true;
    onActiveRef.current(next);
    s.target = clamp(s.centers[next] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
  }, []);

  const goTo = useCallback((index) => {
    const s = scroll.current;
    const root = rootRef.current;
    if (!s.ready || !root) return;
    const next = clamp(index, 0, s.centers.length - 1);
    activeRef.current = next;
    s.snapIndex = next;
    s.push = 0;
    s.snapAt = 0;
    s.snapped = true;
    s.programmatic = true;
    onActiveRef.current(next);
    s.target = clamp(s.centers[next] - root.clientHeight / 2, 0, Math.max(0, s.setHeight - root.clientHeight));
  }, []);

  const launch = useCallback((index) => {
    if (launching !== null) return;
    const spec = specs[index];

    // WebGL 장면이 아직 준비되지 않았으면 보이지 않는 2.6초 전환을 기다리지 않는다.
    // 상세로 즉시 들어가는 편이 늦게 나타나는 얼음보다 안정적이고 예측 가능하다.
    if (!iceFieldRef.current || prefersReduced()) {
      endControlRef?.current?.reset?.(true);
      onOpen(spec.id);
      return;
    }

    endControlRef?.current?.reset?.();
    setHoverIndex(index);
    hoverRef.current = index;
    launchingRef.current = index;
    setLaunching(index);
    // 누르는 즉시 상세 화면을 얼음 속에 준비하고(포털), 얼음을 통과한 뒤 진짜 상세로 넘긴다.
    onEnter?.(spec.id);
    window.clearTimeout(launchTimerRef.current);
    launchTimerRef.current = window.setTimeout(() => {
      launchTimerRef.current = 0;
      endControlRef?.current?.reset?.(true);   // 상세가 열리면 목록이 멈춘다 — 남은 한 조각까지 열어 두고 넘긴다
      onOpen(spec.id);
    }, LAUNCH_MS);
  }, [launching, onEnter, onOpen, specs]);

  useEffect(() => () => window.clearTimeout(launchTimerRef.current), []);

  // 표본 위에 있을 때만 커서가 링 + VIEW PROJECT 로 바뀐다. 누른 뒤에는 바로 거둔다.
  useEffect(() => {
    setCursor(hoverIndex !== null && launching === null && !paused ? { active: true, label: 'VIEW PROJECT' } : null);
  }, [hoverIndex, launching, paused]);
  useEffect(() => () => setCursor(null), []);

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
    if (paused || !active) return undefined;
    const onKey = (event) => {
      if (event.target.closest('input, textarea, select')) return;
      if (['ArrowDown', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        // 마지막 프로젝트에서 한 번 더 내리면 엔딩
        if (activeRef.current === specs.length - 1 && endControlRef?.current) endControlRef.current.close();
        else step(1);
      }
      if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        // 엔딩 구간에 있으면 먼저 빈 공간을 거두고 마지막 얼음으로 돌아온다
        if ((scroll.current.over || 0) > 0 && endControlRef?.current) endControlRef.current.rewind();
        else step(-1);
      }
      if (event.key === 'Enter' && !event.target.closest('button, a')) { event.preventDefault(); launch(activeRef.current); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, launch, paused, specs.length, step]);

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
        {/* 연기 — 구름 노이즈 하나로 ① 드러날 자리(mask) ② 그 앞의 김(haze) ③ 이미지 일렁임(warp)을 모두 만든다.
            영역을 20% 넓혀서 김이 창 밖으로 조금 번지고, 구름장이 흘러도 가장자리가 비지 않게 한다. */}
        <filter id="work-smoke-img" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0065 0.011" numOctaves="4" seed="11" result="cloud" />
          <feOffset ref={smokeRef('offset')} in="cloud" dx="0" dy="0" result="drift" />
          <feDisplacementMap ref={smokeRef('warp')} in="SourceGraphic" in2="drift" scale={SMOKE_WARP} xChannelSelector="R" yChannelSelector="G" result="warped" />
          <feColorMatrix in="drift" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="density" />
          <feComponentTransfer in="density" result="mask">
            <feFuncA ref={smokeRef('mask')} type="linear" slope={SMOKE_SLOPE} intercept={smokeIntercept(0)} />
          </feComponentTransfer>
          <feComponentTransfer in="density" result="front">
            <feFuncA ref={smokeRef('front')} type="linear" slope={SMOKE_SLOPE} intercept={smokeIntercept(0, SMOKE_LEAD)} />
          </feComponentTransfer>
          <feComposite in="front" in2="mask" operator="out" result="band" />
          <feFlood ref={smokeRef('haze')} floodColor="#e4ecef" floodOpacity="0" />
          <feComposite in2="band" operator="in" />
          <feGaussianBlur stdDeviation="6" result="hazeRaw" />
          {/* 창 모양을 크게 흐린 범위 안에서만 김이 남는다 — 필터 영역의 직선 경계가 드러나지 않게 */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="26" result="spread" />
          <feComposite in="hazeRaw" in2="spread" operator="in" result="haze" />
          <feComposite in="warped" in2="mask" operator="in" result="image" />
          <feMerge>
            <feMergeNode in="image" />
            <feMergeNode in="haze" />
          </feMerge>
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

      {/* 깊이 눈금 — 세로 선이 지금 프로젝트까지 차오르고, 눈금 옆 번호·이름을 누르면 그 깊이로 간다 */}
      <nav className="work__depth" aria-label={`프로젝트 ${activeIndex + 1} / ${specs.length}`}>
        <span className="work__depth-label sys">DEPTH</span>
        <ol style={{ '--depth-fill': specs.length > 1 ? activeIndex / (specs.length - 1) : 0 }}>
          {specs.map((spec, index) => (
            <li key={spec.id} className={index === activeIndex ? 'is-active' : ''}>
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-label={`${spec.no} ${spec.ko}로 이동`}
                aria-current={index === activeIndex ? 'step' : undefined}
              >
                <span className="work__depth-no sys">{spec.no}</span>
                <span className="work__depth-name">{spec.ko}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* 줄 전체가 버튼이라 DOM 으로 판단하면 빈 곳에서도 링이 뜬다. 표본 위(hoverIndex)일 때만 직접 알린다. */}
      <div className="work__viewport" data-cursor-off="">
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
                        {/* 클릭하면 라벨이 글리치로 깨지며 사라진다(Igloo). */}
                        <span><ScrambleText mode="out" play={launching === index} duration={620} text={`${spec.no} / ${String(specs.length).padStart(2, '0')}`} /></span>
                        <span><ScrambleText mode="out" play={launching === index} duration={620} delay={60} text={spec.role} /></span>
                        <span><ScrambleText mode="out" play={launching === index} duration={620} delay={120} text={String(spec.year)} /></span>
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
        Selected work 2026.<br />UX/UI design and frontend.
      </p>
      {/* 마지막 프로젝트에선 더 내리면 무엇이 있는지 알려 준다 */}
      <p className={`work__scroll sys ${activeIndex === specs.length - 1 ? 'is-end' : ''}`} aria-hidden="true">
        <i />{activeIndex === specs.length - 1 ? 'KEEP SCROLLING · END' : 'SCROLL'}
      </p>
    </div>
  );
}
