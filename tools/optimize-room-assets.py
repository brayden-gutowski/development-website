"""Pack an exported GLB and lighting for the web; never reads/writes a .blend.

Usage: python optimize-room-assets.py /tmp/JapanRoom-export.glb assets/JapanRoom.glb
Requires Pillow and NumPy. Source material coordinates and geometry stay intact.
"""
import io
import json
import struct
import sys
from pathlib import Path
import numpy as np
from PIL import Image

source, output = map(Path, sys.argv[1:3])
raw = source.read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+size])
binary = raw[28+size:]
orm_images = {doc['textures'][m['pbrMetallicRoughness']['metallicRoughnessTexture']['index']]['source'] for m in doc['materials'] if 'metallicRoughnessTexture' in m.get('pbrMetallicRoughness', {})}
normal_images = {doc['textures'][m['normalTexture']['index']]['source'] for m in doc['materials'] if 'normalTexture' in m}
images = {image['bufferView']: index for index, image in enumerate(doc['images'])}
packed = bytearray()
for index, view in enumerate(doc['bufferViews']):
    data = binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
    if index in images:
        image_index = images[index]
        image = Image.open(io.BytesIO(data)).convert('RGB')
        if image_index in orm_images: image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        if image_index in normal_images:
            limit = 1024 if max(image.size) > 1024 else 512
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        image.save(encoded, 'WEBP', quality=98 if image_index in orm_images | normal_images else 93, method=6)
        data = encoded.getvalue()
        doc['images'][image_index]['mimeType'] = 'image/webp'
    packed.extend(b'\0' * (-len(packed) % 4))
    view['byteOffset'], view['byteLength'] = len(packed), len(data)
    packed.extend(data)
for texture in doc['textures']:
    texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
for key in ['extensionsUsed', 'extensionsRequired']:
    if 'EXT_texture_webp' not in doc.setdefault(key, []): doc[key].append('EXT_texture_webp')
doc['buffers'][0]['byteLength'] = len(packed)
header = json.dumps(doc, separators=(',', ':')).encode()
header += b' ' * (-len(header) % 4)
packed.extend(b'\0' * (-len(packed) % 4))
result = struct.pack('<III', 0x46546c67, 2, 28+len(header)+len(packed)) + struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(packed),0x004e4942)+packed
output.write_bytes(result)
print('GLB bytes', len(raw), '->', len(result))

# RGBM stores HDR irradiance in a compact, linear RGBA8 PNG. A multiplier of
# 32 covers the measured maximum (17.7) with headroom; runtime decodes it.
for name in ['room-indirect', 'room-furniture']:
    data = (output.parent / (name+'.hdr')).read_bytes()
    start = data.index(b'\n-Y ')+1
    end = data.index(b'\n', start)
    _, height, _, width = data[start:end].decode().split()
    width, height = int(width), int(height)
    offset = end+1
    rgbe = np.empty((height,width,4), dtype=np.uint8)
    for y in range(height):
        assert data[offset:offset+4] == bytes([2,2,width>>8,width&255])
        offset += 4
        for c in range(4):
            x = 0
            while x < width:
                run = data[offset]; offset += 1
                if run > 128:
                    count=run-128; rgbe[y,x:x+count,c]=data[offset]; offset+=1
                else:
                    count=run; rgbe[y,x:x+count,c]=np.frombuffer(data[offset:offset+count],dtype=np.uint8);offset+=count
                x += count
    rgb = rgbe[:,:,:3].astype(np.float32) * (np.exp2(rgbe[:,:,3].astype(np.float32)-128)/255)[:,:,None]
    assert rgb.max() < 32, 'Increase the RGBM range before packing this bake'
    multiplier = np.maximum(1, np.ceil(rgb.max(axis=2)/32*255))/255
    rgba = np.empty_like(rgbe)
    rgba[:,:,:3] = np.rint(np.clip(rgb / (32*multiplier[:,:,None]),0,1)*255).astype(np.uint8)
    rgba[:,:,3] = np.rint(multiplier*255).astype(np.uint8)
    reconstructed = rgba[:,:,:3]/255 * (rgba[:,:,3]/255*32)[:,:,None]
    error = np.abs(reconstructed-rgb)
    assert np.quantile(error, .999) < .025, 'Lighting pack lost excessive precision'
    destination = output.parent / (name+'.png')
    Image.fromarray(rgba, 'RGBA').save(destination, compress_level=9)
    print(name, 'HDR max', float(rgb.max()), '99.9% error',float(np.quantile(error,.999)), 'PNG bytes',destination.stat().st_size)
