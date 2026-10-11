#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Shu's original source evidence and reject changed or omitted records.

This checks source bytes/membership, not gameplay, modules or Unity frame parity.
Run with .cache/map-env/bin/python tools/arkpedia/audit-shu.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/shu-source'
SOURCE = ROOT / 'data/arkpedia-shu-prefabs.json'
ID = 'char_2025_shu'


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


baseline = checked([sys.executable, 'tools/arkpedia/verify-shu.py'])
print(baseline, flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-shu.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-shu.py'])
assert hashes() == before, 'Original source outputs are not reproducible'
original = json.loads(SOURCE.read_text())


def component(e, path_id):
    return next(c['data'] for r in e['characters'][ID] for c in r['components']
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
        del e['skills']['skchr_shu_2']
    elif name == 'missing-skill-rank':
        e['tables']['skills']['skchr_shu_3']['levels'].pop()
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_shu_2']['levels'][9]['blackboard'][0]['value'] = 99
    elif name == 'missing-sowing-template':
        del e['templates']['shu_farm_buff[char]']
        del e['originalTemplates']['shu_farm_buff[char]']
    elif name == 'changed-sowing-cross':
        action(e['templates']['shu_t_1'], 'TriggerAttachListenerToTileAbility')['_rangeId'] = 'x-1'
    elif name == 'changed-sowing-cleanup':
        action(e['templates']['shu_farm_buff[char]'], 'AttachAsDerivedBuffById')['_finishDerivedBuffIfParentFinish'] = False
    elif name == 'changed-original-sowing-flag':
        original_action = e['originalTemplates']['shu_t_1']['eventToActions']['_items'][0]['value']
        state = json.loads(original_action['SerializedState'])
        action(state, 'TriggerAttachListenerToTileAbility')['_useTargetRootTile'] = True
        original_action['SerializedState'] = json.dumps(state)
    elif name == 'changed-teleport-unblock':
        action(e['templates']['shu_s_3[enemy][mark]'], 'ForceSetToTilePosition')['_releaseFromBlocker'] = True
    elif name == 'changed-teleport-threshold':
        action(e['templates']['shu_s_3[enemy][mark]'], 'FilterRootTileOffset')['_condType'] = 'GT'
    elif name == 'changed-sui-squad-count':
        component(e, '-3066102878310402781')['_options']['minCntToTrig'] = 3
    elif name == 'changed-profession-check':
        component(e, '-634519851075144413')['_checkMaxSameProfessionCount'] = 1
    elif name == 'changed-heal-alias':
        component(e, '6044950186018567459')['_replaceAnimPairs'][1]['toAnimKey'] = 'Attack_1'
    elif name == 'changed-owner-hit':
        e['models'][ID]['Front']['eventPayloads']['Attack_2'][0]['time'] = .5
    elif name == 'invented-back-death':
        e['models'][ID]['Back']['durations']['Die'] = 1
    elif name == 'changed-skeleton-binding':
        e['officialSkeletonBindings'][ID]['Front']['textAssetPathId'] = '0'
    elif name == 'missing-chararts-component':
        e['chararts'][ID].pop()
    elif name == 'missing-recursive-range':
        del e['tables']['ranges']['x-5']
    elif name == 'changed-buff-database-origin':
        e['source']['buffDatabase']['gitBlob']['sha'] = '0' * 40
    else:
        raise ValueError(name)
    return e


rejections = []
for name in ['enabled-before-runtime', 'omitted-component', 'changed-object-activation',
             'missing-skill', 'missing-skill-rank', 'changed-skill-rank',
             'missing-sowing-template', 'changed-sowing-cross', 'changed-sowing-cleanup',
             'changed-original-sowing-flag', 'changed-teleport-unblock', 'changed-teleport-threshold',
             'changed-sui-squad-count', 'changed-profession-check', 'changed-heal-alias',
             'changed-owner-hit', 'invented-back-death', 'changed-skeleton-binding',
             'missing-chararts-component', 'missing-recursive-range', 'changed-buff-database-origin']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(changed(name)) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-shu.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True,
                       'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

(OUT / 'review-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
    'heldOperator': ID, 'frameParity': False,
}, indent=2) + '\n')
print('Native audit passed; two outputs reproduce exactly and twenty-one altered records are rejected', flush=True)
