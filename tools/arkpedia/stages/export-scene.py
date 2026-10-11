#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export 0-1's original static-batched scene, not a substitute map theme.

Run with the simulator's local-extract requirements installed. Inputs are unzipped
official Global Android bundles and hot_update_list.json. Source checksums must match.
Only referenced geometry/textures are published; no client executable is needed.
"""
import argparse, hashlib, json, re, struct, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'local-extract'))
import aklz4  # Registers the existing, attributed LZ4AK decoder.
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

BUNDLES = [
    'scenes/obt/main/level_main_00-01/level_main_00-01.ab',
    'arts/maps/map_chernobog_a/res.ab',
    'scenes/obt/main/level_main_00-01/level_main_00-01/lightingdata.ab',
]

def digest(path):
    b = path.read_bytes()
    return {'path': path.name, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}

def export(args):
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    info = {x['name']: x for x in json.loads(args.manifest.read_text())['abInfos']}
    sources = []
    for name in BUNDLES:
        data = (args.bundles / name).read_bytes()
        expected = info[name]
        if hashlib.md5(data).hexdigest() != expected['md5'] or len(data) != expected['abSize']:
            raise ValueError(f'Bundle checksum mismatch: {name}')
        sources.append({'bundle': name, 'md5': expected['md5'], 'bytes': len(data),
                        'sha256': hashlib.sha256(data).hexdigest()})
    env = UnityPy.load(*[str(args.bundles / name) for name in BUNDLES])
    scene = env.files[str(args.bundles / BUNDLES[0])]
    objs = [o for f in scene.files.values() if hasattr(f, 'objects') for o in f.objects.values()]
    data = json.loads(args.data.read_text())
    if data['stage']['code'] != '0-1': raise ValueError('This exporter supports only 0-1')
    g = data['stage']['geometry']
    heights = [[None] * g['cols'] for _ in range(g['rows'])]
    anchors = []
    lightmap = next(o.read() for o in objs if o.type.name == 'LightmapSettings').m_Lightmaps[0].m_Lightmap.read()
    lightmap.image.save(out / 'lightmap.webp', lossless=True)
    textures = {'lightmap': digest(out / 'lightmap.webp')}
    materials, batches, handlers, seen = {}, {}, {}, set()
    for o in objs:
        if o.type.name == 'Transform':
            t = o.read()
            if t.m_GameObject.read().m_Name == 'Anchor': anchors.append(t.m_LocalPosition)
        if o.type.name == 'MonoBehaviour':
            t = o.read_typetree()
            if t.get('_tileKey'):
                go = o.read().m_GameObject.read()
                match = re.fullmatch(r'\((\d+),(\d+)\)#(.+)', go.m_Name)
                if not match: raise ValueError('Unrecognized tile coordinate')
                row, col = map(int, match.groups()[:2])
                kind = {'tile_forbidden':0, 'tile_wall':1, 'tile_road':2, 'tile_start':3, 'tile_end':4}[t['_tileKey']]
                if g['tileGrid'][row][col] != kind: raise ValueError('Source tile does not match gameplay geometry')
                p = next(p.component.read().m_LocalPosition for p in go.m_Component if p.component.type.name == 'Transform')
                if abs(p.x-col) > 1e-5 or abs(p.y-row) > 1e-5: raise ValueError('Tile transform mismatch')
                heights[row][col] = round(t['_height'] + t['_locateHeightOffset'], 6)
    if len(anchors) != 1 or any(h is None for row in heights for h in row):
        raise ValueError('Incomplete stage anchor or tile heights')
    anchor = anchors[0]
    if abs(anchor.x+(g['cols']-1)/2) > 1e-5 or abs(anchor.y+(g['rows']-1)/2) > 1e-5:
        raise ValueError('Unexpected centered map anchor')
    for o in objs:
        if o.type.name != 'MeshRenderer': continue
        renderer = o.read()
        if not renderer.m_Enabled: continue
        go = renderer.m_GameObject.read()
        mf = next(p.component.read() for p in go.m_Component if p.component.type.name == 'MeshFilter')
        if not mf.m_Mesh.path_id: continue  # Runtime-only selection drawer.
        batch = renderer.m_StaticBatchInfo
        if not batch.subMeshCount or renderer.m_StaticBatchRoot.path_id:
            raise ValueError(f'Unsupported non-world static batch: {go.m_Name}')
        mesh_id = mf.m_Mesh.path_id
        if mesh_id not in handlers:
            handler = MeshHandler(mf.m_Mesh.read()); handler.process()
            handlers[mesh_id] = handler, handler.get_triangles()
        handler, groups = handlers[mesh_id]
        for slot in range(batch.subMeshCount):
            sub = batch.firstSubMesh + slot
            if (mesh_id, sub) in seen: raise ValueError('Duplicate static submesh')
            seen.add((mesh_id, sub))
            mat = renderer.m_Materials[min(slot, len(renderer.m_Materials)-1)].read()
            key = mat.m_Name
            if key not in materials:
                tex = {}
                for name, value in mat.m_SavedProperties.m_TexEnvs:
                    if value.m_Texture.path_id and name in ['_MainTex', '_EmissionMap']:
                        image = value.m_Texture.read()
                        image.image.save(out / f'{image.m_Name}.webp', lossless=True)
                        textures[image.m_Name] = digest(out / f'{image.m_Name}.webp')
                        tex[name] = image.m_Name
                materials[key] = {'map': tex['_MainTex'], 'emissiveMap': tex.get('_EmissionMap')}
                batches[key] = {'position': [], 'normal': [], 'uv': [], 'uv1': [], 'index': []}
            b = batches[key]; remap = {}
            for tri in groups[sub]:
                face = []
                for i in tri:
                    if i not in remap:
                        remap[i] = len(b['position'])//3
                        x,y,z = handler.m_Vertices[i]
                        nx,ny,nz = handler.m_Normals[i]
                        # Unity's baked WORLD coordinates include the centered map anchor.
                        # Our gameplay plane is col,row with positive height; reflecting Z
                        # requires reversed face winding, not reapplying prefab transforms.
                        b['position'].extend([x-anchor.x,y-anchor.y,-z])
                        b['normal'].extend([nx,ny,-nz])
                        b['uv'].extend(handler.m_UV0[i][:2])
                        # Static batching has ALREADY applied lightmap scale/offset.
                        b['uv1'].extend(handler.m_UV1[i][:2])
                    face.append(remap[i])
                b['index'].extend(reversed(face))
    if len(seen) != sum(len(groups) for _,groups in handlers.values()):
        raise ValueError('Static scene coverage is incomplete')
    blob = bytearray(); meshes = []
    for key,b in batches.items():
        attrs = {}
        for name,values in b.items():
            size = 3 if name in ['position','normal'] else 1 if name == 'index' else 2
            attrs[name] = {'byteOffset':len(blob), 'count':len(values)//size, 'itemSize':size,
                           'type':'Uint32' if name == 'index' else 'Float32'}
            blob.extend(struct.pack('<'+('I' if name == 'index' else 'f')*len(values),*values))
        meshes.append({'material':key,'attributes':attrs})
    (out/'geometry.bin').write_bytes(blob)
    result = {'schemaVersion':1,'stage':'0-1','geometryHash':data['stage']['pathing']['geometryHash'],
        'source':{'provider':'official-global-android','version':args.version,
            'baseUrl':args.base_url,'bundles':sources},
        'coordinates':'column,row,height','tileHeights':heights,
        'staticSubmeshes':len(seen),'materials':materials,'textures':textures,
        'lightmap':'lightmap','meshes':meshes,'buffer':digest(out/'geometry.bin')}
    (out/'scene.json').write_text(json.dumps(result,indent=2)+'\n')
    print(f'Exported {len(seen)} unique submeshes, {len(blob)} geometry bytes, {len(textures)} textures')

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundles',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True)
    p.add_argument('--data',type=Path,default=Path('data/arkpedia-mvp.json'))
    p.add_argument('--out',type=Path,required=True);p.add_argument('--version',required=True)
    p.add_argument('--base-url',required=True)
    export(p.parse_args())
