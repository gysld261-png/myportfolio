import { useCallback, useEffect, useRef, useState } from 'react';
import './intro.css';

/**
 * 인트로 — 두꺼운 얼음판이 갈라져 떨어진다.
 *   1 얼음판   두꺼운 얼음처럼 투명하지만 흐릿한 막이 화면을 덮고, 가장자리부터 서리가 짙어진다(backdrop-filter)
 *   2 금       한 점에서 가는 금이 뻗고, 뒤따라 얼음 속이 하얗게 탁해지는 균열면이 번진다. 얼음판이 묵직하게 한 번 처진다
 *              가만히 두면 가운데서, 먼저 누르면 누른 자리에서
 *   3 깨짐     큼직한 덩어리가 잠깐 버티다 중력에 끌려 무겁게 떨어지고(거의 돌지 않는다), 틈에서 드라이아이스 냉기가 피어오른다
 * 유리처럼 '쨍그랑' 가볍지 않게 — 반짝이·빛 번쩍임 대신 탁한 균열과 무게, 연기.
 * 조각은 금이 가는 순간 그 점을 중심으로 만든다 — 깨지기 전엔 한 장이라 이음매가 보이지 않는다.
 */
const RAYS = 8;           // 방사형 금 — 적을수록 조각이 큼직해 무겁다
const T_WAIT = 2600;      // 얼음판에 서리가 짙어지고 글씨가 읽히는 시간 — 그사이 누르면 그 자리에서 깨진다
const T_CRACK = 900;      // 금 → 균열면이 번지는 시간(얼음판이 묵직하게 처진다)
const T_FALL = 1250;      // 덩어리가 떨어지는 시간(중력 — 처음엔 버티다가 점점 빨리)
const rand = (a, b) => a + Math.random() * (b - a);

// 금이 간 점 P 를 중심으로 조각과 금 선을 만든다.
// 얼음 금은 유리처럼 반듯하지 않다 — 금 선마다 중간점을 두어 삐뚤빼뚤하게, 동심원은 군데군데만, 잔가지 금을 곁들인다.
// 조각은 이 삐뚤빼뚤한 선을 그대로 공유하므로 떨어질 때 금 모양대로 갈라진다.
function shatter(px, py, w, h) {
  const reach = Math.hypot(Math.max(px, w - px), Math.max(py, h - py)) * 1.08;
  const base = rand(0, Math.PI * 2);
  const angles = Array.from({ length: RAYS }, (_, i) => base + (i + rand(-0.32, 0.32)) * ((Math.PI * 2) / RAYS));
  const radii = [0, rand(0.14, 0.2), rand(0.42, 0.52), 1].map((r) => r * reach);
  const R = radii.length;
  const pts = radii.map((r, k) => angles.map((a) => {
    if (k === 0) return [px, py];
    const last = k === R - 1;
    const rr = last ? r : r * rand(0.82, 1.18);
    const aa = a + (last ? 0 : rand(-0.09, 0.09));
    return [px + Math.cos(aa) * rr, py + Math.sin(aa) * rr];
  }));
  // 두 점 사이를 삐뚤빼뚤하게 — 끝점은 그대로 두고 중간을 옆으로 흔든다
  const jag = (a, b, n, amp) => {
    const out = [a];
    const dx = b[0] - a[0]; const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len; const ny = dx / len;
    for (let i = 1; i < n; i += 1) {
      const t = i / n + rand(-0.08, 0.08);
      const o = rand(-amp, amp) * Math.min(1, len / 120);
      out.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
    }
    out.push(b);
    return out;
  };
  // 방사형 금 조각(고리 k → k+1), 동심원 금 조각(ray i → i+1)
  const rayEdge = angles.map((_, i) => radii.slice(0, -1).map((__, k) => jag(pts[k][i], pts[k + 1][i], k === 0 ? 2 : 4, 16)));
  const ringEdge = radii.map((__, k) => angles.map((_, i) => (k === 0 || k === R - 1 ? [pts[k][i], pts[k][(i + 1) % RAYS]] : jag(pts[k][i], pts[k][(i + 1) % RAYS], 3, 12))));

  const shards = [];
  for (let k = 0; k < R - 1; k += 1) {
    for (let i = 0; i < RAYS; i += 1) {
      const j = (i + 1) % RAYS;
      const poly = k === 0
        ? [...rayEdge[i][0], ...ringEdge[1][i].slice(1), ...rayEdge[j][0].slice(0, -1).reverse()]
        : [...rayEdge[i][k], ...ringEdge[k + 1][i].slice(1), ...[...rayEdge[j][k]].reverse().slice(1), ...[...ringEdge[k][i]].reverse().slice(1, -1)];
      const xs = poly.map((p) => p[0]); const ys = poly.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      if (box.x > w || box.y > h || box.x + box.w < 0 || box.y + box.h < 0) continue;
      const c = [xs.reduce((s, v) => s + v, 0) / xs.length, ys.reduce((s, v) => s + v, 0) / ys.length];
      const d = Math.hypot(c[0] - px, c[1] - py);
      const dir = d ? [(c[0] - px) / d, (c[1] - py) / d] : [0, 1];
      // 덩어리는 튀지 않고 떨어진다 — 금 간 점에서 살짝 벌어진 뒤 화면 아래로. 거의 돌지 않는다
      shards.push({
        key: `${k}-${i}`,
        box,
        clip: `polygon(${poly.map((p) => `${(p[0] - box.x).toFixed(1)}px ${(p[1] - box.y).toFixed(1)}px`).join(', ')})`,
        style: {
          '--tx': `${(dir[0] * rand(12, 46) + rand(-24, 24)).toFixed(1)}px`,
          '--ty': `${(h - box.y + rand(140, 380)).toFixed(0)}px`,
          '--tz': `${rand(0, 70).toFixed(0)}px`,
          '--rx': `${rand(-16, 16).toFixed(0)}deg`,
          '--ry': `${rand(-10, 10).toFixed(0)}deg`,
          '--rz': `${rand(-11, 11).toFixed(0)}deg`,
          '--delay': `${Math.round((d / reach) * 280 + (1 - c[1] / h) * 140 + rand(0, 110))}ms`,
          '--dur': `${Math.round(rand(0.88, 1.12) * T_FALL)}ms`,
          '--ox': `${(c[0] - box.x).toFixed(1)}px`,
          '--oy': `${(c[1] - box.y).toFixed(1)}px`,
        },
      });
    }
  }

  const line = (list) => list.map((p, n) => `${n ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  // 보이는 금 — 방사형은 전부(가운데서 바깥으로 이어서), 동심원은 군데군데만
  const rays = rayEdge.map((segs) => line(segs.flatMap((seg, n) => (n ? seg.slice(1) : seg))));
  const rings = [];
  for (let k = 1; k < R - 1; k += 1) {
    ringEdge[k].forEach((seg) => { if (Math.random() < 0.55 + (k === 1 ? 0.3 : 0)) rings.push(line(seg)); });
  }
  // 잔가지 — 방사형 금에서 비스듬히 짧게
  const spurs = [];
  rayEdge.forEach((segs) => {
    segs.slice(1).forEach((seg) => {
      if (Math.random() < 0.55) {
        const at = seg[Math.floor(rand(1, seg.length - 1))];
        const a = Math.atan2(at[1] - py, at[0] - px) + (Math.random() < 0.5 ? 1 : -1) * rand(0.5, 1.1);
        const len = rand(30, 110);
        spurs.push(line(jag(at, [at[0] + Math.cos(a) * len, at[1] + Math.sin(a) * len], 3, 8)));
      }
    });
  });
  // 냉기 — 금 간 자리와 갈라진 틈에서 드라이아이스 연기가 뭉게뭉게 피어오른다
  const vapor = [[px, py, 1.3, 0]];
  rayEdge.forEach((segs) => {
    const seg = segs[1] || segs[0];
    const at = seg[Math.floor(seg.length / 2)];
    if (Math.random() < 0.8) vapor.push([at[0], at[1], rand(0.7, 1.1), rand(60, 260)]);
  });
  const puffs = vapor.map(([x, y, s, dl], i) => ({ key: i, style: { left: x, top: y, '--s': s.toFixed(2), '--d': `${Math.round(dl)}ms` } }));
  return { shards, rays, rings, spurs, puffs, p: [px, py], w, h };
}

// 얼음에 새긴 글씨 — 아이스브레이킹. 얼음판과 한 몸이라 깨질 때 같이 쪼개진다
function Words({ style }) {
  return (
    <div className="intro__words" style={style}>
      <p className="intro__title">Let&apos;s break the ice.</p>
      <p className="intro__sub sys">CLICK TO BREAK</p>
    </div>
  );
}

export default function Intro({ phase = 'active', onLeave }) {
  const [stage, setStage] = useState('pane');   // pane → crack → fall
  const [geo, setGeo] = useState(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const timers = useRef([]);

  const later = (fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); };

  // 금 → 깨짐 → 나가기
  const crack = useCallback((x, y) => {
    if (stageRef.current !== 'pane') return;
    stageRef.current = 'crack';
    const w = window.innerWidth; const h = window.innerHeight;
    setGeo(shatter(x ?? w / 2, y ?? h * 0.5, w, h));
    setStage('crack');
    later(() => setStage('fall'), T_CRACK);
    later(() => onLeave?.(), T_CRACK + T_FALL * 0.6);
  }, [onLeave]);

  // 첫 몇 초는 메인 3D 준비로 화면이 끊긴다 — 부드러워진 뒤(최대 2.5초) 잠시 얼음판을 보여 주고 스스로 깨진다
  useEffect(() => {
    let raf = 0; let prev = 0; let smooth = 0; const born = performance.now();
    const tick = (now) => {
      smooth = prev && now - prev < 34 ? smooth + 1 : 0;
      prev = now;
      if (smooth >= 6 || now - born > 2500) { later(() => crack(), T_WAIT); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const list = timers.current;
    return () => { cancelAnimationFrame(raf); list.forEach((id) => window.clearTimeout(id)); list.length = 0; };
  }, [crack]);

  // 뒤의 메인 얼음이 인트로 아래에서 커서에 반응하지 않게(잡고 돌리기·DRAG 표시) 여기서 멈춘다
  const hold = (event) => event.stopPropagation();
  const onPointerDown = (event) => {
    event.stopPropagation();
    if (event.target.closest('.intro__skip')) return;
    crack(event.clientX, event.clientY);
  };

  return (
    <div className={`intro intro--${phase} intro--${stage}`} role="status" aria-label="포트폴리오 시작" onPointerDown={onPointerDown} onPointerMove={hold} onPointerUp={hold}>
      {/* 깨지기 전 — 한 장의 얼음판. 얼음에 새긴 글씨 */}
      {stage !== 'fall' && <div className="intro__pane" aria-hidden="true"><Words /></div>}

      {/* 깨진 뒤 — 금을 따라 나뉜 조각들. 글씨도 조각마다 제자리 몫을 들고 같이 쪼개진다 */}
      {stage === 'fall' && geo?.shards.map((s) => (
        <div
          key={s.key}
          className="intro__shard"
          aria-hidden="true"
          style={{ left: s.box.x, top: s.box.y, width: s.box.w, height: s.box.h, clipPath: s.clip, ...s.style }}
        >
          <Words style={{ left: -s.box.x, top: -s.box.y, width: geo.w, height: geo.h }} />
        </div>
      ))}

      {/* 갈라지는 순간 — 틈에서 냉기가 피어오른다 */}
      {stage === 'fall' && geo?.puffs.map((f) => <i key={f.key} className="intro__vapor" aria-hidden="true" style={f.style} />)}

      {/* 금 — 가는 금이 먼저, 뒤따라 두꺼운 얼음 속의 탁한 균열면 */}
      {geo && (
        <svg className="intro__cracks" aria-hidden="true">
          <circle className="intro__impact" cx={geo.p[0]} cy={geo.p[1]} r="3" />
          {geo.rays.map((d, i) => <path key={`fr${i}`} className="intro__fracture" d={d} style={{ '--i': i }} />)}
          {geo.rings.map((d, i) => <path key={`fg${i}`} className="intro__fracture intro__fracture--ring" d={d} style={{ '--i': i }} />)}
          {geo.rays.map((d, i) => <path key={`r${i}`} className="intro__crack intro__crack--ray" d={d} style={{ '--i': i }} />)}
          {geo.rings.map((d, i) => <path key={`g${i}`} className="intro__crack intro__crack--ring" d={d} style={{ '--i': i }} />)}
          {geo.spurs.map((d, i) => <path key={`s${i}`} className="intro__crack intro__crack--spur" d={d} style={{ '--i': i }} />)}
        </svg>
      )}

      <button type="button" className="intro__skip sys" onClick={() => crack()}>SKIP</button>
    </div>
  );
}
