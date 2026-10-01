/* View Transition을 지원하지 않을 때도 같은 짧은 상승·감속으로 진입한다. */
export const animateProjectArrival = (element) => element?.animate(
  [{ transform: 'translateY(64px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
  { duration: 800, easing: 'cubic-bezier(.22, 1, .36, 1)' },
);
