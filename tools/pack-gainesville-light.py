"""Pack Cycles float atlases as lossless RGBM WebP without color conversion.
Usage: bundled-python tools/pack-gainesville-light.py /tmp assets
Input .npy files are produced by bake-gainesville-light.py in Blender.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
source, destination = map(Path, sys.argv[1:3])
for input_path in sorted(source.glob('gainesville-*.npy')):
    name=input_path.stem
    if not name.startswith(('gainesville-light-','gainesville-practical-')):continue
    rgb = np.maximum(0, np.load(source / (name+'.npy'))[:,:,:3])
    hdr_range=64 if name.startswith('gainesville-practical-') else 16
    assert np.isfinite(rgb).all() and rgb.max() < hdr_range
    multiplier = np.maximum(1, np.ceil(rgb.max(axis=2)/hdr_range*255))/255
    rgba = np.empty((*rgb.shape[:2],4), dtype=np.uint8)
    rgba[:,:,:3] = np.rint(np.clip(rgb/(hdr_range*multiplier[:,:,None]),0,1)*255).astype(np.uint8)
    rgba[:,:,3] = np.rint(multiplier*255).astype(np.uint8)
    decoded = rgba[:,:,:3]/255 * (rgba[:,:,3]/255*hdr_range)[:,:,None]
    assert np.max(np.abs(decoded-rgb)) <= hdr_range/255/2 + .00001
    # Practical highlights exceed16; verify sub-percent relative precision
    # against each pixel's radiance, including the near-black floor.
    error=np.abs(decoded-rgb)
    assert np.quantile(error/np.maximum(rgb.max(axis=2)[:,:,None],.25),.999) < .004
    if hdr_range==16:assert np.quantile(error,.999) < .01
    # Blender pixels start at the bottom; PNG/WebP rows start at the top.
    image = Image.fromarray(np.flipud(rgba),'RGBA')
    path = destination / (name+'.webp')
    image.save(path,'WEBP',lossless=True,exact=True,method=6)
    with Image.open(path) as check: assert check.convert('RGBA').tobytes() == image.tobytes()
    print(name, 'HDR max',float(rgb.max()),'bytes',path.stat().st_size)
