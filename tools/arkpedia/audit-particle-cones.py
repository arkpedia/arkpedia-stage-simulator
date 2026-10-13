#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check original cone settings and the explicit local geometric replay model."""
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
MANIFEST = ROOT / 'data/arkpedia-particle-cones.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-particle-cones.json'
SAMPLES = DIRECTORY / 'cone-samples.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-particle-cones.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


def pointer_ids(value, field=''):
    # Native 64-bit pointer IDs are decimal strings in the JS pack contract.
    if isinstance(value, dict):
        return {k: pointer_ids(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [pointer_ids(v, field) for v in value]
    if field == 'm_PathID':
        return str(value)
    return value


build()
expected, sources, held = {}, {}, {}
for name, bundle, count in [('tragodia', 'phatm2', 12), ('lappland-alter', 'whitw2', 47)]:
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
        native = json.loads(json.dumps(obj.read_typetree()))
        shape = pointer_ids(native['ShapeModule'])
        if not shape['enabled'] or shape['type'] != 4 or shape['angle'] == 0:
            continue
        go = next(r['target'] for r in record['references'] if r['field'] == 'm_GameObject')
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'],
                         'particleSha256': sha(obj.get_raw_data()), 'shape': shape}
        if shape['arc']['mode'] != 0 or shape['arc']['spread'] != 0:
            held[key] = 'Native cone angle/arc mode needs review'
        found += 1
    assert found == count
assert len(held) == 8


def replay(shape, radial, azimuth):
    radius = shape['radius']['value']
    inner = radius * (1 - shape['radiusThickness'])
    distance = math.sqrt(inner**2 + radial * (radius**2 - inner**2))
    phi = azimuth * 2 * math.pi
    x, y = distance * math.cos(phi), distance * math.sin(phi)
    origin = [x * shape['m_Scale']['x'], y * shape['m_Scale']['y'], 0]
    if shape['angle'] == 90:
        # Planar limit uses the sampled azimuth even at the singular disk center.
        direction = [math.cos(phi), math.sin(phi), 0]
    else:
        # Independent Cartesian ray from the cone's virtual apex.
        focal = radius / math.tan(math.radians(shape['angle']))
        length = math.sqrt(x*x + y*y + focal*focal)
        direction = [x/length, y/length, focal/length]
    return origin, direction


def verify(rows, samples, meta, raw):
    # JSON number spelling differs between Python and JS for very small native
    # radii. Verify the actual bytes and decoded source fields independently.
    assert json.loads(raw) == rows
    assert rows == expected
    assert meta['schemaVersion'] == 1 and meta['sources'] == sources and meta['held'] == held
    assert meta['scope'] == {'sourceMapping': True, 'shapeModel': 'geometricConeBase',
                             'nativeEmissionParity': False, 'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['particles'] == {k: {f: r[f] for f in ['source', 'name', 'particleSha256']} for k, r in rows.items()}
    assert set(samples) == set(rows) - set(held)
    controls = [(r, a) for r in [0, .25, 1] for a in [0, .25, .75, 1]]
    values = 0
    for key, data in samples.items():
        assert [(s['radial'], s['azimuth']) for s in data] == controls
        shape = rows[key]['shape']
        assert 0 < shape['angle'] <= 90 and shape['radius']['value'] > 0
        assert shape['arc']['value'] == 360 and shape['radius']['mode'] == shape['radius']['spread'] == 0
        assert not shape['alignToDirection'] and shape['randomDirectionAmount'] == shape['sphericalDirectionAmount'] == shape['randomPositionAmount'] == 0
        for s in data:
            origin, direction = replay(shape, s['radial'], s['azimuth'])
            for a, b in [(s['origin'], origin), (s['direction'], direction)]:
                assert len(a) == len(b) and all(math.isfinite(v) and math.isclose(v, w, abs_tol=1e-12) for v, w in zip(a, b))
                values += len(a)
            assert math.isclose(sum(v*v for v in s['direction']), 1, abs_tol=1e-12)
    return values


rows, samples, meta = [json.loads(p.read_text()) for p in [FIXTURE, SAMPLES, MANIFEST]]
values = verify(rows, samples, meta, FIXTURE.read_bytes())
before = hashes()
build()
assert hashes() == before, 'Cone outputs are not reproducible'
mutations = ['angle', 'radius', 'thickness', 'arc-mode', 'identity', 'missing-particle', 'missing-held',
             'flattened-direction', 'radius-sample', 'missing-sample', 'source-pack', 'false-native-parity', 'premature-enable']
for mutation in mutations:
    r, s, m = copy.deepcopy(rows), copy.deepcopy(samples), copy.deepcopy(meta)
    key = next(iter(s))
    if mutation == 'angle': r[key]['shape']['angle'] += .5
    elif mutation == 'radius': r[key]['shape']['radius']['value'] += .5
    elif mutation == 'thickness': r[key]['shape']['radiusThickness'] += .1
    elif mutation == 'arc-mode': r[key]['shape']['arc']['mode'] = 3
    elif mutation == 'identity': r[key]['particleSha256'] = '0' * 64
    elif mutation == 'missing-particle': del r[key]
    elif mutation == 'missing-held': del m['held'][next(iter(m['held']))]
    elif mutation == 'flattened-direction': s[key][-1]['direction'] = [0, 0, 1]
    elif mutation == 'radius-sample': s[key][-1]['origin'][0] += .1
    elif mutation == 'missing-sample': s[key].pop()
    elif mutation == 'source-pack': m['sources']['tragodia']['sourcePackSha256'] = '0' * 64
    elif mutation == 'false-native-parity': m['scope']['nativeEmissionParity'] = True
    elif mutation == 'premature-enable': m['scope']['enabledOperators'] = ['char_1042_phatm2']
    raw = (json.dumps(r, separators=(',', ':')) + '\n').encode()
    m['fixture'].update(bytes=len(raw), sha256=sha(raw))
    try:
        verify(r, s, m, raw)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed cone replay: ' + mutation)
report = {'particles': len(rows), 'sampled': len(samples), 'held': len(held), 'sampleValues': values,
          'reproducedFiles': 3, 'rejectedFixtures': len(mutations), 'files': before, 'nativeEmissionParity': False}
(DIRECTORY / 'cone-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
