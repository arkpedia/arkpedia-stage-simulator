#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain selected target-cast loop/finish evidence; no runtime admission."""
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
standard, ability = v['types'][8752], v['types'][8742]
assert standard['name'] == 'AbilityStandard' and ability['name'] == 'Ability'
methods = []
for index, entry in [(54713, 0x3908b40), (54717, 0x3908800)]:
    row = c['unique'](lambda r: r['index'] == index, standard['methods'])
    record = c['method'](standard, row)
    assert record['entryRva'] == entry
    methods.append(record)
assert methods[0] == c['unique'](lambda m: m['index'] == 54713, json.loads(parent_raw)['methods'])
fields = []
for owner, name, offset in [(standard, 'm_castTargets', 0xd0), (standard, '_ignoreIfOwnerDead', 0xc8), (ability, 'm_owner', 0x48), (ability, 'm_isCasting', 0x58)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](owner))
    assert field['offset'] == offset
    fields.append({'declaringTypeIndex': owner['index'], **field})
slots = [c['resolved_slot'](standard, slot) for slot in [15, 62, 75]]
slots.append(c['resolved_slot'](v['types'][9969], 23))
assert [slot['name'] for slot in slots] == ['get_selector', 'FinishIfNot', 'OnCastOnTarget', 'OnCastedOnTarget']
signatures = []
for ti, index in [(8752, 54713), (8752, 54695), (8742, 54638), (9969, 65696)]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    args = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        args.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    return_type = v['sint'](v['m'], pos + 8)
    return_pos = v['offset'](v['quad'](v['b'], v['type_table'] + return_type * 8))
    signatures.append({'declaringTypeIndex': ti, 'index': index, 'parameters': args, 'returnKind': (v['uint'](v['b'], return_pos + 8) >> 16) & 255})
assert [arg['name'] for arg in signatures[0]['parameters']] == ['actions', 'buffs', 'attachments']
assert [arg['name'] for arg in signatures[1]['parameters']] == ['target', 'actions', 'buffs', 'attachments']
assert [arg['name'] for arg in signatures[2]['parameters']] == ['reason', 'resetCd']
assert [arg['name'] for arg in signatures[3]['parameters']] == ['target']
assert [signature['returnKind'] for signature in signatures] == [2, 1, 2, 1]
selector_return_index = v['sint'](v['m'], v['method_start'] + 54566 * 32 + 8)
selector_return = v['offset'](v['quad'](v['b'], v['type_table'] + selector_return_index * 8))
assert v['quad'](v['b'], selector_return) == 9969 and (v['uint'](v['b'], selector_return + 8) >> 16) & 255 == 18
loads = []
for rva, index in [(0x3908c22, 242455), (0x3908c43, 257548), (0x3908c6d, 242455), (0x3908c8b, 253210), (0x390889d, 257551)]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('4c8b0d'), bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    if index == 242455:
        assert struct.unpack_from('<iii', v['b'], p['spec_start'] + index * 12) == (224977, 6273, -1)
        table = v['offset'](v['quad'](v['b'], v['registration'] + 24))
        inst = v['offset'](v['quad'](v['b'], table + 6273 * 8))
        assert v['quad'](v['b'], inst) == 1
        arg = v['offset'](v['quad'](v['b'], v['offset'](v['quad'](v['b'], inst + 8))))
        assert (v['uint'](v['b'], arg + 8) >> 16) & 255 == 21
        generic = v['offset'](v['quad'](v['b'], arg))
        definition_type = v['offset'](v['quad'](v['b'], generic))
        assert v['quad'](v['b'], definition_type) == 1324 and (v['uint'](v['b'], definition_type + 8) >> 16) & 255 == 17
        inner = v['offset'](v['quad'](v['b'], generic + 8))
        assert v['quad'](v['b'], inner) == 1
        element = v['offset'](v['quad'](v['b'], v['offset'](v['quad'](v['b'], inner + 8))))
        assert v['quad'](v['b'], element) == 9044 and (v['uint'](v['b'], element + 8) >> 16) & 255 == 18
        spec = {'index': index, 'definitionIndex': 224977, 'declaringTypeIndex': 38190, 'name': 'get_Item', 'classInstantiationIndex': 6273,
            'nestedArgument': {'definitionIndex': 1324, 'name': 'ObjectPtr`1', 'argumentTypeIndex': 9044}, 'nativeMapping': p['mapping'].get(index)}
    else:
        spec = p['specification'](index)
        assert spec['definition']['name'] == ('Lock' if index == 253210 else 'ValidAndAlive')
    assert spec['nativeMapping'] is None
    loads.append({'loadRva': rva, 'encodedUsage': usage, 'specification': spec})
result = {'schemaVersion': 1, 'scope': 'Selected default AbilityStandard.DoCastOnTargets and CheckFinished; no launch or stage admission.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False, 'nativeFiles': v['pin']['files'],
    'sources': {parent_path: {'path': parent_path, 'sha256': v['sha'](parent_raw)}}, 'methods': methods, 'fields': fields, 'virtualSlots': slots, 'signatures': signatures, 'metadataLoads': loads,
    'selectorType': {'returnTypeIndex': selector_return_index, 'definitionIndex': 9969, 'name': 'TargetSelector'},
    'targetCasting': {'targetsReadRva': 0x3908bf5, 'countReadRva': 0x3908c10, 'firstItemCallRva': 0x3908c34, 'validAndAliveCallRva': 0x3908c50,
        'targetsRereadRva': 0x3908c5d, 'secondItemCallRva': 0x3908c7c, 'lockCallRva': 0x3908c98, 'castFlagWriteRva': 0x3908cb8, 'castCallRva': 0x3908cbb,
        'firstSelectorCallRva': 0x3908cc8, 'selectorValidityCallRva': 0x3908ced, 'secondSelectorCallRva': 0x3908cfe, 'notifySelectorCallRva': 0x3908d13,
        'finishedCallRva': 0x3908d1d, 'nextTargetsReadRva': 0x3908d26},
    'finished': {'castingReadRva': 0x3908884, 'ownerCopyRva': 0x3908899, 'ignoreOwnerDeadReadRva': 0x39088a9,
        'ownerValidityCallRva': 0x39088b5, 'resetCooldownArgumentRva': 0x39088cb, 'finishReasonRva': 0x39088d1, 'finishCallRva': 0x39088d5, 'finishReason': 2, 'resetCd': False},
    'nativeTargetListEffectsVerified': False, 'nativePointerAndValidityEffectsVerified': False, 'nativeSelectorAndFinishEffectsVerified': False, 'liveTargetCastingVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-target-casting-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static target casting evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified complete target-cast loop and finish check with image-bound slots and nested pointer-list metadata')
