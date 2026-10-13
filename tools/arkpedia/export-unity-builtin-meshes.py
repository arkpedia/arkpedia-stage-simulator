#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover a referenced built-in mesh from an official, engine-matched player."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
from native_effect_source import exact
DIRECTORY = ROOT/'.cache/arkpedia/unity-builtin-source'
RESOURCE_SHA = 'ea2ce64646b2a83bcd5fc8ff40ab1a8eb6abbbf225798c865fbbfabe1f45fc22'
CLIENT_SHA = '6d1ffcec028d346f6c1de06c4a6764d848fb6f272e59a189d9597dbda162220f'
MESH_SHA = '9c09568c3b080a71b9a6c6d7eb017b6de02ff8598e35c2decf389e9ebd9824f2'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def source(name, expected):
    raw = (DIRECTORY/name).read_bytes();meta = json.loads((DIRECTORY/(name.replace(' ', '-')+'-source.json')).read_bytes())
    if sha(raw) != expected or meta['sha256'] != expected or meta['bytes'] != len(raw): raise ValueError('Changed official built-in input')
    env = UnityPy.load(raw)
    if len(env.assets) != 1: raise ValueError('Ambiguous official built-in asset file')
    asset = env.assets[0]
    return env, {**meta, 'unityVersion': asset.unity_version, 'platform': int(asset.target_platform)}


def export():
    resources, resource = source('unity default resources', RESOURCE_SHA);client_env, client = source('globalgamemanagers', CLIENT_SHA)
    if client['unityVersion'] != '2021.3.39f1' or resource['unityVersion'] != '2021.3.38f1' or client['platform'] != resource['platform'] or client['platform'] != 13:
        raise ValueError('Unreviewed official player/resource engine identity')
    supported, references = {}, {}
    for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
        d = ROOT/('.cache/arkpedia/'+name+'-source');raw = (d/'effects/native-effects.bin').read_bytes()
        meta = json.loads((ROOT/('data/arkpedia-'+('lappland' if name == 'lappland-alter' else name)+'-effects.json')).read_bytes())
        if sha(raw) != meta['pack']['sha256']: raise ValueError('Changed pinned original effect pack')
        pack = json.loads(gzip.decompress(raw));native = UnityPy.load(str(d/(bundle+'-effects.ab'))).assets[0]
        if native.unity_version != client['unityVersion'] or int(native.target_platform) != client['platform']: raise ValueError('Effect pack/player engine mismatch')
        supported[sha(raw)] = {'operator': pack['operator'], 'version': pack['version'], 'unityVersion': native.unity_version, 'platform': int(native.target_platform)}
        for key, r in pack['records'].items():
            for ref in r.get('references', []):
                if ref['field'] == 'm_Mesh' and ref.get('unresolved') == {'foreignFile': 'Library/unity default resources', 'pathId': '10210'}:
                    references[key] = {'sourcePackSha256': sha(raw), 'pointer': ref['pointer'], 'mesh': '10210'}
    obj = next(o for o in resources.objects if o.path_id == 10210)
    if obj.type.name != 'Mesh' or sha(obj.get_raw_data()) != MESH_SHA: raise ValueError('Changed original built-in Quad object')
    tree = obj.read_typetree();h = MeshHandler(obj.read());h.process()
    if tree['m_Name'] != 'Quad': raise ValueError('Unexpected original built-in mesh name')
    mesh = {'positions': exact(h.m_Vertices), 'uv': exact(h.m_UV0), 'normals': exact(h.m_Normals), 'tangents': exact(h.m_Tangents), 'colors': exact(h.m_Colors),
            'vertexChannels': exact(tree['m_VertexData']['m_Channels']), 'uvChannels': [exact(getattr(h, f'm_UV{i}')) for i in range(8)], 'submeshTriangles': exact(h.get_triangles())}
    fixture = {'resource': resource, 'client': client, 'pathId': '10210', 'serializedSha256': MESH_SHA, 'serializedBytes': len(obj.get_raw_data()), 'tree': exact(tree)}
    raw = (json.dumps(fixture, separators=(',', ':'))+'\n').encode();(ROOT/'test/fixtures/arkpedia-unity-builtin-mesh.json').write_bytes(raw)
    result = {'schemaVersion': 1, 'resource': resource, 'client': client, 'supportedEffectPacks': supported,
              'scope': {'originalBuiltinMesh': True, 'engineMatchedOfficialPlayer': True, 'wholePackageVerified': False, 'compiledFrameParity': False, 'enabledOperators': []},
              'fixture': {'path': 'test/fixtures/arkpedia-unity-builtin-mesh.json', 'bytes': len(raw), 'sha256': sha(raw)},
              'meshes': {'10210': {'name': 'Quad', 'serializedSha256': MESH_SHA, 'serializedBytes': len(obj.get_raw_data()), 'data': mesh}}, 'references': references}
    (ROOT/'data/arkpedia-unity-builtin-meshes.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'originalMeshes': 1, 'originalPointers': len(references), 'resourceHeader': resource['unityVersion'], 'playerEngine': client['unityVersion']}))


if __name__ == '__main__': export()
