import * as THREE from 'three';

/**
 * LIST 뒤의 프리즘.
 *
 * 네 옆면에 네 프로젝트의 화면이 한 장씩 붙어 있다. 목록에서 이름을 가리키면
 * 프리즘이 그 면으로 돌아서고, 누르면 그 면이 화면을 가득 채울 때까지 다가간다.
 * 사이트는 무채색 액자라서 색은 면 위의 프로젝트 화면에만 있다.
 *
 * faces — [{ id, kind: 'image' | 'video' | 'card', src?, card? }] 목록 순서대로.
 */

const W = 3.2;
const H = 2;
const D = 3.2;
const FOV = 30;
const REST_YAW = -0.44;
const REST_PITCH = 0.14;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uRepeat;
  uniform vec2 uOffset;
  uniform float uLit;
  uniform float uSweep;
  uniform float uReady;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uMap, vUv * uRepeat + uOffset).rgb;
    c = mix(vec3(0.012), c, uReady);
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    // 비활성 면은 색을 빼고 어둡게 — 돌아서는 순간에만 색이 들어온다
    c = mix(vec3(g) * 0.55, c, uLit);
    c *= mix(0.3, 1.0, uLit);
    float band = smoothstep(0.08, 0.0, abs(vUv.x * 0.8 + vUv.y * 0.45 - uSweep));
    c += band * 0.16 * uLit;
    vec2 e = min(vUv, 1.0 - vUv);
    c *= mix(0.72, 1.0, smoothstep(0.0, 0.035, min(e.x, e.y)));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// 자료가 아직 없는 프로젝트는 지어낸 화면 대신 이름과 상태만 적은 표지를 붙인다.
function drawCard({ title, meta, note }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c0e0f';
  ctx.fillRect(0, 0, 1600, 1000);
  ctx.strokeStyle = 'rgba(175,194,200,0.14)';
  ctx.lineWidth = 2;
  for (let x = 100; x < 1600; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1000); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(241,242,239,0.92)';
  ctx.font = '600 150px "Wanted Sans", "Pretendard", system-ui, sans-serif';
  ctx.fillText(title, 96, 560);
  ctx.fillStyle = 'rgba(175,194,200,0.7)';
  ctx.font = '500 30px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText(meta, 100, 200);
  ctx.fillText(note, 100, 880);
  return canvas;
}

export function createListPrism(host, faces) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const rig = new THREE.Group();    // 배치, 포인터 기울기
  const prism = new THREE.Group();  // 면 돌리기
  rig.add(prism);
  scene.add(rig);

  // BoxGeometry 재질 순서: +x, -x, +y, -y, +z, -z. 목록 i번째 면이 정면(+z)으로 오도록 배치한다.
  const SLOT = [4, 0, 5, 1];
  const capMaterial = new THREE.MeshBasicMaterial({ color: 0x0b0d0e });
  const loader = new THREE.TextureLoader();
  const videos = [];

  const faceMaterials = faces.map((face) => {
    const uniforms = {
      uMap: { value: null },
      uRepeat: { value: new THREE.Vector2(1, 1) },
      uOffset: { value: new THREE.Vector2(0, 0) },
      uLit: { value: 0 },
      uSweep: { value: -1 },
      uReady: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment });

    const cover = (texture, width, height) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const faceAspect = W / H;
      const aspect = width / height;
      if (aspect > faceAspect) {
        uniforms.uRepeat.value.set(faceAspect / aspect, 1);
        uniforms.uOffset.value.set((1 - faceAspect / aspect) / 2, 0);
      } else {
        const r = aspect / faceAspect;
        // 세로로 긴 화면은 윗부분을 보여준다 — 사이트의 첫 화면이 거기 있다
        uniforms.uRepeat.value.set(1, r);
        uniforms.uOffset.value.set(0, 1 - r);
      }
      uniforms.uMap.value = texture;
      uniforms.uReady.value = 1;
    };

    if (face.kind === 'video') {
      const video = document.createElement('video');
      Object.assign(video, { src: face.src, muted: true, loop: true, playsInline: true, preload: 'auto' });
      video.setAttribute('muted', '');
      video.crossOrigin = 'anonymous';
      const texture = new THREE.VideoTexture(video);
      video.addEventListener('loadeddata', () => cover(texture, video.videoWidth, video.videoHeight), { once: true });
      videos.push({ video, face });
      if (face.poster) {
        loader.load(face.poster, (poster) => {
          if (!uniforms.uReady.value) cover(poster, poster.image.width, poster.image.height);
        });
      }
    } else if (face.kind === 'card') {
      const texture = new THREE.CanvasTexture(drawCard(face.card));
      cover(texture, 1600, 1000);
    } else {
      loader.load(face.src, (texture) => cover(texture, texture.image.width, texture.image.height));
    }
    return material;
  });

  const materials = [capMaterial, capMaterial, capMaterial, capMaterial, capMaterial, capMaterial];
  faceMaterials.forEach((material, i) => { materials[SLOT[i]] = material; });
  const geometry = new THREE.BoxGeometry(W, H, D);
  prism.add(new THREE.Mesh(geometry, materials));

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xdfe8eb, transparent: true, opacity: 0.55 }),
  );
  prism.add(edges);

  // 바깥을 도는 유령 상자 — 프리즘이 돌 때 반 박자 늦게 따라온다
  const ghost = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W * 1.16, H * 1.3, D * 1.16)),
    new THREE.LineBasicMaterial({ color: 0xafc2c8, transparent: true, opacity: 0.16 }),
  );
  rig.add(ghost);

  const state = {
    active: 0,
    yaw: 0,
    targetYaw: 0,
    ghostYaw: 0,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    zoom: 0,
    zoomFrom: 0,
    zoomTo: 0,
    zoomStart: 0,
    zoomDuration: 1,
    zoomDone: null,
    sweepStart: -10,
    lit: faces.map((_, i) => (i === 0 ? 1 : 0)),
    width: 1,
    height: 1,
    mobile: false,
    paused: false,
  };

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    state.width = Math.max(1, width);
    state.height = Math.max(1, height);
    state.mobile = width < 860;
    renderer.setSize(state.width, state.height, false);
    camera.aspect = state.width / state.height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const playVideos = () => {
    videos.forEach(({ video, face }) => {
      const on = !state.paused && faces[state.active] === face;
      if (on && video.paused) video.play().catch(() => {});
      if (!on && !video.paused) video.pause();
    });
  };

  const setActive = (index) => {
    if (index === state.active || index < 0 || index >= faces.length) return;
    const desired = -index * (Math.PI / 2);
    const turn = Math.PI * 2;
    state.targetYaw = desired + Math.round((state.targetYaw - desired) / turn) * turn;
    state.active = index;
    state.sweepStart = performance.now();
    if (reduced) state.yaw = state.targetYaw;
    playVideos();
  };

  const animateZoom = (to, duration) => new Promise((resolve) => {
    state.zoomFrom = state.zoom;
    state.zoomTo = to;
    state.zoomStart = performance.now();
    state.zoomDuration = reduced ? 1 : duration;
    state.zoomDone = resolve;
  });

  let last = performance.now();
  let frame = 0;
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.paused || document.hidden) return;

    // 확대
    if (state.zoomDone) {
      const t = Math.min(1, (now - state.zoomStart) / state.zoomDuration);
      state.zoom = state.zoomFrom + (state.zoomTo - state.zoomFrom) * easeInOut(t);
      if (t >= 1) {
        const done = state.zoomDone;
        state.zoomDone = null;
        done();
      }
    }
    const z = state.zoom;
    const rest = 1 - z;

    const k = 1 - Math.exp(-dt * (reduced ? 60 : 5.2));
    state.yaw += (state.targetYaw - state.yaw) * k;
    state.ghostYaw += (state.targetYaw - state.ghostYaw) * (1 - Math.exp(-dt * 2.2));
    state.pointer.lerp(state.pointerTarget, 1 - Math.exp(-dt * 4));
    const spin = state.targetYaw - state.yaw; // 도는 중에는 살짝 들려 올라온다

    // 배치 — 데스크톱은 목록 오른쪽, 모바일은 목록 뒤 가운데
    const visibleH = 2 * tanHalf * 9.2;
    const visibleW = visibleH * camera.aspect;
    const restX = state.mobile ? 0 : Math.min(visibleW * 0.15, 2.2);
    const restScale = state.mobile ? Math.min(1, (visibleW * 0.6) / (W * 1.4)) : 1;
    rig.position.set(restX * rest, (state.mobile ? visibleH * 0.2 : 0) * rest, 0);
    rig.scale.setScalar(restScale + (1 - restScale) * z);
    rig.rotation.set(
      (REST_PITCH + state.pointer.y * -0.14 - Math.abs(spin) * 0.05) * rest,
      (REST_YAW + state.pointer.x * 0.3) * rest,
      (Math.sin(now * 0.0004) * 0.012) * rest,
    );
    prism.rotation.y = state.yaw;
    prism.position.y = (Math.sin(now * 0.0007) * 0.05 + Math.min(0.25, Math.abs(spin) * 0.12)) * rest;
    ghost.rotation.y = state.ghostYaw + now * 0.00006 * rest;
    ghost.material.opacity = 0.16 * rest;
    edges.material.opacity = 0.55 * (1 - z * 0.9);

    // 카메라 — 정면 면이 화면을 덮을 거리까지
    const fillDistance = Math.min(H / (2 * tanHalf), W / (2 * tanHalf * camera.aspect)) * 0.97;
    camera.position.set(0, 0, 9.2 * rest + (D / 2 + fillDistance) * z);
    camera.lookAt(0, 0, 0);

    faceMaterials.forEach((material, i) => {
      const target = i === state.active ? 1 : 0;
      state.lit[i] += (target - state.lit[i]) * (1 - Math.exp(-dt * 4.5));
      material.uniforms.uLit.value = state.lit[i];
      material.uniforms.uSweep.value = i === state.active ? -0.3 + ((now - state.sweepStart) / 900) * 1.9 : -1;
    });

    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);
  playVideos();

  return {
    setActive,
    setPointer(x, y) { state.pointerTarget.set(x, y); },
    /** 정면 면이 화면을 가득 채울 때까지 다가간다. */
    zoomIn(index) {
      setActive(index);
      return animateZoom(1, 1050);
    },
    /** 상세에서 돌아오면 다시 물러난다. */
    zoomOut() {
      return animateZoom(0, 900);
    },
    setPaused(value) {
      state.paused = value;
      playVideos();
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      videos.forEach(({ video }) => { video.pause(); video.removeAttribute('src'); video.load(); });
      faceMaterials.forEach((material) => { material.uniforms.uMap.value?.dispose(); material.dispose(); });
      capMaterial.dispose();
      geometry.dispose();
      edges.geometry.dispose(); edges.material.dispose();
      ghost.geometry.dispose(); ghost.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
