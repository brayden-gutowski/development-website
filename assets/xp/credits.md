# Windows XP assets — native resources only

All icon artwork is Microsoft Windows XP system artwork. No AI-generated, AI-upscaled, redrawn, or CSS-drawn icons are used. The previous high-resolution icon collection was removed.

Desktop folder/text/computer/recycle-bin icons and other system icons are extracted from the original XP `shell32.dll` preserved in [bartekl1/windows-ui-assets](https://github.com/bartekl1/windows-ui-assets/tree/main/Icons/Windows%20XP). The archived `.ico` files retain their native frames. The browser displays losslessly encoded PNG copies of the native 32×32 true-color frame, so it cannot select the older 16-color fallback. No resizing, redrawing, or AI processing is applied. The application uses a closed icon allowlist.

Original-size XP interface assets (Back, Forward, Up, All Programs, restart, account picture, Windows flag and logoff) are preserved from [ShizukuIchi/winXP](https://github.com/ShizukuIchi/winXP/tree/master/src/assets/windowsIcons). These are Microsoft artwork; that project's MIT code license does not change ownership of Microsoft's assets.

`icon-provenance.json` records the exact source resource IDs, pinned download URLs and SHA-256 hashes for every icon file. The archived DLL is read only as resource data and is not executed or shipped. Text labels are used where an exact original control pictogram is unavailable, rather than invented icons.

Bliss is the user's supplied Windows XP wallpaper photograph by Charles O'Rear. Existing project photographs remain user-provided media. Neither the wallpaper nor project photographs are AI-generated.

Original XP sounds and cursors are preserved from [bartekl1/windows-ui-assets](https://github.com/bartekl1/windows-ui-assets): Windows XP Startup, Start, Minimize, Restore and Shutdown WAVs; `arrow_m.cur` and `beam_r.cur`. Microsoft retains ownership of these proprietary originals; they are not presented as openly licensed artwork. Used at the user's explicit request for the original XP assets.

October 25 UI review: original XP wait, move, diagonal resize and hand cursor resources were added from the same archive, pinned to commit `21970f48b8f66b4d44742cb30388c1454512d681`. `icon-provenance.json` now records every cursor's pinned source and SHA-256. `hand-native.cur` is the first original CUR chunk extracted byte-for-byte from `hand.ani`, retaining its native pixels and hotspot. No cursor artwork was redrawn or resampled. The caption controls and notification chevron use the standard line/square/X and chevron glyphs expressly requested in the October 25 review; illustration icons remain exclusively original XP resources.

`original-start.png` preserves the complete original XP Start button asset from `ShizukuIchi/winXP` at pinned commit `856bb554b3667f62078010b4cee10cc2645761e1`; its flag and green button remain together in their source artwork. The exact runtime mapping and source SHA-256 are included in `icon-provenance.json`.

The boot flag uses a transparent copy of the archived original: only edge-connected pure-white background pixels receive zero alpha. All original RGB pixels and dimensions remain intact. This deterministic background mask uses no AI or redraw; provenance records both files.

Large desktop and file icons use the original 48×48 true-color frames from the same native XP ICO resources, encoded losslessly as PNG. They are not enlarged 32px copies or AI assets.

Third review: the yellow Stand By button is the native 32×32 resting frame from the original XP shutdown bitmap preserved by [ClassicShutdown](https://github.com/aubymori/ClassicShutdown/blob/dfd9ae79d16fb8f2684e83e4f99e5effe5305562/src/res/to_buttons.bmp). The complete source bitmap is retained, and its [0,96,32,128] frame is encoded losslessly as PNG; its pixels have not been resized, recolored, redrawn, or AI-processed. Microsoft's ownership remains unchanged by the archive project's GPL code license. Source, frame coordinates and SHA-256 are recorded in the provenance manifest.

`../miners-tycoon.png` is the user's supplied Roblox Studio project screenshot, copied unchanged from the October 25 attachment. No generated artwork or image edits were applied.

The nonempty Recycle Bin uses Microsoft's original `shell32.dll` group 33 icon: the original ICO plus losslessly encoded native 32×32 and 48×48 true-color frames. It has the same immutable archive source and provenance as the empty bin.

Fourth review: My Computer's Local Disk and CD drive use the unchanged native32/native48 frames from original XP `shell32.dll` RT_GROUP_ICON 8 and 12. Log Off uses the original yellow-key resting frame at [0,96,32,128] in `shell32.dll` RT_BITMAP 14356. The full bitmap resource is retained with a BMP header; the native indexed-color palette pixels are preserved in the PNG frame. Only the original magenta color-key index2 is marked transparent, matching the XP bitmap mask.

The compact Picture and Fax Viewer controls are Microsoft's original XP SP1 `shimgvw.dll` IDB_TOOLBARHIGH (105) artwork, preserved in [the XP resource archive](https://github.com/tongzx/nt5src/blob/daad8a087a4e75422ec96b7911f1df4669989611/Source/XPSP1/NT/shell/ext/shimgvw/res/toolbar.bmp). The complete source bitmap is retained. Native16 frames 0/1/2/3/5/6 supply previous/next/zoom in/zoom out/best fit/actual size. The original 32-bit BGRA pixels, including alpha, are losslessly encoded as PNG: no resizing, tinting, painting, or AI. Frame meanings match the original `prevwnd.cpp` toolbar table. These resources remain proprietary Microsoft artwork, included at the user's explicit request for genuine XP resources; the archive supplies no new artwork license. Exact immutable source URLs, frame coordinates and SHA-256 hashes are recorded in `icon-provenance.json`.
