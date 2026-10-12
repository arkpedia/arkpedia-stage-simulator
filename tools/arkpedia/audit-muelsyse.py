#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Muelsyse's receipt and reject omitted or modified native evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-muelsyse.py.
This verifies source membership and bytes, not playable or Unity frame parity.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/muelsyse-source'
SOURCE = ROOT / 'data/arkpedia-muelsyse-prefabs.json'
ID = 'char_249_mlyss'
TOKENS = ['token_10030_mlyss_wtrman']


def checked(args):
    result = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [SOURCE, OUT / 'models.json', OUT / 'token-models.json', OUT / 'token-bindings.json', *sorted(OUT.glob('token_*.skel')), *sorted(OUT.glob('token_*.atlas'))]}


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


print(checked([sys.executable, 'tools/arkpedia/verify-muelsyse.py']), flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-muelsyse.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-muelsyse.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
print(checked([sys.executable, 'tools/arkpedia/verify-muelsyse.py']), flush=True)
original = json.loads(SOURCE.read_text())
cases = [
    ('wrong source repository', set_field(['source', 'repository'], 'unreviewed')),
    ('wrong model repository', set_field(['source', 'modelRepository'], 'unreviewed')),
    ('wrong source channel', set_field(['source', 'commit'], 'unreviewed')),
    ('wrong buff Git identity', set_field(['source', 'buffDatabase', 'gitBlob', 'sha'], '0' * 40)),
    ('missing source bundle', delete(['source', 'bundles', 0])),
    ('missing Flowing Shape', delete(['tokens', TOKENS[0]])),
    ('missing owner rank', delete(['tables', 'skills', 'skchr_mlyss_3', 'levels', 4])),
    ('missing token copy skill rank', delete(['tables', 'tokenSkills', 'sktok_mlyss_wtrman_3', 'levels', 0])),
    ('token copy skill incorrectly passive', set_field(['tables', 'tokenSkills', 'sktok_mlyss_wtrman_1', 'levels', 0, 'skillType'], 'PASSIVE')),
    ('missing owner skill', delete(['skills', 'skchr_mlyss_3'])),
    ('missing dependency template', delete(['templates', 'mlyss_wtrman_s_begin'])),
    ('missing original template', delete(['originalTemplates', 'mlyss_wtrman_t_1[reborn]'])),
    ('missing range', delete(['tables', 'ranges', 'x-4'])),
    ('missing projectile', delete(['projectiles', 'projectile_chr_mlyss_s3'])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['tokens'][TOKENS[0]].append(copy.deepcopy(e['tokens'][TOKENS[0]][0]))),
    ('token consumes deployment slot', lambda e: component(e, '-2203269439485355925', 'tokens', TOKENS[0]).update(_occupiedRemainingCharacterCnt=1)),
    ('token loses host range restriction', lambda e: component(e, '-2203269439485355925', 'tokens', TOKENS[0])['_buildCondition'].update(limitByHostAttackRange=0)),
    ('copy incorrectly uses live donor', set_field(['templates', 'mlyss_wtrman_s_begin', 'eventToActions', 'ON_ENTITY_WILL_OVERLAP', 0, '_useCardSnapshot'], False)),
    ('copy incorrectly scales block count', lambda e: e['templates']['mlyss_wtrman_s_begin']['eventToActions']['ON_ENTITY_WILL_OVERLAP'][0]['_typesNeedtoUseRatio'].append('BLOCK_CNT')),
    ('copy omits steal reset', delete(['templates', 'mlyss_wtrman_s_begin', 'eventToActions', 'ON_ENTITY_WILL_OVERLAP', 12])),
    ('split forcefully overlaps', lambda e: component(e, '4692281838629771371', 'tokens', TOKENS[0]).update(_forceSpawn=1)),
    ('split copies donor scaling twice', set_field(['templates', 'mlyss_wtrman_summon[override]', 'eventToActions', 'ON_BUFF_START', 0, '_useRatio'], True)),
    ('split threshold event scope changes', set_field(['templates', 'mlyss_wtrman_t_2[range]', 'eventToActions', 'ON_ABILITY_CAST_ON_TARGET', 0, '_familyGroupMask'], 'ALL')),
    ('split expiry skips recovery', set_field(['templates', 'mlyss_wtrman_summon[trigger]', 'eventToActions', 'ON_BUFF_TRIGGER', 0, '_skipReborn'], True)),
    ('melee stealing loses persistent gain', lambda e: component(e, '1941241512984926315', 'tokens', TOKENS[0]).update(_finishOwnerBuffWhenTargetInvalid=1)),
    ('S2 repeat loses native event timing', lambda e: component(e, '-3633190244100056981', 'tokens', TOKENS[0]).update(_waitAttackEventForAllAttacks=0)),
    ('S3 removes Bind', set_field(['templates', 'mlyss_s_3[token_buff_range]', 'eventToActions', 'ON_ABILITY_SPELL_ON', 1, '_buff', 'attributes', 'abnormalFlags'], [])),
    ('missing token skeleton', delete(['officialTokenSkeletonBindings', TOKENS[0], 'facings', 'Single'])),
    ('missing token parsed model', delete(['tokenModels', TOKENS[0], 'Single'])),
    ('altered recovery alias', set_field(['officialTokenSkeletonBindings', TOKENS[0], 'animationAliases', 1, 'animName'], 'Idle_1')),
    ('altered token second hit event', set_field(['tokenModels', TOKENS[0], 'Single', 'eventPayloads', 'B_Attack_2', 1, 'time'], .1)),
    ('altered owner hit event', set_field(['models', ID, 'Front', 'eventPayloads', 'Attack', 0, 'time'], .3)),
    ('missing owner skeleton', delete(['officialSkeletonBindings', ID, 'Back'])),
    ('premature enablement', set_field(['enabledOperators'], [ID])),
    ('unsupported frame parity claim', set_field(['frameParity'], True)),
]
path = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        value = copy.deepcopy(original)
        mutate(value)
        assert value != original, 'Fixture did not change evidence: ' + name
        path.write_text(json.dumps(value))
        result = subprocess.run([sys.executable, 'tools/arkpedia/verify-muelsyse.py', str(path)],
                                cwd=ROOT, text=True, capture_output=True)
        assert result.returncode != 0, 'Verifier accepted ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
    checked([sys.executable, 'tools/arkpedia/verify-muelsyse.py'])
assert hashes() == before, 'Audit changed durable source outputs'
print(f'Reproducible Muelsyse receipt; {len(cases)} negative fixtures rejected', flush=True)
