#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check original straight-world controls and independently reconstruct births/points."""
import copy
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia'
META = ROOT / 'data/arkpedia-aphrissa-world-birth.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-aphrissa-world-birth.json'
SAMPLES = CACHE / 'aphrissa-source/effects/world-birth-samples.json'
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE', 'node'), 'tools/arkpedia/export-aphrissa-world-birth.mjs'],
                   cwd=ROOT, check=True, capture_output=True)


build();files = [META, FIXTURE, SAMPLES];before = [sha(p.read_bytes()) for p in files]
meta, rows, samples = [json.loads(p.read_bytes()) for p in files]
effects = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
raw = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(raw) == effects['pack']['sha256'];pack = json.loads(gzip.decompress(raw))
entry = next(r for r in effects['sources'] if r['path'] == 'battle/prefabs/effects/aphris.ab')
bundle = (CACHE / 'cn-native-source/bundles' / entry['path']).read_bytes()
assert len(bundle) == entry['bytes'] and sha(bundle) == entry['sha256']
env = UnityPy.load(bundle);native = {o.path_id: o for o in env.objects};expected = {}
for key, record in pack['records'].items():
    if record['type'] != 'ParticleSystem' or record['bundle'] != entry['path']:
        continue
    obj = native[int(record['pathId'])];s = obj.read_typetree()
    if s['moveWithTransform'] != 1 or any(s[k]['enabled'] for k in ['VelocityModule','ClampVelocityModule','NoiseModule','ForceModule','InheritVelocityModule']):
        continue
    go = native[s['m_GameObject']['m_PathID']];tree = go.read_typetree()
    components = [native[c['component']['m_PathID']] for c in tree['m_Component']]
    renderer = next(o for o in components if o.type.name == 'ParticleSystemRenderer')
    transform = next(o for o in components if o.type.name == 'Transform')
    while transform.read_typetree()['m_Father']['m_PathID']:
        transform = native[transform.read_typetree()['m_Father']['m_PathID']]
    root = entry['path'] + ':' + str(transform.read_typetree()['m_GameObject']['m_PathID'])
    assert normalized(s) == record['data'] and sha(obj.get_raw_data()) == record['serializedSha256']
    expected[key] = {'root': next(k for k, value in pack['roots'].items() if value == root), 'name': tree['m_Name'],
        'serializedSha256': sha(obj.get_raw_data()), 'data': normalized(s), 'gameObjectActive': tree['m_IsActive'],
        'gameObjectSha256': sha(go.get_raw_data()), 'renderer': entry['path'] + ':' + str(renderer.path_id),
        'rendererSha256': sha(renderer.get_raw_data())}


def close(actual, expected):
    if isinstance(expected, dict):
        assert actual.keys() == expected.keys()
        return sum(close(actual[k], v) for k, v in expected.items())
    if isinstance(expected, list):
        assert len(actual) == len(expected)
        return sum(close(a,b) for a,b in zip(actual, expected))
    if isinstance(expected, (float,int)):
        assert math.isfinite(actual) and math.isclose(actual,expected,rel_tol=1e-10,abs_tol=1e-9), (actual,expected)
        return 1
    assert actual == expected
    return 0


def particles(s, time, mode):
    initial, emission = s['InitialModule'], s['EmissionModule']
    assert s['looping'] and s['prewarm'] and s['simulationSpeed'] == 1
    assert s['startDelay']['minMaxState'] == 0 and s['startDelay']['scalar'] == 0
    assert not s['ShapeModule']['enabled']
    assert initial['startSpeed']['minMaxState'] == 0 and initial['startSpeed']['scalar'] == 0
    assert initial['startLifetime']['minMaxState'] == 0
    assert emission['rateOverTime']['minMaxState'] == 0 and emission['rateOverDistance']['scalar'] == 0
    assert all(b['countCurve']['minMaxState'] == 0 and b['countCurve']['scalar'] == 0 for b in emission['m_Bursts'])
    elapsed, rate, lifetime = time+s['lengthInSec'], emission['rateOverTime']['scalar'], initial['startLifetime']['scalar']
    result = []
    for tick in range(1, math.floor(elapsed*rate+1e-10)+1):
        born = tick/rate
        if born+lifetime <= elapsed+1e-10:
            continue
        age = elapsed-born;birth_time = time-age;t = max(0,birth_time)
        # With the original zero speed/disabled shape, position is exactly
        # the explicit birth-frame translation. Later rotation/scale/translation
        # cannot move this original particle to the observer's current frame.
        point = [0,0,0] if mode == 'identity' else ([10+2*t,20+3*t,30-t] if t < .1 else [-20+t,40-2*t,5+t])
        result.append({'id': tick-1, 'born': born, 'birthTime': birth_time, 'age': age, 'lifetime': lifetime,
            'origin': [0,0,0], 'initialVelocity': [0,0,0], 'displacement': [0,0,0],
            'position': point, 'worldPosition': point, 'velocitySpace': 'world', 'simulationSpace': 'world'})
    assert len(result) <= initial['maxNumParticles']
    return result


inputs = [(k, seed, time, mode) for k, r in expected.items() if not r['data']['ShapeModule']['enabled']
          for seed in [1,17] for time in [0,.15,.8,2] for mode in ['identity','affineChange']]


def verify(candidate, manifest, probes):
    assert candidate == expected and len(candidate) == 6
    assert manifest['schemaVersion'] == 1 and manifest['operator'] == pack['operator'] and manifest['version'] == pack['version']
    assert manifest['sourcePackSha256'] == effects['pack']['sha256']
    assert manifest['scope'] == {'originalProfiles': True, 'explicitBirthFrames': True, 'straightWorldKinematics': True,
        'prewarmFramePolicy': 'holdStartPose', 'nativePhaseVerified': False, 'compiledFrameParity': False, 'enabledOperators': []}
    assert manifest['counts'] == {'profiles': 6, 'shapeDisabled': 2, 'shapeEnabled': 4, 'snapshots': 32}
    assert [(p['record'],p['seed'],p['time'],p['mode']) for p in probes] == inputs
    return sum(close(p['particles'], particles(candidate[p['record']]['data'],p['time'],p['mode'])) for p in probes)


values = verify(rows, meta, samples)
for path, field in [(FIXTURE,'fixture'),(SAMPLES,'samples')]:
    assert meta[field] == {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())}
mutations = ['source-speed','source-space','source-object','omitted-profile','changed-clock','changed-history',
             'omitted-particle','follow-current-emitter','invented-prewarm-history','false-native-phase','false-frame-parity','false-admission']
for name in mutations:
    r, m, s = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);key = next(iter(r))
    if name == 'source-speed': r[key]['data']['InitialModule']['startSpeed']['scalar'] += 1
    elif name == 'source-space': r[key]['data']['moveWithTransform'] = 0
    elif name == 'source-object': r[key]['serializedSha256'] = '0'*64
    elif name == 'omitted-profile': del r[key]
    elif name == 'changed-clock': s[0]['time'] += .1
    elif name == 'changed-history': s[0]['mode'] = 'unrecovered-history'
    elif name == 'omitted-particle': s[0]['particles'].pop()
    elif name == 'follow-current-emitter':
        p = next(p for p in s if p['mode'] == 'affineChange' and p['time'] == .8)
        point = [-20+p['time'],40-2*p['time'],5+p['time']]
        p['particles'][0]['worldPosition'] = point;p['particles'][0]['position'] = point
    elif name == 'invented-prewarm-history': m['scope']['prewarmFramePolicy'] = 'replay-unrecorded-animation'
    elif name == 'false-native-phase': m['scope']['nativePhaseVerified'] = True
    elif name == 'false-frame-parity': m['scope']['compiledFrameParity'] = True
    elif name == 'false-admission': m['scope']['enabledOperators'] = [pack['operator']]
    try:
        verify(r, m, s)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed world-birth evidence: '+name)
build();assert before == [sha(p.read_bytes()) for p in files]
print(json.dumps({'originalProfiles': 6, 'sourceStraightEmitters': 2, 'snapshots': 32, 'scalarValues': values,
                  'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'nativePhaseVerified': False}))
