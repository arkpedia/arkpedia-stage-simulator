#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Index original CN enemy timing fields without inventing runtime bindings."""
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

C = ROOT / '.cache/arkpedia/cn-native-source'
source_raw = (ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes()
source = json.loads(source_raw)
manifest_raw = (C / 'hot_update_list.json').read_bytes()
assert len(manifest_raw) == 3241788
assert hashlib.sha256(manifest_raw).hexdigest() == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
manifest = json.loads(manifest_raw)
assert source['source']['resourceVersion'] == manifest['versionId'] == '26-09-22-07-47-20_6c71fa'
wanted = {'battle/enm_pfb_base_0.ab'} | {f'battle/enm_pfb_{i}.ab' for i in range(36)}
assert {r['path'] for r in source['bundles']} == wanted and len(source['bundles']) == len(wanted)
FIELDS = {
    '_affectedBySlowDown', '_cooldown', '_cooldownKey', '_preDelay', '_escapeTime', '_timeMode',
    '_resetCdStrategy', '_overwriteInitCooldown', '_resetMainAbilityCdWhenCastEnd', '_resetCdWaitFirstPeriod',
    '_coolDownAbilityIndex', '_clearInternalCooldownWhenFinish', '_updateCooldownAfterSubAbilitiesAttached',
    '_useLongestAbilityCooldown', '_alsoResetSubAbilityCooldown', '_enableUpdateCooldown', '_durationKey', '_isInfinity',
    '_modes', '_commonAbilities', '_combat', '_attack', '_attackTrigger', '_generalAbilities', '_abilities',
    '_wrappedAbilities', '_trigger', '_selector', '_metadata', '_familyMask', '_castLikeAttack', '_checkParentActive',
    '_maxTriggerTime', '_ignoreSilence', '_animKey', '_endAnimKey', '_downAnimKey', '_downEndAnimKey', '_upAnimKey',
    '_upEndAnimKey', '_maxAnimScale', '_waitForAttackEvent', '_selectTargetTiming', '_selectTargetSource',
    '_checkCanUseSubAbility', '_forceNextIfCastFail', '_alwaysNext', '_enableLoop', '_abilityLoopSettings',
    '_fixAffectingAbilityParam', '_alsoInterruptCurrentSubAbility', '_onlyPlayEndAnimWhenIsLastAbility',
    '_interruptableSubAbilityIndice', '_stopMoveNextWhenNotCasting', '_interruptIfTargetDead', '_category',
}

def exact(v, key=''):
    if isinstance(v, dict): return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [exact(x, key) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

def digest(v):
    return hashlib.sha256(json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

def local(p):
    assert p['m_FileID'] == 0
    return p['m_PathID']

prefabs = {}
summary = {'bundles': len(wanted), 'prefabs': 0, 'hierarchyObjects': 0, 'components': 0, 'clockComponents': 0,
           'slowDownYes': 0, 'slowDownNo': 0}
for row in source['bundles']:
    entry = next(r for r in manifest['abInfos'] if r['name'] == row['path'])
    raw = (C / 'bundles' / row['path']).read_bytes()
    assert len(raw) == row['bytes'] == entry['abSize']
    assert hashlib.md5(raw).hexdigest() == row['md5'] == entry['md5']
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    by = {o.path_id: o for o in UnityPy.load(raw).objects}
    trees = {pid: o.read_typetree() for pid, o in by.items() if o.type.name in ['GameObject', 'Transform', 'MonoBehaviour']}
    containers = [(name, local(fields['asset'])) for o in by.values() if o.type.name == 'AssetBundle'
                  for name, fields in o.read_typetree()['m_Container']]
    for container, root in containers:
        assert container not in prefabs and by[root].type.name == 'GameObject'
        hierarchy, clocks = {}, []
        def visit(pid, ancestors):
            assert pid not in hierarchy
            go = trees[pid]; comps = [(local(p['component']), by[local(p['component'])].type.name) for p in go['m_Component']]
            transforms = [p for p, typ in comps if typ == 'Transform']; assert len(transforms) == 1
            tr_id = transforms[0]; tr = trees[tr_id]
            assert local(tr['m_GameObject']) == pid
            children = [local(p) for p in tr['m_Children']]
            hierarchy[pid] = [str(pid), go['m_Name'], str(tr_id), str(local(tr['m_Father'])),
                              [str(p) for p in children], [[str(p), typ] for p, typ in comps]]
            for comp_id, typ in comps:
                if typ != 'MonoBehaviour': continue
                d = trees[comp_id]; assert local(d['m_GameObject']) == pid
                fields = {k: exact(v, k) for k, v in d.items() if k in FIELDS}
                if not fields: continue
                if '_affectedBySlowDown' in fields:
                    assert fields['_affectedBySlowDown'] in [0, 1]
                    summary['slowDownYes' if fields['_affectedBySlowDown'] else 'slowDownNo'] += 1
                clocks.append({'pathId': str(comp_id), 'gameObjectPathId': str(pid), 'objectName': go['m_Name'],
                    'ancestors': [str(p) for p in ancestors], 'script': exact(d['m_Script']),
                    'originalDataSha256': digest(exact(d)), 'fields': fields})
            for tr_child in children:
                child = trees[tr_child]; assert local(child['m_Father']) == tr_id
                visit(local(child['m_GameObject']), [*ancestors, pid])
        visit(root, [])
        nodes = [hierarchy[k] for k in sorted(hierarchy)]
        total_components = sum(len(n[-1]) for n in nodes)
        prefabs[container] = {'bundle': row['path'], 'rootPathId': str(root), 'rootName': trees[root]['m_Name'],
            'hierarchyObjects': len(nodes), 'components': total_components, 'hierarchySha256': digest(nodes),
            'clockComponents': sorted(clocks, key=lambda r: int(r['pathId']))}
        summary['prefabs'] += 1; summary['hierarchyObjects'] += len(nodes)
        summary['components'] += total_components; summary['clockComponents'] += len(clocks)
    print('Indexed', row['path'], len(containers), 'original prefab roots', flush=True)
result = {'schemaVersion': 1,
    'scope': 'Original CN enemy timing fields, controller references and hierarchy identities. This is not complete ability graph extraction or a runtime cooldown/animation mapping.',
    'enabledOperators': [], 'runtimeBindingsVerified': False, 'compiledDispatchVerified': False, 'frameParity': False,
    'source': {'inventory': 'data/arkpedia-cn-enemy-native-source.json', 'sha256': hashlib.sha256(source_raw).hexdigest()},
    'selectedFields': sorted(FIELDS), 'summary': summary, 'prefabs': dict(sorted(prefabs.items()))}
target = ROOT / 'data/arkpedia-enemy-clock-source.json'
temporary = None
try:
    with tempfile.NamedTemporaryFile('w', encoding='utf8', dir=target.parent, prefix='.enemy-clocks-', suffix='.tmp', delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    os.replace(temporary, target)
finally:
    if temporary: temporary.unlink(missing_ok=True)
print('Original enemy timing inventory:', json.dumps(summary))
