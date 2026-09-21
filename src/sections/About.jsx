import { useRef } from 'react';
import './about.css';

const KEYWORDS = [
  { t: 'HYOMIN', ring: 'core', x: 50, y: 50, size: 27 },
  { t: 'UX/UI', ring: 'core', x: 31, y: 34, size: 17 },
  { t: 'FRONTEND', ring: 'core', x: 69, y: 37, size: 17 },
  { t: 'DETAIL', ring: 'core', x: 29, y: 67, size: 17 },
  { t: 'RESEARCH', ring: 'mid', x: 14, y: 47, size: 13 },
  { t: 'INTERACTION', ring: 'mid', x: 74, y: 65, size: 13 },
  { t: 'ORGANIZE', ring: 'mid', x: 51, y: 79, size: 13 },
  { t: 'BUILD', ring: 'mid', x: 59, y: 19, size: 13 },
  { t: 'EARLY BIRD', ring: 'outer', x: 10, y: 79, size: 11 },
  { t: 'OLD SOUL', ring: 'outer', x: 85, y: 82, size: 11 },
  { t: 'PERSISTENT', ring: 'outer', x: 87, y: 22, size: 11 },
];

const PARTICLES = Array.from({ length: 74 }, (_, i) => ({
  x: (i * 47 + 13) % 97,
  y: (i * 71 + 19) % 93,
  s: 1 + ((i * 17) % 3),
  o: 0.16 + ((i * 23) % 55) / 100,
}));

export default function About({ onGoMain }) {
  const fieldRef = useRef(null);

  const onPointerMove = (event) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    fieldRef.current.style.setProperty('--mx', x.toFixed(3));
    fieldRef.current.style.setProperty('--my', y.toFixed(3));
  };

  return (
    <section className="screen about" aria-label="About me">
      <div ref={fieldRef} className="about__field" onPointerMove={onPointerMove}>
        <div className="about__particles" aria-hidden="true">
          {PARTICLES.map((p, i) => (
            <i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.o }} />
          ))}
        </div>

        <div className="about__halo" aria-hidden="true" />

        {KEYWORDS.map((keyword, index) => (
          <span
            key={keyword.t}
            className={`about__kw about__kw--${keyword.ring}`}
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
      <p className="about__instruction sys">MOVE TO EXPLORE · PORTFOLIO IS IN THE TAB</p>

      <div className="readout readout--right sys">
        <span>STATE</span>
        <b>SUBLIMATED</b>
      </div>
    </section>
  );
}
