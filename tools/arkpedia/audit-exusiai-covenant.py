#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce original Exusiai evidence and reject incomplete/altered source records.

Audits source bytes and dependency membership, not gameplay or Unity frame parity.
Run with .cache/map-env/bin/python tools/arkpedia/audit-exusiai-covenant.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/exusiai-covenant-source'
SOURCE = ROOT / 'data/arkpedia-exusiai-covenant-prefabs.json'
ID = 'char_1041_angel2'
TOKEN = 'token_10056_angel2_target'


def run(args):
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)


def checked(args):
    result = run(args)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [SOURCE, OUT / 'models.json']}


baseline = checked([sys.executable, 'tools/arkpedia/verify-exusiai-covenant.py'])
print(baseline, flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-exusiai-covenant.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-exusiai-covenant.py'])
assert hashes() == before, 'Original source outputs are not reproducible'
original = json.loads(SOURCE.read_text())


def changed(name):
    e = json.loads(json.dumps(original))

    def component(path_id):
        return next(c['data'] for group in ['characters', 'tokens', 'skills', 'projectiles']
                    for rows in e[group].values() for row in rows
                    for c in row['components'] if c['pathId'] == path_id)

    if name == 'enabled-before-runtime':
        e['enabledOperators'] = [ID]
        e['heldOperators'] = []
    elif name == 'omitted-component':
        e['characters'][ID][0]['components'].pop()
    elif name == 'changed-object-activation':
        go = e['characters'][ID][0]['gameObjectData']
        go['m_IsActive'] = 1 - go['m_IsActive']
    elif name == 'missing-coordinate':
        del e['tokens'][TOKEN]
    elif name == 'missing-coordinate-rank':
        e['tables']['tokenSkills']['sktok_angel2_target_3']['levels'].pop()
    elif name == 'missing-projectile':
        del e['projectiles']['projectile_chr_angel2_s3_start']
    elif name == 'missing-shield-cleaner':
        del e['templates']['angel2_s_2[cleaner]']
        del e['originalTemplates']['angel2_s_2[cleaner]']
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_angel2_3']['levels'][9]['blackboard'][0]['value'] = 99
    elif name == 'changed-five-hit-event':
        e['models'][ID]['Front']['eventPayloads']['Skill_3_Loop'][0]['time'] = .5
    elif name == 'changed-ammo-cost':
        component('-3515024303529728785')['_expendPerTrigger'] = 1
    elif name == 'changed-projectile-speed':
        component('3215183870520921349')['_speed'] = 10
    elif name == 'changed-coordinate-range':
        component('5469880532721077243')['_buildCondition']['limitByHostAttackRange'] = 0
    elif name == 'changed-barrier-source':
        e['templates']['angel2_s_2[shield]']['eventToActions']['ON_BUFF_START'][0]['_targetType'] = 'BUFF_OWNER'
    elif name == 'changed-skeleton-binding':
        e['officialSkeletonBindings'][ID]['Back']['textAssetPathId'] = '0'
    else:
        raise ValueError(name)
    return e


rejections = []
for name in ['enabled-before-runtime', 'omitted-component', 'changed-object-activation',
             'missing-coordinate', 'missing-coordinate-rank', 'missing-projectile',
             'missing-shield-cleaner', 'changed-skill-rank', 'changed-five-hit-event',
             'changed-ammo-cost', 'changed-projectile-speed', 'changed-coordinate-range',
             'changed-barrier-source', 'changed-skeleton-binding']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(changed(name)) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-exusiai-covenant.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True,
                       'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

(OUT / 'review-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
    'heldOperator': ID, 'frameParity': False,
}, indent=2) + '\n')
print('Native audit passed; two outputs reproduce exactly and fourteen altered records are rejected', flush=True)
