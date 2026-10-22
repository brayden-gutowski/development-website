"""Rebake joinery from a web GLB in a disposable scene; never open/save a .blend.
Blender --background --factory-startup --python tools/bake-room-joinery.py -- /tmp/JapanRoom-export.glb /tmp/room-evening
UV0 is preserved. Sidecar UV1 follows the original GLB triangle corner order.
"""
import bpy, json, struct, sys, os, math, hashlib
import numpy as np
from mathutils import Vector
source, output = sys.argv[sys.argv.index('--')+1:][:2]
without_diary = '--without-diary' in sys.argv
dream = '--dream' in sys.argv
os.makedirs(output, exist_ok=True)
raw = open(source,'rb').read(); size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]); binary=raw[28+size:]
def accessor(index):
    a=doc['accessors'][index]; v=doc['bufferViews'][a['bufferView']]
    types={5126:'f',5125:'I',5123:'H',5121:'B'}; components={'VEC3':3,'VEC2':2,'SCALAR':1}
    n=components[a['type']]; fmt='<'+types[a['componentType']]*n
    stride=v.get('byteStride',struct.calcsize(fmt)); start=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from(fmt,binary,start+i*stride) for i in range(a['count'])]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source, merge_vertices=False)
scene=bpy.context.scene
# Portable source textures remain albedo; tiny normal variations are live shading.
for m in bpy.data.materials:
    if not m.use_nodes: continue
    for node in m.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED' and node.inputs['Normal'].is_linked:
            for link in list(node.inputs['Normal'].links): m.node_tree.links.remove(link)
    if dream:
        for node in list(m.node_tree.nodes):
            if node.type!='BSDF_PRINCIPLED':continue
            socket=node.inputs['Base Color']
            if not socket.is_linked:continue
            source_color=socket.links[0].from_socket
            if 'SmoothDeltaBlack' in m.name or 'BarnwoodDeltaBlack' in m.name:
                scale=m.node_tree.nodes.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=3.2
                floor=m.node_tree.nodes.new('ShaderNodeVectorMath');floor.operation='MAXIMUM';floor.inputs[1].default_value=(.028,.026,.023)
                m.node_tree.links.new(source_color,scale.inputs[0]);m.node_tree.links.new(scale.outputs[0],floor.inputs[0]);m.node_tree.links.new(floor.outputs[0],socket)
            elif 'Plaster' in m.name or 'Stucco' in m.name:
                mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.inputs[0].default_value=.23;mix.inputs[1].default_value=(.62,.615,.60,1)
                m.node_tree.links.new(source_color,mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],socket)
for o in scene.objects:
    if o.type=='LIGHT': o.data.energy*=.38; o.data.color=(1,.89,.73)
    if o.name=='Glass': o.visible_shadow=False
    if o.name in ['Left speaker lead','Record player lead']: o.hide_render=True
# Moving objects must not leave a permanent indirect shadow in the desk atlas.
# Their shadows and contact occlusion are evaluated live by the web renderer.
if without_diary:
    diary=bpy.data.objects.get('Cube.010')
    if diary:
        for o in [diary, *diary.children_recursive]: o.hide_render=True
# A broad, neutral-warm sky and low-angle sun create late-afternoon bounce.
world=bpy.data.worlds.new('Evening bake sky'); world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.73,.77,.86,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5 if dream else .35
scene.world=world
for name,kind,energy,color,position,direction,size in [
    ('Late afternoon sun','SUN',1.7,(1,.72,.43),(10,-2,5),(-1,-.7,-.24),0),
    ('Window sky bounce','AREA',480 if dream else 280,(.80,.88,1),(4.82,-4.6,2.12),(-1,0,-.05),1.8),
]:
    data=bpy.data.lights.new(name,kind); data.energy=energy; data.color=color
    if kind=='SUN':data.angle=math.radians(2.5)
    else:data.shape='RECTANGLE';data.size=size;data.size_y=1.8
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=position
    o.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
fabric=bpy.data.materials.get('Poliigon_FabricUpholsterySolid_9281_2K')
if fabric and fabric.use_nodes:
    tree=fabric.node_tree;out=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL')
    original=out.inputs['Surface'].links[0].from_socket
    transparent=tree.nodes.new('ShaderNodeBsdfTransparent');mix=tree.nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.72
    tree.links.new(original,mix.inputs[1]);tree.links.new(transparent.outputs[0],mix.inputs[2]);tree.links.new(mix.outputs[0],out.inputs['Surface'])
objects=[bpy.data.objects[name] for name in ['Cube.002','Cube.011']]
original_uv={o.name:[tuple(v.uv) for v in o.data.uv_layers[0].data] for o in objects}
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    o.select_set(True)
    for uv in o.data.uv_layers:uv.active_render=False
    o.data.uv_layers[0].active_render=True
    o.data.uv_layers.new(name='EveningJoinery');o.data.uv_layers.active_index=len(o.data.uv_layers)-1
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.018,area_weight=.3)
bpy.ops.uv.pack_islands(rotate=True,scale=True,margin_method='FRACTION',margin=.012)
bpy.ops.object.mode_set(mode='OBJECT')
# Match source corners by position + UV0, not importer vertex numbering.
def key(p,uv):return tuple(round(v,6) for v in (*p,*uv))
uvs={}; combined=[]
for o in objects:
    mesh=o.data;mesh.calc_loop_triangles(); lookup={}
    base=mesh.uv_layers[0].data; new=mesh.uv_layers['EveningJoinery'].data
    for triangle in mesh.loop_triangles:
        corners={};corner_keys=[]
        for loop_index in triangle.loops:
            v=mesh.vertices[mesh.loops[loop_index].vertex_index].co; uv=base[loop_index].uv
            k=key((v.x,v.z,-v.y),(uv.x,1-uv.y)); corner_keys.append(k); corners[k]=(new[loop_index].uv.x,1-new[loop_index].uv.y)
        lookup[tuple(sorted(corner_keys))]=corners
    node=next(n for n in doc['nodes'] if n.get('name')==o.name)
    primitive=doc['meshes'][node['mesh']]['primitives'][0]
    positions=accessor(primitive['attributes']['POSITION']);uv0=accessor(primitive['attributes']['TEXCOORD_0']);indices=[v[0] for v in accessor(primitive['indices'])]
    floats=[]
    for i in range(0,len(indices),3):
        keys=[key(positions[j],uv0[j]) for j in indices[i:i+3]]
        corners=lookup.get(tuple(sorted(keys)))
        assert corners is not None, 'Source triangle mismatch: '+o.name+str(keys)
        for k in keys:floats.extend(corners[k])
    uvs[o.name]={'offset':len(combined)*4,'count':len(floats)//2}
    combined.extend(floats)
    assert original_uv[o.name]==[tuple(v.uv) for v in mesh.uv_layers[0].data], 'Changed original UV0'
open(os.path.join(output,'room-joinery-uv.bin'),'wb').write(struct.pack('<'+'f'*len(combined),*combined))
open(os.path.join(output,'room-joinery-uv.json'),'w').write(json.dumps({'meshes':uvs,'source':hashlib.sha256(raw).hexdigest()}))
print('JOINERY_UV_MATCHED',uvs,flush=True)
scene.render.engine='CYCLES';scene.cycles.samples=1024
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.005
scene.cycles.max_bounces=10;scene.cycles.diffuse_bounces=6;scene.cycles.sample_clamp_indirect=3
scene.cycles.device='GPU'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type!='CPU'
except Exception:scene.cycles.device='CPU'
def bake(objects, layer, name, margin):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    scene.cycles.samples=256 if dream else 1024
    atlas=bpy.data.images.new(name,2048,2048,alpha=False,float_buffer=True);atlas.colorspace_settings.name='Non-Color'
    for m in {m for o in objects for m in o.data.materials if m}:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=atlas;m.node_tree.nodes.active=n
    scene.render.bake.margin=margin;scene.render.bake.use_clear=True;scene.render.bake.use_selected_to_active=False
    print('LIGHT_BAKE_START',name,scene.cycles.device,flush=True)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'INDIRECT'},uv_layer=layer)
    atlas.filepath_raw=os.path.join(output,name+'-raw.hdr');atlas.file_format='HDR';atlas.save()
    # Denoise irradiance with padded islands; no Gaussian blur across atlas edges.
    scene.use_nodes=True;tree=scene.node_tree;tree.nodes.clear()
    n=tree.nodes.new('CompositorNodeImage');n.image=atlas
    d=tree.nodes.new('CompositorNodeDenoise');d.use_hdr=True
    f=tree.nodes.new('CompositorNodeOutputFile');f.base_path=output;f.format.file_format='HDR';f.file_slots[0].path=name+'-clean-'
    tree.links.new(n.outputs['Image'],d.inputs['Image']);tree.links.new(d.outputs['Image'],f.inputs[0])
    scene.render.resolution_x=scene.render.resolution_y=2048;scene.render.resolution_percentage=100;scene.cycles.samples=1
    bpy.ops.render.render()
    clean=bpy.data.images.load(os.path.join(output,name+'-clean-'+str(scene.frame_current).zfill(4)+'.hdr'))
    clean.colorspace_settings.name='Non-Color'
    rgb=np.array(clean.pixels[:],dtype=np.float32).reshape(2048,2048,4)[:,:,:3]
    assert rgb.max()<32,'RGBM range exceeded'
    mult=np.maximum(1,np.ceil(rgb.max(axis=2)/32*255))/255
    rgba=np.ones((2048,2048,4),dtype=np.float32);rgba[:,:,:3]=np.clip(rgb/(32*mult[:,:,None]),0,1);rgba[:,:,3]=mult
    packed=bpy.data.images.new('Joinery RGBM',2048,2048,alpha=True,float_buffer=False)
    packed.colorspace_settings.name='Non-Color';packed.alpha_mode='CHANNEL_PACKED';packed.pixels.foreach_set(rgba.ravel())
    packed.file_format='PNG';packed.filepath_raw=os.path.join(output,name+'.png');packed.save()
    print('LIGHT_BAKE_DONE',name,float(rgb.max()),os.path.getsize(packed.filepath_raw),flush=True)

bake(objects,'EveningJoinery','room-joinery',16)
if not without_diary or dream:
    architecture=bpy.data.objects['Cube']
    bake([architecture],architecture.data.uv_layers[1].name,'room-evening-architecture',4)
