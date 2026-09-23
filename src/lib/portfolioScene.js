import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENTRY,entryAt,mix } from './portfolioMotion';
import { createWaterSurface,createFieldMist } from './portfolioAtmosphere';

function createEnvironment(renderer){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#1a2125');
  for(const [x,y,z,w,h,power] of [[-4,4,5,2,7,3],[5,1,2,.8,6,2.5],[0,5,-3,5,2,2],[-3,-2,2,4,.5,1.3]]){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(power*.95,power,power*1.03)}));
    mesh.position.set(x,y,z);mesh.lookAt(0,0,0);scene.add(mesh);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(scene,.025,.1,35);
  pmrem.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return environment;
}

export function createSpecimenGeometry(spec,polygons=spec.polys){
  const [w,h]=spec.vb;
  const depth=spec.id==='tchaikim'?.32:spec.id==='nuri'?.25:.14;
  return polygons.map(poly=>{
    const shape=new THREE.Shape(poly.map(([x,y])=>new THREE.Vector2(x/w-.5,(h/2-y)/w)));
    const uv={
      generateTopUV(geometry,vertices,a,b,c){return [a,b,c].map(i=>new THREE.Vector2(vertices[i*3]+.5,(vertices[i*3+1]+h/w/2)/(h/w)));},
      generateSideWallUV(geometry,vertices,a,b,c,d){return [a,b,c,d].map(i=>new THREE.Vector2(vertices[i*3]+.5,(vertices[i*3+1]+h/w/2)/(h/w)));},
    };
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.005,bevelSize:.001,bevelSegments:3,curveSegments:1,UVGenerator:uv});
    geometry.translate(0,0,-depth/2);geometry.deleteAttribute('normal');
    const rounded=mergeVertices(geometry,1e-5);rounded.computeVertexNormals();rounded.computeBoundingBox();geometry.dispose();return rounded;
  });
}

// Trace the existing cutout's actual silhouette, rather than outlining the
// approximate interaction polygon. That keeps a dark gap out of the bevel.
function traceSilhouette(image,spec){
  const rect=spec.imageRect||[0,0,1,1],ratio=spec.vb[1]/spec.vb[0];
  const w=Math.round(512/Math.max(1,ratio)),h=Math.round(w*ratio);
  const sample=document.createElement('canvas');sample.width=w;sample.height=h;
  const ctx=sample.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,rect[0]*image.width,rect[1]*image.height,rect[2]*image.width,rect[3]*image.height,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);
  for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4+3]>150&&Math.max(pixels[i*4],pixels[i*4+1],pixels[i*4+2])>52?1:0;
  const on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  const edges=new Map(),stride=w+1;
  const edge=(x,y,xx,yy)=>{const key=y*stride+x,list=edges.get(key)||[];list.push(yy*stride+xx);edges.set(key,list);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(on(x,y)){
    if(!on(x,y-1))edge(x,y,x+1,y);
    if(!on(x+1,y))edge(x+1,y,x+1,y+1);
    if(!on(x,y+1))edge(x+1,y+1,x,y+1);
    if(!on(x-1,y))edge(x,y+1,x,y);
  }
  const loops=[];
  while(edges.size){
    const start=edges.keys().next().value,path=[];let cursor=start,guard=0;
    do{
      path.push([cursor%stride,Math.floor(cursor/stride)]);
      const list=edges.get(cursor);if(!list?.length)break;
      const next=list.pop();if(!list.length)edges.delete(cursor);cursor=next;
    }while(cursor!==start&&guard++<w*h*4);
    if(path.length<16)continue;
    let area=0;path.forEach(([x,y],i)=>{const q=path[(i+1)%path.length];area+=x*q[1]-q[0]*y;});
    if(area>40)loops.push({area,path});
  }
  function simplify(points,epsilon){
    if(points.length<3)return points;
    const a=points[0],b=points[points.length-1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    let far=0,index=0;
    for(let i=1;i<points.length-1;i++){
      const d=Math.abs(dy*points[i][0]-dx*points[i][1]+b[0]*a[1]-b[1]*a[0])/len;
      if(d>far){far=d;index=i;}
    }
    if(far<=epsilon)return[a,b];
    return simplify(points.slice(0,index+1),epsilon).slice(0,-1).concat(simplify(points.slice(index),epsilon));
  }
  return loops.sort((a,b)=>b.area-a.area).slice(0,spec.polys.length).map(({path})=>{
    let split=1,distance=0;path.forEach((p,i)=>{const d=Math.hypot(p[0]-path[0][0],p[1]-path[0][1]);if(d>distance){distance=d;split=i;}});
    const simple=simplify(path.slice(0,split+1),1.8).slice(0,-1).concat(simplify(path.slice(split).concat([path[0]]),1.8).slice(0,-1));
    return simple.map(([x,y])=>[x/w*spec.vb[0],y/h*spec.vb[1]]);
  });
}

export function createPortfolioScene(canvas,{items,onSelect,onCovered,onFinish,onUnavailable,study=false}){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.90;
  renderer.transmissionResolutionScale=.65;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,140);
  const background=new THREE.Color('#0b0d0e');camera.position.set(0,0,14);
  const environment=createEnvironment(renderer);scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight('#ecf4f6','#101820',1.1));
  const key=new THREE.DirectionalLight('#f0f8fa',1.6);key.position.set(-4,6,7);scene.add(key);
  const rim=new THREE.DirectionalLight('#aabfc9',.85);rim.position.set(4,1,-3);scene.add(rim);
  const textureLoader=new THREE.TextureLoader();
  const stage=canvas.parentElement;
  const textures=[],records=[];
  let disposed=false,width=1,height=1,floorY=-8,raf=0,last=0,clock=0,paused=false,hover=-1,focus=0,entry=null;
  let down=null;
  const pointer=new THREE.Vector2(0,0),raycaster=new THREE.Raycaster(),projected=new THREE.Vector3();

  for(const [index,item] of items.entries()){
    const spec=item.spec,group=new THREE.Group();
    const front=new THREE.MeshPhysicalMaterial({color:'#dce8ec',roughness:.49,metalness:0,envMapIntensity:.25,clearcoat:.10,clearcoatRoughness:.28,emissive:'#ffffff',emissiveIntensity:.12});
    const side=new THREE.MeshPhysicalMaterial({color:'#9fb2bc',roughness:.45,metalness:0,transmission:.32,thickness:.12,ior:1.31,envMapIntensity:.3});
    for(const geometry of createSpecimenGeometry(spec)){
      const mesh=new THREE.Mesh(geometry,[front,side]);mesh.userData.index=index;group.add(mesh);
    }
    const localBounds=new THREE.Box3().setFromObject(group);
    const label=stage.querySelector(`[data-project="${spec.id}"]`);
    const record={item,group,front,side,localBounds,label,base:new THREE.Vector3(),scale:1,ready:false};
    records.push(record);scene.add(group);
    if(label&&import.meta.env.DEV)label.dataset.object=group.uuid;
    const texture=textureLoader.load(spec.imageCut||spec.image,()=>{
      if(disposed)return;
      const outline=traceSilhouette(texture.image,spec);
      if(outline.length){
        group.children.forEach(mesh=>mesh.geometry.dispose());group.clear();record.localBounds.makeEmpty();
        for(const geometry of createSpecimenGeometry(spec,outline)){
          const mesh=new THREE.Mesh(geometry,[front,side]);mesh.userData.index=index;group.add(mesh);record.localBounds.union(geometry.boundingBox);
        }
        if(entry?.record===record){
          const matrix=new THREE.Matrix4().compose(new THREE.Vector3(),entry.finalRotation,group.scale);
          entry.halfHeight=-record.localBounds.clone().applyMatrix4(matrix).min.y;
        }
      }
      front.map=texture;front.bumpMap=texture;front.bumpScale=.012;front.emissiveMap=texture;front.needsUpdate=true;
      record.ready=true;
    },undefined,()=>{record.ready=true;});
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const rect=spec.imageRect||[0,0,1,1];texture.repeat.set(rect[2],rect[3]);texture.offset.set(rect[0],1-rect[1]-rect[3]);textures.push(texture);
  }
  const water=createWaterSurface(),mist=createFieldMist();
  scene.add(water.mesh);
  const mistScene=new THREE.Scene();mistScene.add(mist.mesh);
  // The volume is rendered in 3D at a softer resolution; the objects stay sharp.
  const mistTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
  const overlayScene=new THREE.Scene(),overlayCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const overlay=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:mistTarget.texture,transparent:true,depthTest:false,depthWrite:false}));overlayScene.add(overlay);

  function resize(){
    width=canvas.clientWidth||innerWidth;height=canvas.clientHeight||innerHeight;
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    mistTarget.setSize(Math.max(1,Math.round(width*.55)),Math.max(1,Math.round(height*.55)));
    water.resize(width,height);
    const worldHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*14,worldWidth=worldHeight*camera.aspect;
    floorY=-worldHeight*.85;water.mesh.position.y=floorY;
    mist.mesh.position.y=floorY+2.625;mist.uniforms.uFloor.value=floorY;
    for(const record of records){
      const {item}=record,ratio=item.spec.vb[1]/item.spec.vb[0];
      let pixels=item.w*width*(.81+(item.z??.5)*.26);
      if(width<640)pixels=Math.max(pixels,item.spec.id==='tchaikim'?45:72);
      pixels=Math.min(pixels,height*.47/ratio,width*.29);
      record.scale=pixels/width*worldWidth;
      record.base.set((item.cx-.5)*worldWidth,(.5-item.cy)*worldHeight,0);
      if(!entry){record.group.position.copy(record.base);record.group.scale.setScalar(record.scale);}
    }
  }

  function updateLabel(record,active){
    if(!record.label)return;
    const box=new THREE.Box3().setFromObject(record.group);
    if(entry?.record===record)projected.set(entry.origin.x,entry.labelY,entry.origin.z).project(camera);
    else projected.set(record.group.position.x,box.min.y,record.group.position.z).project(camera);
    const x=Math.max(58,Math.min(width-58,(projected.x*.5+.5)*width));
    const y=(-projected.y*.5+.5)*height+18;
    record.label.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translateX(-50%)`;
    record.label.dataset.active=String(active);
    record.label.style.visibility=record.group.visible&&projected.z<1&&y<height+80?'visible':'hidden';
  }

  function reset(){
    entry=null;camera.position.set(0,0,14);camera.lookAt(0,0,0);
    for(const r of records){r.group.position.copy(r.base);r.group.scale.setScalar(r.scale);r.group.rotation.set(0,0,0);r.group.visible=true;}
    water.uniforms.uAge.value=0;mist.uniforms.uAmount.value=0;
    stage.style.setProperty('--entry-travel','0');document.documentElement.style.removeProperty('--entry-travel');
    canvas.dataset.phase='field';
  }

  function startEntry(id){
    if(entry)return false;
    const record=records.find(r=>r.item.spec.id===id);if(!record)return false;
    const group=record.group;
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.07,.15,group.rotation.z*.5));
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(),rotation,group.scale);
    const finalBounds=record.localBounds.clone().applyMatrix4(matrix);
    entry={id,record,time:0,origin:group.position.clone(),labelY:new THREE.Box3().setFromObject(group).min.y,rotation:group.quaternion.clone(),finalRotation:rotation,halfHeight:-finalBounds.min.y,covered:false,paused:study};
    paused=false;last=0;
    if(import.meta.env.DEV)canvas.dataset.selectedObject=group.uuid;
    if(!raf)raf=requestAnimationFrame(frame);
    return true;
  }

  function render(){
    const current=entry;
    const state=current?entryAt(current.time,current.origin,floorY,current.halfHeight):null;
    if(current){
      current.record.group.position.set(state.x,state.y,state.z);
      current.record.group.quaternion.slerpQuaternions(current.rotation,current.finalRotation,state.approach);
      camera.position.set(0,state.cameraY,state.cameraZ);camera.lookAt(0,state.targetY,0);
      water.uniforms.uAge.value=state.age;
      mist.uniforms.uTime.value=current.time;mist.uniforms.uAmount.value=state.mist;
      mist.uniforms.uAge.value=state.age;
      mist.uniforms.uBlanket.value=state.blanket;mist.uniforms.uDrift.value=state.drift;
      stage.style.setProperty('--entry-travel',String(state.follow));
      document.documentElement.style.setProperty('--entry-travel',String(state.follow));
      canvas.dataset.phase=current.time<ENTRY.release?'approach':current.time<ENTRY.impact?'descend':current.time<ENTRY.cover?'sublimate':'reveal';
      if(import.meta.env.DEV){
        canvas.dataset.time=current.time.toFixed(3);canvas.dataset.iceY=state.y.toFixed(3);canvas.dataset.cameraY=state.cameraY.toFixed(3);
      }
    }else{
      for(const [i,r] of records.entries()){
        const active=(hover>=0?hover:focus)===i;
        r.group.position.copy(r.base);r.group.position.y+=Math.sin(clock*.52+i*2.1)*.035;
        r.group.position.z=active?.10:0;
        r.group.rotation.x=mix(r.group.rotation.x,(pointer.y*.025)+(active?.014:0),.08);
        r.group.rotation.y=mix(r.group.rotation.y,pointer.x*.045+(active?.035:0),.08);
        r.group.rotation.z=Math.sin(clock*.24+i)*.008;
      }
    }
    const covered=!!current?.covered;
    for(const [i,r] of records.entries()){
      r.group.visible=!covered&&r.ready;
      updateLabel(r,(hover>=0?hover:focus)===i);
    }
    water.mesh.visible=!covered;
    water.uniforms.uTime.value=current?current.time:clock;
    water.uniforms.uCamera.value.copy(camera.position);
    scene.background=covered?null:background;
    renderer.setRenderTarget(null);renderer.autoClear=true;renderer.setClearColor(background,covered?0:1);renderer.render(scene,camera);
    if(state&&state.mist>0){
      mist.uniforms.uCamera.value.copy(camera.position);
      renderer.setRenderTarget(mistTarget);renderer.setClearColor(0,0);renderer.render(mistScene,camera);
      renderer.setRenderTarget(null);renderer.autoClear=false;renderer.render(overlayScene,overlayCamera);renderer.autoClear=true;
    }
  }

  function frame(now){
    raf=0;if(disposed)return;
    const dt=last&&!document.hidden?(now-last)/1000:0;last=now;clock+=dt;
    if(entry&&!entry.paused&&entry.record.ready)entry.time+=dt;
    render();
    if(entry&&!entry.paused){
      if(entry.time>=ENTRY.cover&&!entry.covered){entry.covered=true;onCovered?.(entry.id);}
      if(entry.time>=ENTRY.end){paused=true;entry.finished=true;onFinish?.();return;}
    }
    if(!paused||entry)raf=requestAnimationFrame(frame);
  }
  function hit(event){
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(records.map(r=>r.group),true)[0]?.object.userData.index??-1;
  }
  const move=e=>{if(entry)return;hover=hit(e);canvas.style.cursor=hover>=0?'pointer':'';};
  const leave=()=>{hover=-1;canvas.style.cursor='';};
  const pointerDown=e=>{if(!entry)down={x:e.clientX,y:e.clientY,index:hit(e)};};
  const pointerUp=e=>{
    if(!down||entry)return;
    const index=hit(e),click=index===down.index&&index>=0&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<8;down=null;
    if(click)onSelect?.(records[index].item.spec.id);
  };
  const visibility=()=>{last=0;};
  const lost=e=>{e.preventDefault();onUnavailable?.(entry?.id);};
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();reset();
  canvas.dataset.renderer='three-webgl-continuous';raf=requestAnimationFrame(frame);

  return {
    startEntry,
    setFocus(index){focus=index;},
    setPaused(value){paused=value;if(!paused&&!raf){last=0;raf=requestAnimationFrame(frame);}},
    reset(){reset();paused=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}},
    cancelEntry(){reset();paused=false;if(!raf){last=0;raf=requestAnimationFrame(frame);}},
    seek(time){if(entry){entry.paused=true;entry.time=Math.max(0,Math.min(ENTRY.end,time));render();}},
    resume(){if(entry){entry.paused=false;last=0;if(!raf)raf=requestAnimationFrame(frame);}},
    finish(){
      if(!entry||entry.finished)return;
      if(!entry.covered){entry.covered=true;onCovered?.(entry.id);}
      entry.finished=true;entry.time=ENTRY.end;paused=true;cancelAnimationFrame(raf);raf=0;onFinish?.();
    },
    destroy(){
      disposed=true;cancelAnimationFrame(raf);observer.disconnect();
      canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);
      document.documentElement.style.removeProperty('--entry-travel');
      const geometries=new Set(),materials=new Set();
      for(const s of [scene,mistScene,overlayScene])s.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment.dispose();water.dispose();mistTarget.dispose();renderer.dispose();
    },
  };
}
