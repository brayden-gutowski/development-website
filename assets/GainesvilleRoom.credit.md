# Gainesville room — original user models

The user's GainesvilleRoom.blend remains the source for the computer, table, lamp, exit sign and architecture. No replacement computer, peripherals, furniture, sign housing or doorway models are included. The original mesh topology, camera, material UVs and textures are retained. The previously authorized computer correction widens its original screen to 4:3 with even bezel widths, preserving height and depth.

This XP/lighting pass does not change mesh vertices or static transforms. Geometry fingerprints in GainesvilleRoom.source.json verify all 13 original mesh objects. The source `.blend` is never saved or modified.

Lighting uses a finite warm area practical, weak broad cool fill, floor bounce and faint local red EXIT spill. The steady fill/EXIT and practical illumination are baked separately with 96 samples into four denoised 2048px atlases using the same lightmap UVs. Static maps use lossless linear RGBM16 WebP; practical maps use RGBM64 for near-emitter highlights. Visible mesh emission is disabled only during transport bakes, which use explicit area emitters; the source emission sockets/links are then restored exactly for export. This prevents double-counting or EXIT glow flickering with the lamp.

Runtime retains fixed exposure/AgX. The monitor's area light follows sampled visible desktop/window content and fades at power-down. The original lamp's bulb, shade and cord swing about the real ceiling point and return to their exact original pose; only the practical lighting layer flickers. Original material colors/textures remain, with restrained environment-probe reflections on the casing/table, original curved-glass reflection and faint optical effects.

Supplied Poliigon photographic brick/wood textures remain the user's original media. No AI artwork or generated replacement material textures are included.

Rebuild into a clean temporary directory:

    Blender --background --disable-autoexec /path/to/GainesvilleRoom.blend --python tools/export-gainesville-room.py -- /tmp/gainesville-bake/GainesvilleRoom.glb --lighting
    python tools/pack-gainesville-light.py /tmp/gainesville-bake /tmp/gainesville-bake

Install the GLB together with all four matching lightmaps. `--draft-lighting` produces 512px previews. Production CPU rendering avoids Blender 4.2 Metal crashes on large bakes.

## Wall detail correction

The original export baked approximately 9.18 repeats of the brick material into 1024px, leaving about 111px per repeat. The corrected brick and plaster maps each store one 2048px tile. Their original tiling remains in `KHR_texture_transform`; lighting UV1 is unchanged. Lossless WebP preserves source bake pixels; 8× anisotropic filtering improves oblique views. No AI enhancement or generated textures are used.

For a material-only refresh, export a donor with `--detail-materials-only`, then run `tools/update-gainesville-materials.py LIT_GLB MATERIAL_GLB OUTPUT_GLB` using bundled Python/Pillow. The updater preserves mesh/lighting buffers, compacts replaced texture data and skips duplicate updates.

Third review lighting revision (2026-10-25): four matched2048px96-sample Cycles diffuse atlases replace the former transport. The original GLB, source textures, lightmap UVs and all thirteen source mesh fingerprints are unchanged. The practical is25W/.68m at approximately3400K; broad restrained fill/floor/brick bounce and local desaturated EXIT spill preserve dark corners. Runtime surfaces add bounded roughness variation, faint glass response and haze only near the original lamp.

Memory optimization (2026-10-25): three exactly constant embedded maps are stored as identical1×1 pixels. Other authored image pixels, material references, geometry and UVs are unchanged; the source blend is untouched. Inactive-room decoded images can be closed and reconstructed from their original compressed embedded bytes.

Fourth review lighting revision (2026-10-25): the finite practical widens to .76m at unchanged25W/approximately3400K. Local floor bounce increases15%, a faint .10W table-to-case fill reveals the housing, and the EXIT emitter moves closer to the brick for localized spill. Four matched2048px96-sample CPU Cycles atlases preserve the optimized GLB and source mesh/UV fingerprints. Measured indirect illumination rises12.91% under the table and17.22% on the casing front, with no global exposure change. The active XP desktop remains visible when defocused; real shutdown retains faint off-glass response.
