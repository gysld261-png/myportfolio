import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIMENS } from '../data/specimens';
import { getCase, SECTION_ORDER } from '../data/cases';
import './detail.css';

/** 블록 하나를 그린다. 타입 정의는 data/cases.js 주석 참고. */
function Block({ block }) {
  switch (block.type) {
    case 'p':
      return <p className="blk-p">{block.text}</p>;
    case 'list':
      return (
        <ul className="blk-list">
          {block.items.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      );
    case 'steps':
      return (
        <ol className="blk-steps">
          {block.items.map((t, i) => (
            <li key={i}>
              <span className="blk-steps__no">{String(i + 1).padStart(2, '0')}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      );
    case 'kv':
      return (
        <dl className="blk-kv">
          {block.rows.map(([k, v], i) => (
            <div key={i}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      );
    case 'quote':
      return (
        <blockquote className="blk-quote">
          <p>{block.text}</p>
          {block.source && <cite>{block.source}</cite>}
        </blockquote>
      );
    case 'figure':
      return (
        <figure className="blk-figure">
          {block.src
            ? <img src={block.src} alt={block.caption || ''} loading="lazy" />
            : <div className="blk-figure__empty" aria-hidden="true" />}
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case 'note':
      return <p className="blk-note">{block.text}</p>;
    default:
      return null;
  }
}

/**
 * PROJECT DETAIL — SELECTED → READ
 *
 * 탐색 Field와 분리된 전체 화면 읽기 모드다.
 * 상세 구간에서는 컨셉 효과보다 작품 읽기가 우선이다.
 */
export default function ProjectDetail({ spec, onClose, onSwitch }) {
  const scrollRef = useRef(null);
  const [current, setCurrent] = useState('overview');
  const data = spec ? getCase(spec.id) : null;

  const { prev, next } = useMemo(() => {
    if (!spec) return { prev: null, next: null };
    const i = SPECIMENS.findIndex((s) => s.id === spec.id);
    return {
      prev: SPECIMENS[(i - 1 + SPECIMENS.length) % SPECIMENS.length],
      next: SPECIMENS[(i + 1) % SPECIMENS.length],
    };
  }, [spec]);

  useEffect(() => {
    if (!spec) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setCurrent('overview');
    return () => window.removeEventListener('keydown', onKey);
  }, [spec, onClose]);

  // 읽고 있는 섹션을 왼쪽 목차에 반영한다
  useEffect(() => {
    const root = scrollRef.current;
    if (!spec || !root) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.dataset.section); });
      },
      { root, rootMargin: '-45% 0px -45% 0px' }
    );
    root.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [spec]);

  const goSection = (id) => {
    const root = scrollRef.current;
    const el = root?.querySelector(`[data-section="${id}"]`);
    if (root && el) root.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  };

  return (
    <article
      className={`detail ${spec ? 'is-open' : ''}`}
      aria-hidden={!spec}
      style={spec ? { '--pc': spec.color } : undefined}
    >
      {spec && data && (
        <>
          <header className="detail__head">
            <div>
              <p className="sys detail__eyebrow">SELECTED SPECIMEN / {spec.tag}</p>
              <h2 className="detail__title">{spec.no} / {spec.ko}</h2>
              <p className="sys detail__meta">{spec.role} · {spec.year}</p>
            </div>
            <button type="button" className="detail__close sys" onClick={onClose} aria-label="닫기">
              ESC ✕
            </button>
          </header>

          <nav className="detail__toc" aria-label="섹션">
            {SECTION_ORDER.map((s) => (
              <button
                key={s.id}
                type="button"
                className={current === s.id ? 'is-current' : ''}
                onClick={() => goSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="detail__scroll" ref={scrollRef}>
            <div className="detail__pad">
              <section className="detail__intro" data-section="overview">
                <div className="detail__plane detail__plane--intro">
                  <p className="sys detail__observe">OBSERVATION POINT / 00</p>
                  {data.headline && <p className="detail__headline">{data.headline}</p>}
                  <p className="detail__lead">{data.summary}</p>

                  {data.meta?.length > 0 && (
                    <dl className="blk-kv detail__factsheet">
                      {data.meta.map(([k, v], i) => (
                        <div key={i}><dt>{k}</dt><dd>{v}</dd></div>
                      ))}
                    </dl>
                  )}

                  <p className="sys detail__swatch">
                    <i aria-hidden="true" /> PROJECT COLOR
                  </p>
                  {(data.sections.overview || []).map((block, index) => (
                    <Block key={index} block={block} />
                  ))}
                </div>
              </section>

              {SECTION_ORDER.filter((s) => s.id !== 'overview').map((s, sectionIndex) => {
                const blocks = data.sections[s.id] || [];
                return (
                  <section key={s.id} data-section={s.id} className={`detail__section ${sectionIndex % 2 ? 'is-left' : 'is-right'}`}>
                    <div className="detail__plane">
                      <p className="sys detail__observe">OBSERVATION POINT / {String(sectionIndex + 1).padStart(2, '0')}</p>
                      <h3 className="detail__h3">
                        <span className="sys">{s.label}</span>
                        <em>{s.ko}</em>
                      </h3>
                      {blocks.length === 0
                        ? <p className="blk-note">작성 예정</p>
                        : blocks.map((b, i) => <Block key={i} block={b} />)}
                    </div>
                  </section>
                );
              })}

              {/* 다른 프로젝트로 전환할 때 같은 세계 안에서 선택이 바뀌는 느낌을 준다 */}
              <nav className="detail__switch" aria-label="다른 프로젝트">
                <button type="button" onClick={() => onSwitch(prev.id)}>
                  <span className="sys">PREV</span>
                  <em>{prev.no} {prev.ko}</em>
                </button>
                <button type="button" onClick={() => onSwitch(next.id)}>
                  <span className="sys">NEXT</span>
                  <em>{next.no} {next.ko}</em>
                </button>
              </nav>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
