import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createIceMaterial, createStudio } from './iceCubeScene';

function smoothClosedPolygon(points,passes=2){
  let result=points;
  for(let pass=0;pass<passes;pass++){
    const next=[];
    for(let i=0;i<result.length;i++){
      const a=result[i],b=result[(i+1)%result.length];
      next.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25]);
      next.push([a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);
    }
    result=next;
  }
  return result;
}

export function createSpecimenGeometry(spec,polygons=spec.polys){
  const [w,h]=spec.vb;
  const depth=spec.fieldDepth??.36,ratio=h/w;
  return polygons.map(poly=>{
    const outline=smoothClosedPolygon(poly,['walga','tchaikim'].includes(spec.id)?1:2);
    const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x/w-.5,(h/2-y)/w)));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:2,bevelEnabled:true,bevelThickness:.04,bevelSize:.025,bevelSegments:5,curveSegments:2});
    geometry.translate(0,0,-depth/2);
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      const nx=x/.56,ny=y/(ratio*.62||1);
      const calmBulge=Math.max(0,1-nx*nx-ny*ny)*.018;
      const grainWave=Math.sin(x*8.7+y*6.3)*Math.sin(y*7.1-z*5.2)*.003;
      positions.setXYZ(i,x+grainWave*.35,y+grainWave*.25,z+Math.sign(z||1)*(calmBulge+grainWave));
    }
    geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');
    const rounded=mergeVertices(geometry,1e-5);rounded.computeVertexNormals();rounded.computeBoundingBox();geometry.dispose();return rounded;
  });
}

export function createPortfolioScene(canvas,{items,onSelect,onUnavailable}){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.90;
  renderer.transmissionResolutionScale=.65;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,140);
  scene.background=new THREE.Color('#0b0d0e');camera.position.set(0,0,14);
  const environment=createStudio(renderer);scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight('#ecf4f6','#101820',1.1));
  const key=new THREE.DirectionalLight('#f0f8fa',1.6);key.position.set(-4,6,7);scene.add(key);
  const rim=new THREE.DirectionalLight('#aabfc9',.85);rim.position.set(4,1,-3);scene.add(rim);
  const stage=canvas.parentElement,records=[];
  let disposed=false,width=1,height=1,raf=0,last=0,clock=0,paused=false,hover=-1,focus=0,down=null;
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),projected=new THREE.Vector3();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  for(const [index,item] of items.entries()){
    const spec=item.spec,group=new THREE.Group();
    const uniforms={uHeat:{value:0},uHeatPoint:{value:new THREE.Vector3(.25,.1,.3)}};
    const material=createIceMaterial(uniforms,{positionScale:2.35,edge:'fresnel',frostBase:.18,mottle:.31});
    for(const geometry of createSpecimenGeometry(spec)){
      const mesh=new THREE.Mesh(geometry,material);mesh.userData.index=index;group.add(mesh);
    }
    group.rotation.set(item.rx??-.15,item.ry??.3,item.rz??0);
    const record={item,group,uniforms,label:stage.querySelector(`[data-project="${spec.id}"]`),base:new THREE.Vector3(),scale:1,ready:true};
    records.push(record);scene.add(group);
  }

  function resize(){
    width=canvas.clientWidth||innerWidth;height=canvas.clientHeight||innerHeight;
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    const worldHeight=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*14,worldWidth=worldHeight*camera.aspect;
    for(const record of records){
      const {item}=record,ratio=item.spec.vb[1]/item.spec.vb[0];
      let pixels=item.w*width*(.81+(item.z??.5)*.26);
      const mobileMin={odit:112,tchaikim:95,nuri:112,walga:112};
      if(width<640)pixels=Math.max(pixels,mobileMin[item.spec.id]??104);
      pixels=Math.min(pixels,height*.47/ratio,width*(width<640?.36:.29));
      record.scale=pixels/width*worldWidth;
      record.base.set((item.cx-.5)*worldWidth,(.5-item.cy)*worldHeight,0);
      record.group.position.copy(record.base);record.group.scale.setScalar(record.scale);
    }
  }

  function updateLabel(record,active){
    if(!record.label)return;
    const box=new THREE.Box3().setFromObject(record.group);
    projected.set(record.group.position.x,box.min.y,record.group.position.z).project(camera);
    const labelGap=record.item.spec.id==='tchaikim'&&width>=640?-12:18;
    const x=Math.max(58,Math.min(width-58,(projected.x*.5+.5)*width)),y=(-projected.y*.5+.5)*height+labelGap;
    record.label.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translateX(-50%)`;
    record.label.dataset.active=String(active);
    record.label.style.visibility=record.ready&&projected.z<1&&y<height+80?'visible':'hidden';
  }

  function frame(now){
    raf=0;if(disposed||paused)return;
    const dt=last&&!document.hidden?Math.min((now-last)/1000,.05):0;last=now;clock+=dt;
    for(const [i,r] of records.entries()){
      const active=(hover>=0?hover:focus)===i;
      r.group.position.copy(r.base);
      r.uniforms.uHeat.value+=((active ? .12 : 0)-r.uniforms.uHeat.value)*.06;
      if(!reduced){
        r.group.position.y+=Math.sin(clock*.52+i*2.1)*.035;r.group.position.z=active?.10:0;
        const rx=(r.item.rx??-.15)+pointer.y*.035+(active?.014:0);
        const ry=(r.item.ry??.3)+pointer.x*.07+(active?.045:0);
        const rz=(r.item.rz??0)+Math.sin(clock*.24+i)*.008;
        r.group.rotation.x+=(rx-r.group.rotation.x)*.08;
        r.group.rotation.y+=(ry-r.group.rotation.y)*.08;
        r.group.rotation.z+=(rz-r.group.rotation.z)*.08;
      }
      r.group.visible=r.ready;updateLabel(r,active);
    }
    renderer.render(scene,camera);raf=requestAnimationFrame(frame);
  }
  function hit(event){
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(records.filter(r=>r.ready).map(r=>r.group),true)[0]?.object.userData.index??-1;
  }
  const move=e=>{if(paused)return;hover=hit(e);canvas.style.cursor=hover>=0?'pointer':'';};
  const leave=()=>{hover=-1;down=null;canvas.style.cursor='';};
  const pointerDown=e=>{if(!paused&&e.button===0)down={x:e.clientX,y:e.clientY,index:hit(e)};};
  const pointerUp=e=>{
    if(!down||paused)return;
    const index=hit(e),click=index===down.index&&index>=0&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<8;down=null;
    if(click)onSelect?.(records[index].item.spec.id);
  };
  const visibility=()=>{last=0;};
  const lost=e=>{e.preventDefault();onUnavailable?.();};
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',leave);
  canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  canvas.dataset.renderer='three-sculpted-specimens';canvas.dataset.phase='field';raf=requestAnimationFrame(frame);

  return {
    setFocus(index){focus=index;},
    setPaused(value){
      paused=value;last=0;
      if(paused){cancelAnimationFrame(raf);raf=0;leave();}
      else if(!raf)raf=requestAnimationFrame(frame);
    },
    destroy(){
      disposed=true;cancelAnimationFrame(raf);observer.disconnect();
      canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',leave);
      canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);
      const geometries=new Set(),materials=new Set();
      scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();
    },
  };
}
