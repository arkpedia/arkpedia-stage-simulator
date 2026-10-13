#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Original pivot fields plus independent scaled-basis anchor reconstruction."""
import copy
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
META = ROOT/'data/arkpedia-particle-pivots.json';FIXTURE = ROOT/'test/fixtures/arkpedia-particle-pivots.json'
SAMPLES = ROOT/'.cache/arkpedia/lappland-alter-source/pivot-samples.json'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-particle-pivots.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes(): return [sha(p.read_bytes()) for p in [META, FIXTURE, SAMPLES]]


build();expected, sources = {}, {}
for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
    directory = ROOT/('.cache/arkpedia/'+name+'-source');raw = (directory/'effects/native-effects.bin').read_bytes();pack = json.loads(gzip.decompress(raw))
    meta = json.loads((ROOT/('data/arkpedia-'+('lappland' if name == 'lappland-alter' else name)+'-effects.json')).read_bytes());assert sha(raw) == meta['pack']['sha256']
    originals = {o.path_id: o for o in UnityPy.load(str(directory/(bundle+'-effects.ab'))).objects}
    sources[name] = {'operator': pack['operator'], 'version': pack['version'], 'sourcePackSha256': sha(raw)}
    for key, r in pack['records'].items():
        if r['type'] != 'ParticleSystemRenderer': continue
        obj = originals[int(key.rsplit(':', 1)[1])];s = obj.read_typetree()
        assert s['m_Pivot'] == r['data']['m_Pivot'] and s['m_Flip'] == r['data']['m_Flip']
        if all(v == 0 for v in s['m_Pivot'].values()): continue
        go = next(ref['target'] for ref in r['references'] if ref['field'] == 'm_GameObject')
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'], 'serializedSha256': sha(obj.get_raw_data()),
                         'data': {k: s[k] for k in ['m_RenderMode', 'm_RenderAlignment', 'm_Pivot', 'm_Flip', 'm_Enabled']}}


def verify(rows, meta, samples):
    assert rows == expected and meta['sources'] == sources and len(rows) == 64
    assert meta['scope'] == {'sourceMapping': True, 'localPivotMapping': True, 'anchorConvention': 'positionMinusRotatedScaledPivot',
                             'nativeSignOrderVerified': False, 'flipPlaying': False, 'compiledFrameParity': False, 'enabledOperators': []}
    held = {key: 'Native particle pivot render mode/alignment needs review' for key, r in rows.items()
            if r['data']['m_RenderMode'] not in [0, 4] or r['data']['m_RenderAlignment'] not in [0, 2]}
    assert meta['held'] == held and set(samples) == set(rows)-set(held)
    values = 0
    for key, series in samples.items():
        pivot = [rows[key]['data']['m_Pivot'][k] for k in ['x', 'y', 'z']]
        assert len(series) == 3
        for s in series:
            frame, actual = s['frame'], s['matrix'];assert len(frame) == len(actual) == 16 and actual[:12] == frame[:12] and actual[15] == 1
            # Independent scalar column expansion, including nonuniform scale,
            # reflection and shear. Evaluating the declared pivot recovers the
            # original physical anchor without modifying source vertex arrays.
            for axis in range(3):
                offset = sum(frame[axis+column*4]*pivot[column] for column in range(3))
                assert abs(actual[12+axis]-(frame[12+axis]-offset)) < 1e-10
                anchor = sum(actual[axis+column*4]*pivot[column] for column in range(3))+actual[12+axis]
                assert abs(anchor-frame[12+axis]) < 1e-10;values += 2
    assert meta['counts'] == {'renderers': 64, 'sampled': 32, 'held': 32, 'matrices': 96}
    return values


rows, meta, samples = [json.loads(p.read_bytes()) for p in [FIXTURE, META, SAMPLES]]
values = verify(rows, meta, samples)
for p, field in [(FIXTURE, 'fixture'), (SAMPLES, 'samples')]:
    raw = p.read_bytes();assert meta[field] == {'path': str(p.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
before = hashes();build();assert hashes() == before, 'Pivot outputs changed on replay'
key = next(iter(samples));mutations = []
for field in ['nativeSignOrderVerified', 'compiledFrameParity', 'flipPlaying']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);b['scope'][field] = True;mutations.append((a, b, c))
for axis in [0, 1, 2]:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c[key][1]['matrix'][12+axis] += 1;mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);a[key]['data']['m_Pivot']['x'] += 1;mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c[key][0]['matrix'][0] += 1;mutations.append((a, b, c))
for candidate in mutations:
    try: verify(*candidate)
    except AssertionError: pass
    else: raise AssertionError('Altered pivot evidence accepted')
print(json.dumps({**meta['counts'], 'anchorValues': values, 'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'nativeSignOrderVerified': False}))
