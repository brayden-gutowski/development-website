# Persistent diary binding

`diary-animation.js` exports `loadDiaryAnimation()` and synchronous `createDiaryBinding(gltf, room, source)`.

At room creation, load the GLB alongside room assets. After the original room material traversal, pass the original closed diary (`Cube010`) and `{scene, camera}` to `createDiaryBinding`. Assign the returned object to the public room's `diaryBinding` property. Replace the original diary's entries in picking targets and outline action meshes with `diaryBinding.meshes`; Three.js raycasting does not automatically skip invisible objects. The installer hides the original source.

The installer clones the cached asset scene and each mesh geometry for isolation between rooms. It retains a single installed instance per room. Its opaque cover uses the source's raw albedo map and color with a physical material under room lighting; printed pages use an opaque, untonemapped material to match readable HTML paper. All physical meshes cast and receive shadows.

The reader samples the same Blender clip, places the same installed meshes, and restores the original closed transform. It never re-parents the source, captures its lighting into a texture, substitutes an overlay model, or fades individual materials. While reading, HTML provides selectable text and controls over the still-visible physical binding. On mobile the binding follows the measured CSS book transform each frame, including the photo-side transition.

API: `object`, `meshes`, `rest`, `cover`, `coverImage`, `edges`, `duration`; `sample(progress)`, `place(matrix)`, `appearance(printTexture)`, `restore()`, and whole-object `opacity(value)` for compatibility. `shadow` aliases the actual `object`, rather than a shadow-only proxy. Readers should leave the object visible throughout its lifecycle.

Run `tests/japan-room-diary-same-binding.browser.cjs` with the normal local server and Playwright dependencies to verify that object, geometry, material identities and the restored matrix remain unchanged across the entire reading lifecycle. The original Blender authoring source remains `art/diary-opening.blend`.
