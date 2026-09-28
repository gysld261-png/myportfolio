import { useCallback, useEffect, useMemo, useState } from 'react';
import { byId } from '../data/specimens';
import './about.css';

const MAP_CENTER = { x: 130, y: 48 };
const CAMERA = { x: 50, y: 44 };

const CHAMBERS = [
  {
    id: 'hyomin', no: '00', label: 'HYOMIN', type: 'identity',
    map: { x: 130, y: 46 }, room: { x: 130, y: 157 },
    eyebrow: 'IDENTITY / TEMPERATURE 00',
    title: '차분한 인상,\n멈추지 않는 생각',
    note: '차갑고 고요해 보이지만 내부에서는 끊임없이 반응합니다. 낯선 문제와 사람을 만날 때 더 선명해지고, 관찰한 것을 구조와 화면으로 응집시킵니다.',
    tags: ['WEB DESIGN', 'FRONTEND', 'INTERACTION'],
  },
  {
    id: 'observe', no: '01', label: 'OBSERVE', type: 'observe',
    map: { x: 92, y: 29 }, room: { x: 54, y: 178 },
    eyebrow: 'METHOD / SIGNAL 01',
    title: '먼저 보고,\n문제를 좁힙니다',
    note: '화면부터 그리지 않습니다. 사용자의 말과 행동 사이에서 반복되는 신호를 찾고, 팀이 함께 판단할 수 있는 문제로 바꿉니다.',
    projects: ['walga'],
    tags: ['RESEARCH', 'PERSONA', 'INSIGHT'],
  },
  {
    id: 'structure', no: '02', label: 'STRUCTURE', type: 'structure',
    map: { x: 167, y: 29 }, room: { x: 207, y: 177 },
    eyebrow: 'METHOD / ORDER 02',
    title: '흩어진 정보를\n하나의 흐름으로',
    note: '복잡한 내용을 정보 구조와 화면 위계로 정리합니다. 사용자가 어디에 있고 다음에 무엇을 해야 하는지 자연스럽게 읽히는 흐름을 설계합니다.',
    projects: ['tchaikim', 'walga'],
    tags: ['UX/UI', 'IA', 'DESIGN SYSTEM'],
  },
  {
    id: 'build', no: '03', label: 'BUILD', type: 'build',
    map: { x: 171, y: 66 }, room: { x: 199, y: 263 },
    eyebrow: 'METHOD / OUTPUT 03',
    title: '그린 화면을\n직접 작동시킵니다',
    note: '디자인을 코드로 옮기며 간격, 반응형, 움직임을 다시 판단합니다. 구현 과정에서 발견한 문제를 디자인으로 되돌려 완성도를 높입니다.',
    projects: ['tchaikim', 'walga'],
    tags: ['FRONTEND', 'RESPONSIVE', 'MOTION'],
  },
  {
    id: 'detail', no: '04', label: 'DETAIL', type: 'detail',
    map: { x: 91, y: 68 }, room: { x: 63, y: 260 },
    eyebrow: 'METHOD / RESOLUTION 04',
    title: '작은 차이를\n끝까지 조정합니다',
    note: '타이포 스케일, 상태 변화, 전달 규칙처럼 쉽게 지나치는 부분을 정리합니다. 작은 결정이 반복될 때 전체 경험의 인상이 만들어진다고 생각합니다.',
    projects: ['tchaikim'],
    tags: ['DETAIL', 'HANDOFF', 'PERSISTENCE'],
  },
];

const pathBetween = (from, to) => {
  const bend = from.y + (to.y - from.y) * 0.46;
  const drift = from.x < to.x ? 12 : -12;
  return `M ${from.x} ${from.y} C ${from.x + drift} ${bend}, ${to.x - drift} ${bend + 18}, ${to.x} ${to.y}`;
};

function ChamberVisual({ type }) {
  if (type === 'observe') {
    return (
      <div className="about-room-visual about-room-visual--observe" aria-hidden="true">
        <span className="scan-line" />
        {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--i': i }} />)}
        <b>REPEATED SIGNAL / 03</b>
      </div>
    );
  }
  if (type === 'structure') {
    return (
      <div className="about-room-visual about-room-visual--structure" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ '--i': i }} />)}
        <span />
      </div>
    );
  }
  if (type === 'build') {
    return (
      <div className="about-room-visual about-room-visual--build" aria-hidden="true">
        <div className="build-code">
          {[72, 46, 84, 58, 66, 38].map((w, i) => <i key={i} style={{ '--w': `${w}%`, '--i': i }} />)}
        </div>
        <div className="build-frame"><i /><i /><i /></div>
      </div>
    );
  }
  if (type === 'detail') {
    return (
      <div className="about-room-visual about-room-visual--detail" aria-hidden="true">
        <span className="detail-lens"><i /><i /></span>
        <b>12.0</b><b>16.0</b><b>24.0</b>
      </div>
    );
  }
  return (
    <div className="about-room-visual about-room-visual--identity" aria-hidden="true">
      <span>PHM</span>
      <i /><i /><i />
    </div>
  );
}

function ProjectEvidence({ ids, onOpenProject }) {
  if (!ids?.length) return null;
  return (
    <div className="about-room__evidence">
      <p className="sys">EVIDENCE</p>
      <ul>
        {ids.map((id) => {
          const project = byId(id);
          return (
            <li key={id}>
              <button type="button" onClick={() => onOpenProject?.(id)}>
                <span className="sys">{project.no}</span>
                <b>{project.ko}</b>
                <i aria-hidden="true">↗</i>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function About({ onGoMain, onOpenProject }) {
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('map');
  const chamber = useMemo(() => CHAMBERS.find((item) => item.id === selected) || null, [selected]);

  const enter = useCallback((id) => {
    if (phase !== 'map') return;
    setSelected(id);
    setPhase('travel');
  }, [phase]);

  const leave = useCallback(() => {
    if (!chamber || phase === 'travel' || phase === 'impact') return;
    setPhase('return');
  }, [chamber, phase]);

  useEffect(() => {
    if (phase === 'travel') {
      const timer = window.setTimeout(() => setPhase('impact'), 1380);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'impact') {
      const timer = window.setTimeout(() => setPhase('reveal'), 460);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'return') {
      const timer = window.setTimeout(() => {
        setSelected(null);
        setPhase('map');
      }, 1120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  useEffect(() => {
    if (!chamber) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chamber, leave]);

  const style = chamber ? {
    '--camera-x': `${CAMERA.x - chamber.room.x}vw`,
    '--camera-y': `${CAMERA.y - chamber.room.y}vh`,
    '--probe-x': `${chamber.map.x}vw`,
    '--probe-y': `${chamber.map.y}vh`,
    '--probe-dx': `${chamber.room.x - chamber.map.x}vw`,
    '--probe-dy': `${chamber.room.y - chamber.map.y}vh`,
    '--room-x': `${chamber.room.x}vw`,
    '--room-y': `${chamber.room.y}vh`,
  } : {};

  return (
    <section
      className={`screen about about--${phase}`}
      aria-label="About me"
      style={style}
      onClick={(event) => {
        if (phase === 'reveal' && !event.target.closest('.about-room')) leave();
      }}
    >
      <div className="about-world">
        <svg className="about-map-lines" viewBox="0 0 260 310" preserveAspectRatio="none" aria-hidden="true">
          {CHAMBERS.filter((item) => item.id !== 'hyomin').map((item) => (
            <line key={item.id} x1={MAP_CENTER.x} y1={MAP_CENTER.y} x2={item.map.x} y2={item.map.y} vectorEffect="non-scaling-stroke" />
          ))}
          <circle cx={MAP_CENTER.x} cy={MAP_CENTER.y} r="31" vectorEffect="non-scaling-stroke" />
        </svg>

        {CHAMBERS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`about-node about-node--${item.type} ${selected === item.id ? 'is-selected' : ''}`}
            style={{ left: `${item.map.x}vw`, top: `${item.map.y}vh` }}
            onClick={() => enter(item.id)}
            aria-label={`${item.label} 관찰실로 이동`}
          >
            <span className="about-node__index sys">{item.no}</span>
            <strong>{item.label}</strong>
            <i aria-hidden="true" />
          </button>
        ))}

        {chamber && (
          <>
            <svg className="about-route" viewBox="0 0 260 310" preserveAspectRatio="none" aria-hidden="true">
              <path d={pathBetween(chamber.map, chamber.room)} pathLength="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="about-probe" aria-hidden="true" />
            <span className="about-impact" aria-hidden="true"><i /><i /><i /></span>
          </>
        )}

        {CHAMBERS.map((item) => (
          <article
            key={`${item.id}-room`}
            className={`about-room about-room--${item.type} ${selected === item.id ? 'is-active' : ''}`}
            style={{ left: `${item.room.x}vw`, top: `${item.room.y}vh` }}
            aria-hidden={selected !== item.id}
          >
            <div className="about-room__light" aria-hidden="true" />
            <ChamberVisual type={item.type} />
            <div className="about-room__content">
              <p className="about-room__eyebrow sys">{item.eyebrow}</p>
              <h2>{item.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h2>
              <p className="about-room__note">{item.note}</p>
              <ul className="about-room__tags sys">
                {item.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>
              <ProjectEvidence ids={item.projects} onOpenProject={onOpenProject} />
              <button type="button" className="about-room__return sys" onClick={leave}>← RETURN TO MAP</button>
            </div>
          </article>
        ))}
      </div>

      <div className="about-map-intro">
        <p className="sys">ABOUT / OBSERVATION MAP</p>
        <p>생각이 작업이 되는 다섯 개의 관찰실.<br />빛을 따라 하나를 선택해 주세요.</p>
      </div>

      <div className="about-hud" aria-hidden="true">
        <span className="sys">CHAMBER {chamber?.no || '--'} / 05</span>
        <i />
        <span className="sys">DEPTH {phase === 'map' ? '000' : phase === 'travel' ? '072' : '100'}</span>
      </div>

      <button type="button" className="about-back sys" onClick={onGoMain}>← MAIN</button>
      <p className="about-instruction sys">
        {phase === 'map' && 'MOVE TO TRACE · CLICK TO DESCEND'}
        {phase === 'travel' && `FOLLOWING ${chamber?.label} SIGNAL`}
        {phase === 'impact' && 'IMPACT · LIGHTING CHAMBER'}
        {phase === 'reveal' && 'ESC · RETURN TO MAP'}
        {phase === 'return' && 'ASCENDING TO OBSERVATION MAP'}
      </p>
    </section>
  );
}
