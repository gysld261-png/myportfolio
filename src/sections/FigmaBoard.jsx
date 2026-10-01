import { useEffect, useRef, useState } from 'react';

/**
 * BACKGROUND — Figma 편집 화면.
 * 지나온 작업을 Figma 파일 하나에 펼쳐 둔 모습이다. 시기마다 Section 하나, 그 안에 작업이 Frame 으로 놓인다.
 *
 *   레이어 패널  왼쪽 — Section(시기) 아래 Frame(작업) 목록. 줄을 가리키면 캔버스의 그 Frame 이 선택된다
 *   캔버스      Frame 을 가리키면 Figma 처럼 파란 테두리·핸들·이름·크기가 붙고, 그 시기가 왼쪽 기록에 뜬다
 *   커서        가만히 두면 "Hyomin" 커서가 Frame 사이를 옮겨 다니며 하나씩 골라 본다(멀티플레이어 커서)
 *
 * Frame 을 누르면 화면 가득 확대된다(onZoom).
 */
const IDLE_AFTER = 2600;   // 손을 뗀 뒤 커서가 혼자 움직이기 시작할 때까지(ms)
const IDLE_STEP = 2300;    // 혼자 움직일 때 Frame 하나에 머무는 시간(ms)

/* Share 를 누른 사람만 아는 것 — 공유 창의 권한 목록에 'can hire' 가 숨어 있고,
   'can hire' 를 고르면 캔버스의 Hyomin 커서가 놀라 튀어 오르고, Send offer 를 누르면 답한다.
   메인이 아니라서 누를 것은 권한 메뉴와 파란 버튼뿐 — 커서 말풍선은 반응만 한다 */
const EMAIL = 'gysld261@gmail.com';
const SAY = {
  share: 'Share 눌러서 초대해 주세요 ↑',
  hello: '👋 초대해 주시면 바로 합류할게요!',
  wow: '!!',
  hired: '언제부터 출근하면 될까요? 👀',
};
// 커서가 무언가를 가리키며 누르는 시늉을 하는 말 — 말풍선이 커서 왼쪽에 붙는다(오른쪽 끝에서 잘리지 않게)
const POINTING = ['share'];
const HINT_EVERY = 3;      // 혼자 돌아다니다 Frame 세 번에 한 번은 Share 를 가리킨다

const keyOf = (strip, k) => `${strip.id}-${k}`;

function FigmaIcon({ d }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

export default function FigmaBoard({ strips, current, active, onHover, onZoom, onModal }) {
  const canvasRef = useRef(null);
  const nameRef = useRef(null);
  const sizeRef = useRef(null);
  const botRef = useRef(null);
  const hoverRef = useRef(current);
  hoverRef.current = current;
  const [selected, setSelected] = useState(null);
  const userAt = useRef(0);          // 사람이 마지막으로 움직인 때
  const [share, setShare] = useState(false);
  const [role, setRole] = useState('can view');
  const [roleMenu, setRoleMenu] = useState(false);
  const [say, setSay] = useState(null);       // Hyomin 커서 옆 말풍선(SAY 의 키)
  const [opened, setOpened] = useState(false);  // Share 를 한 번이라도 열었나 — 그 전까지 Share 가 숨 쉰다
  const [hired, setHired] = useState(false);    // 'can hire' 를 찾아냈나 — 그 뒤로는 안내하지 않는다
  const shareRef = useRef(share);
  shareRef.current = share;
  const hiredRef = useRef(hired);
  hiredRef.current = hired;
  const shareBtnRef = useRef(null);

  // Hyomin 커서를 캔버스 왼쪽 아래로 데려와 말을 걸게 한다 — 오른쪽 위의 공유 창에 가리지 않는 자리
  const summon = (line) => {
    const canvas = canvasRef.current;
    if (!canvas || !botRef.current) return;
    const rect = canvas.getBoundingClientRect();
    botRef.current.style.transform = `translate(${(rect.width * 0.1).toFixed(1)}px, ${(rect.height * 0.7).toFixed(1)}px)`;
    canvas.classList.add('is-bot');
    setSay(line);
  };

  // Hyomin 커서가 그 요소를 가리키며 톡톡 누르는 시늉을 한다. 캔버스 밖(윗줄)이면 캔버스 위 끝에 붙어 위를 가리킨다
  const pointAt = (el, line) => {
    const canvas = canvasRef.current;
    if (!canvas || !el || !botRef.current) return;
    const base = canvas.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const x = Math.min(box.left + box.width * 0.6 - base.left, base.width - 18);
    const y = Math.max(box.top + box.height * 0.7 - base.top, 6);
    botRef.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    canvas.classList.add('is-bot');
    setSay(line);
  };

  const openShare = () => {
    setShare(true);
    setOpened(true);
    setRoleMenu(false);
    summon('hello');
  };
  const closeShare = () => {
    setShare(false);
    setRoleMenu(false);
    setSay(null);
    userAt.current = performance.now();   // 닫자마자 커서가 다시 돌아다니지 않게 잠깐 쉰다
  };
  // 공유 창이 열려 있는 동안 Esc 는 창만 닫는다 — About 이 먼저 받아 이 함수를 부른다
  useEffect(() => {
    onModal?.(share ? closeShare : null);
    return () => onModal?.(null);
  }, [share]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMenu = () => {
    setRoleMenu((open) => !open);
  };

  const chooseRole = (next) => {
    setRole(next);
    setRoleMenu(false);
    if (next === 'can hire') {
      setHired(true);
      summon('wow');
      canvasRef.current?.classList.remove('is-jumping');
      void canvasRef.current?.offsetWidth;          // 연달아 골라도 매번 다시 튀어 오르게
      canvasRef.current?.classList.add('is-jumping');
    } else {
      summon('hello');
    }
  };

  const frames = strips.flatMap((strip) => strip.images.map((image, k) => ({ key: keyOf(strip, k), strip, image })));

  // 선택 상자를 그 Frame 에 맞춘다 — 캔버스 기준 좌표
  const place = (key) => {
    const canvas = canvasRef.current;
    const frame = key && canvas?.querySelector(`.figma-frame[data-key="${key}"] .figma-frame__art`);
    if (!canvas || !frame) {
      canvas?.classList.remove('is-selecting');
      return null;
    }
    const base = canvas.getBoundingClientRect();
    const box = frame.getBoundingClientRect();
    canvas.style.setProperty('--sx', `${(box.left - base.left).toFixed(1)}px`);
    canvas.style.setProperty('--sy', `${(box.top - base.top).toFixed(1)}px`);
    canvas.style.setProperty('--sw', `${box.width.toFixed(1)}px`);
    canvas.style.setProperty('--sh', `${box.height.toFixed(1)}px`);
    nameRef.current.textContent = frame.closest('.figma-frame').dataset.label;
    sizeRef.current.textContent = `${Math.round(box.width)} × ${Math.round(box.height)}`;
    canvas.classList.add('is-selecting');
    return { x: box.left - base.left, y: box.top - base.top, w: box.width, h: box.height };
  };

  const pick = (key, byUser = true) => {
    setSelected(key);
    place(key);
    if (byUser) {
      userAt.current = performance.now();
      canvasRef.current?.classList.remove('is-bot');
      const strip = frames.find((f) => f.key === key)?.strip;
      if (strip && strip.id !== hoverRef.current) onHover(strip.id);
    }
  };

  // 손을 떼고 가만히 있으면 "Hyomin" 커서가 Frame 을 하나씩 골라 본다
  useEffect(() => {
    if (!active || !frames.length) return undefined;
    let index = 0;
    let step = HINT_EVERY - 2;   // 방에 들어와 두 번째 움직임에 바로 Share 를 한 번 가리킨다
    const timer = window.setInterval(() => {
      if (shareRef.current || performance.now() - userAt.current < IDLE_AFTER) return;
      const canvas = canvasRef.current;
      step += 1;
      // 아직 can hire 를 못 찾았다면 가끔 Share 로 가서 눌러 보라고 한다
      if (!hiredRef.current && step % HINT_EVERY === 0) {
        setSelected(null);
        place(null);
        pointAt(shareBtnRef.current, 'share');
        return;
      }
      setSay(null);
      const { key } = frames[index % frames.length];
      index += 1;
      const box = place(key);
      if (!box || !canvas) return;
      setSelected(key);
      canvas.classList.add('is-bot');
      botRef.current.style.transform = `translate(${(box.x + box.w * 0.62).toFixed(1)}px, ${(box.y + box.h * 0.58).toFixed(1)}px)`;
    }, IDLE_STEP);
    return () => window.clearInterval(timer);
  }, [active, strips]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 상자는 고른 순간의 자리를 잰다. 방에 들어올 때 Section 이 아래에서 올라오는 도중(figma-on)이나
  // 창 크기가 바뀐 뒤에는 Frame 이 움직여 상자가 어긋나므로, 애니메이션이 끝날 때와 크기가 바뀔 때 다시 맞춘다
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) return undefined;
    const refit = () => { if (selectedRef.current) place(selectedRef.current); };
    const onAnimEnd = (event) => { if (event.target.classList?.contains('figma-section')) refit(); };
    canvas.addEventListener('animationend', onAnimEnd);
    const observer = new ResizeObserver(refit);
    observer.observe(canvas);
    return () => { canvas.removeEventListener('animationend', onAnimEnd); observer.disconnect(); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // 방을 떠나면 선택을 거둔다
  useEffect(() => {
    if (!active) { setSelected(null); place(null); canvasRef.current?.classList.remove('is-bot'); closeShare(); }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCanvasMove = (event) => {
    // 공유 창이 열려 있는 동안 커서는 말을 건 자리에 머문다.
    if (shareRef.current || event.target.closest?.('.figma-bot')) return;
    userAt.current = performance.now();
    canvasRef.current?.classList.remove('is-bot');
    setSay(null);
    const frame = event.target.closest?.('.figma-frame');
    if (frame && frame.dataset.key !== selected) pick(frame.dataset.key);
  };

  return (
    <div className="about-room-visual about-room-visual--figma">
      <div className="figma">
        <header className="figma__bar">
          <span className="figma__logo" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="figma__tools" aria-hidden="true">
            <FigmaIcon d="M5 3l13 8-6 1.5L9 19z" />
            <FigmaIcon d="M7 3v18M17 3v18M3 7h18M3 17h18" />
            <FigmaIcon d="M4 4h16v16H4z" />
            <FigmaIcon d="M12 3l2 5h5l-4 3.5 1.5 5.5L12 14l-4.5 3 1.5-5.5L5 8h5z" />
            <FigmaIcon d="M6 5h12M12 5v14" />
          </span>
          <p className="figma__file"><span>Drafts /</span> Background — Park Hyomin</p>
          <span className="figma__people" aria-hidden="true"><b>H</b></span>
          <button type="button" ref={shareBtnRef} className={`figma__share ${opened ? '' : 'is-nudge'}`} onClick={openShare} aria-haspopup="dialog" aria-expanded={share}>Share</button>
        </header>

        <aside className="figma__layers">
          <p className="figma__panel-title">Layers</p>
          {strips.map((strip, i) => (
            <div className={`figma__group ${strip.parent ? 'is-child' : ''}`} key={strip.id}>
              <p className={`figma__row figma__row--section ${current === strip.id ? 'is-current' : ''}`}>
                <span aria-hidden="true">▾</span>
                <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1" /></svg>
                {strip.no ?? String(i + 1).padStart(2, '0')} {strip.name}
              </p>
              {strip.images.map((image, k) => {
                const key = keyOf(strip, k);
                return (
                  <button
                    type="button"
                    key={key}
                    className={`figma__row figma__row--frame ${selected === key ? 'is-selected' : ''}`}
                    onPointerEnter={() => pick(key)}
                    onFocus={() => pick(key)}
                    onClick={() => onZoom(image)}
                    aria-label={`${strip.name} — ${image.label} 크게 보기`}
                  >
                    <span aria-hidden="true">#</span>
                    {image.label}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        <div
          className="figma__canvas"
          ref={canvasRef}
          onPointerMove={onCanvasMove}
          onPointerDown={onCanvasMove}
          aria-hidden="true"
        >
          {strips.map((strip, i) => (
            <section className="figma-section" key={strip.id} data-id={strip.id} style={{ '--i': i }}>
              <span className="figma-section__title">{strip.period} · {strip.name}</span>
              <div className="figma-section__frames">
                {strip.images.map((image, k) => (
                  <div
                    className={`figma-frame ${selected === keyOf(strip, k) ? 'is-selected' : ''}`}
                    key={image.src}
                    data-key={keyOf(strip, k)}
                    data-label={image.label}
                    onClick={() => onZoom(image)}
                  >
                    <span className="figma-frame__name">{image.label}</span>
                    <span className="figma-frame__art"><img src={image.thumb ?? image.src} alt="" draggable="false" style={image.focus ? { objectPosition: image.focus } : undefined} /></span>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div className="figma-select">
            <span className="figma-select__name" ref={nameRef} />
            <i /><i /><i /><i />
            <span className="figma-select__size" ref={sizeRef} />
          </div>
          <div className={`figma-bot ${POINTING.includes(say) ? 'is-pointing' : ''}`} data-say={say || undefined} ref={botRef}>
            <svg viewBox="0 0 16 18"><path d="M1 1l13 7.5-5.6 1.4L5.6 16z" /></svg>
            {/* 커서 챗 — 말이 없으면 이름표, 말을 걸면 그 자리가 말풍선이 된다 */}
            <span className={SAY[say] ? 'is-saying' : ''} key={say || 'name'}>
              {SAY[say] || 'Hyomin'}
            </span>
          </div>
          <span className="figma__zoom">62%</span>
        </div>

        {share && (
          <div className="figma-share" onClick={closeShare}>
            <div
              className="figma-share__dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Share this file"
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <b>Share this file</b>
                <button type="button" onClick={closeShare} aria-label="닫기">×</button>
              </header>
              <p className="figma-share__label">Who has access</p>
              <ul className="figma-share__people">
                <li>
                  <b className="figma-share__avatar figma-share__avatar--owner">H</b>
                  <span>Park Hyomin <small>{EMAIL}</small></span>
                  <em>owner</em>
                </li>
                <li>
                  <b className="figma-share__avatar">Y</b>
                  <span>You <small>포트폴리오를 보는 분</small></span>
                  <div className="figma-share__role">
                    <button
                      type="button"
                      className={hired || roleMenu ? '' : 'is-nudge'}
                      onClick={toggleMenu}
                      aria-haspopup="listbox"
                      aria-expanded={roleMenu}
                    >
                      {role} <i aria-hidden="true">▾</i>
                    </button>
                    {roleMenu && (
                      <ul role="listbox" aria-label="권한">
                        {['can view', 'can hire'].map((option) => (
                          <li key={option}>
                            <button
                              type="button"
                              role="option"
                              className={option === 'can hire' && !hired ? 'is-nudge' : ''}
                              aria-selected={role === option}
                              onClick={() => chooseRole(option)}
                            >
                              <i aria-hidden="true">{role === option ? '✓' : ''}</i>{option}
                              {option === 'can hire' && <small>new</small>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              </ul>
              <footer>
                <button
                  type="button"
                  className="figma-share__request"
                  onClick={() => summon(role === 'can hire' ? 'hired' : 'hello')}
                >
                  {role === 'can hire' ? 'Send offer' : 'Request edit access'}
                </button>
              </footer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* 왼쪽 문장 아래 — 지금 고른 시기의 기록 */
export function StripReadout({ strips, current, onZoom, children }) {
  const strip = strips.find((item) => item.id === current);
  if (!strip) {
    return (
      <div className="core-readout core-readout--idle">
        <p className="core-readout__meta sys">SECTION -- / {String(strips.filter((item) => !item.parent).length).padStart(2, '0')}</p>
        <p className="core-readout__hint">오른쪽 Figma 화면에서 Frame을 골라 보세요. 그 시기에 한 일이 여기에 펼쳐집니다.</p>
      </div>
    );
  }
  const index = strips.indexOf(strip);
  // 하위 섹션(02-1)은 번호를 따로 세지 않는다 — 전체 수는 큰 섹션만
  const total = strips.filter((item) => !item.parent).length;
  return (
    <div className="core-readout" key={strip.id} aria-live="polite">
      <p className="core-readout__meta sys">
        SECTION {strip.no ?? String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        <span>{strip.temp}</span>
        <span>{strip.period}</span>
      </p>
      <b className="core-readout__name">{strip.name}</b>
      <p className="core-readout__kept"><span className="sys">IN THIS PERIOD</span>{strip.kept}</p>
      {strip.images?.length > 0 && (
        <ul className="core-readout__works">
          {strip.images.map((image, i) => (
            <li key={image.src} style={{ '--i': i }}>
              <button type="button" onClick={() => onZoom?.(image)} aria-label={`${image.label} 크게 보기`}>
                <img src={image.src} alt={image.label} loading="lazy" draggable="false" />
              </button>
              <span className="sys">{image.label}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}
