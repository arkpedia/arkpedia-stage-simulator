#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain inner initialization/reset and delayed-birth default sequencing."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-source.json',
         'data/candidates/arkpedia-windows-fear-projectile-init-source.json', 'data/candidates/arkpedia-ch16-fear-projectile-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
parent = json.loads(raws[paths[1]])
methods = []
for index, entry in [(62170, 0x67ccc0), (62126, 0x67e7c0), (62212, 0x67ca30)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][9558]['methods'])
    record = c['method'](v['types'][9558], row)
    assert record['entryRva'] == entry
    methods.append(record)
for method in methods[:2]:
    assert method == c['unique'](lambda r: r['index'] == method['index'], parent['methods'])
slots = [c['resolved_slot'](v['types'][9559], slot) for slot in [47, 48, 49, 50]]
assert [slot['name'] for slot in slots] == ['GetLifeTime', 'GetMaxHitNum', 'GetKeepAlreadyHitTime', 'OnProjectileBorn']
hit = c['type_row']('HitBehaviour', 'Torappu.Battle.Projectiles')
behaviour = c['resolved_slot'](hit, 4)
assert behaviour['name'] == 'Init'
names = ['<currentTime>k__BackingField', 'm_currentHitNum', 'm_isEliminated', 'm_hasReached', 'm_isStopped', 'm_hasHitTraceTarget',
         'm_targetsAlreadyHit', 'm_eventCallbacks', 'm_lifeTime', 'm_maxHitNum', 'm_keepAlreadyHitTime', '_bodyTransform',
         'm_behaviours', 'm_behavioursInited', '_randomDelayToBorn']
fields = [c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][9558])) for name in names]
assert [f['offset'] for f in fields] == [0x158, 0xa8, 0xa5, 0xa6, 0xa4, 0xa7, 0x150, 0x90, 0x98, 0xa0, 0xb0, 0x40, 0x140, 0x148, 0x38]
direct = []
for ti, index, entry, image in [(9558, 62172, 0x67bc40, 'Assembly-CSharp.dll'), (9558, 62226, 0x67d200, 'Assembly-CSharp.dll'),
                                (8911, 55912, 0x3992430, 'Assembly-CSharp.dll'), (8911, 55940, 0x3993a40, 'Assembly-CSharp.dll'),
                                (8911, 55941, 0x3993b70, 'Assembly-CSharp.dll'), (8861, 55615, 0x39568e0, 'Assembly-CSharp.dll'),
                                (34370, 196260, 0x5a3da10, 'Torappu.Common.dll'), (34370, 196255, 0x5a3da20, 'Torappu.Common.dll'),
                                (34368, 196139, 0x5a41aa0, 'Torappu.Common.dll'), (34368, 196119, 0x5a41290, 'Torappu.Common.dll'),
                                (42186, 262266, 0x5ea5ba0, 'UnityEngine.CoreModule.dll'), (42193, 262372, 0x5eb6b60, 'UnityEngine.CoreModule.dll')]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    mod = c['module'](image)
    assert mod['typeStart'] <= ti < mod['typeStart'] + mod['typeCount']
    table = v['offset'](v['image_base'] + mod['methodPointerTableRva'])
    assert v['quad'](v['b'], table + ((row['token'] & 0xffffff) - 1) * 8) - v['image_base'] == entry
    direct.append({'image': image, 'moduleRva': mod['rva'], 'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})


def usage_at(rva):
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    return v['quad'](v['b'], v['offset'](v['image_base'] + address))


clear_usage = usage_at(0x67ce24)
assert clear_usage >> 29 == 6 and (clear_usage & 0x1ffffffe) >> 1 == 222548
definition, inst_index, method_inst = struct.unpack_from('<iii', v['b'], p['spec_start'] + 222548 * 12)
assert (definition, inst_index, method_inst) == (224844, 2426, -1)
owner, method = c['unique'](lambda pair: pair[1]['index'] == definition, [(t, r) for t in v['types'] for r in t['methods']])
assert owner['name'] == 'Dictionary`2' and method['name'] == 'Clear'
table = v['offset'](v['quad'](v['b'], v['registration'] + 24))
inst = v['offset'](v['quad'](v['b'], table + inst_index * 8))
assert v['quad'](v['b'], inst) == 2
args = v['offset'](v['quad'](v['b'], inst + 8))
argument_types = []
for n in range(2):
    tp = v['offset'](v['quad'](v['b'], args + n * 8))
    argument_types.append({'data': v['quad'](v['b'], tp), 'bits': v['uint'](v['b'], tp + 8)})
assert p['mapping'].get(222548) is None
random = c['unique'](lambda r: struct.unpack_from('<H', v['m'], v['method_start'] + r['index'] * 32 + 28)[0] == 8, v['types'][9515]['methods'])
assert random['name'] == 'Range'
callback_usage = usage_at(0x67d197)
assert callback_usage >> 29 == 3 and (callback_usage & 0x1ffffffe) >> 1 == 62212
graph = json.loads(raws[paths[3]])
prefab = 'dyn/battle/prefabs/[uc]projectiles/projectile_enemy_fearpj.prefab'
component = c['unique'](lambda r: r['pathId'] == '3827519080143594587', graph['projectiles'][prefab])
assert v['sha'](component['originalJson'].encode()) == component['sha256']
bridge = c['unique'](lambda r: r['componentPathId'] == component['pathId'], parent['prefabScriptBridges'])
assert bridge['componentSha256'] == component['sha256'] and bridge['scriptIdentity']['m_ClassName'] == 'SimpleProjectile'
data = json.loads(component['originalJson'])
selected = {name: data[name] for name in ['_randomDelayToBorn', '_managedBySource', '_keepAlreadyHitTime', '_lifeTime', '_lifeTimeType', '_hitNumType', '_maxHitNum']}
assert selected == {'_randomDelayToBorn': 0.0, '_managedBySource': 0, '_keepAlreadyHitTime': -1.0, '_lifeTime': 10.0, '_lifeTimeType': 1, '_hitNumType': 2, '_maxHitNum': 1}
result = {'schemaVersion': 1, 'scope': 'Default inner Init/reset/delayed-birth sequencing; native collection, behavior, random and scheduler effects remain explicit.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
    'methods': methods, 'virtualSlots': slots, 'behaviourSlot': behaviour, 'fields': fields, 'directCalls': direct,
    'dictionaryClear': {'loadRva': 0x67ce24, 'encodedUsage': clear_usage, 'index': 222548, 'definition': method, 'declaringTypeIndex': owner['index'], 'classInstantiationIndex': inst_index, 'argumentTypes': argument_types, 'nativeMapping': None},
    'randomInterface': {'typeIndex': 9515, 'name': 'IBattleRandom', 'slot': 8, 'method': random},
    'callback': {'loadRva': 0x67d197, 'encodedUsage': callback_usage, 'methodIndex': 62212},
    'fearComponent': {'prefab': prefab, 'pathId': component['pathId'], 'sha256': component['sha256'], 'selectedFields': selected},
    'reset': {'clockCall': 0x67cdf4, 'clearCall': 0x67ce2b, 'callbackWrite': 0x67ce6f, 'callbackArrayReread': 0x67ce77},
    'init': {'lifeCall': 0x67cec5, 'maxHitCall': 0x67cf14, 'keepCall': 0x67cf41, 'traceCall': 0x67cfa4,
        'behaviourCall': 0x67d01b, 'behaviourArrayReread': 0x67d022, 'behavioursFlag': 0x67d039, 'outerCall': 0x67d043,
        'deterministicCall': 0x67d05f, 'randomImpCall': 0x67d07f, 'randomTrivialCall': 0x67d096,
        'zeroCall': 0x67d0bd, 'rangeMaximumRead': 0x67d0cb, 'rangeCall': 0x67d0f1, 'greaterThanCall': 0x67d117,
        'immediateBornCall': 0x67d13d, 'deactivateCall': 0x67d17e, 'delayCall': 0x67d1ba},
    'nativeCollectionsVerified': False, 'nativeBehaviourInitVerified': False, 'nativeTraceAndOuterSettingsVerified': False,
    'nativeRandomAndMathEffectsVerified': False, 'nativeSchedulerAndUnityEffectsVerified': False, 'nativeBornEffectsVerified': False,
    'hotfixDispatchVerified': False, 'liveInnerInitVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-inline-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile inner-Init evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified complete inner Init/reset/delayed-birth bodies and concrete Fear configuration')
