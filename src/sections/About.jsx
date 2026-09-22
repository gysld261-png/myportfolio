import { useRef } from 'react';
import './about.css';

const KEYWORDS = [
  { t: 'HYOMIN', kind: 'core', x: 48, y: 48, size: 36 },
  { t: 'UX/UI', kind: 'solid', x: 23, y: 29, size: 16 },
  { t: 'FRONTEND', kind: 'solid', x: 72, y: 26, size: 16 },
  { t: 'DETAIL', kind: 'solid', x: 76, y: 63, size: 16 },
  /* x 값은 좁은 화면에서 잘리지 않도록 안쪽으로 당겼다.
     (기존 x:9 / x:88 은 375px 에서 'EARLY BIRD', 'BUILD' 가 화면 밖으로 나갔다) */
  { t: 'RESEARCH', kind: 'trace', x: 19, y: 55, size: 13 },
  { t: 'INTERACTION', kind: 'trace', x: 61, y: 78, size: 13 },
  { t: 'ORGANIZE', kind: 'trace', x: 39, y: 69, size: 13 },
  { t: 'BUILD', kind: 'trace', x: 84, y: 43, size: 13 },
  { t: 'EARLY BIRD', kind: 'residue', x: 18, y: 81, size: 12 },
  { t: 'OLD SOUL', kind: 'residue', x: 80, y: 84, size: 12 },
  { t: 'PERSISTENT', kind: 'residue', x: 54, y: 14, size: 12 },
];

const PARTICLES = Array.from({ length: 92 }, (_, i) => ({
  x: (i * 47 + 13) % 97,
  y: (i * 71 + 19) % 93,
  s: 0.7 + ((i * 17) % 4) * 0.45,
  o: 0.08 + ((i * 23) % 48) / 100,
  dx: ((i * 31) % 19) - 9,
  dy: ((i * 43) % 23) - 11,
  duration: 7 + ((i * 13) % 11),
  delay: -((i * 17) % 14),
}));

export default function About({ onGoMain }) {
  const fieldRef = useRef(null);

  const onPointerMove = (event) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    fieldRef.current.style.setProperty('--px', `${x}px`);
    fieldRef.current.style.setProperty('--py', `${y}px`);
    fieldRef.current.style.setProperty('--pointer-active', '1');

    fieldRef.current.querySelectorAll('.about__kw').forEach((node) => {
      const kx = (Number(node.dataset.x) / 100) * rect.width;
      const ky = (Number(node.dataset.y) / 100) * rect.height;
      const dx = kx - x;
      const dy = ky - y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const heat = Math.max(0, 1 - distance / Math.min(260, rect.width * 0.22));
      const force = heat * heat * 24;
      node.style.setProperty('--heat', heat.toFixed(3));
      node.style.setProperty('--glow', `${(heat * 22).toFixed(1)}px`);
      node.style.setProperty('--rx', `${((dx / distance) * force).toFixed(2)}px`);
      node.style.setProperty('--ry', `${((dy / distance) * force).toFixed(2)}px`);
    });
  };

  const onPointerLeave = () => {
    if (!fieldRef.current) return;
    fieldRef.current.style.setProperty('--pointer-active', '0');
    fieldRef.current.querySelectorAll('.about__kw').forEach((node) => {
      node.style.setProperty('--heat', '0');
      node.style.setProperty('--glow', '0px');
      node.style.setProperty('--rx', '0px');
      node.style.setProperty('--ry', '0px');
    });
  };

  return (
    <section className="screen about" aria-label="About me">
      <div ref={fieldRef} className="about__field" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <div className="about__particles" aria-hidden="true">
          {PARTICLES.map((p, i) => (
            <i key={i} style={{
              left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.o,
              '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--duration': `${p.duration}s`, '--delay': `${p.delay}s`,
            }} />
          ))}
        </div>

        <div className="about__thermal" aria-hidden="true" />

        {KEYWORDS.map((keyword, index) => (
          <span
            key={keyword.t}
            className={`about__kw about__kw--${keyword.kind}`}
            data-x={keyword.x}
            data-y={keyword.y}
            style={{
              left: `${keyword.x}%`,
              top: `${keyword.y}%`,
              fontSize: `${keyword.size}px`,
              '--delay': `${index * 55}ms`,
            }}
          >
            {keyword.t}
          </span>
        ))}
      </div>

      <div className="about__intro">
        <p className="sys">ABOUT / SUBLIMATED</p>
        <p>
          차갑고 고요해 보이지만 내부에서는 끊임없이 반응하고,<br />
          작은 차이를 끝까지 정리해 결과로 응집시킵니다.
        </p>
      </div>

      <button type="button" className="about__back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about__instruction sys">MOVE TO APPLY HEAT · WATCH THE RESIDUE REFORM</p>
    </section>
  );
}
