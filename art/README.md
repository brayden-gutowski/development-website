# Diary opening animation

`diary-opening.blend` is the editable Blender 4.2 source. Its `Diary_Pickup_Open`
action animates the pickup, cover hinges, staggered leaves, paper flex, and flexible
case spine over 2.25 seconds. Closing plays the same action in reverse.

Rebuild the web asset from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/build-diary-animation.py
```

Page and cover outlines sample the reader’s cubic edges and rounded quadratic corners,
with extra geometry at each fore edge to avoid angular wedges.

The script checks closed mesh topology and 55 intermediate poses, including spine
intersection and cover contact, then exports `assets/diary/diary-opening.glb`.
The source packs the existing diary imagery and leather for previewing in Blender.
In the website, `diary-print.js` paints the selected entry onto the animated pages,
and `diary-animation.js` adapts the authored motion to the current camera and screen.
The runtime installs one physical binding on the desk and reuses those exact
meshes and materials for pickup, reading and return. The readable HTML pages
fade over the same printed surfaces; the 3D case stays present throughout.
Printed paper is excluded from the room's filmic grading and atmospheric passes
so its color matches the selectable text layer without a final-frame swap.
See `diary-binding.md` for the installation and identity regression check.
