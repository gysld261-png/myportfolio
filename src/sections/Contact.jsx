import { useEffect, useRef, useState } from 'react';
import useWarmth, { formatTemp, warmthOf } from '../lib/useWarmth';
import './contact.css';

const EMAIL = 'gysld261@gmail.com';
const GITHUB = 'https://github.com/gysld261-png';
const REVEAL_AT = 0.5;

/**
 * CONTACT — 화면을 덮지 않는 작은 서리 유리 카드.
 * 네비의 CONTACT 바로 아래에서 내려온다. 열리는 동안 온도가 −78.5°C → 36.5°C 로 올라간다.
 *
 * 비모달 dialog(show)라 뒤 화면은 그대로 보이고 조작도 막지 않는다.
 * `.contact[open]` 은 About·ProjectDetail 의 단축키가 카드 안 입력을 무시하는 기준이라 그대로 둔다.
 */
export default function Contact({ open, onClose }) {
  const dialogRef = useRef(null);
  const returnFocus = useRef(null);
  const copyTimer = useRef(null);
  const copyAttempt = useRef(0);
  const [copyState, setCopyState] = useState('idle');
  const temp = useWarmth(open);
  /* 네비 서리선이 오른쪽 끝 가까이 차오르면(체온의 약 절반) 그때부터 글자가 위에서 아래로 스며 나온다 */
  const revealed = open && warmthOf(temp) >= REVEAL_AT;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    let closing;
    if (open) {
      setCopyState('idle');
      returnFocus.current = document.activeElement;
      if (!dialog.open) dialog.show();
      dialog.focus({ preventScroll: true });
    } else if (dialog.open) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      closing = window.setTimeout(() => dialog.close(), reduced ? 0 : 420);
      // 카드 안에 있던 포커스는 연 곳으로 돌려준다
      if (dialog.contains(document.activeElement)) {
        const back = returnFocus.current;
        (back instanceof HTMLElement && back.isConnected ? back : document.querySelector('.nav__contact'))?.focus({ preventScroll: true });
      }
    }
    return () => {
      window.clearTimeout(closing);
      window.clearTimeout(copyTimer.current);
      copyAttempt.current += 1;
    };
  }, [open]);

  // 카드 바깥을 누르면 닫는다 — 네비 CONTACT 는 여는 버튼이라 제외
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.contact, .nav__contact')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, onClose]);

  // 메일 앱이 설정되지 않은 컴퓨터에선 mailto 가 아무 일도 하지 않는다 —
  // 메일 링크를 누르면 주소도 같이 복사해서, 앱이 안 열려도 바로 붙여넣을 수 있게 한다.
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

  const onKeyDown = (event) => {
    // 뒤 화면(About 방·상세)의 ESC·방향키로 번지지 않게
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      className={`contact ${open ? 'is_open' : ''} ${revealed ? 'is_revealed' : ''}`}
      style={{ '--warmth': warmthOf(temp).toFixed(3) }}
      aria-labelledby="contact_title"
      onKeyDownCapture={onKeyDown}
    >
      <div className="contact__body">
        <header className="contact__head sys">
          <p className="contact__temp" aria-hidden="true">
            CONTACT <span className="contact__temp_value">{formatTemp(temp)}</span>
          </p>
          <button type="button" className="contact__close" onClick={onClose} aria-label="연락처 닫기">
            ESC <span className="contact__cross" aria-hidden="true" />
          </button>
        </header>

        <h2 id="contact_title" className="contact__title">차가운 건 화면까지만.</h2>

        <a className="contact__address" href={`mailto:${EMAIL}`} onClick={copyEmail} aria-label={`이메일 보내기: ${EMAIL}`}>{EMAIL}</a>

        <ul className="contact__links sys">
          <li>
            <button type="button" onClick={copyEmail} aria-label="이메일 주소 복사">
              {copyState === 'copied' ? 'COPIED' : 'COPY'}
            </button>
          </li>
          <li><a href={`mailto:${EMAIL}`} onClick={copyEmail}>MAIL <span aria-hidden="true">↗</span></a></li>
          <li><a href={GITHUB} target="_blank" rel="noopener noreferrer">GITHUB <span aria-hidden="true">↗</span></a></li>
        </ul>

        {/* 복사 성공은 버튼 글자(COPY → COPIED)로만 보여주고, 안내 문장은 스크린리더에만 읽힌다 */}
        <p className={`contact__feedback ${copyState === 'error' ? 'is_error' : ''}`} role="status" aria-live="polite">
          {copyState === 'copied' ? '복사됨' : copyState === 'error' ? '주소를 직접 선택해 복사해 주세요.' : ''}
        </p>
      </div>
    </dialog>
  );
}
