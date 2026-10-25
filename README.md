# Towski.dev

An interactive globe and authored Tokyo and Gainesville rooms for Brayden Gutowski’s projects, music reviews, Japanese diary, and book reviews. Live site: [towski.dev](https://towski.dev).

## Local development

Serve the repository root; no production build or package installation is required:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173>. Three.js is pinned in the import map. The Globe, Tokyo and Gainesville share background preparation with visible progress. Explore reuses the prepared area, and direct room/reader links use the same loaders. Inactive rooms and approach imagery release decoded image pixels and GPU effect buffers while retaining compressed downloads for the next visit. Failed preparation can be retried.

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

Location previews update on map or navigation hover/focus. Tokyo and Gainesville offer Explore; their exits return to the globe. Selecting a location keeps its address. Closing a reader restores Tokyo. Tab titles match each view and use Towski.dev. Older `#blog/...` and `#book-review/...` links still open the corresponding reader.

## Mobile interactions

Touch devices show persistent white outlines only on the five interactive room objects: diary, books, record player, curtains, and door. Desktop retains hover/focus contours. Opening a reader clears the room contours until it closes. Contour visibility uses native GPU depth, avoiding packed-depth reconstruction on mobile.

Books and diary show one fitted page on a phone, including landscape. Use **Left page / Right page** or swipe horizontally to inspect both sides. Continue swiping to move between entries/books. Existing page/book navigation and keyboard shortcuts remain available. Text that exceeds a small screen scrolls inside its page. The × control or Escape returns the book to the room.

## Gainesville computer

The room uses the supplied Gainesville models and original photographic textures. Click the computer to approach its Windows XP desktop; click outside it or press Escape to return to the room. The desktop stays powered and retains open windows while defocused. Leaving the room releases those windows; Turn Off shuts the computer down, while Log Off returns to its Welcome screen.

General, Game Development and Competition contain project text files. Notepad wraps plain text; Explorer provides external project links. Project pictures share one Picture and Fax Viewer. XP icons and toolbar resources retain their native pixels and recorded provenance in `assets/xp/`. The Recycle Bin contains Miner's Tycoon. Clicking the overhead lamp adds to its swing and briefly flickers its practical illumination.

## Repository map

| Location | Responsibility |
| --- | --- |
| `index.html`, `style.css`, `script.js` | Globe, navigation, content and application lifecycle |
| `japan-room.js`, `gainesville-room.js`, `room-finish.js`, `room-outline.js`, `record-player.js` | Authored rooms, contours, lighting and audio |
| `xp-desktop.js`, `xp-desktop.css`, `gainesville-lamp.js` | XP desktop, window lifecycle and interactive lamp |
| `room-texture-residency.js` | Decoded model image ownership and restoration |
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

Browser checks require the local server and Google Chrome. They use Playwright and pngjs only as development tools. Run one check with `node tests/<name>.browser.cjs`, or all with `npm run test:browser -- --all`. `TEST_URL` changes the server address in checks that support it. Screenshots go to the system temporary directory. `memory-soak` repeatedly exercises both rooms, the globe, XP and readers, collecting Chrome heap/DOM/listener counts and GPU resources after garbage collection. `gpu-resource-lifetimes`, `area-loader-failure` and `xp-lifetimes` cover interrupted loading and disposal. See [memory audit](docs/performance/2026-10-25-memory-audit.md).

## Asset authoring

Do not add props in code: room contents come from the authored Blender scene. Preserve source `.blend` files. See [architecture and export notes](docs/architecture.md) and [art notes](art/README.md).

The active RGBM source PNGs live in `art/lightmaps/`. After rebaking, run `python3 tools/pack-lightmaps.py` with Pillow available. It checks every RGBA byte before replacing runtime WebP files, including the alpha channel that stores light intensity.

The room plays the supplied **Kroi — SPIN** recording from `assets/kroi-spin.m4a`, copied without transcoding. `assets/kroi-spin-cover.png` is the supplied artwork on both the circular vinyl label and the record sleeve. Playback retains the existing needle lead-in, pause/resume, surface noise and ending runout.

While SPIN itself plays, the original city/apartment view takes on warm Western sunlight and a sandstorm: fast sideways grains at two depths, swirling gusts, and a rolling dust veil. The city remains visible behind it. All storm layers render on the outdoor plane, so walls, glass framing, and curtains naturally hide the flying sand. The fully buffered 27-second city video loops continuously throughout the full 305-second song; there is no separate short replacement clip or extra media download. Pausing, ending, hiding the tab, or leaving restores the ordinary lighting. Reduced motion freezes the footage and storm. The genuine city still remains the video fallback. See [footage source and license](assets/tokyo-window.credit.md).

Never add AI-generated artwork, photos, or video. Use owner-supplied media or genuine openly licensed/public-domain media and retain credits; see [the repository media policy](AGENTS.md).
