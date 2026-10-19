#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify source line profiles and independently measure generated ribbons."""
import copy
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
from native_effect_animation_verify import UnityPy
from native_effect_verify import normalized

ROOT = Path(__file__).resolve().parents[2]
NODE = os.environ.get('ARKPEDIA_REVIEW_NODE', 'node')
DIRECTORY = ROOT / '.cache/arkpedia/aphrissa-source/effects'
FILES = [ROOT / 'data/arkpedia-aphrissa-lines.json', ROOT / 'test/fixtures/arkpedia-aphrissa-lines.json']
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run([NODE, 'tools/arkpedia/export-aphrissa-lines.mjs'], cwd=ROOT, check=True, capture_output=True)


build()
before = [sha(p.read_bytes()) for p in FILES]
meta, fixture = [json.loads(p.read_bytes()) for p in FILES]
effects = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
pack_raw = (DIRECTORY / 'native-effects.bin').read_bytes()
assert sha(pack_raw) == effects['pack']['sha256']
pack = json.loads(gzip.decompress(pack_raw))
source = next(r for r in effects['sources'] if r['path'] == 'battle/prefabs/effects/aphris.ab')
raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / source['path']).read_bytes()
assert sha(raw) == source['sha256'] and len(raw) == source['bytes']
objects = {o.path_id: o for o in UnityPy.load(raw).objects}
expected = {}
for key, r in pack['records'].items():
    if r['type'] != 'LineRenderer':
        continue
    obj = objects[int(r['pathId'])]
    assert obj.type.name == 'LineRenderer' and sha(obj.get_raw_data()) == r['serializedSha256']
    assert normalized(obj.read_typetree()) == r['data']
    expected[key] = r
assert len(expected) == 24
roots = {}
for name in meta['roots']:
    root_id = int(effects['roots'][name].rsplit(':', 1)[1])
    found = []

    def walk(go_id):
        go = objects[go_id].read_typetree()
        for entry in go['m_Component']:
            obj = objects[entry['component']['m_PathID']]
            if obj.type.name == 'LineRenderer':
                found.append(source['path'] + ':' + str(obj.path_id))
            elif obj.type.name == 'Transform':
                for child in obj.read_typetree()['m_Children']:
                    walk(objects[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID'])
    walk(root_id)
    assert len(found) == 8
    roots[name] = found


def verify(m, f):
    assert m['schemaVersion'] == 1 and m['operator'] == pack['operator'] and m['version'] == pack['version']
    assert m['sourcePackSha256'] == sha(pack_raw)
    assert m['scope'] == {'originalProfiles': True, 'explicitEndpointsRequired': True,
        'nativeEndpointDispatchVerified': False, 'nativeShaderGlobalsVerified': False,
        'compiledFrameParity': False, 'enabledOperators': []}
    assert f == expected and m['roots'] == roots
    assert set(m['roots']) == {'aphris_attack_01_line_01', 'aphris_skill_02_line_01', 'aphris_skill_03_line_01'}
    assert set(m['lines']) == set(expected)
    for key, r in expected.items():
        assert m['lines'][key] == {'sourceSha256': r['serializedSha256'],
            'material': next(x['target'] for x in r['references'] if x['field'] == 'm_Materials'),
            'worldSpace': True, 'textureMode': 1}


verify(meta, fixture)
assert meta['fixture'] == {'path': str(FILES[1].relative_to(ROOT)), 'bytes': FILES[1].stat().st_size,
                           'sha256': sha(FILES[1].read_bytes())}
script = """import fs from'node:fs';import{createEffectLine}from'./shared/arkpedia/native-effect-line.js';
const f=JSON.parse(fs.readFileSync('test/fixtures/arkpedia-aphrissa-lines.json')),out={};
for(const[id,r]of Object.entries(f)){const l=createEffectLine(r.data);out[id]=[];for(const points of [l.originalPositions,[[1,2,3],[4,5,3]]])for(const width of [0,.1,.4,r.data.m_Parameters.widthMultiplier]){
const camera=[1,4,12];out[id].push({points,width,camera,result:l.sample(points,camera,width)});}}process.stdout.write(JSON.stringify(out));"""
samples = json.loads(subprocess.run([NODE, '--input-type=module', '-e', script], cwd=ROOT, check=True,
                                    capture_output=True, text=True).stdout)
quads = 0
close = lambda a, b: math.isclose(a, b, abs_tol=1e-10, rel_tol=1e-10)
for key, rows in samples.items():
    p = expected[key]['data']['m_Parameters']
    assert len(p['widthCurve']['m_Curve']) == 1
    assert p['colorGradient']['key0'] == p['colorGradient']['key1'] == {'r': 1, 'g': 1, 'b': 1, 'a': 1}
    for row in rows:
        d, points = row['result'], row['points']
        width = row['width'] * p['widthCurve']['m_Curve'][0]['value']
        if width == 0:
            assert d == {k: [] for k in ['positions', 'colors', 'uvs', 'indices', 'widths']}
            continue
        assert d['indices'] == [0, 1, 2, 1, 3, 2] and d['colors'] == [1]*16
        assert d['widths'] == [width, width]
        length = math.dist(*points)
        assert all(close(a, b) for a, b in zip(d['uvs'], [0, 0, 0, 1, length, 0, length, 1]))
        tangent = [b-a for a, b in zip(*points)]
        vertices = [d['positions'][i:i+3] for i in range(0, 12, 3)]
        for index in range(2):
            a, b = vertices[index*2:index*2+2]
            assert close(math.dist(a, b), width)
            assert all(close((x+y)/2, z) for x, y, z in zip(a, b, points[index]))
            assert close(sum((y-x)*t for x, y, t in zip(a, b, tangent)), 0)
            toward = [c-v for c, v in zip(row['camera'], points[index])]
            assert close(sum((y-x)*v for x, y, v in zip(a, b, toward)), 0)
        quads += 1
names = ['false-admission', 'false-globals', 'false-dispatch', 'false-frame-parity', 'omitted-layer',
         'changed-endpoint', 'changed-width', 'changed-material', 'changed-root', 'changed-loop']
for name in names:
    m, f = copy.deepcopy(meta), copy.deepcopy(fixture)
    key = next(iter(f))
    if name == 'false-admission': m['scope']['enabledOperators'] = ['char_4229_aphris']
    elif name == 'false-globals': m['scope']['nativeShaderGlobalsVerified'] = True
    elif name == 'false-dispatch': m['scope']['nativeEndpointDispatchVerified'] = True
    elif name == 'false-frame-parity': m['scope']['compiledFrameParity'] = True
    elif name == 'omitted-layer': del f[key]
    elif name == 'changed-endpoint': f[key]['data']['m_Positions'][0]['x'] += .1
    elif name == 'changed-width': f[key]['data']['m_Parameters']['widthMultiplier'] += .1
    elif name == 'changed-material': m['lines'][key]['material'] = 'invented'
    elif name == 'changed-root': m['roots'][next(iter(m['roots']))].pop()
    elif name == 'changed-loop': f[key]['data']['m_Loop'] = True
    try:
        verify(m, f)
    except (AssertionError, KeyError):
        pass
    else:
        raise AssertionError('Accepted altered source line evidence: ' + name)
build()
assert before == [sha(p.read_bytes()) for p in FILES]
report = {'originalLines': 24, 'originalRoots': 3, 'independentlyMeasuredQuads': quads,
          'reproducibleOutputs': 2, 'rejectedAlteredEvidence': len(names), 'compiledFrameParity': False}
(DIRECTORY / 'line-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
