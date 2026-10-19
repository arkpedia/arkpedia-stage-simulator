#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Bind Aphrissa's original Cube/Quad pointers to pinned official-player bytes."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
from native_effect_source import exact
DIRECTORY = ROOT / '.cache/arkpedia/unity-builtin-source'
IDENTITIES = {'10202': ('Cube', 1816, '7d33190c6a48d8788035f8ff076090a8579e111cbef2268cbf6e88262df943f4'),
              '10210': ('Quad', 604, '9c09568c3b080a71b9a6c6d7eb017b6de02ff8598e35c2decf389e9ebd9824f2')}
def sha(raw): return hashlib.sha256(raw).hexdigest()
def source(name, expected):
    raw = (DIRECTORY / name).read_bytes()
    meta = json.loads((DIRECTORY / (name.replace(' ', '-') + '-source.json')).read_bytes())
    if sha(raw) != expected or meta['sha256'] != expected or meta['bytes'] != len(raw):
        raise ValueError('Changed pinned official-player input')
    env = UnityPy.load(raw)
    if len(env.assets) != 1: raise ValueError('Ambiguous original player/resource file')
    asset = env.assets[0]
    return env, {**meta, 'unityVersion': asset.unity_version, 'platform': int(asset.target_platform)}
def export():
    resources, resource = source('unity default resources', 'ea2ce64646b2a83bcd5fc8ff40ab1a8eb6abbbf225798c865fbbfabe1f45fc22')
    _, client = source('globalgamemanagers', '6d1ffcec028d346f6c1de06c4a6764d848fb6f272e59a189d9597dbda162220f')
    if client['unityVersion'] != '2021.3.39f1' or resource['unityVersion'] != '2021.3.38f1' or client['platform'] != resource['platform'] or client['platform'] != 13:
        raise ValueError('Changed original engine/player/resource identity')
    raw = (ROOT / '.cache/arkpedia/aphrissa-source/effects/native-effects.bin').read_bytes()
    meta = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
    if sha(raw) != meta['pack']['sha256']: raise ValueError('Changed original Aphrissa effect pack')
    pack = json.loads(gzip.decompress(raw))
    if pack['operator'] != 'char_4229_aphris' or pack['version'] != '26-09-22-07-47-20_6c71fa':
        raise ValueError('Changed original Aphrissa source')
    references, native_files = {}, {}
    for key, row in pack['records'].items():
        for ref in row.get('references', []):
            missing = ref.get('unresolved', {})
            if ref['field'] != 'm_Mesh' or missing.get('foreignFile') != 'Library/unity default resources': continue
            mesh = missing['pathId']
            if mesh not in IDENTITIES: raise ValueError('Unreviewed original built-in mesh')
            bundle = row['bundle']
            if bundle not in native_files:
                file = ROOT / '.cache/arkpedia/cn-native-source/bundles' / bundle
                blob = file.read_bytes();bound = next(r for r in meta['sources'] if r['path'] == bundle)
                if sha(blob) != bound['sha256'] or len(blob) != bound['bytes']: raise ValueError('Changed native referencing bundle')
                env = UnityPy.load(blob)
                if len(env.assets) != 1: raise ValueError('Ambiguous original referencing bundle')
                f = env.assets[0]
                if f.unity_version != client['unityVersion'] or int(f.target_platform) != client['platform']:
                    raise ValueError('Original effects/player engine mismatch')
                native_files[bundle] = f
            f = native_files[bundle];obj = f.objects[int(row['pathId'])]
            if sha(obj.get_raw_data()) != row['serializedSha256']: raise ValueError('Changed native referring object')
            pointer = obj.read_typetree()['m_Mesh']
            if exact(pointer) != ref['pointer'] or str(pointer['m_PathID']) != mesh or f.externals[pointer['m_FileID'] - 1].path != missing['foreignFile']:
                raise ValueError('Changed original built-in pointer')
            references[key] = {'sourcePackSha256': sha(raw), 'pointer': ref['pointer'], 'mesh': mesh}
    if len(references) != 5 or {r['mesh'] for r in references.values()} != set(IDENTITIES):
        raise ValueError('Incomplete original Aphrissa built-in pointer closure')
    meshes, fixtures = {}, {}
    for mesh, (name, size, digest) in IDENTITIES.items():
        obj = next(o for o in resources.objects if o.path_id == int(mesh))
        if obj.type.name != 'Mesh' or len(obj.get_raw_data()) != size or sha(obj.get_raw_data()) != digest:
            raise ValueError('Changed original built-in object')
        tree = obj.read_typetree()
        if tree['m_Name'] != name: raise ValueError('Changed original mesh name')
        h = MeshHandler(obj.read());h.process()
        data = {'positions': exact(h.m_Vertices), 'uv': exact(h.m_UV0), 'normals': exact(h.m_Normals),
                'tangents': exact(h.m_Tangents), 'colors': exact(h.m_Colors),
                'vertexChannels': exact(tree['m_VertexData']['m_Channels']),
                'uvChannels': [exact(getattr(h, f'm_UV{i}')) for i in range(8)],
                'submeshTriangles': exact(h.get_triangles())}
        meshes[mesh] = {'name': name, 'serializedBytes': size, 'serializedSha256': digest, 'data': data}
        fixtures[mesh] = {'pathId': mesh, 'serializedBytes': size, 'serializedSha256': digest, 'tree': exact(tree)}
    fixture = {'resource': resource, 'client': client, 'objects': fixtures}
    path = 'test/fixtures/arkpedia-aphrissa-builtin-meshes.json'
    fixture_raw = (json.dumps(fixture, separators=(',', ':')) + '\n').encode();(ROOT / path).write_bytes(fixture_raw)
    result = {'schemaVersion': 1, 'resource': resource, 'client': client,
              'supportedEffectPacks': {sha(raw): {'operator': pack['operator'], 'version': pack['version'],
                'unityVersion': client['unityVersion'], 'platform': client['platform']}},
              'scope': {'sourceInputsOnly': True, 'originalBuiltinMesh': True, 'engineMatchedOfficialPlayer': True,
                        'exactGameClientVerified': False, 'wholePackageVerified': False, 'compiledFrameParity': False, 'enabledOperators': []},
              'fixture': {'path': path, 'bytes': len(fixture_raw), 'sha256': sha(fixture_raw)},
              'meshes': meshes, 'references': references}
    (ROOT / 'data/arkpedia-aphrissa-builtin-meshes.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'originalMeshes': len(meshes), 'originalPointers': len(references), 'exactGameClientVerified': False}))
if __name__ == '__main__': export()
