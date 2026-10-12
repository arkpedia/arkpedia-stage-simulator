#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Sankta Miksaparato evidence and reject incomplete/altered receipts.
Run with .cache/map-env/bin/python tools/arkpedia/audit-rmixer.py.
Native source verification is not public combat or Unity frame parity approval.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/rmixer-source'
SOURCE = ROOT / 'data/arkpedia-rmixer-prefabs.json'
ID = 'char_4194_rmixer'

def checked(args):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()

def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [SOURCE, OUT / 'models.json']}

def set_field(path, value):
    def mutate(e):
        v = e
        for k in path[:-1]: v = v[k]
        v[path[-1]] = value
    return mutate

def delete(path):
    def mutate(e):
        v = e
        for k in path[:-1]: v = v[k]
        del v[path[-1]]
    return mutate

def component(e, path_id):
    return next(c['data'] for r in e['characters'][ID] for c in r['components'] if c['pathId'] == path_id)

print(checked([sys.executable, 'tools/arkpedia/verify-rmixer.py']), flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-rmixer.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-rmixer.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
print(checked([sys.executable, 'tools/arkpedia/verify-rmixer.py']), flush=True)
original = json.loads(SOURCE.read_text())
cases = [
    ('wrong table repository', set_field(['source', 'repository'], 'unreviewed')),
    ('wrong table pin', set_field(['source', 'commit'], 'unreviewed')),
    ('wrong model pin', set_field(['source', 'modelCommit'], 'unreviewed')),
    ('wrong native client', set_field(['source', 'nativeClient'], 'unreviewed')),
    ('missing bundle', delete(['source', 'bundles', 0])),
    ('wrong buff Git identity', set_field(['source', 'buffDatabase', 'gitBlob', 'sha'], '0' * 40)),
    ('missing S2 rank', delete(['tables', 'skills', 'skchr_rmixer_2', 'levels', 4])),
    ('missing S3 skill', delete(['skills', 'skchr_rmixer_3'])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['characters'][ID].append(copy.deepcopy(e['characters'][ID][0]))),
    ('changed counterattack wait', lambda e: component(e, '-8831280125258731560').update(_waitForAttackEvent=1)),
    ('changed counterattack mode', lambda e: component(e, '7220685850704113624').update(_timeMode=0)),
    ('missing native template', delete(['originalTemplates', 'rmixer_sk2'])),
    ('missing dependency template', delete(['templates', 'rmixer_t2[shield]'])),
    ('fatal guard loses insufficient-ammo branch', delete(['templates', 'rmixer_sk2', 'eventToActions', 'ON_BEFORE_TRY_SET_HP_ZERO', 1, '_failNodes'])),
    ('fatal guard blocks only enough-ammo branch', set_field(['templates', 'rmixer_sk2', 'eventToActions', 'ON_BEFORE_TRY_SET_HP_ZERO', 1, '_failNodes', 0, '_blockThisHpSet'], False)),
    ('barrier incorrectly resets on counterattack', set_field(['templates', 'rmixer_t2', 'eventToActions', 'ON_AFTER_ATTACK', 0, '_abilityName'], 'Attack')),
    ('missing projectile', delete(['projectiles', 'projectile_chr_rmixer_sk1'])),
    ('missing range', delete(['tables', 'ranges', 'x-4'])),
    ('missing back art binding', delete(['officialSkeletonBindings', ID, 'Back'])),
    ('changed burst event', set_field(['models', ID, 'Front', 'eventPayloads', 'Skill_Loop', 1, 'time'], .1)),
    ('missing parsed back model', delete(['models', ID, 'Back'])),
    ('premature enablement', set_field(['enabledOperators'], [ID])),
    ('unsupported frame parity', set_field(['frameParity'], True)),
]
path = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        value = copy.deepcopy(original); mutate(value)
        assert value != original, 'Fixture did not change evidence: ' + name
        path.write_text(json.dumps(value))
        result = subprocess.run([sys.executable, 'tools/arkpedia/verify-rmixer.py', str(path)], cwd=ROOT, text=True, capture_output=True)
        assert result.returncode != 0, 'Verifier accepted ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
    checked([sys.executable, 'tools/arkpedia/verify-rmixer.py'])
assert hashes() == before, 'Audit changed durable source outputs'
print(f'Reproducible Sankta Miksaparato receipt; {len(cases)} negative fixtures rejected', flush=True)
