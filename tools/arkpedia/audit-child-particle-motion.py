#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify child motion inputs against Unity objects and explicit frame diagnostics.

Numerical checks cover lineage, local/world frame mapping and the original
Initial-inheritance profiles. This does not certify compiled Unity dispatch.
"""
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT/'data/arkpedia-child-particle-motion.json'
FIXTURE = ROOT/'test/fixtures/arkpedia-child-particle-motion.json'
SAMPLES = ROOT/'.cache/arkpedia/tragodia-source/child-motion-samples.json'
sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw): return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-child-particle-motion.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes(): return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


def pointers(value, field=''):
    if isinstance(value, dict): return {k: pointers(v, k) for k, v in value.items()}
    if isinstance(value, list): return [pointers(v, field) for v in value]
    return str(value) if field == 'm_PathID' else value


build()
links = json.loads((ROOT/'data/arkpedia-particle-birth-links.json').read_bytes())
previous = json.loads((ROOT/'.cache/arkpedia/tragodia-source/child-emission-samples.json').read_bytes())
previous_meta = json.loads((ROOT/'data/arkpedia-child-emission.json').read_bytes())
assert sha((ROOT/previous_meta['samples']['path']).read_bytes()) == previous_meta['samples']['sha256']
expected = {}
for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
    directory = ROOT/('.cache/arkpedia/'+name+'-source')
    raw = (directory/'effects/native-effects.bin').read_bytes()
    assert sha(raw) == links['sources'][name]['sourcePackSha256']
    pack = json.loads(gzip.decompress(raw))
    env = UnityPy.load(str(directory/(bundle+'-effects.ab')))
    originals = {o.path_id: o for o in env.objects}
    for key, row in links['children'].items():
        if row['source'] != name: continue
        obj = originals[int(key.rsplit(':', 1)[1])]
        assert obj.type.name == 'ParticleSystem'
        s = pointers(obj.read_typetree())
        assert s == pack['records'][key]['data']
        assert sha(obj.get_raw_data()) == row['particleSha256']
        data = {k: v for k, v in s.items() if not k.endswith('Module') or v['enabled'] or k == 'EmissionModule'}
        expected[key] = {'source': name, 'particleSha256': row['particleSha256'], 'data': data}


def near(a, b):
    assert len(a) == len(b)
    for x, y in zip(a, b): assert math.isfinite(x) and math.isclose(x, y, rel_tol=1e-9, abs_tol=1e-9), (x, y)


def verify(rows, meta, samples):
    assert rows == expected
    assert meta['sources'] == links['sources'] and meta['birthFixture'] == links['fixture']
    assert meta['schemaVersion'] == 1
    assert meta['scope'] == {'sourceMapping': True, 'scheduledParticleSampling': True, 'explicitParentMotion': True,
                             'syntheticParentMotion': True, 'nativeParentMotion': False, 'childEmissionPlaying': False,
                             'compiledFrameParity': False, 'enabledOperators': []}
    assert set(meta['admission']) == set(rows)
    held = {k for k, r in rows.items() if r['data'].get('ShapeModule', {}).get('type') == 4
            and (r['data']['ShapeModule']['arc']['mode'] != 0 or r['data']['ShapeModule']['arc']['spread'] != 0)}
    assert len(held) == 6 and set(samples) == set(rows)-held
    for key, r in rows.items():
        if key in held: assert meta['admission'][key] == {'held': 'Native cone angle/arc mode needs review'}
        else:
            s = r['data']
            moving = s['moveWithTransform'] == 1 or any(s.get(m, {}).get('enabled') for m in ['ShapeModule', 'VelocityModule', 'UVModule', 'ClampVelocityModule', 'NoiseModule', 'InheritVelocityModule'])
            assert meta['admission'][key] == {'sampler': 'moving' if moving else 'stationary'}
    count = values = 0
    for key, series in samples.items():
        s = rows[key]['data']
        assert [r['time'] for r in series] == [0, .03, .1, .5, 1, 2, 4]
        for index, sample in enumerate(series):
            desired = previous[key][index]['alive']
            assert len(sample['particles']) == len(desired)
            for p, birth in zip(sample['particles'], desired):
                for field, value in birth.items(): assert p[field] == value
                near(p['size'], p['size']);near(p['color'], p['color'])
                t, identity = p['birthTime'], p['parentParticle']
                parent = [identity*.01+t*.2, t*.1, -t*.3]
                origin, displacement = p.get('origin', [0, 0, 0]), p.get('displacement', [0, 0, 0])
                position = [parent[i]+origin[i]+displacement[i] for i in range(3)]
                near(p['diagnosticWorldPosition'], position);values += 3
                if rows[key]['source'] == 'tragodia':
                    assert s['moveWithTransform'] == 1 and s['InitialModule']['startSpeed']['scalar'] == 0
                    assert s['InheritVelocityModule']['m_Mode'] == 0
                    v = [x*s['InheritVelocityModule']['m_Curve']['scalar'] for x in [.2, .1, -.3]]
                    assert math.sqrt(sum(x*x for x in v)) < s['ClampVelocityModule']['magnitude']['scalar']
                    near(p['inheritedVelocity'], v);near(displacement, [x*p['age'] for x in v]);near(p['worldPosition'], position)
                    values += 9
                count += 1
    assert meta['counts'] == {'children': 69, 'sampled': 63, 'held': 6, 'particles': count}
    return values


rows, meta, samples = [json.loads(p.read_bytes()) for p in [FIXTURE, MANIFEST, SAMPLES]]
for path, field in [(FIXTURE, 'fixture'), (SAMPLES, 'samples')]:
    raw = path.read_bytes()
    assert meta[field] == {'path': str(path.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
values = verify(rows, meta, samples)
before = hashes();build();assert hashes() == before, 'Child motion outputs are not reproducible'
mutations = []
for flag in ['syntheticParentMotion', 'nativeParentMotion', 'childEmissionPlaying', 'compiledFrameParity']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples)
    b['scope'][flag] = not b['scope'][flag];mutations.append((a, b, c))
key = next(k for k, series in samples.items() if any(s['particles'] for s in series))
sample_index = next(i for i, s in enumerate(samples[key]) if s['particles'])
for field in ['age', 'id', 'birthTime', 'parentParticle', 'lifetime']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples)
    c[key][sample_index]['particles'][0][field] += 1;mutations.append((a, b, c))
for field in ['diagnosticWorldPosition', 'worldPosition', 'inheritedVelocity', 'displacement']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples)
    c[key][sample_index]['particles'][0][field][0] += 1;mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples)
a[key]['data']['InitialModule']['startSpeed']['scalar'] += 1;mutations.append((a, b, c))
for candidate in mutations:
    try: verify(*candidate)
    except AssertionError: pass
    else: raise AssertionError('Altered child motion evidence accepted')
print(json.dumps({'originalChildren': 69, **meta['counts'], 'frameAndVelocityValues': values,
                  'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'compiledFrameParity': False}))
