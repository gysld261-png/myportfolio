const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// 기준선은 전환 초반 화면 아래에서 출발해 ABOUT 전환 직전 화면 위를 완전히 통과한다.
export const sublimationFront = (progress) => smooth(0.04, 0.92, progress);

export const sublimationFrontOpacity = (progress) => (
  smooth(0.025, 0.07, progress) * (1 - smooth(0.92, 0.975, progress))
);

export const sublimationSmoke = (progress) => smooth(0.04, 0.97, progress);
