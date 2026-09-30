import * as THREE from 'three';

// Soft, curling plumes rendered in the same world-space plane as the preview.
// The image itself stays undistorted: only the vapour and reveal boundary flow.
const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += noise(p) * a; p = r * p * 2.02 + 7.3; a *= 0.5; }
  return v;
}
`;
const VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function createPreviewMaterials() {
  const reveal = { value: 0 };
  const time = { value: 0 };
  const aspect = { value: 1.6 };
  const image = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uReveal: reveal, uTime: time, uAspect: aspect },
    vertexShader: VERTEX,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uReveal, uTime, uAspect;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec4 color = texture2D(uMap, vUv);
        // Once revealed, keep the cover sharp and skip all noise/blur work.
        if (uReveal < 0.999) {
          vec2 p = vUv * vec2(uAspect, 1.0);
          vec2 drift = p * 3.0 + vec2(uTime * 0.035, -uReveal * 1.5);
          vec2 flow = vec2(fbm(drift + 1.7), fbm(drift + 9.2)) - 0.5;
          float n = fbm(drift + flow * 1.65);
          float front = mix(-0.36, 1.46, smoothstep(0.06, 0.98, uReveal));
          float curl = sin(p.x * 5.0 + flow.y * 3.0 - uReveal * 4.0) * 0.075;
          float alpha = smoothstep(-0.23, 0.28, front - vUv.y + (n - 0.5) * 0.32 + curl);
          alpha *= smoothstep(0.06, 0.32, uReveal);
          float blur = pow(1.0 - uReveal, 2.0) * 0.004;
          vec2 offset = vec2(blur / uAspect, blur);
          color = color * 0.4
            + texture2D(uMap, clamp(vUv + vec2(offset.x, 0.0), 0.0, 1.0)) * 0.15
            + texture2D(uMap, clamp(vUv - vec2(offset.x, 0.0), 0.0, 1.0)) * 0.15
            + texture2D(uMap, clamp(vUv + vec2(0.0, offset.y), 0.0, 1.0)) * 0.15
            + texture2D(uMap, clamp(vUv - vec2(0.0, offset.y), 0.0, 1.0)) * 0.15;
          color.a *= alpha;
        }
        gl_FragColor = color;
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, toneMapped: false, fog: false,
  });
  const smoke = new THREE.ShaderMaterial({
    uniforms: { uReveal: reveal, uTime: time, uAspect: aspect },
    vertexShader: VERTEX,
    fragmentShader: `
      uniform float uReveal, uTime, uAspect;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * uAspect * 0.82, vUv.y);
        float age = uReveal;
        float lift = age * 1.15;
        // Advected, twice-warped noise breaks the plumes into fine folds instead of a fog band.
        vec2 q = vec2(p.x * 3.1, (p.y - lift) * 3.5);
        q.x += sin(p.y * 5.0 - age * 4.0) * 0.22 + uTime * 0.025;
        vec2 warp = vec2(fbm(q + 1.7), fbm(q + 8.3)) - 0.5;
        vec2 flow = q + warp * 1.8;
        float cloud = fbm(flow);
        float folds = fbm(flow * 2.1 + vec2(2.7, -age * 0.7));
        float density = 0.0;
        float silk = 0.0;
        for (int i = 0; i < 4; i++) {
          float seed = float(i);
          float phase = seed * 2.4;
          float height = p.y - 0.075;
          float tip = 0.15 + age * (1.06 + seed * 0.045);
          float plume = smoothstep(-0.01, 0.11, height)
            * (1.0 - smoothstep(tip - 0.22, tip + 0.08, p.y + warp.y * 0.13));
          // Each plume bends in opposite directions and expands as it rises.
          float center = (seed - 1.5) * 0.34;
          center += sin(height * 8.0 - age * 5.0 + phase) * (0.035 + height * 0.1);
          center += sin(height * 15.0 - age * 3.2 + phase) * height * 0.045;
          float spread = 0.085 + max(height, 0.0) * 0.12;
          float x = (p.x - center + warp.x * 0.14) / spread;
          float body = exp(-x * x * 1.35);
          float billow = smoothstep(0.22, 0.73, cloud + folds * 0.18);
          // Broken, feathered strands ride inside the wider vapour; never a solid outline.
          float ribbonX = (x + sin(height * 12.0 - age * 5.5 + phase) * 0.8) * 2.0;
          float ribbon = exp(-ribbonX * ribbonX);
          float strand = ribbon * smoothstep(0.34, 0.68, folds);
          density += body * billow * plume * 0.46;
          silk += strand * plume * 0.2;
        }
        float edge = smoothstep(0.0, 0.13, vUv.x) * (1.0 - smoothstep(0.87, 1.0, vUv.x));
        edge *= smoothstep(0.0, 0.075, vUv.y) * (1.0 - smoothstep(0.79, 1.0, vUv.y));
        float envelope = smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.38, 1.0, age));
        float alpha = (1.0 - exp(-(density + silk) * 1.8)) * edge * envelope * 0.68;
        vec3 color = mix(vec3(0.28, 0.34, 0.36), vec3(0.69, 0.76, 0.77), clamp(cloud * 0.8 + silk, 0.0, 1.0));
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, toneMapped: false, fog: false,
  });
  return { image, smoke, reveal, time, aspect };
}
