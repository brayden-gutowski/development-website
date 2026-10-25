import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const sha=data=>createHash('sha256').update(data).digest('hex');
test('Gainesville retains the original thirteen user mesh objects and matching lightmaps',()=>{
 const manifest=JSON.parse(read('assets/GainesvilleRoom.source.json'));
 for(const [file,hash] of Object.entries(manifest.files))assert.equal(sha(read('assets/'+file)),hash,'Source export and lightmaps must remain matched: '+file);
 const b=read('assets/GainesvilleRoom.glb'),gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 assert.equal(gltf.meshes.length,13);
 assert.deepEqual(gltf.nodes.filter(n=>n.mesh!==undefined).map(n=>n.name),manifest.mesh_nodes);
 assert.ok(manifest.mesh_nodes.includes('Computer')&&manifest.mesh_nodes.includes('Screen')&&manifest.mesh_nodes.includes('ExitSign'));
 assert.ok(!gltf.scenes.some(s=>s.extras?.workstationRemodel));
 const bin=20+b.readUInt32LE(12)+8,fingerprints={};
 for(const node of gltf.nodes.filter(n=>n.mesh!==undefined)){
  const points=new Set();
  for(const primitive of gltf.meshes[node.mesh].primitives){
   const a=gltf.accessors[primitive.attributes.POSITION],v=gltf.bufferViews[a.bufferView],start=bin+(v.byteOffset||0)+(a.byteOffset||0);
   assert.equal(a.componentType,5126);
   for(let i=0;i<a.count;i++){const offset=start+i*(v.byteStride||12);points.add([0,4,8].map(d=>Math.round(b.readFloatLE(offset+d)*1e5)).join(','));}
  }
  const transform=['translation','rotation','scale','matrix'].map(key=>[key,node[key]?.map(v=>Math.round(v*1e5))]);
  fingerprints[node.name]=sha(JSON.stringify([[...points].sort(),transform]));
 }
 assert.deepEqual(fingerprints,manifest.geometry_fingerprints,'Lighting changes must preserve original vertices and mesh transforms');

});
test('All XP icon assets match their recorded native-resource bytes',()=>{
 const manifest=JSON.parse(read('assets/xp/icon-provenance.json'));
 const files=new Set(manifest.icons.map(i=>i.file));
 for(const file of Object.values(manifest.mapping))assert.ok(files.has(file),'Every allowlisted icon needs provenance');
 for(const item of manifest.icons){assert.equal(sha(read('assets/xp/'+item.file)),item.sha256,item.file);assert.ok(item.url.startsWith('https://raw.githubusercontent.com/'));}
 const js=read('xp-desktop.js').toString();assert.ok(js.includes('Unverified XP icon:'));
 assert.deepEqual(JSON.parse(js.match(/const ICONS=(\{[^\n]+\});/)[1]),manifest.mapping,'The runtime icon allowlist must match the audited native assets');
});
