/**
 * 케이스 스터디 콘텐츠.
 *
 * 화면은 2열이다.
 *   stream — 왼쪽. 이미지와 그 근거가 번갈아 흐른다. 이 페이지의 본문.
 *   panel  — 오른쪽. 프로젝트 팩트. 스크롤하지 않고 고정된다.
 *
 * 표(kv)를 쓰지 않는다. 라벨 위 / 값 아래로 쌓는다.
 * 내용이 없는 블록은 넣지 않는다. 빈 섹션을 "작성 예정"으로 채우지 않는다.
 *
 * stream 블록 네 가지
 *   { type:'shot',  src, label, caption, flat? }   이미지 한 장. src 를 비우면 촬영 대기 슬롯.
 *   { type:'duo',   items:[{ src, label, caption }] }  나란히 두 장
 *   { type:'note',  label, title, body:[문단] }    이미지 없는 근거
 *   { type:'steps', label, title, items:[] }       순서 자체가 의미인 것
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
          '한복 브랜드 차이킴의 영문 웹사이트를 4인 팀으로 리디자인했습니다. ready-to-wear와 bespoke, 성격이 다른 두 서브 브랜드를 한 사이트 안에서 구분하면서도 같은 브랜드로 읽히게 만드는 것이 구조의 핵심이었습니다.',
          '제가 맡은 범위는 디자인 시스템과 개발 핸드오프입니다. 네 명이 각자 다르게 내리던 결정을 팀이 함께 쓰는 하나의 기준으로 묶고, 그 기준이 구현까지 새지 않고 도착하도록 만드는 일이었습니다.',
        ],
      },
      {
        label: 'SKILLS & DELIVERABLES',
        body:
          'FIGMA, DEV MODE ANNOTATION, DESIGN TOKENS, TYPE SCALE, IA, PERSONA, HANDOFF WORKFLOW, DESIGN LOG, NETLIFY',
      },
    ],
    visit: [{ label: 'VIEW REPO', href: 'https://github.com/gysld261-png/tchaikimm' }],
    stream: [
      {
        type: 'shot',
        src: '/cases/tchaikim-home.jpg',
        label: 'FINAL / HOME',
        caption:
          '첫 화면에서 두 서브 브랜드를 좌우로 나눴다. 각자의 톤은 유지하면서 같은 그리드 위에 올라간다.',
      },
      {
        type: 'note',
        label: 'STRUCTURE',
        title: '두 개의 브랜드, 하나의 사이트',
        body: [
          'Brand · Collection · Shop · Bespoke 네 갈래로 정보 구조를 잡았습니다. 구매까지 바로 이어지는 ready-to-wear와, 상담부터 시작하는 bespoke는 사용자가 밟는 단계 자체가 다릅니다.',
          '두 경로를 같은 메뉴에 섞지 않고 진입부터 갈라놓되, 브랜드를 설명하는 층은 공유하게 했습니다.',
        ],
      },
      {
        type: 'note',
        label: 'RESEARCH',
        title: '해외 고객 두 명을 기준으로 세웠다',
        body: [
          'Sophie Martin과 Clara Jensen, 두 페르소나를 정의하고 그 기준으로 정보 구조를 검증했습니다. 한복을 이미 아는 사람과 처음 보는 사람은 같은 메뉴를 다르게 읽습니다.',
        ],
      },
      {
        type: 'shot',
        src: '',
        flat: true,
        label: 'TYPE SYSTEM / v1',
        caption: 'Netlify에 배포한 타이포 토큰 페이지 — 팀이 항상 같은 기준을 보게 한 장치',
      },
      {
        type: 'note',
        label: 'TYPOGRAPHY',
        title: '두 버전을 만들고 v1을 팀 표준으로 채택했다',
        body: [
          'Trirong · Montserrat · Pretendard 조합으로 10개 토큰, 11단계 사이즈 스케일을 정의했습니다.',
          '결정을 Figma 안에만 두지 않고 토큰 페이지를 Netlify에 배포해, 팀 누구나 같은 주소에서 같은 기준을 확인할 수 있게 했습니다.',
        ],
      },
      {
        type: 'steps',
        label: 'HANDOFF',
        title: '결정이 구현까지 새지 않게',
        items: [
          'Figma Dev Mode의 annotation을 핸드오프의 기준 문서로 삼았습니다.',
          'annotation과 comment의 용도를 분리하는 운영 규칙을 만들어, 확정된 결정과 진행 중인 논의가 한자리에 섞이지 않게 했습니다.',
          'DL(Design Log) 번호 체계를 도입해 디자인 결정과 그 근거를 나중에도 되짚을 수 있게 남겼습니다.',
        ],
      },
      {
        type: 'duo',
        items: [
          { src: '', flat: true, label: 'DEV MODE', caption: 'annotation 기준 핸드오프 화면' },
          { src: '', flat: true, label: 'DESIGN LOG', caption: 'DL 번호로 추적되는 결정 기록' },
        ],
      },
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
        body: [
          '관심사를 시작점으로 인물·사건·장소를 연결하며 탐색하는 서비스입니다. 하나를 찾으러 들어왔다가 옆으로 새는 경험을 구조로 설계하고 있습니다.',
        ],
      },
    ],
    visit: [],
    stream: [
      {
        type: 'note',
        label: 'STATUS',
        title: '진행 중인 프로젝트입니다',
        body: ['설계와 구현을 함께 진행하고 있습니다. 완료되는 대로 과정을 정리해 올립니다.'],
      },
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
    visit: [],
    stream: [
      {
        type: 'note',
        label: 'STATUS',
        title: '정리 중입니다',
        body: ['화면과 근거를 정리해 곧 채웁니다.'],
      },
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
      {
        type: 'note',
        label: 'STATUS',
        title: '진행 중인 프로젝트입니다',
        body: ['IA와 주요 화면을 설계하는 단계입니다.'],
      },
    ],
  },
};

export const getCase = (id) => CASES[id] || null;
