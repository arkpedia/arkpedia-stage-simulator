#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent local curl replay check using finite-difference Perlin derivatives.

The native bundle audit establishes original controls separately. This audits
our declared mapping and source membership; it cannot certify Unity's native
permutation tables, noise coordinates, module ordering or physical frame timing.
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
OUT = DIRECTORY / 'native-particle-motion-samples.json'


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


curves = load('curve_reference','audit-lappland-particle-curves.py')
random_factor = load('moving_reference','audit-lappland-moving-particles.py').random_factor


class Field:
    def __init__(self, seed):
        self.tables = []
        for channel in range(3):
            table = list(range(256))
            for i in range(255,0,-1):
                j = math.floor(random_factor(255-i,channel*256+i,seed)*(i+1))
                table[i],table[j] = table[j],table[i]
            self.tables.append(table)

    def value(self, point, channel):
        table = self.tables[channel]
        cell = [math.floor(v) for v in point]
        local = [v-c for v,c in zip(point,cell)]
        f = [6*t**5-15*t**4+10*t**3 for t in local]
        result = 0
        for x in (0,1):
            for y in (0,1):
                for z in (0,1):
                    h = table[(table[(table[(cell[0]+x)&255]+cell[1]+y)&255]+cell[2]+z)&255]&15
                    offset = [local[0]-x,local[1]-y,local[2]-z]
                    u = offset[0] if h<8 else offset[1]
                    v = offset[1] if h<4 else offset[0] if h in (12,14) else offset[2]
                    dot = (-u if h&1 else u)+(-v if h&2 else v)
                    result += dot*(f[0] if x else 1-f[0])*(f[1] if y else 1-f[1])*(f[2] if z else 1-f[2])
        return result

    def gradient(self, point, channel):
        epsilon = 1e-5
        out = []
        for i in range(3):
            a,b = point[:],point[:]
            a[i] += epsilon
            b[i] -= epsilon
            out.append((self.value(a,channel)-self.value(b,channel))/(2*epsilon))
        return out

    def curl(self, point):
        x,y,z = [self.gradient(point,c) for c in range(3)]
        return [z[1]-y[2],x[2]-z[0],y[0]-x[1]]


def flow(source, field, position, time, normalized, index, seed):
    n = source['NoiseModule']
    strength = curves.scalar(n['strength'],normalized,random_factor(index,20,seed))*curves.scalar(n['positionAmount'],normalized,random_factor(index,21,seed))
    scroll = n['scrollSpeed']['scalar']*time
    frequency, amplitude, result = n['frequency'],1,[0,0,0]
    for octave in range(n['octaves']):
        point = [v*frequency+(scroll if i==2 else 0) for i,v in enumerate(position)]
        weight = strength*amplitude/(frequency if n['damping'] else 1)
        result = [a+b*weight for a,b in zip(result,field.curl(point))]
        frequency *= n['octaveScale']
        amplitude *= n['octaveMultiplier']
    return result


def trajectory(source, field, probe):
    particle, seed = probe['particle'],probe['seed']
    position,velocity,elapsed = probe['origin'][:],probe['initialVelocity'][:],0
    clamp = source['ClampVelocityModule']
    while elapsed < particle['age']-1e-12:
        dt = min(1/60,particle['age']-elapsed)
        normalized = (elapsed+dt)/particle['lifetime']
        drift = flow(source,field,position,particle['born']+elapsed,normalized,particle['id'],seed)
        total = [v+d for v,d in zip(velocity,drift)]
        if clamp['enabled']:
            limit = curves.scalar(clamp['magnitude'],normalized,random_factor(particle['id'],19,seed))
            speed = math.sqrt(sum(v*v for v in total))
            if speed > limit:
                ratio = 1-(1-limit/speed)*(1-(1-clamp['dampen'])**(dt*60))
                total = [v*ratio for v in total]
        position = [v+t*dt for v,t in zip(position,total)]
        velocity = [t-d for t,d in zip(total,drift)]
        elapsed += dt
    return [v-o for v,o in zip(position,probe['origin'])]


def compare(actual, expected):
    assert len(actual) == len(expected)
    for a,b in zip(actual,expected):
        assert math.isfinite(a) and math.isclose(a,b,rel_tol=1e-7,abs_tol=2e-6), (a,b)
    return len(expected)


def verify(report, pack, digest):
    assert report['sourcePackSha256'] == digest and report['schemaVersion'] == 1
    assert report['scope'] == dict(localReplay=True,compiledFrameParity=False,enabledOperators=[])
    count = 0
    fields = {seed:Field(seed) for seed in (1,17)}
    assert [row['seed'] for row in report['fields']] == [1,17]
    for row in report['fields']:
        field = fields[row['seed']]
        assert [p['point'] for p in row['probes']] == [[0,0,0],[.21,.31,.41],[-2.73,.37,1.13],[1,.75,2.31]]
        for probe in row['probes']:
            assert len(probe['perlin']) == 3
            for channel,actual in enumerate(probe['perlin']):
                count += compare([actual['value']],[field.value(probe['point'],channel)])
                count += compare(actual['gradient'],field.gradient(probe['point'],channel))
            count += compare(probe['curl'],field.curl(probe['point']))
    expected = [k for k,r in pack['records'].items() if r['type']=='ParticleSystem' and r['data']['NoiseModule']['enabled']]
    assert [r['record'] for r in report['components']] == expected and len(expected) == 35
    for row in report['components']:
        source = pack['records'][row['record']]['data']
        if source['moveWithTransform'] != 0 or source['VelocityModule']['enabled']:
            assert row['blocked'] == 'Moving simulation/linear velocity with particle turbulence needs review' and row['probes'] == []
            continue
        assert row['blocked'] is None
        assert [(p['seed'],p['particle']['age']) for p in row['probes']] == [(s,a) for s in (1,17) for a in (.05,.5)]
        for probe in row['probes']:
            assert probe['particle'] == dict(id=7,born=.2,lifetime=2,age=probe['particle']['age'])
            assert probe['origin'] == [.1,.2,.3] and probe['initialVelocity'] == [-3,0,0]
            field = fields[probe['seed']]
            count += compare(probe['flow'],flow(source,field,probe['origin'],.2,probe['particle']['age']/2,7,probe['seed']))
            count += compare(probe['displacement'],trajectory(source,field,probe))
    return count


def main():
    raw = (DIRECTORY/'native-effects.bin').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    meta = json.loads((ROOT/'data/arkpedia-lappland-effects.json').read_text())['pack']
    assert digest == meta['sha256'] and len(raw) == meta['bytes']
    pack = json.loads(gzip.decompress(raw))
    cmd = ['node','tools/arkpedia/review-lappland-particle-motion.mjs']
    subprocess.run(cmd,cwd=ROOT,check=True,capture_output=True)
    report = json.loads(OUT.read_text())
    count = verify(report,pack,digest)
    before = OUT.read_bytes()
    subprocess.run(cmd,cwd=ROOT,check=True,capture_output=True)
    assert OUT.read_bytes() == before
    for alteration in ('changed-perlin','changed-curl','changed-flow','changed-motion','missing-source','false-parity','false-support'):
        changed = copy.deepcopy(report)
        if alteration == 'changed-perlin': changed['fields'][0]['probes'][0]['perlin'][0]['gradient'][0] += .1
        elif alteration == 'changed-curl': changed['fields'][0]['probes'][0]['curl'][0] += .1
        elif alteration == 'missing-source': changed['components'].pop()
        elif alteration == 'false-parity': changed['scope']['compiledFrameParity'] = True
        elif alteration == 'false-support': next(c for c in changed['components'] if c['blocked'])['blocked'] = None
        else:
            probe = next(c for c in changed['components'] if c['probes'])['probes'][0]
            probe['flow' if alteration=='changed-flow' else 'displacement'][0] += .1
        try: verify(changed,pack,digest)
        except AssertionError: continue
        raise AssertionError('Accepted changed particle motion mapping: '+alteration)
    print(json.dumps(dict(sourceNoiseComponents=35,localReplayComponents=25,blocked=10,scalarValues=count,reproducedFiles=1,rejectedFixtures=7,compiledFrameParity=False)))


if __name__ == '__main__':
    main()
