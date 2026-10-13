#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent original-object and explicit-velocity inheritance audit."""
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
MANIFEST = ROOT / 'data/arkpedia-particle-inheritance.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-particle-inheritance.json'
SAMPLES = DIRECTORY / 'inheritance-samples.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-particle-inheritance.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


def pointer_ids(value, field=''):
    if isinstance(value, dict):
        return {k: pointer_ids(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [pointer_ids(v, field) for v in value]
    return str(value) if field == 'm_PathID' else value


build()
expected, sources = {}, {}
for name, bundle, count in [('tragodia', 'phatm2', 9), ('lappland-alter', 'whitw2', 0)]:
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
        native = pointer_ids(obj.read_typetree())
        if not native['InheritVelocityModule']['enabled']:
            continue
        go = next(r['target'] for r in record['references'] if r['field'] == 'm_GameObject')
        renderer = next(r['target'] for r in pack['records'][go]['references']
                        if pack['records'][r['target']]['type'] == 'ParticleSystemRenderer')
        renderer_obj = originals[int(renderer.rsplit(':', 1)[1])]
        expected[key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'],
                         'particleSha256': sha(obj.get_raw_data()), 'data': native,
                         'renderer': {'id': renderer, 'sha256': sha(renderer_obj.get_raw_data()),
                                      'data': pointer_ids(renderer_obj.read_typetree())}}
        found += 1
    assert found == count


def verify(rows, samples, meta, raw):
    assert json.loads(raw) == rows and rows == expected
    assert meta['schemaVersion'] == 1 and meta['sources'] == sources
    assert meta['scope'] == {'sourceMapping': True, 'localReplay': True, 'velocityAcquisition': 'explicitWorldVelocity',
                             'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['particles'] == {k: {'source': r['source'], 'name': r['name'], 'particleSha256': r['particleSha256'],
                                    'renderer': r['renderer']['id'], 'rendererSha256': r['renderer']['sha256']}
                                for k, r in rows.items()}
    assert set(samples) == set(rows)
    controls = [(birth, age) for birth in [0, .25, 1] for age in [0, .125, .5, 1]]
    values = 0
    for key, data in samples.items():
        assert [(s['birth'], s['age']) for s in data] == controls
        source = rows[key]['data']
        module = source['InheritVelocityModule']
        assert module['m_Mode'] == 0 and module['m_Curve']['minMaxState'] == 0
        assert source['moveWithTransform'] == 1 and source['emitterVelocityMode'] == 0
        assert not source['SubModule']['enabled']
        assert source['ShapeModule']['type'] == 0 and source['ShapeModule']['m_Mesh']['m_PathID'] != '0'
        for s in data:
            birth, age = s['birth'], s['age']
            assert math.isclose(s['time'], birth + age/source['simulationSpeed'], abs_tol=1e-12)
            velocity = [birth+1, 2*birth-1, 3-birth*birth]
            wanted = [v * module['m_Curve']['scalar'] for v in velocity]
            assert len(s['velocity']) == 3 and all(math.isfinite(v) and math.isclose(v, w, abs_tol=1e-12)
                                                 for v, w in zip(s['velocity'], wanted))
            values += 3
    return values


rows, samples, meta = [json.loads(p.read_text()) for p in [FIXTURE, SAMPLES, MANIFEST]]
values = verify(rows, samples, meta, FIXTURE.read_bytes())
before = hashes()
build()
assert hashes() == before, 'Inherited-velocity outputs are not reproducible'
mutations = ['mode', 'multiplier', 'velocity-source', 'simulation-speed', 'dormant-mesh', 'renderer', 'identity',
             'missing-particle', 'birth-clock', 'current-not-initial', 'missing-sample', 'source-pack', 'false-frame-parity', 'premature-enable']
for mutation in mutations:
    r, s, m = copy.deepcopy(rows), copy.deepcopy(samples), copy.deepcopy(meta)
    key = next(iter(s))
    if mutation == 'mode': r[key]['data']['InheritVelocityModule']['m_Mode'] = 1
    elif mutation == 'multiplier': r[key]['data']['InheritVelocityModule']['m_Curve']['scalar'] = 1
    elif mutation == 'velocity-source': r[key]['data']['emitterVelocityMode'] = 2
    elif mutation == 'simulation-speed': r[key]['data']['simulationSpeed'] = 1
    elif mutation == 'dormant-mesh': r[key]['data']['ShapeModule']['m_Mesh']['m_PathID'] = '0'
    elif mutation == 'renderer': r[key]['renderer']['data']['m_RenderMode'] = 4
    elif mutation == 'identity': r[key]['particleSha256'] = '0' * 64
    elif mutation == 'missing-particle': del r[key]
    elif mutation == 'birth-clock': s[key][-1]['time'] += .1
    elif mutation == 'current-not-initial': s[key][-1]['velocity'][0] += .2
    elif mutation == 'missing-sample': s[key].pop()
    elif mutation == 'source-pack': m['sources']['tragodia']['sourcePackSha256'] = '0' * 64
    elif mutation == 'false-frame-parity': m['scope']['compiledFrameParity'] = True
    elif mutation == 'premature-enable': m['scope']['enabledOperators'] = ['char_1042_phatm2']
    raw = (json.dumps(r, separators=(',', ':')) + '\n').encode()
    m['fixture'].update(bytes=len(raw), sha256=sha(raw))
    try:
        verify(r, s, m, raw)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed inheritance replay: ' + mutation)
report = {'particles': len(rows), 'renderers': len(rows), 'sampleValues': values,
          'reproducedFiles': 3, 'rejectedFixtures': len(mutations), 'files': before, 'compiledFrameParity': False}
(DIRECTORY / 'inheritance-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
