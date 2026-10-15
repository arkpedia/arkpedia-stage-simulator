#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently derive the timing index from original prefab membership/parents."""
import hashlib
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

index_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data/arkpedia-enemy-clock-source.json'
r = json.loads(index_path.read_bytes())
assert set(r) == {'schemaVersion', 'scope', 'enabledOperators', 'runtimeBindingsVerified', 'compiledDispatchVerified',
                  'frameParity', 'source', 'selectedFields', 'summary', 'prefabs'}
assert r['schemaVersion'] == 1 and r['enabledOperators'] == []
assert all(r[k] is False for k in ['runtimeBindingsVerified', 'compiledDispatchVerified', 'frameParity'])
fields = set('''_affectedBySlowDown _cooldown _cooldownKey _preDelay _escapeTime _timeMode
_resetCdStrategy _overwriteInitCooldown _resetMainAbilityCdWhenCastEnd _resetCdWaitFirstPeriod
_coolDownAbilityIndex _clearInternalCooldownWhenFinish _updateCooldownAfterSubAbilitiesAttached
_useLongestAbilityCooldown _alsoResetSubAbilityCooldown _enableUpdateCooldown _durationKey _isInfinity
_modes _commonAbilities _combat _attack _attackTrigger _generalAbilities _abilities _wrappedAbilities
_trigger _selector _metadata _familyMask _castLikeAttack _checkParentActive _maxTriggerTime _ignoreSilence
_animKey _endAnimKey _downAnimKey _downEndAnimKey _upAnimKey _upEndAnimKey _maxAnimScale _waitForAttackEvent
_selectTargetTiming _selectTargetSource _checkCanUseSubAbility _forceNextIfCastFail _alwaysNext _enableLoop
_abilityLoopSettings _fixAffectingAbilityParam _alsoInterruptCurrentSubAbility _onlyPlayEndAnimWhenIsLastAbility
_interruptableSubAbilityIndice _stopMoveNextWhenNotCasting _interruptIfTargetDead _category'''.split())
assert r['selectedFields'] == sorted(fields)
c = ROOT / '.cache/arkpedia/cn-native-source'
manifest_bytes = (c / 'hot_update_list.json').read_bytes()
manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
assert len(manifest_bytes) == 3241788 and manifest_sha == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
h = json.loads(manifest_bytes); assert h['versionId'] == '26-09-22-07-47-20_6c71fa'
inventory_bytes = (ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes()
inventory = json.loads(inventory_bytes)
assert r['source'] == {'inventory': 'data/arkpedia-cn-enemy-native-source.json', 'sha256': hashlib.sha256(inventory_bytes).hexdigest()}
base = 'https://ak.hycdn.cn/assetbundle/official/Android/assets/26-09-22-07-47-20_6c71fa/'
assert set(inventory) == {'schemaVersion', 'scope', 'enabledOperators', 'runtimeBindingsVerified', 'frameParity', 'source', 'summary', 'bundles'}
assert inventory['schemaVersion'] == 1 and inventory['enabledOperators'] == []
assert inventory['runtimeBindingsVerified'] is False and inventory['frameParity'] is False
assert inventory['source'] == {'repository': 'Kengxxiao/ArknightsGameData', 'commit': 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add',
    'clientVersion': '2.7.71', 'resourceVersion': h['versionId'], 'baseURL': base,
    'manifestBytes': len(manifest_bytes), 'manifestSha256': manifest_sha, 'manifestURL': base + 'hot_update_list.json'}
expected_paths = {'battle/enm_pfb_base_0.ab'} | {f'battle/enm_pfb_{i}.ab' for i in range(36)}
native_paths = {x['name'] for x in h['abInfos'] if re.fullmatch(r'battle/enm_pfb.*\.ab', x['name'])}
assert expected_paths == native_paths
assert len(inventory['bundles']) == 37 and {b['path'] for b in inventory['bundles']} == expected_paths
assert inventory['summary'] == {'bundles': 37, 'bytes': 13446842}

def normalize(v, key=''):
    if isinstance(v, dict): return {k: normalize(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [normalize(x, key) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

def fingerprint(v):
    return hashlib.sha256(json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

def resolve(p):
    assert p['m_FileID'] == 0
    return p['m_PathID']

seen = set()
summary = {'bundles': 37, 'prefabs': 0, 'hierarchyObjects': 0, 'components': 0,
           'clockComponents': 0, 'slowDownYes': 0, 'slowDownNo': 0}
for b in inventory['bundles']:
    entry = next(x for x in h['abInfos'] if x['name'] == b['path'])
    raw = (c / 'bundles' / entry['name']).read_bytes()
    assert len(raw) == entry['abSize'] and hashlib.md5(raw).hexdigest() == entry['md5']
    archive = entry['name'].replace('/', '_').removesuffix('.ab') + '.dat'
    assert fingerprint(b) == fingerprint({'path': entry['name'], 'bytes': len(raw), 'md5': entry['md5'], 'archive': archive,
                 'url': base + archive, 'sha256': hashlib.sha256(raw).hexdigest()})
    objects = {o.path_id: o for o in UnityPy.load(raw).objects}
    game_objects = {pid: o.read_typetree() for pid, o in objects.items() if o.type.name == 'GameObject'}
    transforms = {pid: o.read_typetree() for pid, o in objects.items() if o.type.name == 'Transform'}
    behaviours = {pid: o.read_typetree() for pid, o in objects.items() if o.type.name == 'MonoBehaviour'}
    by_go = {}
    for tid, tr in transforms.items():
        gid = resolve(tr['m_GameObject']); assert gid not in by_go
        by_go[gid] = tid
    assert set(by_go) == set(game_objects)
    chains = {}
    for gid in game_objects:
        chain, current = [], gid
        while current:
            assert current not in chain
            chain.append(current); father = resolve(transforms[by_go[current]]['m_Father'])
            current = resolve(transforms[father]['m_GameObject']) if father else 0
        chains[gid] = list(reversed(chain))
    roots = [(name, resolve(v['asset'])) for o in objects.values() if o.type.name == 'AssetBundle'
             for name, v in o.read_typetree()['m_Container']]
    for name, root in roots:
        assert name.startswith('dyn/battle/prefabs/enemies/') and name.endswith('.prefab') and name not in seen
        seen.add(name); assert chains[root] == [root]
        assert name in r['prefabs']
        declared = r['prefabs'][name]
        assert set(declared) == {'bundle', 'rootPathId', 'rootName', 'hierarchyObjects', 'components', 'hierarchySha256', 'clockComponents'}
        members = sorted(gid for gid in game_objects if chains[gid][0] == root)
        hierarchy, clocks = [], []
        for gid in members:
            go, tid = game_objects[gid], by_go[gid]; tr = transforms[tid]
            children = [resolve(p) for p in tr['m_Children']]
            # Parent-derived membership must also agree with the original children array.
            assert len(set(children)) == len(children)
            assert set(children) == {t for t, data in transforms.items() if resolve(data['m_Father']) == tid}
            comps = [(resolve(p['component']), objects[resolve(p['component'])].type.name) for p in go['m_Component']]
            assert len({pid for pid, _ in comps}) == len(comps)
            assert [p for p, typ in comps if typ == 'Transform'] == [tid]
            hierarchy.append([str(gid), go['m_Name'], str(tid), str(resolve(tr['m_Father'])),
                              [str(p) for p in children], [[str(p), typ] for p, typ in comps]])
            for pid, typ in comps:
                if typ != 'MonoBehaviour': continue
                data = behaviours[pid]; assert resolve(data['m_GameObject']) == gid
                selected = {k: normalize(v, k) for k, v in data.items() if k in fields}
                if not selected: continue
                if '_affectedBySlowDown' in selected:
                    assert selected['_affectedBySlowDown'] in [0, 1]
                    summary['slowDownYes' if selected['_affectedBySlowDown'] else 'slowDownNo'] += 1
                clocks.append({'pathId': str(pid), 'gameObjectPathId': str(gid), 'objectName': go['m_Name'],
                    'ancestors': [str(p) for p in chains[gid][:-1]], 'script': normalize(data['m_Script']),
                    'originalDataSha256': fingerprint(normalize(data)), 'fields': selected})
        assert fingerprint(declared) == fingerprint({'bundle': b['path'], 'rootPathId': str(root), 'rootName': game_objects[root]['m_Name'],
            'hierarchyObjects': len(hierarchy), 'components': sum(len(n[-1]) for n in hierarchy),
            'hierarchySha256': fingerprint(hierarchy), 'clockComponents': sorted(clocks, key=lambda x: int(x['pathId']))})
        summary['prefabs'] += 1; summary['hierarchyObjects'] += len(hierarchy)
        summary['components'] += sum(len(n[-1]) for n in hierarchy); summary['clockComponents'] += len(clocks)
    print('Verified', b['path'], len(roots), 'original prefab hierarchies and timing records', flush=True)
assert set(r['prefabs']) == seen and fingerprint(r['summary']) == fingerprint(summary)
print('Verified original timing metadata:', json.dumps(summary), '; runtime/controller dispatch remains unapproved')
