import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createIceChunk, icePhysical, loadLogo } from './iceBlockScene';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const damp = (from, to, speed, dt) => THREE.MathUtils.damp(from, to, speed, dt);

const PROJECTS = {
  odit: {
    seed: 7,
    shape: [1.82, 1.38, 1.12],
    rotation: [0.12, -0.46, -0.1],
    logo: '/cases/odit-logo.svg',
    fallback: 'ODIT',
    rollAxis: [0.76, 0.2, 0.62],
  },
  tchaikim: {
    seed: 19,
    shape: [1.22, 1.82, 1.08],
    rotation: [0.08, -0.3, 0.08],
    logo: '/cases/tchaikim-logo.svg',
    fallback: 'TCHAIKIM',
    rollAxis: [0.68, -0.24, 0.72],
  },
  walga: {
    seed: 61,
    shape: [1.78, 1.5, 1.2],
    rotation: [0.1, -0.34, -0.08],
    logo: '/cases/walga-logo.svg',
    fallback: 'WALGA',
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

async function makeSpecimen(id) {
  const config = PROJECTS[id];
  const group = new THREE.Group();
  group.name = `work-ice-${id}`;

  const geometry = createIceChunk({
    width: config.shape[0],
    height: config.shape[1],
    depth: config.shape[2],
    seed: config.seed,
  });
  const material = icePhysical();
  material.transparent = true;
  material.opacity = 0;
  material.depthWrite = false;
  const ice = new THREE.Mesh(geometry, material);
  ice.renderOrder = 2;
  group.add(ice);

  let logoHandle;
  try {
    logoHandle = config.logo
      ? await loadLogo(config.logo, Math.min(config.shape[0] * 0.72, 1.2), { compact: id !== 'odit' })
      : createTextLogo(config.fallback, config.shape[0] * 0.62);
  } catch {
    logoHandle = createTextLogo(config.fallback, config.shape[0] * 0.62);
  }
  if (id === 'tchaikim' || id === 'walga') {
    logoHandle.object.traverse((node) => {
      if (!node.isMesh) return;
      if (id === 'tchaikim') {
        node.material.color.set(0x3d4b51);
        node.material.emissive.set(0x91abb5);
        node.material.emissiveIntensity = 0.3;
      } else {
        const luminance = node.material.color.r * 0.2126 + node.material.color.g * 0.7152 + node.material.color.b * 0.0722;
        if (luminance < 0.08) {
          node.material.color.set(0x53656d);
          node.material.emissive.set(0x91aab4);
        }
        node.material.emissiveIntensity = 0.42;
      }
    });
  }
  logoHandle.object.position.set(0, 0.02, config.shape[2] * (id === 'odit' ? 0.1 : 0.35));
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

  const glowTexture = createGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xb8ccd3,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.position.z = -config.shape[2] * 0.48;
  glow.scale.set(config.shape[0] * 1.55, config.shape[1] * 1.55, 1);
  group.add(glow);

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
  const rim = new THREE.DirectionalLight(0xcfe6f0, 2.8);
  rim.position.set(520, 120, -280);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdbe8ec, 0x1a2023, 0.62));

  const specimens = await Promise.all(ids.map(makeSpecimen));
  specimens.forEach((item) => scene.add(item.group));

  const state = {
    hovered: null,
    launching: null,
    launchStarted: 0,
    paused: false,
    pointerX: 0,
    pointerY: 0,
    velocity: 0,
  };
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
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

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
      item.material.opacity = item.alpha;
      item.colorMaterials.forEach((material) => { material.opacity = item.alpha * 0.66; });
      item.sparkles.material.opacity = item.alpha * (reduced ? 0.42 : 0.35 + Math.sin(now * 0.0032 + index) * 0.22);
      item.glow.material.opacity = item.alpha * 0.48;
      item.group.visible = item.alpha > 0.008 && Boolean(match);
      if (!item.group.visible) return;
      anyVisible = true;

      const rect = match.rect;
      const rootBounds = match.rootBounds;
      const shapeWidth = item.config.shape[0];
      const fit = rect.width / shapeWidth;
      const launchProgress = selectedForLaunch && !reduced
        ? clamp01((now - state.launchStarted) / 980)
        : 0;
      const hoverScale = state.hovered === index && !launching ? 1.035 : 1;
      // 화면 가장자리에서는 조금 작게 보여, 아래 깊이에서 굴러 들어왔다가
      // 중앙에서 제 크기를 얻고 다시 위쪽 깊이로 빠지는 인상을 만든다.
      const edgeScale = THREE.MathUtils.lerp(0.58, 1, 1 - THREE.MathUtils.smoothstep(distance, 0.08, 0.98));
      const fadeScale = edgeScale * (1 + (1 - item.alpha) * 0.08) * hoverScale * (1 + launchProgress * 4.4);
      item.scale = damp(item.scale, fit * fadeScale, selectedForLaunch ? 8.5 : 5.5, dt);
      item.group.scale.setScalar(item.scale);
      const anchorX = rect.left - rootBounds.left + rect.width / 2 - width / 2;
      const anchorY = -(rect.top - rootBounds.top + rect.height / 2 - height / 2);
      const moveToCenter = THREE.MathUtils.smootherstep(launchProgress, 0, 1);
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
        // 화면 아래 -> 중앙, 중앙 -> 위 구간마다 약 한 바퀴씩 누적한다. 세 축이 섞인
        // 비스듬한 회전축 덕분에 판이 기우는 모션이 아니라 질량 있는 덩어리가 구른다.
        const roll = travel * Math.PI * 2 * 1.04;
        const axis = item.config.rollAxis;
        const inertia = state.velocity * 0.24;
        item.group.rotation.x = base[0] + roll * axis[0] + state.pointerY * 0.045 * focus * (1 - launchProgress) + inertia * axis[0];
        item.group.rotation.y = base[1] + roll * axis[1] + Math.sin(time * 0.2 + index * 1.7) * 0.035 * focus * (1 - launchProgress) + state.pointerX * 0.055 * focus * (1 - launchProgress) + inertia * axis[1];
        item.group.rotation.z = base[2] + roll * axis[2] + inertia * axis[2] + launchProgress * 0.12;
        item.group.position.y += Math.sin(time * 0.46 + index * 1.4) * 1.6 * focus * (1 - launchProgress);
      }
    });

    if (anyVisible) renderer.render(scene, camera);
    else renderer.clear();
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
    },
    setVelocity(value) {
      state.velocity = value;
    },
    setPaused(value) {
      state.paused = value;
      host.style.visibility = value ? 'hidden' : 'visible';
    },
    dispose() {
      live = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      specimens.forEach((item) => {
        item.logoHandle.dispose();
        item.colorMaterials.forEach((material) => material.dispose());
        item.geometry.dispose();
        item.material.dispose();
        item.sparkles.geometry.dispose();
        item.sparkles.material.dispose();
        item.glow.material.dispose();
        item.glowTexture.dispose();
      });
      envTarget.texture.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}







