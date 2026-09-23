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
    year: '2025',
    categories: ['WEB DESIGN', 'DESIGN SYSTEM'],
    role: ['Design System', 'Handoff', 'Documentation'],
    info: '한복 브랜드 차이킴의 영문 웹사이트를 4인 팀으로 리디자인했습니다. 저는 디자인 시스템과 개발 핸드오프를 맡아, 타이포 토큰을 정의해 배포하고 Dev Mode annotation 기준의 핸드오프 워크플로와 DL 기록 체계를 만들었습니다.',
    concept: [
      '성격이 다른 두 서브 브랜드를 한 사이트 안에서 어떻게 가를지가 먼저였습니다. 화면을 그리기 전에 구조를 정하고, 그 구조를 팀이 매번 다시 협의하지 않도록 토큰으로 굳혔습니다.',
      '타이포 스케일을 11단계로 쪼갠 이유는 하나입니다. 그래야 고르는 일이 판단이 아니라 선택이 됩니다. 결정의 근거는 DL 번호로 남겨서, 구현 단계에서도 무엇을 왜 정했는지 되짚을 수 있게 했습니다.',
    ],
    visit: [
      { label: 'VIEW SITE', href: 'https://gysld261-png.github.io/tchaikimm/pages/main/index.html' },
      { label: 'DECK (PDF)', href: '' },   // public/ 에 넣고 '/tchaikim-deck.pdf'
      { label: 'GITHUB', href: 'https://github.com/gysld261-png/tchaikimm' },
    ],
    blocks: [
      /* 실제 사이트를 1440×900 으로 끝까지 스크롤한 녹화 (30초). PC 목업 화면 안에서 재생된다. */
      { type: 'device', video: '/cases/tchaikim-scroll.webm', poster: '/cases/tchaikim-scroll-poster.jpg', alt: '메인 페이지를 처음부터 끝까지 스크롤하는 화면' },
      { type: 'full', src: '/cases/tchaikim-home.jpg', alt: '홈 — 두 서브 브랜드를 좌우로 나눈 첫 화면' },
      { type: 'concept' },
      { type: 'duo', items: [
        { src: '', alt: '컬렉션 목록' },
        { src: '', alt: '컬렉션 상세' },
      ] },
      { type: 'full', src: '', alt: 'Netlify에 배포한 타이포 토큰 페이지' },
      { type: 'split', items: [
        { src: '', alt: '타이포 스케일 11단계' },
        { src: '', alt: 'Dev Mode annotation 기준 핸드오프' },
      ] },
      { type: 'trio', items: [
        { src: '', alt: '모바일 홈' },
        { src: '', alt: '모바일 컬렉션' },
        { src: '', alt: '모바일 상세' },
      ] },
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
    /* 케이스 스터디 보드 — Figma '왈가왈봇(개인)' 파일의 '목업' 페이지에서 내보낸다.
       사이트는 무채색 액자, 보드는 프로젝트 컬러. 보드를 고치면 같은 이름으로 다시 내보내 덮어쓰면 된다.
       2x(2880px)로 내보내 WebP 로 줄여 넣었다.
       TODO: 07 Closing 은 회고를 채운 뒤 추가한다 (지금은 자리 표시 박스가 남아 있어 뺐다). */
    blocks: [
      { type: 'full', src: '/cases/walga/boards/01-cover.webp', width: 2880, height: 1920, alt: '왈가왈BOT — 내 고민, AI와 배심원이 함께 판단해드려요' },
      { type: 'full', src: '/cases/walga/boards/02-problem.webp', width: 2880, height: 2240, alt: '문제 — 설문 33명 중 60.6%가 AI 판단을 정답처럼 받아들이기 어렵고, 45.5%가 AI와 사람의 판단 차이를 궁금해하며, 42.2%가 갈등 공개를 부담스러워했다' },
      { type: 'full', src: '/cases/walga/boards/03-principles.webp', width: 2880, height: 2360, alt: '설계 원칙 — 판단 근거 제공, 다양한 관점 비교, 참여 범위 선택, 결과까지의 연결 — 과 사용자 흐름' },
      { type: 'full', src: '/cases/walga/boards/04-plaza.webp', width: 2880, height: 2120, alt: '배심원 광장 — 명판관 랭킹, 카테고리 필터, 투표 중 배지' },
      { type: 'full', src: '/cases/walga/boards/05-submit.webp', width: 2880, height: 2640, alt: '사건 접수 — 작성, 요약 확인, AI 1심과 공개 범위, 접수 완료' },
      { type: 'full', src: '/cases/walga/boards/06-vote.webp', width: 2880, height: 2360, alt: '사건 상세와 투표 — AI 핵심요약, 네 가지 관점 투표, 1심과 2심 비교' },
    ],
  },
};

export const getCase = (id) => CASES[id] || null;
