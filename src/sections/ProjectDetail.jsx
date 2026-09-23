import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIMENS } from '../data/specimens';
import { getCase } from '../data/cases';
import { attachSmoothScroll } from '../lib/smooth';
import './detail.css';

/**
 * 이미지 한 장. src 가 비면 자리만 잡는다.
 * caption 은 화면에 그리지 않는다 — alt 로만 쓴다. 왼쪽 열엔 글자가 없다.
 */
function Shot({ src, caption, flat, half, hero }) {
  return (
    <figure className={`shot ${half ? 'shot--half' : ''} ${flat ? 'is-flat' : ''} ${hero ? 'shot--hero' : ''}`}>
      {src
        ? <img src={src} alt={caption || ''} loading="lazy" />
        : <span className="shot__slot" role="img" aria-label={caption || '준비 중인 이미지'} />}
    </figure>
  );
}

function Blk({ block, hero }) {
  switch (block.type) {
    case 'shot':
      return <Shot {...block} hero={hero} />;
    case 'duo':
      return (
        <div className="duo">
          {block.items.map((it, i) => <Shot key={i} {...it} half />)}
        </div>
      );
    default:
      return null;
  }
}

/**
 * PROJECT DETAIL
 *
 * 한쪽은 이미지만, 다른 쪽은 글만. 섞지 않는다.
 *   왼쪽  — 작업물이 끝까지 이미지로만 흐른다
 *   오른쪽 — 제목과 팩트. 따라붙은 채 고정된다.
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
      revealTimer = window.setTimeout(() => setRevealed(true), 620);
    } else {
      setRevealed(false);
      clearTimer = window.setTimeout(() => setRenderSpec(null), 760);
    }
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(clearTimer);
    };
  }, [spec]);

  const links = useMemo(() => (data?.visit || []).filter((v) => v.href), [data]);

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

  // 상세 스크롤에 관성을 준다. 휠 한 칸이 그대로 한 칸 점프하지 않는다.
  useEffect(() => {
    if (!spec) return undefined;
    return attachSmoothScroll(scrollRef.current, { tau: 0.2 });
  }, [spec]);

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
              {/* 왼쪽 — 이미지만 */}
              <div className="detail__stream">
                {/* 첫 장은 정확히 한 화면. 해상도가 달라도 잘리거나 넘치지 않는다. */}
                {data.stream.map((b, i) => <Blk key={i} block={b} hero={i === 0} />)}
              </div>

              {/* 오른쪽 — 제목과 팩트. 고정. */}
              <aside className="detail__panel">
                <p className="detail__no sys">{renderSpec.no}</p>
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

                {/* 주소가 아직 없는 링크는 내보내지 않는다 */}
                {links.length > 0 && (
                  <div className="prow">
                    <p className="prow__label sys">VISIT</p>
                    <p className="prow__links">
                      {links.map((v) => (
                        <a key={v.label} className="sys" href={v.href} target="_blank" rel="noreferrer">
                          {v.label}
                        </a>
                      ))}
                    </p>
                  </div>
                )}

                <div className="detail__foot">
                  <button type="button" className="sys" onClick={() => onSwitch(next.id)}>
                    NEXT — {next.no} {next.ko}
                  </button>
                  <button type="button" className="sys" onClick={onClose}>
                    RE-SOLIDIFY / ESC
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
