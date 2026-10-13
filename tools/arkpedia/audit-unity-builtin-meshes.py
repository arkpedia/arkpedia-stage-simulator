#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently decode the original Quad's vertex/index bytes and pointer use."""
import base64
import copy
import gzip
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import zlib
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
DIRECTORY = ROOT/'.cache/arkpedia/unity-builtin-source'
META = ROOT/'data/arkpedia-unity-builtin-meshes.json'
FIXTURE = ROOT/'test/fixtures/arkpedia-unity-builtin-mesh.json'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run([sys.executable, 'tools/arkpedia/export-unity-builtin-meshes.py'], cwd=ROOT, check=True, capture_output=True)


def hashes(): return [sha(p.read_bytes()) for p in [META, FIXTURE]]


build()
meta, fixture = [json.loads(p.read_bytes()) for p in [META, FIXTURE]]
resources = UnityPy.load(str(DIRECTORY/'unity default resources'))
obj = next(o for o in resources.objects if o.path_id == 10210)
tree = obj.read_typetree()
raw_vertices = tree['m_VertexData']['m_DataSize'];channels = tree['m_VertexData']['m_Channels'];stride = 48
assert len(raw_vertices) == 4*stride and tree['m_IndexFormat'] == 0
assert [c['stream'] for c in channels if c['dimension']] == [0]*4
assert [(c['offset'], c['format'], c['dimension']) for c in channels if c['dimension']] == [(0, 0, 3), (12, 0, 3), (24, 0, 4), (40, 0, 2)]


def channel(index):
    c = channels[index]
    return [list(struct.unpack_from('<'+'f'*c['dimension'], raw_vertices, i*stride+c['offset'])) for i in range(4)]


positions, normals, tangents, uv = [channel(i) for i in [0, 1, 2, 4]]
indices = list(struct.unpack('<6H', bytes(tree['m_IndexBuffer'])))
assert indices == [0, 3, 1, 3, 0, 2]
references, supported = {}, {}
for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
    directory = ROOT/('.cache/arkpedia/'+name+'-source');raw = (directory/'effects/native-effects.bin').read_bytes();pack = json.loads(gzip.decompress(raw))
    native = UnityPy.load(str(directory/(bundle+'-effects.ab'))).assets[0]
    supported[sha(raw)] = {'operator': pack['operator'], 'version': pack['version'], 'unityVersion': native.unity_version, 'platform': int(native.target_platform)}
    originals = {o.path_id: o for o in native.objects.values()}
    for key, record in pack['records'].items():
        for ref in record.get('references', []):
            if ref['field'] != 'm_Mesh' or ref.get('unresolved') != {'foreignFile': 'Library/unity default resources', 'pathId': '10210'}: continue
            native_tree = originals[int(key.rsplit(':', 1)[1])].read_typetree()
            pointer = native_tree.get('m_Mesh', native_tree.get('ShapeModule', {}).get('m_Mesh'))
            assert pointer is not None
            assert pointer['m_FileID'] == ref['pointer']['m_FileID'] and str(pointer['m_PathID']) == '10210'
            assert native.externals[pointer['m_FileID']-1].path == 'Library/unity default resources'
            references[key] = {'sourcePackSha256': sha(raw), 'pointer': ref['pointer'], 'mesh': '10210'}


def verify(m, f):
    assert m['schemaVersion'] == 1 and m['supportedEffectPacks'] == supported and m['references'] == references and len(references) == 133
    assert m['scope'] == {'originalBuiltinMesh': True, 'engineMatchedOfficialPlayer': True, 'wholePackageVerified': False, 'compiledFrameParity': False, 'enabledOperators': []}
    assert m['client']['unityVersion'] == '2021.3.39f1' and m['resource']['unityVersion'] == '2021.3.38f1'
    assert m['client']['platform'] == m['resource']['platform'] == 13
    assert set(m['meshes']) == {'10210'}
    row = m['meshes']['10210'];d = row['data']
    assert row['name'] == 'Quad' and row['serializedSha256'] == sha(obj.get_raw_data()) and row['serializedBytes'] == 604
    assert d == {'positions': positions, 'normals': normals, 'tangents': tangents, 'uv': uv, 'colors': None, 'vertexChannels': channels,
                 'uvChannels': [uv]+[None]*7, 'submeshTriangles': [[indices[:3], indices[3:]]]}
    assert f['pathId'] == '10210' and f['serializedSha256'] == row['serializedSha256'] and f['serializedBytes'] == 604
    assert f['tree']['m_VertexData']['m_DataSize'] == {'encoding': 'base64', 'data': base64.b64encode(raw_vertices).decode('ascii')}
    assert f['tree']['m_IndexBuffer'] == list(tree['m_IndexBuffer']) and f['tree']['m_VertexData']['m_Channels'] == channels
    for field, name, expected in [('resource', 'unity default resources', 'ea2ce64646b2a83bcd5fc8ff40ab1a8eb6abbbf225798c865fbbfabe1f45fc22'),
                                  ('client', 'globalgamemanagers', '6d1ffcec028d346f6c1de06c4a6764d848fb6f272e59a189d9597dbda162220f')]:
        raw = (DIRECTORY/name).read_bytes();source = m[field]
        assert f[field] == source and source['sha256'] == sha(raw) == expected and source['bytes'] == len(raw)
        assert zlib.crc32(raw) == source['crc32'] and source['wholePackageVerified'] is False
        native = UnityPy.load(raw).assets[0];assert source['unityVersion'] == native.unity_version and source['platform'] == int(native.target_platform)
        assert source['url'] == m['client']['url'] and source['etag'] == m['client']['etag']
    # Preserve nonzero source Z values and the original clockwise winding.
    assert any(p[2] != 0 for p in d['positions']) and all(n[2] == -1 for n in d['normals'])


verify(meta, fixture)
raw = FIXTURE.read_bytes();assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
before = hashes();build();assert hashes() == before, 'Built-in resource outputs are not reproducible'
mutations = []
for field in ['positions', 'normals', 'tangents', 'uv']:
    m, f = copy.deepcopy(meta), copy.deepcopy(fixture);m['meshes']['10210']['data'][field][0][0] += 1;mutations.append((m, f))
for change in [lambda m: m['meshes']['10210']['data']['submeshTriangles'][0][0].reverse(),
               lambda m: m['client'].update(unityVersion='2022.3.0f1'), lambda m: m['resource'].update(unityVersion='2021.3.39f1'),
               lambda m: m['resource'].update(sha256='changed'), lambda m: m['scope'].update(wholePackageVerified=True),
               lambda m: m['references'][next(iter(references))]['pointer'].update(m_FileID=99)]:
    m, f = copy.deepcopy(meta), copy.deepcopy(fixture);change(m);mutations.append((m, f))
for candidate in mutations:
    try: verify(*candidate)
    except AssertionError: pass
    else: raise AssertionError('Altered original built-in mesh evidence accepted')
print(json.dumps({'originalPointers': 133, 'originalVertices': 4, 'originalIndices': 6, 'independentlyDecodedVertexValues': 48,
                  'reproducibleOutputs': 2, 'rejectedAlteredEvidence': len(mutations), 'wholePackageVerified': False, 'compiledFrameParity': False}))
