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
     01 ODIT — 프로토타입
     ───────────────────────────────────────────────────────── */
  odit: {
    cinematicHero: {
      src: '/cases/odit/main-v1.webp',
      width: 3840,
      height: 2160,
      background: '#fff0c4',
      alt: '오딧 — 외우는 역사에서 발견하는 재미가 있는 역사로. 홈 화면과 오딧맵을 담은 휴대폰 목업과 탐험 캐릭터',
    },
    year: '2026',
    categories: ['UX/UI DESIGN', 'PROTOTYPE'],
    role: ['UX Research', 'UI Design', 'Prototype'],
    info: '관심사를 시작점으로 인물·사건·장소를 연결하며 탐색하는 서비스입니다. 목록을 훑는 대신 하나의 관심에서 옆으로 걸어 들어가게 만드는 것이 목표였고, 리서치부터 Figma 프로토타입까지 설계했습니다.',
    concept: [],
    visit: [
      { label: 'VIEW PROTOTYPE', href: 'https://www.figma.com/proto/hEKHltlCyGEM6LywJ60Ylw/ODIT?page-id=2024%3A572&node-id=2046-2610&starting-point-node-id=2046%3A2610&scaling=scale-down&content-scaling=fixed' },
      { label: 'GITHUB', href: '' },
    ],
    /* 목업 원본: https://www.figma.com/design/hEKHltlCyGEM6LywJ60Ylw?node-id=2125-1210
       사용자가 지정한 홈(2024:573) · 오딧맵(2024:878) · 배지(2024:849) 화면을 그대로 사용했다. */
    blocks: [
      { type: 'full', src: '/cases/odit/mockups/detail-mockup.webp', alt: '오딧 홈·오딧맵·배지 원본 화면을 담은 휴대폰 목업 3개' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     02 TCHAIKIM
     ───────────────────────────────────────────────────────── */
  tchaikim: {
    hero: {
      src: '/cases/tchaikim/hero-editorial.webp',
      alt: '차이킴 Shop 원통 갤러리와 모바일 메인 화면을 담은 브라우저·휴대폰 목업',
      width: 3840,
      height: 2400,
    },
    year: '2026',
    categories: ['UX/UI DESIGN', 'FRONTEND', 'DESIGN SYSTEM'],
    role: ['UI Design', 'Frontend', 'Design System'],
    info: '한복 브랜드 차이킴의 영문 웹사이트를 4인 팀으로 리디자인했습니다. 저는 Shop 페이지와 메인의 모티프·브랜드·컬렉션 섹션을 설계하고 구현했고, 타이포 토큰과 DL 기록 체계로 팀의 디자인 시스템과 핸드오프 기준을 만들었습니다.',
    teamSize: 4,
    concept: [
      '설문에 응한 14명 가운데 기성복 차이킴과 맞춤 브랜드 차이킴영진의 구조를 알아본 사람은 한 명도 없었고, 구매를 망설인 이유 1위는 입은 모습을 볼 수 없다는 것이었습니다. 해외 사용자에게 한복은 낯선 옷이고, 배자·철릭·거들 같은 이름은 더 낯섭니다.',
      '그래서 설명보다 착용컷을 먼저 보여 주고, 낯선 이름은 옷이 생겨난 이야기로 풀었습니다. Shop은 룩북을 넘기듯 원통 갤러리로 시작해 Garment Story에서 한 벌씩 읽히게 했고, 메인에서는 철릭 한 벌을 옷깃·소매·몸판·치마로 나눠 보여 준 뒤 두 브랜드를 같은 자리에서 번갈아 보여 주었습니다.',
    ],
    visit: [
      { label: 'VIEW SITE', href: 'https://gysld261-png.github.io/tchaikimm/pages/main/index.html' },
      { label: 'DECK', href: 'https://www.figma.com/deck/sBlaHSzLRzdYwAZtKSjnqd' },   // Figma 슬라이드 프레젠테이션 링크(누구나 · 보기)
      { label: 'GITHUB', href: 'https://github.com/gysld261-png/tchaikimm' },
    ],
    /* 이미지 리듬 — 원본은 Figma 'TCHAIKIM 포트폴리오 상세 목업'의 '추천 구성 (2x)' 페이지
       (https://www.figma.com/design/S673Ys4HtDt3j8YQgUTOWw). 프레임 이름이 곧 파일 이름이고 프레임이 이미 2x 라
       Figma 에서 고친 뒤 1x 로 내보내면 그대로 2880px 이다 → WebP 로 바꿔 같은 이름으로 덮어쓴다.
       기기 목업만 이어지면 지루해서 종류를 섞는다: 목업(c) · 설계 도해(d) · 영상(v) · 에디토리얼(e) · UI 크롭(k) · 디자인 시스템(s).
       영상은 로컬 저장소를 헤드리스 Chrome 으로 녹화한 WebM 과 사용자 녹화 편집본 MP4 를 사용한다(motion/).
       split 은 왼쪽 4:5 + 오른쪽 16:10(1fr:2fr 에서 높이가 맞는다), duo 는 두 장 비율이 같다.
       이전 케이스 스터디 보드(boards/)는 쓰지 않지만 파일은 남겨 둔다. */
    blocks: [
      { type: 'full', src: '/cases/tchaikim/mockups/c01-shop-hero.webp', alt: 'Shop 히어로 — Three.js 원통 갤러리를 담은 노트북과 모바일 화면' },
      {
        type: 'split',
        items: [
          { src: '/cases/tchaikim/mockups/d01-cylinder-structure.webp', alt: '원통 갤러리 구조 — 반지름 900, 곡면 카드 8장, 한 바퀴 40초, 호버 1.12배' },
          { video: '/cases/tchaikim/motion/v01-cylinder.webm', poster: '/cases/tchaikim/motion/v01-cylinder-poster.jpg', alt: '원통 갤러리가 돌고 가운데 카드에 커서가 닿으면 커지는 화면 녹화' },
        ],
      },
      { type: 'concept' },
      {
        type: 'full',
        src: '/cases/tchaikim/mockups/e01-editorial-bg.webp',
        alt: '착용컷 에디토리얼',
        // Figma VIDEO SLOT 자리: x 260 · y 440 · w 780 (프레임 2880 × 1760)
        overlay: { video: '/cases/tchaikim/motion/v03-card-hover.webm', poster: '/cases/tchaikim/motion/v03-card-hover-poster.jpg', x: 9.028, y: 25, w: 27.083, alt: '상품 카드에 커서를 올리면 착용컷이 원단 디테일로 바뀌는 화면 녹화' },
      },
      { type: 'full', video: '/cases/tchaikim/motion/v02-orbit-slow-intro-1p5s.mp4', poster: '/cases/tchaikim/motion/v02-orbit-slow-intro-1p5s-poster.jpg', alt: 'Garment Story — 스크롤하면 원형 궤도를 따라 배자·철릭·거들로 넘어가는 화면 녹화' },
      { type: 'full', src: '/cases/tchaikim/mockups/d02-cheollik-anatomy.webp', alt: '메인 모티프 — 철릭을 옷깃, 소매, 몸판, 치마로 나눠 읽기' },
      { type: 'full', src: '/cases/tchaikim/mockups/c08-brands.webp', alt: '메인 브랜드 — 두 브랜드를 번갈아 보여 주는 카드 스택' },
      { type: 'full', src: '/cases/tchaikim/mockups/s01-design-system.webp', alt: '디자인 토큰 — 타이포 스케일, 색과 대비, 버튼과 태그' },
      { type: 'full', src: '/cases/tchaikim/mockups/c11-main-phones.webp', alt: '모바일 메인 — 히어로, 모티프, 브랜드' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     03 문화누리카드
     ───────────────────────────────────────────────────────── */
  nuri: {
    year: '2026',
    categories: ['UX/UI DESIGN'],
    role: ['UX Research', 'IA', 'UI Design'],
    info: '꼭 필요한 사람에게 가장 빠른 길을 내주는 것이 목표였던 사용성 개선 프로젝트입니다. 쓰는 사람이 무엇을 못 찾고 있는지부터 확인하고, 거기서부터 정보 구조를 다시 짰습니다.',
    concept: [],
    visit: [
      { label: 'DECK', href: '' },   // Figma 슬라이드 링크를 채우면 버튼이 나온다
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
      /* 기획서 — Figma 슬라이드 프레젠테이션 링크(누구나 · 보기)를 채우면 그때 버튼이 나온다 */
      { label: 'DECK', href: '' },
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
