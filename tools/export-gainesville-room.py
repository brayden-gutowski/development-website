"""Export a web copy of GainesvilleRoom.blend, preserving material mapping.
Run Blender --background --disable-autoexec SOURCE --python tools/export-gainesville-room.py -- OUTPUT
Never saves or modifies the source .blend. Temporary material bakes sit beside OUTPUT.
"""
import bpy
import json
import hashlib
import os
import sys
import runpy

output = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
with open(bpy.data.filepath, 'rb') as source:
    source_hash = hashlib.sha256(source.read()).hexdigest()
cache = os.path.join(os.path.dirname(output), 'room-material-bakes-' + source_hash[:12])
os.makedirs(cache, exist_ok=True)
scene = bpy.context.scene
# Correct proportions by moving the original vertices only: no replacement
# meshes, topology, materials, depth changes or new hardware. Keep the authored
# monitor height; widen the glass to 4:3 and hold the surrounding bezel even.
from mathutils import Vector
computer, screen = scene.objects['Computer'], scene.objects['Screen']
case_points = [computer.matrix_world @ v.co for v in computer.data.vertices]
glass_points = [screen.matrix_world @ v.co for v in screen.data.vertices]
lo = Vector(tuple(min(p[i] for p in glass_points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in glass_points) for i in range(3)))
center = (lo + hi) / 2
case_lo = Vector(tuple(min(p[i] for p in case_points) for i in range(3)))
case_hi = Vector(tuple(max(p[i] for p in case_points) for i in range(3)))
height = hi.z - lo.z
new_half_width = height * 4 / 3 / 2
border = ((case_hi.z - case_lo.z) - height) / 2

def remap(value, old_low, old_high, new_low, new_high, outer_low, outer_high):
    if value < old_low:
        return new_low - (old_low - value) * border / (old_low - outer_low)
    if value > old_high:
        return new_high + (value - old_high) * border / (outer_high - old_high)
    return new_low + (value - old_low) * (new_high - new_low) / (old_high - old_low)

for obj in [computer, screen]:
    inverse = obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        point.x = remap(point.x, lo.x, hi.x, center.x-new_half_width, center.x+new_half_width, case_lo.x, case_hi.x)
        if obj == computer:
            point.z = remap(point.z, lo.z, hi.z, lo.z, hi.z, case_lo.z, case_hi.z)
        vertex.co = inverse @ point
    obj.data.update()
scene['originalComputerProportions'] = {'displayAspect': 4/3, 'bezelWidth': border, 'displayWidth': height*4/3, 'displayHeight': height, 'sourceCaseHeight': case_hi.z-case_lo.z, 'sourceCaseDepth': case_hi.y-case_lo.y}
print('ORIGINAL_COMPUTER_PROPORTIONS', dict(scene['originalComputerProportions']), flush=True)

# Lighting-only changes. Original mesh objects and material mapping stay intact.
practical = scene.objects.get('Point')
if practical:
    practical.data.type = 'AREA'
    practical.data.shape = 'DISK'
    # The effective emitter includes the shade's diffuse reflection: a wider
    # source softens the monitor's central shadow without raising exposure.
    practical.data.size = .76
    practical.data.energy = 25
    practical.data.color = (1, .49, .24)  # approximately 3400 K in linear RGB
    practical.rotation_euler = (0, 0, 0)

def area(name, energy, color, position, target, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Room indirect fill', 8, (.76,.82,1), (-.4,1.4,2.6), (-.4,-2,1.1), 5.0)
area('Floor reflected bounce', .92, (1,.72,.48), (-.45,-.9,.24), (-.45,-.9,1.2), 3.0)
area('Low room reflected fill', 5.75, (.8,.85,1), (-.45,-.35,1.05), (-.45,-.35,0), 3.5)
# A faint upward lobe represents tabletop reflection onto the CRT casing.
area('Table reflected case fill', .10, (1,.72,.48), (-.45,-.15,1.37), (-.45,-.7,1.68), .72)
# Keep the same weak wall energy, offset it to give the brick a gradual gradient.
area('Brick indirect fill', 1.1, (.9,.88,.84), (-.95,-3.35,2.3), (-.55,-6.4,2.05), 3.3)
sign = scene.objects.get('ExitSign')
if sign:
    # Move the emitter close to the wall: localized irradiance peaks beside the
    # sign and decays by distance rather than painting a broad red wash.
    area('EXIT reflected red', .12, (1,.24,.18), (sign.location.x,sign.location.y-.32,sign.location.z), (sign.location.x,-6.4,sign.location.z), .40)
scene['roomLightingRevision'] = 'fourth-review local bounce: 15% under-table lift, faint tabletop case fill, softer practical, weak brick gradient and local EXIT spill'

# Preserve named interaction groups; the Blender source is never saved.
for obj in scene.objects:
    if obj.name in ['Computer', 'Screen']: obj['roomAction'] = 'computer'
    if obj.name == 'ExitSign': obj['roomAction'] = 'door'
if '--lighting' in sys.argv:
    runpy.run_path(os.path.join(os.path.dirname(__file__), 'bake-gainesville-light.py'), init_globals={'output':output})
materials = {o.data.materials[p.material_index] for o in scene.objects if o.type == 'MESH' and len(o.data.materials) for p in o.data.polygons if o.data.materials[p.material_index]}
visibility = {o: o.hide_render for o in scene.objects}
for obj in visibility: obj.hide_render = True
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1
scene.render.bake.margin = 0
scene.render.bake.use_clear = True
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.mesh.primitive_plane_add(size=2)
plane = bpy.context.object
plane.name = 'Material bake reference'

for material in sorted(materials, key=lambda m: m.name):
    if not material.use_nodes or material.get('roomPortableMaterial'): continue
    detail = any(tag in material.name for tag in ['BrickWall','PlasterStucco'])
    if '--detail-materials-only' in sys.argv and not detail: continue
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf or not any(n.type == 'TEX_IMAGE' for n in nodes): continue
    plane.data.materials.clear()
    plane.data.materials.append(material)
    out = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
    original = out.inputs['Surface'].links[0].from_socket
    mapping = next((n for n in nodes if n.type == 'GROUP' and n.node_tree.name.startswith('.simple_uv_mapping')), None)
    uv_scale = mapping.inputs['Scale'].default_value if mapping else 1.0
    # Bake one detailed tile rather than squeezing repeated source images into
    # a single 1024px bake. glTF carries the repeat separately on material UV0.
    if detail and mapping: mapping.inputs['Scale'].default_value = 1
    # Bake colors and the packed roughness/metalness signals without lighting.
    # Emit avoids black diffuse bakes on metallic materials.
    emission = nodes.new('ShaderNodeEmission')
    packed = nodes.new('ShaderNodeCombineColor')
    packed.mode = 'RGB'
    packed.inputs[0].default_value = 1
    for target, source in [(packed.inputs[1], bsdf.inputs['Roughness']), (packed.inputs[2], bsdf.inputs['Metallic'])]:
        if source.is_linked: links.new(source.links[0].from_socket, target)
        else: target.default_value = source.default_value
    target_node = nodes.new('ShaderNodeTexImage')
    maps = {}
    size = 2048 if detail else 1024
    for kind in ['color', 'orm', 'normal']:
        path = os.path.join(cache, bpy.path.clean_name(material.name) + ('-tile-2048-v2-' if detail else '-') + kind + '.png')
        if os.path.exists(path):
            image = bpy.data.images.load(path, check_existing=True)
        else:
            image = bpy.data.images.new(material.name + '-' + kind, width=size, height=size, alpha=False)
            image.colorspace_settings.name = 'sRGB' if kind == 'color' else 'Non-Color'
            target_node.image = image
            nodes.active = target_node
            if kind == 'normal': links.new(original, out.inputs['Surface'])
            else:
                links.new(emission.outputs[0], out.inputs['Surface'])
                if emission.inputs['Color'].is_linked: links.remove(emission.inputs['Color'].links[0])
                signal = bsdf.inputs['Base Color']
                if kind == 'orm': links.new(packed.outputs[0], emission.inputs['Color'])
                elif signal.is_linked: links.new(signal.links[0].from_socket, emission.inputs['Color'])
                else: emission.inputs['Color'].default_value = signal.default_value
            bpy.ops.object.bake(type='NORMAL' if kind == 'normal' else 'EMIT', normal_space='TANGENT')
            image.filepath_raw = path
            image.file_format = 'PNG'
            image.save()
        image.colorspace_settings.name = 'sRGB' if kind == 'color' else 'Non-Color'
        maps[kind] = image
    # Keep the original material's Principled settings (IOR, sheen, coat, etc.).
    # Replace only the unsupported input graphs with their baked results.
    links.new(original, out.inputs['Surface'])
    for n in [emission, packed, target_node]: nodes.remove(n)
    uv_node = nodes.new('ShaderNodeUVMap'); uv_node.uv_map = 'UVMap'
    repeat = nodes.new('ShaderNodeMapping'); repeat.vector_type = 'POINT'
    repeat.inputs['Scale'].default_value = (uv_scale, uv_scale, 1) if detail else (1,1,1)
    links.new(uv_node.outputs['UV'],repeat.inputs['Vector'])
    def texture(kind):
        n = nodes.new('ShaderNodeTexImage'); n.image = maps[kind]
        links.new(repeat.outputs['Vector'],n.inputs['Vector']); return n
    links.new(texture('color').outputs['Color'], bsdf.inputs['Base Color'])
    split = nodes.new('ShaderNodeSeparateColor'); split.mode = 'RGB'
    links.new(texture('orm').outputs['Color'], split.inputs[0])
    links.new(split.outputs[1], bsdf.inputs['Roughness'])
    links.new(split.outputs[2], bsdf.inputs['Metallic'])
    normal = nodes.new('ShaderNodeNormalMap')
    links.new(texture('normal').outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    # Keep source material coordinates explicit when a second UV atlas is baked.
    uv_node = nodes.new('ShaderNodeUVMap')
    uv_node.uv_map = 'UVMap'
    for node in nodes:
        if node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
            links.new(uv_node.outputs['UV'], node.inputs['Vector'])
    material['roomBakedMaterial'] = True
    material['roomUVScale'] = uv_scale
    if detail:
        material['roomTextureDetail'] = 'single-tile-2048-v2'
        if mapping: mapping.inputs['Scale'].default_value = uv_scale
    print('BAKED_MATERIAL', material.name, uv_scale, flush=True)

bpy.data.objects.remove(plane, do_unlink=True)
for obj, hidden in visibility.items(): obj.hide_render = hidden

# Restrict ancillary texture sizes too; source images are unchanged on disk.
for image in bpy.data.images:
    limit = 2048 if any(name in image.name for name in ['BrickWall', 'WoodDeck', 'WoodRough']) or '-tile-2048-v2-' in image.filepath else 1024
    if image.source == 'FILE' and image.size[0] and max(image.size) > limit:
        ratio = limit / max(image.size)
        image.scale(round(image.size[0]*ratio), round(image.size[1]*ratio))
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_cameras=True, export_lights=True, export_extras=True, export_apply=True, use_visible=True, export_animations=False, export_materials='EXPORT', export_image_format='AUTO', export_image_quality=98, export_import_convert_lighting_mode='COMPAT')
print('ROOM_EXPORT', output, os.path.getsize(output), flush=True)
