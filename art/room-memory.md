# Window-lit memory room

The live Three.js room combines a Cycles diffuse bake with live shadowed sun lighting,
physical material reflections, contact shadows, depth-clipped scattering and a
quarter-resolution separable highlight diffusion pass. The printed diary is
excluded from grading, mist and bloom so it still matches selectable HTML text.

Rebuild the six-bounce indirect lighting in a disposable Blender scene:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/bake-room-joinery.py -- assets/JapanRoom.glb /tmp/room-memory-bake --without-diary --dream
```

Copy `room-joinery.png` to `art/lightmaps/room-joinery-memory.png` and
`room-evening-architecture.png` to `art/lightmaps/room-memory-architecture.png`.
The joinery's material UVs and lighting UV byte layout stay identical to the
existing sidecars. RGBM remains linear, unpremultiplied, with range 32. The bake
uses 256 samples with denoised indirect irradiance, six diffuse bounces and ten
maximum bounces. Runtime and bake share the corrected charcoal reflectance and
plaster color, so the reflected light is consistent with the visible finishes.

The extra lower-shelf book stack and desk LP jackets were removed. The original
upper books and lower leaning sleeve remain. No generated imagery is used.
Depth-clipped fog retains 40% of the previous low-bank density and dissipates
away from the window. Warmer window wisps and muted pastel drift sample the
actual sun shadow map, so curtains and furniture affect the scattered light.
The fog ray march uses a half-resolution target, a separate full-display-resolution
opaque depth prepass, and depth-aware upsampling to retain moving thin edges.
The unshadowed RectAreaLight window fill was removed because it lit blocked
cabinet surfaces. Window sky bounce comes from the Cycles atlas; direct sun
uses real shadow occlusion. Fog in shadow only scatters weak ambient light;
pastel illumination follows the unblocked window path. The SSAO normal/depth pass renders both sides of folded linen; front-only
depth previously let the fog march behind the visibly opaque curtain. The shared atmosphere clock freezes
for reduced motion and while the room is hidden. Printed diary faces stay clear.
The poster retains its original UV crop on its authored grid, with
3.5 mm corner lift. Curtain changes keep the original UV grid, rail contacts
and ordered panel separation.

Checks: `tests/japan-room-memory.browser.cjs`, `japan-room-lighting.browser.cjs`,
`japan-room-curtains.browser.cjs`, `japan-room-poster-light.browser.cjs`,
`japan-room-pastel-fog.browser.cjs`, `japan-room-solid-occlusion.browser.cjs`, `japan-room-curtain-depth.browser.cjs`,
`japan-room-diary-handoff.browser.cjs`, and `tokyo-flight-performance.browser.cjs`.

Run `python3 tools/pack-lightmaps.py` after copying the source bakes to produce and verify the runtime WebP lighting.
