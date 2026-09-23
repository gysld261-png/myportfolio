import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createColdFog, createFogVeil, createIceGeometry, createIceMaterial, createStudio, createVapor, paintBackdrop } from '../lib/iceCubeScene';

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const REST_Z = 9.4;        // 쉬는 자리의 카메라 거리
const NEAR_Z = 2.35;       // 승화 끝의 카메라 거리 (큐브 크기 배수) — 앞면 바로 앞
const VEIL_DISTANCE = 0.5; // 연기 막이 카메라 앞에 떠 있는 거리

/** A real mesh with studio reflections and typography inside the refraction pass. */
export default function IceCubeHero({ onReadout, onReady, initialEntrance = false, exitProgress = 0 }) {
  const hostRef = useRef(null);
  const exitRef = useRef(exitProgress);
  const entranceRef = useRef(initialEntrance);
  exitRef.current = exitProgress;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      onReady?.(false);
      return undefined;
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x0b0d0e, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.z = REST_Z;
    // 카메라에 붙은 연기 막 — 얼음에 다가갈수록 짙어져 결국 시야를 덮는다
    const veil = createFogVeil();
    veil.position.z = -VEIL_DISTANCE;
    camera.add(veil);
    let studio = createStudio(renderer);
    scene.environment = studio.texture;
    scene.add(new THREE.HemisphereLight(0xdcebf0, 0x24282a, 0.35));
    const rim = new THREE.DirectionalLight(0xe0eff3, 2.3);
    rim.position.set(-3, 5, 4);
    scene.add(rim);

    const backdropCanvas = document.createElement('canvas');
    const backdropTexture = new THREE.CanvasTexture(backdropCanvas);
    backdropTexture.colorSpace = THREE.SRGBColorSpace;
    backdropTexture.minFilter = THREE.LinearFilter;
    backdropTexture.generateMipmaps = false;
    const backdropMaterial = new THREE.MeshBasicMaterial({ map: backdropTexture, toneMapped: false });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMaterial);
    backdrop.position.z = -3.2;
    scene.add(backdrop);

    const iceUniforms = { uHeat: { value: 0 }, uHeatPoint: { value: new THREE.Vector3(0, 0, 1.18) } };
    const geometry = createIceGeometry();
    const material = createIceMaterial(iceUniforms);
    const cube = new THREE.Mesh(geometry, material);
    const sculpture = new THREE.Group();
    sculpture.add(cube);
    scene.add(sculpture);
    scene.add(camera);
    const vapor = createVapor();
    sculpture.add(vapor);
    // 냉기는 큐브 회전을 따라 돌지 않는다 — 월드 공간에서 아래로 흐른다
    const coldFog = createColdFog(coarsePointer.matches ? 110 : 180);
    scene.add(coldFog);

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const hitPoint = new THREE.Vector3();
    const hits = [];
    const pointer = { x: 0, y: 0, active: false, dragging: false, downX: 0, drag: 0, startDrag: 0 };
    const base = { x: 0, y: 0, scale: 1 };
    let live = true, ready = false, raf = 0, previousTime = 0, elapsed = 0, heat = 0;
    let lastReadout = 0, needsFrame = true, resizeFrame = 0;

    const paint = () => {
      if (!live || !host.clientWidth || !host.clientHeight) return;
      // A WebGL texture cannot change dimensions after its first upload.
      // Reallocate its GPU storage when the responsive canvas is repainted.
      backdropTexture.dispose();
      paintBackdrop(backdropCanvas, host);
      backdropTexture.needsUpdate = true;
      needsFrame = true;
    };
    const resize = () => {
      if (!live) return;
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      const mobile = width < 760;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.6);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      renderer.transmissionResolutionScale = mobile ? 0.65 : 0.85;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // 배치는 항상 쉬는 자리(REST_Z) 기준 — 스크롤 중 카메라가 다가가도 레이아웃은 그대로다
      const viewSlope = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const worldHeight = viewSlope * REST_Z;
      const worldWidth = worldHeight * camera.aspect;
      const backdropHeight = worldHeight * ((REST_Z - backdrop.position.z) / REST_Z);
      veil.scale.set(viewSlope * VEIL_DISTANCE * camera.aspect * 1.02, viewSlope * VEIL_DISTANCE * 1.02, 1);
      veil.material.uniforms.uAspect.value = camera.aspect;
      backdrop.scale.set(backdropHeight * camera.aspect, backdropHeight, 1);
      // 헤드라인 뒷부분에 걸쳐 놓는다 — 투명한 얼음은 뒤에 비칠 글자가 있어야 얼음으로 읽힌다.
      base.x = worldWidth * (mobile ? 0.07 : -0.03);
      base.y = worldHeight * (mobile ? -0.085 : 0.1);
      base.scale = mobile ? Math.min(0.72, worldWidth / 4.4) : Math.min(1.14, worldHeight / 4.9);
      vapor.material.uniforms.uPixelRatio.value = dpr;
      coldFog.material.uniforms.uPixelRatio.value = dpr;
      paint();
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    observer.observe(host);

    const updatePointer = (event) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.active = true;
      if (pointer.dragging) pointer.drag = THREE.MathUtils.clamp(pointer.startDrag + (event.clientX - pointer.downX) * 0.004, -0.65, 0.65);
      needsFrame = true;
    };
    const onPointerDown = (event) => {
      updatePointer(event);
      pointer.downX = event.clientX;
      pointer.startDrag = pointer.drag;
      pointer.dragging = true;
      host.setPointerCapture(event.pointerId);
    };
    const onPointerUp = (event) => {
      pointer.dragging = false;
      if (event.pointerType !== 'mouse') pointer.active = false;
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    };
    const onPointerLeave = () => {
      pointer.active = false;
      pointer.dragging = false;
      needsFrame = true;
    };

    const animate = (now) => {
      if (!live || document.hidden || renderer.getContext().isContextLost()) return;
      const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
      previousTime = now;
      elapsed += dt;
      const reduced = motion.matches;
      const exit = clamp01(exitRef.current);
      backdropMaterial.color.setScalar(Math.max(0, 1 - exit / 0.42));
      const entrance = entranceRef.current && !reduced ? THREE.MathUtils.smoothstep(elapsed, 0.75, 1.8) : 1;
      const tiltX = pointer.active && !reduced ? -pointer.y * 0.10 : 0;
      const tiltY = pointer.active && !reduced ? pointer.x * 0.17 : 0;
      if (!pointer.dragging) pointer.drag = THREE.MathUtils.damp(pointer.drag, 0, 3.4, dt);
      sculpture.rotation.x = THREE.MathUtils.damp(sculpture.rotation.x, 0.27 + tiltX, 4, dt);
      sculpture.rotation.y = THREE.MathUtils.damp(sculpture.rotation.y, -0.48 + tiltY + (reduced ? 0 : pointer.drag) + exit * 0.45, 4, dt);
      sculpture.rotation.z = THREE.MathUtils.damp(sculpture.rotation.z, -0.11 + (pointer.active && !reduced ? pointer.x * 0.025 : 0), 4, dt);
      if (reduced) sculpture.rotation.set(0.27, -0.48, -0.11);
      sculpture.position.set(base.x, base.y + (1 - entrance) * -0.3, 0);
      sculpture.scale.setScalar(base.scale * (0.91 + entrance * 0.09));
      sculpture.updateMatrixWorld(true);

      // 스크롤 = 얼음 속으로 들어가는 카메라.
      // 먼저 얼음을 화면 가운데로 맞추고, 그다음 앞면에 거의 닿을 때까지 다가간다.
      // 모션 축소 환경에서는 움직이지 않고 연기만 차오른다.
      const approachT = reduced ? 0 : THREE.MathUtils.smootherstep(exit, 0, 1);
      const centerT = reduced ? 0 : THREE.MathUtils.smoothstep(exit, 0, 0.55);
      camera.position.set(base.x * centerT, base.y * centerT, THREE.MathUtils.lerp(REST_Z, NEAR_Z * base.scale, approachT));
      camera.updateMatrixWorld(true);
      // 연기 막: 처음엔 가장자리부터 옅게, 끝에서는 화면 전체를 덮는다
      const veilUniforms = veil.material.uniforms;
      veilUniforms.uTime.value = elapsed;
      veilUniforms.uAmount.value = THREE.MathUtils.smoothstep(exit, 0.12, 1);
      veil.visible = exit > 0.005;

      let hovered = false;
      if (pointer.active && !reduced) {
        pointerNdc.set(pointer.x, pointer.y);
        raycaster.setFromCamera(pointerNdc, camera);
        hits.length = 0;
        raycaster.intersectObject(cube, false, hits);
        if (hits.length) {
          hovered = true;
          hitPoint.copy(hits[0].point);
          cube.worldToLocal(hitPoint);
          iceUniforms.uHeatPoint.value.lerp(hitPoint, 1 - Math.exp(-8 * dt));
        }
      }
      heat = THREE.MathUtils.damp(heat, hovered ? 1 : 0, hovered ? 3.5 : 1.6, dt);
      iceUniforms.uHeat.value = reduced ? 0 : heat;
      vapor.visible = !reduced && heat > 0.01 && !coarsePointer.matches;
      vapor.material.uniforms.uTime.value = elapsed;
      vapor.material.uniforms.uHeat.value = heat;
      vapor.material.uniforms.uHeatPoint.value.copy(iceUniforms.uHeatPoint.value);
      const fogUniforms = coldFog.material.uniforms;
      // 모션 축소 환경에서는 흐름을 멈춘 한 장면으로 남긴다
      fogUniforms.uTime.value = reduced ? 6 : elapsed + 12;
      fogUniforms.uOrigin.value.copy(sculpture.position);
      fogUniforms.uScale.value = sculpture.scale.x;
      // 열을 받거나 승화(스크롤)가 진행될수록 더 많이 쏟아진다
      fogUniforms.uAmount.value = (1 + heat * 0.6 + exit * 1.8) * Math.max(0, 1 - exit / 0.9);
      host.dataset.hovered = hovered ? 'true' : 'false';
      if (now - lastReadout > 140) {
        lastReadout = now;
        onReadout?.({
          mass: 100 * (1 - exit),
          heat,
          temp: heat > 0.6 ? 'MID' : 'LOW',
          azimuth: Math.round(THREE.MathUtils.radToDeg(sculpture.rotation.y)),
          lit: heat > 0.16,
        });
      }
      if (!reduced || needsFrame || exit > 0 || !ready) {
        renderer.render(scene, camera);
        needsFrame = false;
      }
      if (!ready) { ready = true; onReady?.(true); }
      raf = requestAnimationFrame(animate);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      previousTime = 0;
      if (!document.hidden) raf = requestAnimationFrame(animate);
    };
    const onMotionChange = () => { needsFrame = true; };
    const onContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      host.classList.add('ice-cube-hero--unavailable');
      onReady?.(false);
    };
    const onContextRestored = () => {
      studio.dispose();
      studio = createStudio(renderer);
      scene.environment = studio.texture;
      paint();
      host.classList.remove('ice-cube-hero--unavailable');
      ready = false;
      needsFrame = true;
      previousTime = 0;
      raf = requestAnimationFrame(animate);
    };

    sculpture.rotation.set(0.27, -0.48, -0.11);
    resize();
    document.fonts.ready.then(() => { if (live) paint(); });
    document.fonts.addEventListener('loadingdone', paint);
    host.addEventListener('pointermove', updatePointer);
    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointercancel', onPointerLeave);
    host.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener('change', onMotionChange);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
    raf = requestAnimationFrame(animate);

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', paint);
      host.removeEventListener('pointermove', updatePointer);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerLeave);
      host.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      motion.removeEventListener('change', onMotionChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      geometry.dispose(); material.dispose();
      vapor.geometry.dispose(); vapor.material.dispose();
      coldFog.geometry.dispose(); coldFog.material.dispose();
      veil.geometry.dispose(); veil.material.dispose();
      backdrop.geometry.dispose(); backdropMaterial.dispose(); backdropTexture.dispose();
      studio.dispose(); renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onReady, onReadout]);

  return <div ref={hostRef} className="ice-cube-hero" aria-hidden="true" />;
}
