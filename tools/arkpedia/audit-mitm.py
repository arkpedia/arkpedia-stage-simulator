#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Mitm's receipt and reject omitted or modified native evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-mitm.py.
This verifies source membership and bytes, not playable or Unity frame parity.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/mitm-source'
SOURCE = ROOT / 'data/arkpedia-mitm-prefabs.json'
ID = 'char_4147_mitm'
TOKENS = ['token_10037_mitm_trshrb']


def checked(args):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [SOURCE, OUT / 'models.json', OUT / 'token-models.json']}


def component(e, path_id, group='characters', key=ID):
    return next(c['data'] for r in e[group][key] for c in r['components']
                if c['pathId'] == path_id)


def set_field(path, value):
    def mutate(e):
        v = e
        for key in path[:-1]:
            v = v[key]
        v[path[-1]] = value
    return mutate


def delete(path):
    def mutate(e):
        v = e
        for key in path[:-1]:
            v = v[key]
        del v[path[-1]]
    return mutate


print(checked([sys.executable, 'tools/arkpedia/verify-mitm.py']), flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-mitm.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-mitm.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
original = json.loads(SOURCE.read_text())
cases = [
    ('wrong source channel', set_field(['source', 'commit'], 'unreviewed')),
    ('wrong buff Git identity', set_field(['source', 'buffDatabase', 'gitBlob', 'sha'], '0' * 40)),
    ('missing source bundle', delete(['source', 'bundles', 0])),
    ('missing Cherry-3', delete(['tokens', TOKENS[0]])),
    ('missing owner rank', delete(['tables', 'skills', 'skchr_mitm_2', 'levels', 4])),
    ('missing token passive rank', delete(['tables', 'tokenSkills', 'sktok_mitm_trshrb_2', 'levels', 0])),
    ('missing owner skill', delete(['skills', 'skchr_mitm_2'])),
    ('missing dependency template', delete(['templates', 'trshrb_t_1[trash_born]'])),
    ('missing original template', delete(['originalTemplates', 'trshrb_t_1[reborn]'])),
    ('missing range', delete(['tables', 'ranges', 'x-5'])),
    ('missing projectile', delete(['projectiles', 'projectile_chr_mitm_s2'])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['tokens'][TOKENS[0]].append(copy.deepcopy(e['tokens'][TOKENS[0]][0]))),
    ('token consumes deployment slot', lambda e: component(e, '-3708278567375571001', 'tokens', TOKENS[0]).update(_occupiedRemainingCharacterCnt=1)),
    ('token loses host range restriction', lambda e: component(e, '-3708278567375571001', 'tokens', TOKENS[0])['_buildCondition'].update(limitByHostAttackRange=0)),
    ('wreckage changes to attacking mode', set_field(['templates', 'trshrb_t_1[trash_born]', 'eventToActions', 'ON_BUFF_START', 0, '_modeIndex'], 1)),
    ('wreckage spawn forcibly overlaps', lambda e: component(e, '-113505676959385657', 'tokens', TOKENS[0]).update(_forceSpawn=1)),
    ('S1 skips buggy mode check', delete(['templates', 'mitm_s_1', 'eventToActions', 'ON_BUFF_START', 0])),
    ('S1 damage hits flying enemies', set_field(['templates', 'mitm_s_1', 'eventToActions', 'ON_BUFF_START', 3, '_targetOptions', 'targetMotion'], 'ALL')),
    ('S2 loses self-destruct', delete(['templates', 'mitm_s_2[to_token]', 'eventToActions', 'ON_BUFF_FINISH', 4])),
    ('trait applies to every blocked enemy', set_field(['templates', 'mitm_tr_1', 'eventToActions', 'ON_CALCULATE_DAMAGE', 0, '_checkBlockedBySourceToken'], False)),
    ('missing token skeleton', delete(['officialTokenSkeletonBindings', TOKENS[0], 'facings', 'Single'])),
    ('missing token parsed model', delete(['tokenModels', TOKENS[0], 'Single'])),
    ('altered wreckage alias', set_field(['officialTokenSkeletonBindings', TOKENS[0], 'animationAliases', 9, 'animName'], 'Idle_1')),
    ('altered token hit event', set_field(['tokenModels', TOKENS[0], 'Single', 'eventPayloads', 'Attack', 0, 'time'], .1)),
    ('altered owner hit event', set_field(['models', ID, 'Front', 'eventPayloads', 'Attack', 0, 'time'], .4)),
    ('missing owner skeleton', delete(['officialSkeletonBindings', ID, 'Back'])),
    ('premature enablement', set_field(['enabledOperators'], [ID])),
    ('unsupported frame parity claim', set_field(['frameParity'], True)),
]
path = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        value = copy.deepcopy(original)
        mutate(value)
        path.write_text(json.dumps(value))
        result = subprocess.run([sys.executable, 'tools/arkpedia/verify-mitm.py', str(path)],
                                cwd=ROOT, text=True, capture_output=True)
        assert result.returncode != 0, 'Verifier accepted ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
    checked([sys.executable, 'tools/arkpedia/verify-mitm.py'])
assert hashes() == before, 'Audit changed durable source outputs'
print(f'Reproducible Mitm receipt; {len(cases)} negative fixtures rejected', flush=True)
