import RollText from './RollText';

const TABS = [
  { id: 'about', label: 'ABOUT ME' },
  { id: 'portfolio', label: 'PORTFOLIO' },
];

/* 드라이아이스가 1기압에서 승화하는 온도 — 헤더도 같은 관찰 계기의 일부다 */
const SUBLIMATION_POINT = '−78.5°C';

export default function Nav({ current, onGo, progress = 0 }) {
  const state = progress > 0.01 ? 'SUBLIMATING' : 'SOLID';

  return (
    <header className="nav" style={{ '--nav-progress': progress }}>
      <div className="nav__left">
        <button type="button" className="nav__mark roll" onClick={() => onGo('main')} aria-label="메인으로 이동">
          <RollText text="Park Hyomin" />
        </button>
        <p className="nav__status sys" aria-hidden="true">
          <span className="nav__dot" />
          {SUBLIMATION_POINT}
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
