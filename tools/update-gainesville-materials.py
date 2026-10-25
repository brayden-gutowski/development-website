"""Replace architecture materials in a lit GLB without touching mesh/lightmap data.
Usage: bundled-python tools/update-gainesville-materials.py LIT_GLB MATERIAL_GLB OUTPUT
The material donor is produced with export-gainesville-room.py --detail-materials-only.
"""
import copy
import io
import hashlib
import shutil
import json
from pathlib import Path
import struct
import sys
from PIL import Image


def read_glb(path):
    data=Path(path).read_bytes()
    assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
    size=struct.unpack_from('<I',data,12)[0]
    document=json.loads(data[20:20+size])
    return document,bytearray(data[28+size:28+size+document['buffers'][0]['byteLength']])


def write_glb(path, document, binary):
    binary.extend(b'\0'*(-len(binary)%4))
    document['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(document,separators=(',',':')).encode()
    encoded+=b' '*(-len(encoded)%4)
    result=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))
    result+=struct.pack('<II',len(encoded),0x4E4F534A)+encoded
    result+=struct.pack('<II',len(binary),0x004E4942)+binary
    Path(path).write_bytes(result)


def compact(document, binary):
    # Remove replaced texture payloads, so later detail updates stay bounded.
    def texture_infos(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='extras':continue
                if key.endswith('Texture') and isinstance(item,dict) and 'index' in item:yield item
                else:yield from texture_infos(item)
        elif isinstance(value,list):
            for item in value:yield from texture_infos(item)
    infos=list(texture_infos(document['materials']))
    used=sorted({info['index'] for info in infos});mapping={old:new for new,old in enumerate(used)}
    for info in infos:info['index']=mapping[info['index']]
    document['textures']=[document['textures'][i] for i in used]
    used=sorted({item['sampler'] for item in document['textures'] if 'sampler' in item});mapping={old:new for new,old in enumerate(used)}
    for item in document['textures']:
        if 'sampler' in item:item['sampler']=mapping[item['sampler']]
    document['samplers']=[document['samplers'][i] for i in used]
    image_refs=[]
    for definition in document['textures']:
        if 'source' in definition:image_refs.append(definition)
        image_refs.extend(ext for ext in definition.get('extensions',{}).values() if isinstance(ext,dict) and 'source' in ext)
    used=sorted({item['source'] for item in image_refs});mapping={old:new for new,old in enumerate(used)}
    for item in image_refs:item['source']=mapping[item['source']]
    document['images']=[document['images'][i] for i in used]
    views=[]
    def view_refs(value):
        if isinstance(value,dict):
            if 'bufferView' in value:views.append(value)
            for key,item in value.items():
                if key not in ['bufferViews','extras']:view_refs(item)
        elif isinstance(value,list):
            for item in value:view_refs(item)
    view_refs(document)
    used=sorted({item['bufferView'] for item in views});mapping={old:new for new,old in enumerate(used)}
    packed=bytearray();definitions=[]
    for index in used:
        view=copy.deepcopy(document['bufferViews'][index]);start=view.get('byteOffset',0)
        packed.extend(b'\0'*(-len(packed)%4));view['byteOffset']=len(packed)
        packed.extend(binary[start:start+view['byteLength']]);definitions.append(view)
    for item in views:item['bufferView']=mapping[item['bufferView']]
    document['bufferViews']=definitions
    return packed


def update(base_path, donor_path, output_path):
    target,binary=read_glb(base_path)
    donor,source=read_glb(donor_path)
    names=['BrickWall','PlasterStucco']
    originals={material['name']:i for i,material in enumerate(target['materials'])}
    remapped={}
    def texture(index):
        if index in remapped:return remapped[index]
        definition=copy.deepcopy(donor['textures'][index])
        image=donor['images'][definition['source']]
        view=donor['bufferViews'][image['bufferView']]
        start=view.get('byteOffset',0)
        pixels=Image.open(io.BytesIO(source[start:start+view['byteLength']]))
        assert pixels.size==(2048,2048),(image.get('name'),pixels.size)
        packed=io.BytesIO();pixels.save(packed,format='WEBP',lossless=True,exact=True,method=6)
        payload=packed.getvalue()
        with Image.open(io.BytesIO(payload)) as check:assert check.convert('RGBA').tobytes()==pixels.convert('RGBA').tobytes()
        binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(payload)
        view_index=len(target['bufferViews']);target['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(payload)})
        image_index=len(target['images']);target['images'].append({'name':image.get('name','Architecture tile'),'bufferView':view_index,'mimeType':'image/webp'})
        sampler=len(target.setdefault('samplers',[]));target['samplers'].append({'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497})
        definition.pop('source',None);definition['sampler']=sampler
        definition.setdefault('extensions',{})['EXT_texture_webp']={'source':image_index}
        result=len(target['textures']);target['textures'].append(definition);remapped[index]=result
        return result
    count=0
    for material in donor['materials']:
        if not any(tag in material['name'] for tag in names) or material['name'] not in originals:continue
        digest=hashlib.sha256(json.dumps(material,sort_keys=True).encode())
        for info in [material.get('normalTexture'),material.get('pbrMetallicRoughness',{}).get('baseColorTexture'),material.get('pbrMetallicRoughness',{}).get('metallicRoughnessTexture')]:
            if info is None:continue
            image=donor['images'][donor['textures'][info['index']]['source']]
            view=donor['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
            digest.update(source[start:start+view['byteLength']])
        version=digest.hexdigest()
        if target['materials'][originals[material['name']]].get('extras',{}).get('roomTextureDetailHash')==version:
            count+=1;continue
        replacement=copy.deepcopy(material)
        replacement.setdefault('extras',{})['roomTextureDetailHash']=version
        infos=[replacement.get('normalTexture'),replacement.get('occlusionTexture'),replacement.get('emissiveTexture')]
        infos.extend(replacement.get('pbrMetallicRoughness',{}).get(key) for key in ['baseColorTexture','metallicRoughnessTexture'])
        for info in infos:
            if info is not None:info['index']=texture(info['index'])
        replacement.setdefault('extras',{})['roomTextureDetail']='single-tile-2048-v2'
        target['materials'][originals[material['name']]]=replacement;count+=1
    assert count>=2,'No detailed wall materials found'
    if not remapped:
        if Path(base_path).resolve()!=Path(output_path).resolve():shutil.copy2(base_path,output_path)
        print('Wall materials already current; no duplicate textures added');return
    binary=compact(target,binary)
    for key in ['extensionsUsed','extensionsRequired']:
        target[key]=sorted(set(target.get(key,[])+['KHR_texture_transform','EXT_texture_webp']))
    write_glb(output_path,target,binary)
    print('Detailed architecture materials:',count,'tiles:',len(remapped),'bytes:',Path(output_path).stat().st_size)


if __name__=='__main__':update(*sys.argv[1:4])
