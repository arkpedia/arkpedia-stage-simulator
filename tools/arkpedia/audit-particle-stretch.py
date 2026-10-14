#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent original renderer controls and velocity/camera basis audit."""
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2];sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
META = ROOT/'data/arkpedia-particle-stretch.json';FIXTURE = ROOT/'test/fixtures/arkpedia-particle-stretch.json'
SAMPLES = ROOT/'.cache/arkpedia/lappland-alter-source/stretch-samples.json'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def pointers(t):
    if isinstance(t, dict): return {k: str(v) if k == 'm_PathID' else pointers(v) for k, v in t.items()}
    if isinstance(t, list): return [pointers(v) for v in t]
    return t


def build(): subprocess.run(['node', 'tools/arkpedia/export-particle-stretch.mjs'], cwd=ROOT, check=True, capture_output=True)


build();expected, sources = {}, {}
for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
    directory = ROOT/('.cache/arkpedia/'+name+'-source');raw = (directory/'effects/native-effects.bin').read_bytes();pack = json.loads(gzip.decompress(raw))
    meta = json.loads((ROOT/('data/arkpedia-'+('lappland' if name == 'lappland-alter' else name)+'-effects.json')).read_bytes());assert sha(raw) == meta['pack']['sha256']
    originals = {o.path_id: o for o in UnityPy.load(str(directory/(bundle+'-effects.ab'))).objects}
    sources[name] = {'operator': pack['operator'], 'version': pack['version'], 'sourcePackSha256': sha(raw)}
    for key, r in pack['records'].items():
        if r['type'] != 'ParticleSystemRenderer' or r['data']['m_RenderMode'] != 1: continue
        obj = originals[int(key.rsplit(':', 1)[1])];s = pointers(obj.read_typetree());assert s == r['data']
        go = next(ref['target'] for ref in r['references'] if ref['field'] == 'm_GameObject')
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'], 'data': s, 'serializedSha256': sha(obj.get_raw_data())}


def verify(rows, meta, samples):
    assert rows == expected and meta['sources'] == sources and len(rows) == 52
    assert meta['scope'] == {'localVelocityBillboard': True, 'velocityAcquisition': '60HzOneSidedAtBirth', 'legacyHeadOnThinning': True,
                             'nativeBasisOrderVerified': False, 'compiledFrameParity': False, 'enabledOperators': []}
    assert set(samples) == set(rows);values = 0
    for key, series in samples.items():
        d = rows[key]['data'];assert len(series) == 3
        for sample in series:
            p = sample['probe'];speed = math.sqrt(sum(v*v for v in p['velocity']));eye = [a-b for a, b in zip(p['cameraPosition'], p['position'])];distance = math.sqrt(sum(v*v for v in eye))
            y, view = [v/speed for v in p['velocity']], [v/distance for v in eye]
            x = [y[1]*view[2]-y[2]*view[1], y[2]*view[0]-y[0]*view[2], y[0]*view[1]-y[1]*view[0]];width = math.sqrt(sum(v*v for v in x))
            z = [view[i] if width == 0 else (x[(i+1)%3]*y[(i+2)%3]-x[(i+2)%3]*y[(i+1)%3])/width for i in range(3)]
            c, s = math.cos(p['rotation']), math.sin(p['rotation'])
            a = [(x[i]*c+y[i]*s)*p['size'][0] for i in range(3)]
            b = [(y[i]*c-x[i]*s)*p['size'][1]*d['m_LengthScale'] for i in range(3)]
            z = [v*p['size'][2] for v in z];pivot = [d['m_Pivot'][k] for k in ['x', 'y', 'z']]
            anchor = [p['position'][i]-a[i]*pivot[0]-b[i]*pivot[1]-z[i]*pivot[2] for i in range(3)]
            matrix = a+[0]+b+[0]+z+[0]+anchor+[1]
            assert len(sample['matrix']) == 16 and all(abs(a-b) < 1e-10 for a, b in zip(sample['matrix'], matrix));values += 16
    assert meta['counts'] == {'renderers': 52, 'matrices': 156};return values


rows, meta, samples = [json.loads(p.read_bytes()) for p in [FIXTURE, META, SAMPLES]];values = verify(rows, meta, samples)
for p, field in [(FIXTURE, 'fixture'), (SAMPLES, 'samples')]:
    raw = p.read_bytes();assert meta[field] == {'path': str(p.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
before = [sha(p.read_bytes()) for p in [META, FIXTURE, SAMPLES]];build();assert [sha(p.read_bytes()) for p in [META, FIXTURE, SAMPLES]] == before
mutations = [];key = next(iter(rows))
for field in ['nativeBasisOrderVerified', 'compiledFrameParity']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);b['scope'][field] = True;mutations.append((a, b, c))
for field in ['m_LengthScale', 'm_VelocityScale', 'm_CameraVelocityScale', 'm_RenderAlignment']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);a[key]['data'][field] = 999;mutations.append((a, b, c))
for index in [0, 5, 12]:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c[key][0]['matrix'][index] += 1;mutations.append((a, b, c))
for candidate in mutations:
    try: verify(*candidate)
    except AssertionError: pass
    else: raise AssertionError('Altered stretched particle evidence accepted')
print(json.dumps({**meta['counts'], 'matrixValues': values, 'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'nativeBasisOrderVerified': False}))
