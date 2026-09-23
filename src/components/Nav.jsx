const TABS = [
  { id: 'about', label: 'ABOUT ME' },
  { id: 'portfolio', label: 'PORTFOLIO' },
];

export default function Nav({ current, onGo }) {
  return (
    <header className="nav">
      <button type="button" className="nav__mark roll" onClick={() => onGo('main')} aria-label="메인으로 이동">
        <span className="roll__in" data-label="PARK HYOMIN"><span>PARK HYOMIN</span></span>
      </button>

      <nav className="nav__tabs" aria-label="주요 화면">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="nav__link roll"
            aria-current={current === tab.id ? 'page' : undefined}
            onClick={() => onGo(tab.id)}
          >
            <span className="roll__in" data-label={tab.label}><span>{tab.label}</span></span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="nav__contact roll"
        aria-current={current === 'contact' ? 'page' : undefined}
        onClick={() => onGo('contact')}
      >
        <span className="roll__in" data-label="CONTACT"><span>CONTACT</span></span>
      </button>
    </header>
  );
}
