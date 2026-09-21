import { useEffect } from 'react';
import './contact.css';

/**
 * CONTACT — SIGNAL
 * 별도 대형 섹션이 아니라 레이어로 간결하게. 응집된 상태로 닫힌다.
 */
const LINKS = [
  { label: 'EMAIL', value: 'gysld261@gmail.com', href: 'mailto:gysld261@gmail.com' },
  { label: 'GITHUB', value: 'github.com/gysld261-png', href: 'https://github.com/gysld261-png' },
];

export default function Contact({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`contact ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <button
        type="button"
        className="contact__scrim"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        aria-label="닫기"
      />
      <div className="contact__panel" role="dialog" aria-label="Contact">
        <p className="sys contact__state">STATE / SIGNAL</p>
        <h2 className="contact__title">함께 일해요</h2>
        <p className="contact__lead">
          구조와 구현을 함께 설계하는 사람을 찾고 계시다면 연락 주세요.
        </p>

        <ul className="contact__links">
          {LINKS.map((l) => (
            <li key={l.label}>
              <a href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                <span className="sys">{l.label}</span>
                <em>{l.value}</em>
                <span className="contact__go" aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>

        <button type="button" className="contact__close sys" onClick={onClose}>
          ESC ✕ 닫기
        </button>
      </div>
    </div>
  );
}
