# Gainesville third review and background loading implementation plan

> **For agentic workers:** Use the executing-plans or subagent-driven-development workflow for the owned subsystem and verify the integrated result before completion.

**Goal:** Complete the user's full third review, add the supplied Miner's Tycoon project to Recycle Bin, and preload other areas with a compact glass notification queue.

**Architecture:** Preserve the original thirteen mesh objects and source textures. Improve transport with matched Cycles lightmaps, add restrained material variation in the existing Three.js materials, and extend the existing XP shell. Scene preparation is cached and coordinated independently from active navigation.

**Tech stack:** Three.js r169, native JavaScript/CSS, Blender/Cycles, Playwright and existing Node asset checks; no new runtime dependency.

**Spec:** User's third review at `/Users/brayden/.codex/attachments/61f9b262-ffe6-42fc-847c-c4f446ee379c/Pasted text.txt`, exact Miner's Tycoon text/image/link in the user message, and the subsequent background loading request.

## Global constraints

- User's source Blender file remains untouched; no model replacement or geometry changes.
- No AI artwork or new invented XP illustration icons. Preserve original icon provenance.
- Keep the cheerful XP wallpaper/dark room contrast, warm practical/cool CRT, restrained EXIT, and readable auto-wrapped text.
- Preserve earlier requested removals: no lamp sound, no ASCII logo, no three white external controls.
- No commit, publishing, or deployment requested. Preserve all unrelated uncommitted work.

## Review focus

- Native mouse/touch/keyboard operation, including Recycle Bin project/image and mobile window bounds.
- Dynamic screen spill responds to visible content and fades off without global exposure shifts or rendering occluded windows twice.
- Shader variation compiles on the existing GL renderer and preserves original UV1 lightmaps, normals and anisotropic detail.
- Atlas/model coherence and exact source geometry fingerprints after lighting bake.
- Background loading never steals focus, changes routes/cameras, blocks foreground navigation, or marks failed loads complete.

## Task 1 — XP shell and Recycle Bin

Files: xp-desktop.js, xp-desktop.css, script.js app data, supplied image asset, XP tests.

- [x] 1. Project websites Explorer title/taskbar match location.
- [x] 2. Outlook Express mail folders, message list, From/To/Subject/Date headers and period toolbar.
- [x] 3. Outlook menus File/Edit/View/Tools/Message/Help.
- [x] 4. Recycle Bin uses Explorer shell and contains Miner's Tycoon.txt; opening shows exact user text, linked Here and separate screenshot window.
- [x] 5. Status singular/plural.
- [x] 6. Native yellow Stand By / red Turn Off / green Restart icons.
- [x] 7. Start highlighting follows hover, keyboard selection remains correct.
- [x] 8–9. Hide cursor through shutdown and Welcome transitions.
- [x] 10. Reduce visible pixel texture by about25%.
- [x] 11. Consistent active/inactive overlapping window states.
- [x] 12. Consistent 1024×768 Luna sizing; responsive phone accessibility retained.
- [x] Verify updated desktop/mobile XP and provenance checks.

## Task 2 — Offline transport

Files: tools/export-gainesville-room.py, tools/bake-gainesville-light.py, matching atlas assets and manifest file hashes.

- [x] 13,17. Soften tabletop monitor shadow using broader effective practical area; avoid painted symmetrical black region.
- [x] 14–16,18,24. Weak broad cool fill and floor/under-table bounce retain faint brick/wood shadow detail without changing total exposure.
- [x] 19–20. Natural local less-saturated EXIT falloff and warm3200–3500K practical.
- [x] Verify draft, promote coherent model/atlases, preserve original geometry fingerprints and high-resolution source textures.

## Task 3 — Runtime surfaces and atmosphere

Files: gainesville-room.js, focused runtime visual/material tests.

- [x] 21–22. Verify active CRT's content-dependent color/brightness and smooth off response; retain weak blue/neutral spill.
- [x] 23,33. Restrained view-dependent lamp reflection; off screen retains faint room reflections.
- [x] 25–26. Fine low-contrast tabletop roughness/diffuse variation.
- [x] 27–28. Subtle plastic roughness and warm/cool variation.
- [x] 29–30. Matte brick roughness variation and broad modulation reduce repeated dark patches at unchanged tile scale.
- [x] 31–32. Board-scale floor roughness variation with reduced high-frequency normal response in deep shadow.
- [x] 34. Extremely faint haze localized near lamp, no room-wide low fog.
- [x] 35–36. Preserve dark corners, reduce EXIT dominance modestly.
- [x] 37. Keep display stable, no repetitive horror flicker.
- [x] 38. Gentle local glass/response adaptation on approach, constant global exposure and readable XP.
- [x] 39–40. Preserve warm/cool contrast and quiet composition, no particles/heavy fog/halos.
- [x] Verify compiled shaders, rendered output, room interaction and source geometry.

## Task 4 — Background loading queue

Files: script.js loading lifecycle, index.html, style.css, focused loading tests.

- [x] Sequential cached preparation of other areas after foreground ready, including globe from direct room entry.
- [x] Small glass cards top-left show actual progress/stages while exploring.
- [x] Completed card slides left, next card moves up; reduced motion respected.
- [x] Foreground requests reuse loading promises without focus/route/camera or main HUD changes.
- [x] Failures remain retryable and never claim completion.
- [x] Verify globe/Tokyo/Gainesville starts and navigation during background preparation.

## Integration

- [x] Run asset/native resource tests plus relevant XP, lamp, lighting/material, room/flight/routing and loading browser checks.
- [x] Inspect wide room, screen off/Bliss/white document, Miner's Tycoon, Outlook and notifications at desktop and phone sizes.
- [x] Record all review items and verified pre-existing behavior in this checklist; report any actual limitation candidly.

## Work log

- XP1–12 desktop/phone third-review, native bitmap provenance and existing XP tests passed. The exact supplied Miners Tycoon screenshot was copied unchanged, SHA256 `7a83cf3f24d4cda5ff7d436f75839d7021d83b437fae6e3b49cc0f98da59cba2`.
- Runtime variation uses original material maps, unchanged UVs and fine/broad bounded response modulation. Fog now follows the actual bulb and is localized. Independent Chrome review verified all28 GPU programs link and renderer state survives injected failure. Off-glass base reflectance was increased after the review found its original reflection still too dark.
- Background area queue passed direct-Tokyo and direct-Gainesville cases, real download progress, focus/URL preservation, notification dismissal, reduced motion and forced network failure recovery. Final combined navigation checks remain to run.
- Full four2048px96sample lighting bake is running on CPU after Metal failed on the second atlas; draft comparisons confirmed softened desk shadow, warmer practical, less EXIT spill and readable floor shadows with dark corners. No original mesh payload was changed.

- Final coherent lighting maps were promoted with exact new file hashes. The original GLB remains SHA256 `cce4d16659fcce3a347edbdc4d4a99488d3c15bf790e6901cdcc99faec39682d`; all10 unit/provenance tests passed after promotion.
- Integrated GPU surface/reflection, lighting, native wall-detail, third-review XP, XP authenticity/controls, silent lamp and room tests passed. New floor/desk lighting values retain a dark wall (~3.9/255) against readable desk (~118/255), with no global exposure change.
- Independent background code review found no new render-target/navigation corruption. It caught an existing optional-flight null-cache retry edge; corrected it and added a forced failed-manifest retry check.

## Final verification

- All10 Node unit/asset/provenance checks passed after final atlas promotion.
- All16 targeted browser checks passed in isolated sequential runs: surface response; lighting; wall detail; third-review XP; XP authenticity; XP controls; silent lamp/content lighting; room interaction; flight; routing; background loading/failure/imagery retry; loading progress; startup preloading; direct Tokyo entry; restored wordmark glitch; adaptive render budget.
- Source GLB and geometry fingerprints remain unchanged. The final source Blender hash matches the original.
- Background preloading uses real asset counts or indeterminate preparation stages; it keeps global routes/cameras/focus steady, completes slide-left/slot-up behavior, and retries failed optional flight imagery on later navigation. Prepared Tokyo Explore started travel in2.5ms in the measured browser run with no new scene programs or assets except the favicon.
- Verification screenshots include `/tmp/gainesville-third-final-room.png`, `/tmp/gainesville-third-final-miners.png`, `/tmp/gainesville-xp-third-review-mail.png`, `/tmp/gainesville-xp-third-review-mail-mobile.png`, and `/private/tmp/towski-background-areas.png`.
- Outlook project messages are read-only; no email or external-account integration is implied. Recycle Bin project records are preserved and not actually deleted.
