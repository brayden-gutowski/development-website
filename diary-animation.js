import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
let pending;
export const loadDiaryAnimation=()=>pending||=new GLTFLoader().loadAsync('assets/diary/diary-opening.glb?v=4').catch(error=>{pending=null;throw error;});

// Install the animated binding once. The very same meshes and materials sit on
// the desk, travel to the reader, and return under the room's physical lights.
export function createDiaryBinding(gltf,room,source,options={}){
  room.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
  const sourceMesh=source.isMesh?source:source.getObjectByProperty('isMesh',true);
  const sourceMaterial=Array.isArray(sourceMesh.material)?sourceMesh.material[0]:sourceMesh.material;
  const cover=options.cover||sourceMaterial.map,actionName=options.action||'diary';
  const model=gltf.scene.clone(true),object=new THREE.Group();
  object.name=options.name||'Blender diary binding';object.matrixAutoUpdate=false;object.add(model);room.scene.add(object);
  const binding=model.getObjectByName('DiaryBinding'),guide=model.getObjectByName('OrientationGuide');
  const front=model.getObjectByName('FrontCoverHinge'),pages=model.getObjectByName('LeftPagesHinge');
  const clip=gltf.animations.find(c=>c.name==='Diary_Pickup_Open'),mixer=new THREE.AnimationMixer(model);
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const correction=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,Math.PI/2,'ZYX'));
  const rotation=correction.invert(),scale=new THREE.Vector3(size.z/.269,size.x/.410,size.y/.041);
  const position=bounds.getCenter(new THREE.Vector3()).add(new THREE.Vector3(-.269*scale.x/2,0,0).applyQuaternion(rotation));
  const rest=options.rest||{position,quaternion:rotation,scale,size};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const coverColor=options.cover?new THREE.Color(0xffffff):sourceMaterial.color;
  const ctx=canvas.getContext('2d');let leather=coverColor.clone(),coverImage='';
  if(cover?.image){
    ctx.drawImage(cover.image,0,0,32,32);
    const pixels=ctx.getImageData(0,0,32,32).data,mean=[0,0,0];
    for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)mean[c]+=pixels[i+c]/1024;
    leather.multiply(new THREE.Color().setRGB(...mean.map(c=>c/255),THREE.SRGBColorSpace));
    coverImage=canvas.toDataURL('image/png');
  }
  const edges={leather:leather.clone().convertLinearToSRGB().toArray().map(c=>Math.round(c*255)),paper:[190,187,175]};
  const coverMaterial=new THREE.MeshStandardMaterial({map:cover,color:coverColor,roughness:.68,metalness:0});
  coverMaterial.name='Authored diary cover';
  const rim=new THREE.MeshStandardMaterial({color:leather,roughness:.68,metalness:0});rim.name='Diary leather rim';
  const lining=new THREE.MeshStandardMaterial({color:0xe5dcc4,roughness:.9,metalness:0});lining.name='Uncoated cover lining';
  for(const material of [coverMaterial,rim,lining]){
    material.stencilWrite=true;material.stencilRef=0;material.stencilZPass=THREE.ReplaceStencilOp;
  }
  // Keep the printed shader's texture path warm even while the book is closed.
  // Swapping in an entry atlas then changes only its pixels, not its program.
  const blankPaper=new THREE.DataTexture(new Uint8Array([190,187,175,255]),1,1);
  blankPaper.colorSpace=THREE.SRGBColorSpace;blankPaper.needsUpdate=true;
  let printMaterial;
  const meshes=[],paperTransforms=[];
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry=mesh.geometry.clone();mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.roomAction=actionName;meshes.push(mesh);
    if(mesh.material.name==='Diary printed atlas'){
      printMaterial ||= new THREE.MeshBasicMaterial({map:mesh.material.map||blankPaper,color:0xffffff,toneMapped:false,fog:false});
      printMaterial.name='Printed diary pages';printMaterial.fog=false;
      // An opaque color writes alpha zero only as an internal grading marker.
      // Stencil protects these exact printed colors from room AO and mist.
      printMaterial.stencilWrite=true;printMaterial.stencilRef=1;
      printMaterial.stencilZPass=THREE.ReplaceStencilOp;
      printMaterial.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\ngl_FragColor.a=0.0;');
      };
      printMaterial.customProgramCacheKey=()=> 'diary-ungraded-paper-v1';mesh.material=printMaterial;
      if(options.closedPaperInset)paperTransforms.push({mesh,position:mesh.position.clone(),scale:mesh.scale.clone()});
    }else if(mesh.name==='Flexible_case_spine')mesh.material=rim;
    else{
      const geometry=mesh.geometry,indices=geometry.index,normal=geometry.attributes.normal,caps=[],sides=[],inside=[];
      const outerSign=mesh.name==='Back_board'?-1:1;
      for(let i=0;i<indices.count;i+=3){
        const triangle=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];
        // Front and back boards face opposite ways when closed. Only the
        // exterior cap carries artwork; the inside is uncoated lining paper.
        const face=triangle.every(v=>normal.getZ(v)*outerSign>.9)?caps
          :triangle.every(v=>normal.getZ(v)*outerSign<-.9)?inside:sides;
        face.push(...triangle);
      }
      geometry.setIndex([...caps,...sides,...inside]);geometry.clearGroups();
      geometry.addGroup(0,caps.length,0);geometry.addGroup(caps.length,sides.length,1);
      geometry.addGroup(caps.length+sides.length,inside.length,2);mesh.material=[coverMaterial,rim,lining];
    }
  });
  object.userData={roomAction:actionName,animation:clip.name,printedFaces:true,printedReady:true,meshes:meshes.length,sameBinding:true};
  let lastSample=-1,sampledState;
  const api={object,shadow:object,meshes,rest,cover,coverImage,edges,duration:clip.duration,
    sample(t){
      t=THREE.MathUtils.clamp(t,0,1);if(t===lastSample)return sampledState;lastSample=t;
      action.paused=false;action.enabled=true;mixer.setTime(THREE.MathUtils.clamp(t,0,1)*(clip.duration-.000001));binding.updateMatrix();
      // Quaternion signs can switch at 180 degrees without changing rotation.
      const angle=o=>2*Math.atan2(Math.abs(o.quaternion.y),Math.abs(o.quaternion.w));
      object.userData.frontAngle=angle(front);object.userData.pagesAngle=angle(pages);
      // Closed review books tuck the paper inside their boards. Restore the
      // authored page contour before it becomes visible during opening.
      const reveal=THREE.MathUtils.smoothstep(object.userData.frontAngle,0,.45);
      const inset=(options.closedPaperInset||0)*(1-reveal);
      for(const {mesh,position,scale} of paperTransforms){
        mesh.position.copy(position);mesh.position.x+=.265*inset/2;
        mesh.scale.copy(scale);mesh.scale.x*=1-inset;mesh.scale.y*=1-inset;
      }
      return sampledState={progress:binding.position.x,arc:binding.position.y-.021-.45*binding.position.x,rotation:guide.position.x,bank:guide.position.y};
    },
    place(matrix){object.matrix.copy(matrix).multiply(binding.matrix.clone().invert());object.updateMatrixWorld(true);},
    appearance(print){if(print){if(printMaterial.map===blankPaper)blankPaper.dispose();printMaterial.map=print;printMaterial.color.set(0xffffff);printMaterial.needsUpdate=true;}},
    opacity(value){object.visible=value>0;object.userData.opacity=value;},
    restore(){api.sample(0);api.place(new THREE.Matrix4().compose(rest.position,rest.quaternion,rest.scale));api.opacity(1);},
  };
  api.restore();source.visible=false;return api;
}
