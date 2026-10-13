#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Source-verified child emission windows, merged capacity and lifetimes."""
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / '.cache/arkpedia/tragodia-source'
MANIFEST = ROOT / 'data/arkpedia-child-emission.json'
SAMPLES = DIRECTORY / 'child-emission-samples.json'
# This independent source verifier reads every original parent/child Unity
# object and provides the already-audited Python parent clock/hash contract.
spec = importlib.util.spec_from_file_location('birth_audit', ROOT/'tools/arkpedia/audit-particle-birth-links.py')
parent_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parent_audit)
rows, sources = parent_audit.expected, parent_audit.sources


def sha(raw): return hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run(['node', 'tools/arkpedia/export-child-emission.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes(): return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [MANIFEST, SAMPLES]}


def emission_events(s, time):
    delay, speed, length = s['startDelay']['scalar'], s['simulationSpeed'], s['lengthInSec']
    elapsed = time*speed-delay
    emission = s['EmissionModule']
    assert not s['looping'] and not s['prewarm'] and s['ringBufferMode'] == 0
    assert emission['rateOverDistance']['scalar'] == 0
    if elapsed < 0 or not emission['enabled']: return []
    rate = emission['rateOverTime']['scalar']
    end = min(elapsed, length)
    events = [(i/rate, 1, i-1) for i in range(1, math.floor(end*rate+1e-10)+1) if i/rate < length] if rate else []
    # Native children all use one constant burst at zero. Retain zero counts;
    # never turn continuous children into an invented birth burst.
    for burst in emission['m_Bursts']:
        assert burst['cycleCount'] == 1 and burst['probability'] == 1
        assert burst['countCurve']['minMaxState'] == 0
        at = burst['time']
        if at < length and at <= elapsed: events.append((at, math.floor(burst['countCurve']['scalar']), len(events)))
    events.sort(key=lambda row: row[0])
    return events


def replay(child, time):
    s = rows['children'][child]['clock']
    speed, delay = s['simulationSpeed'], s['startDelay']['scalar']
    candidates = []
    for parent_id, parent in rows['parents'].items():
        for slot, ref in enumerate(parent['references']):
            if ref['target'] != child: continue
            for p in parent_audit.births(parent['clock'], time):
                start = p['birthTime']
                death = start+p['lifetime']/parent['clock']['simulationSpeed']
                stop = min(time, death)
                for event_index, (born, count, unused) in enumerate(emission_events(s, stop-start)):
                    real_birth = start+(born+delay)/speed
                    if real_birth >= death-1e-10 or real_birth > time+1e-10: continue
                    candidates.append((real_birth, parent_id, p['id'], slot, event_index, born, count, start, death))
    candidates.sort(key=lambda row: row[:5])
    accepted, live, identity = [], [], 0
    for real_birth, parent_id, parent_particle, slot, event_index, born, count, start, death in candidates:
        live = [p for p in live if (real_birth-p['birthTime'])*speed < p['lifetime']-1e-10]
        for unused in range(count):
            if len(live) < s['InitialModule']['maxNumParticles']:
                life = parent_audit.scalar(s['InitialModule']['startLifetime'], parent_audit.random_factor(identity))
                p = {'id': identity, 'born': born, 'lifetime': life, 'birthTime': real_birth, 'parent': parent_id,
                     'parentParticle': parent_particle, 'slot': slot, 'parentBirthTime': start, 'parentDeathTime': death}
                live.append(p);accepted.append(p)
            identity += 1
    alive = [dict(p, age=max(0, (time-p['birthTime'])*speed)) for p in live if (time-p['birthTime'])*speed < p['lifetime']-1e-10]
    return [dict(p, age=0) for p in accepted], alive


def verify(samples, meta, raw):
    assert json.loads(raw) == samples
    assert meta['schemaVersion'] == 1 and meta['sources'] == sources
    assert meta['fixture'] == parent_audit.meta['fixture']
    assert meta['scope'] == {'sourceMapping': True, 'childEmissionScheduling': True, 'parentLifetimeWindows': True,
                             'sharedChildCapacity': True, 'childEmissionPlaying': False, 'childMotionPlaying': False,
                             'compiledFrameParity': False, 'enabledOperators': []}
    assert meta['samples'] == {'path': str(SAMPLES.relative_to(ROOT)), 'bytes': len(raw), 'sha256': sha(raw)}
    assert meta['children'] == {k: {f: r[f] for f in ['source', 'particleSha256']} for k, r in rows['children'].items()}
    assert set(samples) == set(rows['children'])
    counts = {'children': len(samples), 'births': 0, 'alive': 0}
    values = 0
    for child, data in samples.items():
        assert [s['time'] for s in data] == [0, .03, .1, .5, 1, 2, 4]
        for sample in data:
            births, alive = replay(child, sample['time'])
            for field, desired in [('births', births), ('alive', alive)]:
                assert len(sample[field]) == len(desired)
                for a, b in zip(sample[field], desired):
                    assert set(a) == set(b)
                    for name, value in b.items():
                        if isinstance(value, str): assert a[name] == value
                        else: assert math.isfinite(a[name]) and math.isclose(a[name], value, abs_tol=1e-11)
                        values += 1
                counts[field] += len(desired)
    assert meta['counts'] == counts
    return counts, values


build()
samples, meta = [json.loads(p.read_text()) for p in [SAMPLES, MANIFEST]]
counts, values = verify(samples, meta, SAMPLES.read_bytes())
before = hashes();build();assert hashes() == before, 'Child emission outputs are not reproducible'
mutations = ['missing-child', 'missing-birth', 'birth-time', 'parent-lineage', 'parent-death', 'particle-id', 'lifetime',
             'alive-age', 'missing-alive', 'source-pack', 'source-fixture', 'premature-playing', 'premature-motion', 'false-frame-parity']
key = next(k for k, data in samples.items() if data[-1]['births'] and data[-1]['alive'])
for mutation in mutations:
    s, m = copy.deepcopy(samples), copy.deepcopy(meta)
    if mutation == 'missing-child': del s[key]
    elif mutation == 'missing-birth': s[key][-1]['births'].pop()
    elif mutation == 'birth-time': s[key][-1]['births'][0]['birthTime'] += .1
    elif mutation == 'parent-lineage': s[key][-1]['births'][0]['parentParticle'] += 1
    elif mutation == 'parent-death': s[key][-1]['births'][0]['parentDeathTime'] += .1
    elif mutation == 'particle-id': s[key][-1]['births'][0]['id'] += 1
    elif mutation == 'lifetime': s[key][-1]['births'][0]['lifetime'] += .1
    elif mutation == 'alive-age': s[key][-1]['alive'][0]['age'] += .1
    elif mutation == 'missing-alive': s[key][-1]['alive'].pop()
    elif mutation == 'source-pack': m['sources']['tragodia']['sourcePackSha256'] = '0'*64
    elif mutation == 'source-fixture': m['fixture']['sha256'] = '0'*64
    elif mutation == 'premature-playing': m['scope']['childEmissionPlaying'] = True
    elif mutation == 'premature-motion': m['scope']['childMotionPlaying'] = True
    elif mutation == 'false-frame-parity': m['scope']['compiledFrameParity'] = True
    raw = (json.dumps(s, separators=(',', ':'))+'\n').encode();m['samples'].update(bytes=len(raw), sha256=sha(raw))
    try: verify(s, m, raw)
    except AssertionError: continue
    raise AssertionError('Accepted altered child emission: '+mutation)
report = {**counts, 'values': values, 'reproducedFiles': 2, 'rejectedFixtures': len(mutations), 'files': before,
          'childEmissionPlaying': False, 'childMotionPlaying': False, 'compiledFrameParity': False}
(DIRECTORY/'child-emission-audit.json').write_text(json.dumps(report, indent=2)+'\n');print(json.dumps(report))
