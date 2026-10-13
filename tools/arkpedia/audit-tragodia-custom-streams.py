#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify cage custom data/packing against original Unity objects independently."""
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / '.cache/arkpedia/tragodia-source'
MANIFEST = ROOT / 'data/arkpedia-tragodia-custom-streams.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-tragodia-custom-streams.json'
SAMPLES = DIRECTORY / 'custom-stream-samples.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from native_effect_verify import verify as verify_effects


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-tragodia-custom-streams.mjs'], cwd=ROOT,
                   check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


build()
verify_effects(ROOT / '.cache/arkpedia', DIRECTORY / 'effects', ROOT / 'data/arkpedia-tragodia-effects.json',
              {'operator': 'char_1042_phatm2', 'bundle': 'battle/prefabs/effects/phatm2.ab',
               'local_bundle': 'tragodia-source/phatm2-effects.ab', 'root_prefix': 'phatm2_',
               'roots': 33, 'meshes': 32, 'textures': 72, 'unresolved': 4})
pack_raw = (DIRECTORY / 'effects/native-effects.bin').read_bytes()
pack = json.loads(gzip.decompress(pack_raw))
env = UnityPy.load(str(DIRECTORY / 'phatm2-effects.ab'))
originals = {o.path_id: o for o in env.objects}
records = pack['records']


def refs(key, field):
    return [r['target'] for r in records[key]['references'] if r['field'] == field]


expected = {}


def walk(go):
    components = refs(go, 'component')
    for key in components:
        r = records[key]
        if r['type'] != 'ParticleSystemRenderer' or not r['data']['m_UseCustomVertexStreams'] or not r['data']['m_Enabled']:
            continue
        renderer = originals[int(key.rsplit(':', 1)[1])]
        renderer_data = renderer.read_typetree()
        particle = next(k for k in components if records[k]['type'] == 'ParticleSystem')
        ps = originals[int(particle.rsplit(':', 1)[1])]
        native = json.loads(json.dumps(ps.read_typetree()))
        keys = ['lengthInSec', 'simulationSpeed', 'startDelay', 'moveWithTransform', 'ringBufferMode',
                'prewarm', 'looping', 'playOnAwake', 'InitialModule', 'EmissionModule',
                'ColorModule', 'SizeModule', 'CustomDataModule']
        assert all(not isinstance(value, dict) or not value.get('enabled') or key in keys
                   for key, value in native.items()), 'Fixture omits an active native module'
        expected[key] = {'name': records[go]['data']['m_Name'], 'rendererSha256': sha(renderer.get_raw_data()),
                         'particle': particle, 'particleSha256': sha(ps.get_raw_data()),
                         'streams': renderer_data['m_VertexStreams'], 'source': {k: native[k] for k in keys}}
    transform = next(k for k in components if records[k]['type'] == 'Transform')
    for child in refs(transform, 'm_Children'):
        walk(refs(child, 'm_GameObject')[0])


walk(pack['roots']['phatm2_skill_03_prison_01'])
assert len(expected) == 8


def curve_value(curve, time):
    if curve['minMaxState'] == 0:
        return curve['scalar']
    assert curve['minMaxState'] == 1
    c = curve['maxCurve']
    assert c['m_PreInfinity'] == c['m_PostInfinity'] == 2
    keys = c['m_Curve']
    assert all(k['weightedMode'] == 0 for k in keys)
    if time <= keys[0]['time']:
        return curve['scalar'] * keys[0]['value']
    if time >= keys[-1]['time']:
        return curve['scalar'] * keys[-1]['value']
    index = next(i for i, k in enumerate(keys) if k['time'] > time)
    a, b = keys[index-1:index+1]
    span = b['time'] - a['time']
    u = (time - a['time']) / span
    value = ((2*u**3 - 3*u**2 + 1)*a['value'] + (u**3 - 2*u**2 + u)*span*a['outSlope']
             + (-2*u**3 + 3*u**2)*b['value'] + (u**3 - u**2)*span*b['inSlope'])
    return curve['scalar'] * value


def verify(rows, samples, meta):
    raw = (json.dumps(rows, separators=(',', ':')) + '\n').encode()
    assert rows == expected
    assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['operator'] == pack['operator'] == 'char_1042_phatm2'
    assert meta['version'] == pack['version'] and meta['sourcePackSha256'] == sha(pack_raw)
    assert meta['schemaVersion'] == 1
    assert meta['scope'] == {'sourceMapping': True, 'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['renderers'] == {k: {f: r[f] for f in ['name', 'rendererSha256', 'particle', 'particleSha256', 'streams']}
                                 for k, r in rows.items()}
    assert set(samples) == set(rows)
    values = 0
    for key, row in rows.items():
        assert row['streams'] == [0, 1, 3, 4, 34, 38]
        c = row['source']['CustomDataModule']
        assert c['enabled'] and c['mode0'] == 1 and c['mode1'] == 0 and c['vectorComponentCount0'] == 4
        assert [s['age'] for s in samples[key]] == [0, .125, .25, .5, .75, 1, 1.25]
        for s in samples[key]:
            vector = [curve_value(c['vector0_' + str(channel)], min(1, s['age'])) for channel in range(4)]
            expected_custom = [vector, [0, 0, 0, 0]]
            # UV consumes the first two TEXCOORD lanes, then Custom1 and Custom2
            # continue consecutively across vec4 boundaries (Unity 2021.3 UI).
            packed = [[.2, .8, vector[0], vector[1]], [vector[2], vector[3], 0, 0], [0, 0]]
            for actual, wanted in [(s['custom'], expected_custom), (s['packed'], packed)]:
                assert len(actual) == len(wanted)
                for a, b in zip(actual, wanted):
                    assert len(a) == len(b)
                    assert all(math.isfinite(v) and math.isclose(v, w, abs_tol=1e-12) for v, w in zip(a, b))
                    values += len(a)
    return values


rows, samples, meta = [json.loads(p.read_text()) for p in [FIXTURE, SAMPLES, MANIFEST]]
values = verify(rows, samples, meta)
before = hashes()
build()
assert hashes() == before, 'Custom stream export is not reproducible'
mutations = ['curve', 'layout', 'identity', 'missing-renderer', 'disabled-module',
             'sample', 'lane-order', 'omitted-sample', 'premature-enable']
for mutation in mutations:
    r, s, m = copy.deepcopy(rows), copy.deepcopy(samples), copy.deepcopy(meta)
    key = next(iter(r))
    if mutation == 'curve': r[key]['source']['CustomDataModule']['vector0_0']['maxCurve']['m_Curve'][0]['value'] += .5
    elif mutation == 'layout': r[key]['streams'][-1] = 37
    elif mutation == 'identity': r[key]['particleSha256'] = '0' * 64
    elif mutation == 'missing-renderer': del r[key]
    elif mutation == 'disabled-module': r[key]['source']['CustomDataModule']['enabled'] = False
    elif mutation == 'sample': s[key][0]['custom'][0][0] += .1
    elif mutation == 'lane-order': s[key][0]['packed'][0][0], s[key][0]['packed'][0][2] = s[key][0]['packed'][0][2], s[key][0]['packed'][0][0]
    elif mutation == 'omitted-sample': s[key].pop()
    elif mutation == 'premature-enable': m['scope']['enabledOperators'] = ['char_1042_phatm2']
    raw = (json.dumps(r, separators=(',', ':')) + '\n').encode()
    m['fixture'].update(bytes=len(raw), sha256=sha(raw))
    try:
        verify(r, s, m)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed custom streams: ' + mutation)
report = {'renderers': 8, 'sampleValues': values, 'reproducedFiles': 3,
          'rejectedFixtures': len(mutations), 'files': before, 'compiledFrameParity': False}
(DIRECTORY / 'custom-stream-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
