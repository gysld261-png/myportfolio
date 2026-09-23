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
      { label: 'VIEW SITE', href: '' },
      { label: 'DECK (PDF)', href: '' },   // public/ 에 넣고 '/tchaikim-deck.pdf'
      { label: 'GITHUB', href: 'https://github.com/gysld261-png/tchaikimm' },
    ],
    blocks: [
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
    year: '2026',
    categories: ['PM', 'UX/UI DESIGN', 'FRONTEND'],
    role: ['PM', 'IA', 'UI Design', 'Frontend'],
    info: 'AI 판정과 배심원 투표로 사건의 시비를 가리는 커뮤니티 서비스입니다. PM으로 정보 구조와 홈 화면 설계를 맡고, 화면까지 함께 만들고 있습니다.',
    concept: [],
    visit: [
      /* 사이트의 canonical 은 /home/ 이다. 온보딩부터 보여줄지 본 화면으로 바로 보낼지는 선택. */
      { label: 'VIEW SITE', href: 'https://walgawal-bot.vercel.app/onboarding' },
      /* 기획서 나오면 public/ 에 넣고 '/walga-deck.pdf' 로 채우면 그때 버튼이 나온다 */
      { label: 'DECK (PDF)', href: '' },
    ],
    blocks: [
      { type: 'full', src: '/cases/walga-screens.jpg', alt: '홈 — 오늘의 사건과 투표 결과 화면' },
      { type: 'full', src: '/cases/walga-demo.jpg', alt: '시연용 프로토타입 — 계정과 로그인 상태를 바꿔가며 온보딩부터 볼 수 있다' },
    ],
  },
};

export const getCase = (id) => CASES[id] || null;
