# Memory and optimization audit — November 3, 2026

The audit preserves the fourth Tokyo book and Nashville review added earlier in this checkout. It covers normal navigation, retained caches, closed UI, pending preparation, failures/retries, media teardown and GPU/image ownership. Appearance, authored geometry, texture resolution and media effects are preserved. Measurements were taken from the local checkout before publication.

## Coverage

| Area | Reviewed production modules |
| --- | --- |
| Globe, routing, loading, input, drawers and diagnostics | `script.js`, `index.html`, `style.css`, `motion.mjs`, `tokyo-daylight.mjs` |
| Rooms, effects and decoded model data | `japan-room.js`, `gainesville-room.js`, `room-texture-residency.js`, `room-outline.js`, `room-finish.js`, `gainesville-lamp.js` |
| Flights and window atmosphere | `tokyo-flight.js`, `tokyo-clouds.js`, `tokyo-exterior.js` |
| Readers, physical bindings and paper | `book-reader.js`, `diary-reader.js`, `reader-ui.js`, `diary-animation.js`, `diary-print.js`, `review-bindings.js` |
| XP windows, input, audio and turntable | `xp-desktop.js`, `xp-desktop.css`, `record-player.js`, soundtrack/media code in the room modules |

## Reproduced and fixed

- **Failed Tokyo assembly:** a successfully downloaded model with an incompatible review-book object left 81 native ImageBitmaps open, a video element attached and a media blob URL live. One ownership guard now cleans partial assembly as well as initial asset failures and residency failures. The same reproduction finishes with zero open bitmaps, media elements or owned blob URLs.
- **Reader references:** cached reader controllers retained discarded room scenes through background print bindings, closed-book bindings and the diary's closed rig/motion references. They also retained removed focus triggers. Chrome WeakRef/garbage-collection checks now confirm those scenes and nodes are collectible while the readers stay alive. Printable page/image caches remain available for reuse.
- **Soundtrack teardown:** disposal during a pending AudioContext resume could touch the closed context and generate unhandled rejections; a disposed soundtrack could also restart. Disposal is now idempotent, disconnects the graph, removes the owned listener, cancels pending work and rejects reuse by returning the stopped state.
- **Shared scene disposal:** Gainesville used a second, weaker traversal instead of the existing scene disposer. It now shares that implementation. A regression with real uploaded textures in shader uniforms, a custom depth material and an instanced object improved from three remaining GPU textures to zero. The current authored scene does not require those extra paths; this test protects the common disposal contract.

The narrow lifetime regressions were observed failing before their fixes and passing afterward. Shared application instances, current print textures, compressed image downloads and one listener set per controller are bounded intentional caches, distinct from resources accumulating with visits.

## Reduced retained data and duplicate work

- The shared diary animation keeps its seven meshes and animation clip while releasing its unused GLTF parser and 927,264-byte duplicate binary buffer. A real loader/WeakRef check verifies both collection and unchanged shared loading.
- Record-player connectivity analysis runs in its own construction helper, allowing its parent array and component bounds to collect while the controller continues animating. This was bounded setup retention, rather than growth on each visit.
- Both readers reuse one live MediaQueryList. A repeated-layout regression reduced 202 native query creations to one while verifying changes to `.matches` and viewport width still take effect.
- Removed the unused `renderPrivateBlog`, `renderBookReviews` and `createStarRating` implementations: 245 lines / 10,369 bytes. All callers already use the canonical animated readers, including the no-WebGL fallback; the fallback has its own regression.
- Updated cache keys for modified runtime modules. No runtime dependency was added.

## Measurements and verification

The 30-cycle baseline includes XP windows, defocus/resume, both rooms, diary/books and globe visits. Each sample follows Chrome garbage collection. GPU textures stayed at 98, geometries at 113, DOM nodes at 1,666 and event listeners at 173. The final ten baseline heap samples ranged from 12.353 to 12.403 MiB, with no visit-driven resource growth.

The matching final 30-cycle run passed with no growing resource counters:

| Measurement | Baseline | After fixes |
| --- | --- | --- |
| GPU textures | 98 throughout | 97 throughout |
| GPU geometries | 113 throughout | 113 throughout |
| Shader programs | 107 throughout | 102 throughout |
| DOM nodes | 1,666 throughout | 1,666 throughout |
| Event listeners | 173 throughout | 173 throughout |
| Last ten collected heap samples | 12.353–12.403 MiB | 12.025–12.077 MiB |
| Closed XP windows on departure | 0 throughout | 0 throughout |

The warmed heap range is approximately 0.33 MiB lower. GPU/program counts depend on warmed shader variants; the relevant lifetime result is that they stay constant on repeated visits. The separately verified 927,264-byte loader buffer is native ArrayBuffer data and should not be conflated with JS heap figures.

Raw [baseline samples](2026-11-03-memory-before.json) and [final samples](2026-11-03-memory-after.json) retain every measurement. An additional [four-cycle normal-flight soak](2026-11-03-memory-flights.json) passed: 101 GPU textures, 144 geometries, 106 shader programs, 1,629 DOM nodes and 173 listeners on every sample, with no closed XP windows retained. Both inactive-room pixel residency and bounded diagnostic entries remained correct.

All 16 Node unit checks and all 58 maintained Chrome browser checks passed, including focused resumes after the fixture corrections below. Coverage includes failures/retries, real garbage collection, shader/bitmap cleanup, suspend/restore, pointer capture, XP windows, audio/video, all four books, direct links, mobile layouts, contours and rendering budgets. Independent read-only review found no actionable issue in the final runtime changes. Runtime JavaScript and offline Python tools parse; whitespace checks pass.

Verification also corrected four test assumptions: the passive CRT check waits for its rendered camera state; mobile backward wrapping selects the newly added fourth book; and the city lighting comparison holds render resolution constant and asserts it stays equal. Diagnostics showed the latter had compared 100% against 80% resolution. The displayed-outline white-pixel check likewise runs at native resolution; at 80% scale it measured antialiased edge pixels instead of broad glow. At native resolution its solid fraction is 97.1%. The separate render-budget regression still verifies automatic resolution adaptation. No production camera, weather, lighting or quality settings were changed for these checks.

## Limits

Finite tests cannot prove that no leak exists in every browser, device or possible interaction. Heap measurements exclude some decoded-media, GPU and browser-process allocations; native image closure, GPU counters, weak references and media ownership are checked separately. Chrome desktop/mobile emulation does not replace physical-device testing. No visual quality was reduced to obtain the results.
