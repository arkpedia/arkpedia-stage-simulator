#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Decode original Cube/Quad buffers independently and verify five native pointers."""
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
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
DIRECTORY = ROOT / '.cache/arkpedia/unity-builtin-source'
META = ROOT / 'data/arkpedia-aphrissa-builtin-meshes.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-aphrissa-builtin-meshes.json'
def sha(raw): return hashlib.sha256(raw).hexdigest()
def build():
    subprocess.run([sys.executable, 'tools/arkpedia/export-aphrissa-builtin-meshes.py'], cwd=ROOT, check=True, capture_output=True)
def hashes(): return [sha(p.read_bytes()) for p in [META, FIXTURE]]
build()
meta, fixture = [json.loads(p.read_bytes()) for p in [META, FIXTURE]]
resources = UnityPy.load((DIRECTORY / 'unity default resources').read_bytes())
objects = {o.path_id: o for o in resources.objects};decoded = {}
for mesh, count, size in [('10202', 24, 1816), ('10210', 4, 604)]:
    obj = objects[int(mesh)];tree = obj.read_typetree();channels = tree['m_VertexData']['m_Channels'];raw = tree['m_VertexData']['m_DataSize'];stride = 56 if mesh == '10202' else 48
    assert len(obj.get_raw_data()) == size and len(raw) == count * stride and tree['m_IndexFormat'] == 0
    assert tree['m_VertexData']['m_VertexCount'] == count
    assert [c['stream'] for c in channels if c['dimension']] == [0] * (5 if mesh == '10202' else 4)
    assert [(c['offset'], c['format'], c['dimension']) for c in channels if c['dimension']] == [(0,0,3),(12,0,3),(24,0,4),(40,0,2)] + ([(48,0,2)] if mesh == '10202' else [])
    def channel(index):
        c = channels[index]
        return [list(struct.unpack_from('<' + 'f' * c['dimension'], raw, i * stride + c['offset'])) for i in range(count)]
    positions, normals, tangents, uv = [channel(i) for i in [0,1,2,4]]
    indices = list(struct.unpack('<' + 'H' * (len(tree['m_IndexBuffer']) // 2), bytes(tree['m_IndexBuffer'])))
    assert len(indices) == (36 if mesh == '10202' else 6)
    sub = tree['m_SubMeshes'];assert len(sub) == 1 and sub[0]['firstByte'] == 0 and sub[0]['indexCount'] == len(indices) and sub[0]['baseVertex'] == 0
    decoded[mesh] = {'positions': positions, 'normals': normals, 'tangents': tangents, 'uv': uv, 'colors': None,
                     'vertexChannels': channels, 'uvChannels': [uv,channel(5)] + [None] * 6 if mesh == '10202' else [uv] + [None] * 7,
                     'submeshTriangles': [[indices[i:i+3] for i in range(0,len(indices),3)]]}
    assert fixture['objects'][mesh]['tree']['m_VertexData']['m_DataSize'] == {'encoding':'base64','data':base64.b64encode(raw).decode()}
pack_raw = (ROOT / '.cache/arkpedia/aphrissa-source/effects/native-effects.bin').read_bytes();pack = json.loads(gzip.decompress(pack_raw))
pack_meta = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes());assert sha(pack_raw) == pack_meta['pack']['sha256']
references, loaded = {}, {}
for key, row in pack['records'].items():
    for ref in row.get('references', []):
        missing = ref.get('unresolved', {})
        if ref['field'] != 'm_Mesh' or missing.get('foreignFile') != 'Library/unity default resources': continue
        mesh = missing['pathId'];assert mesh in decoded
        if row['bundle'] not in loaded:
            raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / row['bundle']).read_bytes()
            original = next(r for r in pack_meta['sources'] if r['path'] == row['bundle']);assert sha(raw) == original['sha256'] and len(raw) == original['bytes']
            env = UnityPy.load(raw);assert len(env.assets) == 1;loaded[row['bundle']] = env.assets[0]
        f = loaded[row['bundle']];obj = f.objects[int(row['pathId'])];assert sha(obj.get_raw_data()) == row['serializedSha256']
        assert f.unity_version == meta['client']['unityVersion'] and int(f.target_platform) == meta['client']['platform']
        ptr = obj.read_typetree()['m_Mesh'];assert ptr['m_FileID'] == ref['pointer']['m_FileID'] and str(ptr['m_PathID']) == mesh == ref['pointer']['m_PathID']
        assert f.externals[ptr['m_FileID'] - 1].path == 'Library/unity default resources'
        references[key] = {'sourcePackSha256':sha(pack_raw),'pointer':ref['pointer'],'mesh':mesh}
def verify(m,f):
    assert m['schemaVersion'] == 1 and len(references) == 5 and m['references'] == references
    assert m['supportedEffectPacks'] == {sha(pack_raw): {'operator':pack['operator'],'version':pack['version'],'unityVersion':'2021.3.39f1','platform':13}}
    assert m['scope'] == {'sourceInputsOnly':True,'originalBuiltinMesh':True,'engineMatchedOfficialPlayer':True,'exactGameClientVerified':False,'wholePackageVerified':False,'compiledFrameParity':False,'enabledOperators':[]}
    assert set(m['meshes']) == set(f['objects']) == set(decoded)
    for mesh, data in decoded.items():
        obj = objects[int(mesh)];row = m['meshes'][mesh]
        assert row['name'] == obj.read_typetree()['m_Name'] and row['serializedBytes'] == len(obj.get_raw_data()) and row['serializedSha256'] == sha(obj.get_raw_data())
        assert row['data'] == data
        assert f['objects'][mesh]['serializedSha256'] == row['serializedSha256'] and f['objects'][mesh]['serializedBytes'] == row['serializedBytes']
    for field,name,digest in [('resource','unity default resources','ea2ce64646b2a83bcd5fc8ff40ab1a8eb6abbbf225798c865fbbfabe1f45fc22'),('client','globalgamemanagers','6d1ffcec028d346f6c1de06c4a6764d848fb6f272e59a189d9597dbda162220f')]:
        raw = (DIRECTORY / name).read_bytes();source = m[field];native = UnityPy.load(raw).assets[0]
        assert f[field] == source and source['sha256'] == sha(raw) == digest and source['bytes'] == len(raw) and source['crc32'] == zlib.crc32(raw)
        assert source['wholePackageVerified'] is False and source['platform'] == int(native.target_platform) == 13 and source['unityVersion'] == native.unity_version
        assert source['url'] == m['client']['url'] and source['etag'] == m['client']['etag']
    assert m['client']['unityVersion'] == '2021.3.39f1' and m['resource']['unityVersion'] == '2021.3.38f1'
verify(meta,fixture)
raw = FIXTURE.read_bytes();assert meta['fixture'] == {'path':str(FIXTURE.relative_to(ROOT)),'bytes':len(raw),'sha256':sha(raw)}
before = hashes();build();assert hashes() == before
mutations = []
for mesh in decoded:
    for field in ['positions','normals','tangents','uv']:
        m,f = copy.deepcopy(meta),copy.deepcopy(fixture);m['meshes'][mesh]['data'][field][0][0] += 1;mutations.append((m,f))
    m,f = copy.deepcopy(meta),copy.deepcopy(fixture);m['meshes'][mesh]['data']['submeshTriangles'][0][0].reverse();mutations.append((m,f))
m,f = copy.deepcopy(meta),copy.deepcopy(fixture);m['meshes']['10202']['data']['uvChannels'][1][0][0] += 1;mutations.append((m,f))
for change in [lambda m:m['client'].update(unityVersion='2022.3.0f1'),lambda m:m['resource'].update(sha256='changed'),lambda m:m['scope'].update(exactGameClientVerified=True),lambda m:m['scope'].update(wholePackageVerified=True),lambda m:m['references'][next(iter(references))]['pointer'].update(m_FileID=99),lambda m:m['supportedEffectPacks'].clear()]:
    m,f = copy.deepcopy(meta),copy.deepcopy(fixture);change(m);mutations.append((m,f))
for candidate in mutations:
    try:verify(*candidate)
    except AssertionError:pass
    else:raise AssertionError('Changed original mesh evidence accepted')
print(json.dumps({'originalMeshes':2,'originalPointers':5,'independentlyDecodedVertices':28,'independentlyDecodedIndices':42,'reproducibleOutputs':2,'rejectedAlteredEvidence':len(mutations),'exactGameClientVerified':False}))
