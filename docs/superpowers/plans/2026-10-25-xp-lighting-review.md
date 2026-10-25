# XP and lighting review

Scope: user supplied 45-point review plus subsequent request for a clickable overhead lamp. Preserve all 13 original source mesh objects and the previously authorized 4:3 computer correction. No replacement models, extra furniture, or AI artwork. The new lamp interaction is the third room action alongside Computer and Exit.

## XP 1–25

- Standard caption line/square/X and tray chevron replace word placeholders, with immediate Luna hover/pressed states.
- Boot copyright/Microsoft footer, hidden startup pointer, moving blue blocks and Welcome transition; no visible StartingWindows caption. Source Windows flag's edge-connected white background is alpha-masked without changing its original RGB pixels or dimensions.
- Native whole Start bitmap keeps the flag integrated. Existing two-column Start menu retained.
- Explorer file tasks, standard OtherPlaces and selection-dependent Details. New folders/renames remain session-local; copy downloads a text copy. Original project records are preserved. Unknown modification dates explicitly read “Not recorded.”
- Active/inactive title bars/taskbar/selection, live clock, XP cursors, working resize and Notepad WordWrap/default no-wrap. Native bitmap icon allowlist/provenance maintained.
- Original wallpaper aspect and 1024×768 desktop retained; optical softness/scanlines remain subtle and mobile layout readable.

## Lighting 26–45

- Source lamp becomes a finite soft warm area emitter; weak broad cool fill, floor bounce and faint local red EXIT spill reveal shadow detail without changing exposure.
- Steady fill/EXIT and practical illumination are baked separately onto the same lightmap UVs. RGBM16 static and RGBM64 practical layers retain HDR highlights. Practical flicker leaves steady lighting intact. Mesh emission is disabled during transport bakes and restored before export; explicit area emitters avoid double-counted emissive bounce.
- Monitor area light uses sampled visible desktop/window/image colors, window area and occlusion rather than window count. White Notepad is brighter/more neutral; black/off fades toward zero. No camera-dependent exposure.
- Restrained reflections on original plastic/table finishes, existing curved glass/environment reflection and faint optical sheen. No thick added fog or broad screen bloom.

## Overhead lamp interaction

Original bulb, shade and cord rotate together about the real ceiling suspension. A small damped swing and two soft dim pulses finish within 7.2s. Reduced motion gives one gentle dim and no swing. Original parents, matrices and vertex buffers return exactly to rest. Hover/touch outline and keyboard button identify the lamp.

Validation covers original geometry/proportions/hash records, native icon/cursor provenance, XP desktop/mobile UI, sampler/occlusion, lamp picking/swing/reset/reduced motion, screen-light fade, constant exposure and room/globe navigation. Final visual checks include wide room, Bliss, white Notepad and powered-off glass.
