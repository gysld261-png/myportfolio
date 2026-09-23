import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createColdFog, createIceMaterial, createStudio } from './iceCubeScene';
import { ENTRY,entryAt,mix } from './portfolioMotion';
import { createWaterSurface,createFieldMist } from './portfolioAtmosphere';


/* ── 표본 형태 ──
   실루엣을 얇게 뽑으면 잘린 단면(시멘트 판)이 된다. 드라이아이스 덩어리가 되려면
   1) 두껍게 뽑고 모서리를 둥글린 뒤
   2) 면을 잘게 쪼개 가운데를 부풀리고(윤곽에서 멀수록 도톰하게)
   3) 전체에 결정 덩어리의 울퉁불퉁한 요철을 준다.
   단위는 실루엣 폭 = 1. */
const SPECIMEN_FORM={
  odit:{depth:.26,bulge:.13,rough:.022},
  tchaikim:{depth:.30,bulge:.12,rough:.02},
  nuri:{depth:.30,bulge:.14,rough:.024},
  walga:{depth:.24,bulge:.1,rough:.02},
};
const lattice=(x,y,z)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n);};
function valueNoise(x,y,z){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
  const fx=x-xi,fy=y-yi,fz=z-zi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz);
  const l=(a,b,t)=>a+(b-a)*t;
  return l(l(l(lattice(xi,yi,zi),lattice(xi+1,yi,zi),u),l(lattice(xi,yi+1,zi),lattice(xi+1,yi+1,zi),u),v),
    l(l(lattice(xi,yi,zi+1),lattice(xi+1,yi,zi+1),u),l(lattice(xi,yi+1,zi+1),lattice(xi+1,yi+1,zi+1),u),v),w);
}
const chunkNoise=(x,y,z)=>valueNoise(x*3.1,y*3.1,z*3.1)*.62+valueNoise(x*7.3+4,y*7.3,z*7.3)*.28+valueNoise(x*17+9,y*17,z*17)*.1-.5;

/* 긴 모서리를 반으로 나누며 면을 잘게 쪼갠다.
   모서리를 나눌지는 모서리 단위로 정하고(양쪽 삼각형이 같은 결정을 본다),
   나뉜 모서리 수에 따라 삼각형을 2·3·4개로 다시 짠다 — 이웃과 꼭짓점이 어긋나는 틈(T 이음매)이
   생기지 않아서 부풀려도 표면에 선이 드러나지 않는다. */
function refine(source,maxEdge){
  const pos=Array.from(source.attributes.position.array);
  let tris=Array.from(source.index.array);
  const vertex=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]];
  const length=(a,b)=>{const p=vertex(a),q=vertex(b);return Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);};
  for(let pass=0;pass<8;pass++){
    const mids=new Map();let split=false;
    const mid=(a,b)=>{
      const key=a<b?`${a}_${b}`:`${b}_${a}`;
      if(mids.has(key))return mids.get(key);
      let index=-1;
      if(length(a,b)>maxEdge){
        const p=vertex(a),q=vertex(b);index=pos.length/3;
        pos.push((p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2);split=true;
      }
      mids.set(key,index);return index;
    };
    const next=[];
    for(let t=0;t<tris.length;t+=3){
      const a=tris[t],b=tris[t+1],c=tris[t+2];
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      const n=(ab>=0)+(bc>=0)+(ca>=0);
      if(n===0)next.push(a,b,c);
      else if(n===3)next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
      else if(n===1){
        if(ab>=0)next.push(a,ab,c,ab,b,c);
        else if(bc>=0)next.push(a,b,bc,a,bc,c);
        else next.push(a,b,ca,ca,b,c);
      }else{
        // 나뉘지 않은 모서리 맞은편 꼭짓점에서 부채꼴로
        if(ab<0)next.push(a,b,bc,a,bc,ca,ca,bc,c);
        else if(bc<0)next.push(a,ab,ca,ab,b,c,ab,c,ca);
        else next.push(a,ab,bc,a,bc,c,ab,b,bc);
      }
    }
    tris=next;if(!split)break;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setIndex(tris);
  return geometry;
}

export function createSpecimenGeometry(spec,polygons=spec.polys){
  const [w,h]=spec.vb;
  const form=SPECIMEN_FORM[spec.id]||{depth:.26,bulge:.12,rough:.02};
  return polygons.map((poly,pi)=>{
    const outline=poly.map(([x,y])=>[x/w-.5,(h/2-y)/w]);
    const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
    const extruded=new THREE.ExtrudeGeometry(shape,{depth:form.depth,steps:2,bevelEnabled:true,bevelThickness:form.depth*.32,bevelSize:.022,bevelSegments:5,curveSegments:1});
    extruded.translate(0,0,-form.depth/2);
    extruded.deleteAttribute('normal');extruded.deleteAttribute('uv');
    // 부풀리려면 앞·뒷면 안쪽에도 꼭짓점이 있어야 한다
    const merged=mergeVertices(extruded,1e-5);extruded.dispose();
    const geometry=refine(merged,.045);merged.dispose();

    // 윤곽까지의 거리 — 가장자리는 그대로, 안쪽일수록 도톰하게
    const edges=outline.map((a,i)=>[a,outline[(i+1)%outline.length]]);
    const inside=(x,y)=>{
      let hit=false;
      for(const [[ax,ay],[bx,by]] of edges)if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
      return hit;
    };
    // 둥근 모서리는 실루엣 바깥으로 살짝 나가 있다 — 거기까지 부풀리면 테두리가 턱처럼 솟는다
    const distance=(x,y)=>{
      if(!inside(x,y))return 0;
      let best=Infinity;
      for(const [[ax,ay],[bx,by]] of edges){
        const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
        best=Math.min(best,Math.hypot(x-ax-dx*t,y-ay-dy*t));
      }
      return best;
    };
    const position=geometry.attributes.position,seed=pi*3.7+spec.id.length;
    const halfDepth=form.depth/2+form.depth*.32;
    for(let i=0;i<position.count;i++){
      let x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const face=Math.min(1,Math.abs(z)/halfDepth);   // 0 = 옆면 가운데, 1 = 앞·뒷면
      const dome=(1-Math.exp(-distance(x,y)/.14))*form.bulge*face*face;
      z+=Math.sign(z||1)*dome;
      // 결정 덩어리의 요철 — 바깥 방향으로 밀거나 당긴다
      const n=chunkNoise(x+seed,y,z)*form.rough*2;
      const len=Math.hypot(x,y,z*1.6)||1;
      position.setXYZ(i,x+x/len*n,y+y/len*n,z+(z*1.6)/len*n);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return geometry;
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
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.transmissionResolutionScale=.65;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,140);
  const background=new THREE.Color('#0b0d0e');camera.position.set(0,0,14);
  // 메인 큐브와 같은 스튜디오 반사 — 같은 드라이아이스가 같은 빛 아래 있어야 한 세계로 읽힌다
  const environment=createStudio(renderer);scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight('#ecf4f6','#101820',1.1));
  const key=new THREE.DirectionalLight('#f0f8fa',1.6);key.position.set(-4,6,7);scene.add(key);
  const rim=new THREE.DirectionalLight('#aabfc9',.85);rim.position.set(4,1,-3);scene.add(rim);
  const textureLoader=new THREE.TextureLoader();
  const stage=canvas.parentElement;
  const textures=[],records=[];
  let disposed=false,width=1,height=1,floorY=-8,raf=0,last=0,clock=0,paused=false,hover=-1,focus=0,entry=null;
  let down=null,hoverPoint=null;
  const pointer=new THREE.Vector2(0,0),raycaster=new THREE.Raycaster(),projected=new THREE.Vector3();

  for(const [index,item] of items.entries()){
    const spec=item.spec,group=new THREE.Group();
    // 메인 큐브와 같은 드라이아이스 재질. 좌표 배율은 큐브(한 변 2.35) 결 굵기에 맞춘다.
    const heatUniforms={uHeat:{value:0},uHeatPoint:{value:new THREE.Vector3(0,0,9)}};
    // 모양이 불규칙한 덩어리라 큐브보다 얼룩을 옅게, 성에 바탕을 두껍게 — 위장무늬가 되지 않게
    const ice=createIceMaterial(heatUniforms,{positionScale:2.35,edge:'fresnel',frostBase:.34,mottle:.16});
    ice.thickness=1.2;
    for(const geometry of createSpecimenGeometry(spec)){
      const mesh=new THREE.Mesh(geometry,ice);mesh.userData.index=index;group.add(mesh);
    }
    const localBounds=new THREE.Box3().setFromObject(group);
    const label=stage.querySelector(`[data-project="${spec.id}"]`);
    // 표본마다 아래로 흘러내리는 냉기 — 큐브와 같은 연기. 회전을 따라 돌지 않게 scene 에 붙인다.
    const fog=createColdFog(spec.id==='tchaikim'?70:110);scene.add(fog);
    const record={item,group,ice,heatUniforms,heat:0,fog,localBounds,label,base:new THREE.Vector3(),scale:1,ready:false};
    records.push(record);scene.add(group);
    if(label&&import.meta.env.DEV)label.dataset.object=group.uuid;
    const texture=textureLoader.load(spec.imageCut||spec.image,()=>{
      if(disposed)return;
      const outline=traceSilhouette(texture.image,spec);
      if(outline.length){
        group.children.forEach(mesh=>mesh.geometry.dispose());group.clear();record.localBounds.makeEmpty();
        for(const geometry of createSpecimenGeometry(spec,outline)){
          const mesh=new THREE.Mesh(geometry,ice);mesh.userData.index=index;group.add(mesh);record.localBounds.union(geometry.boundingBox);
        }
        if(entry?.record===record){
          const matrix=new THREE.Matrix4().compose(new THREE.Vector3(),entry.finalRotation,group.scale);
          entry.halfHeight=-record.localBounds.clone().applyMatrix4(matrix).min.y;
        }
      }
      // 사진은 실루엣을 따는 데만 쓴다 — 면에 붙이면 사진 속 음영이 판에 인쇄된 것처럼 보인다
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
    for(const r of records)r.fog.material.uniforms.uPixelRatio.value=renderer.getPixelRatio();
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

      // 커서(열)가 닿은 자리의 성에가 녹는다 — 메인 큐브와 같은 반응
      const hot=!current&&hover===i;
      r.heat+=((hot?1:0)-r.heat)*(hot?.08:.03);
      r.heatUniforms.uHeat.value=r.heat;
      if(hot&&hoverPoint)r.heatUniforms.uHeatPoint.value.lerp(hoverPoint,.2);

      // 냉기는 덩어리 아래쪽에서 넘쳐 흘러내린다. 연출(entry) 중에는 물속 연무에 자리를 내준다.
      const lb=r.localBounds,s=r.group.scale.x;
      const halfW=(lb.max.x-lb.min.x)/2*s,bottom=r.group.position.y+lb.min.y*s;
      const fs=Math.max(.05,halfW*.9),fu=r.fog.material.uniforms;
      fu.uOrigin.value.set(r.group.position.x+(lb.min.x+lb.max.x)/2*s,bottom+fs*.85,r.group.position.z);
      fu.uScale.value=fs;
      fu.uTime.value=clock+i*3.1;
      fu.uAmount.value=.85+r.heat*.6;
      r.fog.visible=!current&&r.group.visible;
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
    const found=raycaster.intersectObjects(records.map(r=>r.group),true)[0];
    if(!found)return -1;
    // 재질은 로컬 좌표 × 2.35 로 성에를 계산하므로 열점도 같은 공간으로 옮긴다
    hoverPoint=found.object.worldToLocal(found.point.clone()).multiplyScalar(2.35);
    return found.object.userData.index??-1;
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
