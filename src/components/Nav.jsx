import RollText from './RollText';

const TABS = [
  { id: 'about', label: 'ABOUT ME' },
  { id: 'portfolio', label: 'PORTFOLIO' },
];

export default function Nav({ current, onGo }) {
  return (
    <header className="nav">
      <button type="button" className="nav__mark roll" onClick={() => onGo('main')} aria-label="메인으로 이동">
        <RollText text="PARK HYOMIN" />
      </button>

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
    </header>
  );
}
