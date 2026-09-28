/**
 * DRY ICE SPECIMEN 01–03
 *
 * 모든 오브젝트는 같은 Dry Ice Family 안에서 네 변수만 달라진다.
 *   Shape / Density / Fragment / Surface  (+ hover 시 Sublimation)
 *
 * origin 은 "승화가 어디서 시작하는가" 규칙이다.
 *   outer   바깥 가지 끝부터 → 중앙 Core 가 마지막까지 남는다
 *   uniform 윤곽선 전체에서 동시에 → 실루엣이 무너지지 않는다
 *   point   단 한 점에서 → 동심원으로 퍼진다
 *   cluster 여러 결정에서 각각 → 서로 다른 방향으로
 */

export const SPECIMENS = [
  {
    id: 'walga',
    no: '01',
    ko: '왈가왈봇',
    tag: 'CLUSTER',
    image: '/specimens/walga.png',
    /* HTML <img> 용 — 배경을 알파로 잘라낸 판본.
       캔버스는 원본에서 알파와 깊이 밴드를 직접 만들므로 image 를 그대로 쓴다. */
    imageCut: '/specimens/walga-cut.png',
    // 상단 우측의 먼지처럼 작은 일곱 번째 파편은 crop 밖으로 제외한다.
    imageRect: [0.08, 0.16, 0.84, 0.68],
    imageOpacity: 0.84,
    fieldDepth: 0.36,
    vb: [110, 78],
    polys: [
      [[3, 27], [8, 16], [20, 7], [35, 6], [47, 13], [52, 25], [49, 40], [40, 53], [25, 58], [11, 53], [4, 42]],
      [[59, 19], [69, 9], [84, 7], [99, 14], [107, 27], [108, 41], [101, 53], [89, 61], [72, 58], [61, 49], [56, 35]],
      [[41, 58], [48, 50], [59, 47], [70, 54], [73, 65], [68, 74], [55, 78], [44, 73], [38, 66]],
    ],
    origin: 'cluster',
    color: '#B8823A',
    role: 'UX/UI + FRONTEND',
    year: '2026',
    lead: '모두가 한 마디씩 보태는 판정.',
    residue: '조각들이 살짝 벌어진 채 남는다',
  },
  {
    id: 'odit',
    no: '02',
    ko: 'ODIT',
    tag: 'CONNECTED',
    image: '/specimens/odit.png',
    /* HTML <img> 용 — 배경을 알파로 잘라낸 판본.
       캔버스는 원본에서 알파와 깊이 밴드를 직접 만들므로 image 를 그대로 쓴다. */
    imageCut: '/specimens/odit-cut.png',
    imageRect: [0.07, 0.025, 0.87, 0.945],
    imageOpacity: 0.82,
    fieldDepth: 0.34,
    vb: [120, 64],
    polys: [
      [
        [5, 18], [12, 10], [25, 6], [41, 7], [52, 11], [60, 14],
        [69, 13], [80, 9], [95, 9], [109, 13], [116, 22], [118, 36],
        [112, 49], [101, 56], [87, 58], [73, 55], [63, 51], [55, 50],
        [46, 54], [34, 58], [21, 56], [10, 49], [3, 38], [2, 27],
      ],
    ],
    origin: 'outer',
    color: '#7C6CF0',
    role: 'UX/UI + FRONTEND',
    year: '2026',
    lead: '당신의 취향이 새로운 발견이 되는 곳.',
    residue: '중앙 Core 하나만 선명하게 남는다',
  },
  {
    id: 'tchaikim',
    no: '03',
    ko: 'TCHAIKIM',
    tag: 'REFINED',
    image: '/specimens/tchaikim.png',
    /* HTML <img> 용 — 배경을 알파로 잘라낸 판본.
       캔버스는 원본에서 알파와 깊이 밴드를 직접 만들므로 image 를 그대로 쓴다. */
    imageCut: '/specimens/tchaikim-cut.png',
    imageRect: [0.365, 0.01, 0.265, 0.98],
    imageOpacity: 0.86,
    fieldDepth: 0.52,
    vb: [80, 100],
    polys: [
      [
        [8, 30], [13, 17], [28, 7], [50, 3], [66, 12], [76, 28],
        [78, 47], [73, 62], [64, 72], [54, 78], [48, 90], [42, 99],
        [34, 95], [30, 82], [31, 69], [22, 61], [14, 50], [7, 41],
      ],
    ],
    origin: 'uniform',
    color: '#C0442F',
    role: 'UX/UI + FRONTEND',
    year: '2025',
    lead: '한복의 선을 글로벌 웹의 언어로 옮긴다.',
    residue: '실루엣 그대로, 밀도만 낮아진다',
  },
];

/** 이미지를 빼고 벡터로 되돌릴 때 쓰는 원래 ODIT 실루엣 */
export const ODIT_VECTOR = {
  vb: [128, 66],
  polys: [
    [
      [6, 0], [55, 17], [97, 10], [101, 25], [90, 33], [128, 51],
      [122, 66], [68, 56], [39, 61], [30, 45], [35, 36], [0, 24],
    ],
  ],
};

export const byId = (id) => SPECIMENS.find((s) => s.id === id);

/** MAIN 의 오브젝트 — 프로젝트가 아니라 효민 자신. 하나의 응집된 덩어리. */
export const HYOMIN = {
  id: 'hyomin',
  vb: [140, 112],
  polys: [
    [
      [42, 0], [88, 8], [119, 20], [140, 43], [121, 63],
      [136, 91], [98, 103], [63, 112], [22, 96], [28, 65],
      [0, 38], [19, 17],
    ],
  ],
  origin: 'outer',
};

/** FIELD 화면에서의 배치. 값은 캔버스 크기 대비 비율(0–1). */
export const FIELD_LAYOUT = [
  { id: 'odit', cx: 0.255, cy: 0.315, w: 0.22, z: 0.72, rx: -0.16, ry: 0.30, rz: -0.025 },
  { id: 'tchaikim', cx: 0.82, cy: 0.285, w: 0.07, z: 0.62, rx: -0.17, ry: -0.22, rz: 0.025 },
  { id: 'walga', cx: 0.655, cy: 0.64, w: 0.32, z: 0.82, rx: -0.16, ry: -0.28, rz: -0.018 },
];

