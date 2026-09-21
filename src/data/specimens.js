/**
 * DRY ICE SPECIMEN 01–04
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

const SHARD = [
  [13, 0],
  [28, 9],
  [19, 26],
  [5, 22],
  [0, 7],
];

// 작은 결정 6개가 모여 하나의 큰 덩어리를 이룬다. 멀리서는 하나, 가까이서는 여러 개.
function clusterPolys() {
  const spots = [
    [0, 24, 1.0],
    [22, 2, 0.92],
    [48, 13, 1.06],
    [17, 45, 0.88],
    [46, 48, 0.82],
    [70, 33, 0.76],
  ];
  return spots.map(([ox, oy, s]) =>
    SHARD.map(([x, y]) => [ox + x * s, oy + y * s])
  );
}

export const SPECIMENS = [
  {
    id: 'odit',
    no: '01',
    ko: 'ODIT',
    tag: 'CONNECTED',
    // 실제 이미지를 쓰는 동안은 사진의 외곽과 맞는 폴리곤을 쓴다.
    // (벡터만 쓰려면 image 를 지우고 아래 ODIT_VECTOR 로 되돌리면 된다)
    image: '/specimens/odit.png',
    // 원본 이미지에서 오브젝트가 차지하는 영역 (x, y, w, h — 0~1)
    imageRect: [0.109, 0.227, 0.785, 0.528],
    vb: [128, 86],
    polys: [
      [
        [14, 13], [78, 0], [108, 8], [128, 16], [125, 44],
        [96, 71], [60, 86], [25, 77], [0, 44], [2, 25],
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
    no: '02',
    ko: 'TCHAIKIM',
    tag: 'REFINED',
    vb: [58, 128],
    polys: [
      [
        [25, 0], [52, 17], [57, 69], [58, 99], [50, 119], [35, 128],
        [21, 125], [2, 108], [0, 83], [5, 47], [14, 14],
      ],
    ],
    origin: 'uniform',
    color: '#C0442F',
    role: 'UX/UI + FRONTEND',
    year: '2025',
    lead: '한복의 선을 글로벌 웹의 언어로 옮긴다.',
    residue: '실루엣 그대로, 밀도만 낮아진다',
  },
  {
    id: 'nuri',
    no: '03',
    ko: '문화누리카드',
    tag: 'COMPACT',
    vb: [60, 58],
    polys: [[[28, 0], [58, 16], [52, 38], [58, 50], [30, 57], [8, 44], [4, 20]]],
    origin: 'point',
    originPoint: [10, 48],
    color: '#2F7D62',
    role: 'UX/UI',
    year: '2025',
    lead: '꼭 필요한 사람에게, 가장 빠른 길로.',
    residue: '덩어리는 그대로, 시작점만 패인다',
  },
  {
    id: 'walga',
    no: '04',
    ko: '왈가왈봇',
    tag: 'CLUSTER',
    vb: [108, 80],
    polys: clusterPolys(),
    origin: 'cluster',
    color: '#B8823A',
    role: 'UX/UI + FRONTEND',
    year: '2026',
    lead: '모두가 한 마디씩 보태는 판정.',
    residue: '조각들이 살짝 벌어진 채 남는다',
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
  { id: 'odit', cx: 0.29, cy: 0.43, w: 0.265, z: 0.88 },
  { id: 'tchaikim', cx: 0.67, cy: 0.39, w: 0.081, z: 0.46 },
  { id: 'nuri', cx: 0.34, cy: 0.76, w: 0.092, z: 0.2 },
  { id: 'walga', cx: 0.78, cy: 0.70, w: 0.175, z: 0.66 },
];
