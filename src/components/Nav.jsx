import RollText from './RollText';
import useWarmth, { COLD, WARM, formatTemp, warmthOf } from '../lib/useWarmth';

const TABS = [
  { id: 'about', label: 'ABOUT ME' },
  { id: 'portfolio', label: 'PORTFOLIO' },
];

/* 헤더도 같은 관찰 계기의 일부다 — 평소엔 드라이아이스의 승화점(−78.5°C),
   CONTACT 가 열리면 사람의 체온(36.5°C)까지 올라간다 */
export default function Nav({ current, onGo, progress = 0, suspended = false }) {
  const warm = current === 'contact';
  const temp = useWarmth(warm);
  const heating = warm && temp < WARM;
  const cooling = !warm && temp > COLD;
  const state = heating ? 'RISING' : warm ? 'WARM' : cooling ? 'COOLING' : progress > 0.01 ? 'SUBLIMATING' : 'SOLID';

  return (
    <header className={`nav ${warm ? 'is_warm' : ''}`} style={{ '--nav-progress': progress, '--warmth': warmthOf(temp).toFixed(3) }} inert={suspended ? '' : undefined}>
      <div className="nav__left">
        <button type="button" className="nav__mark roll" onClick={() => onGo('main')} aria-label="메인으로 이동">
          <RollText text="Park Hyomin" />
        </button>
        <p className="nav__status sys" aria-hidden="true">
          <span className="nav__dot" />
          <span className="nav__temp">{formatTemp(temp)}</span>
          <span className="nav__state">/ {state}</span>
        </p>
      </div>

      <nav className="nav__tabs" aria-label="주요 화면">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="nav__link roll"
            aria-label={tab.label}
            aria-current={current === tab.id ? 'page' : undefined}
            onClick={() => onGo(tab.id)}
          >
            <RollText text={tab.label} />
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="nav__contact roll"
        aria-label="CONTACT"
        aria-current={current === 'contact' ? 'page' : undefined}
        onClick={() => onGo('contact')}
      >
        <RollText text="CONTACT" />
      </button>

      {/* 서리선 — 승화가 진행되는 만큼 왼쪽부터 밝아진다 */}
      <span className="nav__frost" aria-hidden="true">
        <i />
      </span>
    </header>
  );
}
