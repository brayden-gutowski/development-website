"""Run Blender against a COPY of JapanRoom.blend; exports GLB, never saves the blend.
Blender --background --disable-autoexec /tmp/room-copy.blend --python tools/export-japan-room.py -- /tmp/JapanRoom.glb --photographic
Copy JapanRoom.glb, room-indirect.hdr and room-furniture.hdr together into assets/.
Bakes UV-based shader inputs so Poliigon mapping/color operations survive glTF.
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
# Freeze the evaluated cloth BEFORE the exporter evaluates its default pose.
curtain = bpy.data.objects['Curtain']
curtain.data = bpy.data.meshes.new_from_object(curtain.evaluated_get(bpy.context.evaluated_depsgraph_get()), preserve_all_data_layers=True, depsgraph=bpy.context.evaluated_depsgraph_get())
curtain.modifiers.clear()
curtain['roomClothFrame'] = scene.frame_current
for obj in scene.objects:
    collections = {c.name for c in obj.users_collection}
    action = next((action for name, action in [('Books', 'books'), ('Door', 'door'), ('RecordPlayer', 'music')] if name in collections), None)
    if obj.name in ['Cube.010', 'Cylinder.006']: action = 'diary'
    if action: obj['roomAction'] = action
    if obj.name == 'Vinyl': obj['roomRecord'] = True
    if obj.name in ['Text', 'Text.001']: obj['roomRole'] = 'speaker'

materials = set(m for o in scene.objects if o.type == 'MESH' for m in o.data.materials if m)
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
    if not material.use_nodes: continue
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf or not any(n.type == 'TEX_IMAGE' for n in nodes): continue
    plane.data.materials.clear()
    plane.data.materials.append(material)
    out = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
    original = out.inputs['Surface'].links[0].from_socket
    mapping = next((n for n in nodes if n.type == 'GROUP' and n.node_tree.name.startswith('.simple_uv_mapping')), None)
    uv_scale = mapping.inputs['Scale'].default_value if mapping else 1.0
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
    size = 2048 if material.name.startswith('Poliigon_Plaster') else 1024
    for kind in ['color', 'orm', 'normal']:
        path = os.path.join(cache, bpy.path.clean_name(material.name) + '-' + kind + '.png')
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
    def texture(kind):
        n = nodes.new('ShaderNodeTexImage'); n.image = maps[kind]; return n
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
    print('BAKED_MATERIAL', material.name, uv_scale, flush=True)

bpy.data.objects.remove(plane, do_unlink=True)
for obj, hidden in visibility.items(): obj.hide_render = hidden
# Portable glass, replacing a Cycles-only Glossy/Refraction shader mix.
material = bpy.data.materials.get('Material.001')
if material:
    nodes = material.node_tree.nodes; nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial'); bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (.96, .985, 1, 1)
    bsdf.inputs['Roughness'].default_value = .07
    bsdf.inputs['Transmission Weight'].default_value = 1
    bsdf.inputs['IOR'].default_value = 1.45
    material.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
if '--photographic' in sys.argv:
    runpy.run_path(os.path.join(os.path.dirname(__file__), 'light-japan-room.py'), init_globals={'output': output, 'source_hash': source_hash})
# Bound ancillary opacity/sheen textures after lighting preparation (Cycles
# can reload packed source images); keep the 2K baked wall detail.
for image in bpy.data.images:
    if image.source == 'FILE' and image.size[0] and max(image.size) > 1024 and not bpy.path.abspath(image.filepath).startswith(cache):
        ratio = 1024 / max(image.size)
        image.scale(round(image.size[0] * ratio), round(image.size[1] * ratio))
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', export_cameras=True, export_lights=True, export_extras=True, export_apply=True, use_visible=True, export_animations=False, export_current_frame=True, export_materials='EXPORT', export_image_format='JPEG', export_image_quality=94, export_import_convert_lighting_mode='COMPAT')
print('ROOM_EXPORT', json.dumps({'path': output, 'bytes': os.path.getsize(output)}), flush=True)
