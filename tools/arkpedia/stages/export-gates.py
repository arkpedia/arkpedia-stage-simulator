#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export the original standard red entry / blue defence box meshes and atlas.

Uses the same official map-effects bundle as Stronghold's local-client exporter.
Select by prefab node, not mesh name: the bundle also contains another variant
whose mesh shares a name. Only the five standard parts and their texture ship.
"""
import argparse, hashlib, json, struct, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'local-extract'))
import aklz4
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

BUNDLE = 'arts/effects/[pack]map.ab'
NODES = {'Start_down': ('startDown', 'start', 'additive'),
         'Start_up': ('startUp', 'start', 'additive'),
         'Start_back': ('startBack', 'start', 'additive'),
         'Start_down1': ('endDown', 'end', 'additive'),
         'Start_up1': ('endUp', 'end', 'alpha')}

def digest(path):
    data = path.read_bytes()
    return {'path': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def export(args):
    raw = (args.bundles / BUNDLE).read_bytes()
    entry = next(x for x in json.loads(args.manifest.read_text())['abInfos'] if x['name'] == BUNDLE)
    if len(raw) != entry['abSize'] or hashlib.md5(raw).hexdigest() != entry['md5']:
        raise ValueError('Map-effects bundle checksum mismatch')
    env = UnityPy.load(raw)
    objects = {o.read().m_Name: o.read() for o in env.objects if o.type.name == 'GameObject' and o.read().m_Name in NODES}
    if set(objects) != set(NODES): raise ValueError('Missing standard gate prefab nodes')
    args.out.mkdir(parents=True, exist_ok=True)
    blob = bytearray(); parts = []; texture_id = None
    for name, (key, kind, blend) in NODES.items():
        go = objects[name]
        mf = next(p.component.read() for p in go.m_Component if p.component.type.name == 'MeshFilter')
        renderer = next(p.component.read() for p in go.m_Component if p.component.type.name == 'MeshRenderer')
        if len(renderer.m_Materials) != 1: raise ValueError('Unexpected gate materials')
        material = renderer.m_Materials[0].read()
        tex_env = next(v for k, v in material.m_SavedProperties.m_TexEnvs if k == '_MainTex')
        texture = tex_env.m_Texture.read()
        if texture.m_Name != '[opt]merged_textures': raise ValueError('Unexpected gate atlas')
        if texture_id is None:
            texture_id = tex_env.m_Texture.path_id
            texture.image.save(args.out / 'gates.webp', lossless=True, exact=True)
        elif texture_id != tex_env.m_Texture.path_id: raise ValueError('Gate parts do not share their atlas')
        handler = MeshHandler(mf.m_Mesh.read()); handler.process()
        # Standard effect geometry is authored in centimetres, centered at half
        # tile height. The map effect's rotation maps Unity (x,y,z) to (x,z,y).
        # Reflecting the axes requires reversed triangle winding.
        positions = [n for x,y,z,*_ in handler.m_Vertices for n in (x/100, z/100, y/100 + .5)]
        uv = [n for v in handler.m_UV0 for n in v[:2]]
        indices = [i for group in handler.get_triangles() for triangle in group for i in reversed(triangle)]
        tint = next(v for k,v in material.m_SavedProperties.m_Colors if k == '_TintColor')
        if max(abs(positions[i]) for i in range(0,len(positions),3)) > .51:
            raise ValueError('Wrong gate mesh variant')
        attrs = {}
        for attr, values, size in [('position',positions,3),('uv',uv,2),('index',indices,1)]:
            attrs[attr] = {'byteOffset':len(blob), 'count':len(values)//size,
                           'itemSize':size, 'type':'Uint32' if attr == 'index' else 'Float32'}
            blob.extend(struct.pack('<'+('I' if attr == 'index' else 'f')*len(values), *values))
        parts.append({'key':key, 'kind':kind, 'blend':blend,
                      'tint':[tint.r,tint.g,tint.b], 'attributes':attrs})
    (args.out / 'geometry.bin').write_bytes(blob)
    result = {'schemaVersion':1, 'coordinates':'column,row,height',
              'source':{'provider':'official-global-android', 'version':args.version,
                        'bundle':BUNDLE, 'md5':entry['md5'], 'bytes':len(raw)},
              'texture':digest(args.out / 'gates.webp'),
              'buffer':digest(args.out / 'geometry.bin'), 'parts':parts}
    (args.out / 'gates.json').write_text(json.dumps(result, indent=2)+'\n')
    print(f'Exported {len(parts)} original gate parts: {len(blob)} geometry bytes')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundles', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--version', required=True)
    export(parser.parse_args())
