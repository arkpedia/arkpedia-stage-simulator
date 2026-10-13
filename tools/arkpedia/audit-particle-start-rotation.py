#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check start angles against original objects and an independent axis product."""
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
MANIFEST = ROOT / 'data/arkpedia-particle-start-rotation.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-particle-start-rotation.json'
SAMPLES = DIRECTORY / 'start-rotation-samples.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-particle-start-rotation.mjs'], cwd=ROOT,
                   check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


build()
expected, sources = {}, {}
for name, bundle, count in [('tragodia', 'phatm2', 4), ('lappland-alter', 'whitw2', 7)]:
    subprocess.run([sys.executable, 'tools/arkpedia/verify-' + ('lappland' if name == 'lappland-alter' else name) + '-effects.py'],
                   cwd=ROOT, check=True)
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
        native = json.loads(json.dumps(obj.read_typetree()))
        if not native['InitialModule']['rotation3D']:
            continue
        go = next(r['target'] for r in record['references'] if r['field'] == 'm_GameObject')
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'],
                         'particleSha256': sha(obj.get_raw_data()), 'initial': native['InitialModule']}
        found += 1
    assert found == count


def curve(c, factor):
    if c['minMaxState'] == 0:
        return c['scalar']
    assert c['minMaxState'] == 3
    return c['minScalar'] + (c['scalar'] - c['minScalar']) * factor


def rotate(point, axes):
    x, y, z = point
    a, b, c = axes
    # Independent successive fixed-axis rotations, without Three or quaternions.
    x, y = x*math.cos(c)-y*math.sin(c), x*math.sin(c)+y*math.cos(c)
    y, z = y*math.cos(a)-z*math.sin(a), y*math.sin(a)+z*math.cos(a)
    x, z = x*math.cos(b)+z*math.sin(b), -x*math.sin(b)+z*math.cos(b)
    return [x, y, z]


def verify(rows, samples, meta):
    raw = (json.dumps(rows, separators=(',', ':')) + '\n').encode()
    assert rows == expected
    assert meta['schemaVersion'] == 1 and meta['sources'] == sources
    assert meta['scope'] == {'sourceMapping': True, 'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['particles'] == {k: {f: r[f] for f in ['source', 'name', 'particleSha256']} for k, r in rows.items()}
    assert set(samples) == set(rows)
    controls = [(p, f) for p in [0, .25, 1] for f in [[0, 0, 0], [.25, .75, .5], [1, 1, 1]]]
    values = 0
    for key, row in rows.items():
        assert [(s['phase'], s['factors']) for s in samples[key]] == controls
        init = row['initial']
        assert init['rotation3D'] and init['randomizeRotationDirection'] == 0
        for s in samples[key]:
            angles = [curve(init[f], factor) for f, factor in zip(['startRotationX', 'startRotationY', 'startRotation'], s['factors'])]
            wanted = [angles, [angles[2]], *[rotate(v, angles) for v in [[1, 0, 0], [0, 1, 0], [0, 0, 1]]]]
            actual = [s['rotation3D'], [s['rotation']], *s['basis']]
            assert len(actual) == len(wanted)
            for a, b in zip(actual, wanted):
                assert len(a) == len(b) and all(math.isfinite(v) and math.isclose(v, w, abs_tol=1e-12) for v, w in zip(a, b))
                values += len(a)
    return values


rows, samples, meta = [json.loads(p.read_text()) for p in [FIXTURE, SAMPLES, MANIFEST]]
values = verify(rows, samples, meta)
before = hashes()
build()
assert hashes() == before, 'Start rotation outputs are not reproducible'
mutations = ['axis', 'range', 'identity', 'missing-particle', 'false-3d', 'flip', 'sample',
             'wrong-order', 'missing-sample', 'degrees', 'source-pack', 'premature-enable']
for mutation in mutations:
    r, s, m = copy.deepcopy(rows), copy.deepcopy(samples), copy.deepcopy(meta)
    key = next(iter(r))
    if mutation == 'axis': r[key]['initial']['startRotationX']['scalar'] += .5
    elif mutation == 'range': r[key]['initial']['startRotation']['minMaxState'] = 3
    elif mutation == 'identity': r[key]['particleSha256'] = '0' * 64
    elif mutation == 'missing-particle': del r[key]
    elif mutation == 'false-3d': r[key]['initial']['rotation3D'] = False
    elif mutation == 'flip': r[key]['initial']['randomizeRotationDirection'] = .5
    elif mutation == 'sample': s[key][0]['rotation3D'][0] += .1
    elif mutation == 'wrong-order':
        k = next(k for k, row in r.items() if row['source'] == 'lappland-alter')
        s[k][1]['basis'][0] = [1, 0, 0]
    elif mutation == 'missing-sample': s[key].pop()
    elif mutation == 'degrees': s[key][0]['rotation3D'][0] *= 180 / math.pi
    elif mutation == 'source-pack': m['sources']['tragodia']['sourcePackSha256'] = '0' * 64
    elif mutation == 'premature-enable': m['scope']['enabledOperators'] = ['char_1042_phatm2']
    raw = (json.dumps(r, separators=(',', ':')) + '\n').encode()
    m['fixture'].update(bytes=len(raw), sha256=sha(raw))
    try:
        verify(r, s, m)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed start rotation: ' + mutation)
report = {'particles': len(rows), 'sampleValues': values, 'reproducedFiles': 3,
          'rejectedFixtures': len(mutations), 'files': before, 'compiledFrameParity': False}
(DIRECTORY / 'start-rotation-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
