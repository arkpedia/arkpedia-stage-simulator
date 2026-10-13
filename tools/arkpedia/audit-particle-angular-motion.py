#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Original RotationModule fields and independent cubic Simpson integrals."""
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
MANIFEST = ROOT / 'data/arkpedia-particle-angular-motion.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-particle-angular-motion.json'
SAMPLES = DIRECTORY / 'angular-motion-samples.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-particle-angular-motion.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


build()
expected, sources = {}, {}
for name, bundle, count in [('tragodia', 'phatm2', 15), ('lappland-alter', 'whitw2', 42)]:
    subprocess.run([sys.executable, 'tools/arkpedia/verify-' + ('lappland' if name == 'lappland-alter' else name) + '-effects.py'], cwd=ROOT, check=True)
    directory = ROOT / ('.cache/arkpedia/' + name + '-source')
    raw = (directory / 'effects/native-effects.bin').read_bytes()
    pack = json.loads(gzip.decompress(raw))
    env = UnityPy.load(str(directory / (bundle + '-effects.ab')))
    originals = {o.path_id: o for o in env.objects}
    sources[name] = {'operator': pack['operator'], 'version': pack['version'], 'sourcePackSha256': sha(raw)}
    found = 0
    for key, record in pack['records'].items():
        if record['type'] != 'ParticleSystem':
            continue
        obj = originals[int(key.rsplit(':', 1)[1])]
        module = obj.read_typetree()['RotationModule']
        if not module['enabled']:
            continue
        go = next(r['target'] for r in record['references'] if r['field'] == 'm_GameObject')
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'],
                         'particleSha256': sha(obj.get_raw_data()), 'module': module}
        found += 1
    assert found == count


def integral_keys(curve, stop):
    keys = curve['m_Curve']
    assert keys and curve['m_PreInfinity'] == curve['m_PostInfinity'] == 2
    assert all(k['weightedMode'] == 0 for k in keys)
    bounds = sorted(set([0, stop] + [k['time'] for k in keys if 0 < k['time'] < stop]))

    def value(t):
        if t <= keys[0]['time']:
            return keys[0]['value']
        if t >= keys[-1]['time']:
            return keys[-1]['value']
        for a, b in zip(keys, keys[1:]):
            if a['time'] <= t <= b['time']:
                h = b['time'] - a['time']
                u = (t-a['time'])/h
                return ((2*u**3 - 3*u*u + 1)*a['value'] + (u**3 - 2*u*u + u)*h*a['outSlope']
                        + (-2*u**3 + 3*u*u)*b['value'] + (u**3 - u*u)*h*b['inSlope'])
        raise AssertionError('Missing source angular segment')

    # Simpson's rule is exact for each unweighted cubic segment. It avoids
    # copying the runtime's antiderivative coefficients or numerical timestep.
    return sum((b-a)/6*(value(a) + 4*value((a+b)/2) + value(b)) for a, b in zip(bounds, bounds[1:]))


def integral(curve, stop, factor):
    mode = curve['minMaxState']
    if mode == 0:
        return curve['scalar'] * stop
    if mode == 3:
        return (curve['minScalar'] + factor*(curve['scalar']-curve['minScalar']))*stop
    maximum = integral_keys(curve['maxCurve'], stop)
    if mode == 1:
        return curve['scalar'] * maximum
    assert mode == 2
    minimum = integral_keys(curve['minCurve'], stop)
    return curve['scalar'] * (minimum + factor*(maximum-minimum))


def verify(rows, samples, meta, raw):
    assert json.loads(raw) == rows and rows == expected
    assert meta['schemaVersion'] == 1 and meta['sources'] == sources
    assert meta['scope'] == {'sourceMapping': True, 'localReplay': True, 'units': 'radiansPerSimulatedSecond',
                             'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['particles'] == {k: {f: r[f] for f in ['source', 'name', 'particleSha256']} for k, r in rows.items()}
    assert set(samples) == set(rows)
    controls = [(life, phase, factor) for life in [1, 2] for phase in [0, .125, .5, 1] for factor in [0, .25, 1]]
    values = 0
    for key, data in samples.items():
        assert [(s['lifetime'], s['phase'], s['factor']) for s in data] == controls
        module = rows[key]['module']
        assert module['separateAxes'] is False
        for s in data:
            assert 'rotation3D' not in s
            wanted = s['lifetime'] * integral(module['curve'], s['phase'], s['factor'])
            assert math.isfinite(s['rotation']) and math.isclose(s['rotation'], wanted, abs_tol=1e-12)
            values += 1
    return values


rows, samples, meta = [json.loads(p.read_text()) for p in [FIXTURE, SAMPLES, MANIFEST]]
values = verify(rows, samples, meta, FIXTURE.read_bytes())
before = hashes()
build()
assert hashes() == before, 'Angular-motion outputs are not reproducible'
mutations = ['scalar', 'tangent', 'units', 'axis-mode', 'identity', 'missing-particle', 'angle-not-integral',
             'missing-lifetime', 'factor', 'source-pack', 'false-frame-parity', 'premature-enable']
for mutation in mutations:
    r, s, m = copy.deepcopy(rows), copy.deepcopy(samples), copy.deepcopy(meta)
    key = next(iter(s))
    if mutation == 'scalar': r[key]['module']['curve']['scalar'] += 1
    elif mutation == 'tangent': r[key]['module']['curve']['maxCurve']['m_Curve'][0]['outSlope'] += 1
    elif mutation == 'units': s[key][-1]['rotation'] *= 180/math.pi
    elif mutation == 'axis-mode': r[key]['module']['separateAxes'] = True
    elif mutation == 'identity': r[key]['particleSha256'] = '0' * 64
    elif mutation == 'missing-particle': del r[key]
    elif mutation == 'angle-not-integral': s[key][-1]['rotation'] += .5
    elif mutation == 'missing-lifetime': s[key].pop()
    elif mutation == 'factor': s[key][-1]['factor'] = .5
    elif mutation == 'source-pack': m['sources']['tragodia']['sourcePackSha256'] = '0' * 64
    elif mutation == 'false-frame-parity': m['scope']['compiledFrameParity'] = True
    elif mutation == 'premature-enable': m['scope']['enabledOperators'] = ['char_1042_phatm2']
    raw = (json.dumps(r, separators=(',', ':')) + '\n').encode()
    m['fixture'].update(bytes=len(raw), sha256=sha(raw))
    try:
        verify(r, s, m, raw)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed angular replay: ' + mutation)
report = {'particles': len(rows), 'sampleValues': values, 'reproducedFiles': 3,
          'rejectedFixtures': len(mutations), 'files': before, 'compiledFrameParity': False}
(DIRECTORY / 'angular-motion-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
