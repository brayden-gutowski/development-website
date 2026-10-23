# Towski.dev

An interactive globe and authored Tokyo room for Brayden Gutowski’s projects, music reviews, Japanese diary, and book reviews. Live site: [towski.dev](https://towski.dev).

## Local development

Serve the repository root; no production build or package installation is required:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173>. Three.js is pinned in the import map. Tokyo modules, media, and GPU preparation start when Tokyo is selected; Explore awaits that same preparation. Direct diary/review links use the same path, and failures can be retried.

## Location URLs

The host stays `towski.dev`. Hash URLs work on GitHub Pages and can be refreshed or shared without server rewrites:

| View | URL suffix |
| --- | --- |
| Normal globe | `/` |
| Gainesville | `/#gainesville` |
| Nashville | `/#nashville` |
| Tokyo room | `/#tokyo` |
| Diary contents | `/#tokyo/diary/table-of-contents` |
| Diary entry | `/#tokyo/diary/<category>/<entry>` |
| Book review | `/#tokyo/books/<entry>` |

Gainesville/Nashville previews update on map or navigation hover/focus and restore on leave, drag, or zoom. Selecting a location keeps its address; Tokyo appears after room entry. Closing a reader restores Tokyo; the door restores the base site. Tab titles match each view and use Towski.dev. Older `#blog/...` and `#book-review/...` links still open the corresponding reader.

## Mobile interactions

Touch devices show white outlines on buttons, links, and all five interactive room objects: diary, books, record player, curtains, and door. Desktop retains hover/focus contours. Opening a reader clears the room contours until it closes.

Books and diary show one fitted page on a phone, including landscape. Use **Left page / Right page** or swipe horizontally to inspect both sides. Continue swiping to move between entries/books. Existing page/book navigation and keyboard shortcuts remain available. Text that exceeds a small screen scrolls inside its page. The × control or Escape returns the book to the room.

## Repository map

| Location | Responsibility |
| --- | --- |
| `index.html`, `style.css`, `script.js` | Globe, navigation, content and application lifecycle |
| `japan-room.js`, `room-finish.js`, `record-player.js` | Authored room rendering, contours, lighting and audio |
| `book-reader.js`, `diary-reader.js`, `reader-ui.js` | Readers and shared responsive controls/focus rules |
| `review-bindings.js`, `diary-animation.js`, `diary-print.js` | Physical book bindings, animation and print textures |
| `tokyo-*.js`, `motion.mjs`, `tokyo-daylight.mjs` | City approach, clouds, motion and daylight math |
| `assets/` | Runtime media and packed lighting |
| `art/` | Blender sources, source lighting PNGs and authoring notes |
| `tools/` | Offline export, packing and test commands |
| `tests/` | Unit and browser regression checks |
| `docs/` | Architecture, implementation notes and measured verification |

## Checks

```sh
npm test
npm install
npm run test:browser
```

Browser checks require the local server and Google Chrome. They use Playwright and pngjs only as development tools. Run one check with `node tests/<name>.browser.cjs`, or all with `npm run test:browser -- --all`. `TEST_URL` changes the server address in checks that support it. Screenshots go to the system temporary directory.

## Asset authoring

Do not add props in code: room contents come from the authored Blender scene. Preserve source `.blend` files. See [architecture and export notes](docs/architecture.md) and [art notes](art/README.md).

The active RGBM source PNGs live in `art/lightmaps/`. After rebaking, run `python3 tools/pack-lightmaps.py` with Pillow available. It checks every RGBA byte before replacing runtime WebP files, including the alpha channel that stores light intensity.

The room plays the supplied **Kroi — SPIN** recording from `assets/kroi-spin.m4a`, copied without transcoding. `assets/kroi-spin-cover.png` is the supplied artwork on both the circular vinyl label and the record sleeve. Playback retains the existing needle lead-in, pause/resume, surface noise and ending runout.
