import { useEffect, useRef, useState } from 'react';
import './contact.css';

const EMAIL = 'gysld261@gmail.com';
const GITHUB = 'https://github.com/gysld261-png';

export default function Contact({ open, onClose }) {
  const dialogRef = useRef(null);
  const copyTimer = useRef(null);
  const copyAttempt = useRef(0);
  const [copyState, setCopyState] = useState('idle');

  // 네이티브 모달이 뒤 화면 입력을 막고 포커스를 가둔다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    let closing;
    if (open) {
      setCopyState('idle');
      if (!dialog.open) dialog.showModal();
      dialog.focus({ preventScroll: true });
    } else if (dialog.open) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      closing = window.setTimeout(() => dialog.close(), reduced ? 0 : 300);
    }
    return () => {
      window.clearTimeout(closing);
      window.clearTimeout(copyTimer.current);
      copyAttempt.current += 1;
    };
  }, [open]);

  const copyEmail = async () => {
    const attempt = ++copyAttempt.current;
    window.clearTimeout(copyTimer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(EMAIL);
      if (attempt !== copyAttempt.current) return;
      setCopyState('copied');
      copyTimer.current = window.setTimeout(() => setCopyState('idle'), 2600);
    } catch {
      if (attempt === copyAttempt.current) setCopyState('error');
    }
  };

  const handleDialogKeyDown = (event) => {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    const controls = dialog.querySelectorAll('a[href], button:not([tabindex="-1"])');
    const first = controls[0];
    const last = controls[controls.length - 1];
    const focused = document.activeElement;
    if (event.shiftKey && (focused === first || focused === dialog)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (focused === last || focused === dialog)) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <dialog ref={dialogRef} tabIndex={-1} className={`contact ${open ? 'is-open' : ''}`}
      aria-labelledby="contact-title" aria-describedby="contact-lead"
      onKeyDownCapture={handleDialogKeyDown}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button
        type="button"
        className="contact__scrim"
        onClick={onClose}
        tabIndex={-1}
        aria-label="연락처 닫기"
      />
      <article className="contact__letter">
        <header className="contact__header">
          <p className="contact__recipient sys"><span>TO.</span> PARK HYOMIN</p>
          <button type="button" className="contact__close" onClick={onClose} aria-label="연락처 창 닫기">
            <span className="sys">ESC</span><span className="contact__cross" aria-hidden="true" />
          </button>
        </header>
        <div className="contact__body">
          <p className="contact__eyebrow sys">A NOTE TO START SOMETHING</p>
          <h2 id="contact-title" className="contact__title">좋은 작업은,<br />대화부터.</h2>
          <p id="contact-lead" className="contact__lead">함께 만들고 싶은 일이 있다면,<br className="contact__mobile-break" /> 편하게 연락 주세요.</p>
          <div className="contact__address-row">
            <a className="contact__address" href={`mailto:${EMAIL}`} aria-label={`이메일 보내기: ${EMAIL}`}>{EMAIL}</a>
            <button type="button" className="contact__copy" onClick={copyEmail} aria-label="이메일 주소 복사">
              {copyState === 'copied' ? <span aria-hidden="true">✓</span> : (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="7" y="7" width="10" height="10" rx="1" stroke="currentColor" />
                  <path d="M12 4V3H3v9h1" stroke="currentColor" />
                </svg>
              )}
              <span>{copyState === 'copied' ? '주소 챙겼어요' : '주소 복사'}</span>
            </button>
          </div>
          <p className={`contact__feedback ${copyState === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">
            {copyState === 'copied' ? '이메일 주소를 복사했어요.' : copyState === 'error' ? '복사가 안 되면 위 주소를 선택해서 직접 복사해 주세요.' : ''}
          </p>
        </div>
        <footer className="contact__footer">
          <div className="contact__actions">
            <a className="contact__send" href={`mailto:${EMAIL}`}><span>메일 보내기</span><span className="contact__arrow" aria-hidden="true">↗</span></a>
            <a className="contact__github sys" href={GITHUB} target="_blank" rel="noopener noreferrer">GITHUB <span className="contact__arrow" aria-hidden="true">↗</span></a>
          </div>
          <p className="contact__signature">박효민 <span>드림.</span></p>
        </footer>
      </article>
    </dialog>
  );
}
