#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Native controls plus independent Simpson integration and bounded limit replay."""
import copy
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia'
META = ROOT / 'data/arkpedia-aphrissa-linear-motion.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-aphrissa-linear-motion.json'
SAMPLES = CACHE / 'aphrissa-source/effects/linear-motion-samples.json'
sha = lambda b: hashlib.sha256(b).hexdigest()


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    m = importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


curves = module('linear_curve_reference', 'audit-lappland-particle-curves.py')
random_factor = module('linear_rng_reference', 'audit-lappland-moving-particles.py').random_factor


def average(curve, start, stop, lifetime, factor):
    if start == stop:
        return curves.scalar(curve, start / lifetime, factor)
    # Split at every original key, then independently integrate point samples.
    # Simpson is exact for each supported unweighted cubic segment and its
    # constant tails; no JS primitive/coefficient implementation is reused.
    edges = {start / lifetime, stop / lifetime}
    for field in ['minCurve', 'maxCurve']:
        edges.update(k['time'] for k in curve.get(field, {}).get('m_Curve', [])
                     if start / lifetime < k['time'] < stop / lifetime)
    edges = sorted(edges);integral = 0
    for a, b in zip(edges, edges[1:]):
        n = 8;h = (b-a)/n
        total = curves.scalar(curve, a, factor) + curves.scalar(curve, b, factor)
        total += sum((4 if i % 2 else 2)*curves.scalar(curve, a+i*h, factor) for i in range(1, n))
        integral += h * total / 3
    return integral * lifetime / (stop-start)


def displacement(source, probe):
    particle, seed = probe['particle'], probe['seed']
    velocity, delta, elapsed = probe['initialVelocity'][:], [0, 0, 0], 0
    while elapsed < particle['age'] - 1e-12:
        dt = min(1/60, particle['age']-elapsed)
        linear = [average(source['VelocityModule'][axis], elapsed, elapsed+dt, particle['lifetime'],
                          random_factor(particle['id'], 13+i, seed)) for i, axis in enumerate(['x', 'y', 'z'])]
        if source['moveWithTransform'] == 1:
            assert source['VelocityModule']['inWorldSpace'] is False
            m = probe['movement']
            linear = [sum(m[4*j+i]*linear[j] for j in range(3)) for i in range(3)]
        total = [a+b for a, b in zip(velocity, linear)]
        limit = curves.scalar(source['ClampVelocityModule']['magnitude'], (elapsed+dt)/particle['lifetime'],
                              random_factor(particle['id'], 19, seed))
        speed = math.sqrt(sum(v*v for v in total))
        if speed > limit:
            ratio = 1-(1-limit/speed)*(1-(1-source['ClampVelocityModule']['dampen'])**(dt*60))
            total = [v*ratio for v in total]
        delta = [a+b*dt for a, b in zip(delta, total)]
        velocity = [a-b for a, b in zip(total, linear)]
        elapsed += dt
    return delta


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE', 'node'), 'tools/arkpedia/export-aphrissa-linear-motion.mjs'],
                   cwd=ROOT, check=True, capture_output=True)


build();paths = [META, FIXTURE, SAMPLES];before = [sha(p.read_bytes()) for p in paths]
meta, rows, samples = [json.loads(p.read_bytes()) for p in paths]
effects = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
raw = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(raw) == effects['pack']['sha256'];pack = json.loads(gzip.decompress(raw))
source = next(r for r in effects['sources'] if r['path'] == 'battle/prefabs/effects/aphris.ab')
raw_bundle = (CACHE / 'cn-native-source/bundles' / source['path']).read_bytes()
assert len(raw_bundle) == source['bytes'] and sha(raw_bundle) == source['sha256']
env = UnityPy.load(raw_bundle);native = {o.path_id: o for o in env.objects}
expected = {}
for key, record in pack['records'].items():
    if record['type'] != 'ParticleSystem' or record['bundle'] != source['path']:
        continue
    obj = native[int(record['pathId'])];s = obj.read_typetree()
    if not s['VelocityModule']['enabled'] or not any(s[k]['enabled'] for k in ['ClampVelocityModule', 'NoiseModule', 'ForceModule']):
        continue
    go_object = native[s['m_GameObject']['m_PathID']];go = go_object.read_typetree()
    renderer = next(native[c['component']['m_PathID']] for c in go['m_Component']
                    if native[c['component']['m_PathID']].type.name == 'ParticleSystemRenderer')
    transform = next(native[c['component']['m_PathID']] for c in go['m_Component']
                     if native[c['component']['m_PathID']].type.name == 'Transform')
    while transform.read_typetree()['m_Father']['m_PathID']:
        transform = native[transform.read_typetree()['m_Father']['m_PathID']]
    root_go = source['path'] + ':' + str(transform.read_typetree()['m_GameObject']['m_PathID'])
    root_name = next(k for k, value in pack['roots'].items() if value == root_go)
    assert normalized(s) == record['data'] and sha(obj.get_raw_data()) == record['serializedSha256']
    assert s['NoiseModule']['enabled'] is False and s['ForceModule']['enabled'] is False and s['InheritVelocityModule']['enabled'] is False
    assert s['VelocityModule']['inWorldSpace'] is False
    assert s['ClampVelocityModule']['enabled'] and not s['ClampVelocityModule']['separateAxis']
    assert s['ClampVelocityModule']['drag']['scalar'] == 0 and s['ClampVelocityModule']['drag']['minMaxState'] == 0
    for field in ['orbitalX', 'orbitalY', 'orbitalZ', 'orbitalOffsetX', 'orbitalOffsetY', 'orbitalOffsetZ', 'radial']:
        assert s['VelocityModule'][field]['minMaxState'] == 0 and s['VelocityModule'][field]['scalar'] == 0
    assert s['VelocityModule']['speedModifier']['minMaxState'] == 0 and s['VelocityModule']['speedModifier']['scalar'] == 1
    expected[key] = {'root': root_name, 'name': go['m_Name'], 'gameObjectActive': go['m_IsActive'], 'gameObjectSha256': sha(go_object.get_raw_data()),
                     'serializedSha256': sha(obj.get_raw_data()), 'data': normalized(s),
                     'renderer': source['path'] + ':' + str(renderer.path_id), 'rendererSha256': sha(renderer.get_raw_data())}
frames = [[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], [0,2,0,0,-3,0,0,0,0,0,-4,0,100,200,300,1]]
probe_inputs = [(key, seed, index, age, frame) for key in expected for seed in [1,17]
                for index in [0,7] for age in [0,.05,.37,1.1] for frame in frames]


def verify(candidate, manifest, probes):
    assert candidate == expected and len(candidate) == 11
    assert manifest['schemaVersion'] == 1 and manifest['operator'] == pack['operator'] and manifest['version'] == pack['version']
    assert manifest['sourcePackSha256'] == effects['pack']['sha256']
    assert manifest['scope'] == {'originalProfiles': True, 'intervalAveragedLinearVelocity': True, 'explicitCrossSpaceFrames': True,
        'localReplay': True, 'nativeModuleOrderVerified': False, 'nativeFrameParity': False, 'enabledOperators': []}
    assert manifest['counts'] == {'profiles': 11, 'local': 10, 'world': 1, 'roots': 6, 'serializedInactive': 3, 'probes': 352}
    assert [(p['record'], p['seed'], p['particle']['id'], p['particle']['age'], p['movement']) for p in probes] == probe_inputs
    for p in probes:
        assert p['particle']['born'] == .2 and p['particle']['lifetime'] == 2
        assert p['origin'] == [.1,.2,.3] and p['initialVelocity'] == [-.4,.3,.2]
        expected_delta = displacement(candidate[p['record']]['data'], p)
        assert len(p['displacement']) == 3
        assert all(math.isfinite(a) and math.isclose(a,b,rel_tol=1e-8,abs_tol=1e-9) for a,b in zip(p['displacement'], expected_delta)), p


verify(rows, meta, samples)
for path, field in [(FIXTURE, 'fixture'), (SAMPLES, 'samples')]:
    assert meta[field] == {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())}
mutations = ['source-curve', 'source-space', 'source-object', 'omitted-profile', 'probe-frame', 'probe-clock',
             'probe-result', 'omitted-probe', 'false-native-order', 'false-frame-parity', 'false-admission', 'forced-activation']
for mutation in mutations:
    r, m, s = copy.deepcopy(rows), copy.deepcopy(meta), copy.deepcopy(samples);key = next(iter(r))
    if mutation == 'source-curve': r[key]['data']['VelocityModule']['x']['scalar'] += .1
    elif mutation == 'source-space': r[key]['data']['VelocityModule']['inWorldSpace'] = True
    elif mutation == 'source-object': r[key]['serializedSha256'] = '0'*64
    elif mutation == 'omitted-profile': del r[key]
    elif mutation == 'probe-frame': s[0]['movement'][0] += 1
    elif mutation == 'probe-clock': s[0]['particle']['age'] += .01
    elif mutation == 'probe-result': s[0]['displacement'][0] += 1
    elif mutation == 'omitted-probe': s.pop()
    elif mutation == 'false-native-order': m['scope']['nativeModuleOrderVerified'] = True
    elif mutation == 'false-frame-parity': m['scope']['nativeFrameParity'] = True
    elif mutation == 'false-admission': m['scope']['enabledOperators'] = [pack['operator']]
    elif mutation == 'forced-activation': next(row for row in r.values() if not row['gameObjectActive'])['gameObjectActive'] = True
    try:
        verify(r, m, s)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed linear-motion evidence: ' + mutation)
build();assert before == [sha(p.read_bytes()) for p in paths]
print(json.dumps({'sourceProfiles': 11, 'independentTrajectoryProbes': len(samples), 'scalarValues': len(samples)*3,
                  'reproducibleOutputs': 3, 'rejectedAlteredEvidence': len(mutations), 'nativeModuleOrderVerified': False}))
