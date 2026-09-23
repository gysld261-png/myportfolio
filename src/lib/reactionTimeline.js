// All positions are world-space metres in the same upright scene.
export const CHAMBER = Object.freeze({ rim: 2.56, water: 1.78, floor: .23, iceHalfHeight: .494015, idleY: 3.3, restY: .73 });
export const REACTION_IMPACT = .78;
export const REACTION_COVER = 4.05;
export const REACTION_END = 4.65;
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const p = clamp((v-a)/(b-a)); return p*p*(3-2*p); };

export function reactionAt(time) {
  const t = Math.max(0, time ?? 0);
  const contactY = CHAMBER.water + CHAMBER.iceHalfHeight;
  const fallDistance = CHAMBER.idleY-contactY;
  const fallDuration = REACTION_IMPACT-.15;
  const fall = clamp((t-.15)/fallDuration);
  const age = Math.max(0, t-REACTION_IMPACT);
  const entrySpeed = 2*fallDistance/fallDuration;
  const sinkDistance = contactY-CHAMBER.restY;
  return {
    y: t <= REACTION_IMPACT ? CHAMBER.idleY-fallDistance*fall*fall
      : contactY-sinkDistance*(1-Math.exp(-entrySpeed*age/sinkDistance)),
    fall, age,
    ripple: age > 0 ? Math.exp(-age*2.2) : 0,
    fog: smooth(REACTION_IMPACT+.12, 3.5, t),
    dive: smooth(2.65, REACTION_COVER, t),
    cover: smooth(3.35, REACTION_COVER, t),
    clear: smooth(REACTION_COVER+.04, REACTION_END, t),
  };
}
