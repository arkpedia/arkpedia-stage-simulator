#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Marcille evidence and reject incomplete/altered receipts.
Run with .cache/map-env/bin/python tools/arkpedia/audit-marcil.py.
Native source verification is not public combat or Unity frame parity approval.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/marcil-source'
SOURCE = ROOT / 'data/arkpedia-marcil-prefabs.json'
ID = 'char_4141_marcil'

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

print(checked([sys.executable, 'tools/arkpedia/verify-marcil.py']), flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-marcil.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-marcil.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
print(checked([sys.executable, 'tools/arkpedia/verify-marcil.py']), flush=True)
original = json.loads(SOURCE.read_text())
cases = [
    ('wrong table repository', set_field(['source', 'repository'], 'unreviewed')),
    ('wrong table pin', set_field(['source', 'commit'], 'unreviewed')),
    ('wrong model pin', set_field(['source', 'modelCommit'], 'unreviewed')),
    ('wrong native client', set_field(['source', 'nativeClient'], 'unreviewed')),
    ('missing bundle', delete(['source', 'bundles', 0])),
    ('wrong buff Git identity', set_field(['source', 'buffDatabase', 'gitBlob', 'sha'], '0' * 40)),
    ('missing S2 rank', delete(['tables', 'skills', 'skchr_marcil_2', 'levels', 4])),
    ('missing S3 skill', delete(['skills', 'skchr_marcil_3'])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['characters'][ID].append(copy.deepcopy(e['characters'][ID][0]))),
    ('changed dummy mana recovery period', lambda e: component(e, '5732173963253464043').update(_period=2)),
    ('changed mana preprocessor cap source', lambda e: component(e, '3608541555110853611')['_config'][1].update(_sourceKey='mana_init')),
    ('missing native template', delete(['originalTemplates', 'marcil_t'])),
    ('missing dependency template', delete(['templates', 'marcil_in_chant'])),
    ('mana lost on normal retreat', set_field(['templates', 'marcil_t', 'eventToActions', 'ON_OWNER_FINISH', 0, '_succeedNodes', 0, '_blackboardKey'], 'wrong')),
    ('dead extended chant retains mana', set_field(['templates', 'marcil_3_extra_chant', 'eventToActions', 'ON_BUFF_FINISH', 2, '_defaultValue'], 0)),
    ('missing projectile', delete(['projectiles', 'projectile_chr_marcil_s3_mark'])),
    ('missing range', delete(['tables', 'ranges', 'x-4'])),
    ('missing back art binding', delete(['officialSkeletonBindings', ID, 'Back'])),
    ('changed S3 original attack event', set_field(['models', ID, 'Front', 'eventPayloads', 'Skill_3_Attack', 0, 'time'], .1)),
    ('missing parsed back model', delete(['models', ID, 'Back'])),
    ('unreviewed recovered claim', set_field(['recoveredFacts', 0], 'Unreviewed claim')),
    ('premature enablement', set_field(['enabledOperators'], [ID])),
    ('unsupported frame parity', set_field(['frameParity'], True)),
]
path = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        value = copy.deepcopy(original); mutate(value)
        assert value != original, 'Fixture did not change evidence: ' + name
        path.write_text(json.dumps(value))
        result = subprocess.run([sys.executable, 'tools/arkpedia/verify-marcil.py', str(path)], cwd=ROOT, text=True, capture_output=True)
        assert result.returncode != 0, 'Verifier accepted ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
    checked([sys.executable, 'tools/arkpedia/verify-marcil.py'])
assert hashes() == before, 'Audit changed durable source outputs'
print(f'Reproducible Marcille receipt; {len(cases)} negative fixtures rejected', flush=True)
