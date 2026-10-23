"""Pack authoring PNGs as pixel-identical runtime WebP. Requires Pillow.

After rebaking, copy the three matching PNGs into art/lightmaps, then run:
    python3 tools/pack-lightmaps.py
RGBM alpha is lighting data: compare every decoded RGBA byte before replacing.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
for name in ['room-memory-architecture', 'room-furniture', 'room-joinery-memory']:
    source = root / 'art' / 'lightmaps' / f'{name}.png'
    destination = root / 'assets' / f'{name}.webp'
    temporary = destination.with_suffix('.tmp.webp')
    try:
        with Image.open(source) as image:
            image.save(temporary, 'WEBP', lossless=True, exact=True, method=6)
            with Image.open(temporary) as packed:
                assert packed.convert('RGBA').tobytes() == image.convert('RGBA').tobytes(), name
        temporary.replace(destination)
        print(f'{name}: {source.stat().st_size:,} -> {destination.stat().st_size:,} bytes; exact RGBA match')
    finally:
        temporary.unlink(missing_ok=True)
