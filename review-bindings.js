import * as THREE from 'three';
import { createDiaryBinding } from './diary-animation.js?v=13';

// Each shelf book owns its own binding, clip, material and rest transform.
// These are the same solids on the shelf, in flight, and in the reader.
export function createReviewBindings(asset,room,source,covers,textures){
  return covers.map((entry,i)=>{
    const original=source.getObjectByName(['Cube007','Cube008','Cube009'][i]);
    if(!original)throw new Error('Review book is missing from the room');
    room.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(original),size=box.getSize(new THREE.Vector3());
    const rest={position:box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0,0,-size.z/2)),
      quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2),
      scale:new THREE.Vector3(size.z/.269,size.y/.410,Math.min(size.x,.065)/.041),size};
    textures[i].colorSpace=THREE.SRGBColorSpace;textures[i].flipY=false;textures[i].anisotropy=4;
    const binding=createDiaryBinding(asset,room,original,{cover:textures[i],action:'books',name:`Review book: ${entry.id}`,rest,closedPaperInset:.075});
    // Reviews open directly to one spread; the diary's extra turning leaves
    // would repeat that same review three times during the opening.
    binding.meshes.filter(mesh=>/^Turning[_ ]leaf/.test(mesh.name)).forEach(mesh=>{mesh.visible=false;});
    binding.id=entry.id;return binding;
  });
}
