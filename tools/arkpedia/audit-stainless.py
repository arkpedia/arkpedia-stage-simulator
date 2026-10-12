#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Stainless's receipt and reject omitted or modified native evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-stainless.py.
This verifies source membership and bytes, not playable or Unity frame parity.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/stainless-source'
SOURCE = ROOT / 'data/arkpedia-stainless-prefabs.json'
ID = 'char_4072_ironmn'
TOKENS = ['token_10027_ironmn_pile' + str(n) for n in range(1, 4)]


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


print(checked([sys.executable, 'tools/arkpedia/verify-stainless.py']), flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-stainless.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-stainless.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
original = json.loads(SOURCE.read_text())
cases = [
    ('wrong source channel', set_field(['source', 'commit'], 'unreviewed')),
    ('wrong buff Git identity', set_field(['source', 'buffDatabase', 'gitBlob', 'sha'], '0' * 40)),
    ('missing source bundle', delete(['source', 'bundles', 0])),
    ('missing device', delete(['tokens', TOKENS[1]])),
    ('missing owner rank', delete(['tables', 'skills', 'skchr_ironmn_2', 'levels', 4])),
    ('missing device rank', delete(['tables', 'tokenSkills', 'sktok_ironmn_pile3', 'levels', 8])),
    ('missing owner skill', delete(['skills', 'skchr_ironmn_3'])),
    ('missing dependency template', delete(['templates', 'ironmn_pile3_trait'])),
    ('missing original template', delete(['originalTemplates', 'ironmn_pile_bleed'])),
    ('missing range', delete(['tables', 'ranges', '3-13'])),
    ('missing projectile', delete(['projectiles', 'projectile_chr_ironmn_pile3'])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['tokens'][TOKENS[0]].append(copy.deepcopy(e['tokens'][TOKENS[0]][0]))),
    ('device consumes deployment slot', lambda e: component(e, '4722706509366982244', 'tokens', TOKENS[2]).update(_occupiedRemainingCharacterCnt=1)),
    ('turret changed to ally side', lambda e: component(e, '4722706509366982244', 'tokens', TOKENS[2]).update(_sideType=1)),
    ('S1 leaves devices alive', delete(['templates', 'ironmn_s_1', 'eventToActions', 'ON_BUFF_FINISH', 2])),
    ('S2 recharges early', lambda e: e['templates']['ironmn_s_2']['eventToActions']['ON_BUFF_START'].append(
        copy.deepcopy(e['templates']['ironmn_s_1']['eventToActions']['ON_BUFF_START'][-1]))),
    ('turret allows damage', set_field(['templates', 'ironmn_pile3_trait', 'eventToActions', 'ON_TAKE_DAMAGE', 0, '_reason'], 'NONE')),
    ('turret repairs from every profession', set_field(['templates', 'ironmn_pile3_trait', 'eventToActions', 'ON_TAKE_DAMAGE', 2, '_checkSubProfession'], False)),
    ('turret splash uses wrong scale', set_field(['templates', 'ironmn_pile3_s[splash]', 'eventToActions', 'ON_BUFF_START', 0, '_atkScaleVar'], 'atk_scale')),
    ('recycling omits probability', delete(['templates', 'ironmn_t_2', 'eventToActions', 'ON_OWNER_FINISH', 0])),
    ('missing turret Down chain', delete(['officialTokenSkeletonBindings', TOKENS[2], 'facings', 'Down'])),
    ('missing turret Back parsed model', delete(['tokenModels', TOKENS[2], 'Back'])),
    ('altered device alias', set_field(['officialTokenSkeletonBindings', TOKENS[0], 'animationAliases', 1, 'animName'], 'Idle')),
    ('altered turret hit event', set_field(['tokenModels', TOKENS[2], 'Down', 'eventPayloads', 'Attack', 0, 'time'], .1)),
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
        result = subprocess.run([sys.executable, 'tools/arkpedia/verify-stainless.py', str(path)],
                                cwd=ROOT, text=True, capture_output=True)
        assert result.returncode != 0, 'Verifier accepted ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
    checked([sys.executable, 'tools/arkpedia/verify-stainless.py'])
assert hashes() == before, 'Audit changed durable source outputs'
print(f'Reproducible Stainless receipt; {len(cases)} negative fixtures rejected', flush=True)
