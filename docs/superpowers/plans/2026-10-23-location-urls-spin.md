# Location URLs and SPIN

Keep the existing Towski.dev host and buildless GitHub Pages setup. Use hash URLs so refreshing a deep link works without server rewrites. Update tab titles alongside URLs. Preserve old blog/book links as aliases.

- [x] Base title Towski.dev; `#gainesville` / `#nashville` on map hover and selected location, restored after hover. Tokyo uses `#tokyo` once inside its room; direct location links restore the view.
- [x] Canonical reader URLs `#tokyo/diary/table-of-contents`, `#tokyo/diary/<category>/<entry>`, `#tokyo/books/<entry>`. Closing readers returns to Tokyo, and leaving the room returns to the base site. Preserve navigation/back and routing during travel.
- [x] Copy supplied Kroi SPIN M4A without transcoding; use supplied cover on the vinyl and sleeve. Remove unused old track/artwork and update playback checks.
- [x] Verify real browser hover, titles, fresh deep links, diary contents, navigation and song decoding/playback; run existing unit and relevant room regressions.

No DNS change or deployment is part of this local change. Earlier mobile/performance edits remain in the checkout.

User confirmed location URLs under Towski.dev. Both supplied files match their source SHA-256 hashes. Seven unit tests and eight Chrome browser checks passed: location URLs, route retargeting, vinyl artwork/playback, record audio lifecycle, legacy blog links, review books, startup preparation, and mobile discovery. All 65 runtime asset references resolve; syntax and whitespace checks pass.

Independent review caught deferred destinations overriding newer routes and expired hover state after gestures. Both fixes have browser coverage. Prepared Explore starts travel in 1.5 ms with zero new scene/media downloads or shader programs; Chrome's favicon revalidation on URL changes is reported separately.
