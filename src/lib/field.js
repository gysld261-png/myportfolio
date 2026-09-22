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
  const imageCache = new Map();
  function getImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const entry = { ready: false, canvas: null };
    imageCache.set(src, entry);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const cc = c.getContext('2d');
      cc.drawImage(img, 0, 0);
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
  }));

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
  }
  function onLeave() {
    pointer.inside = false;
    pointer.x = -9999;
    pointer.y = -9999;
  }
  function onDown() {
    const hit = nearest();
    if (hit >= 0 && onSelect) onSelect(items[hit].spec.id);
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

    temp = clamp01(temp * 0.94 + Math.min(1, pointer.speed / 1.6) * 0.06);
    pointer.speed *= 0.93;

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
      const focusCx = st.sourceBox ? st.sourceBox.cx + (st.box.cx - st.sourceBox.cx) * enter : st.box.cx;
      const focusCy = st.sourceBox ? st.sourceBox.cy + (st.box.cy - st.sourceBox.cy) * enter : st.box.cy;
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
        if (tex && tex.ready) {
          // 사진을 승화 중인 실루엣으로 클립한다 — 가장자리부터 깎여 들어간다
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let a = 1; a < pts.length; a += 1) ctx.lineTo(pts[a][0], pts[a][1]);
          ctx.closePath();
          ctx.clip();
          const imageOpacity = spec.imageOpacity ?? 0.84;
          ctx.globalAlpha = Math.max(0, (imageOpacity - st.t * 0.36) * materialAlpha);
          // imageRect 는 원본에서 오브젝트가 차지하는 영역(0–1). 여백을 잘라내 실루엣과 맞춘다.
          const r = spec.imageRect || [0, 0, 1, 1];
          const iw = tex.canvas.width;
          const ih = tex.canvas.height;
          ctx.drawImage(
            tex.canvas,
            r[0] * iw, r[1] * ih, r[2] * iw, r[3] * ih,
            renderBox.x, renderBox.y, renderBox.w, renderBox.h
          );
          ctx.globalAlpha = 1;
          ctx.restore();
        } else {
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

        // 윤곽 — 승화 중인 구간은 끊긴다
        ctx.lineWidth = 1.2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (let b = 0; b < pts.length; b += 1) {
          const c0 = pts[b];
          const c1 = pts[(b + 1) % pts.length];
          const pp = (c0[2] + c1[2]) / 2;
          if (pp > 0.86) continue;
          const alpha = Math.min(1, (1 - pp * 0.95) * materialAlpha * detailBoost);
          if (alpha <= 0.02) continue;
          ctx.strokeStyle = `rgba(${FROST},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(c0[0], c0[1]);
          ctx.lineTo(c1[0], c1[1]);
          ctx.stroke();
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
            if (Math.random() > rate * low * trail * active * 0.11) continue;
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
  }
  raf = requestAnimationFrame(frame);

  return {
    setFocus,
    resize,
    settings: S,
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (interactive) {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('pointerdown', onDown);
      }
    },
  };
}
