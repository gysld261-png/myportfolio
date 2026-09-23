/**
 * 케이스 스터디 콘텐츠 — 인덱스형.
 *
 * 이 사이트는 잘 만든 목록이지 케이스 스터디 문서가 아니다.
 * 깊이는 기획서 PDF와 배포 사이트에 있고, 여기엔 그리로 가는 길만 둔다.
 *
 *   stream — 왼쪽. 이미지만 쭉 흐른다. 글 블록도 캡션도 넣지 않는다.
 *   panel  — 오른쪽 고정. 제목 / ROLE / PROJECT(2~3문장) / SKILLS / VISIT.
 *
 * 한쪽은 이미지만, 다른 쪽은 글만. 섞지 않는 것이 이 레이아웃의 전부다.
 *
 * PROJECT 에는 "배포 사이트를 봐도 안 보이는 것"만 쓴다.
 * 완성 화면은 링크가 보여주므로, 여기엔 내가 맡은 범위를 적는다.
 *
 * stream 블록
 *   { type:'shot',  src, label, caption, flat? }       src 를 비우면 이미지 자리만 잡는다
 *   { type:'duo',   items:[{ src, label, caption }] }  나란히 두 장
 *   { type:'note',  label, title, body:[문단] }        꼭 필요할 때만
 *   { type:'steps', label, title, items:[] }
 *
 * visit 는 href 가 빈 항목은 화면에 나오지 않는다. 주소 생기면 채우면 된다.
 */

export const CASES = {
  /* ─────────────────────────────────────────────────────────
     02 TCHAIKIM
     ───────────────────────────────────────────────────────── */
  tchaikim: {
    kicker: '[2025] GLOBAL WEBSITE · 4-PERSON TEAM',
    panel: [
      {
        label: 'ROLE',
        body: 'DESIGN SYSTEM · HANDOFF · DOCUMENTATION',
      },
      {
        label: 'PROJECT',
        body: [
          '한복 브랜드 차이킴의 영문 웹사이트를 4인 팀으로 리디자인했습니다.',
          '저는 디자인 시스템과 개발 핸드오프를 맡았습니다. 타이포 토큰을 정의해 배포하고, Figma Dev Mode annotation 기준의 핸드오프 워크플로와 DL(Design Log) 기록 체계를 만들어 팀의 결정이 구현까지 흩어지지 않게 했습니다.',
        ],
      },
      {
        label: 'SKILLS & DELIVERABLES',
        body:
          'FIGMA, DEV MODE ANNOTATION, DESIGN TOKENS, TYPE SCALE, IA, PERSONA, HANDOFF WORKFLOW, DESIGN LOG, NETLIFY',
      },
    ],
    visit: [
      // 주소 채우면 자동으로 나온다
      { label: 'VIEW SITE', href: '' },
      { label: 'DECK (PDF)', href: '' },   // public/ 에 넣고 '/tchaikim-deck.pdf'
      { label: 'GITHUB', href: 'https://github.com/gysld261-png/tchaikimm' },
    ],
    // 왼쪽은 이미지만 흐른다. caption 은 화면에 안 나오고 alt 로만 쓰인다.
    stream: [
      { type: 'shot', src: '/cases/tchaikim-home.jpg', caption: '홈 — 두 서브 브랜드를 좌우로 나눈 첫 화면' },
      { type: 'shot', src: '', flat: true, caption: '컬렉션 화면' },
      { type: 'shot', src: '', flat: true, caption: 'Netlify에 배포한 타이포 토큰 페이지' },
      { type: 'shot', src: '', flat: true, caption: 'Figma Dev Mode annotation 기준 핸드오프' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     01 ODIT — 진행 중
     ───────────────────────────────────────────────────────── */
  odit: {
    kicker: '[2026] IN PROGRESS',
    panel: [
      { label: 'ROLE', body: 'UX/UI · FRONTEND' },
      {
        label: 'PROJECT',
        body: ['관심사를 시작점으로 인물·사건·장소를 연결하며 탐색하는 서비스입니다. 설계와 구현을 함께 진행하고 있습니다.'],
      },
    ],
    visit: [],
    stream: [
      { type: 'shot', src: '', flat: true, caption: '작업 중인 화면' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     03 문화누리카드
     ───────────────────────────────────────────────────────── */
  nuri: {
    kicker: '[2025] USABILITY REDESIGN',
    panel: [
      { label: 'ROLE', body: 'UX/UI' },
      {
        label: 'PROJECT',
        body: ['꼭 필요한 사람에게 가장 빠른 길을 내주는 것이 목표였던 사용성 개선 프로젝트입니다.'],
      },
    ],
    visit: [
      { label: 'DECK (PDF)', href: '' },
    ],
    stream: [
      { type: 'shot', src: '', flat: true, caption: '개선 화면' },
    ],
  },

  /* ─────────────────────────────────────────────────────────
     04 왈가왈봇
     ───────────────────────────────────────────────────────── */
  walga: {
    kicker: '[2026] TEAM PROJECT · PM',
    panel: [
      { label: 'ROLE', body: 'PM · UX/UI · FRONTEND' },
      {
        label: 'PROJECT',
        body: ['AI 판정과 배심원 투표로 사건의 시비를 가리는 커뮤니티 서비스입니다. PM으로 IA와 홈 화면 설계를 맡고 있습니다.'],
      },
    ],
    visit: [],
    stream: [
      { type: 'shot', src: '/cases/walga-screens.jpg', caption: '홈 — 오늘의 사건과 투표 결과 화면' },
      { type: 'shot', src: '/cases/walga-demo.jpg', caption: '시연용 프로토타입 — 계정과 로그인 상태를 바꿔가며 온보딩부터 볼 수 있다' },
    ],
  },
};

export const getCase = (id) => CASES[id] || null;
