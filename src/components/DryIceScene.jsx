import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function createCrystalGeometry() {
  const geometry = new THREE.IcosahedronGeometry(2, 2);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const grain = Math.sin(x * 3.7 + y * 2.2 - z * 4.1) * 0.095;
    const ridge = Math.sin((x - z) * 5.3) * 0.045;
    const scale = 1 + grain + ridge;

    position.setXYZ(
      i,
      x * scale * 1.22,
      y * scale * 0.76,
      z * scale * 0.72
    );
  }

  geometry.computeVertexNormals();
  geometry.rotateZ(-0.16);
  return geometry;
}

function createParticleGeometry(count = 180) {
  const points = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.399963;
    const radius = 2.15 + ((i * 17) % 23) / 23 * 0.52;
    points[i * 3] = Math.cos(angle) * radius * 1.05;
    points[i * 3 + 1] = (((i * 29) % count) / count - 0.5) * 3.5;
    points[i * 3 + 2] = Math.sin(angle) * radius * 0.72;
    seeds[i] = (i * 37) % 101;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.userData.seeds = seeds;
  geometry.userData.origin = points.slice();
  return geometry;
}

function createFrostTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const image = context.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const broad = Math.sin(x * 0.17) * 22 + Math.cos(y * 0.21) * 18;
      const grain = Math.sin(x * 2.13 + y * 1.71) * 26;
      const value = Math.max(40, Math.min(225, 132 + broad + grain));
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.2, 3.2);
  return texture;
}

export default function DryIceScene({ onState, initialEntrance = false, exitProgress = 0 }) {
  const hostRef = useRef(null);
  const exitRef = useRef(exitProgress);
  exitRef.current = exitProgress;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.76;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    scene.add(new THREE.HemisphereLight(0xdcecef, 0x090c0d, 0.68));
    const key = new THREE.DirectionalLight(0xe7f7ff, 1.65);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ea8b0, 1.25);
    rim.position.set(5, -1, -4);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const geometry = createCrystalGeometry();
    const frostTexture = createFrostTexture();
    const outerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x72858a,
      roughness: 0.54,
      metalness: 0.02,
      transmission: 0.055,
      thickness: 0.9,
      ior: 1.3,
      clearcoat: 0.16,
      clearcoatRoughness: 0.72,
      envMapIntensity: 0.5,
      bumpMap: frostTexture,
      bumpScale: 0.095,
      roughnessMap: frostTexture,
      transparent: true,
      opacity: initialEntrance ? 0 : 1,
      flatShading: true,
    });
    const outer = new THREE.Mesh(geometry, outerMaterial);
    group.add(outer);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x101516,
      roughness: 0.78,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      flatShading: true,
    });
    const core = new THREE.Mesh(geometry.clone(), coreMaterial);
    core.scale.setScalar(0.88);
    group.add(core);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 25),
      new THREE.LineBasicMaterial({ color: 0xc8dadd, transparent: true, opacity: 0.1 })
    );
    group.add(edges);

    const particleGeometry = createParticleGeometry();
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xc7dadd,
      size: 0.018,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    const pointer = { x: 0, y: 0, inside: false, speed: 0, lastX: 0, lastY: 0 };
    let reaction = 0;
    let lastHud = 0;
    let raf = 0;
    let baseScale = 0.7;
    let baseY = -0.4;
    const entranceStarted = performance.now();

    function resize() {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const mobile = width < 760;
      baseScale = mobile ? 0.58 : 0.7;
      baseY = mobile ? 0.35 : -0.4;
      group.position.set(mobile ? 0.15 : 1.55, baseY, 0);
      group.scale.setScalar(initialEntrance ? baseScale * 0.06 : baseScale);
    }

    function onPointerMove(event) {
      const rect = host.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      pointer.speed = pointer.speed * 0.72 + Math.hypot(x - pointer.lastX, y - pointer.lastY) * 0.28;
      pointer.x = x;
      pointer.y = y;
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.inside = true;
    }

    function onPointerLeave() {
      pointer.inside = false;
    }

    function animate(now) {
      const exit = exitRef.current;
      const target = pointer.inside
        ? clamp01(1 - Math.hypot(pointer.x - 0.42, pointer.y * 0.85) / 0.95)
        : 0;
      reaction += (target - reaction) * (target > reaction ? 0.045 : 0.022);
      pointer.speed *= 0.91;

      const rawEntrance = initialEntrance
        ? clamp01((now - entranceStarted - 1040) / 860)
        : 1;
      const entrance = 1 - Math.pow(1 - rawEntrance, 3);
      const entranceScale = baseScale * (0.06 + entrance * 0.94) * (1 - exit * 0.22);
      group.scale.setScalar(entranceScale);
      group.position.y = baseY + (1 - entrance) * 0.55 + exit * 0.14;
      outerMaterial.opacity = entrance * (1 - exit * 0.64);
      coreMaterial.opacity = entrance * 0.5 * (1 - exit * 0.72);
      edges.material.opacity = entrance * 0.1 * (1 - exit * 0.5);

      if (!reduced) {
        group.rotation.y += 0.0018 + reaction * 0.0022 + exit * 0.006;
        group.rotation.x += (pointer.y * 0.16 - group.rotation.x) * 0.018;
        group.rotation.z += (pointer.x * -0.08 - group.rotation.z) * 0.012;
      }

      const sublimation = Math.max(reaction, exit);
      outerMaterial.roughness = 0.54 + sublimation * 0.18;
      outerMaterial.transmission = 0.055 - sublimation * 0.025;
      particleMaterial.opacity = reduced ? 0 : sublimation * 0.76 * entrance;
      particleMaterial.size = 0.016 + sublimation * 0.021;

      if (!reduced) {
        const positions = particleGeometry.attributes.position;
        const origin = particleGeometry.userData.origin;
        const seeds = particleGeometry.userData.seeds;
        for (let i = 0; i < positions.count; i += 1) {
          const lift = sublimation * (0.06 + (seeds[i] % 13) * 0.008);
          positions.setXYZ(
            i,
            origin[i * 3] * (1 + exit * 0.24) + Math.sin(now * 0.0007 + seeds[i]) * sublimation * 0.055,
            origin[i * 3 + 1] * (1 + exit * 0.18) + lift + Math.cos(now * 0.00055 + seeds[i]) * sublimation * 0.065,
            origin[i * 3 + 2] * (1 + exit * 0.2)
          );
        }
        positions.needsUpdate = true;
      }

      if (onState && now - lastHud > 90) {
        const heat = clamp01(reaction * 0.78 + Math.min(0.22, pointer.speed * 1.8));
        onState({
          state: reaction > 0.08 ? 'SUBLIMATING' : 'SOLID',
          temp: heat > 0.62 ? 'HIGH' : heat > 0.24 ? 'MID' : 'LOW',
          tempValue: heat,
        });
        lastHud = now;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      core.geometry.dispose();
      outerMaterial.dispose();
      coreMaterial.dispose();
      edges.geometry.dispose();
      edges.material.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      frostTexture.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onState]);

  return <div ref={hostRef} className="dry-ice-scene" aria-hidden="true" />;
}
