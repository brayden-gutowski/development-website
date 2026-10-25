# Website memory optimization

Goal: materially reduce steady browser memory while keeping the authored room detail, preloaded downloads, XP interface and seamless aerial transitions.

Measured baseline: isolated Chrome at1440×900, Gainesville active, both other areas fully prepared. Largest page renderer RSS954.1MiB, GPU process570.0MiB, JS heap10.8MiB,204 allocated Three.js textures. Process RSS includes native allocations and is a controlled comparison, not a claim about a browser's shared per-tab accounting.

- [x] Audit decoded textures and inactive render targets before changing quality.
- [x] Preserve all wall color/normal tiles at2048² and exact source geometry.
- [x] Replace seven exactly uniform model maps with identical1×1 pixels, preserving all other pixels/accessor bytes/material mappings.
- [x] Keep compressed aerial atlases downloaded; prepare/suspend their decoded bitmaps/GPU textures around actual travel. Rehydration reuses cached blobs and shaders, not network downloads.
- [x] Use existing4096px desktop star panorama instead of8192px; retain2560px compact background.
- [x] Remove unused depth attachments from fullscreen effects and release inactive-room effect buffers. Rewarm before entry with the shared offscreen target.
- [x] Keep compressed source images for inactive models; close decoded ImageBitmaps and free their textures until entry. Preserve exact source orientation, UVs, pixels and active-context restore.
- [x] Verify repeated room/globe trips and background/foreground races release memory without blank textures, stale maps, extra downloads or shader recompilation.
- [x] Repeat the same isolated memory snapshot and inspect room/globe visuals.

Evidence: `tools/profile-memory.cjs`; `/tmp/towski-memory-before.json`; first pass `/tmp/towski-memory-after.json` (renderer771.2MiB, GPU458.3MiB,165 textures). Final measurements to follow.

Final measured snapshot: largest renderer552.1MiB (42.1% below954.1), GPU process325.8MiB (42.8% below570),90 textures (down from204),JS heap10.7MiB. Both complete city atlas pyramids remain cached as compressed Blobs with zero idle resident aerial maps. Inactive Tokyo model images and effect targets are suspended while Gainesville remains resident.

Repeated warmed round trips stabilized at99 GPU textures on both visits (the first-ever globe visit uploads its own sky/earth maps). Full-resolution cached imagery/model restoration took513.8ms before Tokyo travel, with no additional scene download or shader compilation. Wall color/normal texture resolution remains2048²; exact image/geometry preservation is pinned by tests.

Verification:13 Node unit/asset checks;14 focused browser checks (flight/model/native texture residency, repeated room residency, unchanged wall detail/surface shaders, aerial travel, cross-room routing, background loading/retries, startup preloading, canceled departures, direct Tokyo, render budget, XP third-review and lamp/CRT lighting). Canceled/failed departure preparation also explicitly releases aerial pixels.

Results are recorded in `docs/performance/2026-10-25-memory.json`; reproduce with bundled NODE_PATH and `node tools/profile-memory.cjs`. Cache versions are20261025-memory-2.
