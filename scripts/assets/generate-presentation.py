"""Blender 5.1: deterministic primitive definitions, GLB exports and source scene."""
import bpy, math, json, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/presentation'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
def xyz(p): return (p[0], -p[2], p[1])
def material(name, color):
    m = bpy.data.materials.new(name); m.use_nodes = True
    channels = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in channels]
    m.diffuse_color = (*linear,1)
    b = m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (*linear,1); b.inputs['Roughness'].default_value = .9
    return m
COLORS = {k:material(k,v) for k,v in dict(blue='2563EB',white='FFFFFF',yellow='FACC15',cyan='22D3EE',purple='A855F7',dark='334155',orange='F97316',red='EF4444',floor='CBD5E1',block='64748B').items()}
assets=[]
for name in ['chassis','core','ai','sensor','wheels','tracks','pulse','floor','block']:
    collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
    root=bpy.data.objects.new('root.'+name,None);collection.objects.link(root)
    objects=[root]; sockets=[]
    def attach(obj,color):
        for c in list(obj.users_collection):c.objects.unlink(obj)
        collection.objects.link(obj);obj.parent=root;obj.data.materials.append(COLORS[color]);objects.append(obj)
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        return obj
    def box(label,pos,size,color):
        bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos));o=bpy.context.object;o.name=name+'.'+label;o.scale=xyz(size);o.scale.y=abs(o.scale.y);return attach(o,color)
    def cylinder(label,pos,radius,depth,color,axis='Y',vertices=12):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=xyz(pos));o=bpy.context.object;o.name=name+'.'+label
        if axis=='X':o.rotation_euler[1]=math.pi/2
        if axis=='Z':o.rotation_euler[0]=math.pi/2
        return attach(o,color)
    if name=='chassis':
        box('body',(0,.40,0),(.85,.32,.70),'blue');cylinder('front',(0,.57,.22),.08,.015,'white',vertices=3)
        for socket,pos in {'drive':(0,0,0),'core':(0,.66,-.12),'ai':(-.26,.66,-.19),'sensor':(0,.62,.20),'weapon-a':(-.29,.57,.10),'weapon-b':(.29,.57,.10)}.items():
            o=bpy.data.objects.new(socket,None);collection.objects.link(o);o.parent=root;o.location=xyz(pos);objects.append(o);sockets.append(socket)
    elif name=='core':
        mesh=bpy.data.meshes.new('octahedron');mesh.from_pydata([(.12,0,0),(-.12,0,0),(0,.12,0),(0,-.12,0),(0,0,.12),(0,0,-.12)],[],[(4,0,2),(4,2,1),(4,1,3),(4,3,0),(5,2,0),(5,1,2),(5,3,1),(5,0,3)]);mesh.update()
        obj=bpy.data.objects.new('core.octahedron',mesh);bpy.context.scene.collection.objects.link(obj);attach(obj,'yellow')
    elif name=='ai': box('processor',(0,0,0),(.16,.16,.16),'cyan')
    elif name=='sensor':
        bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.10,radius2=0,depth=.20,location=xyz((0,.10,0)));attach(bpy.context.object,'purple')
    elif name=='wheels':
        for x in [-.52,.52]:
            for z in [-.25,.25]:
                cylinder('wheel',(x,.18,z),.18,.18,'dark','X');cylinder('hub',(x+(.095 if x>0 else -.095),.18,z),.08,.015,'orange','X')
    elif name=='tracks':
        for x in [-.52,.52]:
            box('track',(x,.18,0),(.20,.32,.85),'dark')
            for z in [-.30,-.15,0,.15,.30]:box('plate',(x,.35,z),(.21,.025,.055),'orange')
    elif name=='pulse':
        box('base',(0,.06,0),(.18,.12,.22),'orange');cylinder('barrel',(0,.09,.23),.045,.35,'red','Z')
    elif name=='floor':cylinder('hex',(0,-.06,0),1,.12,'floor',vertices=6)
    elif name=='block':box('obstacle',(0,.28,0),(.7,.56,.7),'block');box('cross-x',(0,.575,0),(.42,.015,.08),'white');box('cross-z',(0,.575,0),(.08,.015,.42),'white')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
    assets.append(dict(resourceId='resource.'+name,url='/assets/presentation/'+name+'.glb',sha256=hashlib.sha256(path.read_bytes()).hexdigest(),sockets=sorted(sockets)))
(ROOT/'assets/blender').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/presentation-prototype-v1.blend'))
(ROOT/'content/presentation').mkdir(parents=True,exist_ok=True)
(ROOT/'content/presentation/prototype-v1.json').write_text(json.dumps(dict(version=1,revision='presentation-prototype-1',assets=assets),indent=2)+'\n',encoding='utf-8')
data=json.loads((ROOT/'content/fixtures/basic-v2.json').read_text(encoding='utf-8'))
data['contentRevision']='presentation-1'
known={r['id'] for r in data['vocabularies']['resources']}
for a in assets:
    if a['resourceId'] not in known:data['vocabularies']['resources'].append(dict(schemaVersion=2,id=a['resourceId'],name=a['resourceId'],sockets=a['sockets']))
for family,key in [('cores','core'),('ais','ai'),('sensors','sensor'),('locomotions','wheels')]:
    for d in data['definitions'][family]:d['visual']={'resourceId':'resource.'+key}
slow=dict(data['definitions']['locomotions'][0]);slow.update(id='locomotion.slow',name='Prototype tracks',moveCooldownTicks=20,visual={'resourceId':'resource.tracks'})
data['definitions']['locomotions'].append(slow)
for e in data['definitions']['robots'][1]['equipment']:
    if e['slotId']=='drive':e['componentId']='locomotion.slow'
(ROOT/'content/fixtures/presentation-v2.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print('PRE-001: exported',len(assets),'assets and CAT-002 fixture')
