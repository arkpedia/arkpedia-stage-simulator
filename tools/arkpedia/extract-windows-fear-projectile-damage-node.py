#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default ordinary/cached ranged damage-node construction."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-source.json',
         'data/candidates/arkpedia-ch16-fear-projectile-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
parent = json.loads(raws[paths[1]])
methods = []
for ti, index, entry in [(11695, 80008, 0xbfbab0), (11775, 80975, 0xc1df30), (12811, 86251, 0xd7a420),
                         (12108, 84017, 0xce98c0), (12812, 86259, 0xd79770), (11695, 79987, 0xbfcdc0),
                         (11654, 79489, 0xbd4050), (11654, 79490, 0xbd41e0)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    method = c['method'](v['types'][ti], row)
    assert method['entryRva'] == entry
    if index in [80008, 80975, 86251]:
        assert method == c['unique'](lambda r: r['index'] == index, parent['methods'])
    methods.append(method)
fields = []
for ti, name, offset in [(11695, '_useCachedAtkOnly', 0x23a), (11695, '_transferSource', 0x23b),
                         (11654, '_attackType', 0x1d8), (11654, '_useDynamicAttackType', 0x1e4),
                         (12811, '_damageType', 0x10), (12811, '_applyWay', 0x14), (12811, '_attackType', 0x18),
                         (12811, '_useDynamicAttackType', 0x1c), (12811, '_modifierKey', 0x20),
                         (12811, 'm_cachedAtk', 0x28), (12811, 'm_atkScale', 0x30), (12812, '_transferSource', 0x40)]:
    f = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert f['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **f})
slots = [c['resolved_slot'](v['types'][11695], slot) for slot in [23, 102, 103, 106]]
assert [s['name'] for s in slots] == ['get_applyWay', 'get_attackType', 'get_useDynamicAttackType', 'NewDamageNode']
signatures = []
for index in [80008, 80975, 86251, 86259]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    signatures.append({'index': index, 'parameters': parameters})
assert [len(s['parameters']) for s in signatures] == [2, 2, 6, 6]
string_loads = []
for rva in [0xc1e021, 0xd7a48a, 0xd797c7, 0xd79813]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b0d'), bytes.fromhex('488b05')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 1
    ti = (usage & 0x1ffffffe) >> 1
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    definition = v['quad'](v['b'], tp)
    t = v['types'][definition]
    assert (t['namespace'], t['name']) == ('System', 'String')
    empty = c['unique'](lambda f: f['name'] == 'Empty', c['fields'](t))
    assert empty['offset'] == 0 and empty['typeBits'] & 16
    string_loads.append({'loadRva': rva, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': definition, 'emptyField': empty})
graph = json.loads(raws[paths[2]])
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
component = c['unique'](lambda r: r['pathId'] == '4729572091462136098', graph['prefabs'][prefab])
native = json.loads(component['originalJson'])
selected = {key: native[key] for key in ['_useCachedAtkOnly', '_transferSource', '_attackType', '_useDynamicAttackType', '_damageType', '_atkScale']}
assert selected == {'_useCachedAtkOnly': 0, '_transferSource': 0, '_attackType': 1, '_useDynamicAttackType': 0, '_damageType': 2, '_atkScale': 1.0}
result = {'schemaVersion': 1, 'scope': 'Default ranged/base NewDamageNode, ordinary/cached constructors, ActionNode constructor and three getters; native allocation and live dispatch held.',
          'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
          'methods': methods, 'fields': fields, 'virtualSlots': slots, 'signatures': signatures, 'stringLoads': string_loads,
          'fearComponent': {'prefab': prefab, 'pathId': component['pathId'], 'sha256': v['sha'](component['originalJson'].encode()), 'selectedFields': selected},
          'nativeAllocationAndZeroingVerified': False, 'nativeStringAndBarrierEffectsVerified': False,
          'nativeObjectConstructorEffectsVerified': False, 'hotfixDispatchVerified': False, 'liveDamageNodeConstructionVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-damage-node-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile damage-node construction evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified ordinary/cached damage construction, property slots and canonical Fear branch')
