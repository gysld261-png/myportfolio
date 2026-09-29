/**
 * 케이스 콘텐츠 — K95 골격.
 *
 * 이 페이지는 케이스 스터디 문서가 아니라 잘 만든 인덱스다.
 * 깊이는 배포 사이트와 기획서 PDF에 있고, 여기엔 그리로 가는 길만 둔다.
 *
 * 글이 나오는 자리는 딱 두 군데다.
 *   info    — 메타 구간 오른쪽 절반. 2~4문장. "이 프로젝트가 뭐였는가"
 *   concept — 이미지 리듬 중간. 2문단. "왜 그렇게 풀었는가"
 * 그 사이와 그 뒤는 전부 이미지다. 캡션은 하나도 안 붙인다.
 * 이미지가 스스로 설명하지 못하면 그 이미지를 안 쓰는 게 맞다.
 *
 * blocks — 이미지 리듬. 한 줄에 최대 셋.
 *   { type:'full',  src }                 한 장이 거터 끝까지
 *   { type:'duo',   items:[a, b] }        반반
 *   { type:'split', items:[a, b] }        1 : 2 비대칭
 *   { type:'trio',  items:[a, b, c] }     셋
 *   { type:'concept' }                    글이 들어갈 자리. 한 번만 쓴다.
 * src 를 비우면 자리만 잡는다. alt 는 화면에 안 나오고 스크린리더로만 간다.
 *
 * visit 는 href 가 빈 항목이 화면에 안 나온다. 주소 생기면 채우면 된다.
 */

export const CASES = {
  /* ─────────────────────────────────────────────────────────
     01 ODIT — 진행 중
     ───────────────────────────────────────────────────────── */
  odit: {
    year: '2026',
    categories: ['UX/UI DESIGN', 'FRONTEND'],
    role: ['UX Research', 'UI Design', 'Frontend'],
    info: '관심사를 시작점으로 인물·사건·장소를 연결하며 탐색하는 서비스입니다. 목록을 훑는 대신 하나의 관심에서 옆으로 걸어 들어가게 만드는 것이 목표였고, 설계와 구현을 함께 진행하고 있습니다.',
    concept: [],
    visit: [
      { label: 'VIEW SITE', href: '' },
      { label: 'GITHUB', href: '' },
    ],
    blocks: [
      { type: 'full', src: '', alt: '작업 중인 화면' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     02 TCHAIKIM
     ───────────────────────────────────────────────────────── */
  tchaikim: {
    layout: 'boards',
    hero: {
      src: '/cases/tchaikim/hero-mockup.webp',
      alt: '차이킴 Shop 원통 갤러리와 메인 화면을 담은 노트북 목업',
      width: 3840,
      height: 2400,
    },
    year: '2026',
    categories: ['UX/UI DESIGN', 'FRONTEND', 'DESIGN SYSTEM'],
    role: ['UI Design', 'Frontend', 'Design System'],
    info: '한복 브랜드 차이킴의 영문 웹사이트를 4인 팀으로 리디자인했습니다. 저는 Shop 페이지와 메인의 모티프·브랜드·컬렉션 섹션을 설계하고 구현했고, 타이포 토큰과 DL 기록 체계로 팀의 디자인 시스템과 핸드오프 기준을 만들었습니다.',
    teamSize: 4,
    ownership: [
      { label: 'DEVELOPMENT', level: 'LEAD', scope: 'Shop과 메인 핵심 섹션 구현' },
      { label: 'TEAM OPERATION', level: 'LEAD', scope: '개발 팀장으로 구현 기준과 진행 조율' },
      { label: 'UI DESIGN', level: 'CORE', scope: 'Shop·모티프·브랜드·컬렉션 설계' },
      { label: 'DESIGN SYSTEM', level: 'CORE', scope: '타이포 토큰·DL 기록·핸드오프 기준' },
      { label: 'UX', level: 'SUPPORT', scope: '설문 해석과 사용자 흐름 설계 지원' },
    ],
    concept: [],
    visit: [
      { label: 'VIEW SITE', href: 'https://gysld261-png.github.io/tchaikimm/pages/main/index.html' },
      { label: 'DECK (PDF)', href: '' },   // public/ 에 넣고 '/tchaikim-deck.pdf'
      { label: 'GITHUB', href: 'https://github.com/gysld261-png/tchaikimm' },
    ],
    /* 케이스 스터디 보드 — 배포 사이트를 1920px로 캡처해 목업과 주석을 얹은 롱이미지를 섹션별로 잘랐다.
       2x(2880px) WebP. 기존 스크롤 녹화(tchaikim-scroll.webm)와 tchaikim-home.jpg 는 다른 화면에서 쓰이니 남겨 둔다. */
    blocks: [
      { type: 'full', src: '/cases/tchaikim/boards/01-cover.webp', width: 2880, height: 1520, alt: '차이킴 — 낯선 한복을, 입어보고 싶은 옷으로' },
      { type: 'full', src: '/cases/tchaikim/boards/02-problem.webp', width: 2880, height: 2180, alt: '문제 — 설문 14명 중 두 브랜드 구조를 알아본 응답자 0%, 스크롤 CTA 미인식 43%, 구매 망설임 1위는 착용컷 부재' },
      { type: 'full', src: '/cases/tchaikim/boards/03-principles.webp', width: 2880, height: 1670, alt: '설계 원칙 — 착용컷 우선, 용어를 이야기로, 두 브랜드의 연결, 결정은 필요한 곳에서' },
      { type: 'full', src: '/cases/tchaikim/boards/04-flow.webp', width: 2880, height: 980, alt: '사용자 흐름 — Sarah Jenkins와 Mei Ling Lee, Shop에서 갈라지는 두 개의 길' },
      { type: 'full', src: '/cases/tchaikim/boards/05-shop-hero.webp', width: 2880, height: 1334, alt: 'Shop 히어로 — Three.js 원통 갤러리와 카테고리' },
      { type: 'full', src: '/cases/tchaikim/boards/06-garment-story.webp', width: 2880, height: 1474, alt: 'Garment Story — 원형 오빗으로 배자, 철릭, 거들, 사폭바지를 순환' },
      { type: 'full', src: '/cases/tchaikim/boards/07-product-card.webp', width: 2880, height: 2534, alt: '상품 카드 — 기본은 착용컷, 호버하면 원단 디테일' },
      { type: 'full', src: '/cases/tchaikim/boards/08-crosslink.webp', width: 2880, height: 1296, alt: '크로스링크 — Shop 배너에서 맞춤 브랜드로 가는 두 번째 출구' },
      { type: 'full', src: '/cases/tchaikim/boards/09-main-motif.webp', width: 2880, height: 2576, alt: '메인 모티프 — 철릭을 옷깃, 소매, 몸판, 치마로 나눠 읽기' },
      { type: 'full', src: '/cases/tchaikim/boards/10-main-brands.webp', width: 2880, height: 2578, alt: '메인 브랜드 — 카드 스택으로 두 브랜드를 번갈아 보여주기' },
      { type: 'full', src: '/cases/tchaikim/boards/11-main-collection.webp', width: 2880, height: 2530, alt: '메인 컬렉션 — 이미지 터널과 두 브랜드 컬렉션 링크' },
      { type: 'full', src: '/cases/tchaikim/boards/12-responsive.webp', width: 2880, height: 2242, alt: '반응형 — 모바일 모티프, 브랜드, 컬렉션 화면' },
      { type: 'full', src: '/cases/tchaikim/boards/13-overview.webp', width: 2880, height: 1802, alt: '전체 페이지 개요' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     03 문화누리카드
     ───────────────────────────────────────────────────────── */
  nuri: {
    year: '2025',
    categories: ['UX/UI DESIGN'],
    role: ['UX Research', 'IA', 'UI Design'],
    info: '꼭 필요한 사람에게 가장 빠른 길을 내주는 것이 목표였던 사용성 개선 프로젝트입니다. 쓰는 사람이 무엇을 못 찾고 있는지부터 확인하고, 거기서부터 정보 구조를 다시 짰습니다.',
    concept: [],
    visit: [
      { label: 'DECK (PDF)', href: '' },
    ],
    blocks: [
      { type: 'full', src: '', alt: '개선 화면' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     04 왈가왈봇
     ───────────────────────────────────────────────────────── */
  walga: {
    layout: 'boards',
    hero: {
      src: '/cases/walga/hero-mockup.png',
      alt: '왈가왈봇 앱의 투표 결과와 사건 접수 화면을 담은 휴대폰 목업',
      width: 5000,
      height: 3335,
      // Only frame the non-transparent area; preserve the original PNG and UI.
      viewBox: '1235 327 2601 2579',
    },
    year: '2026',
    categories: ['PM', 'UX/UI DESIGN', 'FRONTEND'],
    role: ['PM', 'IA', 'UI Design', 'Frontend'],
    info: '일상 갈등을 AI의 정리와 배심원의 여러 관점으로 풀어 보는 커뮤니티 웹앱입니다. PM으로 정보 구조를 잡고, 배심원 광장·사건 접수·사건 상세와 투표를 설계하고 구현했습니다.',
    concept: [],
    visit: [
      /* 사이트의 canonical 은 /home/ 이다. 온보딩부터 보여줄지 본 화면으로 바로 보낼지는 선택. */
      { label: 'VIEW SITE', href: 'https://walgawal-bot.vercel.app/onboarding' },
      /* 기획서 나오면 public/ 에 넣고 '/walga-deck.pdf' 로 채우면 그때 버튼이 나온다 */
      { label: 'DECK (PDF)', href: '' },
    ],
    cinematicHero: {
      src: '/cases/walga/boards/main.webp',
      width: 2560,
      height: 1440,
      alt: '왈가왈봇 프로젝트 메인 비주얼',
    },
    /* 케이스 스터디 보드 — Figma에서 2x PNG로 내보낸 16:9 슬라이드.
       보드를 고치면 같은 이름으로 다시 내보내 덮어쓰면 된다. */
    blocks: [
      { type: 'full', src: '/cases/walga/boards/01.webp', width: 3840, height: 2160, alt: '왈가왈BOT — 내 고민, AI와 배심원이 함께 판단해드려요. 역할 PM·IA·UI Design·Frontend, 팀 5명, 2026년 8월 26일부터 9월 18일까지 진행' },
      { type: 'full', src: '/cases/walga/boards/02.webp', width: 3840, height: 2160, alt: '문제 — 다른 판단이 궁금하지만 이유를 비교하기 어려웠다. 사용자 설문 결과와 핵심 인사이트' },
      { type: 'full', src: '/cases/walga/boards/03.webp', width: 3840, height: 2160, alt: '판단 근거 제공, 다양한 관점 비교, 참여 범위 선택이라는 세 가지 설계 원칙과 사용자 흐름' },
      { type: 'full', src: '/cases/walga/boards/04-2.webp', width: 3840, height: 2160, alt: '리서치에서 매일의 실행까지 흐름을 설계한 PM 역할과 14일간의 작업 과정' },
      { type: 'full', src: '/cases/walga/boards/05.webp', width: 3840, height: 2160, alt: '왈랑이와 왈가닥이 캐릭터 시스템과 투표 선택지, 판결 결과, 명판관 트로피 적용 사례' },
      { type: 'full', src: '/cases/walga/boards/06.webp', width: 3840, height: 2160, alt: '이달의 명판관 랭킹, 사건 정렬 필터와 투표 상태 배지를 갖춘 배심원 광장' },
      { type: 'full', src: '/cases/walga/boards/07-2.webp', width: 3840, height: 2160, alt: '사건 작성, 추가 질문, AI 요약, 공개 범위 선택과 접수 완료까지의 사건 접수 흐름' },
      { type: 'full', src: '/cases/walga/boards/08-2.webp', width: 3840, height: 2160, alt: '팀 피드백을 반영해 서술형 질문을 선택형으로 바꾸고 단계별 화면을 같은 템플릿으로 통일한 개선 과정' },
      { type: 'full', src: '/cases/walga/boards/09.webp', width: 3840, height: 2160, alt: 'AI 핵심 요약을 읽고 관점을 선택한 뒤 24시간 배심원 투표에 참여하는 사건 상세와 투표 흐름' },
      { type: 'full', src: '/cases/walga/boards/10.webp', width: 3840, height: 2160, alt: 'AI 1심과 배심원 2심의 판단 차이, 판단 근거와 선택지별 투표 분포를 보여주는 결과 화면' },
      { type: 'full', src: '/cases/walga/boards/11.webp', width: 3840, height: 2160, alt: '승패 중심의 초기 결과 화면을 서로 다른 판단 기준을 비교하는 사건 상세 화면으로 개선한 과정' },
      { type: 'full', src: '/cases/walga/boards/12.webp', width: 3840, height: 2160, alt: '프로젝트에서 배운 점과 어려웠던 점, 다음 프로젝트에서 검증하고 싶은 내용을 정리한 회고와 마무리' },
    ],
  },
};

export const getCase = (id) => CASES[id] || null;
