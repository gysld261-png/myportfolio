import * as THREE from 'three';

/* 같은 눈 가루가 덩어리를 만들고, 풀리고, 다시 모인다.
   연락처에 도착한 뒤에도 각 덩어리의 생성 주기는 서로 다른 속도로 계속된다. */
export const GRAIN_COUNT = 4800;
const CLUSTER_COUNT = 6;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const seeded = (seed) => () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };

function sampleVolume(rand, surface = false) {
  const y = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const radial = Math.sqrt(1 - y * y);
  const r = surface ? .86 + rand() * .14 : Math.cbrt(rand());
  return [Math.cos(a) * radial * r, y * r, Math.sin(a) * radial * r];
}

// 경계가 딱 잘리는 구 대신, 중심에서 바깥으로 자연스럽게 옅어지는 분포.
function samplePowder(rand) {
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(rand(), .000001))) * Math.cos(rand() * Math.PI * 2);
  return [normal(), normal(), normal()];
}

/* 엔딩의 눈 가루 배치 — 같은 씨앗으로 늘 같은 가루를 만든다.
   포트폴리오의 마지막 얼음이 승화한 가루(workIceScene)도 이 배치로 모여, 엔딩이 같은 알갱이를 이어받는다. */
export function createGrainField() {
  const rand = seeded(261014);
  const base = new Float32Array(GRAIN_COUNT * 3);
  const spread = new Float32Array(GRAIN_COUNT * 3);
  const local = new Float32Array(GRAIN_COUNT * 3);
  const sizes = new Float32Array(GRAIN_COUNT);
  const alpha = new Float32Array(GRAIN_COUNT);
  const seeds = new Float32Array(GRAIN_COUNT);
  const releaseAt = new Float32Array(GRAIN_COUNT);
  for (let i = 0; i < GRAIN_COUNT; i++) {
    const k = i * 3;
    const b = samplePowder(rand);
    const l = samplePowder(rand).map(value => value * .45);
    const s = sampleVolume(rand);
    const shape = 1 + Math.sin(b[0] * 4 + b[1] * 3) * .065 + Math.cos(b[2] * 5 - b[1]) * .04;
    base.set([b[0] * .21 * shape, b[1] * .25 * shape, b[2] * .18 * shape], k);
    // 각 덩어리를 만드는 가루는 넓은 부피 안에서 출발한다.
    spread.set([s[0] * 1.68, s[1] * 1.37, s[2] * 1.26], k);
    local.set(l, k);
    sizes[i] = .011 + rand() * .007;
    alpha[i] = .36 + rand() * .22;
    seeds[i] = rand() * Math.PI * 2;
    releaseAt[i] = .17 + rand() * .18;
  }
  return { base, spread, local, sizes, alpha, seeds, releaseAt };
}

/* 엔딩 카메라 — 장면과 투영 계산이 같은 값을 쓴다 */
const FOV = 32;
const START_SPIN = .25;
const START_TILT = .12;
const START_SCALE = .73;
const cameraZ = (aspect) => (aspect < .85 ? 10.5 : 7.8);
const pixelRatioFor = (width, height, dpr) => Math.min(dpr || 1, 1.7, Math.sqrt(1200000 / (width * height)));

/* 엔딩 첫 장면에서 가루 하나하나가 화면 어디에(가운데 기준 CSS px, 위가 +y), 몇 px 크기로, 얼마나 옅게 보이는지.
   승화한 가루가 정확히 이 자리로 모이면 엔딩으로 넘어가는 순간이 이어진다. */
export function projectEndingGrains(width, height, dpr) {
  const { base, sizes, alpha } = createGrainField();
  const aspect = width / height;
  const camera = new THREE.PerspectiveCamera(FOV, aspect, .1, 30);
  camera.position.set(0, .02, cameraZ(aspect));
  camera.updateMatrixWorld();
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(START_TILT, START_SPIN, 0)),
    new THREE.Vector3(START_SCALE, START_SCALE, START_SCALE),
  );
  const ratio = pixelRatioFor(width, height, dpr);
  const pixelFactor = height * ratio / (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));
  const target = new Float32Array(GRAIN_COUNT * 2);
  const size = new Float32Array(GRAIN_COUNT);
  const opacity = new Float32Array(GRAIN_COUNT);
  const v = new THREE.Vector3();
  for (let i = 0; i < GRAIN_COUNT; i++) {
    v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]).applyMatrix4(matrix);
    const depth = camera.position.z - v.z;
    v.project(camera);
    target[i * 2] = v.x * width / 2;
    target[i * 2 + 1] = v.y * height / 2;
    // 장면의 gl_PointSize(기기 px)를 CSS px 로 — 받는 쪽이 자기 픽셀 비율을 곱한다
    size[i] = Math.min(3, Math.max(1.15, sizes[i] * pixelFactor / depth)) / ratio;
    // 첫 장면의 옅기: aAlpha × 느슨함(.65) × 시작 투명도(.72)
    opacity[i] = alpha[i] * .65 * .72;
  }
  return { count: GRAIN_COUNT, target, size, opacity };
}

export function createEndingScene(host) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x050708, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 30);
  const group = new THREE.Group();
  scene.add(group);
  const { base, spread, local, sizes, alpha, seeds, releaseAt } = createGrainField();
  const positions = new Float32Array(GRAIN_COUNT * 3);
  const gathered = new Float32Array(GRAIN_COUNT);
  const clusters = [
    { x: -.94, y: .55, z: .34, r: .36, phase: .3 },
    { x: .83, y: .71, z: -.48, r: .33, phase: 2.2 },
    { x: -1.14, y: -.43, z: -.3, r: .4, phase: 4.4 },
    { x: .86, y: -.73, z: .25, r: .36, phase: 1.2 },
    { x: .06, y: 1.03, z: .15, r: .35, phase: 3.3 },
    { x: -.16, y: -.93, z: .55, r: .32, phase: 5.4 },
  ];

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geometry.setAttribute('aGather', new THREE.BufferAttribute(gathered, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPixelFactor: { value: 1 }, uText: { value: 0 }, uSpread: { value: 0 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(0xe5ede9) } },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aGather;
      uniform float uPixelFactor;
      uniform float uSpread;
      varying float vAlpha;
      varying float vGather;
      varying vec2 vScreen;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        float mass = mix(1.0, 0.75 + aGather * 0.1, uSpread);
        gl_PointSize = clamp(aSize * mass * uPixelFactor / -view.z, 1.15, 3.0);
        vAlpha = aAlpha;
        vGather = aGather;
        vScreen = gl_Position.xy / gl_Position.w;
      }`,
    fragmentShader: `
      uniform float uText;
      uniform float uSpread;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vAlpha;
      varying float vGather;
      varying vec2 vScreen;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float radius = dot(p, p);
        if (radius > 1.0) discard;
        float edge = exp(-radius * 1.8) * (1.0 - smoothstep(0.55, 1.0, radius));
        float room = smoothstep(0.025, 0.34, length(vScreen * vec2(0.78, 2.3)));
        float readable = mix(1.0, 0.22 + room * 0.78, uText);
        // 모여도 불투명한 알갱이 덩어리가 되지 않도록 밀도에 따라 투명도를 낮춘다.
        float loose = mix(0.65, 0.95 - vGather * 0.45, uSpread);
        gl_FragColor = vec4(uColor, edge * vAlpha * loose * uOpacity * readable);
        #include <colorspace_fragment>
      }`,
  });
  const snow = new THREE.Points(geometry, material);
  snow.frustumCulled = false;
  group.add(snow);

  // 밝은 가루 사이의 아주 옅은 냉기만 남겨 부피를 잇는다.
  const hazeGeo = new THREE.BufferGeometry();
  const hazePositions = new Float32Array(CLUSTER_COUNT * 3);
  const hazeSize = new Float32Array(CLUSTER_COUNT).fill(.7);
  hazeGeo.setAttribute('position', new THREE.BufferAttribute(hazePositions, 3).setUsage(THREE.DynamicDrawUsage));
  hazeGeo.setAttribute('aSize', new THREE.BufferAttribute(hazeSize, 1));
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPixelFactor: material.uniforms.uPixelFactor, uOpacity: { value: 0 }, uText: material.uniforms.uText },
    vertexShader: `
      attribute float aSize;
      uniform float uPixelFactor;
      varying vec2 vScreen;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = aSize * uPixelFactor / -view.z;
        vScreen = gl_Position.xy / gl_Position.w;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uText;
      varying vec2 vScreen;
      void main() {
        float falloff = exp(-dot(gl_PointCoord - 0.5, gl_PointCoord - 0.5) * 22.0);
        float room = smoothstep(0.035, 0.32, length(vScreen * vec2(0.78, 2.3)));
        gl_FragColor = vec4(0.54, 0.64, 0.65, falloff * uOpacity * mix(1.0, room, uText));
      }`,
  });
  group.add(new THREE.Points(hazeGeo, hazeMat));
  const clusterGather = new Float32Array(CLUSTER_COUNT);
  const clusterCenters = new Float32Array(CLUSTER_COUNT * 3);
  let progress = 0, elapsed = 0, spin = START_SPIN, dragY = 0, dragVelocity = 0;

  const resize = () => {
    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    const ratio = pixelRatioFor(width, height, window.devicePixelRatio);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, .02, cameraZ(camera.aspect));
    camera.updateProjectionMatrix();
    material.uniforms.uPixelFactor.value = height * ratio / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };
  host.appendChild(renderer.domElement);
  resize();
  window.addEventListener('resize', resize);

  return {
    setProgress(value) { progress = value; },
    drag(dx, dy) { dragVelocity += dx * .0025; dragY = Math.max(-.5, Math.min(.5, dragY + dy * .0025)); },
    render(dt) {
      elapsed += dt;
      spin += dt * .085 + dragVelocity;
      dragVelocity *= Math.exp(-dt * 4);
      group.rotation.set(START_TILT + dragY, spin, Math.sin(elapsed * .11) * .025);
      group.scale.setScalar(START_SCALE + (1 - START_SCALE) * smooth(.01, .25, progress));
      const dispersion = smooth(.17, .6, progress);
      const remake = smooth(.59, .96, progress);
      material.uniforms.uSpread.value = dispersion;
      material.uniforms.uText.value = smooth(.6, .69, progress);
      material.uniforms.uOpacity.value = .72 + .28 * smooth(.02, .2, progress);
      hazeMat.uniforms.uOpacity.value = .035 * dispersion;

      for (let j = 0; j < CLUSTER_COUNT; j++) {
        const c = clusters[j];
        // 약 24~27초의 밀도 변화가 엇갈려, 장면 전체가 동시에 리셋되지 않는다.
        const cycle = .5 + .5 * Math.sin(elapsed * (.23 + j * .006) + c.phase);
        clusterGather[j] = remake * smooth(.18, .82, cycle);
        const k = j * 3;
        clusterCenters[k] = c.x + Math.sin(elapsed * .1 + c.phase) * .055;
        clusterCenters[k + 1] = c.y + Math.cos(elapsed * .13 + c.phase) * .05;
        clusterCenters[k + 2] = c.z + Math.sin(elapsed * .09 + j) * .045;
        hazePositions[k] = clusterCenters[k];
        hazePositions[k + 1] = clusterCenters[k + 1];
        hazePositions[k + 2] = clusterCenters[k + 2];
      }
      for (let i = 0; i < GRAIN_COUNT; i++) {
        const k = i * 3, j = i % CLUSTER_COUNT, ck = j * 3;
        const release = smooth(releaseAt[i], releaseAt[i] + .27, progress);
        const gather = clusterGather[j];
        const c = clusters[j];
        const drift = seeds[i] + elapsed * .17;
        const freeX = spread[k] + Math.sin(drift) * .045;
        const freeY = spread[k + 1] + Math.cos(drift * .73) * .05;
        const freeZ = spread[k + 2] + Math.cos(drift) * .035;
        // 같은 가루의 밀도가 옅게 모이고 퍼지는 넓은 형태를 만든다.
        const radius = c.r * (1 + .1 * Math.sin(local[k] * 5 + local[k + 1] * 4));
        const targetX = clusterCenters[ck] + local[k] * radius * 1.4;
        const targetY = clusterCenters[ck + 1] + local[k + 1] * radius * .65;
        const targetZ = clusterCenters[ck + 2] + local[k + 2] * radius;
        const x = freeX + (targetX - freeX) * gather;
        const y = freeY + (targetY - freeY) * gather;
        const z = freeZ + (targetZ - freeZ) * gather;
        positions[k] = base[k] + (x - base[k]) * release;
        positions[k + 1] = base[k + 1] + (y - base[k + 1]) * release;
        positions[k + 2] = base[k + 2] + (z - base[k + 2]) * release;
        gathered[i] = gather;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aGather.needsUpdate = true;
      hazeGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      geometry.dispose();
      material.dispose();
      hazeGeo.dispose();
      hazeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
