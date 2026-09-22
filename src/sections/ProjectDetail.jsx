import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIMENS } from '../data/specimens';
import { getCase } from '../data/cases';
import './detail.css';

/** 이미지 한 장. src 가 비면 촬영 대기 슬롯으로 그린다. */
function Shot({ src, label, caption, flat, half }) {
  return (
    <figure className={`shot ${half ? 'shot--half' : ''} ${flat ? 'is-flat' : ''} ${src ? '' : 'is-pending'}`}>
      {label && <p className="shot__label sys">{label}</p>}
      {src
        ? <img src={src} alt={caption || label || ''} loading="lazy" />
        : <span className="shot__slot sys" aria-hidden="true">CAPTURE PENDING</span>}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function Blk({ block }) {
  switch (block.type) {
    case 'shot':
      return <Shot {...block} />;
    case 'duo':
      return (
        <div className="duo">
          {block.items.map((it, i) => <Shot key={i} {...it} half />)}
        </div>
      );
    case 'note':
      return (
        <section className="note">
          {block.label && <p className="note__label sys">{block.label}</p>}
          {block.title && <h3 className="note__title">{block.title}</h3>}
          {block.body.map((t, i) => <p key={i} className="note__p">{t}</p>)}
        </section>
      );
    case 'steps':
      return (
        <section className="note">
          {block.label && <p className="note__label sys">{block.label}</p>}
          {block.title && <h3 className="note__title">{block.title}</h3>}
          <ol className="steps">
            {block.items.map((t, i) => (
              <li key={i}>
                <span className="steps__no sys">{String(i + 1).padStart(2, '0')}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    default:
      return null;
  }
}

/**
 * PROJECT DETAIL
 *
 * 왼쪽은 작업물이 흐르고, 오른쪽 팩트 패널은 따라붙은 채 고정된다.
 * 읽는 구간에서는 컨셉 효과보다 작업을 보는 일이 먼저다.
 */
export default function ProjectDetail({ spec, onClose, onSwitch }) {
  const scrollRef = useRef(null);
  const [renderSpec, setRenderSpec] = useState(spec);
  const [revealed, setRevealed] = useState(false);
  const data = renderSpec ? getCase(renderSpec.id) : null;

  // 닫힐 때 내용을 즉시 지우지 않는다. 정보층이 얼음 안으로 흡수된 뒤 정리한다.
  useEffect(() => {
    let revealTimer;
    let clearTimer;
    if (spec) {
      setRenderSpec(spec);
      setRevealed(false);
      revealTimer = window.setTimeout(() => setRevealed(true), 720);
    } else {
      setRevealed(false);
      clearTimer = window.setTimeout(() => setRenderSpec(null), 760);
    }
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(clearTimer);
    };
  }, [spec]);

  const next = useMemo(() => {
    if (!renderSpec) return null;
    const i = SPECIMENS.findIndex((s) => s.id === renderSpec.id);
    return SPECIMENS[(i + 1) % SPECIMENS.length];
  }, [renderSpec]);

  // onClose 는 부모에서 매 렌더 새로 만들어진다. Field 의 HUD 가 매 프레임 갱신되므로
  // 이걸 의존성에 넣으면 스크롤 위치가 계속 0 으로 되돌아간다. ref 로 고정한다.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!spec) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spec]);

  // 프로젝트가 바뀔 때만 맨 위로 올린다
  useEffect(() => {
    if (spec && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [spec?.id]);

  return (
    <article
      className={`detail ${spec ? 'is-open' : ''} ${revealed ? 'is-revealed' : ''}`}
      aria-hidden={!spec}
      style={renderSpec ? { '--pc': renderSpec.color } : undefined}
    >
      {renderSpec && data && (
        <>
          <nav className="detail__pills" aria-label="상세 탐색">
            <button type="button" onClick={onClose}>/ RETURN</button>
            <button type="button" onClick={() => onSwitch(next.id)}>NEXT</button>
          </nav>

          <div className="detail__scroll" ref={scrollRef}>
            <div className="detail__grid">
              {/* 왼쪽 — 작업물이 흐른다 */}
              <div className="detail__stream">
                {data.stream.map((b, i) => <Blk key={i} block={b} />)}

                <button type="button" className="detail__next" onClick={() => onSwitch(next.id)}>
                  <span className="sys">NEXT SPECIMEN</span>
                  <em>{next.no} / {next.ko}</em>
                </button>
              </div>

              {/* 가운데 — 지금 보고 있는 표본 */}
              <div className="detail__chip" aria-hidden="true">
                <span className="sys">{renderSpec.ko}</span>
              </div>

              {/* 오른쪽 — 팩트. 스크롤하지 않는다. */}
              <aside className="detail__panel">
                <h2 className="detail__title">{renderSpec.ko}</h2>
                <p className="detail__kicker sys">{data.kicker}</p>

                {data.panel.map((row, i) => (
                  <div key={i} className="prow">
                    <p className="prow__label sys">{row.label}</p>
                    {Array.isArray(row.body)
                      ? row.body.map((t, j) => <p key={j} className="prow__body">{t}</p>)
                      : <p className="prow__body prow__body--sys">{row.body}</p>}
                  </div>
                ))}

                {data.visit?.length > 0 && (
                  <div className="prow">
                    <p className="prow__label sys">VISIT</p>
                    <p className="prow__links">
                      {data.visit.map((v) => (
                        <a key={v.href} className="sys" href={v.href} target="_blank" rel="noreferrer">
                          [{v.label}]
                        </a>
                      ))}
                    </p>
                  </div>
                )}

                <button type="button" className="detail__close sys" onClick={onClose}>
                  RE-SOLIDIFY / ESC
                </button>
              </aside>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
