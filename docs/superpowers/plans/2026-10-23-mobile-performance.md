# Mobile discovery, readers, and loading

**Goal:** Show persistent white outlines for touch users, fit one readable book page on phones with explicit side controls and swipe navigation, and reduce unnecessary startup work.

**Approach:** Preserve the authored Three.js room and desktop spreads. Reuse its occlusion-aware outline pass for all touch targets. Share reader DOM helpers, mobile detection, and side controls. Load readers with Tokyo rather than the globe; start Tokyo preparation on selection. Keep full-quality assets available and avoid a framework or runtime dependency.

**Git:** The actual repository is `development-website/`, clean at `743d375` on `main`, matching the known `origin/main`. No divergent commits require replaying. Work in this checkout for local review; do not publish.

- [x] Record baseline startup requests/bytes and add failing mobile behavior checks.
- [x] Consolidate reader helpers and add accessible Left/Right controls, swipe behavior, and fitted single-page layouts. Verify portrait, small phones, landscape, resize, and closing.
- [x] Persist all room contours on touch devices, preserve desktop hover, and suppress room contours while a reader owns the view. Outline HTML controls for touch users.
- [x] Defer Tokyo-only modules/assets until selection; remove duplicate preparation and consolidate asset selectors. Optimize measured payload costs where visual data is preserved.
- [x] Organize test entry points and documentation, run targeted browser regressions plus unit tests, compare loading bytes, and review the diff.

**Review focus:** Hidden page focus, interrupted close/swipe, switching books while viewing the left side, viewport changes, direct links and retryable load errors.

**Results:** See [measured verification](../../mobile-performance-2026-10-23.md). Independent review fixed backward-swipe target framing and mobile diary transition specificity. Source PNGs were retained under art/lightmaps and packed losslessly for runtime. Successful fetch confirmed no commits to rebase. Work remains local and uncommitted for review.
