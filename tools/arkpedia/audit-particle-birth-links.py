#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify original birth links and independently replay accepted birth clocks."""
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
MANIFEST = ROOT / 'data/arkpedia-particle-birth-links.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-particle-birth-links.json'
SAMPLES = DIRECTORY / 'birth-link-samples.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-particle-birth-links.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, FIXTURE, SAMPLES]}


def pointers(v, field=''):
    if isinstance(v, dict): return {k: pointers(x, k) for k, x in v.items()}
    if isinstance(v, list): return [pointers(x, field) for x in v]
    return str(v) if field == 'm_PathID' else v


def clock_fields(s):
    return {'InitialModule': {k: s['InitialModule'][k] for k in ['enabled', 'maxNumParticles', 'startLifetime']},
            **{k: s[k] for k in ['EmissionModule', 'startDelay', 'lengthInSec', 'simulationSpeed', 'looping', 'prewarm', 'playOnAwake', 'moveWithTransform', 'ringBufferMode']}}


build()
expected, sources = {'parents': {}, 'children': {}}, {}
for name, bundle, count, links in [('tragodia', 'phatm2', 9, 9), ('lappland-alter', 'whitw2', 6, 60)]:
    subprocess.run([sys.executable, 'tools/arkpedia/verify-' + ('lappland' if name == 'lappland-alter' else name) + '-effects.py'], cwd=ROOT, check=True)
    directory = ROOT / ('.cache/arkpedia/' + name + '-source')
    raw = (directory / 'effects/native-effects.bin').read_bytes()
    pack = json.loads(gzip.decompress(raw))
    env = UnityPy.load(str(directory / (bundle + '-effects.ab')))
    originals = {o.path_id: o for o in env.objects}
    sources[name] = {'operator': pack['operator'], 'version': pack['version'], 'sourcePackSha256': sha(raw)}
    found, child_count = 0, 0
    for key, record in pack['records'].items():
        if record['type'] != 'ParticleSystem': continue
        obj = originals[int(key.rsplit(':', 1)[1])]
        s = pointers(obj.read_typetree())
        if not s['SubModule']['enabled']: continue
        go = next(ref['target'] for ref in record['references'] if ref['field'] == 'm_GameObject')
        refs = [ref for ref in record['references'] if ref['field'] == 'emitter']
        assert len(refs) == len(s['SubModule']['subEmitters'])
        for slot, ref in zip(s['SubModule']['subEmitters'], refs):
            assert slot['emitter'] == ref['pointer'] and slot['type'] == slot['properties'] == 0 and slot['emitProbability'] == 1
            child = originals[int(ref['target'].rsplit(':', 1)[1])]
            assert child.type.name == 'ParticleSystem'
            assert not child.read_typetree()['SubModule']['enabled']
            expected['children'][ref['target']] = {'source': name, 'particleSha256': sha(child.get_raw_data()), 'clock': clock_fields(pointers(child.read_typetree()))}
            child_count += 1
        expected['parents'][key] = {'source': name, 'name': pack['records'][go]['data']['m_Name'], 'particleSha256': sha(obj.get_raw_data()),
                                    'clock': clock_fields(s), 'module': s['SubModule'], 'references': refs}
        found += 1
    assert found == count and child_count == links


def random_factor(identity, salt=0):
    # Independent unsigned arithmetic for the explicitly local hash contract.
    mask = 2**32-1
    value = (((identity+1) ^ 1)*0x45d9f3b & mask) ^ ((salt+1)*0x27d4eb2d & mask)
    value = ((value ^ (value >> 16))*0x45d9f3b) & mask
    return (value ^ (value >> 16))/2**32


def scalar(curve, factor=1):
    if curve['minMaxState'] == 0: return curve['scalar']
    assert curve['minMaxState'] == 3
    return curve['minScalar']+(curve['scalar']-curve['minScalar'])*factor


def births(s, time):
    assert s['ringBufferMode'] == 0
    emission, initial = s['EmissionModule'], s['InitialModule']
    delay, speed, length = scalar(s['startDelay']), s['simulationSpeed'], s['lengthInSec']
    elapsed = time*speed-delay
    if elapsed < 0 or not emission['enabled'] or not s['playOnAwake']: return []
    prewarm = length if s['prewarm'] and s['looping'] else 0
    elapsed += prewarm
    end = elapsed if s['looping'] else min(elapsed, length)
    rate = scalar(emission['rateOverTime'])
    assert scalar(emission['rateOverDistance']) == 0
    events = [(i/rate, 1) for i in range(1, math.floor(end*rate+1e-10)+1) if s['looping'] or i/rate < length] if rate else []
    loops = math.floor(elapsed/length)+1 if s['looping'] else 1
    for cycle in range(loops):
        for burst in emission['m_Bursts']:
            assert burst['probability'] == 1
            for repeat in range(burst['cycleCount']):
                local = burst['time']+repeat*burst['repeatInterval']
                at = cycle*length+local
                if local < length and at <= elapsed:
                    events.append((at, math.floor(scalar(burst['countCurve'], random_factor(cycle, repeat)))))
    events.sort(key=lambda row: row[0])
    result, live, identity = [], [], 0
    for at, count in events:
        live = [p for p in live if p['born']+p['lifetime'] > at+1e-10]
        for unused in range(count):
            if len(live) < initial['maxNumParticles']:
                life = scalar(initial['startLifetime'], random_factor(identity))
                p = {'id': identity, 'born': at, 'lifetime': life, 'age': 0, 'birthTime': (at+delay-prewarm)/speed}
                live.append(p);result.append(p)
            identity += 1
    return result


def verify(rows, samples, meta, raw):
    assert json.loads(raw) == rows and rows == expected
    assert meta['schemaVersion'] == 1 and meta['sources'] == sources
    assert meta['scope'] == {'sourceMapping': True, 'birthScheduling': True, 'childEmissionPlaying': False, 'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['parents'] == {k: {'source': r['source'], 'name': r['name'], 'particleSha256': r['particleSha256'], 'children': [ref['target'] for ref in r['references']]} for k, r in rows['parents'].items()}
    assert meta['children'] == {k: {f: r[f] for f in ['source', 'particleSha256']} for k, r in rows['children'].items()}
    assert set(samples) == set(rows['parents'])
    counts = {'births': 0, 'triggers': 0, 'values': 0}
    for key, data in samples.items():
        assert [s['time'] for s in data] == [0, .03, .1, .5, 1, 2, 4]
        parent = rows['parents'][key]
        for sample in data:
            wanted = births(parent['clock'], sample['time'])
            assert len(sample['births']) == len(wanted)
            for actual, desired in zip(sample['births'], wanted):
                assert set(actual) == set(desired)
                for field, value in desired.items():
                    assert math.isclose(actual[field], value, abs_tol=1e-12);counts['values'] += 1
            triggers = [{'parent': key, 'particle': p['id'], 'slot': slot, 'child': ref['target'], 'type': 0, 'properties': 0,
                         'emitProbability': 1, 'time': p['birthTime'], 'parentDeathTime': p['birthTime']+p['lifetime']/parent['clock']['simulationSpeed']}
                        for p in wanted for slot, ref in enumerate(parent['references'])]
            assert len(sample['triggers']) == len(triggers)
            for actual, desired in zip(sample['triggers'], triggers):
                assert set(actual) == set(desired)
                for field, value in desired.items():
                    if isinstance(value, str): assert actual[field] == value
                    else: assert math.isclose(actual[field], value, abs_tol=1e-12)
                    counts['values'] += 1
            counts['births'] += len(wanted);counts['triggers'] += len(triggers)
    return counts


rows, samples, meta = [json.loads(p.read_text()) for p in [FIXTURE, SAMPLES, MANIFEST]]
counts = verify(rows, samples, meta, FIXTURE.read_bytes())
before = hashes();build();assert hashes() == before, 'Birth-link outputs are not reproducible'
mutations = ['link', 'pointer', 'trigger-kind', 'inherited-flags', 'parent-clock', 'child-clock', 'ring-mode', 'identity', 'missing-child',
             'expired-birth', 'event-time', 'missing-trigger', 'source-pack', 'premature-playing', 'false-frame-parity']
for mutation in mutations:
    r, s, m = copy.deepcopy(rows), copy.deepcopy(samples), copy.deepcopy(meta)
    key = next(iter(s));child = r['parents'][key]['references'][0]['target']
    if mutation == 'link': r['parents'][key]['references'][0]['target'] = next(k for k in r['children'] if k != child)
    elif mutation == 'pointer': r['parents'][key]['module']['subEmitters'][0]['emitter']['m_PathID'] = '0'
    elif mutation == 'trigger-kind': r['parents'][key]['module']['subEmitters'][0]['type'] = 2
    elif mutation == 'inherited-flags': r['parents'][key]['module']['subEmitters'][0]['properties'] = 1
    elif mutation == 'parent-clock': r['parents'][key]['clock']['simulationSpeed'] = 2
    elif mutation == 'child-clock': r['children'][child]['clock']['EmissionModule']['rateOverTime']['scalar'] += 1
    elif mutation == 'ring-mode': r['parents'][key]['clock']['ringBufferMode'] = 1
    elif mutation == 'identity': r['parents'][key]['particleSha256'] = '0'*64
    elif mutation == 'missing-child': del r['children'][child]
    elif mutation == 'expired-birth': s[key][-1]['births'] = []
    elif mutation == 'event-time': s[key][-1]['triggers'][0]['time'] += .1
    elif mutation == 'missing-trigger': s[key][-1]['triggers'].pop()
    elif mutation == 'source-pack': m['sources']['tragodia']['sourcePackSha256'] = '0'*64
    elif mutation == 'premature-playing': m['scope']['childEmissionPlaying'] = True
    elif mutation == 'false-frame-parity': m['scope']['compiledFrameParity'] = True
    raw = (json.dumps(r, separators=(',', ':'))+'\n').encode();m['fixture'].update(bytes=len(raw), sha256=sha(raw))
    try: verify(r, s, m, raw)
    except AssertionError: continue
    raise AssertionError('Accepted altered birth evidence: '+mutation)
report = {'parents': len(rows['parents']), 'children': len(rows['children']), **counts, 'reproducedFiles': 3,
          'rejectedFixtures': len(mutations), 'files': before, 'childEmissionPlaying': False, 'compiledFrameParity': False}
(DIRECTORY/'birth-link-audit.json').write_text(json.dumps(report, indent=2)+'\n');print(json.dumps(report))
