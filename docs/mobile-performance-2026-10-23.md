# Mobile usability and loading — October 23, 2026

Touch visitors see persistent white contours around all five room actions and white outlines on HTML links/buttons. Desktop keeps hover/focus contours. Room contours pause while a reader holds the camera and return when it closes.

Both readers use shared Left page / Right page controls, page-side focus rules, and horizontal swipes. A complete page fits portrait and landscape phone screens; long content scrolls within its paper. The diary now has an explicit close control. Existing routing, keyboard navigation, pickup/return animations, and authored room contents remain intact.

## Loading measurements

Same local Chrome setup, fresh browser, 390×844 viewport, touch enabled, Reduce Motion enabled. Resource bytes sampled after 12 seconds on the initial globe, without selecting Tokyo:

| Measurement | Before | After |
| --- | ---: | ---: |
| Encoded resource bytes | 39,099,284 | 1,817,370 |
| Globe usable, sampled run | 1,655 ms | 1,265 ms |
| Active lighting files | 6,744,690 bytes | 3,720,230 bytes |

Initial resource downloads fell about 95%. Tokyo selection starts shared preparation; Explore awaits it. When preparation finished, Explore started travel in 2 ms with zero new downloads or shader programs. First-time Tokyo visits still download the room and media, and the authored flight keeps its existing duration. These are local measurements, not physical-device timing guarantees.

Lighting WebP files preserve every decoded RGBA byte, including RGBM alpha. Original PNGs remain in `art/lightmaps/`; `tools/pack-lightmaps.py` verifies exact equality before replacing runtime files.

## Organization

- `reader-ui.js` consolidates DOM creation, easing, side controls, mobile detection and focus trapping.
- `review-bindings.js` separates physical bindings from reader UI.
- One globe asset selector replaces four repeated selectors.
- Redundant mobile CSS overrides and duplicate startup preparation were removed.
- Unit tests live in `tests/`; `npm test` and `npm run test:browser` provide documented entry points with locked development dependencies.
- `README.md` provides the current setup and repository map; detailed authoring/history moved to `docs/architecture.md`.

## Verification

Seven unit tests pass. Fifteen Chrome browser regression files passed: mobile reader, mobile discovery, startup preparation, review books, landscape reader, diary mobile close, prepared diary pickup, blog links, rendered outlines, load retry, mobile room rendering/layout, diary refinement/settling, and review motion.

The motion check sampled 14,358 frames across desktop, phone portrait, and short landscape: zero collisions or stalls. Tests cover normal-motion backward swipes, reduced-motion slides, hidden-page focus, resize, routing during load/turns, source cleanup/retry, and light/shadow continuity. All 65 literal runtime asset paths resolve; JavaScript syntax and Git whitespace checks pass. WebKit was unavailable in this environment.

Independent review findings for backward-swipe layout and diary transition specificity were fixed and verified. Existing mobile tests now select each page before checking bounds and scrolling.

GitHub was fetched successfully. Local `main` and `origin/main` both point to `743d375`, with zero divergent commits, so no history replay was necessary. Changes are saved locally without publishing.
