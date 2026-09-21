/**
 * 케이스 스터디 콘텐츠.
 *
 * 컴포넌트를 건드리지 않고 여기만 채우면 상세 페이지가 완성된다.
 * 섹션 순서는 고정이다 — Overview → Problem → Research → UX → UI → Development → Result
 *
 * 블록 타입
 *   { type: 'p',     text }                     문단
 *   { type: 'list',  items: [] }                불릿
 *   { type: 'steps', items: [] }                번호가 의미를 갖는 순서
 *   { type: 'kv',    rows: [[label, value]] }   표
 *   { type: 'quote', text, source }             인용 · 사용자 발언
 *   { type: 'figure', src, caption }            이미지 (src 없으면 자리만)
 *   { type: 'note',  text }                     보조 설명
 */

const TODO = (what) => ({ type: 'note', text: `작성 예정 — ${what}` });

export const CASES = {
  /* ─────────────────────────────────────────────────────────
     02 TCHAIKIM — 지금 작성 중
     ───────────────────────────────────────────────────────── */
  tchaikim: {
    headline: '4명이 각자 다르게 만들던 것을 하나의 시스템으로 묶다',
    summary:
      '한복 브랜드 차이킴의 글로벌 웹사이트를 4인 팀으로 리디자인했습니다. 저는 디자인 시스템과 개발 핸드오프를 맡아, 흩어진 결정들을 팀이 함께 쓸 수 있는 하나의 기준으로 정리했습니다.',
    meta: [
      ['역할', 'Design System · Handoff · Documentation'],
      ['팀 구성', '4인'],
      ['기간', '작성 예정'],
      ['산출물', '타이포 토큰 v1 · 핸드오프 워크플로 · Design Log'],
      ['리포지토리', 'gysld261-png/tchaikimm'],
    ],
    sections: {
      overview: [
        {
          type: 'p',
          text: '차이킴은 ready-to-wear와 bespoke 두 개의 서브 브랜드를 가진 한복 브랜드입니다. 해외 고객이 브랜드를 이해하고 주문까지 이어질 수 있는 영문 웹사이트를 목표로 했습니다.',
        },
        {
          type: 'kv',
          rows: [
            ['정보 구조', 'Brand · Collection · Shop · Bespoke'],
            ['타깃', '해외 거주 고객 — Sophie Martin, Clara Jensen 두 페르소나'],
            ['맡은 범위', '디자인 시스템 · 핸드오프 · 문서화 인프라'],
          ],
        },
      ],
      problem: [TODO('기존 사이트의 어떤 점이 안 됐는지, 그게 누구의 문제였는지')],
      research: [
        { type: 'p', text: '두 명의 페르소나를 세우고 그 기준으로 정보 구조를 검증했습니다.' },
        {
          type: 'kv',
          rows: [
            ['Sophie Martin', '작성 예정 — 어떤 사람이고 무엇이 필요했나'],
            ['Clara Jensen', '작성 예정'],
          ],
        },
        TODO('무엇을 조사했고 무엇을 발견했는지'),
      ],
      ux: [
        {
          type: 'p',
          text: '서로 다른 성격의 두 서브 브랜드를 한 사이트 안에서 구분하면서도 같은 브랜드로 읽히게 만드는 것이 구조 설계의 핵심이었습니다.',
        },
        TODO('IA 확정 과정과 플로우'),
      ],
      ui: [
        {
          type: 'p',
          text: '타이포그래피 시스템을 두 가지 버전으로 만들고, 팀 표준으로 v1을 채택했습니다.',
        },
        {
          type: 'kv',
          rows: [
            ['v1 (채택)', 'Trirong · Montserrat · Pretendard — 10 토큰 / 11 사이즈 단계'],
            ['채택 근거', '작성 예정'],
            ['배포', 'v1 토큰 페이지를 Netlify에 배포해 팀이 항상 같은 기준을 볼 수 있게 함'],
          ],
        },
        TODO('컬러 · 그리드 · 컴포넌트 결정 근거'),
      ],
      development: [
        {
          type: 'p',
          text: '디자인과 구현 사이에서 정보가 새는 지점을 줄이는 것이 제 역할이었습니다.',
        },
        {
          type: 'steps',
          items: [
            'Figma Dev Mode의 annotation을 기준으로 핸드오프 워크플로를 정의했습니다.',
            'annotation과 comment의 용도를 분리하는 운영 규칙을 만들어 결정과 논의가 섞이지 않게 했습니다.',
            'DL(Design Log) 번호 체계를 도입해 디자인 결정과 그 근거를 추적 가능하게 남겼습니다.',
          ],
        },
        TODO('도입 전에 무엇이 안 굴러갔는지, 도입 후 무엇이 달라졌는지'),
      ],
      result: [TODO('팀이 실제로 썼는지, 무엇이 줄거나 빨라졌는지, 무엇을 배웠는지')],
    },
  },

  /* ─────────────────────────────────────────────────────────
     01 ODIT — 진행 중
     ───────────────────────────────────────────────────────── */
  odit: {
    headline: '',
    summary: '관심사를 시작점으로 인물·사건·장소를 연결하며 탐색하는 서비스입니다.',
    meta: [
      ['역할', 'UX/UI + Frontend'],
      ['기간', '2026'],
      ['상태', '진행 중'],
    ],
    sections: {
      overview: [{ type: 'note', text: '프로젝트가 진행 중입니다. 완료 후 작성합니다.' }],
      problem: [], research: [], ux: [], ui: [], development: [], result: [],
    },
  },

  /* ─────────────────────────────────────────────────────────
     03 문화누리카드
     ───────────────────────────────────────────────────────── */
  nuri: {
    headline: '',
    summary: '특정 사용자의 명확한 사용성 문제를 해결한 프로젝트입니다.',
    meta: [['역할', 'UX/UI'], ['기간', '2025']],
    sections: {
      overview: [TODO('개요')], problem: [], research: [], ux: [], ui: [], development: [], result: [],
    },
  },

  /* ─────────────────────────────────────────────────────────
     04 왈가왈봇
     ───────────────────────────────────────────────────────── */
  walga: {
    headline: '',
    summary: 'AI 판정과 배심원 투표로 사건의 시비를 가리는 커뮤니티 서비스입니다.',
    meta: [['역할', 'PM · UX/UI + Frontend'], ['기간', '2026']],
    sections: {
      overview: [TODO('개요')], problem: [], research: [], ux: [], ui: [], development: [], result: [],
    },
  },
};

export const SECTION_ORDER = [
  { id: 'overview', label: 'OVERVIEW', ko: '개요' },
  { id: 'problem', label: 'PROBLEM', ko: '문제' },
  { id: 'research', label: 'RESEARCH', ko: '조사' },
  { id: 'ux', label: 'UX', ko: '구조' },
  { id: 'ui', label: 'UI', ko: '화면' },
  { id: 'development', label: 'DEVELOPMENT', ko: '구현' },
  { id: 'result', label: 'RESULT', ko: '결과' },
];

export const getCase = (id) => CASES[id] || null;
