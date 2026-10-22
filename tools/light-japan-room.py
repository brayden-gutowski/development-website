"""Photographic web-export preparation. Runs inside the disposable Blender copy.

Called by export-japan-room.py --photographic. Never saves a .blend.
The shared HDR atlas stores diffuse lighting; live specular reflections and cloth
remain responsive in the browser. UV0 and its baked textures stay intact.
"""
import bpy
import math
import os
from mathutils import Vector

scene = bpy.context.scene
bpy.ops.object.select_all(action='DESELECT')
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
for obj in meshes:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Millimetre-sized edge radii, applied before the second UV unwrap.
    if obj.name not in ['Cube', 'Curtain', 'Glass', 'Cube.005']:
        bevel = obj.modifiers.new('Web edge highlights', 'BEVEL')
        width = .005 if obj.name in ['Cube.002', 'Cube.011'] else .0015
        bevel.width = width
        bevel.segments = 3
        bevel.limit_method = 'ANGLE'
        bevel.harden_normals = True
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        for polygon in obj.data.polygons: polygon.use_smooth = True
        normals = obj.modifiers.new('Web weighted normals', 'WEIGHTED_NORMAL')
        normals.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normals.name)
        obj['roomBevel'] = width
    obj.select_set(False)

# Small, purposeful wear and placement differences, never random clutter.
bpy.data.objects['Cube.008'].rotation_euler.z += math.radians(-1.3)
bpy.data.objects['Cube.010'].rotation_euler.z += math.radians(2)
# Daylight enters the actual window. The glass and thin linen must allow
# light transport during the Cycles bake instead of acting as opaque blockers.
bpy.data.objects['Glass'].visible_shadow = False
fabric = bpy.data.materials.get('Poliigon_FabricUpholsterySolid_9281_2K')
nodes, links = fabric.node_tree.nodes, fabric.node_tree.links
out = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
original = out.inputs['Surface'].links[0].from_socket
transparent = nodes.new('ShaderNodeBsdfTransparent')
mix = nodes.new('ShaderNodeMixShader')
mix.inputs[0].default_value = .72
links.new(original, mix.inputs[1]); links.new(transparent.outputs[0], mix.inputs[2])
links.new(mix.outputs[0], out.inputs['Surface'])

world = bpy.data.worlds.new('Web daylight')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.55,.67,.85,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .25
scene.world = world
scene.objects['Light'].data.energy = 180
scene.objects['Light'].data.shadow_soft_size = .55
sun_data = bpy.data.lights.new('Baked window daylight', 'SUN')
sun_data.energy = 2.4
sun_data.color = (1,.89,.73)
sun_data.angle = math.radians(3)
sun = bpy.data.objects.new('Baked window daylight', sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = Vector((-1,.5,-.7)).to_track_quat('-Z','Y').to_euler()
sky_data = bpy.data.lights.new('Window sky fill', 'AREA')
sky_data.energy = 450
sky_data.color = (.76,.86,1)
sky_data.shape = 'RECTANGLE'
sky_data.size = 1.8
sky_data.size_y = 2
sky = bpy.data.objects.new('Window sky fill', sky_data)
scene.collection.objects.link(sky)
sky.location = (4.8,-4.6,2.1)
sky.rotation_euler = Vector((-1,0,-.15)).to_track_quat('-Z','Y').to_euler()

targets = [o for o in meshes if o.name not in ['Curtain','Glass','Vinyl','Cube.005'] and len(o.data.polygons) > 8]
normal_links = []
for material in {m for o in targets for m in o.data.materials if m}:
    # The light atlas stores broad irradiance. Baking tiny tangent-space bumps
    # into it undersampled their detail and amplified noise on dark surfaces.
    # The original normal textures are restored for the live material shader.
    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED' and node.inputs['Normal'].is_linked:
            link = node.inputs['Normal'].links[0]
            normal_links.append((material, link.from_socket, node.inputs['Normal']))
            material.node_tree.links.remove(link)
scene.render.engine = 'CYCLES'
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4
scene.cycles.device = 'GPU'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices: device.use = device.type != 'CPU'
except Exception:
    scene.cycles.device = 'CPU'
scene.render.bake.margin = 4
scene.render.bake.use_clear = False
scene.render.bake.use_selected_to_active = False
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False

def bake_group(objects, filename):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        if not obj.data.materials: obj.data.materials.append(bpy.data.materials.get('Material') or bpy.data.materials.new('Room fallback material'))
        if not obj.data.uv_layers: obj.data.uv_layers.new(name='UVMap')
        for uv in obj.data.uv_layers: uv.active_render = False
        obj.data.uv_layers[0].active_render = True
        obj.data.uv_layers.new(name='RoomLightmap')
        obj.data.uv_layers.active_index = len(obj.data.uv_layers)-1
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    original_uv = {obj: [(uv.uv.x, uv.uv.y) for uv in obj.data.uv_layers[0].data] for obj in objects}
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.008, area_weight=.2)
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=.005)
    bpy.ops.object.mode_set(mode='OBJECT')
    atlas = bpy.data.images.new(filename, 2048, 2048, alpha=False, float_buffer=True)
    atlas.colorspace_settings.name = 'Non-Color'
    bake_nodes = []
    for material in {m for o in objects for m in o.data.materials if m}:
        material.use_nodes = True
        node = material.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = atlas
        material.node_tree.nodes.active = node
        bake_nodes.append((material, node))
    scene.cycles.samples = 256
    atlas_path = os.path.join(os.path.dirname(output), filename)
    print('ROOM_LIGHT_BAKE_START', filename, len(objects), scene.cycles.device, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'}, uv_layer='RoomLightmap')
    atlas.filepath_raw = atlas_path
    atlas.file_format = 'HDR'
    atlas.save()
    # Bake passes bypass the render denoiser. Denoise only irradiance so the
    # authored albedo/normal maps retain their original detail and UV scale.
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    image_node = tree.nodes.new('CompositorNodeImage')
    image_node.image = atlas
    denoise = tree.nodes.new('CompositorNodeDenoise')
    denoise.use_hdr = True
    blur = tree.nodes.new('CompositorNodeBlur')
    blur.filter_type = 'FAST_GAUSS'
    blur.size_x = blur.size_y = 2
    file_out = tree.nodes.new('CompositorNodeOutputFile')
    file_out.base_path = os.path.dirname(output)
    file_out.format.file_format = 'HDR'
    file_out.file_slots[0].path = 'room-clean-'
    tree.links.new(image_node.outputs['Image'], denoise.inputs['Image'])
    tree.links.new(denoise.outputs['Image'], blur.inputs['Image'])
    tree.links.new(blur.outputs['Image'], file_out.inputs[0])
    resolution = (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage)
    scene.render.resolution_x = scene.render.resolution_y = 2048
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 1
    bpy.ops.render.render()
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = resolution
    os.replace(os.path.join(os.path.dirname(output), 'room-clean-' + str(scene.frame_current).zfill(4) + '.hdr'), atlas_path)
    for material, node in bake_nodes: material.node_tree.nodes.remove(node)
    for obj in objects:
        assert original_uv[obj] == [(uv.uv.x, uv.uv.y) for uv in obj.data.uv_layers[0].data], 'Lighting bake changed material UVs: ' + obj.name
        obj['roomLightmap'] = filename
        obj['roomMaterialUV'] = obj.data.uv_layers[0].name
        obj.data.uv_layers.active_index = 0
    tree.nodes.clear()
    bpy.data.images.remove(atlas)
    print('ROOM_LIGHT_BAKE_DONE', atlas_path, os.path.getsize(atlas_path), flush=True)

# Separate atlases give narrow shelves enough texels without a large 4K GPU
# allocation or sacrificing the room's broad, softly bounced light gradients.
bake_group([o for o in targets if o.name == 'Cube'], 'room-indirect.hdr')
bake_group([o for o in targets if o.name != 'Cube'], 'room-furniture.hdr')
for material, source, target in normal_links: material.node_tree.links.new(source, target)
for node in [mix, transparent]: nodes.remove(node)
links.new(original, out.inputs['Surface'])
bpy.data.objects.remove(sun, do_unlink=True)
bpy.data.objects.remove(sky, do_unlink=True)
scene['roomLightingSource'] = source_hash
scene['roomLightingMode'] = 'indirect'
