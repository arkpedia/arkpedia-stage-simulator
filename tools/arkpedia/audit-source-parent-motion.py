#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Original parent-object evidence and independently reconstructed cone births.

This audits the local source-physics/frame mapping, not compiled Unity parity.
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
MANIFEST = ROOT/'data/arkpedia-source-parent-motion.json'
FIXTURE = ROOT/'test/fixtures/arkpedia-source-parent-motion.json'
SAMPLES = ROOT/'.cache/arkpedia/lappland-alter-source/source-parent-motion-samples.json'
sys.path.insert(0, str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw): return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-source-parent-motion.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes(): return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


def pointers(v, field=''):
    if isinstance(v, dict): return {k: pointers(x, k) for k, x in v.items()}
    if isinstance(v, list): return [pointers(x, field) for x in v]
    # Preserve the original pack's lossless JSON encoding of native step slopes.
    if isinstance(v, float) and not math.isfinite(v):
        return 'NaN' if math.isnan(v) else ('Infinity' if v > 0 else '-Infinity')
    return str(v) if field == 'm_PathID' else v


build()
links = json.loads((ROOT/'data/arkpedia-particle-birth-links.json').read_bytes())
child_meta = json.loads((ROOT/'data/arkpedia-child-particle-motion.json').read_bytes())
child_rows = json.loads((ROOT/child_meta['fixture']['path']).read_bytes())
previous = json.loads((ROOT/child_meta['samples']['path']).read_bytes())
assert sha((ROOT/child_meta['fixture']['path']).read_bytes()) == child_meta['fixture']['sha256']
assert sha((ROOT/child_meta['samples']['path']).read_bytes()) == child_meta['samples']['sha256']
expected = {}
for name, bundle in [('tragodia', 'phatm2'), ('lappland-alter', 'whitw2')]:
    directory = ROOT/('.cache/arkpedia/'+name+'-source')
    raw = (directory/'effects/native-effects.bin').read_bytes()
    assert sha(raw) == links['sources'][name]['sourcePackSha256']
    pack = json.loads(gzip.decompress(raw));env = UnityPy.load(str(directory/(bundle+'-effects.ab')))
    originals = {o.path_id: o for o in env.objects}
    for key, record in pack['records'].items():
        if record['type'] != 'ParticleSystem' or not record['data']['SubModule']['enabled']: continue
        obj = originals[int(key.rsplit(':', 1)[1])];s = pointers(obj.read_typetree())
        assert s == record['data'] and sha(obj.get_raw_data()) == links['parents'][key]['particleSha256']
        refs = [r for r in record['references'] if r['field'] == 'emitter']
        for slot, ref in zip(s['SubModule']['subEmitters'], refs):
            assert slot['type'] == slot['properties'] == 0 and slot['emitProbability'] == 1
            assert slot['emitter'] == ref['pointer'] and ref['target'] in child_rows
            assert originals[int(ref['target'].rsplit(':', 1)[1])].type.name == 'ParticleSystem'
        data = {k: v for k, v in s.items() if not k.endswith('Module') or v['enabled'] or k == 'EmissionModule'}
        expected[key] = {'source': name, 'particleSha256': sha(obj.get_raw_data()), 'data': data, 'references': record['references']}


def factor(identity, salt):
    mask = 2**32-1
    h = ((((identity+1) ^ 1)*0x45d9f3b) & mask) ^ (((salt+1)*0x27d4eb2d) & mask)
    h = ((h ^ (h >> 16))*0x45d9f3b) & mask
    return (h ^ (h >> 16))/2**32


def near(a, b):
    assert len(a) == len(b)
    for x, y in zip(a, b): assert math.isfinite(x) and math.isclose(x, y, rel_tol=1e-9, abs_tol=1e-9), (x, y)


def verify(rows, meta, samples):
    assert rows == expected and meta['sources'] == links['sources'] and meta['childFixture'] == child_meta['fixture']
    assert meta['scope'] == {'sourceParentParticleMotion': True, 'sourceChildScheduling': True, 'syntheticParentMotion': False,
                             'sourceFrames': 'identityDiagnostic', 'velocityAcquisition': 'local60HzOneSidedAtBirth',
                             'compiledFrameParity': False, 'enabledOperators': []}
    statuses, origins = {}, {}
    for key, row in rows.items():
        s = row['data']
        if s['prewarm'] and s['looping']: statuses[key] = {'held': 'Parent prewarm motion needs a source-history contract'}
        elif s.get('TrailModule', {}).get('enabled'): statuses[key] = {'held': 'TrailModule lifecycle not playing'}
        else:
            assert s['ShapeModule']['type'] == 4 and s['ShapeModule']['arc']['mode'] == s['ShapeModule']['arc']['spread'] == 0
            assert s['ShapeModule']['radiusThickness'] == 1 and s['InitialModule']['startSpeed']['scalar'] == 0
            assert s['moveWithTransform'] == 0 and s['simulationSpeed'] == 1
            assert not s.get('VelocityModule', {}).get('enabled') and not s.get('NoiseModule', {}).get('enabled')
            assert all(v == 0 for v in s['ShapeModule']['m_Position'].values()) and all(v == 0 for v in s['ShapeModule']['m_Rotation'].values())
            radius = s['ShapeModule']['radius']['value']*math.sqrt(factor(0, 10));phi = factor(0, 11)*math.pi*2
            origins[key] = [radius*math.cos(phi)*s['ShapeModule']['m_Scale']['x'], radius*math.sin(phi)*s['ShapeModule']['m_Scale']['y'], 0]
            statuses[key] = {'sampled': True}
    assert meta['statuses'] == statuses and set(samples['parents']) == set(origins)
    values = particles = 0
    for key, series in samples['parents'].items():
        assert [s['time'] for s in series] == [.03, .1, .2, .44]
        source = rows[key]['data']
        for s in series:
            near(s['position'], origins[key]);near(s['velocity'], [0, 0, 0]);near(s['particle']['origin'], origins[key]);values += 9
            assert s['birth']['id'] == 0 and s['birth']['birthTime'] == source['startDelay']['scalar']
            assert s['birth']['lifetime'] == source['InitialModule']['startLifetime']['scalar']
            assert math.isclose(s['particle']['age'], s['time']-s['birth']['birthTime'], abs_tol=1e-12)
    desired = {key for key in child_rows if not child_meta['admission'][key].get('held')
               and all(parent in origins for parent, r in rows.items() if any(ref['target'] == key for ref in r['references'] if ref['field'] == 'emitter'))
               and child_rows[key]['source'] == 'lappland-alter'}
    assert set(samples['children']) == desired and len(desired) == 54
    for key, series in samples['children'].items():
        assert [s['time'] for s in series] == [0, .03, .1, .5, 1, 2, 4]
        for index, sample in enumerate(series):
            before = previous[key][index]['particles'];assert len(before) == len(sample['particles'])
            for p, old in zip(sample['particles'], before):
                assert {k: v for k, v in p.items() if k != 'sourceParentWorldPosition'} == {k: v for k, v in old.items() if k != 'diagnosticWorldPosition'}
                expected_position = [origins[p['parent']][i]+p.get('origin', [0, 0, 0])[i]+p.get('displacement', [0, 0, 0])[i] for i in range(3)]
                near(p['sourceParentWorldPosition'], expected_position);values += 3;particles += 1
    assert meta['counts'] == {'parents': 15, 'sampledParents': 6, 'heldParents': 9, 'sampledChildren': 54, 'particles': particles}
    return values


rows, meta, samples = [json.loads(p.read_bytes()) for p in [FIXTURE, MANIFEST, SAMPLES]]
for path, field in [(FIXTURE, 'fixture'), (SAMPLES, 'samples')]:
    raw = path.read_bytes();assert meta[field] == {'path': str(path.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
values = verify(rows, meta, samples)
before = hashes();build();assert hashes() == before, 'Source parent motion outputs changed on replay'
mutations = []
for flag in ['sourceParentParticleMotion', 'syntheticParentMotion', 'compiledFrameParity']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);b['scope'][flag] = not b['scope'][flag];mutations.append((a, b, c))
key = next(iter(samples['parents']))
for field in ['position', 'velocity']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c['parents'][key][0][field][0] += 1;mutations.append((a, b, c))
for field in ['id', 'birthTime', 'lifetime']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c['parents'][key][0]['birth'][field] += 1;mutations.append((a, b, c))
child = next(k for k, series in samples['children'].items() if any(s['particles'] for s in series))
index = next(i for i, s in enumerate(samples['children'][child]) if s['particles'])
for field in ['age', 'parentParticle']:
    a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c['children'][child][index]['particles'][0][field] += 1;mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);c['children'][child][index]['particles'][0]['sourceParentWorldPosition'][0] += 1;mutations.append((a, b, c))
a, b, c = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);a[key]['data']['SubModule']['subEmitters'][0]['properties'] = 1;mutations.append((a, b, c))
for candidate in mutations:
    try: verify(*candidate)
    except AssertionError: pass
    else: raise AssertionError('Altered parent motion evidence accepted')
print(json.dumps({**meta['counts'], 'frameValues': values, 'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'compiledFrameParity': False}))
