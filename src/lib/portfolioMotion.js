export const ENTRY = Object.freeze({ release:.85, impact:3.85, cover:6.05, clear:6.22, end:7.35 });
export const clamp01=v=>Math.max(0,Math.min(1,v));
export const smooth=(a,b,v)=>{const p=clamp01((v-a)/(b-a));return p*p*(3-2*p);};
export const mix=(a,b,p)=>a+(b-a)*p;

// The selected mesh never changes identity. Its position and the camera are
// sampled from one clock; entering a case never swaps to a second 3D scene.
export function entryAt(time,origin,floor,halfHeight){
  const t=Math.max(0,time),approach=smooth(0,1.15,t);
  const fall=smooth(ENTRY.release,ENTRY.impact,t);
  const contact=floor+halfHeight;
  const distance=Math.max(.1,origin.y-contact);
  const age=Math.max(0,t-ENTRY.impact);
  const sink=halfHeight*2+.25;
  // Give the water time to read: the camera settles before contact, and the
  // specimen slows into the surface before gradually submerging.
  const immersion=smooth(0,1.65,age);
  const follow=smooth(.70,3.05,t),dive=smooth(ENTRY.impact+.80,ENTRY.cover,t);
  return {
    x:mix(origin.x,0,approach),
    y:t<=ENTRY.impact?origin.y-distance*fall:contact-sink*immersion,
    z:mix(origin.z,2.6,approach),
    approach,fall,age,follow,dive,immersion,
    cameraY:mix(0,floor+4,follow)+mix(0,-2.95,dive),
    cameraZ:14-.6*approach-6.8*dive,
    targetY:mix(0,floor+.75,follow),
    mist:smooth(ENTRY.impact+.12,ENTRY.impact+.65,t)*(.12+.88*smooth(ENTRY.impact+.45,ENTRY.cover-.15,t)),
    blanket:smooth(ENTRY.cover-.60,ENTRY.cover,t),
    drift:smooth(ENTRY.clear,ENTRY.end,t),
    covered:t>=ENTRY.cover,
  };
}
