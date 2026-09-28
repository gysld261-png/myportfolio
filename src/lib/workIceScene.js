import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createIceShard, icePhysical, loadLogo } from './iceBlockScene';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const damp = (from, to, speed, dt) => THREE.MathUtils.damp(from, to, speed, dt);

const PROJECTS = {
  odit: {
    seed: 7,
    shape: [1.36, 1.9, 1.12],
    rotation: [0.1, -0.28, -0.08],
    logo: '/cases/odit-logo.svg',
    fallback: 'ODIT',
    rollAxis: [0.76, 0.2, 0.62],
  },
  tchaikim: {
    seed: 19,
    shape: [1.22, 1.96, 1.06],
    rotation: [0.06, -0.2, 0.06],
    logo: '/cases/tchaikim-logo.svg',
    fallback: 'TCHAIKIM',
    // 가는 세리프체라 굴절에 더 잘 묻혀 선명도 보정을 조금 더 준다.
    overlay: 0.75,
    rollAxis: [0.68, -0.24, 0.72],
  },
  walga: {
    seed: 61,
    shape: [1.42, 1.86, 1.16],
    rotation: [0.08, -0.22, -0.06],
    logo: '/cases/walga-logo.svg',
    fallback: 'WALGA',
    // 비스듬한 벽개면을 지나며 굴절이 커져서 선명도 보정을 차이킴 다음으로 준다.
    overlay: 0.65,
    rollAxis: [0.8, 0.3, 0.5],
  },
};

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const PIXEL_FONT = {
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  G: ['01111','10000','10000','10111','10001','10001','01111'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','11001','10101','10011','10011','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  W: ['10001','10001','10001','10101','10101','11011','10001'],
};

function createTextLogo(text, targetWidth) {
  const cell = 0.13;
  const advance = cell * 6;
  const glyphs = [];
  [...text].forEach((char, charIndex) => {
    const rows = PIXEL_FONT[char] || PIXEL_FONT.O;
    rows.forEach((row, y) => {
      [...row].forEach((filled, x) => {
        if (filled !== '1') return;
        const pixel = new THREE.BoxGeometry(cell * 0.84, cell * 0.84, 0.14);
        pixel.translate(charIndex * advance + x * cell, (6 - y) * cell, 0);
        glyphs.push(pixel);
      });
    });
  });
  const geometry = mergeGeometries(glyphs, false);
  glyphs.forEach((geometryPart) => geometryPart.dispose());
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const width = Math.max(0.001, box.max.x - box.min.x);
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -0.07);
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9e5e9,
    roughness: 0.34,
    metalness: 0.04,
    emissive: 0x8fa8b0,
    emissiveIntensity: 0.2,
  });
  const object = new THREE.Mesh(geometry, material);
  object.scale.setScalar(targetWidth / width);
  return {
    object,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function createSparkles(seed) {
  const count = 18;
  const rand = seeded(seed + 91);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions.set([(rand() - 0.5) * 1.45, (rand() - 0.5) * 1.45, 0.58 + rand() * 0.1], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 4.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return { object: new THREE.Points(geometry, material), geometry, material };
}

/* 레퍼런스의 호버 스캔 — 마우스가 닿은 자리 주변에만 얼음 표면을 덮은 가는 삼각망이
   옅게 드러나고, 몇몇 꼭짓점에서만 작은 십자 반짝임이 깜빡인다.
   망은 얼음과 같은 씨앗·같은 변형으로 만든 성긴 격자라 실제 표면의 굴곡을 그대로 따라간다. */
const SCAN_LINE_VERTEX = `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SCAN_LINE_FRAGMENT = `
  varying vec3 vPos;
  uniform vec3 uHit;
  uniform float uStrength;
  uniform float uRadius;
  uniform float uOpacity;
  void main() {
    float f = 1.0 - smoothstep(0.0, uRadius, distance(vPos, uHit));
    float a = f * f * uStrength * uOpacity * 0.42;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(0.94, 0.97, 1.0), a);
  }
`;
const SCAN_GLINT_VERTEX = `
  attribute float aSeed;
  varying vec3 vPos;
  varying float vSeed;
  uniform float uSize;
  void main() {
    vPos = position;
    vSeed = aSeed;
    gl_PointSize = uSize * (0.7 + aSeed * 0.6);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SCAN_GLINT_FRAGMENT = `
  varying vec3 vPos;
  varying float vSeed;
  uniform vec3 uHit;
  uniform float uStrength;
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uTime;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float core = exp(-dot(c, c) * 220.0);
    float star = exp(-abs(c.x) * 70.0) * exp(-abs(c.y) * 8.0) + exp(-abs(c.y) * 70.0) * exp(-abs(c.x) * 8.0);
    float twinkle = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (1.6 + vSeed * 2.0) + vSeed * 40.0), 3.0);
    float f = 1.0 - smoothstep(0.0, uRadius * 0.85, distance(vPos, uHit));
    float a = (core + star * 0.8) * f * uStrength * uOpacity * twinkle;
    if (a < 0.004) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, min(1.0, a));
  }
`;

function createScanMesh(shape, seed) {
  const [w, h, d] = shape;
  // 화면에서 삼각형 한 변이 20~30px 정도가 되도록 얼음 크기의 1/16 격자를 쓴다.
  const cell = Math.max(w, h) / 16;
  const surface = createIceShard({
    width: w,
    height: h,
    depth: d,
    seed,
    segments: [Math.round(w / cell), Math.round(h / cell), Math.round(d / cell)],
    jitter: cell * 0.7,
    flat: false,
  });
  // 굴절면에 묻히지 않도록 표면 바로 바깥에 띄운다.
  surface.scale(1.006, 1.006, 1.006);

  const uniforms = {
    uHit: { value: new THREE.Vector3(0, 0, 999) },
    uStrength: { value: 0 },
    uRadius: { value: Math.max(w, h) * 0.4 },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uSize: { value: 11 * Math.min(window.devicePixelRatio || 1, 1.45) },
  };
  const common = {
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  };
  const lineGeometry = new THREE.WireframeGeometry(surface);
  const lineMaterial = new THREE.ShaderMaterial({ ...common, vertexShader: SCAN_LINE_VERTEX, fragmentShader: SCAN_LINE_FRAGMENT });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);

  // 모든 꼭짓점에 점을 찍으면 징그러워 보여서, 16개 중 하나꼴로만 반짝이게 한다.
  const rand = seeded(seed + 311);
  const source = surface.attributes.position;
  const picked = [];
  const seeds = [];
  for (let i = 0; i < source.count; i += 1) {
    if (rand() > 0.06) continue;
    picked.push(source.getX(i), source.getY(i), source.getZ(i));
    seeds.push(rand());
  }
  const glintGeometry = new THREE.BufferGeometry();
  glintGeometry.setAttribute('position', new THREE.Float32BufferAttribute(picked, 3));
  glintGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  const glintMaterial = new THREE.ShaderMaterial({ ...common, vertexShader: SCAN_GLINT_VERTEX, fragmentShader: SCAN_GLINT_FRAGMENT });
  const glints = new THREE.Points(glintGeometry, glintMaterial);

  lines.renderOrder = 6;
  glints.renderOrder = 7;
  const object = new THREE.Group();
  object.add(lines, glints);
  return {
    object,
    uniforms,
    dispose() {
      surface.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      glintGeometry.dispose();
      glintMaterial.dispose();
    },
  };
}

/* ── 클릭 전환: Igloo 실측(0.04배속 캡처) ──
   카메라가 얼음 속(이야기 속)으로 천천히 들어가는 흐름이다. 전체 2.6초.
   0.00~0.35  클릭하자마자 얼음이 가운데로 오며 아주 천천히 다가온다. 라벨은 RGB 로 깨지며 날아간다(DOM 쪽).
              얼음 둘레에서 드라이아이스 김이 피어오르기 시작한다.
   0.35~0.85  다가오는 속도가 점점 빨라져 얼음이 화면을 가득 채운다. 김도 함께 부풀어 얼음을 감싼다.
              마지막 구간에만 짧은 줌 번짐과 옅은 색수차로 속도감을 준다(광선처럼 뻗지 않게).
   0.70~0.97  얼음 속으로 들어가듯 껍질이 걷히고, 화면이 어두운 연기로 덮인다.
   1.00       어두운 상세 화면으로 넘어간다. */
export const LAUNCH_DURATION = 2600;

// 얼음 두께 대비 빛이 흐려지는 거리(표본 단위). 작을수록 속이 짙은 청회색, 클수록 맑다.
const ICE_ATTENUATION = 1.15;

const ExplodeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLaunch: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0 },
    uInk: { value: 1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uLaunch;
    uniform vec2 uResolution;
    uniform vec2 uCenter;
    uniform float uTime;
    uniform float uInk;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
      return v;
    }
    void main() {
      float p = uLaunch;
      float explode = smoothstep(0.45, 0.88, p);
      float ink = smoothstep(0.7, 0.97, p) * uInk;
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      vec2 d = vUv - uCenter;

      // ── 다가가는 속도감: 가운데로 모이는 짧은 줌 번짐. 각도마다 길이를 아주 조금만 달리해 기계적인 줌이 되지 않게 한다.
      float ang = atan(d.y, d.x * aspect.x);
      float fray = noise(vec2(ang * 24.0, uTime * 0.5));
      float spread = explode * (0.045 + 0.03 * fray);
      vec3 rgb = vec3(0.0);
      float alpha = 0.0;
      float wsum = 0.0;
      for (int i = 0; i < 20; i++) {
        float t = float(i) / 19.0;
        float w = 1.0 - t * 0.55;
        float s = spread * t;
        // 채널마다 끌어내는 길이가 달라 가장자리가 빨강·파랑으로 갈라진다.
        vec4 r = texture2D(tDiffuse, uCenter + d * (1.0 - s * 1.14));
        vec4 g = texture2D(tDiffuse, uCenter + d * (1.0 - s));
        vec4 b = texture2D(tDiffuse, uCenter + d * (1.0 - s * 0.86));
        rgb += vec3(r.r, g.g, b.b) * w;
        alpha += max(max(r.a, g.a), b.a) * w;
        wsum += w;
      }
      vec4 smear = vec4(rgb / wsum, alpha / wsum);
      smear.rgb *= 1.0 + explode * 0.3;
      // 속의 로고처럼 아직 남아 있는 부분은 덜 번지게 원래 화면을 섞는다.
      vec4 original = texture2D(tDiffuse, vUv);
      vec4 color = mix(smear, original, original.a * 0.55 * (1.0 - explode * 0.5));
      color *= 1.0 - smoothstep(0.86, 1.0, p);

      // ── 먹물: 얼음 자리에서 번져 나가며 화면을 덮는 어두운 유체. 경계는 연기처럼 얼룩진다.
      vec2 q = (vUv - 0.5) * aspect * 2.2;
      vec2 warp = vec2(fbm(q * 1.4 + uTime * 0.12), fbm(q * 1.4 + 5.2 - uTime * 0.1));
      float smoke = fbm(q * 2.0 + warp * 2.4 + uTime * 0.05);
      float reach = length(d * aspect);
      float front = ink * 1.9 - reach + (smoke - 0.5) * 0.7;
      float cover = smoothstep(0.0, 0.28, front);
      vec3 inkColor = mix(vec3(0.03, 0.036, 0.043), vec3(0.12, 0.14, 0.16), smoothstep(0.35, 0.85, smoke));
      // 기름막 무지개 — 얼룩 경계 몇 군데에만 얇게
      float filmNoise = fbm(q * 3.0 + warp * 3.0 + 9.0);
      // 연기가 밝은 곳 가장자리에만 가늘게, 채도를 낮춰 기름막처럼 은은하게
      float film = smoothstep(0.63, 0.66, filmNoise) * (1.0 - smoothstep(0.66, 0.71, filmNoise)) * smoothstep(0.5, 0.78, smoke);
      vec3 rainbow = mix(vec3(0.5), 0.5 + 0.5 * cos(6.2831 * (smoke * 2.0 + vec3(0.0, 0.33, 0.67))), 0.65);
      inkColor += rainbow * film * 0.09;

      // 미리 곱한 알파로 먹물을 위에 덮는다.
      gl_FragColor = vec4(inkColor * cover + color.rgb * (1.0 - cover), cover + color.a * (1.0 - cover));
    }
  `,
};

/* ── 연기: 드라이아이스처럼 얼음 밑동에서 옅은 김이 흘러내리며 퍼진다 ── */
function createSmokeTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  // 둥근 빛 덩어리가 아니라 결이 있는 김이 되도록, 가로로 늘인 노이즈에서 짙은 줄기만 남긴다.
  const rand = seeded(424242);
  const grid = 64;
  const lattice = Float32Array.from({ length: grid * grid }, () => rand());
  const at = (x, y) => lattice[((y % grid) + grid) % grid * grid + ((x % grid) + grid) % grid];
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * xf;
    const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * xf;
    return top + (bottom - top) * yf;
  };
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size - 0.5;
      const v = y / size - 0.5;
      const falloff = Math.max(0, 1 - Math.hypot(u * 1.1, v * 1.5) * 2) ** 1.8;
      const n = noise(x / 40, y / 22) * 0.62 + noise(x / 18, y / 10 + 11) * 0.28 + noise(x / 8, y / 5 + 23) * 0.1;
      const wisp = Math.min(1, Math.max(0, (n - 0.36) / 0.44)) ** 1.3;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(wisp * falloff * 255);
    }
  }
  context.putImageData(image, 0, 0);
  // 한 번 흐리게 번지게 해서 머리카락 같은 결 대신 부드러운 김이 되게 한다.
  const soft = document.createElement('canvas');
  soft.width = soft.height = size;
  const softContext = soft.getContext('2d');
  softContext.filter = 'blur(4px)';
  softContext.drawImage(canvas, 0, 0);
  const texture = new THREE.CanvasTexture(soft);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSmoke(shape, seed, texture) {
  const [w, h] = shape;
  const rand = seeded(seed + 55);
  const group = new THREE.Group();
  const makeSprite = () => {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xdfe9ee,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    group.add(sprite);
    return { sprite, material };
  };

  // 평소: 밑동에서 흘러내리는 김
  const puffs = [];
  for (let i = 0; i < 16; i += 1) {
    const { sprite, material } = makeSprite();
    sprite.renderOrder = 1;
    puffs.push({
      sprite,
      material,
      life: 5 + rand() * 3.5,
      age: rand() * 8,
      seed: rand(),
      // 밑동 가장자리에서 출발
      x0: (rand() - 0.5) * w * 0.75,
      y0: -h * (0.28 + rand() * 0.14),
      vx: (rand() - 0.5) * 0.09,
      vy: -(0.05 + rand() * 0.07),
      spin: (rand() - 0.5) * 0.25,
      size0: 0.35 + rand() * 0.3,
      size1: 1.1 + rand() * 0.8,
    });
  }

  // 클릭하면: 얼음 둘레 전체에서 김이 피어올라 감싼다. 일부는 얼음 앞에 떠서 김 속으로 들어가는 느낌을 준다.
  const wraps = [];
  for (let i = 0; i < 22; i += 1) {
    const { sprite, material } = makeSprite();
    const front = rand() < 0.35;
    sprite.renderOrder = front ? 6 : 1;
    wraps.push({
      sprite,
      material,
      front,
      angle: (i / 22) * Math.PI * 2 + (rand() - 0.5) * 0.4,
      radius: 0.42 + rand() * 0.2,
      drift: 0.1 + rand() * 0.16,
      swirl: (rand() - 0.5) * 0.5,
      seed: rand(),
      size0: 0.7 + rand() * 0.5,
      size1: 1.6 + rand() * 1.1,
    });
  }

  return {
    group,
    // fade: 얼음과 함께 나타나고 사라짐, burst: 클릭 뒤 김이 피어오르는 정도(0~1)
    update(dt, fade, burst = 0) {
      puffs.forEach((puff) => {
        puff.age += dt;
        if (puff.age > puff.life) puff.age -= puff.life;
        const t = puff.age / puff.life;
        // 아래로 흐르다가 점점 옆으로 퍼지며 느려진다
        const ease = 1 - (1 - t) * (1 - t);
        puff.sprite.position.set(
          puff.x0 + puff.vx * puff.life * ease + Math.sin(puff.age * 0.6 + puff.seed * 9) * 0.04,
          puff.y0 + puff.vy * puff.life * ease,
          0.2,
        );
        const size = THREE.MathUtils.lerp(puff.size0, puff.size1, ease) * (1 + burst * 0.6);
        puff.sprite.scale.set(size * 1.25, size, 1);
        puff.material.rotation = puff.spin * puff.age + puff.seed * 6;
        const envelope = THREE.MathUtils.smoothstep(t, 0, 0.18) * (1 - THREE.MathUtils.smoothstep(t, 0.55, 1));
        puff.material.opacity = envelope * 0.3 * fade * (1 + burst * 1.2);
      });
      wraps.forEach((wrap) => {
        const grow = burst;
        const angle = wrap.angle + wrap.swirl * grow;
        const r = wrap.radius + wrap.drift * grow;
        wrap.sprite.position.set(
          Math.cos(angle) * r * w * 1.15,
          Math.sin(angle) * r * h * 1.05,
          wrap.front ? 0.9 : -0.2,
        );
        const size = THREE.MathUtils.lerp(wrap.size0, wrap.size1, grow);
        wrap.sprite.scale.set(size * 1.2, size, 1);
        wrap.material.rotation = wrap.seed * 6 + wrap.swirl * grow * 2;
        wrap.material.opacity = grow * (wrap.front ? 0.12 : 0.3) * fade;
      });
    },
    dispose() {
      puffs.forEach((puff) => puff.material.dispose());
      wraps.forEach((wrap) => wrap.material.dispose());
    },
  };
}

/* ── 굴절용 빛판 ──
   얼음의 투명함은 "뒤에 있는 것이 휘어져 보이는 것"에서 나온다. 그런데 페이지 배경은 캔버스 밖 DOM 이라
   얼음이 굴절시킬 대상이 없어 속이 탁한 회색이 됐다. 얼음 뒤에 안개 낀 빛판을 두되,
   굴절(투과) 패스에서만 그리고 실제 화면에는 색을 쓰지 않아 페이지에서는 보이지 않게 한다. */
function createBackdropTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const base = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  base.addColorStop(0, 'rgb(114, 119, 122)');
  base.addColorStop(0.38, 'rgb(70, 74, 77)');
  base.addColorStop(1, 'rgb(18, 20, 21)');
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);
  // 안개가 뭉친 곳과 옅은 곳 — 굴절될 때 결이 보이게 하는 명암 변화
  const rand = seeded(8081);
  for (let i = 0; i < 18; i += 1) {
    const x = size * (0.2 + rand() * 0.6);
    const y = size * (0.2 + rand() * 0.6);
    const radius = size * (0.06 + rand() * 0.14);
    const light = rand() > 0.45;
    const blob = context.createRadialGradient(x, y, 0, x, y, radius);
    blob.addColorStop(0, light ? 'rgba(226, 230, 232, 0.34)' : 'rgba(14, 16, 17, 0.5)');
    blob.addColorStop(1, light ? 'rgba(226, 230, 232, 0)' : 'rgba(14, 16, 17, 0)');
    context.fillStyle = blob;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBackdrop(texture) {
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.onBeforeRender = (renderer) => {
    // 투과 렌더 타깃은 밉맵을 쓰는 유일한 타깃이다. 거기서만 색을 쓰고, 화면에는 아무것도 남기지 않는다.
    const target = renderer.getRenderTarget();
    const transmissionPass = Boolean(target?.texture?.generateMipmaps);
    material.colorWrite = transmissionPass;
    material.depthWrite = transmissionPass;
  };
  return mesh;
}

/* ── 얼음 속 디테일 ──
   뿌연 코어: 갇힌 공기로 가운데가 흐리게 뭉친 부분. 로고 뒤에 두어 로고를 가리지 않는다.
   금: 안쪽의 갈라진 면. 비스듬히 볼수록 빛을 받아 가는 선과 얇은 막이 반짝인다.
   기포: 몇 군데에 몰려 있는 아주 작은 공기 방울. */
const INTERIOR_NOISE = `
  float iHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float iNoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(iHash(i), iHash(i + vec3(1,0,0)), f.x), mix(iHash(i + vec3(0,1,0)), iHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(iHash(i + vec3(0,0,1)), iHash(i + vec3(1,0,1)), f.x), mix(iHash(i + vec3(0,1,1)), iHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

function createInterior(shape, seed) {
  const [w, h, d] = shape;
  const rand = seeded(seed + 1301);
  const group = new THREE.Group();
  const geometries = [];

  // 뿌연 코어 — 가장자리로 갈수록 옅어지는 불규칙한 안개 덩어리
  const coreGeometry = new THREE.IcosahedronGeometry(1, 4);
  const cp = coreGeometry.attributes.position;
  const cv = new THREE.Vector3();
  for (let i = 0; i < cp.count; i += 1) {
    cv.fromBufferAttribute(cp, i);
    const bump = 1 + Math.sin(cv.x * 3.1 + seed) * Math.sin(cv.y * 2.7) * Math.sin(cv.z * 3.3 + 1.7) * 0.22;
    cp.setXYZ(i, cv.x * bump, cv.y * bump, cv.z * bump);
  }
  coreGeometry.computeVertexNormals();
  geometries.push(coreGeometry);
  const coreMaterial = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vPos;
      varying float vFacing;
      void main() {
        vPos = position;
        vFacing = abs(normalize(normalMatrix * normal).z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      varying float vFacing;
      uniform float uOpacity;
      uniform float uTime;
      ${INTERIOR_NOISE}
      void main() {
        float n = iNoise(vPos * 3.2 + vec3(0.0, uTime * 0.04, 0.0)) * 0.6 + iNoise(vPos * 8.0) * 0.4;
        float a = pow(vFacing, 1.6) * smoothstep(0.32, 0.78, n) * uOpacity * 0.2;
        gl_FragColor = vec4(vec3(0.9, 0.915, 0.92), a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.scale.set(w * 0.36, h * 0.3, d * 0.26);
  core.position.set(0, -h * 0.1, -d * 0.14);
  core.renderOrder = 3;
  group.add(core);

  // 금 — 안쪽에 비스듬히 박힌 갈라진 면 세 장
  const crackGeometry = new THREE.PlaneGeometry(1, 1);
  geometries.push(crackGeometry);
  const crackMaterials = [];
  for (let i = 0; i < 3; i += 1) {
    const crackMaterial = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uSeed: { value: rand() * 50 } },
      vertexShader: `
        varying vec2 vUv;
        varying float vFacing;
        void main() {
          vUv = uv;
          vFacing = abs(normalize(normalMatrix * vec3(0.0, 0.0, 1.0)).z);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vFacing;
        uniform float uOpacity;
        uniform float uSeed;
        ${INTERIOR_NOISE}
        void main() {
          vec3 q = vec3(vUv, uSeed);
          float r = length((vUv - 0.5) * vec2(1.0, 1.25)) + (iNoise(q * 5.0) - 0.5) * 0.3;
          float mask = 1.0 - smoothstep(0.2, 0.48, r);
          float n = iNoise(q * vec3(6.0, 4.0, 1.0)) * 0.65 + iNoise(q * 17.0) * 0.35;
          float line = 1.0 - smoothstep(0.0, 0.03, abs(n - 0.5));
          float sheet = smoothstep(0.58, 0.8, n) * 0.22;
          float glint = 0.35 + pow(1.0 - vFacing, 2.0) * 0.65;
          float a = (line * 0.5 + sheet) * mask * glint * uOpacity;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vec3(0.95, 0.965, 0.97), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const crack = new THREE.Mesh(crackGeometry, crackMaterial);
    crack.scale.set(w * (0.45 + rand() * 0.25), h * (0.35 + rand() * 0.25), 1);
    crack.position.set((rand() - 0.5) * w * 0.4, (rand() - 0.5) * h * 0.5, (rand() - 0.5) * d * 0.4);
    crack.rotation.set((rand() - 0.5) * 1.6, (rand() - 0.5) * 2.4, (rand() - 0.5) * 1.2);
    crack.renderOrder = 3;
    group.add(crack);
    crackMaterials.push(crackMaterial);
  }

  // 기포 — 다섯 군데에 몰린 작은 방울
  const bubbles = [];
  for (let c = 0; c < 5; c += 1) {
    const cx = (rand() - 0.5) * w * 0.6;
    const cy = (rand() - 0.5) * h * 0.7;
    const cz = (rand() - 0.5) * d * 0.5;
    for (let i = 0; i < 9; i += 1) {
      bubbles.push(cx + (rand() - 0.5) * 0.16, cy + (rand() - 0.5) * 0.22, cz + (rand() - 0.5) * 0.12);
    }
  }
  const bubbleGeometry = new THREE.BufferGeometry();
  bubbleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bubbles, 3));
  geometries.push(bubbleGeometry);
  const bubbleMaterial = new THREE.PointsMaterial({
    color: 0xf2f4f5,
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const bubblePoints = new THREE.Points(bubbleGeometry, bubbleMaterial);
  bubblePoints.renderOrder = 3;
  group.add(bubblePoints);

  return {
    group,
    update(alpha, time) {
      coreMaterial.uniforms.uOpacity.value = alpha;
      coreMaterial.uniforms.uTime.value = time;
      crackMaterials.forEach((material) => { material.uniforms.uOpacity.value = alpha; });
      bubbleMaterial.opacity = alpha * 0.4;
    },
    dispose() {
      coreMaterial.dispose();
      crackMaterials.forEach((material) => material.dispose());
      bubbleMaterial.dispose();
      geometries.forEach((geometry) => geometry.dispose());
    },
  };
}

/* 얼음 속 로고를 서서히 흐린다. 굴절용 불투명 로고는 흐리는 동안만 투명 재질로 바꾼다. */
function setLogoOpacity(item, value) {
  if (item.logoOpacity === value) return;
  item.logoOpacity = value;
  const fading = value < 0.999;
  item.logoHandle.object.traverse((node) => {
    if (!node.isMesh || item.colorMaterials.includes(node.material)) return;
    if (node.material.transparent !== fading) {
      node.material.transparent = fading;
      node.material.needsUpdate = true;
    }
    node.material.opacity = value;
    node.material.depthWrite = !fading;
  });
  item.logoHandle.object.visible = value > 0.004;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(214,235,241,0.9)');
  gradient.addColorStop(0.34, 'rgba(174,207,217,0.28)');
  gradient.addColorStop(1, 'rgba(125,165,177,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* SVG 로고를 캔버스 텍스처 판으로 만든다. 무채색의 어두운 획은 어두운 배경에서 보이도록 밝게 바꾸고
   브랜드 컬러는 그대로 둔다. 얼음 앞면 바로 안쪽에서 깊이 테스트 없이 그려 항상 또렷하다. */
function createFlatLogo(src, targetWidth) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ratio = (image.naturalHeight || 1) / (image.naturalWidth || 1);
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = Math.max(1, Math.round(1400 * ratio));
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        // 얼음 속이 밝은 회색으로 비치므로 검은 획은 흰색이 아니라 짙은 먹색으로 둔다(흰 얼음에 묻히지 않게).
        if (max < 90 && max - min < 24) {
          data[i] = 30;
          data[i + 1] = 34;
          data[i + 2] = 37;
        }
      }
      context.putImageData(pixels, 0, 0);
      const scale = targetWidth / canvas.width;

      // 1) 얼음 속 판 — 불투명(알파 컷)이라 투과 패스에 그려져 얼음 굴절·분산을 그대로 받는다.
      //    오딧의 입체 로고처럼 "속에 갇힌" 느낌은 여기서 나온다.
      const innerTexture = new THREE.CanvasTexture(canvas);
      innerTexture.colorSpace = THREE.SRGBColorSpace;
      innerTexture.anisotropy = 4;
      const innerGeometry = new THREE.PlaneGeometry(canvas.width * scale, canvas.height * scale);
      const innerMaterial = new THREE.MeshBasicMaterial({
        map: innerTexture,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const inner = new THREE.Mesh(innerGeometry, innerMaterial);

      // 2) 옅은 선명도 보정 — 굴절만으로는 가는 획이 뭉개져서, 같은 자리에 반투명으로 한 번 더 얹는다.
      //    불투명도는 프레임마다 얼음 알파에 맞춰 낮게 유지해 스티커처럼 떠 보이지 않게 한다.
      const pad = 40;
      const out = document.createElement('canvas');
      out.width = canvas.width + pad * 2;
      out.height = canvas.height + pad * 2;
      const outContext = out.getContext('2d');
      // 짙은 획 둘레에 옅은 빛 테를 둘러 얼음의 어두운 얼룩 위에서도 윤곽이 남게 한다.
      outContext.shadowColor = 'rgba(236, 241, 243, 0.55)';
      outContext.shadowBlur = 18;
      outContext.drawImage(canvas, pad, pad);
      outContext.shadowBlur = 0;
      outContext.drawImage(canvas, pad, pad);
      const overlayTexture = new THREE.CanvasTexture(out);
      overlayTexture.colorSpace = THREE.SRGBColorSpace;
      overlayTexture.anisotropy = 4;
      const overlayGeometry = new THREE.PlaneGeometry(out.width * scale, out.height * scale);
      const material = new THREE.MeshBasicMaterial({
        map: overlayTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const overlay = new THREE.Mesh(overlayGeometry, material);
      overlay.position.z = 0.004;
      overlay.renderOrder = 5;

      const object = new THREE.Group();
      object.add(inner, overlay);
      resolve({
        object,
        material,
        dispose() {
          innerGeometry.dispose();
          innerMaterial.dispose();
          innerTexture.dispose();
          overlayGeometry.dispose();
          material.dispose();
          overlayTexture.dispose();
        },
      });
    };
    image.onerror = reject;
    image.src = src;
  });
}

async function makeSpecimen(id) {
  const config = PROJECTS[id];
  const group = new THREE.Group();
  group.name = `work-ice-${id}`;

  const geometry = createIceShard({
    width: config.shape[0],
    height: config.shape[1],
    depth: config.shape[2],
    seed: config.seed,
  });
  const material = icePhysical();
  material.transparent = true;
  material.opacity = 0;
  material.depthWrite = false;
  // 크롬처럼 번쩍이던 층(광택 막, 코팅, 무지개 막)을 걷어낸다. 투명함은 뒤에 둔 굴절용 빛판이 만든다.
  material.sheen = 0;
  material.clearcoat = 0.1;
  material.clearcoatRoughness = 0.1;
  material.iridescence = 0.16;
  material.envMapIntensity = 0.62;
  material.specularIntensity = 0.85;
  material.roughness = 0.1;
  // 두께가 클수록 로고가 옆으로 크게 밀려 보인다. 파편 모양에서는 조금 얇게 잡아 로고가 읽히게 한다.
  material.thickness = 0.75;
  // 두꺼운 곳이 파랗게 물들지 않도록 감쇠색을 거의 중성 회색에 가깝게 둔다.
  material.color = new THREE.Color(0xeceff0);
  material.attenuationColor = new THREE.Color(0xc3c9cc);
  material.attenuationDistance = ICE_ATTENUATION;
  // 공용 얼음 셰이더에서 서리는 줄이고(전체가 뿌옇게 막히지 않게), 세로 긁힘 대신
  // 레퍼런스처럼 망치로 두드린 유리 같은 오목한 물결을 판다.
  const baseCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile(shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('roughnessFactor = mix(roughnessFactor, 0.62, frost * 0.85);', 'roughnessFactor = mix(roughnessFactor, 0.34, frost * 0.4);')
      .replace('float h = iceRelief(vIcePos) * 0.028;', 'float h = (iceNoise(vIcePos * 17.0) * 0.6 + iceNoise(vIcePos * 36.0) * 0.4) * 0.018;');
  };
  material.customProgramCacheKey = () => 'work-ice-v2';
  const ice = new THREE.Mesh(geometry, material);
  ice.renderOrder = 2;
  group.add(ice);

  // 가는 글자 로고(tchaikim, walga)는 입체로 만들면 굴절에 뭉개져 읽히지 않아 2D 판으로 띄운다.
  if (id !== 'odit') {
    let flat;
    try {
      // 파편 폭이 좁아져 로고가 옆면에 걸려 여러 번 굴절되지 않도록 폭의 절반 남짓으로 둔다.
      flat = await createFlatLogo(config.logo, config.shape[0] * 0.5);
    } catch {
      flat = createTextLogo(config.fallback, config.shape[0] * 0.62);
    }
    // 오딧 로고와 같은 깊이(앞면이 아니라 얼음 속)에 두고 살짝 비틀어 판이 아니라 떠 있는 것처럼 보이게 한다.
    flat.object.position.set(0, 0.02, config.shape[2] * 0.1);
    flat.object.rotation.set(0.025, -0.09, 0.02);
    group.add(flat.object);
    return finishSpecimen(id, config, group, geometry, material, ice, flat, null, flat.material ? [flat.material] : []);
  }

  let logoHandle;
  try {
    logoHandle = await loadLogo(config.logo, config.shape[0] * 0.58, { compact: false });
  } catch {
    logoHandle = createTextLogo(config.fallback, config.shape[0] * 0.62);
  }
  logoHandle.object.position.set(0, 0.02, config.shape[2] * 0.1);
  logoHandle.object.rotation.set(0.025, -0.09, 0.02);
  group.add(logoHandle.object);

  // 굴절용 입체 로고는 그대로 두고, 앞면 바로 안쪽에 얇은 컬러 패스를 겹친다.
  // 얼음의 푸른 감쇠와 ACES 톤 매핑에 브랜드 컬러가 회색으로 죽는 것을 막는다.
  const colorLogo = logoHandle.object.clone(true);
  const colorMaterials = [];
  colorLogo.traverse((node) => {
    if (!node.isMesh) return;
    node.material = node.material.clone();
    node.material.transparent = true;
    node.material.opacity = 0;
    node.material.depthWrite = false;
    node.material.depthTest = false;
    node.material.toneMapped = false;
    node.material.emissiveIntensity = Math.max(0.5, node.material.emissiveIntensity);
    node.renderOrder = 4;
    colorMaterials.push(node.material);
  });
  colorLogo.position.copy(logoHandle.object.position);
  colorLogo.rotation.copy(logoHandle.object.rotation);
  colorLogo.position.z += config.shape[2] * 0.018;
  group.add(colorLogo);
  return finishSpecimen(id, config, group, geometry, material, ice, logoHandle, colorLogo, colorMaterials);
}

function finishSpecimen(id, config, group, geometry, material, ice, logoHandle, colorLogo, colorMaterials) {
  const glowTexture = createGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xc2c8cb,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.position.z = -config.shape[2] * 0.48;
  glow.scale.set(config.shape[0] * 1.55, config.shape[1] * 1.55, 1);
  group.add(glow);

  const interior = createInterior(config.shape, config.seed);
  group.add(interior.group);

  const scan = createScanMesh(config.shape, config.seed);
  group.add(scan.object);

  const sparkles = createSparkles(config.seed);
  sparkles.object.renderOrder = 3;
  group.add(sparkles.object);

  group.rotation.set(...config.rotation);
  group.visible = false;
  return {
    id,
    config,
    group,
    ice,
    material,
    geometry,
    logoHandle,
    colorLogo,
    colorMaterials,
    glow,
    glowTexture,
    sparkles,
    scan,
    interior,
    scanHit: new THREE.Vector3(0, 0, 999),
    alpha: 0,
    scale: 1,
    anchor: null,
    entered: false,
  };
}

/**
 * WorkScroll 전용 단일 렌더러.
 * 세 번 복제된 행 중 화면에 가장 가까운 앵커 하나만 프로젝트별로 선택한다.
 */
export async function createWorkIceField(host, root, ids) {
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.transmissionResolutionScale = 0.72;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2500);
  camera.position.z = 1000;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;

  const key = new THREE.DirectionalLight(0xffffff, 2.15);
  key.position.set(-420, 560, 720);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdce4e8, 2.8);
  rim.position.set(520, 120, -280);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xe2e7e9, 0x1c1f21, 0.62));

  const specimens = await Promise.all(ids.map(makeSpecimen));
  specimens.forEach((item) => scene.add(item.group));

  // 연기는 얼음과 함께 움직이되 얼음처럼 구르지는 않도록 따로 둔다.
  const smokeTexture = createSmokeTexture();
  const backdropTexture = createBackdropTexture();
  specimens.forEach((item) => {
    item.smoke = createSmoke(item.config.shape, item.config.seed, smokeTexture);
    scene.add(item.smoke.group);
    item.backdrop = createBackdrop(backdropTexture);
    scene.add(item.backdrop);
  });

  // 클릭 전환 때만 쓰는 후처리. 평소에는 그대로 그려 비용을 아낀다.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const explodePass = new ShaderPass(ExplodeShader);
  // 얼음 속으로 들어가면 먹물로 덮지 않고, 얼음 속에 준비한 상세 화면이 그대로 이어진다.
  explodePass.uniforms.uInk.value = 0;
  composer.addPass(explodePass);
  composer.addPass(new OutputPass());

  const state = {
    hovered: null,
    launching: null,
    launchStarted: 0,
    paused: false,
    pointerX: 0,
    pointerY: 0,
    velocity: 0,
  };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let width = 1;
  let height = 1;
  let frame = 0;
  let live = true;
  let last = performance.now();
  const started = last;

  const resize = () => {
    const bounds = root.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const mobile = width <= 860;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.45));
    renderer.setSize(width, height, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
    explodePass.uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  const onLeave = () => { state.pointerInside = false; };

  /* ── 얼음 속 상세 화면(포털) ──
     상세 화면은 DOM 이라 얼음이 직접 그릴 수 없다. 대신 매 프레임 얼음의 화면 위치·크기를
     CSS 변수로 넘겨, 상세 화면이 얼음 모양의 부드러운 창 안에서 얼음 크기에 맞춘 미니어처로 보이게 한다.
     얼음이 화면을 채우는 무렵 창이 화면 밖까지 넓어지고 크기도 1 이 되어, 전환이 끝나면 그대로 상세 페이지다. */
  const portalHost = root.closest('.portfolio') || document.documentElement;
  const PORTAL_VARS = ['--portal-x', '--portal-y', '--portal-rx', '--portal-ry', '--portal-s', '--portal-blur', '--portal-o'];
  let portalActive = false;
  const updatePortal = (frameInfo) => {
    const style = portalHost.style;
    if (!frameInfo) {
      if (portalActive) {
        PORTAL_VARS.forEach((name) => style.removeProperty(name));
        portalActive = false;
      }
      return;
    }
    portalActive = true;
    const { x, y, halfW, halfH, p } = frameInfo;
    const reveal = THREE.MathUtils.smoothstep(p, 0.72, 0.98);
    const far = Math.hypot(width, height) * 1.4;
    const miniature = Math.max(0.3, Math.min(1, (halfH * 2) / (height * 1.7)));
    style.setProperty('--portal-x', `${x.toFixed(1)}px`);
    style.setProperty('--portal-y', `${y.toFixed(1)}px`);
    style.setProperty('--portal-rx', `${(halfW * 0.78 + reveal * far).toFixed(1)}px`);
    style.setProperty('--portal-ry', `${(halfH * 0.74 + reveal * far).toFixed(1)}px`);
    style.setProperty('--portal-s', THREE.MathUtils.lerp(miniature, 1, reveal).toFixed(4));
    style.setProperty('--portal-blur', `${((1 - THREE.MathUtils.smoothstep(p, 0.25, 0.85)) * 6).toFixed(2)}px`);
    style.setProperty('--portal-o', THREE.MathUtils.smoothstep(p, 0.04, 0.34).toFixed(3));
  };
  root.addEventListener('pointerleave', onLeave);

  const nearestAnchor = (id) => {
    const rootBounds = root.getBoundingClientRect();
    let best = null;
    let bestDistance = Infinity;
    root.querySelectorAll(`[data-ice-anchor="${id}"]`).forEach((anchor) => {
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < rootBounds.top - rect.height || rect.top > rootBounds.bottom + rect.height) return;
      const distance = Math.abs((rect.top + rect.bottom) / 2 - (rootBounds.top + rootBounds.bottom) / 2);
      if (distance < bestDistance) {
        best = { node: anchor, rect, rootBounds };
        bestDistance = distance;
      }
    });
    return best;
  };

  const tick = (now) => {
    if (!live) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (state.paused || document.hidden) return;

    const reduced = reducedQuery.matches;
    let anyVisible = false;
    let launchP = 0;
    let portalFrame = null;
    let launchCenterX = 0;
    let launchCenterY = 0;
    specimens.forEach((item, index) => {
      const match = nearestAnchor(item.id);
      item.anchor = match;
      const row = match?.node.closest('.work-row');
      item.entered = Boolean(row?.hasAttribute('data-in'));
      const inRange = Boolean(match) && match.rect.bottom > match.rootBounds.top && match.rect.top < match.rootBounds.bottom;
      const launching = state.launching !== null;
      const selectedForLaunch = launching && index === state.launching;
      const rowCenter = match ? (match.rect.top + match.rect.bottom) * 0.5 : 0;
      const viewportCenter = match ? (match.rootBounds.top + match.rootBounds.bottom) * 0.5 : 0;
      // -1: 위로 빠져나간 표본, 0: 현재 표본, +1: 아래에서 기다리는 다음 표본.
      // DOM 트랙의 실제 이동량을 쓰므로 휠/터치/키보드가 모두 같은 굴림을 만든다.
      const travel = match
        ? THREE.MathUtils.clamp((rowCenter - viewportCenter) / Math.max(1, match.rootBounds.height), -1.2, 1.2)
        : 1.2;
      const distance = Math.abs(travel);
      const proximity = 1 - THREE.MathUtils.smootherstep(distance, 0.72, 1.04);
      const targetAlpha = launching
        ? (selectedForLaunch ? 1 : 0)
        : (inRange ? proximity : 0);
      item.alpha = reduced ? targetAlpha : damp(item.alpha, targetAlpha, targetAlpha ? 4.1 : 7.5, dt);
      const launchProgress = selectedForLaunch && !reduced
        ? clamp01((now - state.launchStarted) / LAUNCH_DURATION)
        : 0;
      // 폭발 구간에서 얼음 껍질(과 속 안개·금·반짝임)만 걷히고 로고는 남는다.
      // 클릭하면 얼음이 반쯤 투명해지며 속에 상세 화면이 비치고, 표면을 통과하는 마지막에 껍질이 걷힌다.
      const seeThrough = THREE.MathUtils.smoothstep(launchProgress, 0.08, 0.4);
      const shell = (1 - seeThrough * 0.55) * (1 - THREE.MathUtils.smoothstep(launchProgress, 0.74, 0.92));
      item.material.opacity = item.alpha * shell;
      // 얼음 속 로고는 초반에 흐려지고 그 자리에 상세 화면(이야기)이 떠오른다.
      const logoFade = 1 - THREE.MathUtils.smoothstep(launchProgress, 0.06, 0.32);
      setLogoOpacity(item, logoFade);
      item.colorMaterials.forEach((material) => { material.opacity = item.alpha * logoFade * (item.colorLogo ? 0.66 : (item.config.overlay ?? 0.45)); });
      item.sparkles.material.opacity = item.alpha * shell * (reduced ? 0.42 : 0.35 + Math.sin(now * 0.0032 + index) * 0.22);
      item.glow.material.opacity = item.alpha * shell * 0.48;
      item.interior.update(item.alpha * shell, now / 1000);
      item.group.visible = item.alpha > 0.008 && Boolean(match);
      item.smoke.group.visible = item.group.visible;
      item.backdrop.visible = item.group.visible;
      if (!item.group.visible) return;
      anyVisible = true;

      const rect = match.rect;
      const rootBounds = match.rootBounds;
      const shapeWidth = item.config.shape[0];
      const fit = rect.width / shapeWidth;
      if (selectedForLaunch) launchP = launchProgress;
      const hoverScale = state.hovered === index && !launching ? 1.035 : 1;
      // 화면 가장자리에서는 조금 작게 보여, 아래 깊이에서 굴러 들어왔다가
      // 중앙에서 제 크기를 얻고 다시 위쪽 깊이로 빠지는 인상을 만든다.
      const edgeScale = THREE.MathUtils.lerp(0.58, 1, 1 - THREE.MathUtils.smoothstep(distance, 0.08, 0.98));
      // 클릭: 카메라가 얼음 쪽으로 다가간다. 클릭하자마자 천천히 움직이기 시작해 고르게 가속하고,
      // 0.85 무렵 화면을 가득 채운다. 급하게 빨려 드는 대신 이야기 속으로 걸어 들어가는 속도.
      const focusIn = THREE.MathUtils.smoothstep(launchProgress, 0, 0.3);
      const approach = THREE.MathUtils.smoothstep(launchProgress, 0.06, 0.95) ** 1.8;
      const launchScale = 1 + focusIn * 0.08 + approach * 3.4;
      const fadeScale = edgeScale * (1 + (1 - item.alpha) * 0.08) * hoverScale * launchScale;
      item.scale = selectedForLaunch
        ? fit * fadeScale
        : damp(item.scale, fit * fadeScale, 5.5, dt);
      item.group.scale.setScalar(item.scale);
      // 두께(thickness)는 표본 크기에 비례해 계산되지만 감쇠 거리는 월드 단위 그대로라,
      // 크기를 곱해 주지 않으면 빛이 얼음을 거의 통과하지 못하고 속이 검게 막힌다.
      item.material.attenuationDistance = ICE_ATTENUATION * item.scale;
      const anchorX = rect.left - rootBounds.left + rect.width / 2 - width / 2;
      const anchorY = -(rect.top - rootBounds.top + rect.height / 2 - height / 2);
      const moveToCenter = THREE.MathUtils.smootherstep(launchProgress, 0, 0.35);
      // 직선 슬라이드처럼 보이지 않도록 중간에 아주 얕은 좌우 호를 지난다.
      const arcX = Math.sin(travel * Math.PI) * width * 0.075;
      item.group.position.x = THREE.MathUtils.lerp(anchorX + arcX, 0, moveToCenter);
      item.group.position.y = THREE.MathUtils.lerp(anchorY * 0.98, 0, moveToCenter);
      item.group.position.z = index * 2 - distance * 145;

      const base = item.config.rotation;
      if (reduced) {
        item.group.rotation.set(...base);
        item.group.position.y += 0;
      } else {
        const time = (now - started) / 1000;
        const focus = 1 - THREE.MathUtils.smoothstep(distance, 0.08, 0.72);
        // 화면 아래 -> 중앙, 중앙 -> 위 구간마다 1/3 바퀴 정도만 돈다. 한 바퀴씩 구르면
        // 공처럼 가볍게 보여서, 무거운 덩어리가 천천히 기울며 지나가는 정도로 줄였다.
        const roll = travel * Math.PI * 2 * 0.32;
        const axis = item.config.rollAxis;
        const inertia = state.velocity * 0.24;
        item.group.rotation.x = base[0] + roll * axis[0] + state.pointerY * 0.045 * focus * (1 - launchProgress) + inertia * axis[0];
        item.group.rotation.y = base[1] + roll * axis[1] + Math.sin(time * 0.2 + index * 1.7) * 0.035 * focus * (1 - launchProgress) + state.pointerX * 0.055 * focus * (1 - launchProgress) + inertia * axis[1];
        item.group.rotation.z = base[2] + roll * axis[2] + inertia * axis[2] + launchProgress * 0.12;
        item.group.position.y += Math.sin(time * 0.46 + index * 1.4) * 1.6 * focus * (1 - launchProgress);
      }

      // 마우스가 얼음 표면에 닿은 지점을 표본 좌표로 옮겨 격자를 그 주변만 밝힌다.
      const uniforms = item.scan.uniforms;
      let touching = false;
      if (state.pointerInside && !launching && !reduced) {
        item.group.updateMatrixWorld(true);
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(item.ice, false)[0];
        if (hit) {
          touching = true;
          item.scanHit.copy(item.group.worldToLocal(hit.point.clone()));
        }
      }
      if (touching && uniforms.uStrength.value < 0.05) uniforms.uHit.value.copy(item.scanHit);
      else uniforms.uHit.value.lerp(item.scanHit, touching ? Math.min(1, dt * 14) : 0);
      uniforms.uStrength.value = damp(uniforms.uStrength.value, touching ? 1 : 0, touching ? 6 : 2.4, dt);
      uniforms.uOpacity.value = item.alpha;
      uniforms.uTime.value = now / 1000;
      item.scan.object.visible = uniforms.uStrength.value > 0.004;

      // 연기는 얼음 위치와 크기만 따라가고 회전은 따르지 않는다. 전환이 시작되면 먼저 걷힌다.
      // 굴절용 빛판은 얼음 바로 뒤, 회전 없이 얼음보다 넉넉하게 깔린다.
      item.backdrop.position.set(item.group.position.x, item.group.position.y, -800);
      item.backdrop.scale.set(item.scale * item.config.shape[0] * 2.6, item.scale * item.config.shape[1] * 2.6, 1);
      item.smoke.group.position.copy(item.group.position);
      item.smoke.group.scale.setScalar(item.scale);
      // 클릭하면 김이 피어올라 얼음을 감싸고(burst), 얼음 속으로 들어가는 마지막에만 걷힌다.
      const burst = THREE.MathUtils.smoothstep(launchProgress, 0.05, 0.6) * (1 - THREE.MathUtils.smoothstep(launchProgress, 0.88, 1));
      item.smoke.update(reduced ? 0 : dt * (1 + burst * 2), item.alpha, burst);

      if (selectedForLaunch) {
        portalFrame = {
          x: width / 2 + item.group.position.x,
          y: height / 2 - item.group.position.y,
          halfW: item.scale * item.config.shape[0] * 0.5,
          halfH: item.scale * item.config.shape[1] * 0.5,
          p: launchProgress,
        };
      }
    });
    updatePortal(portalFrame);

    if (!anyVisible) {
      renderer.clear();
      return;
    }
    if (launchP > 0.001) {
      const selected = specimens[state.launching];
      launchCenterX = 0.5 + selected.group.position.x / width;
      launchCenterY = 0.5 + selected.group.position.y / height;
      explodePass.uniforms.uLaunch.value = launchP;
      explodePass.uniforms.uCenter.value.set(launchCenterX, launchCenterY);
      explodePass.uniforms.uTime.value = now / 1000;
      composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }
  };
  frame = requestAnimationFrame(tick);

  return {
    setInteraction(hovered, launching) {
      state.hovered = hovered;
      if (launching !== null && state.launching === null) state.launchStarted = performance.now();
      state.launching = launching;
    },
    setPointer(x, y) {
      state.pointerX = clamp01(x * 0.5 + 0.5) * 2 - 1;
      state.pointerY = clamp01(y * 0.5 + 0.5) * 2 - 1;
      ndc.set(x * 2, -y * 2);
      state.pointerInside = true;
    },
    setVelocity(value) {
      state.velocity = value;
    },
    setPaused(value) {
      if (state.paused === value) return;
      state.paused = value;
      window.clearTimeout(state.hideTimer);
      if (value) state.hideTimer = window.setTimeout(() => { host.style.visibility = 'hidden'; }, 700);
      else host.style.visibility = 'visible';
    },
    dispose() {
      live = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('pointerleave', onLeave);
      specimens.forEach((item) => {
        item.logoHandle.dispose();
        if (item.colorLogo) item.colorMaterials.forEach((material) => material.dispose());
        item.geometry.dispose();
        item.material.dispose();
        item.sparkles.geometry.dispose();
        item.sparkles.material.dispose();
        item.glow.material.dispose();
        item.glowTexture.dispose();
        item.scan.dispose();
        item.interior.dispose();
        item.smoke.dispose();
        item.backdrop.geometry.dispose();
        item.backdrop.material.dispose();
      });
      smokeTexture.dispose();
      backdropTexture.dispose();
      composer.dispose();
      envTarget.texture.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}







