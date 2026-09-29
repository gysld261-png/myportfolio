import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createIceShard } from './iceBlockScene';
import { createHeroEnvironment } from './heroEnvironment';
import {
  ICE_ATTENUATION,
  createGlowTexture,
  createInterior,
  createSmoke,
  createSmokeTexture,
  createSparkles,
  createTrail,
  createWorkIceMaterial,
  spring,
} from './workIceScene';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const damp = (from, to, speed, dt) => THREE.MathUtils.damp(from, to, speed, dt);
const { smoothstep } = THREE.MathUtils;

/* SPECIMEN 00 — 포트폴리오 표본들과 같은 재질의 빈 얼음 덩어리.
   서리가 껴 있어 문지르면 닦이고(몇 초 뒤 다시 언다), 스크롤 승화 진행도(exit)에 따라
   가장자리부터 김으로 풀려 사라진다. 사라지는 동안 화면을 덮는 연기는 Main 의 .main__vapor 가 맡는다. */
const SHAPE = [1.5, 1.96, 1.26];
const SEED = 3;
const BASE_ROTATION = [0.12, -0.36, -0.07];
const FROST = 0.9;

export async function createHeroIce(host, { initialEntrance = false, getExit = () => 0, onReadout, onReady } = {}) {
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
  // 원근 카메라지만 z=0 평면에서 1 = 1px 이 되도록 거리를 맞춘다(얼음 크기 계산은 픽셀 그대로).
  // 그래서 얼음은 화면에 맞춰 놓고, 뒤의 빙원만 원근으로 멀어진다.
  const FOV = 35;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 16000);
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
  const environment = createHeroEnvironment(scene);

  // 서리는 몇 초에 걸쳐 다시 끼어야 "닦았다"는 손맛이 남는다
  const trail = createTrail(renderer, { life: 4.5 });
  trail.uniforms.uRadius.value = 0.085;

  const group = new THREE.Group();
  group.rotation.set(...BASE_ROTATION);
  scene.add(group);

  const geometry = createIceShard({ width: SHAPE[0], height: SHAPE[1], depth: SHAPE[2], seed: SEED });
  const material = createWorkIceMaterial(trail.sample);
  const iceUniforms = material.userData.ice;
  iceUniforms.uTouchFog.value = 0;
  iceUniforms.uFrost.value = FROST;
  const ice = new THREE.Mesh(geometry, material);
  ice.renderOrder = 2;
  group.add(ice);

  const glowTexture = createGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xc2c8cb,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  glow.position.z = -SHAPE[2] * 0.48;
  glow.scale.set(SHAPE[0] * 1.55, SHAPE[1] * 1.55, 1);
  group.add(glow);

  const interior = createInterior(SHAPE, SEED);
  group.add(interior.group);

  const sparkles = createSparkles(SEED);
  sparkles.object.renderOrder = 3;
  group.add(sparkles.object);

  // 연기와 굴절용 빛판은 회전하지 않는다
  const smokeTexture = createSmokeTexture();
  const smoke = createSmoke(SHAPE, SEED, smokeTexture, { count: 44, strength: 1.7, spread: 1.5, wisps: 64 });
  scene.add(smoke.group);

  const pointer = { x: 0, y: 0, vx: 0, vy: 0, at: 0, inside: false };
  const ndc = new THREE.Vector2(-10, -10);
  const raycaster = new THREE.Raycaster();
  const tilt = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, z: { x: 0, v: 0 } };
  const drift = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 } };
  // 스스로 천천히 한 바퀴씩 돈다. 가로로 문지르면 그 방향으로 더 돌았다가 원래 속도로 돌아온다.
  const IDLE_SPIN = 0.24; // rad/s — 약 26초에 한 바퀴
  let spin = 0;
  let spinSpeed = IDLE_SPIN;
  let width = 1;
  let height = 1;
  let bounds = host.getBoundingClientRect();
  let touching = false;
  // 건드린 세기(0~1)와 닿은 점(연기 그룹 좌표). 닿으면 그 자리에서 김이 피어난다.
  let stir = 0;
  const stirPoint = new THREE.Vector3();
  let heat = 0;
  let alpha = 0;
  let frame = 0;
  let live = true;
  let last = performance.now();
  const started = last;
  let lastReadout = 0;

  const resize = () => {
    bounds = host.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const mobile = width <= 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.45));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, 0, (height / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.updateProjectionMatrix();
    environment.layout(camera, height);
    trail.resize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  // 얼음 위에는 글자층이 덮여 있어(pointer-events: none) 창 전체에서 받는다
  const onMove = (event) => {
    bounds = host.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    const inside = Math.abs(x) <= 0.5 && Math.abs(y) <= 0.5;
    const now = performance.now();
    const gap = (now - pointer.at) / 1000;
    if (pointer.inside && inside && gap > 0.001 && gap < 0.2) {
      pointer.vx += ((x - pointer.x) / gap - pointer.vx) * 0.35;
      pointer.vy += ((y - pointer.y) / gap - pointer.vy) * 0.35;
    }
    pointer.at = now;
    pointer.x = x;
    pointer.y = y;
    pointer.inside = inside;
    ndc.set(x * 2, -y * 2);
  };
  const onLeave = () => { pointer.inside = false; };

  /* ── 잡고 돌리기 ──
     얼음을 누른 채 끌면 가로로는 한 바퀴를 돌리고, 세로로는 앞뒤로 기울인다.
     놓으면 던진 속도로 계속 돌다가 천천히 원래의 느린 회전으로 돌아온다. */
  const drag = { active: false, x: 0, y: 0, at: 0, vel: 0 };
  let cursor = '';
  const setCursor = (value) => {
    if (cursor === value) return;
    cursor = value;
    document.documentElement.style.cursor = value;
    // 얼음을 만지는 동안 커서 유체를 옅게 누른다 (components/cursor.css)
    if (value) document.documentElement.dataset.iceTouch = '';
    else delete document.documentElement.dataset.iceTouch;
    // 따라다니는 점도 링 + DRAG 라벨로 바꾼다 (components/CustomCursor)
    window.dispatchEvent(new CustomEvent('app-cursor', { detail: value ? { active: true, label: 'DRAG' } : null }));
  };
  const onDown = (event) => {
    if (event.button !== 0 || getExit() > 0.3) return;
    onMove(event);
    if (!touching) return;
    // 글자 선택·이미지 끌기가 같이 일어나지 않게 막는다
    event.preventDefault();
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.at = performance.now();
    drag.vel = 0;
    setCursor('grabbing');
  };
  const onDrag = (event) => {
    if (!drag.active) return;
    const now = performance.now();
    const gap = Math.max(0.001, (now - drag.at) / 1000);
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    // 얼음 폭만큼 끌면 반 바퀴 정도 돈다
    const turn = dx * (Math.PI / Math.max(160, bounds.width * 0.3));
    spin += turn;
    drag.vel += (turn / gap - drag.vel) * 0.4;
    tilt.x.x = THREE.MathUtils.clamp(tilt.x.x + dy * 0.004, -0.7, 0.7);
    tilt.x.v = 0;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.at = now;
  };
  const onUp = () => {
    if (!drag.active) return;
    drag.active = false;
    // 멈췄다가 놓으면 그 자리에 두고, 튕기듯 놓으면 그 속도로 던진다
    spinSpeed = performance.now() - drag.at > 90 ? 0 : THREE.MathUtils.clamp(drag.vel, -9, 9);
    setCursor(touching ? 'grab' : '');
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointermove', onDrag, { passive: true });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  document.documentElement.addEventListener('pointerleave', onLeave);

  const tick = (now) => {
    if (!live) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const reduced = reducedQuery.matches;
    const time = (now - started) / 1000;
    const exit = clamp01(getExit());

    // 등장: 김 속에서 떠오르듯 천천히 나타난다
    const entrance = initialEntrance && !reduced ? smoothstep((now - started - 250) / 1400, 0, 1) : 1;
    alpha = entrance;

    // ── 배치: 문구(왼쪽 위)와 계기판(오른쪽) 사이, 화면 가운데보다 조금 아래 ──
    const mobile = width <= 900;
    const targetHeight = mobile ? Math.min(height * 0.46, width * 0.8) : Math.min(height * 0.68, width * 0.4);
    const fit = targetHeight / SHAPE[1];
    const baseX = mobile ? 0 : -width * 0.07;
    const baseY = mobile ? -height * 0.04 : -height * 0.08;

    // ── 손자국 ──
    if (now - pointer.at > 60) {
      pointer.vx = damp(pointer.vx, 0, 10, dt);
      pointer.vy = damp(pointer.vy, 0, 10, dt);
    }
    const rubbing = pointer.inside && touching && !reduced && exit < 0.5;
    const speed = Math.hypot(pointer.vx, pointer.vy);
    if (rubbing) {
      trail.uniforms.uPoint.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
      trail.uniforms.uMove.value.set(
        THREE.MathUtils.clamp(pointer.vx * 0.9, -2, 2),
        THREE.MathUtils.clamp(-pointer.vy * 0.9, -2, 2),
      );
    } else {
      trail.uniforms.uPoint.value.set(-10, -10);
      trail.uniforms.uMove.value.set(0, 0);
    }
    trail.step(dt);

    // ── 움직임 ──
    const hold = 1 - exit;
    if (reduced) {
      group.rotation.set(...BASE_ROTATION);
    } else {
      if (!drag.active) spring(tilt.x, pointer.inside ? pointer.y * 0.22 * hold : 0, 24, 7.2, dt);
      spring(tilt.y, pointer.inside ? pointer.x * 0.32 * hold : 0, 24, 7.2, dt);
      if (rubbing) {
        tilt.y.v += THREE.MathUtils.clamp(pointer.vx, -6, 6) * 0.8 * dt;
        tilt.x.v += THREE.MathUtils.clamp(pointer.vy, -6, 6) * 0.6 * dt;
        tilt.z.v -= THREE.MathUtils.clamp(pointer.vx, -6, 6) * 0.22 * dt;
      }
      spring(tilt.z, 0, 20, 6.2, dt);
      if (!drag.active) {
        if (rubbing) spinSpeed += THREE.MathUtils.clamp(pointer.vx, -6, 6) * 0.6 * dt;
        spinSpeed = damp(spinSpeed, IDLE_SPIN, 0.7, dt);
        spin += spinSpeed * dt;
      }
      spring(drift.x, pointer.inside ? pointer.x * 16 : 0, 11, 5.2, dt);
      spring(drift.y, pointer.inside ? -pointer.y * 10 : 0, 11, 5.2, dt);
      // 떠 있는 물체의 느린 흔들림 — 주기가 다른 파동을 섞어 반복이 드러나지 않게
      const swayX = (Math.sin(time * 0.31) * 0.6 + Math.sin(time * 0.17 + 1.3) * 0.4) * 0.03;
      const swayY = (Math.sin(time * 0.23 + 0.4) * 0.6 + Math.sin(time * 0.13 + 2.1) * 0.4) * 0.05;
      group.rotation.x = BASE_ROTATION[0] + tilt.x.x + swayX;
      // 승화하는 동안에는 천천히 한 바퀴 돌아서며 풀린다
      group.rotation.y = BASE_ROTATION[1] + spin + tilt.y.x + swayY + smoothstep(exit, 0, 1) * 0.9;
      group.rotation.z = BASE_ROTATION[2] + tilt.z.x;
    }

    // 승화: 서리가 먼저 하얗게 오르고, 가장자리부터 김으로 풀린다
    const dissolve = smoothstep(exit, 0.08, 0.92);
    const rise = (1 - entrance) * 34 + exit * 46;
    const scale = fit * (0.94 + entrance * 0.06) * (1 + smoothstep(exit, 0, 1) * 0.32);
    group.scale.setScalar(scale);
    group.position.set(
      baseX + drift.x.x * hold,
      baseY - rise + (reduced ? 0 : Math.sin(time * 0.46) * 3.4 + drift.y.x * hold) + exit * 60,
      0,
    );
    material.attenuationDistance = ICE_ATTENUATION * scale;
    iceUniforms.uFrost.value = Math.min(1, FROST + smoothstep(exit, 0, 0.4) * 0.1);
    iceUniforms.uDissolve.value = dissolve;
    material.opacity = alpha;
    glow.material.opacity = alpha * 0.48 * (1 - dissolve);
    sparkles.material.opacity = alpha * (1 - dissolve) * (reduced ? 0.42 : 0.35 + Math.sin(now * 0.0032) * 0.22);
    interior.update(alpha * (1 - dissolve), time);

    smoke.group.position.copy(group.position);
    smoke.group.scale.setScalar(scale);
    // 스치면 몇 가닥, 문지르거나 잡고 돌리면 뭉게뭉게. 손을 떼면 서서히 잦아든다.
    const stirTarget = touching && exit < 0.3 ? clamp01(0.35 + speed * 0.45 + (drag.active ? 0.4 : 0)) : 0;
    stir = damp(stir, stirTarget, stirTarget > stir ? 5 : 1.8, dt);
    smoke.update(
      // 건드리는 동안엔 밑동 김도 더 빨리 흘러내린다
      reduced ? 0 : dt * (1 + exit * 2 + stir * 0.9),
      alpha * (1 - smoothstep(exit, 0.7, 1)),
      smoothstep(exit, 0, 0.7),
      reduced ? 0 : stir,
      touching ? stirPoint : null,
    );
    environment.update(reduced ? 0 : dt, time, pointer.inside ? pointer.x * 40 : 0);
    // 커서 쪽으로 시점이 아주 조금 따라가, 얼음과 먼 산 사이에 깊이가 생긴다
    if (!reduced) {
      camera.position.x = damp(camera.position.x, pointer.inside ? pointer.x * 60 : 0, 2.2, dt);
      camera.position.y = damp(camera.position.y, pointer.inside ? -pointer.y * 30 : 0, 2.2, dt);
      camera.lookAt(0, 0, 0);
    }

    // 마우스가 얼음 표면에 닿았는지 (다음 프레임의 손자국에 쓴다)
    touching = false;
    if (pointer.inside && !reduced) {
      group.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(ice, false)[0];
      touching = Boolean(hit);
      // 연기 그룹은 얼음 위치·크기만 따르고 회전은 안 하므로, 위치를 빼고 크기로 나누면 그 좌표가 된다
      if (hit) stirPoint.copy(hit.point).sub(group.position).divideScalar(Math.max(scale, 1e-6));
    }
    if (!drag.active) setCursor(touching && exit < 0.3 ? 'grab' : '');

    heat = damp(heat, clamp01((touching ? 0.25 : 0) + speed * 0.35), 3, dt);
    if (now - lastReadout > 140) {
      lastReadout = now;
      const activity = clamp01(Math.hypot(pointer.x, pointer.y) * 0.6 * (pointer.inside ? 1 : 0) + heat + exit);
      onReadout?.({
        mass: 100 - exit * 18.5,
        heat: activity,
        temp: activity > 0.16 ? 'RISING' : 'LOW',
        azimuth: Math.round(36 + (pointer.inside ? pointer.x : 0) * 42),
        lit: touching,
      });
    }

    group.visible = exit < 0.999;
    smoke.group.visible = group.visible;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);
  onReady?.(true);

  return {
    dispose() {
      live = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setCursor('');
      document.documentElement.removeEventListener('pointerleave', onLeave);
      geometry.dispose();
      material.dispose();
      glow.material.dispose();
      glowTexture.dispose();
      interior.dispose();
      sparkles.geometry.dispose();
      sparkles.material.dispose();
      smoke.dispose();
      smokeTexture.dispose();
      environment.dispose();
      trail.dispose();
      envTarget.texture.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
