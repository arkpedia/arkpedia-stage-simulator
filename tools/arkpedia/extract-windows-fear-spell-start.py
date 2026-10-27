#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Bind the selected default spell-start orchestration; no runtime admission."""
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
standard, ability, entity, context = [v['types'][i] for i in [8752, 8742, 9044, 8960]]
assert [t['name'] for t in [standard, ability, entity, context]] == ['AbilityStandard', 'Ability', 'Entity', 'Context']
row = c['unique'](lambda r: r['index'] == 54700, standard['methods'])
method = c['method'](standard, row)
assert method['entryRva'] == 0x390bb10
assert method == c['unique'](lambda r: r['index'] == 54700, json.loads(parent_raw)['methods'])
slots = [c['resolved_slot'](c['ranged'] if slot in [44, 74] else standard, slot)
         for slot in [18, 44, 46, 62, 70, 73, 74, 81, 87, 93, 96, 97]]
slots.append(c['resolved_slot'](entity, 133))
assert [s['name'] for s in slots] == ['get_allowNoTarget', 'GetActiveBuffs', 'GetAbilityAttachments', 'FinishIfNot',
    'get_onlyTrigAudioSignalForFirstSpell', 'OnEvent', 'GetEventActions', 'DoOnHasNoTarget', 'DoCastOnTargets',
    'DoEmitAudioSignalForSpellOn', 'OnOutputAttackOrHeal', 'OnOutputAttackOrHealEachSpell', 'CanDoAbilitySpellOn']
direct = []
for owner, index, name, entry in [(ability, 54565, 'get_context', 0x3910b80), (standard, 54670, 'get_spellCnt', 0x390dc30),
                                  (entity, 58112, 'OnAbilitySpellOn', 0x3a1e320)]:
    r = c['unique'](lambda r: r['index'] == index, owner['methods'])
    assert r['name'] == name and v['pointer'](r) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': owner['index'], **r, 'entryRva': entry})
fields = []
for owner, name, offset in [(ability, 'm_owner', 0x48), (standard, '_ignoreIfOwnerDead', 0xc8),
                            (standard, 'm_inputTarget', 0xd8), (standard, 'm_isDmgOrHealAbility', 0x100),
                            (context, 'm_source', 0x10), (context, 'm_ability', 0x28), (context, 'm_mainTarget', 0x50)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](owner))
    assert field['offset'] == offset
    fields.append({'declaringTypeIndex': owner['index'], **field})


def selected_type(address, depth=0):
    # Bounded decoder for this field's KeyValuePair<Vector2,ObjectPtr<Entity>>.
    assert depth <= 2
    tp = v['offset'](address)
    data, bits = v['quad'](v['b'], tp), v['uint'](v['b'], tp + 8)
    kind = (bits >> 16) & 255
    if kind in [17, 18]:
        assert data < len(v['types'])
        return {'definitionIndex': data, 'name': v['types'][data]['name'], 'kind': kind, 'byRef': bool(bits & 0x20000000)}
    assert kind == 21
    generic = v['offset'](data)
    definition = selected_type(v['quad'](v['b'], generic), depth + 1)
    inst = v['offset'](v['quad'](v['b'], generic + 8))
    count = v['quad'](v['b'], inst)
    assert count in [1, 2]
    args = v['offset'](v['quad'](v['b'], inst + 8))
    return {'definition': definition, 'arguments': [selected_type(v['quad'](v['b'], args + n * 8), depth + 1) for n in range(count)]}


input_type = selected_type(v['quad'](v['b'], v['type_table'] + 16521 * 8))
assert input_type['definition']['definitionIndex'] == 38188
assert input_type['arguments'][0]['definitionIndex'] == 42145 and input_type['arguments'][0]['name'] == 'Vector2'
assert input_type['arguments'][1]['definition']['definitionIndex'] == 1324
assert input_type['arguments'][1]['arguments'][0]['definitionIndex'] == 9044
signatures = []
for index in [58140, 58112, 54700, 54638, 54688, 80000, 54701, 54713]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        ti = v['sint'](v['m'], pp + 8)
        tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': ti, 'typeBits': v['uint'](v['b'], tp + 8)})
    ti = v['sint'](v['m'], pos + 8)
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    signatures.append({'index': index, 'parameters': parameters, 'returnKind': (v['uint'](v['b'], tp + 8) >> 16) & 255})
assert [p['name'] for p in signatures[0]['parameters']] == ['ability', 'reason']
assert signatures[0]['parameters'][1]['typeBits'] & 0x20000000
assert [s['returnKind'] for s in signatures[:4]] == [2, 1, 2, 2]
loads = []
for rva, name in [(0x390bbee, 'ValidAndAlive'), (0x390bc27, 'Lock'), (0x390bc9e, 'Push'),
                  (0x390bccd, 'Push'), (0x390bd71, 'Lock'), (0x390bd8b, 'Push'),
                  (0x390bdcb, 'Pop'), (0x390bec4, 'Pop'), (0x390bef0, 'Pop')]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('4c8b05'), bytes.fromhex('488b15')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 6
    spec = p['specification']((usage & 0x1ffffffe) >> 1)
    assert spec['definition']['name'] == name and spec['nativeMapping'] is None
    loads.append({'loadRva': rva, 'encodedUsage': usage, 'specification': spec})
result = {'schemaVersion': 1, 'scope': 'Selected default AbilityStandard.OnSpellStart orchestration; callbacks and projectile construction remain explicit.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {parent_path: {'path': parent_path, 'sha256': v['sha'](parent_raw)}},
    'methods': [method], 'virtualSlots': slots, 'directCalls': direct, 'fields': fields, 'inputTargetType': input_type,
    'inputPointerCopyRva': 0x390bd61, 'inputPointerAbsoluteOffset': 0xe0, 'signatures': signatures, 'metadataLoads': loads,
    'nativeOwnerEffectsVerified': False, 'nativeVirtualEffectsVerified': False, 'liveSpellStartVerified': False,
    'event': 4, 'eventRunsActions': False, 'invalidOwnerFinishReason': 2, 'resetCd': False,
    'contextPushCalls': [0x390bca8, 0x390bcd7, 0x390bd98], 'contextPopCalls': [0x390bdd2, 0x390becb, 0x390bef7],
    'contextReadCalls': [0x390bc83, 0x390bcb2, 0x390bd53, 0x390bdb0, 0x390bea9, 0x390bed5],
    'castTargetsCallRva': 0x390be16, 'noTargetCallRva': 0x390be9c, 'outputCalls': [0x390be50, 0x390be7c],
    'damageFieldReads': [0x390be1b, 0x390be55], 'allowNoTargetCalls': [0x390be33, 0x390be6b],
    'defaultBodyHasExceptionCleanup': False, 'hotfixDispatchVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-spell-start-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static spell-start evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified complete default spell-start orchestration with owner, payload and context bindings')
