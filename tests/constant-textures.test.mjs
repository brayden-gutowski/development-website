import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const bundledPython=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python=process.env.PYTHON || (existsSync(bundledPython)?bundledPython:'python3');
const inspect=String.raw`
import copy, hashlib, io, json, struct, sys
from pathlib import Path
from PIL import Image
data=Path(sys.argv[1]).read_bytes()
assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
length=struct.unpack_from('<I',data,12)[0]
document=json.loads(data[20:20+length]); binary=data[28+length:]
schema=copy.deepcopy(document)
image_views={image['bufferView'] for image in document['images']}
for value in schema['buffers']: value.pop('byteLength',None)
for index,value in enumerate(schema['bufferViews']):
 value.pop('byteOffset',None)
 if index in image_views: value.pop('byteLength',None)
for value in schema['images']: value.pop('mimeType',None)
pixels=hashlib.sha256(); geometry=hashlib.sha256(); constants=[]; area=0
for index,view in enumerate(document['bufferViews']):
 offset=view.get('byteOffset',0)
 assert offset%4==0 and offset+view['byteLength']<=document['buffers'][0]['byteLength']<=len(binary)
 if index not in image_views: geometry.update(binary[offset:offset+view['byteLength']])
for index,image in enumerate(document['images']):
 view=document['bufferViews'][image['bufferView']]; offset=view.get('byteOffset',0)
 decoded=Image.open(io.BytesIO(binary[offset:offset+view['byteLength']]))
 assert Image.MIME[decoded.format]==image['mimeType']
 decoded=decoded.convert('RGBA'); area+=decoded.width*decoded.height
 constant=all(low==high for low,high in decoded.getextrema())
 if constant: constants.append([index,list(decoded.size)])
 pixels.update(struct.pack('<II',*(1,1) if constant else decoded.size))
 pixels.update(bytes(decoded.getpixel((0,0))) if constant else decoded.tobytes())
print(json.dumps({'schema':hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'pixels':pixels.hexdigest(),'geometry':geometry.hexdigest(),'constants':constants,'rgbaBytes':area*4}))
`;

// These hashes were recorded before optimization. Constant images are represented
// by their exact RGBA pixel; every other image retains its dimensions and pixels.
const originals={
 GainesvilleRoom:{schema:'fe00d56e4874fc041d5a9fda15dcf51d8ecb20de89d4aa5d12ee1eabf3c4a37c',pixels:'dd22a8cec85b3cb52d1dbf12e0743c5750a1212b29836d696d4fea75a896e667',geometry:'8bb32231be9cb5df33d959ad31f5e737276c7feae6edb2393a8f4e395b1cd2ce',constants:[31,33,34],rgbaBytes:226500620},
 JapanRoom:{schema:'e3b79ecd37aabf4843e285c5cfc976699ce2b884f0c2ef0ca8130d2e21cfeed2',pixels:'bbbcf43035b6aa988651864647caa46b1bc4f072df03f19d0ddf0702a10da8bc',geometry:'bfd91291f50d3ff325fc998c867802e261c9c58a1c7a32e98859dc507f90138e',constants:[38,49,53,55],rgbaBytes:197132304},
};
for(const [name,expected] of Object.entries(originals))test(`${name}: constant pixels shrink without changing any authored pixels or geometry`,()=>{
 const source=join(root,'assets',name+'.glb');
 const actual=JSON.parse(execFileSync(python,['-c',inspect,source],{encoding:'utf8'}));
 for(const key of ['schema','pixels','geometry'])assert.equal(actual[key],expected[key],key+' must preserve the original export');
 assert.deepEqual(actual.constants,expected.constants.map(index=>[index,[1,1]]));
 assert.equal(actual.rgbaBytes,expected.rgbaBytes);
 const temporary=mkdtempSync(join(tmpdir(),'constant-textures-'));
 try{
  const output=join(temporary,name+'.glb');
  execFileSync(python,[join(root,'tools/shrink-constant-textures.py'),source,output]);
  assert.deepEqual(readFileSync(output),readFileSync(source),'Already optimized assets must be byte-identical on rerun');
 }finally{rmSync(temporary,{recursive:true,force:true});}
});

test('The offline tool detects constants across RGBA and leaves single-pixel color or alpha differences intact',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'constant-textures-fixture-'));
 try{
  const source=join(temporary,'source.glb'),output=join(temporary,'output.glb');
  execFileSync(python,['-c',String.raw`
import io,json,struct,sys
from pathlib import Path
from PIL import Image
binary=bytearray(struct.pack('<3f',.25,-.5,1)); views=[{'buffer':0,'byteOffset':0,'byteLength':12}]; images=[]
for index,color in enumerate([(17,23,31,255),(41,43,47,127),(53,59,61,255),(67,71,73,127)]):
 image=Image.new('RGBA',(4,4),color)
 if index==2: image.putpixel((3,3),(54,59,61,255))
 if index==3: image.putpixel((3,3),(67,71,73,128))
 encoded=io.BytesIO(); webp=index%2==1
 image.save(encoded,format='WEBP' if webp else 'PNG',**({'lossless':True,'exact':True} if webp else {}))
 binary.extend(b'\0'*(-len(binary)%4)); views.append({'buffer':0,'byteOffset':len(binary),'byteLength':len(encoded.getvalue())});binary.extend(encoded.getvalue())
 images.append({'bufferView':len(views)-1,'mimeType':'image/webp' if webp else 'image/png'})
document={'asset':{'version':'2.0'},'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'images':images,'textures':[{'source':0},{'extensions':{'EXT_texture_webp':{'source':1}}},{'source':2},{'extensions':{'EXT_texture_webp':{'source':3}}}],'extensionsUsed':['EXT_texture_webp'],'accessors':[{'bufferView':0,'componentType':5126,'count':1,'type':'VEC3'}],'materials':[{'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2}},'normalTexture':{'index':1},'emissiveTexture':{'index':3}}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'material':0}]}]}
binary.extend(b'\0'*(-len(binary)%4));document['buffers'][0]['byteLength']=len(binary)
encoded=json.dumps(document).encode();encoded+=b' '*(-len(encoded)%4)
Path(sys.argv[1]).write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+struct.pack('<II',len(binary),0x004E4942)+binary)
`,source]);
  const before=JSON.parse(execFileSync(python,['-c',inspect,source],{encoding:'utf8'}));
  const result=JSON.parse(execFileSync(python,[join(root,'tools/shrink-constant-textures.py'),source,output],{encoding:'utf8'}));
  assert.deepEqual(result,{images:[0,1],rgba_bytes_saved:120});
  const after=JSON.parse(execFileSync(python,['-c',inspect,output],{encoding:'utf8'}));
  for(const key of ['schema','pixels','geometry'])assert.equal(after[key],before[key],key);
  assert.deepEqual(after.constants,[[0,[1,1]],[1,[1,1]]]);
  assert.equal(before.rgbaBytes-after.rgbaBytes,120);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
