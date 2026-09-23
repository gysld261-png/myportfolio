/**
 * Sublimation field — 캔버스 인터랙션 엔진
 *
 * React 밖에서 requestAnimationFrame 으로 돌아간다.
 * 리렌더 없이 매 프레임 그려야 하므로 컴포넌트는 mount/unmount 만 담당한다.
 *
 * 규칙
 *   커서 거리   → 반응 강도 (입자량 · 가장자리 왜곡 · 투명도 · 라벨 선명도)
 *   커서 속도   → TEMP → 복귀 속도 (입자량이 아니라 "얼마나 오래 유지되는가")
 *   연무        → CO₂ 는 공기보다 무거워 아래로 흘러 바닥에 고인다
 */

const FROST = '175,194,200';
const SURFACE = '21,24,25';

export const DEFAULT_SETTINGS = {
  radius: 320,   // 반응 반경 (px)
  fog: 24,       // 연무량 — 물성보다 앞에 나오지 않게 제한한다
  fall: 48,      // 흐름 무게 — 아래로 깔리는 정도
  density: 34,   // 입자 밀도 — 승화는 연무보다 결정 입자로 읽힌다
  distort: 34,   // 가장자리 왜곡
  stagger: 70,   // 승화 편차 — origin 규칙이 얼마나 벌어지는가
  tin: 400,      // 승화 진입 (ms)
  tout: 700,     // 복귀 (ms) — 진입보다 느려야 여운이 남는다
  temp: 60,      // TEMP 영향도
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const noise = (i, t) =>
  Math.sin(i * 0.61 + t * 1.6) * 0.5 +
  Math.sin(i * 1.77 - t * 2.2) * 0.3 +
  Math.sin(i * 3.41 + t * 0.85) * 0.2;

export function createField(canvas, options) {
  const {
    items = [],
    settings: userSettings = {},
    onState,
    onSelect,
    interactive = true,
    spatial = false,
  } = options;

  const S = { ...DEFAULT_SETTINGS, ...userSettings };
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0;
  let H = 0;
  let DPR = 1;
  let raf = 0;
  let disposed = false;

  /**
   * 연무는 저해상도 오프스크린에 불규칙한 덩어리로 그린 뒤, 한 번에 블러해서 올린다.
   * 개별 puff 를 반투명 원으로 직접 그리면 "블러 먹인 동그라미"로 보인다.
   * 낮은 해상도 + 확대 + 블러를 거쳐야 덩어리끼리 뭉쳐 하나의 연속된 결이 된다.
   */
  const FOG_SCALE = 0.4;
  const fogCanvas = document.createElement('canvas');
  const fogCtx = fogCanvas.getContext('2d');
  const canFilter = typeof ctx.filter === 'string';

  /**
   * spec.image 가 있으면 실루엣 폴리곤을 클립으로 써서 사진을 채운다.
   * 폴리곤은 그대로 승화하므로, 사진이 바깥 가장자리부터 깎여 들어간다.
   * 각 표본은 imageOpacity 로 화면 안에서의 밝기를 독립적으로 맞춘다.
   */
  /* 광원은 좌상단 고정. 제품 사진의 기본이고, 네 표본이 같은 공간에 있다는 게 이걸로 읽힌다.
     y 는 아래로 자라므로 위쪽이 음수다. 림라이트·그림자·엠보스가 전부 이 하나를 본다. */
  const LIGHT = { x: -0.62, y: -0.78 };

  /* 릴리프 버퍼 — 사진 한 장의 부조를 여기서 합성한 뒤 통째로 옮긴다.
     본화면에 바로 겹쳐 그리면 밀어낸 밴드가 사진 밖으로 삐져나와
     느슨한 폴리곤 외곽에 얼룩으로 남는다. source-atop 으로 사진 알파 안에 가둔다. */
  const relief = document.createElement('canvas');
  const rctx = relief.getContext('2d');

  const imageCache = new Map();
  function getImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const entry = { ready: false, canvas: null, near: null, far: null };
    imageCache.set(src, entry);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cc = c.getContext('2d', { willReadFrequently: true });
      cc.drawImage(img, 0, 0);

      /* 네 장의 사진이 서로 다른 노출로 찍혀 있다.
         그대로 쓰면 하나는 밝고 셋은 어두워 같은 공간의 물체로 읽히지 않는다.
         그래서 각 사진의 밝은 쪽 2% 지점을 찾아 같은 밝기로 끌어올린 뒤,
         그 밝기에서 알파(실루엣)를 만든다. 배경이 거의 검으니 밝기 = 실루엣이다. */
      try {
        const data = cc.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        const total = px.length / 4;

        let hasAlpha = false;
        for (let i = 3; i < px.length; i += 4) { if (px[i] < 250) { hasAlpha = true; break; } }

        const hist = new Uint32Array(256);
        for (let i = 0; i < px.length; i += 4) {
          hist[(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0] += 1;
        }
        let acc = 0;
        let hi = 255;
        for (let v = 255; v >= 0; v -= 1) {
          acc += hist[v];
          if (acc > total * 0.02) { hi = v; break; }
        }
        /* 밝은 쪽을 212 근처로. 너무 어두운 사진이 과하게 튀지 않게 상한을 둔다. */
        const gain = Math.min(3.4, 212 / Math.max(28, hi));

        for (let i = 0; i < px.length; i += 4) {
          const r = Math.min(255, px[i] * gain);
          const g = Math.min(255, px[i + 1] * gain);
          const b = Math.min(255, px[i + 2] * gain);
          px[i] = r; px[i + 1] = g; px[i + 2] = b;
          if (!hasAlpha) {
            const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            const a = clamp01((lum - 0.055) / 0.17);
            px[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
          }
        }
        cc.putImageData(data, 0, 0);

        /* ── 깊이 밴드 ──
           네 장 다 정면에서 고르게 찍혀 있어서 빛의 방향이 없다(밝기 무게중심 편차 2% 미만).
           그래서 밝기로 앞뒤를 가른다 — 밝은 데는 빛을 받는 면이니 앞, 어두운 데는 파인 곳이니 뒤.
           이 두 겹을 서로 반대로 밀면 사진 한 장 안에서 두께가 생긴다.
           반 해상도로 만든다. 어차피 흐릿하게 겹칠 레이어라 차이가 안 보인다. */
        const ss = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
        /* tint 가 핵심이다. 밴드를 원래 밝기 그대로 밀면 그냥 번질 뿐 부조가 안 된다.
           앞면은 더 밝게, 뒷면은 더 어둡게 만들어야 밀었을 때 명암 방향이 생긴다. */
        const band = (weight, tint) => {
          const full = document.createElement('canvas');
          full.width = c.width;
          full.height = c.height;
          const fx = full.getContext('2d');
          const bd = fx.createImageData(c.width, c.height);
          const bp = bd.data;
          for (let i = 0; i < px.length; i += 4) {
            bp[i] = Math.min(255, px[i] * tint);
            bp[i + 1] = Math.min(255, px[i + 1] * tint);
            bp[i + 2] = Math.min(255, px[i + 2] * tint);
            const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
            bp[i + 3] = Math.round(px[i + 3] * weight(lum));
          }
          fx.putImageData(bd, 0, 0);
          const half = document.createElement('canvas');
          half.width = Math.max(1, c.width >> 1);
          half.height = Math.max(1, c.height >> 1);
          half.getContext('2d').drawImage(full, 0, 0, half.width, half.height);
          return half;
        };
        entry.near = band((l) => ss(0.52, 0.88, l), 1.55);
        entry.far = band((l) => 1 - ss(0.14, 0.46, l), 0.3);
      } catch (e) {
        /* 다른 출처의 이미지라 픽셀을 못 읽는 경우 — 원본 그대로 쓴다 */
      }

      entry.canvas = c;
      entry.ready = true;
    };
    img.src = src;
    return entry;
  }

  const pointer = { x: -9999, y: -9999, inside: false, speed: 0, lx: 0, ly: 0, lt: 0 };
  const camera = { x: 0, y: 0 };
  const spaceDust = Array.from({ length: 84 }, (_, i) => ({
    x: ((i * 47 + 17) % 109) / 109,
    y: ((i * 71 + 29) % 113) / 113,
    z: 0.08 + (((i * 31) % 97) / 97) * 0.92,
    phase: (i * 2.399963) % (Math.PI * 2),
  }));
  let temp = 0;
  let focusedIndex = -1;

  // ── 각 오브젝트는 자기만의 상태를 갖는다 ──
  const state = items.map(() => ({
    t: 0,
    samples: [],
    particles: [],
    fogs: [],
    box: null,
    /* 던지기 — 배치 좌표에 더해지는 변위와 속도. resize 로 box 가 다시 계산돼도 살아남는다. */
    ox: 0, oy: 0, vx: 0, vy: 0,
    /* 던져진 직후엔 마찰로 뜨거워져 더 빨리 승화한다 */
    throwHeat: 0,
    /* 상세로 들어갈 때 이 덩어리가 쪼개진다 */
    burstAt: 0,
  }));

  /* 파쇄가 끝나기까지. 금이 먼저 보여야 하므로 천천히 간다. */
  const BURST_MS = 1500;

  /* 파편의 방향 — 클릭할 때마다 달라지지 않도록 인덱스로 고정한다 */
  const shardSeed = (i, k) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };

  /* 집어 든 표본 */
  const drag = { i: -1, gx: 0, gy: 0, moved: 0, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0 };
  /* 충격파 — 클릭한 지점에서 퍼져나가 모든 것을 건드린다 */
  const shocks = [];
  let lastFrameAt = 0;

  function shock(x, y, power = 1) {
    shocks.push({ x, y, t: 0, p: power });
    if (shocks.length > 4) shocks.shift();
  }

  function buildItem(item, st) {
    const { spec, cx, cy, w } = item;
    const [vw, vh] = spec.vb;
    const depth = item.z ?? 0.5;
    const perspective = spatial ? 0.81 + depth * 0.26 : 1;
    const width = w * W * perspective;
    const height = (width / vw) * vh;
    const ox = cx * W - width / 2;
    const oy = cy * H - height / 2;
    const scale = width / vw;

    st.box = { x: ox, y: oy, w: width, h: height, cx: cx * W, cy: cy * H };
    if (Number.isFinite(item.fromCx) && Number.isFinite(item.fromCy) && Number.isFinite(item.fromW)) {
      const fromDepth = item.fromZ ?? depth;
      const fromPerspective = spatial ? 0.81 + fromDepth * 0.26 : 1;
      const fromWidth = item.fromW * W * fromPerspective;
      const fromHeight = (fromWidth / vw) * vh;
      st.sourceBox = {
        x: item.fromCx * W - fromWidth / 2,
        y: item.fromCy * H - fromHeight / 2,
        w: fromWidth,
        h: fromHeight,
        cx: item.fromCx * W,
        cy: item.fromCy * H,
      };
      st.enterAt = performance.now();
    } else {
      st.sourceBox = null;
      st.enterAt = 0;
    }
    st.renderBox = st.box;
    st.depth = depth;
    st.samples = [];
    st.fogs = [];
    st.particles = [];

    // 전체 무게중심 — outer 규칙의 기준점
    let gx = 0;
    let gy = 0;
    let n = 0;
    spec.polys.forEach((p) => p.forEach(([x, y]) => { gx += x; gy += y; n += 1; }));
    gx /= n;
    gy /= n;
    let maxD = 0;
    spec.polys.forEach((p) =>
      p.forEach(([x, y]) => { maxD = Math.max(maxD, Math.hypot(x - gx, y - gy)); })
    );

    spec.polys.forEach((poly, pi) => {
      const pts = poly.map(([x, y]) => [ox + x * scale, oy + y * scale]);
      let pcx = 0;
      let pcy = 0;
      pts.forEach(([x, y]) => { pcx += x; pcy += y; });
      pcx /= pts.length;
      pcy /= pts.length;

      const driftAng = (pi * 2.3994) % (Math.PI * 2);
      const phase = Math.abs((Math.sin(pi * 12.9898) * 43758.5453) % 1);

      let perimeter = 0;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      const step = Math.max(3, perimeter / 210);
      const list = [];

      for (let e = 0; e < pts.length; e += 1) {
        const p0 = pts[e];
        const p1 = pts[(e + 1) % pts.length];
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        const count = Math.max(2, Math.round(len / step));
        for (let k = 0; k < count; k += 1) {
          const f = k / count;
          const x = p0[0] + (p1[0] - p0[0]) * f;
          const y = p0[1] + (p1[1] - p0[1]) * f;
          let nx = (p1[1] - p0[1]) / len;
          let ny = -(p1[0] - p0[0]) / len;
          if ((x - pcx) * nx + (y - pcy) * ny < 0) { nx = -nx; ny = -ny; }

          const lx = (x - ox) / scale;
          const ly = (y - oy) / scale;
          let delay;
          if (spec.origin === 'outer') {
            delay = 1 - Math.min(1, Math.hypot(lx - gx, ly - gy) / maxD);
          } else if (spec.origin === 'uniform') {
            delay = 0.04 * Math.abs(Math.sin(list.length * 0.8));
          } else if (spec.origin === 'point') {
            const [px, py] = spec.originPoint;
            delay = Math.min(1, Math.hypot(lx - px, ly - py) / (maxD * 1.7));
          } else {
            delay = phase * 0.75 + 0.12 * Math.abs(Math.sin(list.length * 1.3));
          }

          list.push({
            x, y, nx, ny, delay, poly: pi, p: 0,
            dx: Math.cos(driftAng), dy: Math.sin(driftAng),
          });
        }
      }
      st.samples.push(list);
    });
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    DPR = dpr;
    const nw = canvas.clientWidth;
    const nh = canvas.clientHeight;
    if (!nw || !nh || (nw === W && nh === H)) return;
    W = nw;
    H = nh;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fogCanvas.width = Math.max(1, Math.round(W * FOG_SCALE));
    fogCanvas.height = Math.max(1, Math.round(H * FOG_SCALE));
    items.forEach((item, i) => buildItem(item, state[i]));
  }

  // ── 입력 ──
  function onMove(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const dt = Math.max(8, performance.now() - pointer.lt);
    pointer.speed = pointer.speed * 0.82 + (Math.hypot(x - pointer.lx, y - pointer.ly) / dt) * 0.18;
    pointer.lx = x;
    pointer.ly = y;
    pointer.lt = performance.now();
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;

    if (drag.i >= 0) {
      const st = state[drag.i];
      drag.moved += Math.hypot(x - drag.lx, y - drag.ly);
      const gap = Math.max(8, performance.now() - drag.lt);
      /* 프레임 간격에 상관없이 같은 속도가 나오도록 16.7ms 기준으로 환산한다 */
      drag.vx = drag.vx * 0.55 + ((x - drag.lx) / gap) * 16.7 * 0.45;
      drag.vy = drag.vy * 0.55 + ((y - drag.ly) / gap) * 16.7 * 0.45;
      drag.lx = x;
      drag.ly = y;
      drag.lt = performance.now();
      st.ox = x - drag.gx - st.box.cx;
      st.oy = y - drag.gy - st.box.cy;
    }
  }
  function onLeave() {
    if (drag.i >= 0) { drag.i = -1; canvas.style.cursor = ''; }
    pointer.inside = false;
    pointer.x = -9999;
    pointer.y = -9999;
  }
  function onDown(ev) {
    const hit = nearest();
    if (hit < 0) return;
    const st = state[hit];
    drag.i = hit;
    drag.gx = pointer.x - (st.box.cx + st.ox);
    drag.gy = pointer.y - (st.box.cy + st.oy);
    drag.moved = 0;
    drag.lx = pointer.x;
    drag.ly = pointer.y;
    drag.lt = performance.now();
    drag.vx = 0;
    drag.vy = 0;
    st.vx = 0;
    st.vy = 0;
    canvas.style.cursor = 'grabbing';
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 지원 안 하면 무시 */ }
  }

  function onUp(ev) {
    if (drag.i < 0) return;
    const st = state[drag.i];
    const id = items[drag.i].spec.id;
    const thrown = drag.moved > 7;
    if (thrown) {
      /* 놓은 순간의 속도가 그대로 표본의 속도가 된다 */
      st.vx = clamp(drag.vx, -42, 42);
      st.vy = clamp(drag.vy, -42, 42);
      const power = Math.min(1, Math.hypot(st.vx, st.vy) / 22);
      st.throwHeat = Math.max(st.throwHeat, power);
      shock(pointer.x, pointer.y, 0.55 + power * 0.7);
    } else {
      /* 거의 안 움직였으면 클릭이다.
         얼음에 금이 가고 천천히 벌어진다. 화면은 그 틈으로 밀고 들어간다.
         언제 상세로 넘어갈지는 바깥이 정하므로, 여기선 깨진 지점만 넘긴다. */
      shock(pointer.x, pointer.y, 1);
      st.burstAt = performance.now();
      st.throwHeat = 1;
      if (onSelect) onSelect(id, { x: st.box.cx + st.ox, y: st.box.cy + st.oy });
    }
    drag.i = -1;
    canvas.style.cursor = '';
    try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
  }

  function nearest() {
    if (!pointer.inside) return -1;
    let best = -1;
    let bestD = Infinity;
    state.forEach((st, i) => {
      if (!st.box) return;
      const box = st.renderBox || st.box;
      const d = Math.max(
        0,
        Math.hypot(pointer.x - box.cx, pointer.y - box.cy) - box.w * 0.3
      );
      if (d < S.radius && d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /** 키보드 focus 는 hover 와 동일한 정보 상태를 제공한다. */
  function setFocus(i) { focusedIndex = i; }

  // ── 루프 ──
  function frame(now) {
    if (disposed) return;
    ctx.clearRect(0, 0, W, H);
    fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    const labelQueue = [];

    /* 프레임 간격이 흔들려도 같은 속도로 움직이게 한다 (16.7ms = 1) */
    const dtF = lastFrameAt ? clamp((now - lastFrameAt) / 16.7, 0.2, 3) : 1;
    lastFrameAt = now;

    temp = clamp01(temp * 0.94 + Math.min(1, pointer.speed / 1.6) * 0.06);
    pointer.speed *= 0.93;

    /* ── 던져진 표본의 관성 ──
       CO2 는 무겁다. 위로 뜨지 않고 아래로 가라앉는다.
       다만 포트폴리오의 배치는 정보라서 영구히 망가지면 안 된다.
       멈추면 아주 천천히 제자리로 되돌아가 다시 얼어붙는다. */
    state.forEach((st, i) => {
      if (!st.box || i === drag.i) return;

      const halfW = st.box.w * 0.46;
      const floor = H - st.box.h * 0.36;
      const cyNow = st.box.cy + st.oy;
      const resting = cyNow >= floor - 0.6 && Math.abs(st.vy) < 0.75;
      const speed = Math.hypot(st.vx, st.vy);

      if (speed > 0.07 && !resting) {
        st.vy += 0.052 * dtF;
        st.ox += st.vx * dtF;
        st.oy += st.vy * dtF;
        const f = Math.pow(0.955, dtF);
        st.vx *= f;
        st.vy *= f;

        const cx = st.box.cx + st.ox;
        const cy = st.box.cy + st.oy;
        const ceil = st.box.h * 0.4;
        if (cx < halfW) { st.ox += halfW - cx; st.vx = Math.abs(st.vx) * 0.38; }
        if (cx > W - halfW) { st.ox -= cx - (W - halfW); st.vx = -Math.abs(st.vx) * 0.38; }
        if (cy < ceil) { st.oy += ceil - cy; st.vy = Math.abs(st.vy) * 0.3; }
        if (cy > floor) {
          st.oy -= cy - floor;
          st.vy = -Math.abs(st.vy) * 0.26;
          st.vx *= 0.78;
          if (Math.abs(st.vy) < 0.75) st.vy = 0;
        }
      } else {
        st.vx = 0;
        st.vy = 0;
        /* 되돌아가기 — 눈에 띄게 끌려가지 않을 만큼 느리게 */
        if (Math.abs(st.ox) > 0.5 || Math.abs(st.oy) > 0.5) {
          const k = 1 - Math.pow(0.9885, dtF);
          st.ox -= st.ox * k;
          st.oy -= st.oy * k;
        } else {
          st.ox = 0;
          st.oy = 0;
        }
      }
      st.throwHeat = Math.max(0, st.throwHeat - 0.009 * dtF);
    });

    /* ── 충격파 ── */
    for (let i = shocks.length - 1; i >= 0; i -= 1) {
      const sw = shocks[i];
      sw.t += 0.021 * dtF;
      if (sw.t >= 1) { shocks.splice(i, 1); continue; }
      const r = sw.t * Math.max(W, H) * 0.66;
      /* 파동이 지나가는 표본을 바깥으로 밀어낸다 */
      state.forEach((st, k) => {
        if (!st.box || k === drag.i) return;
        const cx = st.box.cx + st.ox;
        const cy = st.box.cy + st.oy;
        const d = Math.hypot(cx - sw.x, cy - sw.y);
        if (Math.abs(d - r) > 44 || d < 1) return;
        const push = (1 - sw.t) * sw.p * 0.42;
        st.vx += ((cx - sw.x) / d) * push;
        st.vy += ((cy - sw.y) / d) * push;
        st.throwHeat = Math.min(1, st.throwHeat + 0.22 * (1 - sw.t) * sw.p);
      });
    }

    const holdMul = 1 + temp * (S.temp / 100) * 2.2;
    const inRate = 16.7 / Math.max(60, S.tin);
    const outRate = 16.7 / Math.max(80, S.tout * holdMul);
    const spread = 0.15 + (S.stagger / 100) * 1.25;
    const tt = now / 1000;

    const idleCameraX = spatial ? Math.sin(tt * 0.075) * 0.035 : 0;
    const idleCameraY = spatial ? Math.cos(tt * 0.06) * 0.024 : 0;
    const cameraTargetX = spatial && pointer.inside ? pointer.x / W - 0.5 : idleCameraX;
    const cameraTargetY = spatial && pointer.inside ? pointer.y / H - 0.5 : idleCameraY;
    camera.x += (cameraTargetX - camera.x) * 0.035;
    camera.y += (cameraTargetY - camera.y) * 0.035;

    if (spatial) {
      const spaceGlow = ctx.createRadialGradient(W * 0.53, H * 0.52, 0, W * 0.53, H * 0.52, Math.max(W, H) * 0.62);
      spaceGlow.addColorStop(0, 'rgba(175,194,200,0.028)');
      spaceGlow.addColorStop(0.52, 'rgba(175,194,200,0.009)');
      spaceGlow.addColorStop(1, 'rgba(175,194,200,0)');
      ctx.fillStyle = spaceGlow;
      ctx.fillRect(0, 0, W, H);

      spaceDust.forEach((dust) => {
        const drift = 0.18 + dust.z * 0.82;
        const x = dust.x * W - camera.x * 92 * drift + Math.sin(tt * 0.08 + dust.phase) * 4 * drift;
        const y = dust.y * H - camera.y * 68 * drift + Math.cos(tt * 0.07 + dust.phase) * 3 * drift;
        const radius = 0.2 + dust.z * 1.05;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${FROST},${(0.045 + dust.z * 0.17).toFixed(3)})`;
        ctx.fill();
      });
    }

    /* 바닥 — 표본들이 같은 면 위에 있다는 단서.
       CO2 는 공기보다 무거우니 안개도 위가 아니라 여기 깔린다. */
    if (!reduced) {
      const gg = ctx.createLinearGradient(0, H * 0.54, 0, H);
      gg.addColorStop(0, `rgba(${FROST},0)`);
      gg.addColorStop(0.66, `rgba(${FROST},0.022)`);
      gg.addColorStop(1, `rgba(${FROST},0.055)`);
      ctx.fillStyle = gg;
      ctx.fillRect(0, H * 0.54, W, H * 0.46);
    }

    let anyActive = 0;

    items.forEach((item, idx) => {
      const st = state[idx];
      if (!st.box) return;
      const spec = item.spec;
      const depth = st.depth ?? 0.5;
      const fieldAlpha = item.dimmed ? 0.36 : 1;
      const materialAlpha = (spatial ? 0.74 + depth * 0.26 : 1) * fieldAlpha;
      const detailBoost = item.detailFocus ? 1.34 : 1;
      const parallaxX = spatial ? -camera.x * (18 + depth * 54) : 0;
      const parallaxY = spatial ? -camera.y * (12 + depth * 34) + Math.sin(tt * 0.28 + idx * 1.7) * (2 + depth * 4) : 0;
      const depthBreath = spatial
        ? 1 + Math.sin(tt * (0.17 + depth * 0.07) + idx * 1.31) * (0.004 + depth * 0.009)
        : 1;
      const enterRaw = st.sourceBox ? clamp01((now - st.enterAt) / 1050) : 1;
      const enter = enterRaw * enterRaw * (3 - 2 * enterRaw);
      const sourceScale = st.sourceBox ? st.sourceBox.w / st.box.w : 1;
      const focusScale = sourceScale + (1 - sourceScale) * enter;
      /* 던져서 생긴 변위를 배치 좌표에 더한다 */
      const baseCx = st.box.cx + st.ox;
      const baseCy = st.box.cy + st.oy;
      const focusCx = st.sourceBox ? st.sourceBox.cx + (baseCx - st.sourceBox.cx) * enter : baseCx;
      const focusCy = st.sourceBox ? st.sourceBox.cy + (baseCy - st.sourceBox.cy) * enter : baseCy;
      const renderW = st.box.w * depthBreath * focusScale;
      const renderH = st.box.h * depthBreath * focusScale;
      const renderBox = {
        ...st.box,
        x: focusCx - renderW / 2 + parallaxX,
        y: focusCy - renderH / 2 + parallaxY,
        w: renderW,
        h: renderH,
        cx: focusCx + parallaxX,
        cy: focusCy + parallaxY,
      };
      st.renderBox = renderBox;

      /* ── 접지 ──
         떠 있는 물체는 아무리 음영을 넣어도 스티커로 보인다. 눈은 입체를 닿은 자리로 먼저 읽는다.
         표본 아래에 옅은 빛 웅덩이를 깔고, 그 위에 빛 반대쪽으로 누운 그림자를 얹는다.
         던져서 떠오르면 그림자가 넓어지고 옅어진다 — 멀어졌다는 뜻이다. */
      if (!reduced && materialAlpha > 0.06) {
        const lift = clamp01(-st.oy / 150);
        const contact = 0.34 * materialAlpha * (1 - st.t * 0.72) * (1 - lift * 0.6);
        if (contact > 0.012) {
          const baseY = renderBox.y + renderBox.h * 1.0;
          const poolR = renderBox.w * (0.52 + lift * 0.22);
          const flat = Math.max(0.055, 0.085 - depth * 0.02);

          ctx.save();
          ctx.translate(renderBox.cx, baseY);
          ctx.scale(1, flat * 2);

          /* 표본대 — 바닥이 여기 있다는 최소한의 단서 */
          const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, poolR);
          pool.addColorStop(0, `rgba(${FROST},${(contact * 0.16).toFixed(3)})`);
          pool.addColorStop(1, `rgba(${FROST},0)`);
          ctx.fillStyle = pool;
          ctx.beginPath();
          ctx.arc(0, 0, poolR, 0, Math.PI * 2);
          ctx.fill();

          /* 그림자는 빛의 반대쪽으로 눕는다 */
          const shR = renderBox.w * (0.34 + lift * 0.26);
          const shX = -LIGHT.x * renderBox.w * 0.16;
          const shade = ctx.createRadialGradient(shX, 0, 0, shX, 0, shR);
          shade.addColorStop(0, `rgba(0,0,0,${contact.toFixed(3)})`);
          shade.addColorStop(0.52, `rgba(0,0,0,${(contact * 0.42).toFixed(3)})`);
          shade.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = shade;
          ctx.beginPath();
          ctx.arc(shX, 0, shR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      let target = 0;
      if (item.reveal) {
        target = clamp01((now - st.enterAt - 180) / 920) * 0.64;
      } else if (idx === focusedIndex) {
        target = 1;
      } else if (interactive && pointer.inside) {
        const d = Math.max(
          0,
          Math.hypot(pointer.x - renderBox.cx, pointer.y - renderBox.cy) - renderBox.w * 0.3
        );
        const raw = clamp01(1 - d / S.radius);
        target = raw * raw * (3 - 2 * raw);
      }
      /* 던져진 직후엔 마찰열 때문에 커서가 없어도 승화한다 */
      if (st.throwHeat > 0) target = Math.max(target, st.throwHeat * 0.85);
      /* 집고 있는 동안은 손의 열이 직접 닿는다 */
      if (idx === drag.i) target = 1;

      st.t += target > st.t
        ? Math.min(target - st.t, inRate)
        : Math.max(target - st.t, -outRate);
      st.t = clamp01(st.t);
      anyActive = Math.max(anyActive, st.t);

      const amp = (S.distort / 100) * 9;
      const floorY = renderBox.y + renderBox.h * 1.02 + 36;

      // MAIN 오브젝트에만 아주 약한 냉기 halo를 둔다. 연무가 아니라 고체 주변의 빛이다.
      if (item.ambient) {
        const halo = ctx.createRadialGradient(
          renderBox.cx, renderBox.cy, renderBox.w * 0.06,
          renderBox.cx, renderBox.cy, renderBox.w * 0.72
        );
        halo.addColorStop(0, `rgba(${FROST},${(0.045 + st.t * 0.025).toFixed(3)})`);
        halo.addColorStop(0.55, `rgba(${FROST},0.018)`);
        halo.addColorStop(1, `rgba(${FROST},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(
          renderBox.cx - renderBox.w * 0.8,
          renderBox.cy - renderBox.w * 0.8,
          renderBox.w * 1.6,
          renderBox.w * 1.6
        );
      }

      st.samples.forEach((list) => {
        const pts = [];
        for (let i = 0; i < list.length; i += 1) {
          const s = list[i];
          const p = clamp01(st.t * (1 + spread) - s.delay * spread);
          s.p = p;
          const nv = reduced ? 0 : noise(i * 0.5 + s.poly * 7, tt) * amp * p;
          const push = p * 2;
          pts.push([
            focusCx + (s.x - st.box.cx) * depthBreath * focusScale + parallaxX + s.nx * (nv + push),
            focusCy + (s.y - st.box.cy) * depthBreath * focusScale + parallaxY + s.ny * (nv + push),
            p,
          ]);
        }

        // 면 — 승화할수록 옅어진다
        const tex = spec.image ? getImage(spec.image) : null;

        /* ── 파쇄 ──
           덩어리를 중심에서 뻗은 쐐기 조각으로 나눠 각각 다른 방향으로 날린다.
           클립과 그리는 좌표를 같은 양만큼 옮기므로 조각 위의 사진이 어긋나지 않는다.
           무거우니 사방으로 튀지 않고 결국 아래로 간다. */
        const bp = st.burstAt ? clamp01((now - st.burstAt) / BURST_MS) : 0;
        const bursting = st.burstAt > 0 && bp < 1;

        if (tex && tex.ready) {
          const imageOpacity = spec.imageOpacity ?? 0.84;
          const r = spec.imageRect || [0, 0, 1, 1];
          const iw = tex.canvas.width;
          const ih = tex.canvas.height;
          const baseAlpha = Math.max(0, (imageOpacity - st.t * 0.36) * materialAlpha);

          if (bursting) {
            /* 세제곱이라 앞쪽이 거의 멈춰 있다 — 금이 먼저 보이고 그 다음에 벌어진다 */
            const ease = bp * bp * bp;
            /* 갈라진 자리의 빛. 벌어지기 시작할 때 가장 밝고 곧 사라진다. */
            const crack = Math.sin(clamp01(bp * 2.6) * Math.PI) * 0.5;
            const n = pts.length;
            /* 실루엣 점 하나에 조각 하나를 만들면 부챗살이 된다.
               큰 덩어리 예닐곱 개로 쪼개야 얼음이 깨진 것처럼 보인다. */
            const K = 6 + (idx % 3);
            /* 조각마다 시작점이 조금씩 어긋나야 금이 직선으로 안 떨어진다 */
            const edgeAt = (s) => Math.floor(((s + shardSeed(idx, s + 7) * 0.55) / K) * n) % n;

            for (let s = 0; s < K; s += 1) {
              const from = edgeAt(s);
              const to = edgeAt(s + 1);
              const count = (to - from + n) % n || n;

              /* 조각의 무게중심 방향으로 날아간다 */
              let sx = 0;
              let sy = 0;
              for (let k = 0; k <= count; k += 1) {
                const q = pts[(from + k) % n];
                sx += q[0];
                sy += q[1];
              }
              const mx = sx / (count + 1) - renderBox.cx;
              const my = sy / (count + 1) - renderBox.cy;
              const len = Math.max(1, Math.hypot(mx, my));
              const spin = (shardSeed(idx, s) - 0.5) * 0.7;
              const speed = 38 + shardSeed(idx, s + 31) * 66;
              const dx = (mx / len) * speed * ease;
              const dy = (my / len) * speed * ease + 108 * ease * ease;

              ctx.save();
              ctx.translate(renderBox.cx + dx, renderBox.cy + dy);
              ctx.rotate(spin * ease);
              ctx.translate(-renderBox.cx, -renderBox.cy);

              ctx.beginPath();
              ctx.moveTo(renderBox.cx, renderBox.cy);
              for (let k = 0; k <= count; k += 1) {
                const q = pts[(from + k) % n];
                ctx.lineTo(q[0], q[1]);
              }
              ctx.closePath();

              if (crack > 0.02) {
                /* 갈라진 단면 — 조각의 테두리만 얇게 빛난다 */
                ctx.globalAlpha = crack;
                ctx.strokeStyle = 'rgba(206, 232, 248, 1)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.globalAlpha = 1;
              }

              ctx.save();
              ctx.clip();
              /* 화면이 밀고 들어가는 동안은 조각이 남아 있어야 한다 — 끝까지 다 지우지 않는다 */
              ctx.globalAlpha = baseAlpha * (1 - ease * 0.28);
              ctx.drawImage(
                tex.canvas,
                r[0] * iw, r[1] * ih, r[2] * iw, r[3] * ih,
                renderBox.x, renderBox.y, renderBox.w, renderBox.h
              );
              ctx.globalAlpha = 1;
              ctx.restore();

              ctx.restore();
            }
          } else {

          // 사진을 승화 중인 실루엣으로 클립한다 — 가장자리부터 깎여 들어간다
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let a = 1; a < pts.length; a += 1) ctx.lineTo(pts[a][0], pts[a][1]);
          ctx.closePath();
          ctx.clip();
          ctx.globalAlpha = baseAlpha;

          /* ── 두께 ──
             밝은 면은 빛 쪽으로, 어두운 면은 반대로 민다.
             고정 오프셋은 사진에 없는 명암 방향을 만들고(엠보스),
             카메라 시차분은 마우스를 움직일 때 덩어리 안쪽이 따로 밀리게 한다.
             둘을 더해야 튀어나온 면이 실제로 앞에 있는 것처럼 움직인다. */
          const bw = Math.max(2, Math.ceil(renderBox.w * DPR));
          const bh = Math.max(2, Math.ceil(renderBox.h * DPR));
          if (tex.near && tex.far && bw <= 2048 && bh <= 2048) {
            if (relief.width < bw) relief.width = bw;
            if (relief.height < bh) relief.height = bh;
            rctx.setTransform(1, 0, 0, 1, 0, 0);
            rctx.globalCompositeOperation = 'source-over';
            rctx.globalAlpha = 1;
            rctx.clearRect(0, 0, bw, bh);
            rctx.drawImage(tex.canvas, r[0] * iw, r[1] * ih, r[2] * iw, r[3] * ih, 0, 0, bw, bh);

            const emboss = bw * 0.02;
            const par = spatial ? bw * (0.006 + depth * 0.012) : 0;
            const nxo = LIGHT.x * emboss - camera.x * par * 1.4;
            const nyo = LIGHT.y * emboss - camera.y * par * 1.1;
            const nw2 = tex.near.width;
            const nh2 = tex.near.height;

            /* 사진 알파 밖으로는 한 픽셀도 나가지 않는다 */
            rctx.globalCompositeOperation = 'source-atop';
            rctx.globalAlpha = 0.52;
            rctx.drawImage(tex.near, r[0] * nw2, r[1] * nh2, r[2] * nw2, r[3] * nh2,
              nxo, nyo, bw, bh);
            rctx.globalAlpha = 0.44;
            rctx.drawImage(tex.far, r[0] * nw2, r[1] * nh2, r[2] * nw2, r[3] * nh2,
              -nxo, -nyo, bw, bh);
            rctx.globalCompositeOperation = 'source-over';
            rctx.globalAlpha = 1;

            ctx.drawImage(relief, 0, 0, bw, bh,
              renderBox.x, renderBox.y, renderBox.w, renderBox.h);
          } else {
            ctx.drawImage(
              tex.canvas,
              r[0] * iw, r[1] * ih, r[2] * iw, r[3] * ih,
              renderBox.x, renderBox.y, renderBox.w, renderBox.h
            );
          }

          ctx.globalAlpha = 1;
          ctx.restore();
          }
        } else if (!bursting) {
          const fillA = (0.92 - st.t * 0.44) * materialAlpha;
          if (fillA > 0.02) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let a = 1; a < pts.length; a += 1) ctx.lineTo(pts[a][0], pts[a][1]);
            ctx.closePath();
            const solid = ctx.createLinearGradient(
              renderBox.x,
              renderBox.y,
              renderBox.x + renderBox.w,
              renderBox.y + renderBox.h
            );
            solid.addColorStop(0, `rgba(${item.detailFocus ? '74,86,90' : '47,55,58'},${fillA * 0.82})`);
            solid.addColorStop(0.46, `rgba(${item.detailFocus ? '28,34,36' : SURFACE},${fillA})`);
            solid.addColorStop(1, `rgba(8,10,11,${fillA})`);
            ctx.fillStyle = solid;
            ctx.fill();

            // 내부 면은 장식선이 아니라 결정의 밀도와 방향을 보여주는 최소한의 단서다.
            let cx = 0;
            let cy = 0;
            pts.forEach(([x, y]) => { cx += x; cy += y; });
            cx = cx / pts.length + renderBox.w * 0.035;
            cy = cy / pts.length - renderBox.h * 0.055;
            ctx.strokeStyle = `rgba(${FROST},${Math.min(1, Math.max(0, 0.105 - st.t * 0.08) * materialAlpha * detailBoost).toFixed(3)})`;
            ctx.lineWidth = 0.65;
            const facetStops = [0.08, 0.31, 0.57, 0.82];
            for (let f = 0; f < facetStops.length; f += 1) {
              const point = pts[Math.floor((pts.length - 1) * facetStops[f])];
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(point[0], point[1]);
              ctx.stroke();
            }
          }
        }

        // 윤곽 — 승화 중인 구간은 끊긴다. 깨진 뒤엔 온전한 윤곽이 있으면 안 된다.
        if (!bursting) {
        ctx.lineWidth = 1.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const hasTex = Boolean(spec.image);
        for (let b = 0; b < pts.length; b += 1) {
          const c0 = pts[b];
          const c1 = pts[(b + 1) % pts.length];
          const pp = (c0[2] + c1[2]) / 2;
          if (pp > 0.86) continue;
          const edgeBase = (1 - pp * 0.95) * materialAlpha * detailBoost;

          if (hasTex) {
            /* 폴리곤은 사진 실루엣에 딱 붙지 않는 느슨한 껍질이다.
               여기에 선을 그으면 사진 바깥 허공에 선이 남아 스티커가 된다.
               방향성 조명은 릴리프 버퍼가 사진 알파 안에서 이미 만들고 있으므로,
               이 선은 승화로 가장자리가 부서지기 시작할 때만 옅게 나온다. */
            const s0 = list[b];
            const lit = s0.nx * LIGHT.x + s0.ny * LIGHT.y;
            const rimA = Math.min(1, edgeBase * Math.min(0.5, st.t * 1.7) * (0.34 + Math.max(0, lit) * 0.42));
            if (rimA > 0.02) {
              ctx.lineWidth = 1;
              ctx.strokeStyle = `rgba(${FROST},${rimA.toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(c0[0], c0[1]);
              ctx.lineTo(c1[0], c1[1]);
              ctx.stroke();
            }
            continue;
          }

          const alpha = Math.min(1, edgeBase);
          if (alpha <= 0.02) continue;
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = `rgba(${FROST},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(c0[0], c0[1]);
          ctx.lineTo(c1[0], c1[1]);
          ctx.stroke();
        }
        }

        if (reduced) return;

        // 입자
        if (st.particles.length < 900) {
          const rate = (S.density / 100) * 1.5;
          for (let e = 0; e < list.length; e += 2) {
            const s = list[e];
            const active = s.p * (1 - s.p) * 4;
            if (active < 0.05) continue;
            if (Math.random() > rate * active * 0.14) continue;
            const v = 0.1 + Math.random() * 0.3;
            st.particles.push({
              x: pts[e][0], y: pts[e][1],
              vx: s.nx * v + (Math.random() - 0.5) * 0.12,
              vy: s.ny * v + (Math.random() - 0.5) * 0.12 - 0.04,
              life: 1, decay: 0.004 + Math.random() * 0.006,
              r: 0.5 + Math.random() * 1.3,
            });
          }
        }

        // 연무 — 아래쪽 가장자리에서 훨씬 많이 발생한다
        if (S.fog > 0 && st.fogs.length < 220) {
          // 커서 속도는 분출량에만 반영한다 (입자량은 건드리지 않는다 — 화면이 시끄러워진다)
          const gust = 1 + Math.min(0.45, temp * 0.7);
          const rate = (S.fog / 100) * 0.62 * gust;
          // 연무 크기는 오브젝트 크기에 비례한다 — 절대값이면 작은 오브젝트가 파묻힌다
          const unit = Math.max(6, renderBox.w * 0.038);
          for (let e = 0; e < list.length; e += 3) {
            const s = list[e];
            const active = s.p * (1 - s.p) * 4;
            if (active < 0.05) continue;
            const low = 0.2 + 0.8 * clamp01((pts[e][1] - renderBox.y) / renderBox.h);
            // 커서가 실제로 지나간 자리에서 더 많이 피어오른다
            const trail = pointer.inside
              ? 1 + 0.9 * clamp01(1 - Math.hypot(pts[e][0] - pointer.x, pts[e][1] - pointer.y) / 150)
              : 1;
            /* 파쇄 중에는 단면이 통째로 드러나므로 연기가 폭발적으로 나온다 */
            const burstFog = st.burstAt ? 1 + 8 * clamp01(1 - (now - st.burstAt) / BURST_MS) : 1;
            if (Math.random() > rate * low * trail * active * burstFog * 0.11) continue;
            // 하나의 puff 는 원이 아니라 서로 어긋난 3~4개 로브의 덩어리다
            const lobeCount = 3 + (Math.random() < 0.45 ? 1 : 0);
            const lobes = [];
            for (let L = 0; L < lobeCount; L += 1) {
              lobes.push({
                ox: (Math.random() - 0.5) * 1.15,
                oy: (Math.random() - 0.5) * 0.85,
                sx: 0.55 + Math.random() * 0.55,
                sy: 0.5 + Math.random() * 0.5,
                rot: (Math.random() - 0.5) * 1.4,
              });
            }
            st.fogs.push({
              x: pts[e][0], y: pts[e][1],
              vx: s.nx * 0.16 + (Math.random() - 0.5) * 0.34,
              vy: Math.max(0, s.ny * 0.1) + 0.04 + Math.random() * 0.1,
              r: unit * (0.8 + Math.random() * 0.9),
              grow: unit * (0.006 + Math.random() * 0.009),
              life: 1, decay: 0.0042 + Math.random() * 0.0045,
              lobes,
              rot: Math.random() * Math.PI,
              spin: (Math.random() - 0.5) * 0.004,
              seed: Math.random() * 6.28,
              sway: 0.5 + Math.random() * 1.1,
            });
          }
        }
      });

      // 연무 레이어 — 떨어지고, 바닥 밴드에 고이고, 그 아래에서 사라진다
      const g = S.fall / 100;
      const vcap = 0.75 + g * 1.25;
      const bandTop = floorY - 12;
      const bandBottom = floorY + 56;
      for (let i = st.fogs.length - 1; i >= 0; i -= 1) {
        const f = st.fogs[i];
        f.vy += 0.008 + g * 0.02;
        if (f.y > floorY) {
          f.vy *= 0.84;
          f.vx += (f.x < renderBox.cx ? -1 : 1) * (0.01 + g * 0.016);
        }
        if (f.vy > vcap) f.vy = vcap;
        f.vx *= 0.986;
        f.vy *= 0.988;
        // 느린 좌우 흔들림 — 직선으로 떨어지면 연무로 안 읽힌다
        f.x += f.vx + Math.sin(tt * f.sway + f.seed) * 0.22;
        f.y += f.vy;
        f.r += f.grow;
        f.rot += f.spin;

        // 바닥 밴드 안에서는 밀도가 오르고 천천히, 밴드를 지나면 빠르게 사라진다
        let band = 1;
        if (f.y >= bandTop && f.y <= bandBottom) {
          band = 1.25;
          f.life -= f.decay * 0.65;
        } else if (f.y > bandBottom) {
          band = 0.4;
          f.life -= f.decay * 2.6;
        } else {
          f.life -= f.decay;
        }

        if (f.life <= 0) { st.fogs.splice(i, 1); continue; }
        const a = f.life * f.life * 0.075 * band;
        if (a < 0.003) continue;

        // 나이가 들수록 옆으로 퍼지고 납작해진다 — 바닥에 깔린 시트가 된다
        const age = 1 - f.life;
        const wide = 1 + age * 0.9;
        const flat = 1 - age * 0.5;
        const fx = f.x * FOG_SCALE;
        const fy = f.y * FOG_SCALE;
        const rx = f.r * FOG_SCALE * wide;
        const ry = f.r * FOG_SCALE * flat;

        fogCtx.globalAlpha = a;
        fogCtx.fillStyle = 'rgb(198,213,219)';
        for (let L = 0; L < f.lobes.length; L += 1) {
          const lb = f.lobes[L];
          fogCtx.beginPath();
          fogCtx.ellipse(
            fx + lb.ox * rx, fy + lb.oy * ry,
            Math.max(0.5, rx * lb.sx), Math.max(0.4, ry * lb.sy),
            f.rot + lb.rot, 0, Math.PI * 2
          );
          fogCtx.fill();
        }
      }

      // 입자 레이어
      for (let i = st.particles.length - 1; i >= 0; i -= 1) {
        const p = st.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.0016;
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.life -= p.decay;
        if (p.life <= 0) { st.particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${FROST},${(p.life * 0.72 * (0.58 + depth * 0.42)).toFixed(3)})`;
        ctx.fill();
      }

      // 라벨은 연무 위에 그린다 — 효과가 정보를 덮으면 안 된다
      if (item.label !== false && spec.no) {
        labelQueue.push({ spec, box: renderBox, t: st.t, depth });
      }
    });

    // 연무 합성 — 저해상도 덩어리를 한 번에 블러해서 올린다
    if (!reduced) {
      ctx.save();
      if (canFilter) ctx.filter = 'blur(7px)';
      ctx.drawImage(fogCanvas, 0, 0, W, H);
      ctx.restore();
    }

    /* 충격파 링 — 얇은 파문 하나. 두꺼우면 만화가 된다. */
    shocks.forEach((sw) => {
      const r = sw.t * Math.max(W, H) * 0.66;
      const fade = (1 - sw.t) * (1 - sw.t);
      ctx.save();
      ctx.globalAlpha = fade * 0.42 * sw.p;
      ctx.strokeStyle = 'rgba(190, 208, 214, 1)';
      ctx.lineWidth = Math.max(0.5, 2.2 * fade);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    labelQueue.forEach(({ spec, box, t, depth = 0.5 }) => {
      const ly = box.y + box.h + 30;
      ctx.font = '500 10px "Manrope", sans-serif';
      const depthAlpha = spatial ? 0.64 + depth * 0.36 : 1;
      ctx.fillStyle = `rgba(${FROST},${(0.48 + 0.52 * t) * depthAlpha})`;
      ctx.fillText(spec.no, box.x, ly);
      ctx.font = '500 14px "Pretendard Variable", "Manrope", sans-serif';
      ctx.fillStyle = `rgba(241,242,239,${(0.34 + 0.66 * t) * depthAlpha})`;
      ctx.fillText(spec.ko, box.x + 26, ly + 1);
      if (t > 0.18) {
        ctx.font = '400 10px "Manrope", sans-serif';
        ctx.fillStyle = `rgba(140,150,154,${((t - 0.18) / 0.82) * 0.95})`;
        ctx.fillText(`${spec.tag}  /  ${spec.role}  /  ${spec.year}`, box.x + 26, ly + 20);
      }
    });

    if (onState) {
      onState({
        active: anyActive,
        state: anyActive > 0.06 ? 'SUBLIMATING' : 'SOLID',
        temp: temp > 0.62 ? 'HIGH' : temp > 0.24 ? 'MID' : 'LOW',
        tempValue: temp,
      });
    }

    raf = requestAnimationFrame(frame);
  }

  // ── 시작 ──
  resize();
  window.addEventListener('resize', resize);
  // 상세가 열리며 캔버스가 56% 로 줄 때도 좌표를 다시 잡아야 한다 (window resize 로는 안 잡힌다)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  if (interactive) {
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }
  raf = requestAnimationFrame(frame);

  return {
    setFocus,
    resize,
    settings: S,
    /* 상세를 닫고 돌아오면 깨졌던 덩어리가 다시 붙어 있어야 한다 */
    resetBursts() {
      for (let i = 0; i < state.length; i += 1) {
        state[i].burstAt = 0;
        state[i].throwHeat = 0;
      }
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (interactive) {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
      }
    },
  };
}
