#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default attack-data scale loading and action-list construction."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-source.json',
         'data/candidates/arkpedia-windows-fear-self-death-source.json', 'data/candidates/arkpedia-windows-fear-projectile-damage-node-source.json',
         'data/candidates/arkpedia-ch16-fear-projectile-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
methods = []
for ti, index, entry in [(11654, 79497, 0xbd3550), (11775, 80974, 0xc1d570), (12560, 85489, 0xd32bb0),
                         (10269, 68588, 0x876e30), (11695, 79988, 0xbfce20), (11695, 79989, 0xbfcee0)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    method = c['method'](v['types'][ti], row)
    assert method['entryRva'] == entry
    methods.append(method)
fields = []
for ti, name, offset in [(11654, '_atkScale', 0x1c8), (11654, '_atkScaleKey', 0x1d0), (11654, '_epDamageRatio', 0x1e0),
                         (11654, 'm_atkScale', 0x1e8), (11654, 'm_epDamageRatio', 0x1f0), (11654, 'm_actions', 0x1f8),
                         (11654, '_elementDamageType', 0x1dc), (11654, 'm_elementDamageType', 0x200),
                         (11775, 'm_damageNode', 0x1b8), (11695, '_damageType', 0x220), (11695, '_extraDamageType', 0x234)]:
    f = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert f['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **f})
slots = [c['resolved_slot'](v['types'][11695], slot) for slot in [105, 106, 107, 111, 112]]
assert [s['name'] for s in slots] == ['CreateDamageNode', 'NewDamageNode', 'CreateElementDamageNode', 'get_damageType', 'get_extraDamageType']
rva = 0xbd36fb
pos = v['offset'](v['image_base'] + rva)
address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
assert usage >> 29 == 5
index = (usage & 0x1ffffffe) >> 1
length, start = struct.unpack_from('<II', v['m'], v['uint'](v['m'], 8) + index * 8)
literal = v['m'][v['uint'](v['m'], 16) + start:v['uint'](v['m'], 16) + start + length].decode()
assert literal == 'ep_damage_ratio'
pos = v['offset'](v['image_base'] + 0xbd3688)
address = 0xbd3688 + 8 + struct.unpack_from('<i', v['b'], pos + 4)[0]
assert struct.unpack_from('<f', v['b'], v['offset'](v['image_base'] + address))[0] == 1.0
parent = json.loads(raws[paths[2]])
math = [row for row in parent['modeSwitch']['buffNotification']['resetTiming']['math'] if row['entryRva'] in [0x5a5c940, 0x51df0c0]]
assert len(math) == 2
assert math[0]['chunks'] == c['code'](0x5a5c940)
direct = []
for ti, index, entry in [(8752, 54678, 0x3909480), (8742, 54558, 0x3910ac0), (3918, 28634, 0x2166630)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})
signatures = []
for index in [79497, 80974, 28634]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    signatures.append({'index': index, 'parameters': parameters})
assert [p['name'] for p in signatures[0]['parameters']] == ['owner', 'options']
graph = json.loads(raws[paths[4]])
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
component = c['unique'](lambda r: r['pathId'] == '4729572091462136098', graph['prefabs'][prefab])
native = json.loads(component['originalJson'])
selected = {key: native[key] for key in ['_atkScale', '_atkScaleKey', '_epDamageRatio', '_elementDamageType', '_damageType', '_extraDamageType']}
assert selected == {'_atkScale': 1.0, '_atkScaleKey': 'atk_scale', '_epDamageRatio': 0.0, '_elementDamageType': 0, '_damageType': 2, '_extraDamageType': 0}
result = {'schemaVersion': 1, 'scope': 'Default AbstractBasicAttack.DoSetData, CreateDamageNode, AlwaysNext constructor, scale merge and ranged damage getters; base data and native collection effects held.',
          'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
          'methods': methods, 'fields': fields, 'virtualSlots': slots, 'signatures': signatures, 'math': math, 'directCalls': direct,
          'ratioKey': {'loadRva': rva, 'encodedUsage': usage, 'value': literal, 'sha256': v['sha'](literal.encode())},
          'fearComponent': {'prefab': prefab, 'pathId': component['pathId'], 'sha256': v['sha'](component['originalJson'].encode()), 'selectedFields': selected},
          'nativeBaseDataEffectsVerified': False, 'nativeOptionsCopyEffectsVerified': False, 'nativeBlackboardEffectsVerified': False,
          'nativeCollectionAndElementEffectsVerified': False, 'hotfixDispatchVerified': False, 'liveAttackDataVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-attack-data-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile attack-data evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified attack-data scale loading, action-list construction and native node publication')
