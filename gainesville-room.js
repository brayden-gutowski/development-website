import { createModelTextureResidency, disposeRoomScene } from './room-texture-residency.js?v=20261025-leak-audit-2';
import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/SSAOPass.js';
import { FullScreenQuad } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/Pass.js';
import { createGainesvilleLamp } from './gainesville-lamp.js?v=20261025-detail-momentum-1';
import { createRoomOutline } from './room-outline.js?v=20261024-native-2';

export async function createGainesvilleRoom() {
  const scene = new THREE.Scene(), ownedTextures = new Set();
  // Settle each load before cleanup so a late sibling cannot escape a failed room.
  async function loadAssets(assets) {
    const results = await Promise.allSettled(assets);
    for (const result of results) if (result.status === 'fulfilled') {
      if (result.value.isTexture) ownedTextures.add(result.value);
      if (result.value.scene) {
        scene.add(result.value.scene);
        for (const value of result.value.parser?.associations.keys() || []) if (value.isTexture) ownedTextures.add(value);
      }
    }
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return results.map(result => result.value);
  }
  try {
  const [gltf, architectureLight, furnitureLight] = await loadAssets([
    new GLTFLoader().loadAsync('assets/GainesvilleRoom.glb?v=20261025-memory-2'),
    new THREE.TextureLoader().loadAsync('assets/gainesville-light-architecture.webp?v=20261025-fourth-review-2'),
    new THREE.TextureLoader().loadAsync('assets/gainesville-light-furniture.webp?v=20261025-fourth-review-2'),
  ]);
  for(const texture of [architectureLight,furnitureLight])texture.flipY=false;
  scene.background = new THREE.Color(0x010101);
  const splitLighting=!!gltf.scene.getObjectByName('Computer')?.userData.roomPracticalLightmap;
  const blackLight=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blackLight.needsUpdate=true;ownedTextures.add(blackLight);
  const [architecturePractical,furniturePractical]=splitLighting?await loadAssets([
    new THREE.TextureLoader().loadAsync('assets/gainesville-practical-architecture.webp?v=20261025-fourth-review-2'),
    new THREE.TextureLoader().loadAsync('assets/gainesville-practical-furniture.webp?v=20261025-fourth-review-2'),
  ]):[blackLight,blackLight];
  architecturePractical.flipY=furniturePractical.flipY=false;
  const lampIntensity={value:1},viewAdaptation={value:1};
  const lightMaterials = new Map(), originals = new Set();
  function bakedMaterial(material, texture, practicalTexture) {
    const key=material.uuid+texture.uuid;
    if(lightMaterials.has(key))return lightMaterials.get(key);
    const copy=material.clone();originals.add(material);
    const kind=/CeramicPottery/.test(copy.name)?'table':copy.name==='Material.004'?'plastic':/BrickWall/.test(copy.name)?'brick':/WoodDeckWorn/.test(copy.name)?'floor':copy.name==='Material.009'?'glass':null;
    // Preserve the authored color/normal tiles; only their light response varies.
    if(kind==='table'){copy.envMapIntensity=.24;copy.roughness=.95;}
    if(kind==='plastic'){copy.envMapIntensity=.38;copy.roughness=.51;}
    if(kind==='brick')copy.envMapIntensity=.45;
    if(kind==='floor')copy.envMapIntensity=.55;
    if(kind==='glass'){copy.envMapIntensity=2.2;copy.roughness=.19;}
    if(copy.name==='Material.003'){copy.emissiveIntensity*=.84;copy.emissive.lerp(new THREE.Color(.23,.055,.045),.12);}
    for(const map of new Set([copy.map,copy.normalMap,copy.roughnessMap,copy.metalnessMap].filter(Boolean))){
      map.anisotropy=8;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
    }
    copy.lightMap=texture;copy.lightMap.channel=1;copy.lightMapIntensity=Math.PI*.8;
    copy.onBeforeCompile=shader=>{
      shader.uniforms.roomPracticalMap={value:practicalTexture};shader.uniforms.roomLampIntensity=lampIntensity;shader.uniforms.roomViewAdaptation=viewAdaptation;
      shader.fragmentShader='uniform float roomViewAdaptation;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight *= roomViewAdaptation;\n#include <opaque_fragment>');
      if(kind){
        shader.vertexShader='varying vec3 roomSurfacePosition;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nroomSurfacePosition=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=`varying vec3 roomSurfacePosition;
          float roomHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
          float roomNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(roomHash(i),roomHash(i+vec3(1,0,0)),f.x),mix(roomHash(i+vec3(0,1,0)),roomHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(roomHash(i+vec3(0,0,1)),roomHash(i+vec3(1,0,1)),f.x),mix(roomHash(i+vec3(0,1,1)),roomHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        `+shader.fragmentShader;
        const grain='float roomGrain=roomNoise(roomSurfacePosition*220.)-.5;float roomBroad=roomNoise(roomSurfacePosition*1.8)-.5;float roomTablePatch=roomNoise(roomSurfacePosition*vec3(.95,1.7,1.25)+vec3(9.1,2.7,5.8))-.5;';
        const color={table:'diffuseColor.rgb*=1.+.03*roomTablePatch;',plastic:'diffuseColor.rgb*=1.+.02*roomBroad;diffuseColor.rgb+=vec3(.006,-.001,-.004)*roomBroad;',brick:'diffuseColor.rgb*=1.+.05*roomNoise(roomSurfacePosition*.85)-.025;',floor:'diffuseColor.rgb*=1.+.025*roomBroad;',glass:''}[kind];
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+grain+color);
        const roughness={table:'roughnessFactor=clamp(roughnessFactor+.065*roomGrain+.07*roomTablePatch,.56,.94);',plastic:'roughnessFactor=clamp(roughnessFactor+.035*roomGrain+.025*roomBroad,.40,.68);',brick:'roughnessFactor=clamp(roughnessFactor+.07*roomGrain+.08*roomBroad,.84,.99);',floor:'float boardVariation=roomNoise(vec3(roomSurfacePosition.x*.7+roomSurfacePosition.z*.21,roomSurfacePosition.y*.3,roomSurfacePosition.z*7.3))-.5;roughnessFactor=clamp(roughnessFactor+.18*boardVariation+.04*roomBroad+.025*roomGrain,.68,.97);',glass:''}[kind];
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+roughness);
        if(kind==='floor'){
          // Sample less high-frequency color/normal detail only in deep shadow;
          // the original full-resolution floor texture remains crisp in light.
          const floorLight=`vec4 floorSteady=texture2D(lightMap,vLightMapUv),floorPractical=texture2D(roomPracticalMap,vLightMapUv);
            float floorLight=dot(floorSteady.rgb*floorSteady.a*16.+floorPractical.rgb*floorPractical.a*64.*roomLampIntensity,vec3(.2126,.7152,.0722));
            float floorDetail=smoothstep(.02,.25,floorLight);`;
          const floorMap=THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','texture2D( map, vMapUv, (1.-floorDetail)*.7 )');
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',floorLight+'\n'+floorMap);
          shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
            normal=normalize(mix(nonPerturbedNormal,normal,mix(.22,1.,floorDetail)));`);
        }
        if(kind==='glass'){
          shader.uniforms.roomLampPosition={value:lampPosition};
          shader.fragmentShader='uniform vec3 roomLampPosition;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`vec3 glassNormal=inverseTransformDirection(normal,viewMatrix),glassView=normalize(cameraPosition-roomSurfacePosition);
            float lampReflection=pow(max(dot(reflect(-glassView,glassNormal),normalize(roomLampPosition-roomSurfacePosition)),0.),180.);
            outgoingLight+=vec3(1.,.72,.48)*lampReflection*.005*roomLampIntensity+vec3(.020,.024,.030)*(.045+.955*pow(1.-abs(dot(glassView,glassNormal)),3.))*mix(.65,1.2,smoothstep(-.7,.8,reflect(-glassView,glassNormal).y));
            #include <opaque_fragment>`);
        }
      }
      shader.fragmentShader='uniform sampler2D roomPracticalMap; uniform float roomLampIntensity;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',
        THREE.ShaderChunk.lights_fragment_maps
          .replace('vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;',
            'vec4 practicalTexel = texture2D(roomPracticalMap,vLightMapUv); vec3 lightMapIrradiance = (lightMapTexel.rgb * lightMapTexel.a * 16.0 + practicalTexel.rgb * practicalTexel.a * 64.0 * roomLampIntensity) * lightMapIntensity;')
          // The Cycles atlas already includes diffuse bounce. The captured
          // environment supplies view-dependent reflections only.
          .replace('iblIrradiance += getIBLIrradiance( geometryNormal );',''));
    };
    copy.customProgramCacheKey=()=> 'gainesville-surface-response-v4-'+(kind||'source');
    lightMaterials.set(key,copy);return copy;
  }
  const meshes=[], actions={door:[],computer:[],lamp:[]};
  gltf.scene.traverse(o=>{
    if(o.isLight)o.visible=false;
    if(!o.isMesh)return;
    meshes.push(o);o.castShadow=true;o.receiveShadow=true;
    let owner=o;
    while(owner.parent && !['ExitSign','Computer','Screen'].includes(owner.name))owner=owner.parent;
    const tagged=o.userData.roomAction||owner.userData.roomAction;
    const action=['door','computer'].includes(tagged)?tagged:owner.name==='ExitSign'?'door':['Computer','Screen'].includes(owner.name)?'computer':null;
    delete o.userData.roomAction;
    if(action){o.userData.roomAction=action;actions[action].push(o);}
    let lightOwner=o;
    while(lightOwner.parent && !lightOwner.userData.roomLightmap)lightOwner=lightOwner.parent;
    const name=lightOwner.userData.roomLightmap;
    if(name){
      if(!o.geometry.attributes.uv1)throw new Error('Missing source lighting UVs: '+o.name);
      const texture=name==='gainesville-light-architecture'?architectureLight:furnitureLight;
      const practicalTexture=name==='gainesville-light-architecture'?architecturePractical:furniturePractical;
      o.material=Array.isArray(o.material)?o.material.map(m=>bakedMaterial(m,texture,practicalTexture)):bakedMaterial(o.material,texture,practicalTexture);
    }
  });
  const lamp=createGainesvilleLamp(scene,meshes);
  for(const mesh of lamp.meshes){mesh.userData.roomAction='lamp';actions.lamp.push(mesh);}
  originals.forEach(material=>material.dispose());
  gltf.scene.updateMatrixWorld(true);
  const camera=gltf.cameras[0]||new THREE.PerspectiveCamera(48,16/9,.025,50);
  if(!gltf.cameras.length){camera.position.set(-.334,1.954,-4.004);camera.lookAt(-.334,1.7,1);}
  scene.attach(camera);camera.fov*=1.18;camera.near=.025;camera.far=50;
  const base=camera.position.clone(), rotation=camera.quaternion.clone(),baseFov=camera.fov,authoredAspect=camera.aspect;
  const screen=gltf.scene.getObjectByName('Screen');
  const screenBounds=new THREE.Box3().setFromObject(screen);
  const corners=screen.userData.crtDisplayCornersBlender;
  const displayCorners=corners?Array.from({length:4},(_,i)=>new THREE.Vector3(corners[i*3],corners[i*3+2],-corners[i*3+1]).applyMatrix4(screen.matrixWorld)):
    [new THREE.Vector3(screenBounds.max.x,screenBounds.max.y,screenBounds.max.z),new THREE.Vector3(screenBounds.min.x,screenBounds.max.y,screenBounds.max.z),new THREE.Vector3(screenBounds.min.x,screenBounds.min.y,screenBounds.max.z),new THREE.Vector3(screenBounds.max.x,screenBounds.min.y,screenBounds.max.z)];
  const center=displayCorners.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(.25);
  const displayRight=displayCorners[1].clone().sub(displayCorners[0]).normalize();
  const displayUp=displayCorners[0].clone().sub(displayCorners[3]).normalize();
  const displayNormal=displayRight.clone().cross(displayUp).normalize();
  if(displayNormal.dot(base.clone().sub(center))<0)displayNormal.negate();
  const closePosition=center.clone().addScaledVector(displayNormal,.9);
  const closeCamera=camera.clone();closeCamera.up.copy(displayUp);closeCamera.position.copy(closePosition);closeCamera.lookAt(center);
  const outline=createRoomOutline(scene,camera,{strokeWidth:1.4}),pointer=new THREE.Vector2(),look=new THREE.Vector2(),ray=new THREE.Raycaster();
  RectAreaLightUniformsLib.init();
  const screenSpill=new THREE.RectAreaLight(0xaacaff,0,displayCorners[0].distanceTo(displayCorners[1]),displayCorners[0].distanceTo(displayCorners[3]));
  screenSpill.name='CRT display spill';screenSpill.position.copy(center).addScaledVector(displayNormal,.018);screenSpill.lookAt(center.clone().add(displayNormal));scene.add(screenSpill);
  const powerLED=scene.getObjectByName('CRT_PowerLED');
  if(powerLED?.material)powerLED.material=powerLED.material.clone();
  let displayPowered=false,displayBrightness=0,spillTarget=0;
  const spillColor=new THREE.Color(.75,.85,1);
  const lampPosition=lamp.position.clone();
  const bulbMaterials=lamp.meshes.filter(o=>o.name.startsWith('LightBulb')).flatMap(o=>[o.material].flat()).filter(m=>m?.emissive);
  const touch=matchMedia('(hover: none), (pointer: coarse)');
  let visible=false,focused=false,progress=0,highlighted=null,width=1,height=1,environment,environmentProbe,disposed=false;
  function highlight(action){highlighted=action;outline.selectedObjects=focused?[]:touch.matches?[...actions.door,...actions.computer,...actions.lamp]:actions[action]||[];}
  const depthTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1)});
  const depthMaterial=new THREE.MeshDepthMaterial({side:THREE.DoubleSide});depthMaterial.colorWrite=false;
  const occlusion=new SSAOPass(scene,camera,1,1,16);
  occlusion.ssaoRenderTarget.depthBuffer=occlusion.blurRenderTarget.depthBuffer=false;
  occlusion.kernelRadius=.12;occlusion.minDistance=.0003;occlusion.maxDistance=.025;
  occlusion.copyMaterial.fragmentShader='uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=vec4(mix(vec3(1.),texture2D(tDiffuse,vUv).rgb,.08),1.);}';
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const fog=new THREE.ShaderMaterial({
    uniforms:{tDepth:{value:depthTarget.depthTexture},inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},eye:{value:new THREE.Vector3()},time:{value:0},lampPosition:{value:lampPosition},lampIntensity:lampIntensity},
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:vertex,
    fragmentShader:`uniform sampler2D tDepth;uniform mat4 inverseProjection,cameraWorld;uniform vec3 eye,lampPosition;uniform float time,lampIntensity;varying vec2 vUv;
      void main(){
        vec4 p=inverseProjection*vec4(vUv*2.-1.,texture2D(tDepth,vUv).r*2.-1.,1.);p/=p.w;
        vec3 end=(cameraWorld*p).xyz,delta=end-eye;
        float distanceToSurface=min(length(delta),14.);vec3 direction=normalize(delta),color=vec3(0.);float opacity=0.;
        for(int i=0;i<24;i++){
          float d=(float(i)+.5)*distanceToSurface/24.;vec3 pos=eye+direction*d;
          float swirl=.65+.35*sin(pos.x*1.7+sin(pos.z*1.3+time*.14)+time*.12)*sin(pos.z*2.1-time*.1);
          vec3 nearLamp=(pos-lampPosition+vec3(0.,.12,0.))/vec3(.7,.55,.7);
          float lampGlow=exp(-dot(nearLamp,nearLamp)*2.);
          float density=lampGlow*.004*lampIntensity*swirl*distanceToSurface/24.;
          vec3 light=vec3(.18,.115,.065);
          color+=(1.-opacity)*density*light;opacity+=(1.-opacity)*density;
        }gl_FragColor=vec4(color/max(opacity,.0001),opacity);
      }`,
  });
  const fogQuad=new FullScreenQuad(fog);
  const bloomX=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),bloomY=bloomX.clone();
  const diffusion=new THREE.ShaderMaterial({uniforms:{image:{value:null},stepUV:{value:new THREE.Vector2()},extract:{value:1}},depthTest:false,depthWrite:false,toneMapped:false,vertexShader:vertex,
    fragmentShader:`uniform sampler2D image;uniform vec2 stepUV;uniform float extract;varying vec2 vUv;void main(){vec3 sum=vec3(0.);float total=0.;for(int i=-4;i<=4;i++){float w=exp(-.125*float(i*i));vec3 c=texture2D(image,clamp(vUv+stepUV*float(i),0.,1.)).rgb;sum+=c*mix(1.,smoothstep(.65,1.6,dot(c,vec3(.2126,.7152,.0722))),extract)*w;total+=w;}gl_FragColor=vec4(sum/total,1.);}`});
  const diffusionQuad=new FullScreenQuad(diffusion);
  const modelTextures=await createModelTextureResidency(gltf,scene);
  let effectsSuspended=false;
  const room={scene,camera,outline,windowLight:fog,bloomTexture:bloomY.texture,diffusionStrength:.08,sourceAgX:true,
    get texturesSuspended(){return modelTextures.suspended;},
    prepareTextures:()=>modelTextures.prepare(),
    suspendTextures:()=>modelTextures.suspend(),
    get effectsSuspended(){return effectsSuspended;},
    suspendEffects(){
      if(effectsSuspended)return;
      for(const target of [depthTarget,bloomX,bloomY,outline.renderTargetMaskBuffer,occlusion.normalRenderTarget,occlusion.ssaoRenderTarget,occlusion.blurRenderTarget])target.dispose();
      effectsSuspended=true;
    },
    get computerFocused(){return focused;},
    getScreenRect(){
      const points=displayCorners.map(p=>{const q=p.clone().project(camera);return {x:(q.x+1)*width/2,y:(1-q.y)*height/2};});
      const [tl,tr,br,bl]=points,w=Math.hypot(tr.x-tl.x,tr.y-tl.y),h=w*displayCorners[0].distanceTo(displayCorners[3])/displayCorners[0].distanceTo(displayCorners[1]);
      const q=points.map(p=>({x:p.x-tl.x,y:p.y-tl.y}));
      const dx1=q[1].x-q[2].x,dx2=q[3].x-q[2].x,dx3=q[0].x-q[1].x+q[2].x-q[3].x;
      const dy1=q[1].y-q[2].y,dy2=q[3].y-q[2].y,dy3=q[0].y-q[1].y+q[2].y-q[3].y;
      const det=dx1*dy2-dx2*dy1,g=Math.abs(det)<1e-9?0:(dx3*dy2-dx2*dy3)/det,k=Math.abs(det)<1e-9?0:(dx1*dy3-dx3*dy1)/det;
      const matrix=[q[1].x*(1+g)/w,q[1].y*(1+g)/w,0,g/w,q[3].x*(1+k)/h,q[3].y*(1+k)/h,0,k/h,0,0,1,0,0,0,0,1];
      const reflected=lampPosition.clone().addScaledVector(displayNormal,-2*lampPosition.clone().sub(center).dot(displayNormal));
      const view=reflected.sub(camera.position),denom=view.dot(displayNormal);
      const hit=camera.position.clone().addScaledVector(view,Math.abs(denom)<1e-5?0:center.clone().sub(camera.position).dot(displayNormal)/denom).sub(center);
      return {x:tl.x,y:tl.y,width:w,height:h,transform:'matrix3d('+matrix.join(',')+')',
        reflectionX:50+hit.dot(displayRight)/screenSpill.width*100,reflectionY:50-hit.dot(displayUp)/screenSpill.height*100};
    },
    setDisplayState({powered=false,brightness=0,standby=false,color}={}){
      displayPowered=powered;displayBrightness=THREE.MathUtils.clamp(brightness,0,1);
      spillTarget=powered?displayBrightness*6:0;
      spillColor.setRGB(.72,.83,1);
      if(Array.isArray(color)&&color.length===3){const sample=new THREE.Color().setRGB(...color,THREE.SRGBColorSpace);const peak=Math.max(sample.r,sample.g,sample.b,.001);sample.multiplyScalar(1/peak);spillColor.lerp(sample,.28);}
      if(powerLED?.material){powerLED.material.emissive.set(standby?0xffa321:0x36ed65);powerLED.material.emissiveIntensity=powered?1.7:standby?.6:0;}
    },
    get displayState(){return {powered:displayPowered,brightness:displayBrightness,spill:screenSpill.intensity,color:screenSpill.color.toArray()};},
    get lampState(){return lamp.state;},
    flickerLamp(){lamp.trigger();},
    focusComputer(value=true){focused=value;highlight(null);},
    reset(){lamp.reset();lampIntensity.value=1;viewAdaptation.value=1;this.setDisplayState();screenSpill.intensity=0;focused=false;progress=0;pointer.set(0,0);look.set(0,0);camera.position.copy(base);camera.quaternion.copy(rotation);highlight(null);},
    point(x,y){pointer.set(x,y);},highlight,
    setVisible(value){visible=value;if(!value)room.reset();},
    pick(x,y){
      const cast=(px,py)=>{ray.setFromCamera(new THREE.Vector2(px,py),camera);return ray.intersectObjects(meshes,false)[0]?.object.userData.roomAction||null;};
      let action=cast(x,y);
      if(!action&&touch.matches)for(let i=0;i<8&&!action;i++)action=cast(x+Math.cos(i*Math.PI/4)*12/width,y+Math.sin(i*Math.PI/4)*12/height);
      return action;
    },
    update(dt,reducedMotion){
      lamp.update(dt,reducedMotion);lampIntensity.value=lamp.state.intensity;lampPosition.copy(lamp.position);
      for(const material of bulbMaterials){material.emissive.setRGB(1,.78,.56);material.emissiveIntensity=.35*lamp.state.intensity;}
      screenSpill.intensity=THREE.MathUtils.damp(screenSpill.intensity,spillTarget,spillTarget>0?9:6,dt);
      if(spillTarget===0&&screenSpill.intensity<.001)screenSpill.intensity=0;
      screenSpill.color.lerp(spillColor,1-Math.exp(-8*dt));
      progress=reducedMotion?Number(focused):THREE.MathUtils.damp(progress,Number(focused),4.5,dt);
      if(Math.abs(progress-Number(focused))<.0001)progress=Number(focused);
      // Gentle local eye adaptation on approach; global renderer exposure stays fixed.
      viewAdaptation.value=THREE.MathUtils.damp(viewAdaptation.value,1-.035*progress*displayBrightness,2.8,dt);
      look.lerp(reducedMotion?new THREE.Vector2():pointer,1-Math.exp(-3*dt));
      const q=rotation.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.y*.025,-look.x*.035,0,'YXZ')));
      camera.position.lerpVectors(base,closePosition,progress);camera.quaternion.slerpQuaternions(q,closeCamera.quaternion,progress);
      if(reducedMotion&&!focused)camera.quaternion.copy(rotation);
      camera.updateMatrixWorld(true);if(visible&&!reducedMotion)fog.uniforms.time.value+=dt;
    },
    resize(w,h,pixelRatio=1){width=w;height=h;camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov/2))/Math.min(1,camera.aspect/(camera.aspect<1?1.35:authoredAspect))));camera.updateProjectionMatrix();
      const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
      const distance=Math.max(screenSpill.height/2/tangent,screenSpill.width/2/(tangent*camera.aspect))/.80;
      closePosition.copy(center).addScaledVector(displayNormal,distance);closeCamera.position.copy(closePosition);closeCamera.lookAt(center);
      outline.setSize(Math.round(w*pixelRatio),Math.round(h*pixelRatio));outline.overlayMaterial.uniforms.strokeTexel.value.set(1/w,1/h);depthTarget.setSize(Math.round(w*pixelRatio),Math.round(h*pixelRatio));occlusion.setSize(Math.round(w*.65),Math.round(h*.65));bloomX.setSize(Math.max(1,Math.round(w/4)),Math.max(1,Math.round(h/4)));bloomY.setSize(bloomX.width,bloomX.height);},
    async prepare(renderer){
      if(disposed)throw new Error('Room has been disposed');
      if(!renderer.extensions.has('EXT_color_buffer_float')){
        bloomX.texture.type=bloomY.texture.type=THREE.UnsignedByteType;return;
      }
      const capture=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
      // Three keeps transmission buffers per camera; retain the six probe IDs.
      const probe=environmentProbe ||= new THREE.CubeCamera(.04,50,capture);
      probe.renderTarget=capture;
      probe.position.copy(center).add(new THREE.Vector3(0,0,-.08));probe.updateMatrixWorld(true);
      const pmrem=new THREE.PMREMGenerator(renderer);
      const previous=renderer.getRenderTarget(),objects=actions.computer.map(o=>[o,o.visible]);
      try{
        objects.forEach(([o])=>{o.visible=false;});
        probe.update(renderer,scene);
        const previousEnvironment=environment;
        environment=pmrem.fromCubemap(capture.texture);
        previousEnvironment?.dispose();
        scene.environment=environment.texture;scene.environmentIntensity=1;
      }finally{objects.forEach(([o,v])=>{o.visible=v;});renderer.setRenderTarget(previous);capture.dispose();pmrem.dispose();}
    },
    shade(renderer,target){
      effectsSuspended=false;
      const previous=renderer.getRenderTarget(),override=scene.overrideMaterial,background=scene.background,auto=renderer.autoClear;
      try{
        scene.overrideMaterial=depthMaterial;scene.background=null;renderer.setRenderTarget(depthTarget);renderer.clear();renderer.autoClear=false;renderer.render(scene,camera);
        scene.overrideMaterial=override;scene.background=background;renderer.autoClear=auto;
        occlusion.render(renderer,target,target);
        fog.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);fog.uniforms.cameraWorld.value.copy(camera.matrixWorld);fog.uniforms.eye.value.copy(camera.position);
        renderer.setRenderTarget(target);renderer.autoClear=false;fogQuad.render(renderer);renderer.autoClear=auto;
        diffusion.uniforms.image.value=target.texture;diffusion.uniforms.stepUV.value.set(1.5/bloomX.width,0);diffusion.uniforms.extract.value=1;renderer.setRenderTarget(bloomX);diffusionQuad.render(renderer);
        diffusion.uniforms.image.value=bloomX.texture;diffusion.uniforms.stepUV.value.set(0,1.5/bloomX.height);diffusion.uniforms.extract.value=0;renderer.setRenderTarget(bloomY);diffusionQuad.render(renderer);
      }finally{scene.overrideMaterial=override;scene.background=background;renderer.autoClear=auto;renderer.setRenderTarget(previous);}
    },
    dispose(){if(disposed)return;disposed=true;modelTextures.dispose();outline.dispose();occlusion.dispose();depthTarget.dispose();depthMaterial.dispose();fog.dispose();fogQuad.dispose();diffusion.dispose();diffusionQuad.dispose();bloomX.dispose();bloomY.dispose();environment?.dispose();architectureLight.dispose();furnitureLight.dispose();architecturePractical.dispose();if(furniturePractical!==architecturePractical)furniturePractical.dispose();blackLight.dispose();const materials=new Set(),textures=new Set();scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())if(m)materials.add(m);o.shadow?.dispose();});for(const m of materials){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}textures.forEach(t=>t.dispose());scene.environment=null;},
  };
  room.reset();return room;
  } catch (error) {
    disposeRoomScene(scene, ownedTextures);
    throw error;
  }
}
