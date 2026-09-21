import './intro.css';

export default function Intro({ phase = 'active', onSkip }) {
  return (
    <div className={`intro intro--${phase}`} role="status" aria-label="포트폴리오 시작 중">
      <button type="button" className="intro__skip" onClick={onSkip} aria-label="인트로 건너뛰기">
        <span className="intro__crystal" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="sys intro__state">STATE / NUCLEATION</span>
      </button>
    </div>
  );
}
