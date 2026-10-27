#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default controller/factory creation and graphic attachment ordering."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
parent_path = 'data/candidates/arkpedia-windows-cast-lifecycle-source.json'
parent_raw = (ROOT / parent_path).read_bytes()
assert parent_raw.decode() == c['serialized']
launch_path = 'data/candidates/arkpedia-windows-fear-projectile-launch-source.json'
launch_raw = (ROOT / launch_path).read_bytes()
launch = json.loads(launch_raw)
assert launch['sources'][parent_path]['sha256'] == v['sha'](parent_raw)
methods = []
for ti, index, entry in [(8911, 56170, 0x3975090), (9572, 62445, 0x6a75e0), (9558, 62173, 0x677920)]:
    owner = v['types'][ti]
    row = c['unique'](lambda r: r['index'] == index, owner['methods'])
    record = c['method'](owner, row)
    assert record['entryRva'] == entry
    methods.append(record)
assert launch['directCalls'][2]['index'] == methods[0]['index']
slots = [c['resolved_slot'](v['types'][9044], slot) for slot in [89, 90, 107]]
assert [s['name'] for s in slots] == ['GetEffectReplacePairs', 'GetMountPoint', 'TryHookProjectile']
fields = []
for ti, name, offset in [(8911, '_factory', 0x38), (9572, '_projectileFolder', 0x40), (9558, 'm_graphicProjectile', 0xd8), (9558, 'm_type', 0xc8)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert field['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **field})
type_enum = c['enum'](v['types'][9550])
assert sorted(f['value'] for f in type_enum['fields']) == [0, 1, 2]
signatures = []
for index in [56170, 58041, 62167, 62173, 62445, 57961]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        ti = v['sint'](v['m'], pp + 8)
        tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': ti, 'typeData': v['quad'](v['b'], tp), 'typeBits': v['uint'](v['b'], tp + 8)})
    ti = v['sint'](v['m'], pos + 8)
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    signatures.append({'index': index, 'parameters': parameters, 'returnKind': (v['uint'](v['b'], tp + 8) >> 16) & 255})
assert [p['name'] for p in signatures[1]['parameters']] == ['originProjectile', 'graphicProjectileKey', 'logicProjectile', 'muzzlePoint']
assert all(p['typeBits'] & 0x20000000 for p in signatures[1]['parameters'][1:])
assert [p['name'] for p in signatures[2]['parameters']] == ['key', 'start', 'target', 'ability', 'type', 'originalKey', 'effectReplacePairs']
direct = []
for ti, index, entry, image in [(9558, 62167, 0x678950, 'Assembly-CSharp.dll'),
                                (34457, 196939, 0x5a72880, 'Torappu.Common.dll'),
                                (42186, 262265, 0x5ea5c30, 'UnityEngine.CoreModule.dll'),
                                (42219, 262551, 0x5ebec60, 'UnityEngine.CoreModule.dll'),
                                (42219, 262552, 0x5ebee90, 'UnityEngine.CoreModule.dll'),
                                (42263, 262856, 0x5ecf900, 'UnityEngine.CoreModule.dll'),
                                (42263, 262852, 0x5ed1500, 'UnityEngine.CoreModule.dll')]:
    owner = v['types'][ti]
    row = c['unique'](lambda r: r['index'] == index, owner['methods'])
    module = c['module'](image)
    assert module['typeStart'] <= ti < module['typeStart'] + module['typeCount']
    table = v['offset'](v['image_base'] + module['methodPointerTableRva'])
    assert v['quad'](v['b'], table + ((row['token'] & 0xffffff) - 1) * 8) - v['image_base'] == entry
    direct.append({'image': image, 'moduleRva': module['rva'], 'declaringTypeIndex': ti, 'declaringType': owner['name'], **row, 'entryRva': entry})


def usage_at(rva):
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b0d'), bytes.fromhex('488b15')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    return v['quad'](v['b'], v['offset'](v['image_base'] + address))


pool_usage = usage_at(0x6a76b1)
assert pool_usage >> 29 == 6 and (pool_usage & 0x1ffffffe) >> 1 == 270518
pool = p['specification'](270518)
assert pool['definition']['name'] == 'Allocate' and pool['declaringType'] == 'PoolManager'
assert pool['instantiations']['method']['arguments'][0]['typeIndex'] == 9558 and pool['nativeMapping'] is None
literals = []
for rva in [0x6a7687, 0x3975386]:
    usage = usage_at(rva)
    assert usage >> 29 == 5
    index = (usage & 0x1ffffffe) >> 1
    length, offset = struct.unpack_from('<II', v['m'], v['uint'](v['m'], 8) + index * 8)
    raw = v['m'][v['uint'](v['m'], 16) + offset:v['uint'](v['m'], 16) + offset + length]
    literals.append({'loadRva': rva, 'encodedUsage': usage, 'index': index, 'sha256': v['sha'](raw), 'value': raw.decode()})
assert literals[0]['value'] == 'battle/prefabs/[uc]projectiles'
one_usage = usage_at(0x6a7741)
assert one_usage >> 29 == 1
one_type_index = (one_usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + one_type_index * 8))
one_type = v['types'][v['quad'](v['b'], tp)]
assert one_type['name'] == 'Vector3'
one_field = c['unique'](lambda f: f['offset'] == 12 and f['typeBits'] & 16, c['fields'](one_type))
assert one_field['name'] == 'oneVector'
result = {'schemaVersion': 1, 'scope': 'Default BattleController/BattleFactory projectile creation and graphic attachment; Init, pool and Unity effects remain explicit.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in [(parent_path, parent_raw), (launch_path, launch_raw)]},
    'methods': methods, 'fields': fields, 'virtualSlots': slots, 'projectileTypeEnum': type_enum, 'signatures': signatures, 'directCalls': direct,
    'poolAllocation': {'loadRva': 0x6a76b1, 'encodedUsage': pool_usage, 'specification': pool}, 'literals': literals,
    'oneVector': {'loadRva': 0x6a7741, 'encodedUsage': one_usage, 'typeIndex': one_type_index, 'definitionIndex': one_type['index'], 'field': one_field},
    'creation': {'sourceNullCall': 0x3975165, 'effectReplacePairsCall': 0x39751a1, 'sourceValidityCall': 0x39751c3, 'hookCall': 0x397521a,
        'logicAllocateCall': 0x397523a, 'graphicAllocateCall': 0x3975257, 'graphicOutWrite': 0x397526a,
        'logicInitCall': 0x3975325, 'graphicInitCall': 0x3975361, 'attachCall': 0x397536f,
        'normalAllocateCall': 0x39753cc, 'normalInitCall': 0x3975435, 'normalOutClear': 0x3975444},
    'factory': {'combineCall': 0x6a7694, 'allocateCall': 0x6a76bb, 'nullCheckCall': 0x6a76e0,
        'transformCalls': [0x6a76fb, 0x6a771d], 'parentCall': 0x6a7713, 'scaleCall': 0x6a7771},
    'attach': {'fieldWrite': 0x677970, 'barrierTailCall': 0x67797d},
    'nativePoolEffectsVerified': False, 'nativeProjectileInitVerified': False, 'nativeUnityEffectsVerified': False,
    'nativeHookEffectsVerified': False, 'nativeGCBarrierEffectsVerified': False, 'hotfixDispatchVerified': False, 'liveControllerCreationVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-controller-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile-controller evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified controller/factory birth ordering, graphic attachment, hook enum and cross-image transform calls')
