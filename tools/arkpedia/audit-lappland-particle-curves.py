#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check JS particle samples with a separate Hermite-basis/gradient reference.

Input definitions are in the independently audited native source pack. This
checks mathematical sampling and complete source membership, not Unity parity.
"""
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / '.cache/arkpedia/lappland-alter-source/effects'
OUT = DIRECTORY / 'native-particle-curve-samples.json'


def freeze(d):
    if isinstance(d, dict): return tuple((k, freeze(v)) for k, v in sorted(d.items()))
    if isinstance(d, list): return tuple(freeze(v) for v in d)
    return d


def sample_keys(c, t):
    keys = c['m_Curve']
    assert c['m_PreInfinity'] == c['m_PostInfinity'] == 2 and keys
    assert all(k['weightedMode'] == 0 for k in keys)
    if t <= keys[0]['time']: return keys[0]['value']
    if t >= keys[-1]['time']: return keys[-1]['value']
    for a, b in zip(keys, keys[1:]):
        if a['time'] <= t < b['time']:
            span = b['time'] - a['time']
            u = (t - a['time']) / span
            return ((2*u**3-3*u**2+1)*a['value'] + (u**3-2*u**2+u)*span*a['outSlope']
                    + (-2*u**3+3*u**2)*b['value'] + (u**3-u**2)*span*b['inSlope'])
    raise AssertionError('Missing source curve segment')


def scalar(d, t, f):
    mode = d['minMaxState']
    if mode == 0: return d['scalar']
    if mode == 1: return d['scalar'] * sample_keys(d['maxCurve'], t)
    if mode == 2: return d['scalar'] * ((1-f)*sample_keys(d['minCurve'], t) + f*sample_keys(d['maxCurve'], t))
    assert mode == 3
    return (1-f)*d['minScalar']+f*d['scalar']


def gradient_keys(g, t):
    assert g['m_Mode'] == 0
    values = []
    for component in 'rgba':
        prefix, count = ('a', g['m_NumAlphaKeys']) if component == 'a' else ('c', g['m_NumColorKeys'])
        keys = [(g[prefix+'time'+str(i)]/65535, g['key'+str(i)][component]) for i in range(count)]
        if t <= keys[0][0]: values.append(keys[0][1]); continue
        if t >= keys[-1][0]: values.append(keys[-1][1]); continue
        for (ta, a), (tb, b) in zip(keys, keys[1:]):
            if ta <= t < tb:
                values.append(((tb-t)*a+(t-ta)*b)/(tb-ta)); break
    assert len(values) == 4
    return values


def gradient(d, t, f):
    t = max(0, min(1, t))
    mode = d['minMaxState']
    def rgba(v): return [v[k] for k in 'rgba']
    if mode == 0: return rgba(d['maxColor'])
    if mode == 1: return gradient_keys(d['maxGradient'], t)
    if mode == 2: a, b = rgba(d['minColor']), rgba(d['maxColor'])
    elif mode == 3: a, b = gradient_keys(d['minGradient'], t), gradient_keys(d['maxGradient'], t)
    else:
        assert mode == 4
        return gradient_keys(d['maxGradient'], f)
    return [(1-f)*x+f*y for x, y in zip(a, b)]


def verify(report, pack, digest):
    assert report['schemaVersion'] == 1 and report['sourcePackSha256'] == digest
    assert report['scope'] == {'sourceSamplingOnly': True, 'compiledFrameParity': False}
    expected = {'curves': set(), 'gradients': set()}
    def walk(d):
        if isinstance(d, dict):
            if 'scalar' in d and 'minMaxState' in d: expected['curves'].add(freeze(d))
            if 'maxGradient' in d and 'minMaxState' in d: expected['gradients'].add(freeze(d))
            for v in d.values(): walk(v)
        elif isinstance(d, list):
            for v in d: walk(v)
    for r in pack['records'].values():
        if r['type'] == 'ParticleSystem': walk(r['data'])
    count = 0
    for category, sample in [('curves', scalar), ('gradients', gradient)]:
        actual = set()
        for row in report[category]:
            record = pack['records'][row['record']]
            assert record['type'] == 'ParticleSystem'
            d = record['data']
            for key in row['field']: d = d[int(key)] if isinstance(d, list) else d[key]
            actual.add(freeze(d))
            times = {-1, 0, .125, .25, .5, .75, 1, 2}
            if category == 'curves':
                for slot in ['minCurve', 'maxCurve']: times.update(k['time'] for k in d[slot]['m_Curve'])
            else:
                for slot in ['minGradient', 'maxGradient']:
                    for prefix, n in [('a', d[slot]['m_NumAlphaKeys']), ('c', d[slot]['m_NumColorKeys'])]:
                        times.update(d[slot][prefix+'time'+str(i)]/65535 for i in range(n))
            assert [(s['time'], s['factor']) for s in row['samples']] == [(t, f) for t in sorted(times) for f in [0, .25, .5, 1]]
            for s in row['samples']:
                value = sample(d, s['time'], s['factor'])
                a, b = (s['value'], value) if isinstance(value, list) else ([s['value']], [value])
                assert len(a) == len(b)
                for x, y in zip(a, b):
                    assert math.isfinite(x) and math.isclose(x, y, rel_tol=1e-10, abs_tol=1e-8), (category, row['record'], row['field'], s)
                    count += 1
        assert len(actual) == len(report[category]) and actual == expected[category]
    return count


def main():
    raw = (DIRECTORY / 'native-effects.bin').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == json.loads((ROOT / 'data/arkpedia-lappland-effects.json').read_text())['pack']['sha256']
    pack = json.loads(gzip.decompress(raw))
    cmd = ['node', 'tools/arkpedia/review-lappland-particle-curves.mjs']
    subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True)
    report = json.loads(OUT.read_text())
    count = verify(report, pack, digest)
    before = OUT.read_bytes()
    subprocess.run(cmd, cwd=ROOT, check=True, capture_output=True)
    assert OUT.read_bytes() == before
    for alteration in ['missing-definition', 'changed-sample', 'omitted-probe', 'false-parity']:
        changed = copy.deepcopy(report)
        if alteration == 'missing-definition': changed['curves'].pop()
        elif alteration == 'changed-sample': changed['gradients'][0]['samples'][0]['value'][3] += .1
        elif alteration == 'omitted-probe': changed['curves'][0]['samples'].pop()
        else: changed['scope']['compiledFrameParity'] = True
        try: verify(changed, pack, digest)
        except AssertionError: continue
        raise AssertionError('Accepted altered particle sampling: ' + alteration)
    print(json.dumps({'curves': len(report['curves']), 'gradients': len(report['gradients']),
                      'scalarValues': count, 'reproducedFiles': 1, 'rejectedFixtures': 4}))


if __name__ == '__main__':
    main()
