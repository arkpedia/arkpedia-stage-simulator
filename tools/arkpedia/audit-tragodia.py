#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Tragodia's receipt and reject omitted or modified native evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-tragodia.py.
This verifies source membership and bytes, not playable or Unity frame parity.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/tragodia-source'
SOURCE = ROOT / 'data/arkpedia-tragodia-prefabs.json'
ID = 'char_1042_phatm2'
TOKENS = ['token_10054_phatm2_encdool', 'token_10055_phatm2_mndclv']


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


print(checked([sys.executable, 'tools/arkpedia/verify-tragodia.py']), flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-tragodia.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-tragodia.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
print(checked([sys.executable, 'tools/arkpedia/verify-tragodia.py']), flush=True)
original = json.loads(SOURCE.read_text())
cases = [
    ('wrong source repository', set_field(['source', 'repository'], 'unreviewed')),
    ('wrong model repository', set_field(['source', 'modelRepository'], 'unreviewed')),
    ('wrong source channel', set_field(['source', 'commit'], 'unreviewed')),
    ('wrong native client', set_field(['source', 'nativeClient'], 'unreviewed')),
    ('wrong buff Git identity', set_field(['source', 'buffDatabase', 'gitBlob', 'sha'], '0' * 40)),
    ('missing source bundle', delete(['source', 'bundles', 0])),
    ('missing lure', delete(['tokens', TOKENS[0]])),
    ('missing cage', delete(['tokens', TOKENS[1]])),
    ('missing owner rank', delete(['tables', 'skills', 'skchr_phatm2_3', 'levels', 4])),
    ('missing cage table rank', delete(['tables', 'tokenSkills', 'sktok_phatm2_mndclv_3', 'levels', 0])),
    ('missing owner skill', delete(['skills', 'skchr_phatm2_3'])),
    ('missing lure skill prefab', delete(['skills', 'sktok_phatm2_encdool_2'])),
    ('missing dependency template', delete(['templates', 'token_phatm2_encdool_target'])),
    ('missing original template', delete(['originalTemplates', 'phatm2_t_1'])),
    ('missing cage native-only passive', delete(['originalTemplates', 'token_phatm2_mndclv[passive]'])),
    ('native-only cage passive hidden', set_field(['jsonTemplateGaps'], [])),
    ('cage native passive and gap both omitted', lambda e: (e['originalTemplates'].pop('token_phatm2_mndclv[passive]'), e.update(jsonTemplateGaps=[]))),
    ('cage passive event changed', set_field(['originalTemplates', 'token_phatm2_mndclv[passive]', 'eventToActions', '_items', 0, 'key'], 0)),
    ('cage immediate block search changed', set_field(['originalTemplates', 'token_phatm2_mndclv[passive]', 'eventToActions', '_items', 0, 'value', 'SerializedState'], '[]')),
    ('missing resolved cage empty prefab', delete(['skills', 'sktok_empty'])),
    ('cage prefab override removed', set_field(['tables', 'tokens', TOKENS[1], 'skills', 2, 'overridePrefabKey'], None)),
    ('missing expanded range', delete(['tables', 'ranges', 'y-8'])),
    ('missing projectile', delete(['projectiles', 'projectile_token_phatm2_encdool'])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['tokens'][TOKENS[0]].append(copy.deepcopy(e['tokens'][TOKENS[0]][0]))),
    ('lure consumes deployment slot', lambda e: component(e, '9056605678497710654', 'tokens', TOKENS[0]).update(_occupiedRemainingCharacterCnt=1)),
    ('lure ignores reachable path', lambda e: component(e, '-7319848684153398234', 'projectiles', 'projectile_token_phatm2_encdool').update(_checkReachableToOwner=0)),
    ('lure ignores obstacles', lambda e: component(e, '-7319848684153398234', 'projectiles', 'projectile_token_phatm2_encdool').update(_avoidObstacleLike=0)),
    ('lure ignores attraction immunity', lambda e: component(e, '-7319848684153398234', 'projectiles', 'projectile_token_phatm2_encdool').update(_filterAbnormalImmune=0)),
    ('lure loses original End event', set_field(['tokenModels', TOKENS[0], 'Single', 'eventPayloads', 'End', 0, 'time'], .1)),
    ('lure loses original Born alias', set_field(['officialTokenSkeletonBindings', TOKENS[0], 'animationAliases', 1, 'animName'], 'Loop')),
    ('fake cage skeleton', set_field(['officialTokenSkeletonBindings', TOKENS[1], 'facings'], {'Single': {}})),
    ('fake cage parsed model', set_field(['tokenModels', TOKENS[1]], {'Single': {}})),
    ('cage effects renderer changed', set_field(['officialTokenSkeletonBindings', TOKENS[1], 'renderingKind'], 'spine')),
    ('native cage prefab gap hidden', set_field(['nativeSkillPrefabGaps'], [])),
    ('native cage table removed', delete(['tables', 'tokenSkills', 'sktok_phatm2_mndclv_3'])),
    ('owner attack loses original event', set_field(['models', ID, 'Front', 'eventPayloads', 'Attack_1', 0, 'time'], .3)),
    ('owner skeleton removed', delete(['officialSkeletonBindings', ID, 'Back'])),
    ('premature enablement', set_field(['enabledOperators'], [ID])),
    ('unsupported frame parity claim', set_field(['frameParity'], True)),
    ('unsupported particle claim', set_field(['nativeParticleSupport'], True)),
]
path = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        value = copy.deepcopy(original)
        mutate(value)
        assert value != original, 'Fixture did not change evidence: ' + name
        path.write_text(json.dumps(value))
        result = subprocess.run([sys.executable, 'tools/arkpedia/verify-tragodia.py', str(path)],
                                cwd=ROOT, text=True, capture_output=True)
        assert result.returncode != 0, 'Verifier accepted ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
    checked([sys.executable, 'tools/arkpedia/verify-tragodia.py'])
assert hashes() == before, 'Audit changed durable source outputs'
print(f'Reproducible Tragodia receipt; {len(cases)} negative fixtures rejected', flush=True)
