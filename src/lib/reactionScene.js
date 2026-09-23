import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { CHAMBER, reactionAt } from './reactionTimeline';
export { REACTION_COVER, REACTION_END, reactionAt } from './reactionTimeline';

// Kept as the lazy-module warm-up interface. This scene loads no photographs.
export const prepareReactionAssets = () => Promise.resolve();

const noiseGLSL = `
float hash31(vec3 p) {
  p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),
    mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
    mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float cloud(vec3 p) { return noise3(p)*.58+noise3(p*2.07)*.28+noise3(p*4.13)*.14; }
`;

function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#111416');
  const cards = [
    [-3.8, 2.2, 3.2, 1.25, 6.5, 4.2],
    [3.5, 1.8, 1.8, .45, 5.8, 3.0],
    [1, 5.5, -2, 4.0, 2.3, 2.8],
    [-2.2, 1.0, -4, 1.8, 4.8, 2.0],
    [2.8, .1, -2.5, .35, 3, 1.7],
    [0, 1.5, 5, 5.5, 5.5, .55],
  ];
  for (const [x,y,z,w,h,power] of cards) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color:new THREE.Color(power,power*.99,power*.97)}));
    card.position.set(x,y,z); card.lookAt(0,1.5,0); studio.add(card);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(studio, .025, .1, 40);
  generator.dispose();
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  return target;
}

// One closed cross-section: outside wall, rolled lip, inside wall and thick foot.
// Unlike a cylinder with an opaque lid, the cup really is open and hollow.
export function createGlassGeometry() {
  const profile = [
    [0,.04],[.78,.04],[.88,.043],[.924,.061],[.953,.097],[.963,.15],
    [.967,.25],[.974,.6],[.986,1.25],[1.0,1.95],[1.014,2.50],
    [1.015,2.535],[1.012,2.550],[1.004,2.560],[.993,2.564],
    [.982,2.560],[.975,2.550],[.973,2.535],[.972,2.50],
    [.958,1.95],[.944,1.25],[.932,.6],[.928,.32],
    [.924,.27],[.910,.246],[.884,.232],[.83,.23],[0,.23],
  ].map(p=>new THREE.Vector2(...p));
  return new THREE.LatheGeometry(profile, 128);
}

export function createShardGeometry() {
  const points=[];
  // Asymmetric rings give the tall specimen genuine depth and chipped facets.
  const rings=[[-.49,.17,.15,.025],[-.40,.265,.215,.015],[-.12,.28,.235,-.015],[.22,.25,.225,.025],[.43,.21,.185,.02],[.49,.125,.12,.035]];
  rings.forEach(([y,rx,rz,shift],ring)=>{
    for(let j=0;j<7;j++) {
      const a=j/7*Math.PI*2+ring*.115;
      const uneven=1+Math.sin(j*5.71+ring*2.9)*.09;
      points.push(new THREE.Vector3(Math.cos(a)*rx*uneven+shift,y,Math.sin(a)*rz*uneven));
    }
  });
  return new ConvexGeometry(points);
}

function frostMaterial() {
  const material=new THREE.MeshPhysicalMaterial({color:'#f1f7f5',emissive:'#a5bdbb',emissiveIntensity:.13,roughness:.28,metalness:0,clearcoat:.24,clearcoatRoughness:.24,envMapIntensity:.7});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vIceLocal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvIceLocal=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vIceLocal;\n${noiseGLSL}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float frost=cloud(vIceLocal*19.);
        float grain=noise3(vIceLocal*190.);
        diffuseColor.rgb*=.82+.16*frost+.05*grain;`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=.17+.28*frost;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 grainSlope=vec3(dFdx(grain),dFdy(grain),0.);
        normal=normalize(normal+grainSlope*.12);`);
  };
  return material;
}

function makeMist() {
  const uniforms={uTime:{value:0},uAmount:{value:0},uCamera:{value:new THREE.Vector3()}};
  const material=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,depthTest:false,side:THREE.BackSide,
    vertexShader:`varying vec3 vWorld;
      void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`precision highp float; varying vec3 vWorld;
      uniform vec3 uCamera; uniform float uTime,uAmount;
      ${noiseGLSL}
      void main(){
        vec3 rd=normalize(vWorld-uCamera);
        vec3 lo=vec3(-2.8,.30,-2.8), hi=vec3(2.8,4.20,2.8);
        vec3 inv=1./(rd+vec3(.00001));
        vec3 t0=(lo-uCamera)*inv, t1=(hi-uCamera)*inv;
        vec3 a=min(t0,t1), b=max(t0,t1);
        float nearT=max(max(a.x,a.y),a.z), farT=min(min(b.x,b.y),b.z);
        nearT=max(nearT,0.);
        if(farT<=nearT||uAmount<.001)discard;
        float stepSize=(farT-nearT)/24.;
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        float opacity=0.; vec3 color=vec3(0.);
        for(int i=0;i<24;i++){
          vec3 p=uCamera+rd*(nearT+(float(i)+jitter)*stepSize);
          float r=length(p.xz);
          float extent=.68+uAmount*1.85;
          float edge=1.-smoothstep(extent*.50,extent,r);
          float crest=2.06+uAmount*.66;
          float drift=cloud(p*2.2+vec3(uTime*.13,-uTime*.24,uTime*.08));
          float h=.20+uAmount*.88;
          float layer=exp(-pow((p.y-crest+(drift-.5)*.8)/h,2.));
          float spill=smoothstep(.85,1.17,r)*exp(-pow((p.y-(2.0-uAmount*.6))/.60,2.))*.36;
          float density=max(0.,cloud(p*3.8-vec3(uTime*.11,uTime*.22,0.))-.30);
          float boundary=smoothstep(.30,.70,p.y)*(1.-smoothstep(3.35,4.20,p.y));
          boundary*=(1.-smoothstep(2.2,2.8,abs(p.x)))*(1.-smoothstep(2.2,2.8,abs(p.z)));
          density*=edge*(layer+spill)*uAmount*2.25*boundary;
          float alpha=1.-exp(-density*stepSize*2.0);
          vec3 light=mix(vec3(.42,.46,.47),vec3(.83,.86,.85),clamp((p.y-1.25)*.62,0.,1.));
          color+=(1.-opacity)*alpha*light;opacity+=(1.-opacity)*alpha;
          if(opacity>.98)break;
        }
        gl_FragColor=vec4(color/max(opacity,.0001),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(5.6,3.9,5.6),material);
  mesh.position.y=2.25;mesh.renderOrder=30;mesh.frustumCulled=false;
  return {mesh,uniforms};
}

export function createReactionScene(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.transmissionResolutionScale=.75;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#0b0e10');
  scene.fog=new THREE.FogExp2('#0b0e10',.065);
  const camera=new THREE.PerspectiveCamera(34,1,.1,60);
  camera.position.set(4.05,3.75,10.2);
  const controls=new OrbitControls(camera,canvas);
  controls.target.set(0,1.85,0);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.rotateSpeed=.65;
  controls.enablePan=false;controls.enableZoom=false;
  controls.minPolarAngle=.57;controls.maxPolarAngle=1.53;
  controls.update();controls.saveState();
  const environment=studioEnvironment(renderer);scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight('#edf4f3','#15181b',1.35));
  const key=new THREE.DirectionalLight('#f6f3ed',2.5);key.position.set(-3,6,4);scene.add(key);
  const fill=new THREE.DirectionalLight('#bdcdd3',.8);fill.position.set(4,2,-3);scene.add(fill);

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#080c0f',roughness:.65,metalness:0,envMapIntensity:.14}));
  ground.rotation.x=-Math.PI/2;ground.position.y=.025;scene.add(ground);
  // Analytic contact shading is fixed to the real floor, so it stays under the cup when orbiting.
  const shadowMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;void main(){float r=length((vUv-.5)*2.);gl_FragColor=vec4(0.,0.,0.,exp(-r*r*6.)*.72*(1.-smoothstep(.65,1.,r)));}',
  });
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.6,4.6),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.031;scene.add(shadow);

  // Capture the complete contents before drawing the outer glass. This avoids
  // Three's single transmission buffer making nested glass/water/ice disappear.
  const contents=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearMipmapLinearFilter,generateMipmaps:true});
  const glassMaterial=new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:.035,transmission:1,thickness:.065,ior:1.46,envMapIntensity:1.0});
  glassMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uChamberMap={value:contents.texture};
    shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_pars_fragment>',
      THREE.ShaderChunk.transmission_pars_fragment.replaceAll('transmissionSamplerMap','uChamberMap'));
  };
  const glass=new THREE.Mesh(createGlassGeometry(),glassMaterial);glass.renderOrder=10;scene.add(glass);

  const waterMaterial=new THREE.MeshPhysicalMaterial({color:'#eaf1ee',roughness:.055,metalness:0,transmission:.98,thickness:1.4,ior:1.333,attenuationColor:'#b8ced0',attenuationDistance:8,envMapIntensity:.62,side:THREE.DoubleSide});
  const waterGeometry=new THREE.CylinderGeometry(.952,.918,CHAMBER.water-CHAMBER.floor,96,1,true);
  const water=new THREE.Mesh(waterGeometry,waterMaterial);water.position.y=(CHAMBER.water+CHAMBER.floor)/2;water.renderOrder=2;scene.add(water);
  const surfaceGeometry=new THREE.RingGeometry(0,.951,96,20);surfaceGeometry.rotateX(-Math.PI/2);
  // A thin interface blends with the volume below it. Giving this open surface
  // the full cylinder's transmission thickness creates an opaque-looking disc.
  const surfaceMaterial=new THREE.MeshPhysicalMaterial({color:'#9badad',roughness:.075,metalness:.12,transparent:true,opacity:.10,depthWrite:false,envMapIntensity:.24,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(surfaceGeometry,surfaceMaterial);surface.position.y=CHAMBER.water;surface.renderOrder=3;scene.add(surface);
  const meniscus=new THREE.Mesh(new THREE.TorusGeometry(.949,.008,6,96),waterMaterial);meniscus.rotation.x=Math.PI/2;meniscus.position.y=CHAMBER.water;scene.add(meniscus);

  const shardGeometry=createShardGeometry();
  const ice=new THREE.Group();
  const coreGeometry=shardGeometry.clone();
  const frostPositions=coreGeometry.attributes.position;
  for(let i=0;i<frostPositions.count;i++) {
    const x=frostPositions.getX(i),y=frostPositions.getY(i),z=frostPositions.getZ(i);
    const irregular=1+Math.sin(y*18+x*12)*Math.cos(z*17-y*11)*.15;
    frostPositions.setXYZ(i,x*irregular,y,z*irregular);
  }
  coreGeometry.computeVertexNormals();
  const core=new THREE.Mesh(coreGeometry,frostMaterial());core.scale.set(.69,.82,.67);ice.add(core);
  const shell=new THREE.Mesh(shardGeometry,new THREE.MeshPhysicalMaterial({color:'#f3f7f5',roughness:.075,transmission:.93,thickness:.20,ior:1.31,envMapIntensity:1.15,clearcoat:.28,clearcoatRoughness:.16}));
  shell.renderOrder=1;ice.add(shell);ice.position.set(.025,CHAMBER.idleY,0);ice.rotation.set(.035,.34,-.075);scene.add(ice);

  const rippleMaterial=new THREE.MeshPhysicalMaterial({color:'#d3e3df',roughness:.12,metalness:.2,transparent:true,opacity:0,depthWrite:false,envMapIntensity:.9});
  const ripples=[];
  for(let i=0;i<3;i++) {
    const ripple=new THREE.Mesh(new THREE.TorusGeometry(1,.0045,5,96),rippleMaterial.clone());
    ripple.rotation.x=-Math.PI/2;ripple.position.y=CHAMBER.water+.006+i*.002;ripple.renderOrder=6;scene.add(ripple);ripples.push(ripple);
  }
  rippleMaterial.dispose();
  const bubbleMaterial=new THREE.MeshPhysicalMaterial({color:'#c5d9d8',roughness:.04,metalness:.35,transparent:true,opacity:.48,depthWrite:false,envMapIntensity:1.2});
  const bubbles=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,7),bubbleMaterial,42);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bubbles.renderOrder=5;scene.add(bubbles);
  const dummy=new THREE.Object3D();
  const mist=makeMist();scene.add(mist.mesh);
  let width=1,height=1,playing=false,diveStart=null,disposed=false;
  const resize=()=>{
    width=canvas.clientWidth||innerWidth;height=canvas.clientHeight||innerHeight;
    renderer.setSize(width,height,false);contents.setSize(Math.round(width*Math.min(devicePixelRatio||1,1.25)),Math.round(height*Math.min(devicePixelRatio||1,1.25)));
    camera.aspect=width/height;camera.fov=width/height<.8?43:34;camera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const onContextLost=e=>{e.preventDefault();canvas.dispatchEvent(new CustomEvent('reaction-unavailable'));};
  canvas.addEventListener('webglcontextlost',onContextLost);
  const onStart=()=>{canvas.dataset.dragging='true';};
  const onEnd=()=>{canvas.dataset.dragging='false';};
  controls.addEventListener('start',onStart);controls.addEventListener('end',onEnd);

  return {
    resetView(){if(!playing){controls.reset();}},
    rotate(direction){
      if(playing)return;
      const offset=camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0,1,0),direction*Math.PI/8);
      camera.position.copy(controls.target).add(offset);controls.update();
    },
    render(time,delta=.016,clock=0){
      if(disposed)return;
      playing=time!==null;
      const s=reactionAt(time);
      controls.enabled=!playing||s.dive===0;
      controls.update(Math.min(delta,.05));
      ice.position.y=s.y+(playing?0:Math.sin(clock*.85)*.017);
      ice.rotation.y=.34+s.fall*.12;ice.rotation.z=-.075+s.fall*.065;
      ice.rotation.x=.035;
      ripples.forEach((r,i)=>{
        const age=s.age-i*.13;
        const radius=.09+Math.max(0,age)*1.22;
        r.visible=playing&&age>0&&radius<.94;
        r.scale.setScalar(radius);r.material.opacity=s.ripple*.27*(1-radius/.97);
      });
      const vertices=surfaceGeometry.attributes.position;
      for(let i=0;i<vertices.count;i++) {
        const x=vertices.getX(i),z=vertices.getZ(i),r=Math.hypot(x,z);
        const edge=Math.max(0,1-Math.pow(r/.951,6));
        const idleWave=(Math.sin(x*14+clock*.35)*Math.cos(z*17-clock*.23)+Math.sin(z*23+x*13+clock*.19)*.4)*.0013;
        const impactWave=playing?Math.sin(r*22-s.age*15)*s.ripple*.012*Math.exp(-Math.pow((r-s.age*.9)/.24,2)):0;
        vertices.setY(i,(idleWave+impactWave)*edge);
      }
      vertices.needsUpdate=true;surfaceGeometry.computeVertexNormals();
      bubbles.visible=playing&&s.age>0;
      for(let i=0;i<42;i++) {
        const seed=(i*.61803398875)%1,phase=(s.age*(.85+seed*.55)+seed)%1;
        const born=s.age>seed*.5;
        const sourceY=Math.min(ice.position.y,CHAMBER.water-.025);
        const radius=.065+seed*.25,a=i*2.399+s.age*.2;
        const y=sourceY+phase*(CHAMBER.water-sourceY);
        dummy.position.set(Math.cos(a)*radius,y,Math.sin(a)*radius);
        const size=born?( .008+((i*7)%11)/11*.017)*Math.sin(phase*Math.PI):0;
        dummy.scale.set(size,size*1.12,size);dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate=true;
      mist.mesh.visible=s.fog>0;mist.uniforms.uAmount.value=s.fog;mist.uniforms.uTime.value=time||0;
      if(s.dive>0) {
        if(!diveStart)diveStart=camera.position.clone().sub(controls.target);
        camera.position.copy(controls.target).addScaledVector(diveStart,1-s.dive*.53);
        camera.lookAt(controls.target);
      } else diveStart=null;
      mist.uniforms.uCamera.value.copy(camera.position);
      if(import.meta.env.DEV){
        canvas.dataset.azimuth=controls.getAzimuthalAngle().toFixed(3);
        canvas.dataset.polar=controls.getPolarAngle().toFixed(3);
        canvas.dataset.iceY=ice.position.y.toFixed(3);
        canvas.dataset.renderer='three-webgl';
      }
      glass.visible=false;mist.mesh.visible=false;
      renderer.setRenderTarget(contents);renderer.toneMapping=THREE.NoToneMapping;renderer.render(scene,camera);
      glass.visible=true;mist.mesh.visible=s.fog>0;
      renderer.setRenderTarget(null);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.render(scene,camera);
    },
    destroy(){
      disposed=true;observer.disconnect();controls.dispose();
      canvas.removeEventListener('webglcontextlost',onContextLost);
      const geometries=new Set(),materials=new Set();
      scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
      contents.dispose();environment.dispose();renderer.dispose();
    },
  };
}
