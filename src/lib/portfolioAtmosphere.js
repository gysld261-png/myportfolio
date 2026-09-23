import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const noiseGLSL=`
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float cloud(vec3 p){return noise3(p)*.58+noise3(p*2.07)*.28+noise3(p*4.13)*.14;}
`;

export function createWaterSurface(){
  const shader={
    name:'QuietWater',
    uniforms:{
      color:{value:new THREE.Color()},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},
      uAge:{value:0},uTime:{value:0},uContact:{value:new THREE.Vector2(0,2.6)},
      uCamera:{value:new THREE.Vector3()},uBackground:{value:new THREE.Color('#0b0d0e')},
    },
    vertexShader:`uniform mat4 textureMatrix;varying vec4 vReflection;varying vec3 vWorld;
      void main(){
        vReflection=textureMatrix*vec4(position,1.);
        vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`precision highp float;
      uniform sampler2D tDiffuse;uniform float uAge,uTime;uniform vec2 uContact;
      uniform vec3 uCamera,uBackground;varying vec4 vReflection;varying vec3 vWorld;
      ${noiseGLSL}
      float wave(vec2 p){
        float h=noise3(vec3(p*vec2(.85,3.),uTime*.17))*.030;
        h+=noise3(vec3(p*vec2(2.4,8.5)+7.,uTime*.12))*.008;
        h+=sin(dot(p,vec2(.45,.89))*1.2-uTime*.32)*.005;
        // A travelling wave packet begins at contact, rather than painted rings.
        float r=length(p-uContact),front=r-uAge*1.8;
        float packet=exp(-pow(front/.65,2.))*smoothstep(0.,.22,uAge)*exp(-uAge*.45);
        h+=sin(front*12.)*packet*.027;
        return h;
      }
      void main(){
        vec2 p=vWorld.xz;
        float epsilon=.018;
        vec2 slope=vec2(wave(p+vec2(epsilon,0.))-wave(p-vec2(epsilon,0.)),wave(p+vec2(0.,epsilon))-wave(p-vec2(0.,epsilon)))/(2.*epsilon);
        vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
        vec3 view=normalize(uCamera-vWorld),ray=reflect(-view,normal);
        float fresnel=.020+.980*pow(1.-max(dot(view,normal),0.),5.);
        vec2 uv=vReflection.xy/vReflection.w;
        uv+=slope*.023/max(vReflection.w*.08,1.);
        vec3 reflected=texture2D(tDiffuse,clamp(uv,vec2(.001),vec2(.999))).rgb;
        vec3 base=mix(vec3(.0035,.0065,.0085),reflected*.65,clamp(fresnel+.28,0.,.88));
        // Wide, soft studio light reflected in gently moving water normals.
        // It makes the plane legible even before the specimen is near it.
        vec2 lightHit=p+ray.xz*(5.8/max(ray.y,.03));
        float strip=exp(-pow(lightHit.x/9.,4.)-pow((lightHit.y+7.)/.9,2.));
        float fill=exp(-pow((lightHit.x-7.)/4.,2.)-pow((lightHit.y+3.)/8.,2.));
        base+=vec3(.12,.15,.17)*strip*(.18+fresnel*.65);
        base+=vec3(.034,.051,.064)*fill;
        float r=length(p-uContact);
        float front=r-uAge*1.8;
        float ripple=exp(-pow(front/.65,2.))*smoothstep(0.,.22,uAge)*exp(-uAge*.55);
        base+=vec3(.025,.040,.047)*ripple*pow(max(0.,cos(front*12.)),6.);
        base=mix(base,uBackground,smoothstep(20.,65.,length(p)));
        gl_FragColor=vec4(base,.94);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  // The actual moving specimen is reflected and clipped at the waterline.
  const mesh=new Reflector(new THREE.PlaneGeometry(240,240),{shader,textureWidth:512,textureHeight:512,multisample:0,clipBias:.002});
  mesh.material.toneMapped=false;
  mesh.material.transparent=true;mesh.material.depthWrite=false;
  mesh.rotation.x=-Math.PI/2;
  const uniforms=mesh.material.uniforms;
  return {
    mesh,uniforms,
    resize(width,height){mesh.getRenderTarget().setSize(Math.min(1024,Math.round(width*.65)),Math.min(768,Math.round(height*.65)));},
    dispose(){mesh.getRenderTarget().dispose();},
  };
}

export function createFieldMist(){
  const uniforms={uFloor:{value:0},uTime:{value:0},uAge:{value:0},uAmount:{value:0},uBlanket:{value:0},uDrift:{value:0},uCamera:{value:new THREE.Vector3()}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:false,side:THREE.BackSide,
    vertexShader:`varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`precision highp float;varying vec3 vWorld;
      uniform vec3 uCamera;uniform float uFloor,uTime,uAge,uAmount,uBlanket,uDrift;
      ${noiseGLSL}
      void main(){
        if(uAmount<.001)discard;
        vec3 origin=uCamera-vec3(0.,uFloor,2.6),rd=normalize(vWorld-uCamera);
        vec3 inv=1./(rd+vec3(.00001)),lo=vec3(-10.,-.25,-10.),hi=vec3(10.,5.5,10.);
        vec3 t0=(lo-origin)*inv,t1=(hi-origin)*inv,a=min(t0,t1),b=max(t0,t1);
        float nearT=max(0.,max(max(a.x,a.y),a.z)),farT=min(min(b.x,b.y),b.z);
        if(farT<=nearT)discard;
        float stepSize=(farT-nearT)/32.;
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        vec3 color=vec3(0.);float opacity=0.;
        for(int i=0;i<32;i++){
          vec3 p=origin+rd*(nearT+(float(i)+jitter)*stepSize);
          // The clearing cloud moves out of the camera's path. No canvas fade.
          vec3 flow=p-vec3(uDrift*23.,0.,0.);
          float r=length(flow.xz),extent=.45+uAmount*8.5;
          float edge=1.-smoothstep(extent*.55,extent,r);
          float n=cloud(flow*2.25+vec3(uTime*.14,-uTime*.17,uTime*.08));
          float height=.20+uAmount*2.2;
          float layer=exp(-pow((flow.y-.22-(n-.5)*.65)/height,2.));
          float boundary=smoothstep(-.25,.05,p.y)*(1.-smoothstep(4.2,5.5,p.y));
          boundary*=(1.-smoothstep(8.8,10.,abs(p.x)))*(1.-smoothstep(8.8,10.,abs(p.z)));
          float density=max(0.,n-.29)*edge*layer*uAmount*4.5;
          float source=exp(-r*r/.65)*exp(-pow((p.y-.2)/.55,2.))*smoothstep(.28,.65,n)*1.5;
          density+=source*smoothstep(.22,.55,uAge)*(1.-smoothstep(.85,1.8,uAge))*2.4;
          density+=edge*layer*uBlanket*4.0;
          density*=boundary;
          float alpha=1.-exp(-density*stepSize*1.7);
          vec3 light=mix(vec3(.30,.36,.38),vec3(.73,.78,.78),clamp(p.y*.38+n*.40,0.,1.));
          color+=(1.-opacity)*alpha*light;opacity+=(1.-opacity)*alpha;
          if(opacity>.995)break;
        }
        gl_FragColor=vec4(color/max(opacity,.0001),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,5.75,20),material);
  mesh.position.set(0,2.625,2.6);mesh.renderOrder=50;mesh.frustumCulled=false;
  return {mesh,uniforms};
}
