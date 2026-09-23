import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIMENS } from '../data/specimens';
import { getCase } from '../data/cases';
import { attachSmoothScroll, attachScrollVelocity } from '../lib/smooth';
import RollText from '../components/RollText';
import CaseStudyBoards from '../components/CaseStudyBoards';
import './detail.css';

/**
 * 이미지 한 장. src 가 비면 자리만 잡는다.
 * alt 는 화면에 그리지 않는다 — 이 페이지엔 캡션이 없다.
 */
function Shot({ src, alt, ratio }) {
  return (
    <figure className="shot" style={ratio ? { '--ratio': ratio } : undefined}>
      {src
        ? <img src={src} alt={alt || ''} loading="lazy" />
        : <span className="shot__slot" role="img" aria-label={alt || '준비 중인 이미지'} />}
    </figure>
  );
}

/**
 * PC 목업 안에서 실제 사이트가 스크롤되는 영상.
 * 화면에 들어오면 소리 없이 재생하고, 나가면 멈춘다 — 안 보이는 영상을 계속 돌리지 않는다.
 * 모션 축소 설정이거나 브라우저가 자동 재생을 막으면 대표 이미지 위에 재생 버튼을 둔다.
 */
function Device({ video, poster, alt }) {
  const ref = useRef(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setBlocked(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      else el.pause();
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const play = () => { ref.current?.play().then(() => setBlocked(false)).catch(() => {}); };

  return (
    <figure className="device" aria-label={alt}>
      <div className="device__frame">
        <div className="device__screen">
          <video ref={ref} src={video} poster={poster} muted loop playsInline preload="metadata" aria-hidden="true" />
          {blocked && (
            <button type="button" className="device__play sys" onClick={play}>PLAY ▶</button>
          )}
        </div>
      </div>
      <span className="device__neck" aria-hidden="true" />
      <span className="device__base" aria-hidden="true" />
    </figure>
  );
}

/* 이미지 리듬. 한 줄에 최대 셋까지만 간다. */
function Row({ block }) {
  if (block.type === 'device') return <div className="row row--device"><Device {...block} /></div>;
  if (block.type === 'full') return <div className="row row--full"><Shot {...block} /></div>;
  if (block.type === 'duo') {
    return (
      <div className="row row--duo">
        {block.items.map((it, i) => <Shot key={i} {...it} />)}
      </div>
    );
  }
  if (block.type === 'split') {
    return (
      <div className="row row--split">
        {block.items.map((it, i) => <Shot key={i} {...it} />)}
      </div>
    );
  }
  if (block.type === 'trio') {
    return (
      <div className="row row--trio">
        {block.items.map((it, i) => <Shot key={i} {...it} />)}
      </div>
    );
  }
  return null;
}

/**
 * PROJECT DETAIL
 *
 * 이미지가 캐리하고, 자세한 건 링크로 넘긴다.
 *
 *   히어로   표본 하나. 좌우 끝에 제목과 연도가 걸린다. 딱 한 화면.
 *   메타     왼쪽 1/3 에 라벨, 오른쪽 절반에 INFO. 링크는 여기 모인다.
 *   리듬     full / duo / split / trio. 캡션 없음.
 *   CONCEPT  글이 두 번째이자 마지막으로 나오는 자리. 왼쪽 절반을 비운다.
 *   NEXT     다음 표본 하나.
 *
 * 글을 두 군데로 제한하는 게 이 레이아웃의 전부다. 늘리면 무너진다.
 */
export default function ProjectDetail({ spec, onClose, onSwitch }) {
  const scrollRef = useRef(null);
  const [renderSpec, setRenderSpec] = useState(spec);
  const [revealed, setRevealed] = useState(false);
  const data = renderSpec ? getCase(renderSpec.id) : null;
  const projectHero = data?.hero?.src || (renderSpec?.id === 'tchaikim' ? '/cases/tchaikim-home.jpg' : null);
  const heroAlt = data?.hero?.alt || (projectHero ? '차이킴 웹사이트 디자인' : '');

  // 닫힐 때 내용을 즉시 지우지 않는다. 정보층이 얼음 안으로 흡수된 뒤 정리한다.
  useEffect(() => {
    let clearTimer;
    if (spec) {
      setRenderSpec(spec);
      setRevealed(true);
    } else {
      setRevealed(false);
      clearTimer = window.setTimeout(() => setRenderSpec(null), 440);
    }
    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [spec]);

  useEffect(() => {
    if (!spec || renderSpec?.id !== spec.id) return undefined;
    const frame = requestAnimationFrame(() => scrollRef.current?.querySelector('.dhero__title')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [spec, renderSpec]);

  const links = useMemo(() => (data?.visit || []).filter((v) => v.href), [data]);

  const next = useMemo(() => {
    if (!renderSpec) return null;
    const i = SPECIMENS.findIndex((s) => s.id === renderSpec.id);
    return SPECIMENS[(i + 1) % SPECIMENS.length];
  }, [renderSpec]);

  /* concept 자리표가 없으면 리듬 맨 끝에 붙인다 — 글이 사라지는 일은 없게 */
  const blocks = useMemo(() => {
    if (!data) return [];
    const content = projectHero ? data.blocks.filter(b => b.src !== projectHero) : data.blocks;
    const has = content.some((b) => b.type === 'concept');
    const hasText = (data.concept || []).length > 0;
    return has || !hasText ? content : [...content, { type: 'concept' }];
  }, [data, projectHero]);

  // onClose 는 부모에서 매 렌더 새로 만들어진다. Field 의 HUD 가 매 프레임 갱신되므로
  // 이걸 의존성에 넣으면 스크롤 위치가 계속 0 으로 되돌아간다. ref 로 고정한다.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!spec) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const viewer = scrollRef.current?.querySelector('.case-board-viewer[open]');
      if (viewer) viewer.close();
      else closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [spec]);

  // 프로젝트가 바뀔 때만 맨 위로 올린다
  useEffect(() => {
    if (spec && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [spec?.id]);

  // 상세 스크롤에 관성을 준다. 휠 한 칸이 그대로 한 칸 점프하지 않는다.
  // 거기에 속도를 CSS 로 흘려보내서, 빠르게 내릴수록 이미지가 울렁이게 한다.
  useEffect(() => {
    if (!spec) return undefined;
    const off1 = attachSmoothScroll(scrollRef.current, { tau: 0.2 });
    const off2 = attachScrollVelocity(scrollRef.current, { max: 2400, tau: 0.07 });
    return () => { off1(); off2(); };
  }, [spec]);

  return (
    <article
      className={`detail ${spec ? 'is-open' : ''} ${revealed ? 'is-revealed' : ''}`}
      aria-hidden={!spec}
      inert={!spec ? '' : undefined}
      style={renderSpec ? { '--pc': renderSpec.color } : undefined}
    >
      {renderSpec && data && (
        <>
          <nav className="detail__pills" aria-label="상세 탐색">
            <button type="button" className="roll" onClick={onClose} aria-label="필드로 돌아가기">
              <RollText text="/ RETURN" />
            </button>
            <button type="button" className="roll" onClick={() => onSwitch(next.id)}
              aria-label="다음 프로젝트">
              <RollText text="NEXT" />
            </button>
          </nav>

          <div className="detail__scroll" ref={scrollRef}>
            {/* Project artwork, with transparent mockups framed to their visible bounds. */}
            <header className={`dhero ${projectHero ? 'dhero--project' : ''} ${data.hero?.viewBox ? 'dhero--cutout' : ''}`}>
              <h2 className="dhero__title" tabIndex={-1}>{renderSpec.ko}</h2>
              <div className="dhero__plate">
                {data.hero?.viewBox ? (
                  <svg className="dhero__cutout" viewBox={data.hero.viewBox} role="img" aria-label={heroAlt}>
                    <image href={projectHero} width={data.hero.width} height={data.hero.height} />
                  </svg>
                ) : <img src={projectHero || renderSpec.imageCut || renderSpec.image} alt={heroAlt} />}
              </div>
              <p className="dhero__year sys">YEAR — {data.year}</p>
            </header>

            {/* ── 메타 — 라벨은 깨알, 값은 보통. 자세한 건 전부 링크로. ── */}
            <section className="dmeta">
              <div className="dmeta__col">
                <p className="dmeta__label sys">CATEGORIES</p>
                {data.categories.map((c) => <p key={c} className="dmeta__value">{c}</p>)}
              </div>

              <div className="dmeta__col">
                <p className="dmeta__label sys">ROLE</p>
                {data.role.map((r) => <p key={r} className="dmeta__value">{r}</p>)}

                {links.length > 0 && (
                  <ul className="dmeta__links">
                    {links.map((v) => (
                      <li key={v.label}>
                        <a className="sys roll" href={v.href} target="_blank" rel="noreferrer"
                          aria-label={v.label}>
                          <RollText text={v.label} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="dmeta__info">
                <p className="dmeta__label sys">(INFO)</p>
                <p className="dmeta__body">{data.info}</p>
              </div>
            </section>

            {/* ── 리듬 ── */}
            {data.layout === 'boards' ? (
              <CaseStudyBoards key={renderSpec.id} blocks={blocks} active={Boolean(spec)} />
            ) : <div className="dflow">
              {blocks.map((b, i) => (
                b.type === 'concept'
                  ? (data.concept || []).length > 0 && (
                      <section className="dconcept" key={i}>
                        <p className="dmeta__label sys">CONCEPT</p>
                        <div className="dconcept__body">
                          {data.concept.map((t, j) => <p key={j}>{t}</p>)}
                        </div>
                      </section>
                    )
                  : <Row key={i} block={b} />
              ))}
            </div>}

            {/* ── 다음 표본 ── */}
            <footer className="dnext">
              <span className="sys dnext__mark">{renderSpec.no}</span>
              <button type="button" className="dnext__plate" onClick={() => onSwitch(next.id)}>
                <img src={next.imageCut || next.image} alt="" />
                <span className="dnext__name">{next.ko}</span>
              </button>
              <button type="button" className="sys dnext__go roll" onClick={() => onSwitch(next.id)}
                aria-label="다음 프로젝트">
                <RollText text="NEXT PROJECT →" />
              </button>
            </footer>
          </div>
        </>
      )}
    </article>
  );
}
