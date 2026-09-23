import { useCallback, useEffect, useRef, useState } from 'react';
import './about.css';

/**
 * ABOUT — SUBLIMATION / DEPOSITION
 *
 * 떠 있는 키워드는 아직 굳지 않은 상태다.
 * 클릭하면 그 키워드가 승화하고(자간이 벌어지며 안개로 흩어진다),
 * 안개가 가운데로 모여 설명으로 다시 굳는다 — 증착(deposition).
 *
 * CO2 는 공기보다 무겁다. 선택되지 않은 키워드는 위로 흩어지지 않고 가라앉는다.
 *
 * note 는 각 키워드가 굳었을 때 나오는 문장이다.
 * 프로젝트에서 실제로 있었던 일에만 근거를 둔다 — 형용사만 늘어놓지 않는다.
 */
const KEYWORDS = [
  {
    t: 'HYOMIN', kind: 'core', x: 48, y: 48, size: 36,
    note: '차갑고 고요해 보이지만 내부에서는 끊임없이 반응하고, 작은 차이를 끝까지 정리해 결과로 응집시킵니다.',
  },
  {
    t: 'UX/UI', kind: 'solid', x: 23, y: 29, size: 16,
    note: '화면을 그리기 전에 구조부터 잡습니다. 차이킴에서는 성격이 다른 두 서브 브랜드를 한 사이트 안에서 어떻게 가를지가 먼저였습니다.',
  },
  {
    t: 'FRONTEND', kind: 'solid', x: 72, y: 26, size: 16,
    note: '디자인한 것을 직접 구현합니다. 넘길 때 무엇이 어려운지 알고 그리게 됩니다.',
  },
  {
    t: 'DETAIL', kind: 'solid', x: 76, y: 63, size: 16,
    note: '타이포 스케일을 11단계로 쪼갠 이유는 하나입니다. 그래야 팀이 매번 고민하지 않고 고를 수 있습니다.',
  },
  {
    t: 'RESEARCH', kind: 'trace', x: 19, y: 55, size: 13,
    note: '만들기 전에 기준을 세웁니다. 페르소나 두 명을 정의하고 그 기준으로 정보 구조를 검증했습니다.',
  },
  {
    t: 'INTERACTION', kind: 'trace', x: 61, y: 78, size: 13,
    note: '상태가 바뀌는 순간을 설계합니다. 이 사이트의 승화도 호버와 스크롤에 붙은 상태 변화입니다.',
  },
  {
    t: 'ORGANIZE', kind: 'trace', x: 39, y: 69, size: 13,
    note: '흩어진 결정을 한자리에 모읍니다. DL 번호 체계로 무엇을 왜 정했는지 나중에도 되짚을 수 있게 남겼습니다.',
  },
  {
    t: 'BUILD', kind: 'trace', x: 84, y: 43, size: 13,
    note: '기획으로 끝내지 않습니다. 왈가왈봇에서는 PM으로 IA를 잡고 화면까지 만들었습니다.',
  },
  /* ↓ 아래 세 개는 프로젝트가 아니라 사람에 대한 것이라 네가 직접 써야 맞다 */
  { t: 'EARLY BIRD', kind: 'residue', x: 18, y: 81, size: 12, note: '' },
  { t: 'OLD SOUL', kind: 'residue', x: 80, y: 84, size: 12, note: '' },
  { t: 'PERSISTENT', kind: 'residue', x: 54, y: 14, size: 12, note: '' },
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

/* 고른 키워드가 화면에서 멈출 자리.
   중앙으로 완전히 끌어오지 않고 원래 위치 쪽으로 55%만 당긴다 —
   그래야 왼쪽 키워드는 왼쪽에, 오른쪽 키워드는 오른쪽에 서고 매번 구도가 달라진다. */
const SCALE = 2.2;
const anchorOf = (k) => ({
  x: k.x + (50 - k.x) * 0.55,
  y: k.y + (38 - k.y) * 0.55,
});

export default function About({ onGoMain }) {
  const fieldRef = useRef(null);
  const sectionRef = useRef(null);
  const [picked, setPicked] = useState(null);
  /* null → 'sink'(키워드가 승화하고 안개가 차오름) → 'reveal'(서리가 번지며 글자가 드러남) */
  const [phase, setPhase] = useState(null);

  const onPointerMove = (event) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect || picked) return;   // 굳은 뒤에는 열을 가하지 않는다
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

  const cool = useCallback(() => {
    if (!fieldRef.current) return;
    fieldRef.current.style.setProperty('--pointer-active', '0');
    fieldRef.current.querySelectorAll('.about__kw').forEach((node) => {
      node.style.setProperty('--heat', '0');
      node.style.setProperty('--glow', '0px');
      node.style.setProperty('--rx', '0px');
      node.style.setProperty('--ry', '0px');
    });
  }, []);

  const pick = useCallback((keyword) => {
    cool();
    /* 충격파 — 누른 지점에서 파동이 퍼지고, 지나가는 키워드가 차례로 밀린다.
       누른 것만 반응하면 '클릭했다'지만, 전부 반응하면 '이 공간에 뭘 했다'가 된다. */
    const host = fieldRef.current;
    if (host) {
      const rect = host.getBoundingClientRect();
      const ox = (keyword.x / 100) * rect.width;
      const oy = (keyword.y / 100) * rect.height;
      host.style.setProperty('--wx', `${ox}px`);
      host.style.setProperty('--wy', `${oy}px`);
      host.classList.remove('is-shocked');
      void host.offsetWidth;              // 애니메이션 재시작
      host.classList.add('is-shocked');

      host.querySelectorAll('.about__kw').forEach((node) => {
        const kx = (Number(node.dataset.x) / 100) * rect.width;
        const ky = (Number(node.dataset.y) / 100) * rect.height;
        const dx = kx - ox;
        const dy = ky - oy;
        const d = Math.hypot(dx, dy);
        if (d < 2) return;
        /* 파동이 그 자리에 닿는 시각 — 가까운 것부터 밀린다 */
        node.style.setProperty('--fd', `${Math.round(d * 0.62)}ms`);
        node.style.setProperty('--fx', `${((dx / d) * 14).toFixed(1)}px`);
        node.style.setProperty('--fy', `${((dy / d) * 14).toFixed(1)}px`);
      });
    }
    setPicked(keyword);
    setPhase('sink');
  }, [cool]);

  /* 안개가 시야를 덮으면 그 안에서 서리가 번지기 시작한다 */
  useEffect(() => {
    if (phase !== 'sink') return undefined;
    const t = window.setTimeout(() => setPhase('reveal'), 520);
    return () => window.clearTimeout(t);
  }, [phase]);

  const release = useCallback(() => {
    setPicked(null);
    setPhase(null);
  }, []);

  // 굳은 상태에서 ESC 는 MAIN 이 아니라 필드로 돌아간다
  useEffect(() => {
    if (!picked) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        release();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [picked, release]);

  return (
    <section
      ref={sectionRef}
      className={`screen about ${picked ? 'is-deposited' : ''} ${phase ? `is-${phase}` : ''}`}
      aria-label="About me"
      style={(() => {
        if (!picked) return { '--sx': '0%', '--sy': '0%', '--sc': 1 };
        const a = anchorOf(picked);
        /* transform-origin 0 0 기준: 화면좌표 = 원좌표 * S + t  →  t = 목표 - 원좌표 * S */
        return {
          '--sx': `${a.x - picked.x * SCALE}%`,
          '--sy': `${a.y - picked.y * SCALE}%`,
          '--sc': SCALE,
          '--ax': `${a.x}%`,
          '--ay': `${a.y}%`,
        };
      })()}
    >
      <div
        ref={fieldRef}
        className="about__field"
        onPointerMove={onPointerMove}
        onPointerLeave={cool}
      >
        <div className="about__space">
        <div className="about__particles" aria-hidden="true">
          {PARTICLES.map((p, i) => (
            <i key={i} style={{
              left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.o,
              '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--duration': `${p.duration}s`, '--delay': `${p.delay}s`,
            }} />
          ))}
        </div>

        <div className="about__thermal" aria-hidden="true" />
        {/* 충격파 파문 */}
        <span className="about__wave" aria-hidden="true" />

        {KEYWORDS.map((keyword, index) => (
          <button
            type="button"
            key={keyword.t}
            className={`about__kw about__kw--${keyword.kind} ${picked?.t === keyword.t ? 'is-picked' : ''}`}
            data-x={keyword.x}
            data-y={keyword.y}
            onClick={() => pick(keyword)}
            aria-label={`${keyword.t} 설명 보기`}
            style={{
              left: `${keyword.x}%`,
              top: `${keyword.y}%`,
              fontSize: `${keyword.size}px`,
              '--delay': `${index * 55}ms`,
            }}
          >
            {keyword.t}
          </button>
        ))}

        </div>

        {/* 바닥에서 안개가 차오른다. 한 장이면 덩어리로 보여서 세 층이 서로 다른 속도로 움직인다. */}
        <div className="about__vapor" aria-hidden="true">
          <i style={{ '--i': 0 }} />
          <i style={{ '--i': 1 }} />
          <i style={{ '--i': 2 }} />
        </div>
      </div>

      {/* 증착 — 도착한 키워드 바로 아래에서 설명이 굳는다 */}
      <div
        className={`about__deposit ${picked && anchorOf(picked).x > 55 ? 'is-right' : ''}`}
        aria-hidden={!picked}
      >
        {picked && (
          <>
            <p className="sys about__deposit-state">DEPOSITION / {picked.t.replace('/', '-')}</p>
            {picked.note
              ? <p className="about__deposit-note">{picked.note}</p>
              : <p className="about__deposit-note about__deposit-note--empty">아직 굳지 않았습니다.</p>}
            <button type="button" className="about__deposit-back sys" onClick={release}>
              ← SUBLIMATE
            </button>
          </>
        )}
      </div>

      <div className="about__intro">
        <p className="sys">ABOUT / SUBLIMATED</p>
        <p>
          차갑고 고요해 보이지만 내부에서는 끊임없이 반응하고,<br />
          작은 차이를 끝까지 정리해 결과로 응집시킵니다.
        </p>
      </div>

      <button type="button" className="about__back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about__instruction sys">
        {picked ? 'ESC TO SUBLIMATE' : 'MOVE TO APPLY HEAT · CLICK TO DEPOSIT'}
      </p>
    </section>
  );
}
