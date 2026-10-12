#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Yu's native source receipt and reject corrupt or incomplete evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-yu.py.
This verifies original source membership, not gameplay or Unity frame parity.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/yu-source'
SOURCE = ROOT / 'data/arkpedia-yu-prefabs.json'
ID = 'char_2026_yu'


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


baseline = checked([sys.executable, 'tools/arkpedia/verify-yu.py'])
print(baseline, flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-yu.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-yu.py'])
assert hashes() == before, 'Native source outputs are not reproducible'
original = json.loads(SOURCE.read_text())


def component(e, path_id, group='characters', key=ID):
    return next(c['data'] for r in e[group][key] for c in r['components']
                if c['pathId'] == path_id)


def action(value, name):
    if isinstance(value, dict):
        if value.get('$type', '').split('+')[-1].split(',')[0] == name:
            return value
        for child in value.values():
            found = action(child, name)
            if found is not None:
                return found
    elif isinstance(value, list):
        for child in value:
            found = action(child, name)
            if found is not None:
                return found
    return None


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
    elif name == 'missing-skill':
        del e['skills']['skchr_yu_2']
    elif name == 'missing-skill-rank':
        e['tables']['skills']['skchr_yu_3']['levels'].pop()
    elif name == 'changed-defensive-sp':
        e['tables']['skills']['skchr_yu_1']['levels'][9]['spData']['spType'] = 'INCREASE_WITH_TIME'
    elif name == 'changed-blocked-first-trigger':
        component(e, '-5466566168720789974')['_buffsToBlockee'][0]['firstTriggerInterval'] = 1
    elif name == 'changed-burn-element':
        action(e['templates']['yu_t_1[enemy]'], 'ApplyElementDamage')['_elementDamageType'] = 'NECROSIS'
    elif name == 'changed-sanctuary-cleanup':
        action(e['templates']['yu_t_1[damage_resistance]'], 'CreateBuff')['_finishDerivedBuffIfParentFinish'] = False
    elif name == 'changed-serialized-sanctuary-cleanup':
        record = e['originalTemplates']['yu_t_1[damage_resistance]']['eventToActions']['_items'][0]['value']
        state = json.loads(record['SerializedState'])
        action(state, 'CreateBuff')['_finishDerivedBuffIfParentFinish'] = False
        record['SerializedState'] = json.dumps(state)
    elif name == 'normalized-prefab-checker-count':
        component(e, '5161708197214924330')['_minCount'] = 4
    elif name == 'normalized-table-count':
        e['tables']['character']['talents'][1]['candidates'][0]['blackboard'][0]['value'] = 5
    elif name == 'changed-elemental-recovery-attribute':
        action(e['templates']['yu_t_2[heal]'], 'UpdateBuffAttributeModifier')['_attributeType'] = 'HP_RECOVERY_PER_SEC'
    elif name == 'changed-teleport-unblock':
        action(e['templates']['yu_s_2[try_tp]'], 'ForceSetToTilePosition')['_releaseFromBlocker'] = False
    elif name == 'changed-teleport-reachability':
        action(e['templates']['yu_s_2[try_tp]'], 'CheckEnemyRealReachableToTile')['_avoidObstacleLike'] = False
    elif name == 'changed-teleport-offset':
        action(e['templates']['yu_s_2[try_tp]'], 'ForceSetToTilePosition')['_randomOffset'] = 0
    elif name == 'changed-wall-boundary':
        action(e['templates']['yu_s_3[ally]'], 'CheckTargetGridPositionRowOrColWithBB')['_compareType'] = 'LT'
    elif name == 'changed-wall-source-filter':
        action(e['templates']['yu_s_3[ally]'], 'IfTargetEqual')['_target1'] = 'BUFF_OWNER'
    elif name == 'changed-projectile-wall-width':
        component(e, '1077596554295986484', 'skills', 'skchr_yu_3')['_horizonSize'] = 1
    elif name == 'changed-projectile-side':
        component(e, '1616396259393751348', 'skills', 'skchr_yu_3')['_targetSide'] = 1
    elif name == 'changed-owner-hit':
        e['models'][ID]['Front']['eventPayloads']['Skill_3_Begin'][0]['time'] = .5
    elif name == 'invented-back-death':
        e['models'][ID]['Back']['durations']['Die'] = 1
    elif name == 'changed-skeleton-binding':
        e['officialSkeletonBindings'][ID]['Front']['textAssetPathId'] = '0'
    elif name == 'missing-chararts-component':
        e['chararts'][ID].pop()
    elif name == 'missing-recursive-range':
        del e['tables']['ranges']['x-1']
    elif name == 'missing-template':
        del e['templates']['yu_s_2[try_tp]']
        del e['originalTemplates']['yu_s_2[try_tp]']
    elif name == 'changed-buff-database-origin':
        e['source']['buffDatabase']['gitBlob']['sha'] = '0' * 40
    else:
        raise ValueError(name)
    return e


fixtures = ['enabled-before-runtime', 'omitted-component', 'changed-object-activation',
            'missing-skill', 'missing-skill-rank', 'changed-defensive-sp',
            'changed-blocked-first-trigger', 'changed-burn-element', 'changed-sanctuary-cleanup',
            'changed-serialized-sanctuary-cleanup', 'normalized-prefab-checker-count',
            'normalized-table-count', 'changed-elemental-recovery-attribute',
            'changed-teleport-unblock', 'changed-teleport-reachability', 'changed-teleport-offset',
            'changed-wall-boundary', 'changed-wall-source-filter', 'changed-projectile-wall-width',
            'changed-projectile-side', 'changed-owner-hit', 'invented-back-death',
            'changed-skeleton-binding', 'missing-chararts-component', 'missing-recursive-range',
            'missing-template', 'changed-buff-database-origin']
rejections = []
for name in fixtures:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(changed(name)) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-yu.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True,
                       'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

(OUT / 'review-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
    'heldOperator': ID, 'frameParity': False,
}, indent=2) + '\n')
print(f'Native audit passed; two outputs reproduce exactly and {len(fixtures)} altered records are rejected', flush=True)
