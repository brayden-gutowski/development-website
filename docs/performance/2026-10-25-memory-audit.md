# Memory lifetime audit — 2026-10-25

The audit covered all application JavaScript modules, their construction/caller paths, event subscriptions, asynchronous completion, DOM ownership, GPU resources, image decoding, media playback and diagnostic caches. Offline export/packing tools were checked separately as finite process-lifetime work. The site retains one renderer, one instance of each room/reader/XP desktop, bounded authored data and compressed assets; these intentional caches are distinct from resources accumulating with use.

## Coverage

| Area | Files inspected |
| --- | --- |
| Application/globe/navigation | `script.js`, `index.html`, `style.css`, `motion.mjs`, `tokyo-daylight.mjs` |
| Rooms/GPU/image ownership | `japan-room.js`, `gainesville-room.js`, `room-texture-residency.js`, `room-outline.js`, `room-finish.js`, `gainesville-lamp.js` |
| Aerial approach/exterior | `tokyo-flight.js`, `tokyo-clouds.js`, `tokyo-exterior.js` |
| Readers/printed surfaces | `book-reader.js`, `diary-reader.js`, `reader-ui.js`, `diary-animation.js`, `diary-print.js`, `review-bindings.js` |
| Computer/audio/record | `xp-desktop.js`, `xp-desktop.css`, `record-player.js`, soundtrack and video owners in the room modules |
| Supporting code | `tools/`, tests and package scripts; no persistent background service or production dependency was added |

## Reproduced and corrected

- Closed or logged-off XP windows could remain referenced by an unfinished drag. Closing, logging off, defocusing and disposal now end owned pointer interactions and release captures. Repeated closed Explorer, Notepad, pictures, mail and utility windows become collectible under Chrome garbage collection.
- User-created session folders and renamed-file state survived real power-off and room departure. These now reset with the desktop session; defocusing preserves them as requested.
- Concurrent XP preparation could create multiple AudioContexts; late audio decoding could populate the sound cache after disposal. Preparation shares one promise/context, disposal aborts requests and clears buffers, and late results are discarded.
- Failed flight compilation could leave three uploaded textures and decoded atlas pixels. Both module construction and application shader warmup now dispose the failed flight before retry.
- A partially failed cloud upload could leave two GPU textures. Local cleanup now releases both textures and geometry when upload fails.
- A failed Gainesville asset batch could leave model ImageBitmaps and a late successful sibling texture. Asset settlement and scene-owned cleanup now account for both.
- Failed model residency setup could leave unused parser-associated bitmaps beyond those visible in the scene. Failure cleanup now closes every owned native bitmap.
- Tokyo reflection preparation continued rendering after disposal during a yielded frame. Disposal checks stop subsequent capture faces and prevent environment publication; the reproduction went from 37 GPU render calls after disposal to zero.
- Repeated Gainesville reflection preparation retained prior PMREM targets and renderer resources associated with new capture camera IDs. Replacement releases the previous target and reuses probe cameras; GPU allocations stay bounded.
- Fully disposed residency controllers could be prepared again. Disposal drops embedded blobs and prevents rehydration; interrupted decoding still closes late pixels.
- Application timing measures accumulated on every room visit. Diagnostics now retain only the latest entry for each named stage.
- Completed/canceled globe pointers could remain tracked when navigation took an early return. Input records now release before room/travel handling.

## Verification

The focused lifetime regressions were reproduced failing before their fixes, then verified passing. A legacy record-player test was also corrected to observe the AudioContext connected to its media element: background XP preparation creates a separate context. Diagnostics confirmed the record context was already suspended while the unrelated context was running; playback logic did not require a change. They exercise actual Chrome garbage collection, WeakRefs, ImageBitmap closure, GPU counters, partial failures, pending audio and pending room preparation.

The 30-cycle real application soak repeatedly opens projects, defocuses/resumes XP, exits Gainesville, enters Tokyo, opens/turns/closes diary and review books, returns to the globe, and re-enters Gainesville. Each sample follows explicit Chrome garbage collection. See [raw reduced-motion samples](2026-10-25-memory-soak.json).

- GPU textures: 95 on every sampled visit.
- GPU geometries: 110 on every sampled visit.
- DOM nodes: 1,596; JavaScript event listeners: 173, unchanged.
- Shader programs: 109 initially, then a stable 110 after adaptive rendering warms its additional variant.
- Collected JavaScript heap: 12.364–12.451 MiB over the final ten cycles (88.8 KiB difference across those samples), after normal initial code/cache warmup.
- Closed XP application windows: zero on every room-departure sample.
- Inactive Tokyo decoded model pixels/effect buffers remain suspended while Gainesville is in use.

An additional four-cycle soak with normal aerial travel passed: textures stayed at 99, geometries at 142, shader programs at 113, DOM nodes at 1,559 and listeners at 173. It retains separate [full-flight samples](2026-10-25-memory-soak-flights.json). The maintained browser suite also covers failure/retry, direct links, background loading, canceled departures, model/flight residency, audio/video, readers, mobile navigation, room interactions and rendering. Legacy mobile discovery now checks that background preparation follows foreground readiness; media snapshots wait for the loader to disappear. The city comparison checks unchanged geometry/camera/UV/video identity and architectural edges below the intended fine sand-grain scale; the separate sandstorm check verifies grain motion and indoor occlusion. No production media effect was changed to satisfy these tests.

These tests found no remaining leak in the audited paths. Finite testing cannot prove the absence of every possible leak on every browser/device. JavaScript heap figures are not total tab memory: decoded images, GPU allocations, media and Chrome itself have separate costs. The existing memory optimizations and source texture quality remain intact.


Final verification: 13/13 unit checks and all 50 maintained browser checks passed, including targeted reruns after correcting legacy test fixtures. The displayed outline comparison also waits for independently animated background-loading cards; it measured a 97.3% solid contour fraction, with no contour shader change. Runtime JavaScript and offline Python tools parse successfully; staged whitespace checks are clean. Final source-module cache keys use `20261025-leak-audit-2`; optimized model and lightmap asset URLs remain unchanged.
