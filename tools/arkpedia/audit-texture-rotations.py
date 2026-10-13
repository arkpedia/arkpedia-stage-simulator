#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Read original script/renderer typetrees and independently rotate UV samples."""
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
META = ROOT/'data/arkpedia-texture-rotations.json'
FIXTURE = ROOT/'test/fixtures/arkpedia-texture-rotations.json'
SAMPLES = ROOT/'.cache/arkpedia/lappland-alter-source/texture-rotation-samples.json'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def pointers(tree):
    if isinstance(tree, dict): return {k: str(v) if k == 'm_PathID' else pointers(v) for k, v in tree.items()}
    if isinstance(tree, list): return [pointers(v) for v in tree]
    return tree


def build():
    subprocess.run(['node', 'tools/arkpedia/export-texture-rotations.mjs'], cwd=ROOT, check=True, capture_output=True)


build();expected, sources = {}, {}
for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
    directory = ROOT/('.cache/arkpedia/'+name+'-source');raw = (directory/'effects/native-effects.bin').read_bytes();pack = json.loads(gzip.decompress(raw))
    meta = json.loads((ROOT/('data/arkpedia-'+('lappland' if name == 'lappland-alter' else name)+'-effects.json')).read_bytes());assert sha(raw) == meta['pack']['sha256']
    originals = {o.path_id: o for o in UnityPy.load(str(directory/(bundle+'-effects.ab'))).objects}
    sources[name] = {'operator': pack['operator'], 'version': pack['version'], 'sourcePackSha256': sha(raw)}
    for key, r in pack['records'].items():
        if r['type'] != 'MonoBehaviour' or '_rotateTex1' not in r['data']: continue
        obj = originals[int(key.rsplit(':', 1)[1])];s = obj.read_typetree()
        # Exported PPtr int64 values are strings to retain exact identity in JS.
        for field in ['m_GameObject', 'm_Script']: s[field]['m_PathID'] = str(s[field]['m_PathID'])
        assert s == r['data'] and sha(obj.get_raw_data()) == r['serializedSha256']
        foreign = obj.assets_file.externals[s['m_Script']['m_FileID']-1].path
        assert pack['scriptBindings'][key] == {'foreignFile': foreign, 'pointer': s['m_Script']}
        go = next(ref['target'] for ref in r['references'] if ref['field'] == 'm_GameObject')
        renderer = next(ref['target'] for ref in pack['records'][go]['references'] if pack['records'][ref['target']]['type'].endswith('Renderer'))
        rd = pack['records'][renderer];ro = originals[int(renderer.rsplit(':', 1)[1])];tree = ro.read_typetree()
        assert sha(ro.get_raw_data()) == rd['serializedSha256']
        assert pointers(tree) == rd['data']
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'], 'data': s, 'references': r['references'],
                         'serializedSha256': r['serializedSha256'], 'binding': pack['scriptBindings'][key], 'component': renderer,
                         'renderer': {'data': rd['data'], 'references': rd['references'], 'serializedSha256': rd['serializedSha256']}, 'gameObject': go}


def verify(rows, meta, samples):
    assert rows == expected and meta['sources'] == sources and len(rows) == 3
    assert meta['scope'] == {'sourceAngles': True, 'localCounterclockwiseBasis': True, 'nativeSignOrderVerified': False,
                             'scriptLifecycleVerified': False, 'compiledFrameParity': False, 'enabledOperators': []}
    assert set(samples) == set(rows)
    values = 0
    for key, series in samples.items():
        d = rows[key]['data'];angles = [d['angle1'], d['_angle2'], d['_angle3'], d['_angle4']]
        assert set(series) == {f'_Rotation{i}' for i in range(4)}
        for i, angle in enumerate(angles):
            r = math.radians(angle);c, s = math.cos(r), math.sin(r);sample = series[f'_Rotation{i}']
            assert all(abs(a-b) < 1e-12 for a, b in zip(sample['vector'], [c, s, -s, c]))
            assert len(sample['uvs']) == 5
            for uv in sample['uvs']:
                x, y = [v-.5 for v in uv['uv']]
                wanted = [x*c-y*s+.5, x*s+y*c+.5]
                assert all(abs(a-b) < 1e-12 for a, b in zip(uv['rotated'], wanted));values += 2
    assert meta['counts'] == {'scripts': 3, 'renderers': 3, 'vectors': 12, 'uvSamples': 60}
    return values


rows, meta, samples = [json.loads(p.read_bytes()) for p in [FIXTURE, META, SAMPLES]]
values = verify(rows, meta, samples)
for p, field in [(FIXTURE, 'fixture'), (SAMPLES, 'samples')]:
    raw = p.read_bytes();assert meta[field] == {'path': str(p.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
before = [sha(p.read_bytes()) for p in [META, FIXTURE, SAMPLES]];build();assert [sha(p.read_bytes()) for p in [META, FIXTURE, SAMPLES]] == before
mutations = [];key = next(iter(rows))
for field in ['nativeSignOrderVerified', 'scriptLifecycleVerified', 'compiledFrameParity']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);b['scope'][field] = True;mutations.append((a, b, c))
for field in ['angle1', '_angle3', '_rotateTex1', '_propertyName']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);a[key]['data'][field] = 999;mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);a[key]['binding']['pointer']['m_PathID'] = '0';mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c[key]['_Rotation0']['uvs'][0]['rotated'][0] += .1;mutations.append((a, b, c))
for candidate in mutations:
    try: verify(*candidate)
    except AssertionError: pass
    else: raise AssertionError('Altered texture rotation evidence accepted')
print(json.dumps({**meta['counts'], 'uvValues': values, 'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'nativeSignOrderVerified': False}))
