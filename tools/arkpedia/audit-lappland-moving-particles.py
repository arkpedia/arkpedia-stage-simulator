#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent numerical reference for all pinned box-emitter profiles.

Source-bundle auditing is separate. These checks prove the documented local
clock/RNG/box/velocity/frame mapping, not Unity native dispatch or frame parity.
"""
import copy
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / '.cache/arkpedia/lappland-alter-source/effects'
OUT = DIRECTORY / 'native-moving-particle-samples.json'
spec = importlib.util.spec_from_file_location('particle_reference', Path(__file__).with_name('audit-lappland-particle-curves.py'))
curves = importlib.util.module_from_spec(spec)
spec.loader.exec_module(curves)


def random_factor(index, salt, seed):
    mask = 0xffffffff
    x = (((index + 1) ^ seed) * 0x45d9f3b ^ (salt + 1) * 0x27d4eb2d) & mask
    x = ((x ^ (x >> 16)) * 0x45d9f3b) & mask
    return (x ^ (x >> 16)) / 4294967296


def reference(source, time, seed):
    initial, emission = source['InitialModule'], source['EmissionModule']
    shape, velocity, uv = source['ShapeModule'], source['VelocityModule'], source['UVModule']
    # Fail if the pinned profile changes beyond this reference's scope.
    assert source['moveWithTransform'] == 1
    assert source['simulationSpeed'] == 1 and source['startDelay']['scalar'] == 0
    assert emission['rateOverTime']['minMaxState'] == 0 and emission['rateOverDistance']['scalar'] == 0
    assert all(b['countCurve']['scalar'] == 0 and b['countCurve']['minMaxState'] == 0 for b in emission['m_Bursts'])
    assert initial['maxNumParticles'] == 1000 and not initial['rotation3D'] and not initial['size3D']
    assert initial['startLifetime']['minMaxState'] in (0, 3)
    assert all(v == 0 for v in shape['m_Rotation'].values()) and shape['type'] == 5
    assert velocity['enabled'] and not velocity['inWorldSpace']
    assert all(velocity[k]['minMaxState'] in (0, 3) for k in ('x', 'y', 'z'))
    assert uv['enabled'] and uv['mode'] == uv['animationType'] == uv['timeMode'] == 0
    assert not source['SizeModule']['separateAxes']
    elapsed = time + (source['lengthInSec'] if source['looping'] and source['prewarm'] else 0)
    if time < 0: return []
    rate = emission['rateOverTime']['scalar']
    particles = []
    end = elapsed if source['looping'] else min(elapsed,source['lengthInSec'])
    for tick in range(1, math.floor(end * rate + 1e-10) + 1):
        born, index = tick / rate, tick - 1
        if not source['looping'] and born >= source['lengthInSec']: continue
        factor = lambda salt: random_factor(index, salt, seed)
        phase = (born % source['lengthInSec']) / source['lengthInSec']
        lifetime = curves.scalar(initial['startLifetime'], phase, factor(0))
        if born + lifetime <= elapsed + 1e-10: continue
        age, size = elapsed - born, curves.scalar(initial['startSize'], phase, factor(1))
        normalized = age / lifetime
        if source['SizeModule']['enabled']: size *= curves.scalar(source['SizeModule']['curve'], normalized, factor(6))
        color = curves.gradient(initial['startColor'], phase, factor(5))
        if source['ColorModule']['enabled']:
            color = [a*b for a, b in zip(color, curves.gradient(source['ColorModule']['gradient'], normalized, factor(9)))]
        origin = [(factor(10+i)-.5)*shape['m_Scale'][axis]+shape['m_Position'][axis] for i, axis in enumerate(('x','y','z'))]
        delta = [age*curves.scalar(velocity[axis], 0, factor(13+i)) for i, axis in enumerate(('x','y','z'))]
        frame_phase = curves.scalar(uv['startFrame'], phase, factor(16)) + uv['cycles']*curves.scalar(uv['frameOverTime'], normalized, factor(17))
        frame = math.floor((frame_phase % 1)*uv['tilesX']*uv['tilesY'])
        particles.append(dict(id=index, born=born, lifetime=lifetime, age=age, size=[size]*3,
                              rotation=curves.scalar(initial['startRotation'], phase, factor(4)), color=color,
                              origin=origin, displacement=delta, position=[a+b for a,b in zip(origin,delta)],
                              velocitySpace='local', simulationSpace='world', birthTime=time-age,
                              sheet=dict(frame=frame, scale=[1/uv['tilesX'],1/uv['tilesY']],
                                         offset=[(frame%uv['tilesX'])/uv['tilesX'],1-(frame//uv['tilesX']+1)/uv['tilesY']], mask=uv['uvChannelMask'])))
    return particles


def compare(actual, expected):
    if isinstance(expected, dict):
        assert actual.keys() == expected.keys()
        return sum(compare(actual[k], v) for k, v in expected.items())
    if isinstance(expected, list):
        assert len(actual) == len(expected)
        return sum(compare(a,b) for a,b in zip(actual,expected))
    if isinstance(expected, (int,float)):
        assert math.isfinite(actual) and math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-8), (actual,expected)
        return 1
    assert actual == expected
    return 0


def verify(report, pack, digest):
    assert report['sourcePackSha256'] == digest and report['schemaVersion'] == 1
    assert report['scope'] == dict(boxSourceSamplingOnly=True, rendererVerified=False, compiledFrameParity=False, enabledOperators=[])
    expected = [k for k,r in pack['records'].items() if r['type']=='ParticleSystem' and r['data']['ShapeModule']['enabled'] and r['data']['ShapeModule']['type']==5]
    assert [e['record'] for e in report['emitters']] == expected and len(expected) == 10
    count = 0
    for row in report['emitters']:
        assert [(s['seed'],s['time']) for s in row['samples']] == [(seed,t) for seed in (1,17) for t in (-1,0,.1,.25,.5,1,2,5,10)]
        for sample in row['samples']:
            count += compare(sample['particles'],reference(pack['records'][row['record']]['data'],sample['time'],sample['seed']))
    return count


def main():
    raw = (DIRECTORY/'native-effects.bin').read_bytes()
    meta = json.loads((ROOT/'data/arkpedia-lappland-effects.json').read_text())['pack']
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == meta['sha256'] and len(raw) == meta['bytes']
    pack = json.loads(gzip.decompress(raw))
    cmd = ['node','tools/arkpedia/review-lappland-moving-particles.mjs']
    subprocess.run(cmd,cwd=ROOT,check=True,capture_output=True)
    report = json.loads(OUT.read_text())
    count = verify(report,pack,digest)
    before = OUT.read_bytes()
    subprocess.run(cmd,cwd=ROOT,check=True,capture_output=True)
    assert before == OUT.read_bytes()
    for alteration in ('missing-emitter','changed-position','changed-sheet','false-space','omitted-probe','false-parity'):
        changed = copy.deepcopy(report)
        if alteration == 'missing-emitter': changed['emitters'].pop()
        elif alteration == 'omitted-probe': changed['emitters'][0]['samples'].pop()
        elif alteration == 'false-parity': changed['scope']['compiledFrameParity'] = True
        else:
            particle = next(p for s in changed['emitters'][0]['samples'] for p in s['particles'])
            if alteration == 'changed-position': particle['position'][0] += .1
            elif alteration == 'changed-sheet': particle['sheet']['frame'] = (particle['sheet']['frame']+1)%4
            elif alteration == 'false-space': particle['simulationSpace'] = 'local'
        try: verify(changed,pack,digest)
        except AssertionError: continue
        raise AssertionError('Accepted altered moving particle mapping: '+alteration)
    print(json.dumps(dict(emitters=10,snapshots=180,scalarValues=count,reproducedFiles=1,rejectedFixtures=6)))


if __name__ == '__main__':
    main()
