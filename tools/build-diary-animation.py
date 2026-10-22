"""Blender 4.2: author a bound diary and its pickup/opening clip.
Run: Blender -b --factory-startup --python tools/build-diary-animation.py
Writes an editable .blend and a small glTF animation; original room is untouched.
"""
import bpy, bmesh, math, os, json, struct
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND=os.path.join(ROOT,'art','diary-opening.blend')
GLB=os.path.join(ROOT,'assets','diary','diary-opening.glb')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Reuse the existing leather in the editable Blender preview.
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'assets','JapanRoom.glb'))
leather_image=next((i for i in bpy.data.images if 'FabricLeatherVintageDustyBrown' in i.name and 'color' in i.name),None)
if leather_image:
    leather_image=leather_image.copy();leather_image.name='Authored diary leather';leather_image.scale(512,512);leather_image.pack()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,image=None):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.84
    if image:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
    return m
leather=material('Diary leather',(.61,.37,.25),leather_image)
atlas_path=os.path.join(ROOT,'art','diary-print-atlas.png')
paper_image=bpy.data.images.load(atlas_path) if os.path.exists(atlas_path) else None
if paper_image:paper_image.pack()
paper=material('Diary printed atlas',(.84,.76,.57),paper_image)
def empty(name,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
root=empty('DiaryBinding');root['diaryRigVersion']=1;root['flightRise']=.45;root['flightBase']=.021
root['duration']=2.25;root['authoring']='Blender 4.2.3';root['pageWidth']=.265;root['pageHeight']=.403
front=empty('FrontCoverHinge',root);left=empty('LeftPagesHinge',root)
leaves=[empty('LeafHinge'+str(i+1),root) for i in range(2)]
guide=empty('OrientationGuide')
objects=[root,front,left,*leaves,guide]
def finish(name,verts,faces,uvs,mat,parent):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    # Keep a single material per closed solid; web print uses a two-page atlas.
    mesh.materials.append(mat);layer=mesh.uv_layers.new(name='UVMap')
    for face,coords in zip(mesh.polygons,uvs):
        for loop,uv in zip(face.loop_indices,coords):layer.data[loop].uv=uv
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=parent;objects.append(o)
    return o
# Grid caps make the sheets flex smoothly without separating from the binding.
def block(name,w,h,lo,hi,mat,parent,printed=False,flex=False):
    def bezier(points,t):
        points=[Vector(p) for p in points]
        while len(points)>1:points=[a.lerp(b,t) for a,b in zip(points,points[1:])]
        return points[0]
    # Sample the reader's actual cubic page edge and quadratic corner. Extra
    # columns at the corner preserve its round silhouette and vertical tangent;
    # the former power-based inset cut a single diagonal across this region.
    top=[bezier([(0,.022),(.22,.001),(.7,-.003),(.965,.015)],i/16) for i in range(17)]
    bottom=[bezier([(0,.98),(.22,.965),(.7,1.006),(.965,.986)],i/16) for i in range(17)]
    top += [bezier([(.965,.015),(.995,.016),(.995,.045)],i/12) for i in range(1,13)]
    bottom += [bezier([(.965,.986),(.995,.985),(.995,.955)],i/12) for i in range(1,13)]
    nu,nv=len(top)-1,24;verts=[];faces=[];uvs=[];stride=(nu+1)*(nv+1)
    for depth in [lo,hi]:
        for v in range(nv+1):
            V=v/nv
            for u in range(nu+1):
                x=top[u].x*w
                z=(.5-(top[u].y+(bottom[u].y-top[u].y)*V))*h
                verts.append((x,-depth,z))
    def idx(u,v,side):return side*stride+v*(nu+1)+u
    for side in [0,1]:
        for v in range(nv):
            for u in range(nu):
                ids=[idx(u,v,side),idx(u+1,v,side),idx(u+1,v+1,side),idx(u,v+1,side)]
                if side==1:ids.reverse()
                faces.append(ids);coords=[]
                for i in ids:
                    # The page outline clips the print, as the HTML reader does;
                    # it must not squash the text into the curved silhouette.
                    U=verts[i][0]/w;V=.5-verts[i][2]/h
                    s=U if side else 1-U
                    coords.append(((s*.5+(0 if side else .5)) if printed else s,1-V*(.96 if printed else 1)))
                uvs.append(coords)
    rim=[idx(u,0,0) for u in range(nu+1)]+[idx(nu,v,0) for v in range(1,nv+1)]+[idx(u,nv,0) for u in range(nu-1,-1,-1)]+[idx(0,v,0) for v in range(nv-1,0,-1)]
    for j,a in enumerate(rim):
        b=rim[(j+1)%len(rim)];faces.append([a,b,b+stride,a+stride])
        U=j/len(rim);T=(j+1)/len(rim)
        uvs.append([(U,.04),(T,.04),(T,0),(U,0)] if printed else [(U,0),(T,0),(T,1),(U,1)])
    o=finish(name,verts,faces,uvs,mat,parent)
    if flex:
        o.shape_key_add(name='Basis');key=o.shape_key_add(name='Paper flex')
        for i,point in enumerate(key.data):
            U=(i%stride%(nu+1))/nu
            point.co.y-=.004*U*U
        o['flexible']=True
    if not printed:
        bevel=o.modifiers.new('Soft cover edges','BEVEL');bevel.width=.00065;bevel.segments=2;bevel.limit_method='ANGLE'
    return o
back=block('Back board',.269,.410,-.0205,-.0165,leather,root);back.location.x=.004
front.location.x=-.004
right=block('Right page block',.265,.403,-.0155,0,paper,root,True)
left_block=block('Left page block',.265,.403,.0003,.0143,paper,left,True,True)
board=block('Front board',.269,.410,.0165,.0205,leather,front)
leaf_meshes=[block('Turning leaf '+str(i+1),.265,.403,.0146+i*.0006,.01482+i*.0006,paper,p,True,True) for i,p in enumerate(leaves)]
# The flexible case spine follows the actual board's hinge contact at each pose.
def spine_vertices(angle):
    result=[];P0=Vector((.004,-.0205));P3=Vector((-.004-.0205*math.sin(angle),.0205*math.cos(angle)))
    f=angle/math.pi
    P1=P0+Vector((-.016*(1-f)-.0015*f,-.004*f))
    P2=P3+Vector((-.016*math.cos(angle)*(1-f)+.0015*f,-.016*math.sin(angle)*(1-f)-.004*f))
    for side in [0,1]:
        # The recessed case ends below the curved gutter, not above the boards.
        for z in [-.190,.190]:
            for i in range(25):
                t=i/24;p=(1-t)**3*P0+3*(1-t)**2*t*P1+3*(1-t)*t*t*P2+t**3*P3
                # An outer shell encloses the case rather than a zero-thickness ribbon.
                tangent=3*(1-t)**2*(P1-P0)+6*(1-t)*t*(P2-P1)+3*t*t*(P3-P2)
                normal=Vector((-tangent.y,tangent.x)).normalized()
                p+=normal*(side*.0012)
                result.append((p.x,-p.y,z))
    return result
sv=spine_vertices(0);sf=[];su=[]
for side in [0,1]:
    for i in range(24):
        a=side*50+i;ids=[a,a+1,a+26,a+25];sf.append(ids);su.append([(i/24,0),((i+1)/24,0),((i+1)/24,1),(i/24,1)])
for end in [0,24]:
    sf.append([end,end+25,end+75,end+50]);su.append([(0,0),(0,1),(1,1),(1,0)])
for row in [0,25]:
    for i in range(24):sf.append([row+i,row+i+50,row+i+51,row+i+1]);su.append([(0,0),(1,0),(1,1),(0,1)])
spine=finish('Flexible case spine',sv,sf,su,leather,root);spine.shape_key_add(name='Basis')
spine_keys=[]
for k in range(1,13):
    key=spine.shape_key_add(name='Spine %03d'%(k*15))
    for point,co in zip(key.data,spine_vertices(k*math.pi/12)):point.co=co
    spine_keys.append(key)
def smooth(t):
    t=max(0,min(1,t));return t*t*t*(10+t*(-15+6*t))
scene=bpy.context.scene;scene.render.fps=48;scene.frame_start=1;scene.frame_end=109
for frame in range(1,110):
    t=(frame-1)/108;p=smooth((t-.025)/.95);rotation=smooth((t-.08)/.84);bank=.035*math.sin(math.pi*p)**2
    root.location=(p,0,.021+.45*p+.115*math.sin(math.pi*p))
    root.rotation_euler=(-math.pi/2*(1-rotation),bank,0)
    guide.location=(rotation,0,bank)
    root.keyframe_insert('location',frame=frame);root.keyframe_insert('rotation_euler',frame=frame);guide.keyframe_insert('location',frame=frame)
    opening=smooth((t-.19)/.61);pages=smooth((t-.28)/.60)
    front.rotation_euler.z=-math.pi*opening;front.keyframe_insert('rotation_euler',frame=frame)
    left.rotation_euler.z=-math.pi*pages;left.keyframe_insert('rotation_euler',frame=frame)
    for i,(hinge,mesh) in enumerate(zip(leaves,leaf_meshes)):
        a=smooth((t-(.255-i*.02))/.60);hinge.rotation_euler.z=-math.pi*a;hinge.keyframe_insert('rotation_euler',frame=frame)
        key=mesh.data.shape_keys.key_blocks['Paper flex'];key.value=math.sin(math.pi*a)*.65;key.keyframe_insert('value',frame=frame)
    key=left_block.data.shape_keys.key_blocks['Paper flex'];key.value=math.sin(math.pi*pages)*.45;key.keyframe_insert('value',frame=frame)
    k=opening*12
    for i,key in enumerate(spine_keys,1):key.value=max(0,1-abs(k-i));key.keyframe_insert('value',frame=frame)
# Sampled curves are linear in glTF at 48fps, with zero-velocity quintic endpoints.
for action in bpy.data.actions:
    for fc in action.fcurves:
        for key in fc.keyframe_points:key.interpolation='LINEAR'
# Validate every solid, including the very thin leaves, before export.
for o in objects:
    if o.type!='MESH':continue
    bm=bmesh.new();bm.from_mesh(o.data)
    assert all(e.is_manifold for e in bm.edges),'Open boundary in '+o.name
    assert all(f.calc_area()>1e-12 for f in bm.faces),'Degenerate face in '+o.name
    bm.free()
# Inspect the evaluated animation as well as its rest mesh.
max_contact=0.0
for frame in range(1,110,2):
    scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get()
    for obj in [left_block,*leaf_meshes,spine]:
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();bm=bmesh.new();bm.from_mesh(mesh)
        assert all(e.is_manifold for e in bm.edges),'Animated boundary in '+obj.name
        assert all(face.calc_area()>1e-12 for face in bm.faces),'Collapsed animated face in '+obj.name
        bm.free();evaluated.to_mesh_clear()
    evaluated=spine.evaluated_get(deps);mesh=evaluated.to_mesh()
    tip=spine.matrix_world@((mesh.vertices[24].co+mesh.vertices[49].co)*.5)
    board_contact=front.matrix_world@Vector((0,-.0205,0));gap=(tip-board_contact).length
    max_contact=max(max_contact,gap);assert gap<.0003,'Detached spine at frame '+str(frame)
    polygon=[Vector((mesh.vertices[i].co.x,-mesh.vertices[i].co.y)) for i in range(25)]+[Vector((mesh.vertices[i].co.x,-mesh.vertices[i].co.y)) for i in range(74,49,-1)]
    def turn(a,b,c):return (b-a).cross(c-a)
    for i in range(len(polygon)):
        a,b=polygon[i],polygon[(i+1)%len(polygon)]
        for j in range(i+2,len(polygon)):
            if i==0 and j==len(polygon)-1:continue
            c,d=polygon[j],polygon[(j+1)%len(polygon)]
            assert not(turn(a,b,c)*turn(a,b,d)<-1e-16 and turn(c,d,a)*turn(c,d,b)<-1e-16),'Self-intersecting case spine '+str((frame,i,j,tuple(a),tuple(b),tuple(c),tuple(d)))
    evaluated.to_mesh_clear()
print('ANIMATION_VALIDATION: manifold meshes at 55 poses; max spine contact gap',max_contact)
# A useful editable preview scene. These authoring helpers are not exported.
world=bpy.data.worlds.new('Diary preview world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.38,.43,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
for name,position,power,size in [('Soft window',(1,-2,2),180,2),('Warm fill',(-1,-.2,1.2),70,1.5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=position;o.rotation_euler=(Vector((.55,0,.3))-o.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Diary animation camera');o=bpy.data.objects.new('Diary animation camera',cam);scene.collection.objects.link(o);o.location=(1.35,-1.5,1.0);o.rotation_euler=(Vector((.60,0,.30))-o.location).to_track_quat('-Z','Y').to_euler();cam.lens=45;scene.camera=o
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.frame_set(58)
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
# The small runtime GLB gets the existing website's live cover and diary pages.
# It does not need to embed a second copy of the room's leather image.
for mat in [leather,paper]:
    for link in list(mat.node_tree.links):
        if link.to_socket.name=='Base Color':mat.node_tree.links.remove(link)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=GLB,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True,export_morph=True,export_extras=True,export_yup=True)
# Merge sampled object channels into one reversible glTF scene clip.
raw=open(GLB,'rb').read();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);samplers=[];channels=[]
for animation in doc.get('animations',[]):
    offset=len(samplers);samplers.extend(animation['samplers'])
    for channel in animation['channels']:channel['sampler']+=offset;channels.append(channel)
doc['animations']=[{'name':'Diary_Pickup_Open','samplers':samplers,'channels':channels}]
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+length:]
open(GLB,'wb').write(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
print('DIARY_ASSET',json.dumps({'blend':BLEND,'glb':GLB,'bytes':os.path.getsize(GLB),'solids':sum(o.type=='MESH' for o in objects),'frames':109,'duration':2.25}))
