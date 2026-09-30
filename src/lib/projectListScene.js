import * as THREE from 'three';
import { createHeroEnvironment } from './heroEnvironment';
import { createPreviewMaterials } from './projectPreviewMaterials';

/** A world-space image plane, not a CSS card/tilt simulation. */
export function createProjectListScene(host, preview, sources, onReady) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 10, 16000);
  const environment = createHeroEnvironment(scene);
  // Same snowfield geometry as MAIN, with a quieter surface so project images stay foreground.
  scene.traverse(object => {
    if (object.isMesh && object.geometry.attributes.position.count > 20000) {
      const compile = object.material.onBeforeCompile;
      object.material.onBeforeCompile = shader => {
        compile(shader);
        shader.fragmentShader = shader.fragmentShader.replace('glint * 0.18', 'glint * 0.025');
      };
    }
  });
  scene.add(new THREE.HemisphereLight(0xe1eaf0, 0x1a2329, 1.1));
  const light = new THREE.DirectionalLight(0xe6f2f3, 2.2);
  light.position.set(-400, 600, 850);
  scene.add(light);

  const group = new THREE.Group();
  scene.add(group);
  const plateGeometry = new THREE.PlaneGeometry(1, 1);
  const previewMaterials = createPreviewMaterials();
  const imageMaterial = previewMaterials.image;
  const plate = new THREE.Mesh(plateGeometry, imageMaterial);
  group.add(plate);
  const backingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const backingMaterial = new THREE.MeshStandardMaterial({ color: 0x334149, metalness: .5, roughness: .28, transparent: true, opacity: 0, depthWrite: false });
  const backing = new THREE.Mesh(backingGeometry, backingMaterial);
  backing.position.z = -3;
  group.add(backing);
  const outlineGeometry = new THREE.EdgesGeometry(plateGeometry);
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x99b9c4, transparent: true, opacity: .25, fog: false });
  const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
  outline.position.z = 1;
  group.add(outline);
  const smoke = new THREE.Mesh(plateGeometry, previewMaterials.smoke);
  smoke.position.z = 7;
  smoke.renderOrder = 2;
  group.add(smoke);

  const shardGeometry = new THREE.OctahedronGeometry(1, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({ color: 0xa5b9c5, roughness: .35, metalness: .2, transparent: true, opacity: .14, flatShading: true, depthWrite: false });
  const shards = Array.from({ length: 7 }, (_, i) => {
    const shard = new THREE.Mesh(shardGeometry, shardMaterial);
    shard.rotation.set(i * .83, i * 1.15, .3 + i * .74);
    scene.add(shard);
    return shard;
  });
  // Fine spatial construction lines recede into the snow, instead of a graphic decoration layer.
  const lineGeometry = new THREE.BufferGeometry();
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x99b2c0, transparent: true, opacity: .055 });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  const textures = [];
  const failedTextures = new Set();
  const loader = new THREE.TextureLoader();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0, width = 1, height = 1, frame = 0, disposed = false, paused = false, lost = false;
  let centerX = 0, centerY = 0, panelW = 1, panelH = 1, transition = 1;
  let presented = false, revealDuration = 2.4;
  let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0, last = performance.now(), elapsed = 0;

  function fitImage() {
    const texture = textures[active];
    const aspect = texture?.image ? texture.image.width / texture.image.height : 16 / 9;
    const w = Math.min(panelW, panelH * aspect);
    const h = w / aspect;
    plate.scale.set(w, h, 1);
    backing.scale.set(w + 2, h + 2, 4);
    outline.scale.set(w + 2, h + 2, 1);
    smoke.scale.set(w * 1.3, h * 1.65, 1);
    smoke.position.y = h * .06;
    previewMaterials.aspect.value = w / h;
  }
  function layout() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect();
    const target = preview.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
    centerX = target.left - bounds.left + target.width / 2 - width / 2;
    centerY = height / 2 - (target.top - bounds.top + target.height / 2);
    panelW = target.width; panelH = target.height;
    fitImage();
    environment.layout(camera, height);
    const placements = [[.08,.9,-300,90],[.53,.9,-380,130],[.62,.77,-470,80],[.64,.14,-250,110],[.22,.12,-180,65],[.97,.81,-520,150],[.48,.42,-800,170]];
    shards.forEach((shard, i) => {
      const [x,y,z,size] = placements[i];
      const perspective = (camera.position.z - z) / camera.position.z;
      shard.position.set((x - .5) * width * perspective, (y - .5) * height * perspective, z);
      shard.scale.setScalar(Math.min(size, width * .1) * perspective);
      shard.userData.y = shard.position.y;
    });
    const vertices = [];
    for (let i = 0; i < 8; i++) {
      vertices.push(width * (.15 + i * .08) - width / 2, -height * .7, 350,
        width * (.52 + i * .015) - width / 2, height * .25, -2300);
    }
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    lineGeometry.computeBoundingSphere();
    invalidate();
  }
  function render(now) {
    frame = 0;
    if (disposed || lost) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    const moving = !paused && !document.hidden && !reduced.matches;
    if (moving) {
      elapsed += dt;
      if (textures[active]) transition = Math.min(1, transition + dt / revealDuration);
      smoothX += (pointerX - smoothX) * (1 - Math.exp(-dt * 3));
      smoothY += (pointerY - smoothY) * (1 - Math.exp(-dt * 3));
      environment.update(dt, elapsed, smoothX * 7);
      shards.forEach((shard, i) => {
        shard.rotation.y += dt * (i % 2 ? -.045 : .035);
        shard.position.y = shard.userData.y + Math.sin(elapsed * .3 + i) * 8;
      });
    } else if (reduced.matches) { transition = 1; smoothX = 0; smoothY = 0; }
    const ease = 1 - Math.pow(1 - transition, 3);
    previewMaterials.reveal.value = transition;
    previewMaterials.time.value = elapsed;
    smoke.visible = Boolean(textures[active]) && transition < 1 && !reduced.matches;
    backingMaterial.opacity = THREE.MathUtils.smoothstep(transition, .5, .95);
    outlineMaterial.opacity = .25 * backingMaterial.opacity;
    if (transition >= 1 && textures[active]) presented = true;
    group.position.set(centerX + (1 - ease) * panelW * .01, centerY - (1 - ease) * 9, -(1 - ease) * 45);
    group.rotation.set(-smoothY * .04, .12 + smoothX * .075 + (1 - ease) * -.07, -.018);
    camera.position.x = smoothX * 15;
    camera.position.y = -smoothY * 10;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (moving) frame = requestAnimationFrame(render);
  }
  function invalidate() { if (!frame && !disposed && !lost) { last = performance.now(); frame = requestAnimationFrame(render); } }
  function setActive(index, immediate = false) {
    active = index;
    revealDuration = presented ? 1.65 : 2.4;
    transition = immediate || reduced.matches ? 1 : 0;
    previewMaterials.reveal.value = transition;
    imageMaterial.uniforms.uMap.value = textures[active] || null;
    plate.visible = Boolean(textures[active]);
    backing.visible = plate.visible; outline.visible = plate.visible;
    onReady(lost || failedTextures.has(active) ? 'fallback' : textures[active] ? 'spatial' : 'loading');
    fitImage(); invalidate();
  }
  sources.forEach((src, index) => {
    loader.load(src, texture => {
      if (disposed) { texture.dispose(); return; }
      // Keep more source detail on desktop; smaller mobile previews don't need a 4K upload.
      const textureLimit = window.innerWidth <= 700 ? 1536 : 3072;
      if (texture.image.width > textureLimit) {
        const canvas = document.createElement('canvas');
        canvas.width = textureLimit;
        canvas.height = Math.round(texture.image.height * textureLimit / texture.image.width);
        const context = canvas.getContext('2d');
        if (context) { context.drawImage(texture.image, 0, 0, canvas.width, canvas.height); texture.image = canvas; }
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures[index] = texture;
      if (index === active) setActive(active);
    }, undefined, () => {
      if (disposed) return;
      failedTextures.add(index);
      if (index === active) onReady('fallback');
    });
  });
  const observer = new ResizeObserver(layout);
  observer.observe(host); observer.observe(preview);
  const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else invalidate(); };
  const onLost = event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; onReady('fallback'); };
  const onRestored = () => { lost = false; setActive(active); layout(); };
  const onMotion = () => invalidate();
  const scrollParent = preview.closest('.project-list');
  scrollParent.addEventListener('scroll', layout, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onMotion);
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);
  layout();
  return {
    setActive,
    setPointer(x, y) { if (reduced.matches || paused) return; pointerX = x; pointerY = y; invalidate(); },
    setPaused(value) { paused = value; cancelAnimationFrame(frame); frame = 0; if (!paused) invalidate(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
      scrollParent.removeEventListener('scroll', layout);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      environment.dispose();
      [plateGeometry, backingGeometry, outlineGeometry, shardGeometry, lineGeometry].forEach(item => item.dispose());
      [imageMaterial, previewMaterials.smoke, backingMaterial, outlineMaterial, shardMaterial, lineMaterial].forEach(item => item.dispose());
      textures.forEach(texture => texture?.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
