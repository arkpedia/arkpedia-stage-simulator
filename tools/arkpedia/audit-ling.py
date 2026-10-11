#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Ling's source evidence and reject incomplete or altered records.

This audits original source bytes and membership, not gameplay or frame parity.
Run with .cache/map-env/bin/python tools/arkpedia/audit-ling.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/ling-source'
SOURCE = ROOT / 'data/arkpedia-ling-prefabs.json'
ID = 'char_2023_ling'
TOKENS = ['token_10020_ling_soul' + str(n) for n in range(1, 4)]


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


baseline = checked([sys.executable, 'tools/arkpedia/verify-ling.py'])
print(baseline, flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-ling.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-ling.py'])
assert hashes() == before, 'Original source outputs are not reproducible'
original = json.loads(SOURCE.read_text())


def changed(name):
    e = json.loads(json.dumps(original))
    if name == 'enabled-before-runtime':
        e['enabledOperators'] = [ID]
        e['heldOperators'] = []
    elif name == 'omitted-component':
        e['characters'][ID][0]['components'].pop()
    elif name == 'changed-object-activation':
        go = e['characters'][ID][0]['gameObjectData']
        go['m_IsActive'] = 1 - go['m_IsActive']
    elif name == 'missing-dragon':
        del e['tokens'][TOKENS[1]]
    elif name == 'missing-dragon-rank':
        e['tables']['tokenSkills']['sktok_ling_soul3']['levels'].pop()
    elif name == 'missing-projectile':
        del e['projectiles']['projectile_chr_ling_s2']
    elif name == 'missing-fusion-template':
        del e['templates']['ling_soul3_evolution[self]']
        del e['originalTemplates']['ling_soul3_evolution[self]']
    elif name == 'changed-fusion-slot-transfer':
        e['templates']['ling_soul3_evolution[self]']['eventToActions']['ON_BUFF_START'][0]['_targetType'] = 'BUFF_OWNER'
    elif name == 'changed-fusion-mode':
        e['templates']['ling_soul3_evolution[mode]']['eventToActions']['ON_BUFF_START'][0]['_succeedNodes'][0]['_modeIndex'] = 4
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_ling_3']['levels'][9]['blackboard'][0]['value'] = 99
    elif name == 'changed-owner-hit':
        e['models'][ID]['Front']['eventPayloads']['Attack'][0]['time'] = .5
    elif name == 'changed-higher-form-hit':
        e['tokenModels'][TOKENS[2]]['eventPayloads']['Attack_02'][0]['time'] = .4
    elif name == 'changed-dragon-placement':
        root = next(r for r in e['tokens'][TOKENS[1]] if r['object'] == TOKENS[1])
        next(c['data'] for c in root['components'] if '_buildCondition' in c['data'])['_buildCondition']['buildableType'] = 1
    elif name == 'changed-skeleton-binding':
        e['officialTokenSkeletonBindings'][TOKENS[1]]['textAssetPathId'] = '0'
    elif name == 'changed-higher-form-alias':
        aliases = e['officialTokenSkeletonBindings'][TOKENS[2]]['animationAliases']
        next(a for a in aliases if a['animKey'] == 'Attack_2')['animName'] = 'Attack'
    elif name == 'changed-stock':
        e['tables']['tokens'][TOKENS[0]]['talents'][0]['candidates'][2]['blackboard'][0]['value'] = 99
    elif name == 'missing-recursive-range':
        del e['tables']['ranges']['x-5']
    elif name == 'changed-buff-database-origin':
        e['source']['buffDatabase']['gitBlob']['sha'] = '0' * 40
    else:
        raise ValueError(name)
    return e


rejections = []
for name in ['enabled-before-runtime', 'omitted-component', 'changed-object-activation',
             'missing-dragon', 'missing-dragon-rank', 'missing-projectile',
             'missing-fusion-template', 'changed-fusion-slot-transfer', 'changed-fusion-mode',
             'changed-skill-rank', 'changed-owner-hit', 'changed-higher-form-hit',
             'changed-dragon-placement', 'changed-skeleton-binding', 'changed-higher-form-alias',
             'changed-stock', 'missing-recursive-range', 'changed-buff-database-origin']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(changed(name)) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-ling.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True,
                       'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

(OUT / 'review-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
    'heldOperator': ID, 'frameParity': False,
}, indent=2) + '\n')
print('Native audit passed; three outputs reproduce exactly and eighteen altered records are rejected', flush=True)
