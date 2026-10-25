"""Bake the original Gainesville Cycles diffuse lighting before portable export.
Called by export-gainesville-room.py in a disposable Blender process. Preserves
source lights, world, material UVs and geometry; adds a second lighting UV set.
"""
import bpy
import bmesh
import math
import os
import sys
import numpy as np

scene = bpy.context.scene
source_resolution=(scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12 if '--draft-lighting' in sys.argv else 96
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 6
scene.cycles.use_denoising = True
# Metal can crash between atlas bakes on macOS, even for 512px previews.
# Keep CPU stable by default; an explicit GPU option is available for drafts.
scene.cycles.device = 'GPU' if '--draft-lighting' in sys.argv and '--gpu-lighting' in sys.argv and '--cpu-lighting' not in sys.argv else 'CPU'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices: device.use = device.type == 'METAL'
    if not any(device.use for device in prefs.devices): scene.cycles.device = 'CPU'
except Exception:
    scene.cycles.device = 'CPU'
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render and o.data.materials and o.data.polygons]
# Applying transforms changes no world-space geometry and lets UV packing use
# actual surface area rather than the tiny unapplied primitive scales.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    mirrored=o.matrix_world.determinant()<0
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Cycles surface baking follows mesh normals, unlike two-sided camera
    # shading. A mirrored tabletop needs its winding restored after applying scale.
    if mirrored:o.data.flip_normals()
    o.select_set(False)
# The room shell is rendered from the back of several two-sided faces in
# Cycles. Bake the side seen from inside, rather than the outside sky-facing
# normals; otherwise the walls inherit outdoor world illumination.
room_shell=bpy.data.objects['Cube']
mesh=bmesh.new();mesh.from_mesh(room_shell.data)
normal_matrix=room_shell.matrix_world.to_3x3().inverted().transposed()
eye=scene.camera.matrix_world.translation
for face in mesh.faces:
    center=room_shell.matrix_world @ face.calc_center_median()
    normal=normal_matrix @ face.normal
    if normal.dot(eye-center)<0:face.normal_flip()
mesh.to_mesh(room_shell.data);mesh.free();room_shell.data.update()

def bake_group(objects, name, size):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
        o.data.uv_layers[0].active_render = True
        o.data.uv_layers.new(name='RoomLightmap')
        o.data.uv_layers.active_index = len(o.data.uv_layers)-1
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008, area_weight=.3)
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=.012 if name.endswith('furniture') else .006)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Both layers share exactly the same lighting UVs. Static fill and EXIT
    # stay steady while the practical can flicker without changing exposure.
    lights = {o: o.data.energy for o in scene.objects if o.type == 'LIGHT'}
    background = scene.world.node_tree.nodes.get('Background')
    world_strength = background.inputs['Strength'].default_value if background else 0
    practical_name = name.replace('gainesville-light-', 'gainesville-practical-')
    for layer, practical_only in [(name, False), (practical_name, True)]:
        for obj, energy in lights.items():
            obj.data.energy = energy if (obj.name == 'Point') == practical_only else 0
        if background: background.inputs['Strength'].default_value = 0 if practical_only else world_strength
        atlas = bpy.data.images.new(layer, size, size, alpha=False, float_buffer=True)
        atlas.colorspace_settings.name = 'Non-Color'
        nodes = []
        for material in {m for o in objects for m in o.data.materials if m}:
            material.use_nodes = True
            node = material.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = atlas
            material.node_tree.nodes.active = node
            nodes.append((material,node))
        scene.render.bake.margin = 2 if size < 1024 else 8
        scene.render.bake.use_clear = True
        scene.render.bake.use_selected_to_active = False
        print('GAINESVILLE_BAKE_START',layer,scene.cycles.device,flush=True)
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT','INDIRECT'}, uv_layer='RoomLightmap')
        scene.use_nodes = True
        tree = scene.node_tree; tree.nodes.clear()
        source = tree.nodes.new('CompositorNodeImage'); source.image = atlas
        denoise = tree.nodes.new('CompositorNodeDenoise'); denoise.use_hdr = True
        dest = tree.nodes.new('CompositorNodeOutputFile')
        dest.base_path = os.path.dirname(output); dest.format.file_format = 'OPEN_EXR'; dest.format.color_depth = '32'
        dest.file_slots[0].path = layer+'-clean-'
        tree.links.new(source.outputs['Image'],denoise.inputs['Image'])
        tree.links.new(denoise.outputs['Image'],dest.inputs[0])
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.render.resolution_percentage = 100; scene.cycles.samples = 1
        render_visibility = {o:o.hide_render for o in scene.objects}
        try:
            for o in render_visibility: o.hide_render = True
            bpy.ops.render.render()
        finally:
            for o,hidden in render_visibility.items(): o.hide_render = hidden
        clean = bpy.data.images.load(os.path.join(os.path.dirname(output),layer+'-clean-'+str(scene.frame_current).zfill(4)+'.exr'))
        pixels = np.empty(size*size*4,dtype=np.float32); clean.pixels.foreach_get(pixels)
        np.save(os.path.join(os.path.dirname(output),layer+'.npy'),pixels.reshape(size,size,4))
        for material,node in nodes: material.node_tree.nodes.remove(node)
        tree.nodes.clear(); scene.use_nodes = False
        bpy.data.images.remove(atlas); bpy.data.images.remove(clean)
        scene.cycles.samples = 12 if '--draft-lighting' in sys.argv else 96
        print('GAINESVILLE_BAKE_DONE',layer,flush=True)
    for obj,energy in lights.items(): obj.data.energy = energy
    if background: background.inputs['Strength'].default_value = world_strength
    for obj in objects:
        obj.data.uv_layers.active_index = 0
        obj['roomLightmap'] = name
        obj['roomPracticalLightmap'] = practical_name

# Explicit area emitters represent the bulb and EXIT transport. Disable mesh
# emission during baking so it cannot appear in both layers, then restore the
# exact source material sockets/links before exporting their visible glow.
emission_sockets = []
for material in {m for obj in meshes for m in obj.data.materials if m and m.use_nodes}:
    for node in material.node_tree.nodes:
        socket = node.inputs.get('Emission Strength') if node.type == 'BSDF_PRINCIPLED' else node.inputs.get('Strength') if node.type == 'EMISSION' else None
        if socket is None: continue
        original = socket.links[0].from_socket if socket.is_linked else None
        emission_sockets.append((material,socket,socket.default_value,original))
        if socket.is_linked: material.node_tree.links.remove(socket.links[0])
        socket.default_value = 0
try:
    bake_group([o for o in meshes if o.name=='Cube'],'gainesville-light-architecture',512 if '--draft-lighting' in sys.argv else 2048)
    bake_group([o for o in meshes if o.name!='Cube'],'gainesville-light-furniture',512 if '--draft-lighting' in sys.argv else 2048)
finally:
    for material,socket,value,original in emission_sockets:
        socket.default_value = value
        if original is not None: material.node_tree.links.new(original,socket)
scene['roomLightingSource']='blender'

scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=source_resolution
