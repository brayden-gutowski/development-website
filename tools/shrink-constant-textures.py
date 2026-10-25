"""Losslessly shrink solid embedded GLB images; leave every image index intact.

Usage: python3 tools/shrink-constant-textures.py INPUT.glb OUTPUT.glb
Requires Pillow, available in the bundled Python runtime.
"""
import io
import json
from pathlib import Path
import runpy
import shutil
import sys

from PIL import Image

# Reuse the existing GLB reader/writer without changing its material workflow.
glb = runpy.run_path(str(Path(__file__).with_name('update-gainesville-materials.py')))


def shrink(source, output):
    document, binary = glb['read_glb'](source)
    replacements = {}
    saved = 0
    changed = []
    for index, image in enumerate(document.get('images', [])):
        if 'bufferView' not in image:
            continue
        view = document['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        with Image.open(io.BytesIO(binary[offset:offset + view['byteLength']])) as decoded:
            pixels = decoded.convert('RGBA')
        if pixels.size == (1, 1) or not all(low == high for low, high in pixels.getextrema()):
            continue
        one_pixel = Image.new('RGBA', (1, 1), pixels.getpixel((0, 0)))
        encoded = io.BytesIO()
        if image['mimeType'] == 'image/webp':
            one_pixel.save(encoded, format='WEBP', lossless=True, exact=True)
        else:
            one_pixel.save(encoded, format='PNG')
            image['mimeType'] = 'image/png'
        replacements[image['bufferView']] = encoded.getvalue()
        saved += (pixels.width * pixels.height - 1) * 4
        changed.append(index)
    if replacements:
        packed = bytearray()
        for index, view in enumerate(document['bufferViews']):
            offset = view.get('byteOffset', 0)
            payload = replacements.get(index, binary[offset:offset + view['byteLength']])
            packed.extend(b'\0' * (-len(packed) % 4))
            view['byteOffset'] = len(packed)
            view['byteLength'] = len(payload)
            packed.extend(payload)
        glb['write_glb'](output, document, packed)
    elif Path(source).resolve() != Path(output).resolve():
        shutil.copyfile(source, output)
    return {'images': changed, 'rgba_bytes_saved': saved}


if __name__ == '__main__':
    print(json.dumps(shrink(*sys.argv[1:3])))
