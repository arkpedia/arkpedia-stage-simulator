#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent reference for source trail controls and the local ribbon policy.

Fixture motion, native point expiry/interpolation, joins and UV direction are
not certified game motion or Unity frame parity. Raw bundle audit is separate.
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
OUT = DIRECTORY / 'native-trail-samples.json'
spec = importlib.util.spec_from_file_location('curves', Path(__file__).with_name('audit-lappland-particle-curves.py'))
curves = importlib.util.module_from_spec(spec)
spec.loader.exec_module(curves)


def minus(a, b): return [x-y for x, y in zip(a, b)]


def length(a): return math.sqrt(sum(x*x for x in a))


def unit(a):
    magnitude = length(a)
    return [x/magnitude for x in a] if magnitude > 1e-12 else None


def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def reference(source, time, history, camera):
    p = source['m_Parameters']
    assert p['alignment'] == p['textureMode'] == p['numCapVertices'] == p['numCornerVertices'] == 0
    assert not p['generateLightingData'] and not source['m_Autodestruct']
    accepted = []
    for point in history:
        if point['time'] > time or not source['m_Enabled'] or not source['m_Emitting'] or not point['emitting']: continue
        gap = length(minus(point['position'], accepted[-1]['position'])) if accepted else math.inf
        if gap >= source['m_MinVertexDistance'] and gap > 1e-12: accepted.append(point)
    points = [dict(time=r['time'], position=r['position']) for r in reversed(accepted) if time-r['time'] < source['m_Time']]
    result = dict(points=points, positions=[], colors=[], uvs=[], indices=[], widths=[])
    if len(points) < 2: return result
    arcs = [0.0]
    for a, b in zip(points, points[1:]): arcs.append(arcs[-1]+length(minus(a['position'], b['position'])))
    if arcs[-1] <= 1e-12: return result
    for i, row in enumerate(points):
        position = row['position']
        a, b = points[max(0,i-1)]['position'], points[min(len(points)-1,i+1)]['position']
        tangent = unit(minus(b,a)) or unit(minus(position,a) if i else minus(b,position))
        side = unit(cross(tangent,minus(camera,position)))
        if side is None:
            axis = min(range(3),key=lambda k:abs(tangent[k]))
            basis = [0,0,0]; basis[axis]=1; side=unit(cross(tangent,basis))
        u = arcs[i]/arcs[-1]
        width = p['widthMultiplier']*curves.sample_keys(p['widthCurve'],u)
        color = curves.gradient_keys(p['colorGradient'],u)
        result['widths'].append(width)
        for sign in [-1,1]:
            result['positions'].extend(x+sign*s*width/2 for x,s in zip(position,side))
            result['colors'].extend(color)
            result['uvs'].extend([u,0 if sign == -1 else 1])
        if i:
            j=i*2;result['indices'].extend([j-2,j-1,j,j-1,j+1,j])
    return result


def compare(actual, expected):
    if isinstance(expected,dict):
        assert actual.keys() == expected.keys()
        return sum(compare(actual[k],v) for k,v in expected.items())
    if isinstance(expected,list):
        assert len(actual)==len(expected)
        return sum(compare(a,b) for a,b in zip(actual,expected))
    assert isinstance(actual,(int,float)) and math.isfinite(actual)
    assert math.isclose(actual,expected,abs_tol=1e-9,rel_tol=1e-9), (actual,expected)
    return 1


def verify(report, pack, digest):
    assert report['schemaVersion']==1 and report['sourcePackSha256']==digest
    assert report['scope']==dict(fixtureMotionOnly=True,rendererVerified=False,compiledFrameParity=False,enabledOperators=[])
    history=[dict(time=i/60,position=[i/60,0,0] if i<45 else [.75,(i-45)/60,0] if i<90 else [.75,.75,0],emitting=i<65 or i>75) for i in range(121)]
    assert report['history']==history and report['camera']==[.2,.4,5]
    expected={k:v for k,v in pack['records'].items() if v['type']=='TrailRenderer'}
    assert len(report['trails'])==len(expected)==27 and {t['record'] for t in report['trails']}==expected.keys()
    count=0
    for t in report['trails']:
        assert [s['time'] for s in t['samples']]==[0,.1,.5,1,1.25,2,3]
        for s in t['samples']: count+=compare(s['data'],reference(expected[t['record']]['data'],s['time'],history,report['camera']))
    return count


def main():
    raw=(DIRECTORY/'native-effects.bin').read_bytes();digest=hashlib.sha256(raw).hexdigest()
    meta=json.loads((ROOT/'data/arkpedia-lappland-effects.json').read_text())
    assert digest==meta['pack']['sha256'] and len(raw)==meta['pack']['bytes']
    pack=json.loads(gzip.decompress(raw));report=json.loads(OUT.read_text());count=verify(report,pack,digest)
    before=OUT.read_bytes();subprocess.run(['node','tools/arkpedia/review-lappland-trails.mjs'],cwd=ROOT,check=True,capture_output=True)
    assert OUT.read_bytes()==before
    rejected=0
    for field in ['positions','colors','uvs','widths','indices']:
        altered=copy.deepcopy(report);d=altered['trails'][0]['samples'][2]['data'];d[field][0]+=.1
        try: verify(altered,pack,digest)
        except AssertionError: rejected+=1
        else: raise AssertionError('Accepted altered '+field)
    for field,value in [('sourcePackSha256','bad'),('schemaVersion',2),('scope',dict(compiledFrameParity=True))]:
        altered=copy.deepcopy(report);altered[field]=value
        try: verify(altered,pack,digest)
        except AssertionError: rejected+=1
        else: raise AssertionError('Accepted altered '+field)
    print(json.dumps(dict(trails=27,snapshots=189,scalarValues=count,reproduced=1,rejectedFixtures=rejected,compiledFrameParity=False)))


if __name__=='__main__': main()
