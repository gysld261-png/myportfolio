import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIMENS } from '../data/specimens';
import { getCase } from '../data/cases';
import { attachSmoothScroll, attachScrollVelocity, attachScrollReveal } from '../lib/smooth';
import RollText from '../components/RollText';
import CaseStudyBoards from '../components/CaseStudyBoards';
import './detail.css';

/* 얼음이 녹고 남은 표본 — 레퍼런스처럼 상세 배경에 로고를 흐릿하고 크게 남긴다. */
const GHOST = {
  odit: '/cases/odit-logo.svg',
  tchaikim: '/cases/tchaikim-logo.svg',
  walga: '/cases/walga-logo.svg',
};

/**
 * 이미지 한 장. src 가 비면 자리만 잡는다.
 * alt 는 화면에 그리지 않는다 — 이 페이지엔 캡션이 없다.
 */
function Shot({ src, alt, ratio, video, poster, overlay }) {
  /* overlay — 사진 위 한 자리에 영상을 겹친다(예: 착용컷 위 상품 카드의 호버 영상).
     x·y·w 는 사진 대비 % 이고 Figma 의 'VIDEO SLOT' 레이어 자리와 같다. 사진과 영상은 한 겹으로 같이 흐른다 */
  if (overlay) {
    return (
      <figure className="shot">
        <div className="shot__stack">
          <img src={src} alt={alt || ''} loading="lazy" />
          <div className="shot__overlay" style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, width: `${overlay.w}%` }}>
            <ShotVideo video={overlay.video} poster={overlay.poster} alt={overlay.alt} />
          </div>
        </div>
      </figure>
    );
  }
  return (
    <figure className="shot" style={ratio ? { '--ratio': ratio } : undefined}>
      {video
        ? <ShotVideo video={video} poster={poster} alt={alt} />
        : src
          ? <img src={src} alt={alt || ''} loading="lazy" />
          : <span className="shot__slot" role="img" aria-label={alt || '준비 중인 이미지'} />}
    </figure>
  );
}

/**
 * 리듬 안의 짧은 인터랙션 영상 — 사진 자리에 그대로 들어간다(기기 틀 없이).
 * 화면에 들어오면 소리 없이 반복하고, 나가면 멈춘다. 모션 축소 설정이면 대표 이미지만 보인다.
 */
function ShotVideo({ video, poster, alt }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play().catch(() => {});
      else el.pause();
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={video} poster={poster} muted loop playsInline preload="metadata" aria-label={alt} />;
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
  if (block.type === 'device') return <div className="row row--device" data-reveal><Device {...block} /></div>;
  if (block.type === 'full') return <div className="row row--full" data-reveal><Shot {...block} /></div>;
  if (block.type === 'duo') {
    return (
      <div className="row row--duo" data-reveal>
        {block.items.map((it, i) => <Shot key={i} {...it} />)}
      </div>
    );
  }
  if (block.type === 'split') {
    return (
      <div className="row row--split" data-reveal>
        {block.items.map((it, i) => <Shot key={i} {...it} />)}
      </div>
    );
  }
  if (block.type === 'trio') {
    return (
      <div className="row row--trio" data-reveal>
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
export default function ProjectDetail({ spec, onClose, onSwitch, portal = false, returnTo = null }) {
  const scrollRef = useRef(null);
  const articleRef = useRef(null);
  const metaRef = useRef(null);
  const [renderSpec, setRenderSpec] = useState(spec);
  const [revealed, setRevealed] = useState(false);
  const [metaRevealed, setMetaRevealed] = useState(false);
  const data = renderSpec ? getCase(renderSpec.id) : null;
  const cinematicCover = data?.cinematicHero || null;
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
    if (!spec || portal || renderSpec?.id !== spec.id) return undefined;
    const frame = requestAnimationFrame(() => scrollRef.current?.querySelector('.dhero__title, .dhero__a11y')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [spec, renderSpec, portal]);

  const links = useMemo(() => (data?.visit || []).filter((v) => v.href), [data]);
  // 사이트 또는 프로토타입 — 떠 있는 버튼과 끝의 큰 링크에서 직접 체험으로 이어진다.
  const live = links.find((v) => v.label === 'VIEW SITE')
    || links.find((v) => v.label === 'VIEW PROTOTYPE') || null;
  const isPrototype = live?.label === 'VIEW PROTOTYPE';
  const deck = links.find((v) => v.label === 'DECK') || null;   // 기획서(Figma 슬라이드) — 맨 아래 두 번째 출구
  const liveHost = live ? live.href.replace(/^https?:\/\//, '').split('/')[0] : '';

  const next = useMemo(() => {
    if (!renderSpec) return null;
    const i = SPECIMENS.findIndex((s) => s.id === renderSpec.id);
    return SPECIMENS[(i + 1) % SPECIMENS.length];
  }, [renderSpec]);
  const nextData = next ? getCase(next.id) : null;
  const nextPreview = nextData?.cinematicHero || nextData?.hero || (next?.id === 'odit' ? {
    src: '/cases/odit-preview.jpg',
    width: 2400,
    height: 1500,
    alt: 'ODIT 관심사 탐색 서비스의 주요 모바일 화면',
  } : null);

  /* concept 자리표가 없으면 리듬 맨 끝에 붙인다 — 글이 사라지는 일은 없게 */
  const blocks = useMemo(() => {
    if (!data) return [];
    const leadSource = cinematicCover?.src || projectHero;
    const content = leadSource ? data.blocks.filter(b => b.src !== leadSource) : data.blocks;
    const has = content.some((b) => b.type === 'concept');
    const hasText = (data.concept || []).length > 0;
    return has || !hasText ? content : [...content, { type: 'concept' }];
  }, [cinematicCover, data, projectHero]);

  // onClose 는 부모에서 매 렌더 새로 만들어진다. Field 의 HUD 가 매 프레임 갱신되므로
  // 이걸 의존성에 넣으면 스크롤 위치가 계속 0 으로 되돌아간다. ref 로 고정한다.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // 상세는 App 의 go 를 모른다. 주소를 메인으로 바꾸고 App 의 popstate 처리에 맡긴다.
  const goMain = () => {
    window.history.pushState(null, '', window.location.pathname);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    if (!spec) return undefined;
    const onKey = (e) => {
      if (e.target instanceof Element && e.target.closest('.contact[open]')) return;
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

  /* 레퍼런스처럼 첫 보드를 한 화면 가득 붙잡은 뒤, 스크롤 진행에 맞춰
     안쪽으로 축소하고 모서리를 만든다. DOM을 다시 그리지 않고 CSS 변수만 갱신한다. */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!spec || portal || !cinematicCover || !scroller) return undefined;

    let frame = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const sync = () => {
      frame = 0;
      const compact = scroller.clientWidth <= 700;
      // 축소는 표지가 붙잡혀 있는 구간(히어로 높이 − 화면 높이) 전체에 걸쳐 진행한다.
      // 더 일찍 끝나면 남은 구간 동안 화면이 멈춘 채 스크롤만 먹어서 한 번 걸린 느낌이 난다.
      const hero = scroller.querySelector('.dhero--cinematic');
      const travel = Math.max(1, (hero?.offsetHeight || scroller.clientHeight * 1.72) - scroller.clientHeight);
      const linear = reduced ? 1 : Math.min(1, Math.max(0, scroller.scrollTop / travel));
      // 끝으로 갈수록 살짝만 느려진다 — 완전히 멈추는 구간 없이 고정이 풀리며 위로 이어진다
      const progress = 1 - (1 - linear) ** 1.6;
      const shrink = compact ? 0.055 : 0.105;
      const radius = compact ? 28 : 64;

      scroller.style.setProperty('--cinema-progress', progress.toFixed(4));
      scroller.style.setProperty('--cinema-scale', (1 - progress * shrink).toFixed(4));
      scroller.style.setProperty('--cinema-radius', `${(progress * radius).toFixed(2)}px`);
      scroller.style.setProperty('--cinema-cue', Math.max(0, 1 - progress * 2.4).toFixed(4));
      scroller.style.setProperty('--cinema-shadow', (progress * 0.44).toFixed(4));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };

    sync();
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      scroller.style.removeProperty('--cinema-progress');
      scroller.style.removeProperty('--cinema-scale');
      scroller.style.removeProperty('--cinema-radius');
      scroller.style.removeProperty('--cinema-cue');
      scroller.style.removeProperty('--cinema-shadow');
    };
  }, [cinematicCover, portal, spec]);

  /* 온도 — 스크롤 진행도(0→1)를 --heat 로 흘린다. 배경 온도와 서리선이 이 값 하나로 움직인다.
     매 프레임 React 를 다시 그리지 않고 CSS 변수만 바꾼다. */
  useEffect(() => {
    const scroller = scrollRef.current;
    const article = articleRef.current;
    if (!spec || portal || !scroller || !article) return undefined;
    let frame = 0;
    const sync = () => {
      frame = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const heat = max > 0 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0;
      article.style.setProperty('--heat', heat.toFixed(4));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    sync();
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      article.style.removeProperty('--heat');
    };
    // 스크롤 영역은 renderSpec 이 채워진 다음 렌더에 생긴다 — 그 id 로도 다시 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, spec?.id, renderSpec?.id]);

  /* 이미지가 축소되어 자리를 잡은 다음, 메타 정보가 짧은 간격으로 이어서 등장한다. */
  useEffect(() => {
    if (!spec || portal || !cinematicCover) {
      setMetaRevealed(true);
      return undefined;
    }

    setMetaRevealed(false);
    const node = metaRef.current;
    const root = scrollRef.current;
    if (!node || !root) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setMetaRevealed(true);
        observer.disconnect();
      }
    }, { root, threshold: 0.16 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cinematicCover, portal, spec]);

  // 상세 스크롤에 관성을 준다. 휠 한 칸이 그대로 한 칸 점프하지 않는다.
  // 거기에 속도를 CSS 로 흘려보내서, 빠르게 내릴수록 이미지가 울렁이게 한다.
  useEffect(() => {
    if (!spec || portal) return undefined;
    const off1 = attachSmoothScroll(scrollRef.current, { tau: 0.2 });
    const off2 = attachScrollVelocity(scrollRef.current, { max: 2400, tau: 0.07 });
    return () => { off1(); off2(); };
  }, [portal, spec]);

  // 덩어리마다 화면에 들어올 때 올라오며 드러나고, 사진은 프레임 안에서 느리게 흐른다.
  // 내용이 새 프로젝트로 바뀐 뒤(renderSpec)에 붙여야 새 블록을 잡는다.
  useEffect(() => {
    if (!spec || portal || renderSpec?.id !== spec.id) return undefined;
    return attachScrollReveal(scrollRef.current);
    // spec 객체 대신 id 로 건다 — 부모가 자주 다시 그려져 매번 새로 붙였다 떼면 관찰 결과가 오기 전에 지워진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal, spec?.id, renderSpec?.id]);

  return (
    <article
      className={`detail ${spec ? 'is-open' : ''} ${revealed ? 'is-revealed' : ''} ${portal ? 'is-portal' : ''} ${cinematicCover ? 'detail--cinematic' : ''} ${live ? 'has-live' : ''}`}
      aria-hidden={!spec || portal}
      inert={!spec || portal ? '' : undefined}
      ref={articleRef}
      style={renderSpec ? { '--pc': renderSpec.color } : undefined}
    >
      {/* 온도 — 스크롤할수록 차가운 먹색에서 따뜻한 먹색으로. 서리선은 읽은 만큼 차오른다 (detail.css) */}
      <div className="detail__air" aria-hidden="true" />
      {!portal && renderSpec && <span className="detail__frost" aria-hidden="true"><i /></span>}
      {renderSpec && data && (
        <>
          <header className="detail__chrome">
            {/* 전역 네비의 로고와 같은 버튼 — 자리·글꼴·롤 효과까지 그대로 이어진다. */}
            <button type="button" className="detail__brand nav__mark roll" onClick={goMain} aria-label="메인으로 이동">
              <RollText text="PARK HYOMIN" />
            </button>
            <div className="detail__actions">
              {/* ABOUT 의 방에서 건너왔으면 그 방으로 곧장 돌아가는 길을 먼저 보여준다 */}
              {returnTo && (
                <button type="button" className="detail__return sys" onClick={returnTo.onBack}>
                  <i aria-hidden="true">←</i> ABOUT · {returnTo.label}
                </button>
              )}
              <button
                type="button"
                className="detail__dismiss"
                onClick={onClose}
                aria-label="프로젝트 상세 닫기"
              >
                <span aria-hidden="true" />
              </button>
            </div>
          </header>

          {!portal && live && (
            <a
              className="detail__visit sys"
              href={live.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${renderSpec.ko} ${isPrototype ? '프로토타입' : '사이트'} 새 창으로 열기`}
            >
              <span className="detail__visit-dot" aria-hidden="true" />
              {isPrototype ? 'VIEW PROTOTYPE' : 'VISIT LIVE SITE'} <i aria-hidden="true">↗</i>
            </a>
          )}

          {!portal && GHOST[renderSpec.id] && (
            <div className="detail__ghost" aria-hidden="true" key={renderSpec.id}>
              <img src={GHOST[renderSpec.id]} alt="" draggable="false" />
            </div>
          )}

          <div className="detail__scroll" ref={scrollRef}>
            {/* 보드형 프로젝트는 첫 장이 풀스크린에서 카드로 응축된다. */}
            {cinematicCover ? (
              <header className="dhero dhero--cinematic">
                <h2 className="dhero__a11y" tabIndex={-1}>{renderSpec.ko}</h2>
                <div className="dhero__cinema-pin">
                  <figure className="dhero__cinema-frame" style={cinematicCover.background ? { background: cinematicCover.background } : undefined}>
                    <img
                      src={cinematicCover.src}
                      alt={cinematicCover.alt || `${renderSpec.ko} 프로젝트 표지`}
                      width={cinematicCover.width}
                      height={cinematicCover.height}
                      loading="eager"
                      fetchpriority="high"
                    />
                  </figure>
                  <p className="dhero__cinema-cue sys" aria-hidden="true">SCROLL / VIEW PROJECT</p>
                </div>
              </header>
            ) : (
              <header className={`dhero ${projectHero ? 'dhero--project' : ''} ${data.hero?.viewBox ? 'dhero--cutout' : ''}`}>
                <h2 className="dhero__title" tabIndex={-1}>
                  {renderSpec.ko}
                </h2>
                <div className="dhero__plate">
                  {data.hero?.viewBox ? (
                    <svg className="dhero__cutout" viewBox={data.hero.viewBox} role="img" aria-label={heroAlt}>
                      <image href={projectHero} width={data.hero.width} height={data.hero.height} />
                    </svg>
                  ) : <img src={projectHero || renderSpec.imageCut || renderSpec.image} alt={heroAlt} />}
                </div>
                <p className="dhero__year sys">
                  {`YEAR — ${data.year}`}
                </p>
              </header>
            )}

            {!portal && <>
            {/* ── 메타 — 라벨은 깨알, 값은 보통. 자세한 건 전부 링크로. ── */}
            <section
              ref={metaRef}
              className={`dmeta ${cinematicCover ? 'dmeta--cinematic' : ''} ${metaRevealed ? 'is-visible' : ''}`}
            >
              <div className="dmeta__col">
                <p className="dmeta__label sys">CATEGORIES</p>
                {data.categories.map((c, i) => <p key={c} className="dmeta__value">{c}</p>)}
              </div>

              <div className="dmeta__col">
                <p className="dmeta__label sys">ROLE</p>
                {data.role.map((r, i) => <p key={r} className="dmeta__value">{r}</p>)}

                {links.length > 0 && (
                  <ul className="dmeta__links">
                    {links.map((v) => (
                      <li key={v.label}>
                        <a className="ui-pill ui-pill--external sys roll" href={v.href} target="_blank" rel="noreferrer"
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

              {data.ownership?.length > 0 && (
                <section className="downership" aria-labelledby={`${renderSpec.id}-ownership`}>
                  <header className="downership__head">
                    <p id={`${renderSpec.id}-ownership`} className="dmeta__label sys">SCOPE &amp; OWNERSHIP</p>
                    <p className="downership__team sys">TEAM PROJECT · {String(data.teamSize).padStart(2, '0')} MEMBERS</p>
                  </header>
                  <ol className="downership__list">
                    {data.ownership.map((item, index) => (
                      <li key={item.label} className="downership__item" data-level={item.level.toLowerCase()}>
                        <span className="downership__number sys">{String(index + 1).padStart(2, '0')}</span>
                        <p className="downership__discipline">{item.label}</p>
                        <strong className="downership__level">{item.level}</strong>
                        <p className="downership__scope">{item.scope}</p>
                        <span className="downership__signal" aria-hidden="true" />
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </section>

            {/* ── 리듬 ── */}
            {data.layout === 'boards' ? (
              <CaseStudyBoards key={renderSpec.id} blocks={blocks} active={Boolean(spec)} />
            ) : <div className="dflow">
              {blocks.map((b, i) => (
                b.type === 'concept'
                  ? (data.concept || []).length > 0 && (
                      <section className="dconcept" key={i} data-reveal>
                        <p className="dmeta__label sys">CONCEPT</p>
                        <div className="dconcept__body">
                          {data.concept.map((t, j) => <p key={j}>{t}</p>)}
                        </div>
                      </section>
                    )
                  : <Row key={i} block={b} />
              ))}
            </div>}

            {/* ── 직접 써 보기 — 사이트 또는 프로토타입으로 넘어가는 가장 큰 출구 ── */}
            {(live || deck) && (
              <section className="dlive" data-reveal>
                <p className="dmeta__label sys">{live ? (isPrototype ? '(PROTOTYPE)' : '(LIVE)') : '(DECK)'}</p>
                <div className="dlive__links">
                  {live && (
                    <a className="dlive__link" href={live.href} target="_blank" rel="noreferrer">
                      <span className="dlive__title">{isPrototype ? '프로토타입을 체험해 보세요' : '직접 사용해 보세요'}</span>
                      <span className="dlive__meta sys">
                        <span>{isPrototype ? 'FIGMA PROTOTYPE' : liveHost}</span>
                        <span className="dlive__go">{isPrototype ? 'OPEN PROTOTYPE' : 'OPEN SITE'} <i aria-hidden="true">↗</i></span>
                      </span>
                    </a>
                  )}
                  {/* 기획서 — 사이트보다 한 단계 작게. 링크가 비어 있으면 나오지 않는다 */}
                  {deck && (
                    <a className="dlive__deck" href={deck.href} target="_blank" rel="noreferrer">
                      <span className="dlive__deck-title">기획서 보기</span>
                      <span className="dlive__go sys">FIGMA SLIDES <i aria-hidden="true">↗</i></span>
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* ── 다음 프로젝트 — 한 화면에 작은 카드 한 장. 이름은 사진 밖 왼쪽에 둔다.
                 꽉 찬 미리보기는 다음 이야기가 이미 시작된 것처럼 보여서 '끝 → 다음'의 쉼표가 사라졌다. ── */}
            <footer className="dnext" data-reveal>
              <button
                type="button"
                className="dnext__stage"
                onClick={() => onSwitch(next.id)}
                data-cursor="NEXT PROJECT"
                aria-label={`다음 프로젝트 ${next.ko} 보기`}
              >
                <span className="dnext__label">
                  <span className="sys dnext__eyebrow">NEXT PROJECT / {next.no}</span>
                  <span className="dnext__title">{next.ko}</span>
                  <span className="dnext__lead">{next.lead}</span>
                </span>

                <span className="dnext__card" aria-hidden="true">
                  {nextPreview?.src && (
                    <img
                      src={nextPreview.src}
                      alt=""
                      width={nextPreview.width}
                      height={nextPreview.height}
                      loading="lazy"
                    />
                  )}
                </span>

                <span className="dnext__side sys" aria-hidden="true">
                  <span>{next.role}</span>
                  <span>{next.year}</span>
                  <span className="dnext__go">VIEW PROJECT <i>→</i></span>
                </span>
              </button>
            </footer>
            </>}
          </div>
        </>
      )}
    </article>
  );
}
