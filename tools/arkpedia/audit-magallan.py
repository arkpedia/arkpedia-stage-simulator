#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce original Magallan evidence and reject incomplete/altered source records.

Audits source bytes and dependency membership, not gameplay or Unity frame parity.
Run with .cache/map-env/bin/python tools/arkpedia/audit-magallan.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/magallan-source'
SOURCE = ROOT / 'data/arkpedia-magallan-prefabs.json'
ID = 'char_248_mgllan'
TOKENS = ['token_10005_mgllan_drone' + str(n) for n in range(1, 4)]


def run(args):
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)


def checked(args):
    result = run(args)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [SOURCE, OUT / 'models.json', OUT / 'token-models.json']}


baseline = checked([sys.executable, 'tools/arkpedia/verify-magallan.py'])
print(baseline, flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-magallan.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-magallan.py'])
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
    elif name == 'missing-drone':
        del e['tokens'][TOKENS[1]]
    elif name == 'missing-drone-rank':
        e['tables']['tokenSkills']['sktok_mgllan_drone3']['levels'].pop()
    elif name == 'missing-projectile':
        del e['projectiles']['projectile_mgllan3_drone_3S']
    elif name == 'missing-pulse-template':
        del e['templates']['mgllan_s_1_token[active]']
        del e['originalTemplates']['mgllan_s_1_token[active]']
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_mgllan_3']['levels'][9]['blackboard'][0]['value'] = 99
    elif name == 'changed-owner-hit':
        e['models'][ID]['Front']['eventPayloads']['Attack'][0]['time'] = .5
    elif name == 'changed-drone-hit':
        e['tokenModels'][TOKENS[1]]['eventPayloads']['Attack'][0]['time'] = .5
    elif name == 'changed-drone-placement':
        component('8032229342842227100')['_buildCondition']['needSpecifyDirection'] = 0
    elif name == 'changed-moving-radius':
        component('5620763496570893951')['m_Radius'] = .75
    elif name == 'changed-invisibility':
        e['templates']['mgllan_drone_t']['eventToActions']['ON_OWNER_BORN'][0]['_buff']['attributes']['abnormalFlags'] = ['CAMOUFLAGE']
    elif name == 'changed-skeleton-binding':
        e['officialTokenSkeletonBindings'][TOKENS[1]]['textAssetPathId'] = '0'
    elif name == 'changed-native-alias':
        e['officialTokenSkeletonBindings'][TOKENS[1]]['animationAliases'][2]['animName'] = 'Die'
    elif name == 'changed-stock':
        e['tables']['tokens'][TOKENS[0]]['talents'][0]['candidates'][2]['blackboard'][0]['value'] = 99
    else:
        raise ValueError(name)
    return e


rejections = []
for name in ['enabled-before-runtime', 'omitted-component', 'changed-object-activation',
             'missing-drone', 'missing-drone-rank', 'missing-projectile',
             'missing-pulse-template', 'changed-skill-rank', 'changed-owner-hit',
             'changed-drone-hit', 'changed-drone-placement', 'changed-moving-radius',
             'changed-invisibility', 'changed-skeleton-binding', 'changed-native-alias', 'changed-stock']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(changed(name)) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-magallan.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True,
                       'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

(OUT / 'review-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
    'heldOperator': ID, 'frameParity': False,
}, indent=2) + '\n')
print('Native audit passed; three outputs reproduce exactly and sixteen altered records are rejected', flush=True)
