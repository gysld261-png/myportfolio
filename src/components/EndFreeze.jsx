import { useMemo } from 'react';

/**
 * 엔딩으로 들어가는 길 — 화면이 다시 얼어붙는다.
 * 인트로에서 얼음을 깨고 들어왔으니, 다 보고 나면 다시 얼어붙으며 끝난다.
 * 진행도는 App 이 .app-shell 에 CSS 변수로 쓴다(스크롤에 따라 매 프레임).
 *   --freeze  0 → 1   가장자리부터 서리 결정이 안쪽으로 자라고, 그 뒤로 흐릿한 얼음 막이 번진다
 *   --dark    0 → 1   거의 다 얼면 얼음 너머가 까맣게 가라앉는다
 * 되돌리면 서리가 녹아 물러난다. 결정(성에 가지)은 화면 크기에 맞춰 한 번 만든다.
 */
const rand = (a, b) => a + Math.random() * (b - a);

function grow(w, h) {
  const paths = [];
  const seeds = Math.round((w + h) / 44);
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  // 성에 한 가지 — 창문에 끼는 성에처럼 깃털 모양. 곧게 뻗는 줄기에 60° 로 가는 잔털이 양쪽으로 촘촘히 돋는다
  const branch = (x, y, a, len, depth) => {
    const pts = [[x, y]];
    const steps = Math.max(3, Math.round(len / 10));
    const ticks = [];
    for (let i = 0; i < steps; i += 1) {
      a += rand(-0.08, 0.08);
      const l = len / steps;
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      pts.push([x, y]);
      // 잔털 — 끝으로 갈수록 짧아진다
      const tl = (1 - i / steps) * (depth ? 7 : 13) + 2;
      for (const side of [1, -1]) {
        const ta = a + side * 1.05;
        ticks.push(`M${x.toFixed(1)} ${y.toFixed(1)}L${(x + Math.cos(ta) * tl).toFixed(1)} ${(y + Math.sin(ta) * tl).toFixed(1)}`);
      }
      if (depth === 0 && i > 2 && Math.random() < 0.16) {
        branch(x, y, a + (Math.random() < 0.5 ? 1 : -1) * 1.05, len * rand(0.25, 0.4), 1);
      }
    }
    paths.push({ d: line(pts), w: depth ? 0.6 : 0.9 });
    paths.push({ d: ticks.join(''), w: 0.45 });
  };
  for (let i = 0; i < seeds; i += 1) {
    const t = Math.random();
    const edge = Math.floor(Math.random() * 4);
    // 가장자리의 한 점에서, 안쪽을 향해(조금 비스듬히)
    const [x, y, a] = edge === 0 ? [t * w, -4, Math.PI / 2]
      : edge === 1 ? [w + 4, t * h, Math.PI]
        : edge === 2 ? [t * w, h + 4, -Math.PI / 2]
          : [-4, t * h, 0];
    branch(x, y, a + rand(-0.5, 0.5), rand(70, 230), 0);
  }
  return paths;
}

export default function EndFreeze() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const h = typeof window !== 'undefined' ? window.innerHeight : 900;
  const crystals = useMemo(() => grow(w, h), [w, h]);
  return (
    <div className="end-freeze" aria-hidden="true">
      <div className="end-freeze__ice" />
      <svg className="end-freeze__crystals" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {crystals.map((c, i) => <path key={i} d={c.d} strokeWidth={c.w} />)}
      </svg>
      <div className="end-freeze__dark" />
    </div>
  );
}
