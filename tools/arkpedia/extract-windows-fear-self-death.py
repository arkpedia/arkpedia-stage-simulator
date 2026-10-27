#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain exact default action-chain evidence for event5's self-death buff."""
from pathlib import Path
import base64
import json
import runpy
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
nodes = c['type_row']('Nodes', 'Torappu.Battle.Action')
methods, fields = [], {}
for name in ['CheckAbnormalFlag', 'CheckAbnormalCombo', 'SwitchMode', 'CreateBuff', 'AlwaysNext', 'InstantKill']:
    t = c['type_row'](name, '')
    assert t['index'] in nodes['nested']
    fields[name] = c['fields'](t)
    methods.append(c['method'](t, c['unique'](lambda r: r['name'] == 'Execute', t['methods'])))
    if name == 'AlwaysNext':
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == 'get_executeCondition', t['methods'])))
base_node = c['type_row']('ActionNode', 'Torappu.Battle.Action')
methods.append(c['method'](base_node, c['unique'](lambda r: r['name'] == 'get_executeCondition', base_node['methods'])))
util = c['type_row']('ActionUtil', 'Torappu.Battle.Action')
for rva in [0xe43d80, 0xe44600, 0xe44890]:
    methods.append(c['method'](util, c['unique'](lambda r: v['pointer'](r) == v['image_base'] + rva, util['methods'])))
entity = c['type_row']('Entity', 'Torappu.Battle')
parameters = {}
for name in ['Suicide', 'SetHpInternal', 'get_alive']:
    row = c['unique'](lambda r: r['name'] == name, entity['methods'])
    methods.append(c['method'](entity, row))
    pos = v['method_start'] + row['index'] * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    assert v['uint'](v['m'], 92) % 12 == 0
    parameters[name] = []
    for index in range(count):
        pp = v['uint'](v['m'], 88) + (start + index) * 12
        parameters[name].append({'index': start + index, 'name': v['text'](v['uint'](v['m'], pp)),
                                'typeIndex': v['sint'](v['m'], pp + 8)})
assert [p['name'] for p in parameters['Suicide']] == ['noSource', 'skipReborn']
assert [p['name'] for p in parameters['SetHpInternal']] == ['value', 'force', 'noSource', 'skipReborn']
mode_methods, mode_parameters = [], []
for type_name, names in [('Unit', ['SwitchMode', 'ActivateMode', 'InactiveMode', 'OnSwitchMode']),
                         ('Enemy', ['OnSwitchMode'])]:
    t = c['type_row'](type_name, 'Torappu.Battle')
    for row in t['methods']:
        if row['name'] not in names:
            continue
        record = c['method'](t, row)
        methods.append(record)
        mode_methods.append(record['entryRva'])
        pos = v['method_start'] + row['index'] * 32
        start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
        args = []
        for index in range(count):
            pp = v['uint'](v['m'], 88) + (start + index) * 12
            args.append({'index': start + index, 'name': v['text'](v['uint'](v['m'], pp)),
                         'typeIndex': v['sint'](v['m'], pp + 8)})
        mode_parameters.append({'type': type_name, **row, 'entryRva': record['entryRva'], 'parameters': args})
graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
graph_raw = (ROOT / graph_path).read_bytes()
graph = json.loads(graph_raw)
template = graph['templates']['fearpj_m0_t[switch_to_die]']
assert v['sha'](template['originalJson'].encode()) == template['sha256']
original = json.loads(template['originalJson'])
events = original['eventToActions']['_items']
assert len(events) == 1 and events[0]['key'] == 0
actions = json.loads(events[0]['value']['SerializedState'])
assert [a['$type'].split('+')[-1] for a in actions] == [
    'CheckAbnormalFlag', 'CheckAbnormalFlag', 'CheckAbnormalFlag', 'CheckAbnormalCombo',
    'SwitchMode', 'CreateBuff', 'AlwaysNext', 'InstantKill']
bindings_path = 'data/candidates/arkpedia-ch16-script-bindings-source.json'
bindings = json.loads((ROOT / bindings_path).read_bytes())
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
rows = graph['prefabs'][prefab]
mode_graph = {}
for role, path_id, expected in [('owner', '8176622560865923362', 'Enemy'),
    ('mode0', '6909681923100553506', 'UnitMode'), ('mode1', '4179135437288288546', 'UnitMode'),
    ('combat1', '-5930072227765702366', 'EmptyAnimatedAbility'),
    ('animatorHooker1', '7661396829937840418', 'SimpleUnitAnimatorHooker')]:
    row = c['unique'](lambda r: r['pathId'] == path_id, rows)
    binding = c['unique'](lambda r: r['prefab'] == prefab and r['componentPathId'] == path_id, bindings['bindings'])
    script_record = bindings['scripts'][binding['scriptPathId']]
    assert v['sha'](script_record['originalJson'].encode()) == script_record['sha256']
    script = json.loads(script_record['originalJson'])
    assert script['m_ClassName'] == expected and script['m_Namespace'].startswith('Torappu.Battle')
    assert row['sha256'] == binding['componentSha256'] == v['sha'](row['originalJson'].encode())
    mode_graph[role] = {'component': row, 'binding': binding, 'scriptIdentity': script}
native = {role: json.loads(value['component']['originalJson']) for role, value in mode_graph.items()}
assert [r['m_PathID'] for r in native['owner']['_modes']] == [
    mode_graph['mode0']['component']['pathId'], mode_graph['mode1']['component']['pathId']]
assert native['mode1']['_attack']['m_PathID'] == '0'
assert native['mode1']['_combat']['m_PathID'] == mode_graph['combat1']['component']['pathId']
assert native['mode1']['_animatorHooker']['m_PathID'] == mode_graph['animatorHooker1']['component']['pathId']
assert native['animatorHooker1']['_replaceAnimPairs'] == [{'fromAnimKey': 'Die', 'toAnimKey': 'Die_2'}]
result = {'schemaVersion': 1, 'scope': 'Static selected self-death action chain; no runtime/frame/cross-version parity or support admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'imageBase': v['image_base'],
    'sources': {path: {'path': path, 'sha256': v['sha']((ROOT / path).read_bytes())} for path in [
        'data/arkpedia-global-windows-client-source.json', graph_path, bindings_path]},
    'template': template, 'eventKey': 0, 'actions': actions, 'fields': fields, 'methods': methods,
    'entityParameters': parameters, 'suicideFlag': c['unique'](lambda f: f['name'] == 'm_isSuicide', c['fields'](entity)),
    'entitySlots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), slot)
                    for name in ['Entity', 'Enemy', 'Character'] for slot in [38, 108]],
    'setHpDispatch': {'entryRva': 0x12f30, 'chunks': c['code'](0x12f30), 'metadataIdentityVerified': False}}
result['modeSwitch'] = {'methods': mode_methods, 'parameters': mode_parameters, 'graph': mode_graph,
    'modeField': c['unique'](lambda f: f['name'] == 'm_currentMode', c['fields'](c['type_row']('Unit', 'Torappu.Battle'))),
    'switchSlots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), 183) for name in ['Unit', 'Enemy']]}
fsm = c['type_row']('StateMachine', 'Torappu')
for rva in [0x247e0b0, 0x247d9b0, 0x247dbe0]:
    methods.append(c['method'](fsm, c['unique'](lambda r: v['pointer'](r) == v['image_base'] + rva, fsm['methods'])))
stop_row = c['unique'](lambda r: v['pointer'](r) == v['image_base'] + 0x247da40, fsm['methods'])
pos = v['offset'](v['image_base'] + 0x247da40)
raw = v['b'][pos:pos + 15]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + 0x247da40))
assert [(i.mnemonic, i.op_str) for i in decoded] == [
    ('xor', 'r9d, r9d'), ('mov', 'r8b, 1'), ('lea', 'edx, [r9 - 1]'), ('jmp', '0x18247dbe0')]
assert sum(i.size for i in decoded) == len(raw)
methods.append({'type': fsm['name'], **stop_row, 'entryRva': 0x247da40,
    'chunks': [{'beginRva': 0x247da40, 'endRva': 0x247da4f, 'unwindRva': None,
        'boundary': 'Reviewed complete four-instruction Stop tail-jump leaf; no stack changes or fallthrough',
        'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic,
                          'operands': i.op_str} for i in decoded]}]})
result['modeSwitch']['fsmStateField'] = c['unique'](lambda f: f['name'] == '<currentStateId>k__BackingField', c['fields'](fsm))
for type_name, names in [('Ability', ['Attach', 'Detach']), ('UnitMode', ['OnActivate', 'OnInactivate', 'InitOnce', 'OnInit', '_InitAbilities', '_InitTalents', '_SetAbilityDataAndAttachIfNeed']),
                         ('BasicTalent', ['get_isValid', 'get_isAttached', 'Attach', 'Detach', 'SetParentMode']),
                         ('Entity', ['get_startIniting', 'get_faceTo', 'FaceTo', 'SetBodyDirection'])]:
    t = c['type_row'](type_name, 'Torappu.Battle')
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name and
            (name not in ['FaceTo', 'SetBodyDirection'] or v['pointer'](r) == v['image_base'] +
             {'FaceTo': 0x3a1af00, 'SetBodyDirection': 0x3a23fa0}[name]), t['methods'])))
unit_mode = c['type_row']('UnitMode', 'Torappu.Battle')
result['modeSwitch']['lifecycle'] = {
    'abilityArrayField': c['unique'](lambda f: f['name'] == 'm_abilities', c['fields'](unit_mode)),
    'attachGate': {'callRva': 0x84cf8f, 'calleeRva': 0x3a2f650, 'type': 'Entity', 'method': 'get_startIniting'},
    'detachCall': {'callRva': 0x85091d, 'calleeRva': 0x390e4a0},
    'attachCall': {'callRva': 0x84cffd, 'calleeRva': 0x390e170},
    'faceSlots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), 10) for name in ['Unit', 'Enemy']],
    'modeSlots': [c['resolved_slot'](unit_mode, slot) for slot in [8, 9]],
    'lastModeResampledAfterInactive': {'readRva': 0x854ea7, 'writeRva': 0x854eb8},
}
priority = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
add_spec, concrete_dedup, canonical_dedup = [priority['specification'](i) for i in [242560, 259296, 208394]]
assert add_spec['declaringType'] == 'List`1' and add_spec['definition']['name'] == 'Add'
assert add_spec['instantiations']['class']['arguments'][0]['name'] == 'Ability'
assert concrete_dedup['definition'] == canonical_dedup['definition']
assert concrete_dedup['definition']['name'] == 'RemoveDuplicationsInplace'
assert concrete_dedup['nativeMapping'] is None
assert concrete_dedup['instantiations']['method']['arguments'][0]['name'] == 'Ability'
assert canonical_dedup['instantiations']['method']['arguments'][0]['name'] == 'Object'
dedup_rva = v['quad'](v['b'], priority['pointer_table'] + canonical_dedup['nativeMapping']['methodPointerIndex'] * 8) - v['image_base']
assert dedup_rva == 0x3f62c90
spec_loads = []
for rva, spec in [(0x870b56, add_spec), (0x870c0b, concrete_dedup)]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('4c8b05'), bytes.fromhex('488b15')]
    target_rva = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target_rva))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == spec['index']
    spec_loads.append({'instructionRva': rva, 'targetRva': target_rva, 'encodedUsage': usage, 'specificationIndex': spec['index']})
result['modeSwitch']['abilityInitialization'] = {
    'fields': [f for f in c['fields'](unit_mode) if f['name'] in ['_generalAbilities', '_combat', '_attack', 'm_abilities', 'm_inited']],
    'specificationLoads': spec_loads, 'addSpecification': add_spec, 'concreteDedupSpecification': concrete_dedup,
    'canonicalDedup': {**canonical_dedup, 'entryRva': dedup_rva, 'chunks': c['code'](dedup_rva)},
    'concreteContextVerified': False,
    'equalsDispatch': {'entryRva': 0x5860, 'metadataIdentityVerified': False},
}
result['modeSwitch']['modeEffects'] = {
    'fields': [f for f in c['fields'](unit_mode) if f['name'] in ['m_dynaimcAbilites', '<talents>k__BackingField']],
    'talentAttachedSlot': c['resolved_slot'](c['type_row']('BasicTalent', 'Torappu.Battle'), 6),
    'activation': {'validCallRva': 0x86fd15, 'attachedCallRva': 0x86fd49, 'attachCallRva': 0x86fd82, 'dynamicAttachRva': 0x86fdf4},
    'inactivation': {'validCallRva': 0x86fed1, 'attachedCallRva': 0x86fee2, 'detachCallRva': 0x86fef0, 'dynamicDetachRva': 0x86ff4d},
}
for type_name, namespace, names in [('EnemySkill', 'Torappu.Battle', ['get_parentMode', 'get_isRoot', 'Attach', 'Detach']),
                                    ('Unit', 'Torappu.Battle', ['OnAttackRangeChanged']),
                                    ('BuffContainer', '', ['OnUnitSwitchMode'])]:
    t = c['type_row'](type_name, namespace)
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))
result['modeSwitch']['notification'] = {
    'skillsField': c['unique'](lambda f: f['name'] == 'm_skills', c['fields'](c['type_row']('Enemy', 'Torappu.Battle'))),
    'skillParentField': c['unique'](lambda f: f['name'] == '<parentMode>k__BackingField', c['fields'](c['type_row']('EnemySkill', 'Torappu.Battle'))),
    'rangeChangedSlots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), 127) for name in ['Unit', 'Enemy']],
    'baseCallRva': 0x80af9f, 'rangeChangedCallRva': 0x852fd0, 'buffCallRva': 0x852fea,
    'rootCallRva': 0x80aff4, 'nextParentCallRva': 0x80b002, 'previousParentCallRva': 0x80b036,
    'attachCallRva': 0x80b071, 'detachCallRva': 0x80b06a,
}
for type_name, namespace, names in [('Buff', 'Torappu.Battle', ['OnUnitSwitchMode', '_IsActionValid', 'get_isFinishedOrDisabled', 'get_isFinished', 'get_isEnabled']),
                                    ('BuffContainer', '', ['_CheckBuffsActionValid', '_CheckFinishedBuffs'])]:
    t = c['type_row'](type_name, namespace)
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))
buff = c['type_row']('Buff', 'Torappu.Battle')
event = c['unique'](lambda t: t['name'] == 'Event', [v['types'][i] for i in buff['nested']])
event_field = c['unique'](lambda f: f['name'] == 'ON_UNIT_SWITCH_MODE', event['fields'])
ti, di = v['defaults'][event_field['index']]
default_type_pos = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
assert (v['uint'](v['b'], default_type_pos + 8) >> 16) & 255 == 8
event_pos = v['uint'](v['m'], 72) + di
event_raw = v['m'][event_pos:event_pos + 2]
# The shared small-enum reader deliberately only handles one-byte defaults.
# This selected signed Int32 default is the reviewed two-byte encoding of150.
assert event_raw == bytes.fromhex('8096')
encoded = ((event_raw[0] & 0x3f) << 8) | event_raw[1]
assert encoded & 1 == 0 and encoded >> 1 == 75
result['modeSwitch']['buffNotification'] = {
    'event': {**event_field, 'ownerTypeIndex': event['index'], 'defaultTypeIndex': ti,
              'defaultFileOffset': event_pos, 'encodedHex': event_raw.hex(), 'value': encoded >> 1},
    'containerProbeCallRva': 0x39d2bf0, 'containerCleanupCallRva': 0x39d2d81,
    'buffActionCheckCallRva': 0x39b0c63, 'buffRunActionsCallRva': 0x39b0c84,
    'setTargetToOwner': False, 'nativeIteratorRuntimeVerified': False,
}
iterator_methods = []
for index in [38622, 38627, 68292, 68293, 68297, 38630]:
    spec = priority['specification'](index)
    assert spec['instantiations']['class']['arguments'][0]['name'] == 'Object'
    pointer = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8)
    iterator_methods.append({**spec, 'entryRva': pointer - v['image_base'], 'chunks': c['code'](pointer - v['image_base'])})
assert [(r['definition']['name'], r['entryRva']) for r in iterator_methods[:2]] == [
    ('GetEnumerator', 0x4d96ab0), ('_ForwardEnumeratorOnDispose', 0x4d97460)]
definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + 38599 * 12)
assert definition == iterator_methods[0]['definition']['index'] and class_inst == 4600 and method_inst == -1
assert priority['mapping'].get(38599) is None
# Decode only this reviewed closed argument: DoubleBufferedList<ObjectPtr<Buff>>.
inst_table = v['offset'](v['quad'](v['b'], v['registration'] + 24))
inst_pos = v['offset'](v['quad'](v['b'], inst_table + class_inst * 8))
assert v['quad'](v['b'], inst_pos) == 1
arg_table = v['offset'](v['quad'](v['b'], inst_pos + 8))
arg_pos = v['offset'](v['quad'](v['b'], arg_table))
assert (v['uint'](v['b'], arg_pos + 8) >> 16) & 255 == 21
generic_class_pos = v['offset'](v['quad'](v['b'], arg_pos))
generic_definition_pos = v['offset'](v['quad'](v['b'], generic_class_pos))
object_ptr = c['type_row']('ObjectPtr`1', 'Torappu')
assert v['quad'](v['b'], generic_definition_pos) == object_ptr['index']
assert (v['uint'](v['b'], generic_definition_pos + 8) >> 16) & 255 == 17
buff_lock_spec = priority['specification'](253183)
assert buff_lock_spec['declaringTypeIndex'] == object_ptr['index']
assert buff_lock_spec['instantiations']['class']['arguments'][0]['name'] == 'Buff'
assert v['quad'](v['b'], generic_class_pos + 8) == v['quad'](v['b'], inst_table + 1751 * 8)
base_list = c['type_row']('DoubleBufferedList`1', 'Torappu')
result['modeSwitch']['buffNotification']['forwardIteration'] = {
    'canonicalMethods': iterator_methods,
    'concreteSpecification': {'index': 38599, 'definitionIndex': definition, 'classInstantiationIndex': class_inst,
        'argument': 'Torappu.ObjectPtr<Torappu.Battle.Buff>', 'argumentTypeHex': v['b'][arg_pos:arg_pos + 16].hex(),
        'genericDefinitionTypeHex': v['b'][generic_definition_pos:generic_definition_pos + 16].hex(), 'nativeMapping': None},
    'buffLockSpecification': buff_lock_spec,
    'fields': base_list['fields'][:5],
    'concreteContextVerified': False, 'poolRuntimeVerified': False,
}
for type_name, namespace, names in [('SortedDoubleBufferedBuffList', '', ['Add']),
                                    ('DoubleBufferedBuffList', '', ['Remove', 'ClearInvalidElementsIfNotLoop']),
                                    ('Buff', 'Torappu.Battle', ['get_instanceUid', 'get_onEventPriority'])]:
    t = c['type_row'](type_name, namespace)
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))
result['modeSwitch']['buffNotification']['listMutation'] = {
    'uidField': c['unique'](lambda f: f['name'] == '<instanceUid>k__BackingField', c['fields'](buff)),
    'priorityField': c['unique'](lambda f: f['name'] == '<onEventPriority>k__BackingField', c['fields'](buff)),
    'addMethodRva': 0x39dfa80, 'removeMethodRva': 0x39debc0, 'clearInvalidMethodRva': 0x39de900,
}
priority_type = v['types'][result['modeSwitch']['buffNotification']['listMutation']['priorityField']['typeData']]
assert priority_type['name'] == 'OnEventPriority'
priority_underlying = c['unique'](lambda f: f['name'] == 'value__', c['fields'](priority_type))
assert (priority_underlying['typeBits'] >> 16) & 255 == 8
result['modeSwitch']['buffNotification']['listMutation']['priorityType'] = {
    'index': priority_type['index'], 'name': priority_type['name'], 'underlyingField': priority_underlying}
loop_definition, loop_class_inst, loop_method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + 229767 * 12)
assert loop_definition == 23977 and loop_class_inst == 4600 and loop_method_inst == -1
loop_pos = v['offset'](v['image_base'] + 0x39de984)
assert v['b'][loop_pos:loop_pos + 3] == bytes.fromhex('488b15')
loop_target = 0x39de984 + 7 + struct.unpack_from('<i', v['b'], loop_pos + 3)[0]
loop_usage = v['quad'](v['b'], v['offset'](v['image_base'] + loop_target))
assert loop_usage >> 29 == 6 and (loop_usage & 0x1ffffffe) >> 1 == 229767
result['modeSwitch']['buffNotification']['listMutation']['isInLoopCall'] = {
    'specificationIndex': 229767, 'definitionIndex': loop_definition, 'classInstantiationIndex': loop_class_inst,
    'nativeMapping': priority['mapping'].get(229767), 'loadRva': 0x39de984, 'encodedUsage': loop_usage,
    'entryRva': 0x4d97fd0, 'chunks': c['code'](0x4d97fd0), 'concreteContextVerified': False,
}
pointer_methods = []
for index in [147632, 147636, 147639]:
    spec = priority['specification'](index)
    assert spec['declaringTypeIndex'] == object_ptr['index']
    pointer = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8)
    pointer_methods.append({**spec, 'entryRva': pointer - v['image_base'], 'chunks': c['code'](pointer - v['image_base'])})
common_image = c['module']('Torappu.Common.dll')
common_table = v['offset'](v['image_base'] + common_image['methodPointerTableRva'])
null_owner, null_row = c['unique'](lambda pair: True, [(t, row)
    for t in v['types'][common_image['typeStart']:common_image['typeStart'] + common_image['typeCount']]
    for row in t['methods'] if v['quad'](v['b'], common_table + ((row['token'] & 0xffffff) - 1) * 8) == v['image_base'] + 0x5a445f0])
assert null_owner['name'] == 'ObjectExtensions' and null_row['name'] == 'IsDestroyedOrNull'
methods.append(c['method'](null_owner, null_row, 'Torappu.Common.dll'))
buff_lineage = [{'index': t['index'], 'namespace': t['namespace'], 'name': t['name']} for t in c['lineage'](buff)]
assert [(t['namespace'], t['name']) for t in buff_lineage] == [('Torappu.Battle', 'Buff'), ('System', 'Object')]
result['modeSwitch']['buffNotification']['pointer'] = {
    'fields': object_ptr['fields'], 'canonicalMethods': pointer_methods,
    'concreteSpecifications': [priority['specification'](i) for i in [253182, 253183, 253185]],
    'buffLineage': buff_lineage, 'concreteContextVerified': False,
}
reverse_methods = []
for index in [38623, 38626, 16860, 16861, 16865, 16859, 16863]:
    spec = priority['specification'](index)
    pointer = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8)
    rva = pointer - v['image_base']
    if index == 16861:
        assert rva == 0x4aa4460
        pos = v['offset'](pointer)
        raw = v['b'][pos:pos + 14]
        assert raw.hex() == '8b4118ffc8894118c1e81f3401c3'
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, pointer))
        assert [(i.mnemonic, i.op_str) for i in decoded] == [
            ('mov', 'eax, dword ptr [rcx + 0x18]'), ('dec', 'eax'), ('mov', 'dword ptr [rcx + 0x18], eax'),
            ('shr', 'eax, 0x1f'), ('xor', 'al, 1'), ('ret', '')]
        assert sum(i.size for i in decoded) == len(raw)
        chunks = [{'beginRva': rva, 'endRva': rva + len(raw), 'unwindRva': None,
            'boundary': 'Reviewed complete six-instruction backward MoveNext leaf; no stack changes, calls or branches',
            'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
            'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic,
                              'operands': i.op_str} for i in decoded]}]
    else:
        chunks = c['code'](rva)
    reverse_methods.append({**spec, 'entryRva': rva, 'chunks': chunks})
for type_name, namespace, names in [('BuffContainer', '', ['_FinishAndRemoveBuff']),
                                    ('Buff', 'Torappu.Battle', ['get_overrideKey']), ('OverrideGroup', '', ['Remove'])]:
    t = c['type_row'](type_name, namespace)
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))
result['modeSwitch']['buffNotification']['finishedCleanup'] = {
    'canonicalReverseMethods': reverse_methods, 'concreteContextVerified': False,
    'reverseIteratorCallRva': 0x39d6938, 'finishRemoveCallRva': 0x39d6a6d,
    'firstOverrideKeyCallRva': 0x39d6a77, 'secondOverrideKeyCallRva': 0x39d6a97,
    'overrideLookupCallRva': 0x39d6ab7, 'groupRemoveCallRva': 0x39d6ad8,
    'sawNullBranchRva': 0x39d6a27, 'cleanupGateRva': 0x39d6b37,
}
finish_parameters = []
for type_name, namespace, names in [('BuffContainer', '', ['_FinishBuff']),
    ('Buff', 'Torappu.Battle', ['MarkFinish', 'OnFinish']), ('BattleController', 'Torappu.Battle', ['RecycleBuffNextFrame']),
    ('OverrideGroup', '', ['_DoUpdateInternal'])]:
    t = c['type_row'](type_name, namespace)
    for name in names:
        row = c['unique'](lambda r: r['name'] == name, t['methods'])
        record = c['method'](t, row)
        methods.append(record)
        pos = v['method_start'] + row['index'] * 32
        start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
        args = []
        for index in range(count):
            pp = v['uint'](v['m'], 88) + (start + index) * 12
            args.append({'index': start + index, 'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
        finish_parameters.append({'type': type_name, 'name': name, 'entryRva': record['entryRva'], 'parameters': args})
assert [p['name'] for p in finish_parameters[0]['parameters']] == ['buff', 'updateOverrideMap', 'delayToRecycle', 'immediatelyFinishEffect']
result['modeSwitch']['buffNotification']['finishEffects'] = {
    'parameters': finish_parameters,
    'selectedFlags': {'updateOverrideMap': True, 'delayToRecycle': True, 'immediatelyFinishEffect': False},
    'uidMapRemoveCallRva': 0x39d7c68, 'finishBuffCallRva': 0x39d7c88,
    'markFinishCallRva': 0x39d7d73, 'onFinishCallRva': 0x39d7d86, 'queueRecycleCallRva': 0x39d7dfd,
    'nativeQueueTimingVerified': False,
}
battle_controller = c['type_row']('BattleController', 'Torappu.Battle')
for name in ['get_fixedFrameCnt', '_UpdateDelayToRecycleBuffContainer', '_RecycleBuffContainerImmediatelly', 'OnTick', 'ManualFrameTick']:
    methods.append(c['method'](battle_controller, c['unique'](lambda r: r['name'] == name, battle_controller['methods'])))
queue_field = c['unique'](lambda f: f['name'] == 'm_delayToRecycleBuffContainer', c['fields'](battle_controller))
queue_generic_pos = v['offset'](queue_field['typeData'])
queue_definition_pos = v['offset'](v['quad'](v['b'], queue_generic_pos))
queue_type = v['types'][v['quad'](v['b'], queue_definition_pos)]
assert queue_type['name'] == 'ListDict`2' and queue_type['namespace'] == 'Torappu'
queue_inst_pos = v['offset'](v['quad'](v['b'], queue_generic_pos + 8))
assert v['quad'](v['b'], queue_inst_pos) == 2
queue_args_pos = v['offset'](v['quad'](v['b'], queue_inst_pos + 8))
queue_key_pos = v['offset'](v['quad'](v['b'], queue_args_pos))
assert (v['uint'](v['b'], queue_key_pos + 8) >> 16) & 255 == 9
result['modeSwitch']['buffNotification']['recycleQueue'] = {
    'frameField': c['unique'](lambda f: f['name'] == 's_fixedFrameCnt', c['fields'](battle_controller)),
    'queueField': queue_field, 'poolField': c['unique'](lambda f: f['name'] == 'm_buffPool', c['fields'](battle_controller)),
    'containerType': {'index': queue_type['index'], 'namespace': queue_type['namespace'], 'name': queue_type['name']},
    'keyTypeHex': v['b'][queue_key_pos:queue_key_pos + 16].hex(), 'keyTypeBits': v['uint'](v['b'], queue_key_pos + 8),
    'enqueueFrameCallRva': 0x398066e, 'enqueueNextFrameRva': 0x398068e,
    'updateFrameCallRva': 0x398ee03, 'updateLookupCallRva': 0x398ee25,
    'pointerValidityCallRva': 0x398eeab, 'pointerLockCallRva': 0x398eec7, 'poolRecycleCallRva': 0x398eee2,
    'removalFrameCallRva': 0x398ef38, 'removeBucketCallRva': 0x398ef4e,
    'nativeTickCounterIncrementRva': 0x397e39f, 'nativeTickQueueCallRva': 0x397eb79, 'manualTickDispatchRva': 0x397b651,
    'nativeTickPhaseVerified': False, 'poolRecycleEffectsVerified': False,
    'listMoveNext': {'entryRva': 0x4dd3240, 'chunks': c['code'](0x4dd3240), 'concreteContextVerified': False},
}
# Decode only the selected nested List/KeyValuePair/ObjectPtr signatures. The
# general direct-type reader is deliberately unchanged.
def flush_argument(pointer, depth=0):
    assert depth <= 4
    pos = v['offset'](pointer)
    data, bits = v['quad'](v['b'], pos), v['uint'](v['b'], pos + 8)
    kind = (bits >> 16) & 255
    record = {'kind': kind, 'typeBits': bits}
    if kind in [17, 18]:
        assert data < len(v['types'])
        t = v['types'][data]
        return {**record, 'typeIndex': data, 'namespace': t['namespace'], 'name': t['name']}
    if kind == 9:
        return {**record, 'name': 'UInt32'}
    assert kind == 21
    generic = v['offset'](data)
    definition = flush_argument(v['quad'](v['b'], generic), depth + 1)
    assert definition['name'] in ['List`1', 'KeyValuePair`2', 'ObjectPtr`1']
    instance = v['offset'](v['quad'](v['b'], generic + 8))
    count = v['quad'](v['b'], instance)
    assert count == (2 if definition['name'] == 'KeyValuePair`2' else 1)
    args = v['offset'](v['quad'](v['b'], instance + 8))
    return {**record, 'definition': definition, 'arguments': [flush_argument(v['quad'](v['b'], args + i * 8), depth + 1) for i in range(count)]}

flush_bindings = []
for load_rva, expected in [(0x398e330, 258725), (0x398e355, 242227), (0x398e3a0, 231699),
                           (0x398e3c9, 242404), (0x398e410, 231747), (0x398e479, 231746), (0x398e4bc, 231698)]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == expected
    definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + expected * 12)
    owner, method = c['unique'](lambda pair: pair[1]['index'] == definition, [(t, r) for t in v['types'] for r in t['methods']])
    instances = {}
    for label, index in [('class', class_inst), ('method', method_inst)]:
        if index < 0:
            continue
        table = v['offset'](v['quad'](v['b'], v['registration'] + 24))
        instance = v['offset'](v['quad'](v['b'], table + index * 8))
        assert v['quad'](v['b'], instance) == 1
        args = v['offset'](v['quad'](v['b'], instance + 8))
        instances[label] = {'index': index, 'argument': flush_argument(v['quad'](v['b'], args))}
    assert priority['mapping'].get(expected) is None
    flush_bindings.append({'loadRva': load_rva, 'encodedUsage': usage, 'specificationIndex': expected,
        'declaringTypeIndex': owner['index'], 'declaringType': owner['name'], 'definition': method,
        'instantiations': instances, 'nativeMapping': None})
result['modeSwitch']['buffNotification']['recycleQueue']['immediateFlush'] = {
    'bindings': flush_bindings,
    'outerGetEnumeratorCallRva': 0x398e361, 'outerMoveNextCallRva': 0x398e3af,
    'innerGetEnumeratorCallRva': 0x398e3d8, 'innerMoveNextCallRva': 0x398e41c,
    'pointerValidityCallRva': 0x398e43b, 'pointerLockCallRva': 0x398e457,
    'poolRecycleCallRva': 0x398e472, 'clearVersionIncrementRva': 0x398e4fe, 'clearCountRva': 0x398e505,
    'outerMoveNext': {'entryRva': 0x4dd4140, 'chunks': c['code'](0x4dd4140), 'concreteContextVerified': False},
    'getEnumerator': {'entryRva': 0x4511980, 'chunks': c['code'](0x4511980), 'concreteContextVerified': False},
    'nativeCleanupPhaseVerified': False,
}
for name in ['ClearRunTimeData', 'get_runeManager', 'get_globalBlackboard']:
    methods.append(c['method'](battle_controller, c['unique'](lambda r: r['name'] == name, battle_controller['methods'])))
cleanup_effects = []
for type_name, namespace, name, rva in [
    ('BattleLogger', 'Torappu.Battle', 'ClearAll', 0x3a35060),
    ('RuneManager', 'Torappu.Battle.Runes', 'Clear', 0x9ffb50),
    ('PoolManager', 'Torappu.ObjectPool', 'Recycle', 0x28a91e0),
    ('BattleGlobalBlackboard', 'Torappu.Battle', 'Reset', 0x39a5400),
    ('GlobalEnvSystemController', 'Torappu.Battle', 'RemoveAll', 0x5718a0),
    ('SpineShaderManager', 'Torappu.Battle', 'ResetAllSpineShaders', 0x3968e00),
    ('BattleController', 'Torappu.Battle', '_ClearResourcesInHolder', 0x3986e30),
    ('BattleController', 'Torappu.Battle', '_ClearStaticVariables', 0x3987060)]:
    t = c['type_row'](type_name, namespace)
    row = c['unique'](lambda r: r['name'] == name and v['pointer'](r) - v['image_base'] == rva, t['methods'])
    cleanup_effects.append({'typeIndex': t['index'], 'namespace': namespace, 'type': type_name, 'definition': row, 'entryRva': rva})
result['modeSwitch']['buffNotification']['recycleQueue']['runtimeCleanup'] = {
    'effects': cleanup_effects,
    'globalBuffField': c['unique'](lambda f: f['name'] == 'm_globalBuffs', c['fields'](battle_controller)),
    'loggerClearCallRva': 0x396ef57, 'runeGetterCallRva': 0x396ef61, 'runeClearCallRva': 0x396ef74,
    'initialCountCallRva': 0x396f014, 'readGlobalBuffCallRva': 0x396f037, 'objectValidityCallRva': 0x396f059,
    'recycleGlobalBuffCallRva': 0x396f092, 'loopCountCallRva': 0x396f0a4, 'clearGlobalBuffCountRva': 0x396f0c5,
    'blackboardGetterCallRva': 0x396f0f1, 'blackboardResetCallRva': 0x396f100, 'environmentRemoveAllCallRva': 0x396f110,
    'shaderResetCallRva': 0x396f123, 'resourcesClearCallRva': 0x396f12d,
    'immediateFlushCallRva': 0x396f137, 'staticClearTailRva': 0x396f150,
    'liveLifecyclePhaseVerified': False, 'subsystemEffectsVerified': False,
}
for name in ['OnAllocate', 'OnRecycle', 'set_instanceUid', 'Reset']:
    methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == name, buff['methods'])))
result['modeSwitch']['buffNotification']['resetLifecycle'] = {
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in
        ['m_started', 'm_isFinished', 'm_needRemove', 'm_isActuallyEnabled', 'm_isLateEnabled',
         'm_isManuallyEnabled', 'm_isActuallyFinished', 'm_derivedBuffs']],
    'startedFinishedWriteRva': 0x39b1341, 'removeEnabledWriteRva': 0x39b1348, 'actuallyFinishedWriteRva': 0x39b134e,
    'derivedNullTestRva': 0x39b1355, 'derivedVersionIncrementRva': 0x39b135e, 'derivedCountWriteRva': 0x39b1361,
    'derivedClearArrayCallRva': 0x39b1372,
    'fullResetEffectsVerified': False, 'liveResetPhaseVerified': False,
}
timer = c['type_row']('PeriodicTimer', 'Torappu')
for name, rva in [('Reset', 0x1c5d990), ('MarkInvalid', 0x1c5d670), ('SetRemainingTime', 0x1c5dbb0)]:
    methods.append(c['method'](timer, c['unique'](lambda r: r['name'] == name and v['pointer'](r) - v['image_base'] == rva, timer['methods'])))
timer_math = []
for rva in [0x5a5c940, 0x5a5ca50]:
    timer_math.append({'entryRva': rva, 'chunks': c['code'](rva)})
for rva, expected in [(0x51df0c0, '483bca0f9fc0c3'), (0x51df0f0, '483bca0f9cc0c3')]:
    pos = v['offset'](v['image_base'] + rva)
    raw = v['b'][pos:pos + 7]
    assert raw.hex() == expected
    decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + rva))
    assert [i.mnemonic for i in decoded] == ['cmp', 'setg' if rva == 0x51df0c0 else 'setl', 'ret']
    assert sum(i.size for i in decoded) == len(raw)
    timer_math.append({'entryRva': rva, 'chunks': [{'beginRva': rva, 'endRva': rva + len(raw), 'unwindRva': None,
        'boundary': 'Reviewed complete signed Int64 comparison leaf; no stack changes, calls or branches',
        'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]})
result['modeSwitch']['buffNotification']['resetTiming'] = {
    'timerFields': c['fields'](timer), 'math': timer_math,
    'markInvalidCallRva': 0x39b1769, 'resetCallRva': 0x39b1822, 'setRemainingCallRva': 0x39b18b8,
    'resetMaxCallRva': 0x1c5da15, 'resetPeriodWriteRva': 0x1c5da21, 'resetRemainingWriteRva': 0x1c5da63,
    'invalidRemainingWriteRva': 0x1c5d6b4, 'invalidPeriodWriteRva': 0x1c5d6b8,
    'remainingMinCallRva': 0x1c5dc03, 'remainingWriteRva': 0x1c5dc0d,
    'fullResetEffectsVerified': False, 'liveTimerSchedulingVerified': False,
}
for owner, name in [(buff, 'set_triggerable'), (c['type_row']('Blackboard', 'Torappu'), 'GetFpOrDefault'),
                    (c['type_row']('Blackboard', 'Torappu'), 'GetIntOrDefault')]:
    methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name, owner['methods'])))
trigger_literals = []
for load_rva, expected in [(0x39b17a9, 'interval'), (0x39b17e0, 'trig_cnt'), (0x39b1853, 'first_trigger_interval')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 5 and usage & 1
    index = (usage & 0x1ffffffe) >> 1
    length, data_offset = struct.unpack_from('<ii', v['m'], v['uint'](v['m'], 8) + index * 8)
    start = v['uint'](v['m'], 16) + data_offset
    value = v['m'][start:start + length].decode('utf8')
    assert value == expected
    trigger_literals.append({'loadRva': load_rva, 'encodedUsage': usage, 'literalIndex': index, 'length': length, 'dataOffset': data_offset, 'value': value})
conditional_rva = 0x402c5d0
pos = v['offset'](v['image_base'] + conditional_rva)
conditional_raw = v['b'][pos:pos + 18]
assert conditional_raw.hex() == '84d2740b80fa02440f45c1418bc0c333c0c3'
conditional_ins = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(conditional_raw, v['image_base'] + conditional_rva))
assert [i.mnemonic for i in conditional_ins] == ['test', 'je', 'cmp', 'cmovne', 'mov', 'ret', 'xor', 'ret']
data_type = v['types'][c['unique'](lambda f: f['name'] == 'm_data', c['fields'](buff))['typeData']]
result['modeSwitch']['buffNotification']['resetTriggers'] = {
    'literals': trigger_literals,
    'dataFields': [c['unique'](lambda f: f['name'] == name, c['fields'](data_type)) for name in
        ['triggerLifeType', 'triggerCnt', 'triggerInterval', 'waitFirstTriggerInterval', 'firstTriggerInterval']],
    'conditional': {'entryRva': conditional_rva, 'chunks': [{'beginRva': conditional_rva, 'endRva': conditional_rva + len(conditional_raw), 'unwindRva': None,
        'boundary': 'Reviewed complete byte-conditional Int32 leaf, one internal branch and two terminal returns',
        'base64': base64.b64encode(conditional_raw).decode(), 'sha256': v['sha'](conditional_raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in conditional_ins]}]},
    'conditionalCallRva': 0x39b1736, 'initialCountWriteRva': 0x39b173b, 'intervalLookupCallRva': 0x39b17be,
    'countLookupCallRva': 0x39b17ec, 'overrideCountWriteRva': 0x39b17f1, 'firstLookupCallRva': 0x39b1868,
    'triggerableCompareRva': 0x39b18bd, 'triggerableCallRva': 0x39b18cc,
    'fullResetEffectsVerified': False, 'liveTriggerSchedulingVerified': False,
}
for name in ['.cctor', '_ModifyLifeTimeFinally']:
    methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == name, buff['methods'])))
life_conditional_rva = 0x402c5b0
pos = v['offset'](v['image_base'] + life_conditional_rva)
life_raw = v['b'][pos:pos + 20]
assert life_raw.hex() == '84d2740d80fa027404488bc1c3498bc0c333c0c3'
life_ins = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(life_raw, v['image_base'] + life_conditional_rva))
assert [i.mnemonic for i in life_ins] == ['test', 'je', 'cmp', 'je', 'mov', 'ret', 'mov', 'ret', 'xor', 'ret']
load_rva = 0x39b1397
pos = v['offset'](v['image_base'] + load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('4c8b2d')
target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 5 and usage & 1
index = (usage & 0x1ffffffe) >> 1
length, data_offset = struct.unpack_from('<ii', v['m'], v['uint'](v['m'], 8) + index * 8)
start = v['uint'](v['m'], 16) + data_offset
assert v['m'][start:start + length].decode('utf8') == 'duration'
result['modeSwitch']['buffNotification']['resetLifetime'] = {
    'durationLiteral': {'loadRva': load_rva, 'encodedUsage': usage, 'literalIndex': index, 'length': length, 'dataOffset': data_offset, 'value': 'duration'},
    'dataFields': [c['unique'](lambda f: f['name'] == name, c['fields'](data_type)) for name in ['durationKey', 'lifeTime', 'lifeTimeType']],
    'infinityField': c['unique'](lambda f: f['name'] == 'INFINITY_TIME', c['fields'](buff)),
    'infinityIntInputRva': 0x39b5f91, 'infinityConversionCallRva': 0x39b5f94, 'infinityWriteRva': 0x39b5fa7,
    'lookupCallRva': 0x39b1642, 'fallbackConversionCallRva': 0x39b1679, 'fallbackWriteRva': 0x39b167e,
    'conditionalCallRva': 0x39b16d0, 'selectedLifetimeWriteRva': 0x39b16d7, 'modifyCallRva': 0x39b16de,
    'remainingWriteRva': 0x39b16e7, 'existingWriteRva': 0x39b1708,
    'conditional': {'entryRva': life_conditional_rva, 'chunks': [{'beginRva': life_conditional_rva, 'endRva': life_conditional_rva + len(life_raw), 'unwindRva': None,
        'boundary': 'Reviewed complete byte-conditional Int64 leaf, internal branches and three terminal returns',
        'base64': base64.b64encode(life_raw).decode(), 'sha256': v['sha'](life_raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in life_ins]}]},
    'modifierEffectsVerified': False, 'fullResetEffectsVerified': False, 'liveLifetimePhaseVerified': False,
}
enemy_type = c['type_row']('Enemy', 'Torappu.Battle')
for owner, name in [(buff, 'get_owner'), (enemy_type, 'get_massLevel')]:
    methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name, owner['methods'])))
load_rva = 0x39b4f26
pos = v['offset'](v['image_base'] + load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
type_index = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + type_index * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == enemy_type['index']
levitate = c['unique'](lambda f: f['name'] == 'LEVITATE', c['enum'](c['type_row']('AbnormalFlag', 'Torappu'))['fields'])
assert levitate['value'] == 25
result['modeSwitch']['buffNotification']['lifetimeModifier'] = {
    'ownerFirstCallRva': 0x39b4ee5, 'ownerFirstValidityCallRva': 0x39b4f0a, 'ownerSecondCallRva': 0x39b4f21,
    'enemyTypeLoad': {'loadRva': load_rva, 'encodedUsage': usage, 'typeIndex': type_index, 'definitionIndex': enemy_type['index']},
    'enemyValidityCallRva': 0x39b4f9c, 'levitate': levitate, 'levitateInputRva': 0x39b4fc6, 'containsCallRva': 0x39b4fcf,
    'massLevelSlot': c['resolved_slot'](enemy_type, 198), 'massLevelInputRva': 0x39b4fdd, 'massLevelCallRva': 0x39b4fe5,
    'massThresholdRva': 0x39b4fea, 'divisorInputRva': 0x39b500a, 'divisionCallRva': 0x39b501b, 'lifetimeWriteRva': 0x39b5020,
    'division': {'entryRva': 0x5a3d680, 'chunks': c['code'](0x5a3d680)},
    'nativeOwnerFlagEffectsVerified': False, 'liveModifierPhaseVerified': False,
}
blackboard_type = c['type_row']('Blackboard', 'Torappu')
for name, rva in [('.ctor', 0x2167de0), ('Assign', 0x21653b0), ('Assign', 0x21652f0), ('ContainsKey', 0x2165b40),
                   ('TryGetFP', 0x2167390), ('AssignByPrefix', 0x2164c20), ('AssignValueStrByPrefix', 0x2164f60)]:
    methods.append(c['method'](blackboard_type, c['unique'](lambda r: r['name'] == name and v['pointer'](r) - v['image_base'] == rva, blackboard_type['methods'])))
methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == 'get_key', buff['methods'])))
load_rva = 0x39b13f1
pos = v['offset'](v['image_base'] + load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b0d')
target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 5 and usage & 1
index = (usage & 0x1ffffffe) >> 1
length, data_offset = struct.unpack_from('<ii', v['m'], v['uint'](v['m'], 8) + index * 8)
start = v['uint'](v['m'], 16) + data_offset
assert v['m'][start:start + length].decode('utf8') == '{0}.'
result['modeSwitch']['buffNotification']['resetBlackboard'] = {
    'prefixFormat': {'loadRva': load_rva, 'encodedUsage': usage, 'literalIndex': index, 'length': length, 'dataOffset': data_offset, 'value': '{0}.'},
    'firstEqualsCallRva': 0x39b12bd, 'secondEqualsCallRva': 0x39b1308,
    'firstCopyCallRva': 0x39b12e7, 'secondCopyCallRva': 0x39b1332,
    'firstKeyCallRva': 0x39b13d0, 'secondKeyCallRva': 0x39b13ec, 'formatCallRva': 0x39b13fe,
    'prefixAssignCalls': [0x39b1451, 0x39b1492], 'prefixValueAssignCalls': [0x39b146f, 0x39b14b0],
    'prefixDataAssignCallRva': 0x39b14dc, 'containsDurationCallRva': 0x39b14f7,
    'firstDurationCallRva': 0x39b153d, 'secondDurationCallRva': 0x39b1559, 'assignDurationCallRva': 0x39b1585,
    'ordinaryAssignCalls': [0x39b15d7, 0x39b15f7, 0x39b1623],
    'equalsDispatch': {'entryRva': 0x5860, 'chunks': c['code'](0x5860), 'concreteEqualsVerified': False},
    'nativeBlackboardEffectsVerified': False, 'fullResetEffectsVerified': False,
}
pair = c['unique'](lambda t: t['name'] == 'DataPair', [v['types'][i] for i in blackboard_type['nested']])
methods.append(c['method'](pair, c['unique'](lambda r: r['name'] == 'get_isStringValue', pair['methods'])))
result['modeSwitch']['buffNotification']['blackboardPrefix'] = {
    'dataPairTypeIndex': pair['index'], 'dataPairFields': c['fields'](pair),
    'numericStartsWithCallRva': 0x2164e08, 'numericComparisonInputRva': 0x2164dfb, 'numericSubstringCallRva': 0x2164e7b,
    'numericWriteCallRva': 0x2164ef4, 'numericLoopIncrementRva': 0x2164ef9,
    'stringStartsWithCallRva': 0x2165165, 'stringComparisonInputRva': 0x2165158, 'stringSubstringCallRva': 0x21651d9,
    'stringPredicateCallRva': 0x2165242, 'stringWriteCallRva': 0x2165280, 'stringLoopIncrementRva': 0x2165285,
    'nativeStringComparisonVerified': False, 'destinationWritesVerified': False, 'livePrefixPhaseVerified': False,
}
for owner, name, rva in [(blackboard_type, 'Assign', 0x21659a0), (blackboard_type, 'Assign', 0x2165800),
                         (pair, '.ctor', 0x2262300), (pair, '.ctor', 0x22622c0)]:
    methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name and v['pointer'](r) - v['image_base'] == rva, owner['methods'])))
string_type = c['type_row']('String', 'System')
string_module = c['module']('mscorlib.dll')
string_table = v['offset'](v['image_base'] + string_module['methodPointerTableRva'])
for name, rva in [('ToLower', 0x50d8500), ('Compare', 0x50cd8b0)]:
    row = c['unique'](lambda r: r['name'] == name and v['quad'](v['b'], string_table + ((r['token'] & 0xffffff) - 1) * 8) - v['image_base'] == rva, string_type['methods'])
    if name == 'ToLower':
        methods.append(c['method'](string_type, row, 'mscorlib.dll'))
    else:
        pos = v['offset'](v['image_base'] + rva)
        raw = v['b'][pos:pos + 14]
        assert raw.hex() == '6690450fb6c04533c9e962010000'
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + rva))
        assert [(i.mnemonic, i.op_str) for i in decoded] == [('nop', ''), ('movzx', 'r8d, r8b'), ('xor', 'r9d, r9d'), ('jmp', '0x1850cda20')]
        pp = v['method_start'] + row['index'] * 32
        methods.append({'image': 'mscorlib.dll', 'typeIndex': string_type['index'], 'namespace': 'System', 'type': 'String', **row,
            'virtualSlot': struct.unpack_from('<H', v['m'], pp + 28)[0], 'parameterCount': struct.unpack_from('<H', v['m'], pp + 30)[0],
            'tailTargetRva': 0x50cda20, 'tailTargetBodyRetained': False,
            'entryRva': rva, 'chunks': [{'beginRva': rva, 'endRva': rva + len(raw), 'unwindRva': None,
                'boundary': 'Reviewed complete bool-to-comparison wrapper leaf; tail callee body is not certified by this record',
                'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
                'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]})
result['modeSwitch']['buffNotification']['blackboardWrites'] = {
    'numericLowerCallRva': 0x2165a47, 'numericPairConstructorCallRva': 0x2165a5a,
    'numericIgnoreCaseInputRva': 0x2165a8f, 'numericCompareCallRva': 0x2165a95,
    'numericAppendCallRva': 0x2165aca, 'numericReplaceCallRva': 0x2165af8,
    'stringLowerCallRva': 0x21658a4, 'stringPairConstructorCallRva': 0x21658b7,
    'stringIgnoreCaseInputRva': 0x21658ef, 'stringCompareCallRva': 0x21658f5,
    'stringAppendCallRva': 0x216592a, 'stringReplaceCallRva': 0x2165958,
    'numericPairValueWriteRva': 0x2262326, 'numericPairStringClearRva': 0x226231f,
    'stringPairValueClearRva': 0x22622e2, 'stringPairStringWriteRva': 0x22622df,
    'nativeCultureEffectsVerified': False, 'nativeListVersioningVerified': False, 'liveWritePhaseVerified': False,
}
for name in ['TryGetInt', '_TryGetNumber']:
    methods.append(c['method'](blackboard_type, c['unique'](lambda r: r['name'] == name, blackboard_type['methods'])))
numeric_row = c['unique'](lambda r: r['name'] == 'get_isNumericValue', pair['methods'])
numeric_rva = v['pointer'](numeric_row) - v['image_base']
assert numeric_rva == 0x1cdfdb0
pos = v['offset'](v['image_base'] + numeric_rva)
numeric_raw = v['b'][pos:pos + 11]
assert numeric_raw.hex() == '488b491033d2e9f5363f03'
numeric_ins = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(numeric_raw, v['image_base'] + numeric_rva))
assert [(i.mnemonic, i.op_str) for i in numeric_ins] == [('mov', 'rcx, qword ptr [rcx + 0x10]'), ('xor', 'edx, edx'), ('jmp', '0x1850d34b0')]
pp = v['method_start'] + numeric_row['index'] * 32
methods.append({'image': 'Assembly-CSharp.dll', 'typeIndex': pair['index'], 'namespace': pair['namespace'], 'type': 'DataPair', **numeric_row,
    'virtualSlot': struct.unpack_from('<H', v['m'], pp + 28)[0], 'parameterCount': struct.unpack_from('<H', v['m'], pp + 30)[0],
    'entryRva': numeric_rva, 'chunks': [{'beginRva': numeric_rva, 'endRva': numeric_rva + len(numeric_raw), 'unwindRva': None,
        'boundary': 'Reviewed complete numeric-predicate tail wrapper to String.IsNullOrEmpty',
        'base64': base64.b64encode(numeric_raw).decode(), 'sha256': v['sha'](numeric_raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in numeric_ins]}]})
result['modeSwitch']['buffNotification']['blackboardReads'] = {
    'numberCompareCallRva': 0x2167c15, 'numberPredicateCallRva': 0x2167c52, 'numberValueReadRva': 0x2167c99,
    'numberMissingOutWriteRva': 0x2167c62, 'numberFoundOutWriteRva': 0x2167ca1,
    'fpNumberCallRva': 0x2167406, 'fpConversionCallRva': 0x216742e, 'fpOutWriteRva': 0x2167438,
    'fpDefaultNumberCallRva': 0x21668f1, 'fpDefaultConversionCallRva': 0x2166919,
    'intNumberCallRva': 0x2167589, 'intMissingOutWriteRva': 0x2167592,
    'intFloorCallRva': 0x21675e7, 'intConversionRva': 0x21675f1, 'intOutWriteRva': 0x21675f5,
    'intDefaultTryCallRva': 0x21669fb, 'nativeNumberConversionVerified': False, 'liveReadPhaseVerified': False,
}
floor_rva = 0x4d00c4
pos = v['offset'](v['image_base'] + floor_rva)
floor_raw = v['b'][pos:pos + 176]
floor_ins = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(floor_raw, v['image_base'] + floor_rva))
assert len(floor_ins) == 44 and sum(i.size for i in floor_ins) == len(floor_raw) and floor_ins[-1].mnemonic == 'ret'
assert [(i.address - v['image_base'], i.mnemonic, i.op_str) for i in floor_ins if i.mnemonic in ['subsd', 'ret', 'jmp']] == [
    (0x4d010a, 'jmp', '0x1804e7ed0'), (0x4d0130, 'jmp', '0x1804d0173'), (0x4d0135, 'jmp', '0x1804d0173'),
    (0x4d016b, 'subsd', 'xmm0, qword ptr [rip + 0x5dfa105]'), (0x4d0173, 'ret', '')]
constants = []
for load_rva, size, expected in [(0x4d0128, 8, -1.0), (0x4d016b, 8, 1.0), (0x5a3da20, 4, 4294967296.0)]:
    pos = v['offset'](v['image_base'] + load_rva)
    ins = next(Cs(CS_ARCH_X86, CS_MODE_64).disasm(v['b'][pos:pos + 16], v['image_base'] + load_rva))
    target = load_rva + ins.size + struct.unpack_from('<i', v['b'], pos + ins.size - 4)[0]
    cp = v['offset'](v['image_base'] + target)
    raw = v['b'][cp:cp + size]
    value = struct.unpack('<d' if size == 8 else '<f', raw)[0]
    assert value == expected
    constants.append({'loadRva': load_rva, 'targetRva': target, 'hex': raw.hex(), 'value': value})
result['modeSwitch']['buffNotification']['blackboardReads']['scalarConversions'] = {
    'floor': {'entryRva': floor_rva, 'chunks': [{'beginRva': floor_rva, 'endRva': floor_rva + len(floor_raw), 'unwindRva': None,
        'boundary': 'Reviewed complete floor scalar body, including finite branches and explicit external NaN tail',
        'base64': base64.b64encode(floor_raw).decode(), 'sha256': v['sha'](floor_raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in floor_ins]}]},
    'floatToFP': {'entryRva': 0x5a3da20, 'chunks': c['code'](0x5a3da20)}, 'constants': constants,
    'selectedScalarResultVerified': True, 'nativeExceptionStateVerified': False, 'nanTailEffectsVerified': False,
}
result['modeSwitch']['buffNotification']['blackboardPairAssignments'] = {
    'emptyDestinationBranchRva': 0x2165434, 'emptyDestinationAddRangeTailRva': 0x2165799,
    'sourcePairReadCallRva': 0x216555b, 'sourcePairCopyRva': 0x2165565,
    'internalCompareCallRva': 0x216562b, 'internalReplaceCallRva': 0x2165703, 'internalAppendVersionRva': 0x2165646,
    'internalAppendPairCopyRva': 0x216573b, 'containsCompareCallRva': 0x2165bd5,
    'arrayProjectionVerified': False, 'nativeListVersioningVerified': False, 'liveAssignmentPhaseVerified': False,
}
add_range_spec = priority['specification'](117463)
assert add_range_spec['declaringType'] == 'List`1' and add_range_spec['definition']['name'] == 'AddRange'
assert add_range_spec['instantiations']['class']['arguments'][0]['typeIndex'] == pair['index']
assert v['quad'](v['b'], priority['pointer_table'] + add_range_spec['nativeMapping']['methodPointerIndex'] * 8) - v['image_base'] == 0x450dea0
result['modeSwitch']['buffNotification']['blackboardPairAssignments']['addRangeSpecification'] = add_range_spec
methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == '_LoadActions', buff['methods'])))
action_specs = [priority['specification'](i) for i in [3646, 219361, 264123]]
assert [s['definition']['name'] for s in action_specs] == ['get_Count', 'get_Item', 'Convert']
assert all(s['nativeMapping'] is None for s in action_specs)
convert_rva = 0x28a66d0
pos = v['offset'](v['image_base'] + convert_rva)
convert_raw = v['b'][pos:pos + 3]
assert convert_raw.hex() == '8bc1c3'
convert_ins = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(convert_raw, v['image_base'] + convert_rva))
assert [(i.mnemonic, i.op_str) for i in convert_ins] == [('mov', 'eax, ecx'), ('ret', '')]
result['modeSwitch']['buffNotification']['actionLoading'] = {
    'specifications': action_specs, 'clearSlotCount': 104,
    'clearWriteRva': 0x39b4336, 'clearLimitRva': 0x39b4340, 'countCallRva': 0x39b435a,
    'firstEntryCallRva': 0x39b4380, 'eventConvertCallRva': 0x39b4390, 'secondEntryCallRva': 0x39b43aa,
    'actionArrayReadRva': 0x39b43bd, 'assignabilityCallRva': 0x39b43d9, 'eventWriteRva': 0x39b43f7,
    'conversion': {'entryRva': convert_rva, 'chunks': [{'beginRva': convert_rva, 'endRva': convert_rva + len(convert_raw), 'unwindRva': None,
        'boundary': 'Reviewed complete Int32 enum conversion identity leaf', 'base64': base64.b64encode(convert_raw).decode(), 'sha256': v['sha'](convert_raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in convert_ins]}]},
    'nativeDictionaryEffectsVerified': False, 'nativeArrayAssignabilityVerified': False, 'liveActionLoadingPhaseVerified': False,
}
for name in ['_LoadAttributesModifier', '_CalcAbnormalMask', '_CalcAbnormalCombo']:
    methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == name, buff['methods'])))
attribute_math = []
for rva, length, expected in [(0x5a3b800, 47, ['mov', 'mov', 'sar', 'mov', 'sar', 'shl', 'add', 'imul', 'imul', 'imul', 'shr', 'add', 'add', 'ret']),
                               (0x4175da0, 5, ['lea', 'ret']), (0x51df0b0, 7, ['cmp', 'setge', 'ret'])]:
    pos = v['offset'](v['image_base'] + rva)
    raw = v['b'][pos:pos + length]
    decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + rva))
    assert [i.mnemonic for i in decoded] == expected and sum(i.size for i in decoded) == length
    attribute_math.append({'entryRva': rva, 'chunks': [{'beginRva': rva, 'endRva': rva + length, 'unwindRva': None,
        'boundary': 'Reviewed complete straight-line FP scalar leaf without branches or calls', 'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]})
attribute_math.append({'entryRva': 0x1f632f0, 'chunks': c['code'](0x1f632f0)})
result['modeSwitch']['buffNotification']['attributeLoading'] = {
    'dataFields': c['fields'](c['type_row']('AttributeModifierData', 'Torappu')),
    'modifierFields': c['fields'](c['type_row']('AttributeModifier', '')),
    'formulaType': c['enum'](v['types'][c['unique'](lambda f: f['name'] == 'formulaItem', c['fields'](c['type_row']('AttributeModifier', '')))['typeData']]), 'math': attribute_math,
    'flagMaskCalls': [0x39b4550, 0x39b45c7, 0x39b463e], 'comboMaskCalls': [0x39b46b5, 0x39b472c],
    'clearMaskCallRva': 0x39b47a1, 'arrayCountRva': 0x39b485c,
    'arrayZeroWrites': [0x39b47ec, 0x39b480c, 0x39b4830], 'scalerOneWriteRva': 0x39b4857,
    'defaultConversionCallRva': 0x39b48c3, 'blackboardLookupCallRva': 0x39b493a, 'stackMultiplyCallRva': 0x39b499f,
    'sourceLockCallRva': 0x39b49c3, 'sourceValidityCallRva': 0x39b49e8, 'sourceAttributeCallRva': 0x39b4a1b,
    'accumulateCallRva': 0x39b4b00, 'attributeBitRva': 0x39b4b37, 'scalerMultiplyCallRva': 0x39b4bf6,
    'snapshotSourceLockCallRva': 0x39b4c7e, 'snapshotCallRva': 0x39b4ccc,
    'maskFlagBitRva': 0x39b30b5, 'maskComboBitRva': 0x39b2e85,
    'nativeSourceSnapshotEffectsVerified': False, 'nativeModifierCollectionVerified': False, 'liveAttributePhaseVerified': False,
}
pos = v['offset'](v['image_base'] + 0x39b47a6)
assert v['b'][pos:pos + 4] == bytes.fromhex('f30f1035')
target = 0x39b47a6 + 8 + struct.unpack_from('<i', v['b'], pos + 4)[0]
cp = v['offset'](v['image_base'] + target)
one_raw = v['b'][cp:cp + 4]
assert one_raw.hex() == '0000803f'
result['modeSwitch']['buffNotification']['attributeLoading']['initialScalerConstant'] = {
    'loadRva': 0x39b47a6, 'targetRva': target, 'hex': one_raw.hex(), 'value': struct.unpack('<f', one_raw)[0]}
for owner, name, image in [(buff, '_CalculatePriority', 'Assembly-CSharp.dll'), (buff, '_DoUpdateStack', 'Assembly-CSharp.dll'),
                            (c['type_row']('BuffData', 'Torappu'), 'get_isAutoPriority', 'Assembly-CSharp.dll'),
                            (c['type_row']('FP', 'Torappu'), '.cctor', 'Torappu.Common.dll')]:
    methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name, owner['methods']), image))
pos = v['offset'](v['image_base'] + 0x39b3323)
assert v['b'][pos:pos + 4] == bytes.fromhex('f30f1005')
target = 0x39b3323 + 8 + struct.unpack_from('<i', v['b'], pos + 4)[0]
cp = v['offset'](v['image_base'] + target)
scale_raw = v['b'][cp:cp + 4]
assert scale_raw.hex() == '00007a44'
result['modeSwitch']['buffNotification']['priorityAndStack'] = {
    'priorityScale': {'loadRva': 0x39b3323, 'targetRva': target, 'hex': scale_raw.hex(), 'value': struct.unpack('<f', scale_raw)[0]},
    'autoPredicateCallRva': 0x39b31fb, 'staticPriorityReadRva': 0x39b3204,
    'attributeCountRva': 0x39b3305, 'priorityMultiplyCallRva': 0x39b333b, 'roundCallRva': 0x39b335d,
    'keyLookupCallRva': 0x39b33d4, 'absoluteCallRva': 0x39b33f5, 'sumCallRva': 0x39b3403,
    'maxValueConstantRva': 0x5a3d005, 'maxValueWriteRva': 0x5a3d00f,
    'math': [{'entryRva': rva, 'chunks': c['code'](rva)} for rva in [0x5a42a50, 0x5a3c840, 0x5a5bf20, 0x5a3a900]],
    'stackCapReadRva': 0x39b34a7, 'stackCountCompareRva': 0x39b34b1, 'overCapBranchRva': 0x39b34b7,
    'stackAttributeLoadCallRva': 0x39b34d8, 'stackOwnerCallRva': 0x39b34e2, 'stackOwnerAttributesCallRva': 0x39b34f1,
    'stackMaskCallRva': 0x39b34fe, 'stackDirtyCallRva': 0x39b3511,
    'nativeOwnerDirtyEffectsVerified': False, 'livePriorityPhaseVerified': False, 'liveStackPhaseVerified': False,
}
for name in ['_InitIsStatusResistable', '_AutoCalcIsStatusResistable', '_InitCanSlowDown']:
    methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == name, buff['methods'])))
status_arrays = []
for load_rva, reference_index, expected in [(0x39b5ee7, 18, [0, 16, 43, 41]), (0x39b5f39, 8, [0, 16, 23, 43])]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 4 and (usage & 0x1ffffffe) >> 1 == reference_index
    assert reference_index * 8 + 8 <= v['uint'](v['m'], 188)
    ti, local_index = struct.unpack_from('<ii', v['m'], v['uint'](v['m'], 184) + reference_index * 8)
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18
    owner = v['types'][v['quad'](v['b'], tp)]
    assert owner['name'] == '<PrivateImplementationDetails>'
    field = owner['fields'][local_index]
    default_ti, di = v['defaults'][field['index']]
    dp = v['uint'](v['m'], 72) + di
    raw = v['m'][dp:dp + 16]
    values = list(struct.unpack('<iiii', raw))
    assert values == expected
    flags = c['enum'](c['type_row']('AbnormalFlag', 'Torappu'))
    status_arrays.append({'loadRva': load_rva, 'encodedUsage': usage, 'referenceIndex': reference_index,
        'declaringTypeIndex': owner['index'], 'field': field, 'defaultTypeIndex': default_ti,
        'defaultDataOffset': dp, 'hex': raw.hex(), 'sha256': v['sha'](raw), 'values': values,
        'names': [c['unique'](lambda f: f['value'] == value, flags['fields'])['name'] for value in values]})
status_field = c['unique'](lambda f: f['name'] == 'statusResistable', c['fields'](c['type_row']('BuffData', 'Torappu')))
switch_type = v['types'][status_field['typeData']]
assert switch_type['name'] == 'StatusResistable'
switch_values = []
for name, expected in [('NO', 0), ('YES', 1), ('AUTOMATIC', 2)]:
    field = c['unique'](lambda f: f['name'] == name, switch_type['fields'])
    ti, di = v['defaults'][field['index']]
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 5
    dp = v['uint'](v['m'], 72) + di
    assert v['m'][dp] == expected
    switch_values.append({**field, 'defaultTypeIndex': ti, 'defaultFileOffset': dp, 'encodedHex': v['m'][dp:dp + 1].hex(), 'value': expected})
config_type = c['type_row']('BattleMiscConfigs', 'Torappu')
result['modeSwitch']['buffNotification']['statusInitialization'] = {
    'staticArrays': status_arrays, 'statusField': status_field, 'switchEnum': {'typeIndex': switch_type['index'], 'name': switch_type['name'], 'fields': switch_values},
    'autoArrayField': c['unique'](lambda f: f['name'] == 'ABFLAGS_IS_AUTO_STATUS_RESISTABLE', c['fields'](buff)),
    'slowDownConfigField': c['unique'](lambda f: f['name'] == 'slowDownTemplateKey', c['fields'](config_type)),
    'modeReadRva': 0x39b3e1c, 'autoMaskCallRva': 0x39b3f11, 'autoBitTestRva': 0x39b3f35, 'autoPositiveBranchRva': 0x39b3f38,
    'standaloneAutoMaskCallRva': 0x39b2c60, 'standaloneAutoBitTestRva': 0x39b2c84,
    'slowDownConfigLoadRva': 0x39b3a92, 'slowDownStringCompareTailRva': 0x39b3aa6,
    'stringInequality': {'entryRva': 0x50d90f0, 'chunks': c['code'](0x50d90f0)},
    'nativeConfigEffectsVerified': False, 'liveStatusPhaseVerified': False,
}
for owner, name in [(buff, '_InitIsEpBreakBuff'), (buff, '_InitShieldSource'), (buff, 'set_hasShield'),
                    (c['type_row']('BlockDamage', ''), 'get_showShieldUI'), (c['type_row']('BlockDamage', ''), 'get_damageMask')]:
    methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name, owner['methods'])))
shield_type = c['type_row']('BlockDamage', '')
load_rva = 0x39b40a7
pos = v['offset'](v['image_base'] + load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
ti = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == shield_type['index']
damage_event = c['unique'](lambda f: f['name'] == 'ON_TAKE_DAMAGE', event['fields'])
default_ti, di = v['defaults'][damage_event['index']]
dp = v['uint'](v['m'], 72) + di
assert v['m'][dp] == 20
result['modeSwitch']['buffNotification']['finalFlagInitialization'] = {
    'breakDatabaseSpecification': priority['specification'](254454),
    'breakGetEnumeratorCallRva': 0x39b3bc3, 'breakMoveNextCallRva': 0x39b3bfd, 'breakCurrentCallRva': 0x39b3c88,
    'breakBuffKeysReadRva': 0x39b3ca0, 'breakKeyCallRva': 0x39b3ca9, 'breakContainsCallRva': 0x39b3cc4,
    'breakFoundDisposeCallRva': 0x39b3ce2, 'breakExhaustedDisposeCallRva': 0x39b3d1a, 'breakExceptionDisposeCallRva': 0x39b3d37,
    'shieldTypeLoad': {'loadRva': load_rva, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': shield_type['index'], 'name': shield_type['name']},
    'shieldEvent': {**damage_event, 'defaultTypeIndex': default_ti, 'defaultFileOffset': dp, 'encodedHex': '14', 'value': 10},
    'shieldClearCallRva': 0x39b403b, 'shieldEventInputRva': 0x39b4047, 'shieldUIGetterCallRva': 0x39b4106,
    'shieldSetCallRva': 0x39b411d, 'shieldMaskGetterCallRva': 0x39b4127, 'shieldMaskWriteRva': 0x39b412c,
    'shieldFields': [c['unique'](lambda f: f['name'] == name, c['fields'](shield_type)) for name in ['_showShieldUI', '_damageMask']],
    'nativeBreakDatabaseEffectsVerified': False, 'nativeShieldCastEffectsVerified': False, 'liveFinalFlagsPhaseVerified': False,
}
buff_config = c['type_row']('BuffConfig', 'Torappu.Battle')
character = c['type_row']('Character', 'Torappu.Battle')
for owner, names in [(buff_config, ['GetEffectKey', 'GetOnEventPriority']),
                     (buff, ['get_audioSignal', 'set_audioSignal', 'set_effectKey']), (character, ['TryHookAudio'])]:
    for name in names:
        methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name, owner['methods'])))
context_loads = []
for load_rva, expected in [(0x39b10fe, character), (0x39b1116, c['type_row']('AudioSignals', 'Torappu.Battle'))]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('488b05')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 1
    ti = (usage & 0x1ffffffe) >> 1
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == expected['index']
    context_loads.append({'loadRva': load_rva, 'encodedUsage': usage, 'typeIndex': ti,
                          'definitionIndex': expected['index'], 'name': expected['name']})
config_fields = c['fields'](buff_config)
assert [(f['name'], f['offset']) for f in config_fields] == [('template', 16), ('data', 24)]
template_type = v['types'][config_fields[0]['typeData']]
assert template_type['name'] == 'BuffTemplate'
context_capabilities = ['isDurableBuff', 'isDamageMissable', 'isSilenceable', 'isStunnable', 'isFreezable', 'isLevitatable']
context_parameters = []
for owner, name in [(buff, 'Reset'), (character, 'TryHookAudio')]:
    row = c['unique'](lambda r: r['name'] == name, owner['methods'])
    pos = v['method_start'] + row['index'] * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    args = []
    for index in range(count):
        pp = v['uint'](v['m'], 88) + (start + index) * 12
        args.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    context_parameters.append({'type': owner['name'], 'method': name, 'parameters': args})
assert [p['name'] for p in context_parameters[0]['parameters']] == ['config', 'container', 'source', 'ability', 'extraBlackboard', 'extraBlackboard2', 'sourceProjectile']
assert [p['name'] for p in context_parameters[1]['parameters']] == ['signal', 'subSignal', 'newSignal', 'newSubsignal']
audio_slot = c['resolved_slot'](character, 106)
assert audio_slot['name'] == 'TryHookAudio' and audio_slot['entryRva'] == 0x7f2970
result['modeSwitch']['buffNotification']['resetContext'] = {
    'configFields': config_fields, 'unboxedConfigFieldOffsets': {'template': 0, 'data': 8},
    'templateFields': [c['unique'](lambda f: f['name'] == name, c['fields'](template_type)) for name in ['effectKey', 'onEventPriority']],
    'dataFields': [c['unique'](lambda f: f['name'] == name, c['fields'](data_type)) for name in
                   ['buffKey', 'overrideEffectKey', 'overrideOnEventPriority', 'onEventPriority', 'audioSignal', 'enableInitDirectionFromSource', *context_capabilities]],
    'buffFields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in
                   ['m_data', 'm_container', 'm_source', 'm_ability', 'm_sourceProjectile', *['m_' + name for name in context_capabilities]]],
    'parameters': context_parameters, 'metadataLoads': context_loads, 'audioVirtualSlot': audio_slot,
    'audioSignalsField': c['unique'](lambda f: f['name'] == 'SIGNALS_WITH_BUFF', c['fields'](c['type_row']('AudioSignals', 'Torappu.Battle'))),
    'dataWriteRva': 0x39b0f09, 'containerWriteRva': 0x39b0f19, 'keyWriteRva': 0x39b0f86,
    'effectConfigCallRva': 0x39b0fa3, 'effectSetterCallRva': 0x39b0fb1, 'directionWriteRva': 0x39b1017,
    'priorityConfigCallRva': 0x39b1033, 'priorityWriteRva': 0x39b1087, 'audioInitialSetterCallRva': 0x39b10b4,
    'audioSourceValidityCallRva': 0x39b10f1, 'audioCharacterCastCallRva': 0x39b1108,
    'audioSignalsReadRva': 0x39b113d, 'audioSubsignalGetterCallRva': 0x39b116f,
    'audioHookCallRva': 0x39b11bf, 'audioOverrideSetterCallRva': 0x39b11d7,
    'pointerWrapCalls': [0x39b11eb, 0x39b1217, 0x39b1243],
    'pointerWrites': [0x39b11fb, 0x39b1227, 0x39b1253], 'capabilityDataReadRva': 0x39b125b,
    'capabilityWrites': [0x39b1274, 0x39b127e, 0x39b1288, 0x39b1292, 0x39b129c, 0x39b12a6],
    'nativeAudioSignalArrayValuesVerified': False, 'nativeCharacterAudioEffectsVerified': False,
    'nativeContextPointerCapturesVerified': False, 'liveResetContextPhaseVerified': False,
}
wrap_spec = priority['specification'](212603)
assert wrap_spec['declaringType'] == 'ObjectPtr' and wrap_spec['definition']['name'] == 'Wrap'
assert wrap_spec['instantiations']['method']['arguments'][0]['name'] == 'Object'
wrap_pointer = v['quad'](v['b'], priority['pointer_table'] + wrap_spec['nativeMapping']['methodPointerIndex'] * 8)
assert wrap_pointer - v['image_base'] == 0x4035830
wrap_loads = []
for load_rva, index, name in [(0x39b11dc, 269317, 'Entity'), (0x39b1203, 269312, 'Ability'), (0x39b122f, 269319, 'Projectile')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('4c8b05')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['definition'] == wrap_spec['definition'] and spec['nativeMapping'] is None
    arg = spec['instantiations']['method']['arguments'][0]
    assert arg['name'] == name
    lineage = [{'index': t['index'], 'name': t['name'], 'namespace': t['namespace']} for t in c['lineage'](v['types'][arg['typeIndex']])]
    assert {'name': 'Object', 'namespace': 'UnityEngine'} in [{'name': t['name'], 'namespace': t['namespace']} for t in lineage]
    wrap_loads.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec, 'lineage': lineage})
ptr_interface = c['type_row']('IPtrObject', 'Torappu')
uid_getter = c['unique'](lambda r: r['name'] == 'get_instanceUid', ptr_interface['methods'])
uid_slot = struct.unpack_from('<H', v['m'], v['method_start'] + uid_getter['index'] * 32 + 28)[0]
assert uid_slot == 0
uid_interface_loads = []
for load_rva in [0x477cc5d, 0x477ccb3, 0x477cdf0]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 1
    ti = (usage & 0x1ffffffe) >> 1
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == ptr_interface['index']
    uid_interface_loads.append({'loadRva': load_rva, 'encodedUsage': usage, 'typeIndex': ti})
result['modeSwitch']['buffNotification']['resetContext']['contextPointers'] = {
    'canonicalWrap': {**wrap_spec, 'entryRva': wrap_pointer - v['image_base'], 'chunks': c['code'](wrap_pointer - v['image_base'])},
    'concreteWrapLoads': wrap_loads, 'uidInterface': {'index': ptr_interface['index'], 'name': ptr_interface['name'], 'getter': uid_getter, 'slot': uid_slot},
    'uidInterfaceLoads': uid_interface_loads, 'wrapClearRva': 0x403583c, 'wrapConstructorCallRva': 0x4035847,
    'constructorFirstUidCallRva': 0x477cc69, 'constructorObjectWriteRva': 0x477cc75,
    'constructorNullCheckCallRva': 0x477cc9a, 'constructorDestroyedUidWriteRva': 0x477cca5,
    'constructorSecondUidCallRva': 0x477ccbf, 'constructorUidWriteRva': 0x477ccc4,
    'validityObjectReadRva': 0x477cdbc, 'validityNullCheckCallRva': 0x477cdd2,
    'validityObjectRereadRva': 0x477cde8, 'validityUidCallRva': 0x477cdf9, 'validityCachedUidCompareRva': 0x477cdfe,
    'lockValidityCallRva': 0x477cafc, 'lockObjectRereadRva': 0x477cb05,
    'nativeUnityDestructionEffectsVerified': False, 'nativeContextUidDispatchVerified': False, 'liveContextPointersVerified': False,
}
override_container = c['type_row']('BuffContainer', '')
for owner, names in [(data_type, ['GetOverrideKey']), (override_container, ['GetOverrideKeyCandidate', 'EnsureOverrideIndependentKey']),
                     (buff, ['get_overrideKey', 'set_overrideKey']), (character, ['get_cardUid'])]:
    for name in names:
        methods.append(c['method'](owner, c['unique'](lambda r: r['name'] == name, owner['methods'])))
hg_string = c['type_row']('HGString', 'Torappu')
for rva in [0x1c5ab80, 0x1c5a9d0]:
    methods.append(c['method'](hg_string, c['unique'](lambda r: r['name'] == 'Format' and v['pointer'](r) - v['image_base'] == rva, hg_string['methods'])))
override_literals = []
for load_rva, expected in [(0x39b1a45, '{0}{1}'), (0x39b1aa7, '{0}{1}'), (0x39b1a3b, '^')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b0d'), bytes.fromhex('4c8b05')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 5 and usage & 1
    index = (usage & 0x1ffffffe) >> 1
    assert index * 8 < v['uint'](v['m'], 12)
    length, offset = struct.unpack_from('<II', v['m'], v['uint'](v['m'], 8) + index * 8)
    assert offset + length <= v['uint'](v['m'], 20)
    value = v['m'][v['uint'](v['m'], 16) + offset:v['uint'](v['m'], 16) + offset + length].decode()
    assert value == expected
    override_literals.append({'loadRva': load_rva, 'encodedUsage': usage, 'literalIndex': index, 'value': value,
                              'dataOffset': offset, 'length': length})
empty_load_rva = 0x225d080
pos = v['offset'](v['image_base'] + empty_load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b05')
target = empty_load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
ti = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 14  # IL2CPP_TYPE_STRING
string_type = v['types'][v['quad'](v['b'], tp)]
assert string_type['name'] == 'String' and string_type['namespace'] == 'System'
empty_field = c['unique'](lambda f: f['name'] == 'Empty', c['fields'](string_type))
assert empty_field['offset'] == 0
character_load_rva = 0x39b19c4
pos = v['offset'](v['image_base'] + character_load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
target = character_load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
character_usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert character_usage == context_loads[0]['encodedUsage']
result['modeSwitch']['buffNotification']['resetOverride'] = {
    'dataFields': [c['unique'](lambda f: f['name'] == name, c['fields'](data_type)) for name in
                   ['disableOverride', 'overrideKey', 'buffKey', 'independentCharacterSource']],
    'literals': override_literals,
    'emptyStringTypeLoad': {'loadRva': empty_load_rva, 'encodedUsage': usage, 'typeIndex': ti,
                            'definitionIndex': string_type['index'], 'name': string_type['name'], 'field': empty_field},
    'disableReadRva': 0x225d058, 'keyEmptyTestCallRva': 0x225d063, 'keyFallbackReadRva': 0x225d06c,
    'independentFlagReadRva': 0x39b19b2, 'sharedKeyCallRva': 0x39b19ba, 'sharedKeySetterCallRva': 0x39b1b1a,
    'characterType': {'definitionIndex': character['index'], 'name': character['name'], 'encodedUsage': character_usage},
    'characterTypeLoadRva': character_load_rva, 'characterSourceSelectionRva': 0x39b1a0b,
    'independentKeyCallRva': 0x39b1a1e, 'baseFormatCallRva': 0x39b1a4f,
    'characterNullTestCallRva': 0x39b1a74, 'cardUidCallRva': 0x39b1a8b, 'cardFormatCallRva': 0x39b1ab7,
    'independentSetterCallRva': 0x39b1ac5, 'independentGetterCallRva': 0x39b1acf,
    'ensureIndependentCallRva': 0x39b1aee, 'candidateCallRva': 0x39b1b0c,
    'candidateStartsWithCallRva': 0x39c1c5c, 'candidateFoundDisposeCallRva': 0x39c1c6f,
    'candidateExhaustedDisposeCallRva': 0x39c1c94, 'candidateExceptionDisposeCallRva': 0x39c1ca7,
    'ensureTryGetCallRva': 0x39c0675, 'ensureContainsCallRva': 0x39c0691,
    'ensureRemoveCallRva': 0x39c06ad, 'ensureAddCallRva': 0x39c06ca,
    'nativeFormattingEffectsVerified': False, 'nativeOverrideContainerEffectsVerified': False,
    'liveResetOverridePhaseVerified': False,
}
result['modeSwitch']['buffNotification']['resetPipeline'] = {
    'stackFields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in
                    ['m_stackCnt', 'm_refreshRemainingTimeWhenStackMax', 'm_clearAllStackCntWhenTimeUp', '<priority>k__BackingField']],
    'dataFields': [c['unique'](lambda f: f['name'] == name, c['fields'](data_type)) for name in
                   ['refreshRemainingTimeWhenStackMax', 'clearAllStackCntWhenTimeUp', 'attributes']],
    'templateActionsField': c['unique'](lambda f: f['name'] == 'eventToActions', c['fields'](template_type)),
    'stackDataReadRva': 0x39b18d1, 'stackCountWriteRva': 0x39b18d5,
    'refreshStackWriteRva': 0x39b18ef, 'clearStacksWriteRva': 0x39b18fc,
    'loadAttributesCallRva': 0x39b190a, 'templateReadRva': 0x39b190f, 'templateActionsReadRva': 0x39b191b,
    'loadActionsCallRva': 0x39b1925, 'configSnapshotReadRva': 0x39b192a, 'configSnapshotWriteRva': 0x39b1939,
    'calculatePriorityCallRva': 0x39b193e, 'priorityWriteRva': 0x39b198f,
    'statusInitCallRva': 0x39b1b24, 'statusWriteRva': 0x39b1b33, 'slowdownWriteRva': 0x39b1be9,
    'elementalBreakCallRva': 0x39b1bf2, 'elementalBreakWriteRva': 0x39b1bf9, 'shieldSourceCallRva': 0x39b1c02,
    'fullResetEffectsVerified': False, 'liveResetPipelineVerified': False,
}
override_bindings = []
for load_rva, index, name in [(0x39c1bdd, 228013, 'get_Keys'), (0x39c1bf2, 237458, 'GetEnumerator'),
    (0x39c1c30, 235914, 'MoveNext'), (0x39c1c65, 235913, 'Dispose'), (0x39c0666, 228012, 'TryGetValue'),
    (0x39c0687, 228009, 'ContainsKey'), (0x39c06a3, 228011, 'Remove'), (0x39c06bb, 228007, 'Add')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05'), bytes.fromhex('4c8b0d')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['definition']['name'] == name and spec['nativeMapping'] is None
    assert [a['name'] for a in spec['instantiations']['class']['arguments']] == ['String', 'OverrideGroup']
    override_bindings.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
result['modeSwitch']['buffNotification']['resetOverride']['containerBindings'] = {
    'mapField': c['unique'](lambda f: f['name'] == 'm_buffOverrideMap', c['fields'](override_container)),
    'methodSpecifications': override_bindings, 'mapReadRvas': [0x39c1bd0, 0x39c0659, 0x39c067e, 0x39c069a, 0x39c06b2],
    'genericDictionaryEffectsVerified': False, 'nativeKeyEnumerationVerified': False, 'liveOverrideContainerVerified': False,
}
pool = c['type_row']('ObjectPool`1', 'Torappu.ObjectPool')
for owner, names in [(override_container, ['NewBuff', 'EnsureOverrideGroup', '_CheckThroughBuffAbnormalAnti',
    '_CheckThroughBuffStatusResistableAnti', '_CheckThroughLevitateBuffCondition', 'get_pool', 'get_owner', 'get_attributes']),
    (buff, ['OverrideEffectKey', 'get_isStatusResistable', 'get_abnormalAntiMask', 'set_isEnabled']), (entity, ['get_attributes'])]:
    for name in names:
        row = c['unique'](lambda r: r['name'] == name, owner['methods'])
        if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
            methods.append(c['method'](owner, row))
new_buff_specs = []
for load_rva, index, name in [(0x39c24e8, 253090, 'Allocate'), (0x39c25f5, 253091, 'Recycle'),
                             (0x39c2637, 253187, 'op_Implicit'), (0x39c26a3, 229206, 'Add')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05'), bytes.fromhex('4c8b0d')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['definition']['name'] == name and spec['nativeMapping'] is None
    assert [a['name'] for a in spec['instantiations']['class']['arguments']] == (['UInt32', 'Buff'] if name == 'Add' else ['Buff'])
    new_buff_specs.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
implicit_spec = priority['specification'](147643)
assert implicit_spec['definition'] == new_buff_specs[2]['specification']['definition']
implicit_va = v['quad'](v['b'], priority['pointer_table'] + implicit_spec['nativeMapping']['methodPointerIndex'] * 8)
assert implicit_va - v['image_base'] == 0x477cf00
context_path = 'data/candidates/arkpedia-windows-fear-context-source.json'
context_raw = (ROOT / context_path).read_bytes()
context_evidence = json.loads(context_raw)
assert any(m['type'] == 'Buff' and m['name'] == 'OnStart' and m['entryRva'] == 0x39b0120 for m in context_evidence['methods'])
new_row = c['unique'](lambda r: r['name'] == 'NewBuff', override_container['methods'])
pos = v['method_start'] + new_row['index'] * 32
start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
new_parameters = []
for index in range(count):
    pp = v['uint'](v['m'], 88) + (start + index) * 12
    new_parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
assert [p['name'] for p in new_parameters] == ['input', 'source', 'ability', 'extraBlackboard', 'extraBlackboard2', 'sourceProjectile', 'customOverrideEffectKey']
new_flags = c['enum'](c['type_row']('AbnormalFlag', 'Torappu'))
result['modeSwitch']['buffNotification']['newBuff'] = {
    'parameters': new_parameters, 'methodSpecifications': new_buff_specs,
    'canonicalImplicitPointer': {**implicit_spec, 'entryRva': implicit_va - v['image_base'], 'chunks': c['code'](implicit_va - v['image_base'])},
    'activationEvidence': {'path': context_path, 'sha256': v['sha'](context_raw), 'method': 'Buff.OnStart', 'entryRva': 0x39b0120},
    'containerFields': [c['unique'](lambda f: f['name'] == name, c['fields'](override_container)) for name in ['m_buffs', 'm_buffUidMap']],
    'ownerInitedField': c['unique'](lambda f: f['name'] == '<inited>k__BackingField', c['fields'](c['type_row']('BObject', 'Torappu.Battle'))),
    'startedField': c['unique'](lambda f: f['name'] == 'm_started', c['fields'](buff)),
    'groupQueueField': c['unique'](lambda f: f['name'] == 'm_queue', c['fields'](c['type_row']('OverrideGroup', ''))),
    'flags': [c['unique'](lambda f: f['value'] == value, new_flags['fields']) for value in [30, 37, 38]],
    'cleanupCallRva': 0x39c240e, 'dataReadRva': 0x39c2413, 'abnormalAntiCallRva': 0x39c2420, 'levitateCallRva': 0x39c2436,
    'sourceValidityCallRva': 0x39c2460, 'sourceAttributesCallRva': 0x39c2477, 'sourceFlagInputRva': 0x39c248b,
    'ownerFlagInputRva': 0x39c24c4, 'poolGetterCallRva': 0x39c24da, 'allocateCallRva': 0x39c24f2,
    'configSnapshotReadRva': 0x39c2510, 'resetCallRva': 0x39c254f, 'overrideEffectCallRva': 0x39c2573,
    'statusGetterCallRva': 0x39c25b3, 'statusAntiInputRva': 0x39c25d5, 'recycleCallRva': 0x39c2602,
    'listReadRva': 0x39c2643, 'pointerCaptureCallRva': 0x39c264a, 'listVirtualAddCallRva': 0x39c2686,
    'uidMapReadRva': 0x39c268c, 'uidGetterCallRva': 0x39c2695, 'uidAddCallRva': 0x39c26b2,
    'ownerInitedReadRva': 0x39c26ca, 'onStartCallRva': 0x39c26d5, 'abnormalAntiMaskCallRva': 0x39c26df,
    'filterAbnormalAntiCallRva': 0x39c26ed, 'finishedCallRva': 0x39c26f7, 'startedReadRva': 0x39c2700,
    'finishedRemoveCallRva': 0x39c2712, 'overrideKeyCallRva': 0x39c2726, 'directEnableCallRva': 0x39c2741,
    'ensureGroupCallRva': 0x39c2754, 'groupQueueReadRva': 0x39c279f, 'groupQueueCountCallRva': 0x39c27b3,
    'groupQueueItemReadRva': 0x39c27bc, 'groupQueueItemCallRva': 0x39c27d2, 'groupIdentityCompareRva': 0x39c27d7,
    'groupAddCallRva': 0x39c27ed, 'groupUpdateCallRva': 0x39c27ff,
    'nativeAntiAndLevitateEffectsVerified': False, 'nativeRegistrationEffectsVerified': False,
    'nativeOverrideGroupEffectsVerified': False, 'liveNewBuffPhaseVerified': False,
}
pool_methods = []
attributes_type = c['type_row']('Attributes', 'Torappu.Battle')
combo_field = c['unique'](lambda f: f['name'] == 'm_abnormalComboMgr', c['fields'](attributes_type))
combo_type = v['types'][combo_field['typeData']]
for owner, names in [(attributes_type, ['GetAbnormalFlag', 'GetAbnormalAnti']),
                     (entity, ['get_rawChangeableMotionMode', 'get_isLevitate']), (combo_type, ['GetAbnormalFlag'])]:
    for name in names:
        row = c['unique'](lambda r: r['name'] == name, owner['methods'])
        if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
            methods.append(c['method'](owner, row))
gate_load_rva = 0x39d7041
pos = v['offset'](v['image_base'] + gate_load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
target = gate_load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
ti = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == enemy_type['index']
counter_fields = []
for name in ['m_abnormalFlagsCounter', 'm_abnormalImmuneCounter', 'm_abnormalAntiCounter']:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](attributes_type))
    assert (field['typeBits'] >> 16) & 255 == 29
    ep = v['offset'](field['typeData'])
    assert (v['uint'](v['b'], ep + 8) >> 16) & 255 == 6  # IL2CPP_TYPE_I2
    counter_fields.append({**field, 'elementTypeHex': v['b'][ep:ep + 16].hex(), 'elementKind': 6})
raw_motion_field = c['unique'](lambda f: f['name'] == 'm_changeableMotionMode', c['fields'](entity))
motion_enum = c['enum'](v['types'][raw_motion_field['typeData']])
combo_mask_field = c['unique'](lambda f: f['name'] == 'm_abnormalFlagMask', c['fields'](combo_type))
assert combo_mask_field['offset'] == 0x28 and (combo_mask_field['typeBits'] >> 16) & 255 == 10
result['modeSwitch']['buffNotification']['newBuff']['admissionGates'] = {
    'enemyTypeLoad': {'loadRva': gate_load_rva, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': enemy_type['index'], 'name': enemy_type['name']},
    'flags': [c['unique'](lambda f: f['value'] == value, new_flags['fields']) for value in [25, 30, 36]],
    'counterFields': counter_fields, 'comboField': combo_field, 'comboType': {'index': combo_type['index'], 'name': combo_type['name']},
    'comboMaskField': combo_mask_field, 'comboMaskReadRva': 0x3995f24, 'comboMaskShiftRva': 0x3995f38,
    'comboMaskTestRva': 0x3995f3b, 'comboSignedPositiveRva': 0x3995f43,
    'rawMotionField': raw_motion_field, 'motionEnum': motion_enum,
    'antiEmptyCallRva': 0x39d6d6c, 'antiGetEnumeratorCallRva': 0x39d6d9f, 'antiMoveNextCallRva': 0x39d6ddc,
    'antiCurrentReadRva': 0x39d6de5, 'antiOwnerAttributesCallRva': 0x39d6dee, 'antiQueryCallRva': 0x39d6e04,
    'antiRejectDisposeCallRva': 0x39d6e17, 'antiExhaustedDisposeCallRva': 0x39d6e38, 'antiExceptionDisposeCallRva': 0x39d6e4b,
    'levitateEmptyCallRva': 0x39d6ffb, 'levitateContainsCallRva': 0x39d7025, 'levitateOwnerCallRva': 0x39d703c,
    'levitateOwnerSelectRva': 0x39d7091, 'levitateNullCallRva': 0x39d70b7, 'rawMotionCallRva': 0x39d70ca,
    'alreadyLevitateCallRva': 0x39d70d8, 'forceLevitateTailRva': 0x39d7104,
    'statusResistableCallRva': 0x39d6ef0, 'statusOwnerAttributesCallRva': 0x39d6efe, 'statusAntiQueryCallRva': 0x39d6f12,
    'flagImmuneArrayReadRva': 0x3957a19, 'flagImmuneCountCompareRva': 0x3957a29,
    'flagActiveArrayReadRva': 0x3957a31, 'flagActiveCountCompareRva': 0x3957a3f, 'flagComboReadRva': 0x3957a54, 'flagComboTailRva': 0x3957a6c,
    'antiCounterReadRva': 0x3957714, 'antiCounterCompareRva': 0x3957729,
    'nativeFlagEnumerationVerified': False, 'nativeComboEffectsVerified': False, 'liveAdmissionGatesVerified': False,
}
board_row = c['unique'](lambda r: r['name'] == 'get_blackboard', buff['methods'])
if not any(m['index'] == board_row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
    methods.append(c['method'](buff, board_row))
group_type = c['type_row']('OverrideGroup', '')
override_type_field = c['unique'](lambda f: f['name'] == 'overrideType', c['fields'](data_type))
override_enum = c['enum'](v['types'][override_type_field['typeData']])
queue_specs = []
for load_rva, index, name in [(0x39c02ab, 253540, 'get_count'), (0x39c033a, 253535, '.ctor'), (0x39c035b, 253537, 'Clear'), (0x39c0494, 253535, '.ctor')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['declaringType'] == 'PriorityQueue`1' and spec['definition']['name'] == name and spec['nativeMapping'] is None
    assert spec['instantiations']['class']['arguments'][0]['name'] == 'Buff'
    queue_specs.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
group_literals = []
for load_rva, expected in [(0x39c03a6, 'max_stack_cnt'), (0x39c03f1, 'max_valid_stack_cnt'),
                           (0x39c04f1, 'max_stack_cnt'), (0x39c053c, 'max_valid_stack_cnt')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 5
    index = (usage & 0x1ffffffe) >> 1
    length, offset = struct.unpack_from('<II', v['m'], v['uint'](v['m'], 8) + index * 8)
    assert offset + length <= v['uint'](v['m'], 20)
    value = v['m'][v['uint'](v['m'], 16) + offset:v['uint'](v['m'], 16) + offset + length].decode()
    assert value == expected
    group_literals.append({'loadRva': load_rva, 'encodedUsage': usage, 'literalIndex': index, 'value': value, 'length': length, 'dataOffset': offset})
group_load_rva = 0x39c041a
pos = v['offset'](v['image_base'] + group_load_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b0d')
target = group_load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
ti = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == group_type['index']
result['modeSwitch']['buffNotification']['newBuff']['ensureOverrideGroup'] = {
    'groupFields': [c['unique'](lambda f: f['name'] == name, c['fields'](group_type)) for name in ['m_queue', 'm_type', 'm_maxStackCnt', 'm_maxValidStackCnt']],
    'dataFields': [c['unique'](lambda f: f['name'] == name, c['fields'](data_type)) for name in ['overrideType', 'maxStackCnt', 'maxValidStackCnt']],
    'overrideEnum': override_enum, 'queueSpecifications': queue_specs, 'literals': group_literals,
    'groupTypeLoad': {'loadRva': group_load_rva, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': group_type['index'], 'name': group_type['name']},
    'mapCaptureRva': 0x39c0231, 'keyGetterCallRva': 0x39c0243, 'lookupCallRva': 0x39c0263,
    'initialQueueReadRva': 0x39c02a2, 'queueCountCallRva': 0x39c02b2, 'queueRereadRva': 0x39c0319,
    'existingQueueCtorCallRva': 0x39c0344, 'existingQueueWriteRva': 0x39c034c, 'clearQueueCallRva': 0x39c0362,
    'existingTypeWriteRva': 0x39c0377, 'existingMaxStackCallRva': 0x39c03b5, 'existingMaxValidCallRva': 0x39c0400,
    'groupCtorCallRva': 0x39c0477, 'newQueueCtorCallRva': 0x39c049e, 'newQueueWriteRva': 0x39c04aa,
    'newTypeWriteRva': 0x39c04c2, 'newMaxStackCallRva': 0x39c0500, 'newMaxValidCallRva': 0x39c054b,
    'newMaxStackWriteRva': 0x39c050c, 'newMaxValidWriteRva': 0x39c0557,
    'mapRereadRva': 0x39c0564, 'newKeyGetterCallRva': 0x39c0568, 'addGroupCallRva': 0x39c0584,
    'nativeQueueConstructionVerified': False, 'nativeGroupConstructionVerified': False, 'liveEnsureGroupPhaseVerified': False,
}
for name in ['_DoAddInternal', '_DoUpdateInternal']:
    row = c['unique'](lambda r: r['name'] == name, group_type['methods'])
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(c['method'](group_type, row))
dispatch_specs = []
for load_rva, index, name, entry in [(0x39df38c, 253541, 'get_isEmpty', 0x450c4c0),
    (0x39df3ad, 253539, 'get_Item', 0x44db610), (0x39df741, 253536, 'Add', 0x47b40e0),
    (0x39df7bd, 253540, 'get_count', 0x41fcd50)]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['declaringType'] == 'PriorityQueue`1' and spec['definition']['name'] == name and spec['nativeMapping'] is None
    assert spec['instantiations']['class']['arguments'][0]['name'] == 'Buff'
    dispatch_specs.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec, 'callerEntryRva': entry})
dispatch_callees = []
for name, entry in [('_ExtendRemainingTime', 0x39b3540), ('_FillRemainingTime', 0x39b3810),
    ('TakeSnapshotToBuffAttribute', 0x39b1cb0), ('_FillRemainingTimeWhenStackMax', 0x39b3730), ('_AddStack', 0x39b2a80)]:
    row = c['unique'](lambda r: r['name'] == name, buff['methods'])
    retained = c['method'](buff, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
    dispatch_callees.append({'name': name, 'index': row['index'], 'entryRva': entry})
result['modeSwitch']['buffNotification']['newBuff']['overrideGroupDispatch'] = {
    'queueSpecifications': dispatch_specs, 'buffCallees': dispatch_callees,
    'snapshotField': c['unique'](lambda f: f['name'] == 'takeSnapshotWhenExtend', c['fields'](data_type)),
    'typeReadRva': 0x39df354, 'defaultAddCallRva': 0x39df74b, 'uniqueEmptyCallRva': 0x39df53a,
    'extendTimeEmptyCallRva': 0x39df393, 'extendTimeQueueRereadRva': 0x39df398, 'extendTimeCallRva': 0x39df3cd,
    'extendEmptyCallRva': 0x39df3f3, 'extendQueueRereadRva': 0x39df3f8, 'fillCallRva': 0x39df42d,
    'snapshotFlagReadRva': 0x39df463, 'snapshotCallRva': 0x39df496, 'blackboardNullTestRva': 0x39df4bf, 'assignCallRva': 0x39df514,
    'stackEmptyCallRva': 0x39df566, 'stackMaxTestRva': 0x39df573, 'stackReadRva': 0x39df5a1,
    'stackIncrementRva': 0x39df5a7, 'stackCompareRva': 0x39df5a9, 'stackAtMaxCompareRva': 0x39df5d9,
    'refreshFlagReadRva': 0x39df609, 'refreshCapWriteRva': 0x39df63d, 'refreshCallRva': 0x39df670,
    'incrementCapWriteRva': 0x39df6a9, 'addStackCallRva': 0x39df6dc, 'stackAddCallRva': 0x39df701, 'firstCapWriteRva': 0x39df725,
    'updateInitialQueueReadRva': 0x39df7a1, 'updateInitialCountCallRva': 0x39df7c4, 'updateLoopQueueReadRva': 0x39df7d1,
    'updateLiveCountCallRva': 0x39df7fa, 'updateItemQueueReadRva': 0x39df803, 'updateItemCallRva': 0x39df815,
    'updateFinishedCallRva': 0x39df82c, 'updateSelectedWriteRva': 0x39df835, 'updateEnabledCallRva': 0x39df84b,
    'updateQueueAfterSetterRva': 0x39df850,
    'nativeQueueOrderingVerified': False, 'nativeBuffMergeEffectsVerified': False, 'liveGroupDispatchVerified': False,
}
for name, entry in [('get_lifeTime', 0x39b6d40), ('get_remainingTime', 0x39b71f0), ('get_existingTime', 0x39b6870)]:
    row = c['unique'](lambda r: r['name'] == name, buff['methods'])
    retained = c['method'](buff, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
notify_row = c['unique'](lambda r: r['name'] == 'OnBuffExtend', entity['methods'])
assert v['pointer'](notify_row) - v['image_base'] == 0x3a1fd50
result['modeSwitch']['buffNotification']['newBuff']['mergeTiming'] = {
    'ownerNotification': {'type': entity['name'], 'name': notify_row['name'], 'index': notify_row['index'], 'entryRva': 0x3a1fd50},
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in ['m_lifeTime', 'm_remainingTime', 'm_existingTime', 'm_stackCnt']],
    'extendLifeGetterCalls': [0x39b35d2, 0x39b360f, 0x39b364b], 'extendFiniteCompareRva': 0x39b3601,
    'extendRemainingReadRva': 0x39b361e, 'extendRemainingWriteRva': 0x39b3647,
    'extendLifeReadRva': 0x39b363e, 'extendLifeWriteRva': 0x39b365e,
    'extendExistingReadRva': 0x39b3662, 'extendExistingGetterCallRva': 0x39b366e, 'extendExistingWriteRva': 0x39b369b,
    'extendAddCalls': [0x39b3639, 0x39b3659, 0x39b3694], 'extendOwnerCalls': [0x39b36a5, 0x39b36e2],
    'extendOwnerValidityCallRva': 0x39b36cf, 'extendNotifyTailRva': 0x39b3702,
    'fillLifeGetterCalls': [0x39b38ae, 0x39b38eb, 0x39b38f2], 'fillFiniteCompareRva': 0x39b38dd,
    'fillRemainingReadRva': 0x39b3901, 'fillMaxCallRva': 0x39b391c, 'fillRemainingWriteRva': 0x39b3921,
    'fillExistingReadRva': 0x39b3927, 'fillExistingGetterCallRva': 0x39b3931, 'fillExistingAddCallRva': 0x39b3957,
    'fillExistingWriteRva': 0x39b395e, 'fillOwnerCalls': [0x39b3968, 0x39b39a5],
    'fillOwnerValidityCallRva': 0x39b3992, 'fillNotifyTailRva': 0x39b39c5,
    'refreshRemainingReadRva': 0x39b379f, 'refreshRemainingGetterCallRva': 0x39b37ad,
    'refreshMaxCallRva': 0x39b37d3, 'refreshRemainingWriteRva': 0x39b37dd,
    'addStackIncrementRva': 0x39b2aef, 'addStackRemainingReadRva': 0x39b2af5, 'addStackRemainingGetterCallRva': 0x39b2b03,
    'addStackMaxCallRva': 0x39b2b29, 'addStackRemainingWriteRva': 0x39b2b30, 'addStackUpdateTailRva': 0x39b2b46,
    'mathEvidence': {'maximum': 'modeSwitch.buffNotification.resetTiming.math', 'additionAndSignedComparison': 'modeSwitch.buffNotification.attributeLoading.math'},
    'nativeOwnerNotificationEffectsVerified': False, 'nativeGetterHotfixDispatchVerified': False, 'liveMergeTimingVerified': False,
}
enabled_callees = []
for owner, name, entry in [(buff, '_UpdateIsEnabledIfNotFinished', 0x39b5a70),
    (entity, 'get_isSilenced', 0x3a2d560), (entity, 'get_isStunned', 0x3a2d830), (entity, 'get_isFrozen', 0x3a2cb10),
    (attributes_type, 'AddModifier', 0x3957030), (attributes_type, 'RemoveModifier', 0x39585b0)]:
    row = c['unique'](lambda r: r['name'] == name, owner['methods'])
    retained = c['method'](owner, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
    enabled_callees.append({'type': owner['name'], 'name': name, 'index': row['index'], 'entryRva': entry})
run_actions_row = c['unique'](lambda r: r['name'] == '_RunActions', buff['methods'])
assert v['pointer'](run_actions_row) - v['image_base'] == 0x39b5370
pos = v['method_start'] + run_actions_row['index'] * 32
start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
run_parameters = []
for index in range(count):
    pp = v['uint'](v['m'], 88) + (start + index) * 12
    run_parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
assert [p['name'] for p in run_parameters] == ['ev', 'setMeAsTarget']
tp = v['offset'](v['quad'](v['b'], v['type_table'] + run_parameters[0]['typeIndex'] * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 17
enabled_event_type = v['types'][v['quad'](v['b'], tp)]
assert enabled_event_type['name'] == 'Event' and enabled_event_type['index'] in buff['nested']
# Bind only the selected two single-byte constants. Other Event constants need
# a different compressed-integer decoder and are outside this record's claim.
enabled_events = c['enum']({**enabled_event_type, 'fields': [f for f in enabled_event_type['fields'] if f['name'] in ['value__', 'ON_BUFF_ENABLE', 'ON_BUFF_DISABLE']]})
assert [(f['name'], f['value']) for f in enabled_events['fields']] == [('ON_BUFF_ENABLE', 24), ('ON_BUFF_DISABLE', 25)]
result['modeSwitch']['buffNotification']['newBuff']['enabledUpdate'] = {
    'selectedEvents': enabled_events, 'runActions': {'index': run_actions_row['index'], 'entryRva': 0x39b5370, 'parameters': run_parameters},
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in
        ['m_isSilenceable', 'm_isStunnable', 'm_isFreezable', 'm_isLevitatable', 'm_isFinished', 'm_isActuallyEnabled', 'm_isLateEnabled', 'm_isManuallyEnabled']],
    'callees': enabled_callees,
    'setterFinishedTestRva': 0x39b7ede, 'setterManualWriteRva': 0x39b7ee9, 'setterUpdateTailRva': 0x39b7efd,
    'manualCaptureRva': 0x39b5aea, 'ownerCaptureCallRva': 0x39b5af6,
    'capabilityTests': [0x39b5afb, 0x39b5b48, 0x39b5b92, 0x39b5bd8],
    'ownerValidityCalls': [0x39b5b24, 0x39b5b6e, 0x39b5bb8, 0x39b5bfe],
    'ownerStatusCalls': [0x39b5b3b, 0x39b5b85, 0x39b5bcf, 0x39b5c15],
    'actualCompareRva': 0x39b5c21, 'disableActualWriteRva': 0x39b5c3e, 'enableActualLateWriteRva': 0x39b5d03,
    'disableOwnerCallRva': 0x39b5c95, 'disableAttributesCallRva': 0x39b5ca8, 'removeModifierCallRva': 0x39b5cbf,
    'disableSetMeAsTargetRva': 0x39b5cc4, 'disableEventInputRva': 0x39b5cd0, 'runActionsCallRva': 0x39b5cde,
    'enableOwnerCallRva': 0x39b5d58, 'enableAttributesCallRva': 0x39b5d67, 'addModifierCallRva': 0x39b5d7a,
    'enableSetMeAsTargetRva': 0x39b5d7f, 'enableEventInputRva': 0x39b5d8b,
    'nativeModifierStorageVerified': False, 'nativeEnabledActionsVerified': False, 'liveEnabledUpdateVerified': False,
}
modifier_interface = c['type_row']('IAttributesModifier', '')
modifier_slots = []
for expected_slot, name in enumerate(['get_attributeMask', 'get_abnormalFlagMask', 'get_abnormalImmuneMask',
    'get_abnormalAntiMask', 'get_abnormalComboMask', 'get_abnormalComboImmuneMask']):
    row = c['unique'](lambda r: r['name'] == name, modifier_interface['methods'])
    slot = struct.unpack_from('<H', v['m'], v['method_start'] + row['index'] * 32 + 28)[0]
    assert slot == expected_slot
    modifier_slots.append({**row, 'virtualSlot': slot})
modifier_specs = []
for load_rva, index, name in [(0x3957087, 237211, 'Add'), (0x3958607, 237214, 'Remove')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('4c8b05')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['declaringType'] == 'HashSet`1' and spec['definition']['name'] == name and spec['nativeMapping'] is None
    assert spec['instantiations']['class']['arguments'][0]['typeIndex'] == modifier_interface['index']
    modifier_specs.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
modifier_type_loads = []
for load_rva in [0x39570ae, 0x39570c0, 0x39570d5, 0x395716b, 0x3957183, 0x39571b4,
                  0x395862e, 0x3958640, 0x3958655, 0x39586eb, 0x3958703, 0x3958734]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 1
    ti = (usage & 0x1ffffffe) >> 1
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == modifier_interface['index']
    modifier_type_loads.append({'loadRva': load_rva, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': modifier_interface['index']})
modifier_targets = []
for owner, name, entry in [(combo_type, 'PushMask', 0x3996140), (combo_type, 'PopMask', 0x3995fe0),
    (attributes_type, 'MarkAttributeDirty', 0x3957e90), (attributes_type, '_CalculateAbnormalDirtyByModifier', 0x3958e30)]:
    row = c['unique'](lambda r: r['name'] == name, owner['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    modifier_targets.append({'type': owner['name'], 'name': name, 'index': row['index'], 'entryRva': entry})
result['modeSwitch']['buffNotification']['newBuff']['modifierMutation'] = {
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](attributes_type)) for name in
        ['m_abnormalFlagModifiers', 'm_attributeModifiers', 'm_abnormalFlagsCounter', 'm_abnormalImmuneCounter', 'm_abnormalAntiCounter', 'm_abnormalComboMgr']],
    'interface': {'name': modifier_interface['name'], 'index': modifier_interface['index'], 'slots': modifier_slots, 'typeLoads': modifier_type_loads},
    'setSpecifications': modifier_specs, 'targets': modifier_targets,
    'addSetCallRva': 0x3957091, 'addNullModifierTestRva': 0x3957096,
    'addMaskCalls': [0x39570bb, 0x39570d0, 0x39570e4, 0x395717e, 0x3957195, 0x39571c0],
    'addCounterWrites': [0x3957119, 0x395713c, 0x395715f], 'addFlagLimitRva': 0x3957166,
    'addComboCaptureRva': 0x3957177, 'pushComboCallRva': 0x39571af, 'addAttributeSetCallRva': 0x3957205,
    'addAttributeLimitRva': 0x395720c, 'addDirtyCallRva': 0x395721e, 'addDirtyLimitRva': 0x3957228, 'addAbnormalDirtyTailRva': 0x3957251,
    'removeSetCallRva': 0x3958611, 'removeNullModifierTestRva': 0x3958616,
    'removeMaskCalls': [0x395863b, 0x3958650, 0x3958664, 0x39586fe, 0x3958715, 0x3958740],
    'removeCounterWrites': [0x3958699, 0x39586bc, 0x39586df], 'removeFlagLimitRva': 0x39586e6,
    'removeComboCaptureRva': 0x39586f7, 'popComboCallRva': 0x395872f, 'removeAttributeSetCallRva': 0x3958785,
    'removeAttributeLimitRva': 0x395878c, 'removeDirtyCallRva': 0x395879e, 'removeDirtyLimitRva': 0x39587a8, 'removeAbnormalDirtyTailRva': 0x39587d1,
    'nativeSetEqualityVerified': False, 'nativeComboMutationVerified': False, 'nativeDirtyPropagationVerified': False, 'liveModifierMutationVerified': False,
}
for name, entry in [('PushMask', 0x3996140), ('PopMask', 0x3995fe0), ('_UpdateAbnormalCombo', 0x39963b0), ('.cctor', 0x3996440)]:
    row = c['unique'](lambda r: r['name'] == name, combo_type['methods'])
    retained = c['method'](combo_type, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
combo_counter_fields = []
for name in ['m_abnormalComboCounter', 'm_abnormalComboImmuneCounter']:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](combo_type))
    assert (field['typeBits'] >> 16) & 255 == 29
    ep = v['offset'](field['typeData'])
    assert (v['uint'](v['b'], ep + 8) >> 16) & 255 == 6
    combo_counter_fields.append({**field, 'elementTypeHex': v['b'][ep:ep + 16].hex(), 'elementKind': 6})
combo_mapping_field = c['unique'](lambda f: f['name'] == 'ABNORMAL_COMBO_TO_FLAG_MASK', c['fields'](combo_type))
assert combo_mapping_field['offset'] == 0 and (combo_mapping_field['typeBits'] >> 16) & 255 == 29
ep = v['offset'](combo_mapping_field['typeData'])
assert (v['uint'](v['b'], ep + 8) >> 16) & 255 == 10
combo_cctor = c['code'](0x3996440)
for rva, expected in [(0x3996473, 'edx, 2'), (0x3996488, 'qword ptr [rax + 0x20], 0x80028'), (0x3996496, 'qword ptr [rax + 0x28], 0x40028')]:
    assert any(i['rva'] == rva and i['mnemonic'] == 'mov' and i['operands'] == expected for ch in combo_cctor for i in ch['instructions'])
result['modeSwitch']['buffNotification']['newBuff']['comboMutation'] = {
    'counterFields': combo_counter_fields,
    'maskFields': [c['unique'](lambda f: f['name'] == name, c['fields'](combo_type)) for name in ['m_abnormalComboMask', 'm_abnormalFlagMask']],
    'mappingField': {**combo_mapping_field, 'elementTypeHex': v['b'][ep:ep + 16].hex(), 'elementKind': 10},
    'mappingValues': [0x80028, 0x40028], 'mappingLengthInputRva': 0x3996473, 'mappingWriteRvas': [0x3996488, 0x3996496],
    'pushCounterWrites': [0x399619e, 0x39961c3], 'pushUpdateCallRva': 0x39961d6, 'pushLimitRva': 0x39961e4,
    'pushChangedTestRva': 0x39961e9, 'pushComboCaptureRva': 0x39961f9, 'pushMappingReadRva': 0x3996252,
    'pushMappingOrRva': 0x3996262, 'pushFlagMaskWriteRva': 0x399626e,
    'popCounterWrites': [0x399603e, 0x3996063], 'popUpdateCallRva': 0x3996076, 'popLimitRva': 0x3996084,
    'popChangedTestRva': 0x3996089, 'popComboCaptureRva': 0x3996099, 'popMappingReadRva': 0x39960f2,
    'popMappingOrRva': 0x3996102, 'popFlagMaskWriteRva': 0x399610e,
    'updateMaskCaptureRva': 0x39963b4, 'updateActiveCounterCompareRva': 0x39963d4, 'updateImmuneCounterCompareRva': 0x39963f2,
    'updatePreviousTestRva': 0x39963fa, 'updatePreviousSignedPositiveRva': 0x39963fd,
    'updateClearSubtractRva': 0x3996418, 'updateClearWriteRva': 0x399641d, 'updateSetOrRva': 0x3996426, 'updateSetWriteRva': 0x3996429,
    'nativeStaticMappingLifecycleVerified': False, 'liveComboMutationVerified': False,
}
abnormal_dirty_row = c['unique'](lambda r: r['name'] == '_CalculateAbnormalDirtyByModifier', attributes_type['methods'])
if not any(m['index'] == abnormal_dirty_row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
    methods.append(c['method'](attributes_type, abnormal_dirty_row))
result['modeSwitch']['buffNotification']['newBuff']['abnormalDirty'] = {
    'delegateFields': [c['unique'](lambda f: f['name'] == name, c['fields'](attributes_type)) for name in ['onAbnormalFlagDirty', 'onAbnormalComboDirty']],
    'maskCalls': [0x3958e9c, 0x3958efd, 0x3958f5d, 0x3958fbd],
    'slotInputs': [0x3958e85, 0x3958ef5, 0x3958f55, 0x3958fb5],
    'limits': [0x3958ee9, 0x3958f49, 0x3958fa9, 0x3959009],
    'conversionCalls': [0x3958ecb, 0x3958f2b, 0x3958f8b, 0x3958feb],
    'delegateReads': [0x3958ed0, 0x3958f30, 0x3958f90, 0x3958ff0],
    'delegateCalls': [0x3958ee3, 0x3958f43, 0x3958fa3, 0x3959003],
    'nativeDelegateInvocationVerified': False, 'liveAbnormalDirtyVerified': False,
}
dirty_row = c['unique'](lambda r: r['name'] == 'MarkAttributeDirty', attributes_type['methods'])
if not any(m['index'] == dirty_row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
    methods.append(c['method'](attributes_type, dirty_row))
cached_field = c['unique'](lambda f: f['name'] == 'm_cachedData', c['fields'](attributes_type))
assert (cached_field['typeBits'] >> 16) & 255 == 29
cached_element = v['offset'](cached_field['typeData'])
assert (v['uint'](v['b'], cached_element + 8) >> 16) & 255 == 17
cached_type = v['types'][v['quad'](v['b'], cached_element)]
assert cached_type['name'] == 'ObscuredFP' and cached_type['namespace'] == 'Torappu'
cached_module = c['module']('Torappu.Common.dll')
cached_table = v['offset'](v['image_base'] + cached_module['methodPointerTableRva'])
cached_conversion_row = c['unique'](lambda r: r['name'] == 'op_Implicit' and
    v['quad'](v['b'], cached_table + ((r['token'] & 0xffffff) - 1) * 8) - v['image_base'] == 0x5a45a80, cached_type['methods'])
cached_conversion = c['method'](cached_type, cached_conversion_row, 'Torappu.Common.dll')
if not any(m['index'] == cached_conversion_row['index'] and m['image'] == 'Torappu.Common.dll' for m in methods):
    methods.append(cached_conversion)
result['modeSwitch']['buffNotification']['newBuff']['attributeDirty'] = {
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](attributes_type)) for name in ['m_cachedData', 'm_dirtyMask', 'onAttributeMarkedDirty']],
    'cachedElement': {'name': cached_type['name'], 'namespace': cached_type['namespace'], 'index': cached_type['index'], 'typeHex': v['b'][cached_element:cached_element + 16].hex()},
    'conversion': {'image': 'Torappu.Common.dll', 'index': cached_conversion_row['index'], 'entryRva': 0x5a45a80},
    'maskCaptureRva': 0x3957ece, 'firstIdentityCallRva': 0x3957ed2, 'delegateCaptureRva': 0x3957ed7,
    'shiftMaskRva': 0x3957edb, 'setBitRva': 0x3957ede, 'maskWriteRva': 0x3957ee2, 'delegateNullTestRva': 0x3957ee6,
    'cacheCaptureRva': 0x3957ef4, 'secondIdentityCallRva': 0x3957ef8, 'cacheBoundsRva': 0x3957f04,
    'cacheStrideRva': 0x3957f09, 'copyReads': [0x3957f0f, 0x3957f19, 0x3957f23],
    'conversionCallRva': 0x3957f34, 'delegateCallRva': 0x3957f46,
    'nativeCachedValueConversionVerified': False, 'nativeDirtyDelegateInvocationVerified': False, 'liveAttributeDirtyVerified': False,
}
snapshot_type = c['type_row']('RuntimeAttributesSnapshot', 'Torappu.Battle')
for owner, name, entry in [(snapshot_type, 'TakeSnapshot', 0x6d3aa0),
    (attributes_type, 'GetValue', 0x3957db0), (attributes_type, 'GetValueRoundToInt', 0x3957d40)]:
    row = c['unique'](lambda r: r['name'] == name, owner['methods'])
    retained = c['method'](owner, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
snapshot_fields = c['fields'](snapshot_type)
assert [(f['name'], f['offset']) for f in snapshot_fields] == [('maxHp', 16), ('atk', 56), ('def', 96), ('magicResistance', 136),
    ('cost', 176), ('blockCnt', 196), ('attackSpeed', 216), ('baseAttackTime', 256), ('respawnTime', 296)]
snapshot_conversions = []
for field_name, entry, expected_type in [('maxHp', 0x5a45a50, 'ObscuredFP'), ('cost', 0x595c350, 'ObscuredInt')]:
    field = c['unique'](lambda f: f['name'] == field_name, snapshot_fields)
    owner = v['types'][field['typeData']]
    assert owner['name'] == expected_type
    image = c['unique'](lambda r: r[2] <= owner['index'] < r[2] + r[3], v['image_rows'])
    image_name = v['text'](image[0])
    mod = c['module'](image_name)
    table = v['offset'](v['image_base'] + mod['methodPointerTableRva'])
    row = c['unique'](lambda r: r['name'] == 'op_Implicit' and
        v['quad'](v['b'], table + ((r['token'] & 0xffffff) - 1) * 8) - v['image_base'] == entry, owner['methods'])
    retained = c['method'](owner, row, image_name)
    if not any(m['index'] == row['index'] and m['image'] == image_name for m in methods):
        methods.append(retained)
    snapshot_conversions.append({'type': owner['name'], 'image': image_name, 'index': row['index'], 'entryRva': entry})
snapshot_load = 0x39b1d24
pos = v['offset'](v['image_base'] + snapshot_load)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
target = snapshot_load + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 6
snapshot_lock = priority['specification']((usage & 0x1ffffffe) >> 1)
assert snapshot_lock['declaringType'] == 'ObjectPtr`1' and snapshot_lock['definition']['name'] == 'Lock'
assert snapshot_lock['instantiations']['class']['arguments'][0]['name'] == 'Entity'
result['modeSwitch']['buffNotification']['newBuff']['statSnapshot'] = {
    'fields': snapshot_fields, 'boxedHeaderBytes': 16, 'conversions': snapshot_conversions,
    'buffFields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in ['m_source', 'm_runtimeAttributesSnapshot']],
    'sourceLock': {'loadRva': snapshot_load, 'encodedUsage': usage, 'specification': snapshot_lock},
    'sourceLockCallRva': 0x39b1d2f, 'sourceValidityCallRva': 0x39b1d54, 'sourceAttributesCallRva': 0x39b1d67, 'snapshotCallRva': 0x39b1d79,
    'attributeReadCalls': [0x6d3ae2, 0x6d3b19, 0x6d3b51, 0x6d3b89, 0x6d3bc7, 0x6d3c0f, 0x6d3c40, 0x6d3c81, 0x6d3cc2],
    'conversionCalls': [0x6d3af2, 0x6d3b29, 0x6d3b61, 0x6d3b99, 0x6d3bed, 0x6d3c1e, 0x6d3c50, 0x6d3c91, 0x6d3cd1],
    'firstCopyWrites': [0x6d3b0d, 0x6d3b44, 0x6d3b7c, 0x6d3bb4, 0x6d3bff, 0x6d3c30, 0x6d3c6b, 0x6d3cac, 0x6d3ce6],
    'attributeIndices': [0, 1, 2, 3, 4, 5, 7, 8, 21], 'valueByteLengths': [40, 40, 40, 40, 20, 20, 40, 40, 20],
    'nativeObscuredValueConversionVerified': False, 'nativeSnapshotPointerDispatchVerified': False, 'liveStatSnapshotVerified': False,
}
calculate_row = c['unique'](lambda r: r['name'] == '_CalculateAttributeValue', attributes_type['methods'])
methods.append(c['method'](attributes_type, calculate_row))
value_specs = []
for load_rva, index, name in [(0x3959190, 237213, 'GetEnumerator'), (0x39591e0, 233318, 'MoveNext'), (0x3959355, 233317, 'Dispose')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('4c8b05'), bytes.fromhex('488b15')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = priority['specification'](index)
    assert spec['definition']['name'] == name and spec['nativeMapping'] is None
    assert spec['instantiations']['class']['arguments'][0]['name'] == 'IAttributesModifier'
    value_specs.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
provider_load = 0x3959212
pos = v['offset'](v['image_base'] + provider_load)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b1d')
target = provider_load + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
provider_ti = (usage & 0x1ffffffe) >> 1
provider_pos = v['offset'](v['quad'](v['b'], v['type_table'] + provider_ti * 8))
assert (v['uint'](v['b'], provider_pos + 8) >> 16) & 255 == 21
provider_generic = v['offset'](v['quad'](v['b'], provider_pos))
provider_definition_pos = v['offset'](v['quad'](v['b'], provider_generic))
provider_type = v['types'][v['quad'](v['b'], provider_definition_pos)]
assert provider_type['name'] == 'IAttributesDataProvider`1'
provider_inst = v['offset'](v['quad'](v['b'], provider_generic + 8))
assert v['quad'](v['b'], provider_inst) == 1
provider_args = v['offset'](v['quad'](v['b'], provider_inst + 8))
provider_arg = v['offset'](v['quad'](v['b'], provider_args))
assert (v['uint'](v['b'], provider_arg + 8) >> 16) & 255 == 17
provider_attribute = v['types'][v['quad'](v['b'], provider_arg)]
assert provider_attribute['name'] == 'AttributeType'
provider_row = c['unique'](lambda r: r['name'] == 'GetValue', provider_type['methods'])
provider_method_pos = v['method_start'] + provider_row['index'] * 32
assert struct.unpack_from('<H', v['m'], provider_method_pos + 28)[0] == 0
start, count = v['sint'](v['m'], provider_method_pos + 12), struct.unpack_from('<H', v['m'], provider_method_pos + 30)[0]
provider_parameters = []
for index in range(count):
    pp = v['uint'](v['m'], 88) + (start + index) * 12
    provider_parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
assert [p['name'] for p in provider_parameters] == ['attributeType', 'addition', 'multiplier', 'finalAddition', 'finalScaler']
value_constants = []
for load_rva in [0x395912c, 0x3959154]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 4] == bytes.fromhex('f30f1005')
    target = load_rva + 8 + struct.unpack_from('<i', v['b'], pos + 4)[0]
    data = v['b'][v['offset'](v['image_base'] + target):v['offset'](v['image_base'] + target) + 4]
    assert data.hex() == '0000803f'
    value_constants.append({'loadRva': load_rva, 'valueRva': target, 'hex': data.hex(), 'value': 1.0})
result['modeSwitch']['buffNotification']['newBuff']['attributeValues'] = {
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](attributes_type)) for name in
        ['m_attributeModifiers', 'm_rawData', 'm_dataRange', 'm_cachedData', 'm_overrideDataRange', 'm_dirtyMask']],
    'enumerationSpecifications': value_specs, 'initialConstants': value_constants,
    'provider': {'loadRva': provider_load, 'encodedUsage': usage, 'typeIndex': provider_ti, 'typeName': provider_type['name'],
        'definitionIndex': provider_type['index'], 'argument': {'name': provider_attribute['name'], 'index': provider_attribute['index'], 'typeHex': v['b'][provider_arg:provider_arg + 16].hex()},
        'method': {**provider_row, 'virtualSlot': 0, 'parameters': provider_parameters}},
    'clamp': {'entryRva': 0x5a5c4a0, 'chunks': c['code'](0x5a5c4a0)},
    'getDirtyCaptureRva': 0x3957de9, 'getDirtySignedTestRva': 0x3957e00, 'getDirtySignedBranchRva': 0x3957e03,
    'getCacheConversionCallRva': 0x3957e4e, 'getCalculateTailRva': 0x3957e7a,
    'roundGetValueCallRva': 0x3957d73, 'roundTailRva': 0x3957d9f,
    'enumeratorCallRva': 0x395919f, 'moveNextCallRva': 0x39591ef, 'providerCallRva': 0x39592ac,
    'sumCalls': [0x39592da, 0x39592f2, 0x395930a], 'scalerProductCallRva': 0x3959322,
    'normalDisposeCallRva': 0x395935f, 'exceptionDisposeCallRva': 0x3959384,
    'dirtyClearRva': 0x39593d7, 'baseReadCallRva': 0x3959403,
    'baseAdditionCallRva': 0x3959429, 'nonnegativeMultiplierCallRva': 0x395945b,
    'multiplierProductCallRva': 0x3959469, 'finalAdditionCallRva': 0x3959477, 'finalProductCallRva': 0x3959485,
    'lowerOverrideReadRva': 0x39594d6, 'upperOverrideReadRva': 0x3959590, 'clampCallRva': 0x395960f,
    'cacheCaptureRva': 0x3959617, 'cacheEncodeCallRva': 0x3959629, 'cacheCopyWrites': [0x3959640, 0x3959649, 0x3959653],
    'nativeProviderDispatchVerified': False, 'nativeRangeStorageVerified': False, 'nativeValueConversionVerified': False, 'liveAttributeValuesVerified': False,
}
for name, entry in [('GetValue', 0x39aabd0), ('get_isEnabled', 0x39b69e0)]:
    row = c['unique'](lambda r: r['name'] == name, buff['methods'])
    retained = c['method'](buff, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
provider_one_load = 0x39aad2a
pos = v['offset'](v['image_base'] + provider_one_load)
assert v['b'][pos:pos + 4] == bytes.fromhex('f30f1005')
target = provider_one_load + 8 + struct.unpack_from('<i', v['b'], pos + 4)[0]
provider_one_bytes = v['b'][v['offset'](v['image_base'] + target):v['offset'](v['image_base'] + target) + 4]
assert provider_one_bytes.hex() == '0000803f'
result['modeSwitch']['buffNotification']['newBuff']['buffAttributeProvider'] = {
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in
        ['m_isActuallyEnabled', 'm_attributeAdditions', 'm_attributeMultipliers', 'm_attributeFinalAdditions', 'm_attributeFinalScalers']],
    'one': {'loadRva': provider_one_load, 'valueRva': target, 'hex': provider_one_bytes.hex(), 'value': 1.0},
    'enabledCallRva': 0x39aac5e, 'getterActualReadRva': 0x39b6a37,
    'arrayReads': [0x39aac7c, 0x39aac9d, 0x39aacbb, 0x39aacde],
    'enabledOutputWrites': [0x39aac9a, 0x39aacb8, 0x39aacdb, 0x39aacfe],
    'disabledOutputWrites': [0x39aad32, 0x39aad35, 0x39aad38, 0x39aad45],
    'enabledTrueRva': 0x39aad01, 'disabledFalseRva': 0x39aad48,
    'nativeInterfaceDispatchVerified': False, 'nativeProviderHotfixVerified': False, 'liveBuffProviderVerified': False,
}
for index in [147561, 147566, 147567, 147558, 147559, 147563, 147564, 147568, 147569]:
    spec = priority['specification'](index)
    assert spec['declaringTypeIndex'] == pool['index']
    pointer = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8)
    pool_methods.append({**spec, 'entryRva': pointer - v['image_base'], 'chunks': c['code'](pointer - v['image_base'])})
result['modeSwitch']['buffNotification']['poolIdentity'] = {
    'uidField': c['unique'](lambda f: f['name'] == '<instanceUid>k__BackingField', c['fields'](buff)),
    'counterField': c['unique'](lambda f: f['name'] == 's_globalCounter', c['fields'](buff)),
    'validityField': c['unique'](lambda f: f['name'] == 'm_isValid', c['fields'](buff)),
    'allocateCounterIncrementRva': 0x39ab87b, 'allocateCounterWriteRva': 0x39ab884,
    'allocateUidWriteRva': 0x39ab8ca, 'allocateValidityWriteRva': 0x39ab8d5,
    'recycleUidSetterCallRva': 0x39afb7f, 'recycleValidityWriteRva': 0x39afb84,
    'canonicalPoolMethods': pool_methods, 'poolMembershipVerified': False, 'liveAllocationPolicyVerified': False,
}
pool_module = c['module']('Assembly-CSharp.dll')
module_pos = v['offset'](v['image_base'] + pool_module['rva'])
pool_token = v['uint'](v['m'], v['type_start'] + pool['index'] * 88 + 84)
range_count = v['quad'](v['b'], module_pos + 64)
range_pos = v['offset'](v['quad'](v['b'], module_pos + 72))
range_index, rgctx_begin, rgctx_length, bound_token = c['unique'](lambda row: row[3] == pool_token,
    [(n, *struct.unpack_from('<Iii', v['b'], range_pos + n * 12)[1:], v['uint'](v['b'], range_pos + n * 12)) for n in range(range_count)])
assert rgctx_length == 29
definition_count = v['quad'](v['b'], module_pos + 80)
assert 0 <= rgctx_begin < rgctx_begin + rgctx_length <= definition_count
definition_pos = v['offset'](v['quad'](v['b'], module_pos + 88))
bindings = []
for slot, expected_type, expected_method in [(19, 'HashSet`1', 'Remove'), (20, 'ObjectPool`1', '_RecycleInternal'),
    (26, 'Stack`1', 'Push'), (18, 'ObjectPool`1', '_SendNotification'), (1, 'Stack`1', 'get_Count'),
    (6, 'Options', 'Prepare'), (11, 'Stack`1', 'Pop'), (12, 'ObjectPool`1', 'get_allLoadedCnt'),
    (13, 'ObjectPool`1', '_CreateNew'), (16, 'HashSet`1', 'Add')]:
    pos = definition_pos + (rgctx_begin + slot) * 16
    raw = v['b'][pos:pos + 16]
    assert v['uint'](v['b'], pos) == 3
    data_pos = v['offset'](v['quad'](v['b'], pos + 8))
    spec_index = v['sint'](v['b'], data_pos)
    definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + spec_index * 12)
    owner_type, row = c['unique'](lambda pair: pair[1]['index'] == definition,
        [(t, r) for t in v['types'] for r in t['methods']])
    assert owner_type['name'] == expected_type and row['name'] == expected_method
    assert class_inst == 5644 and method_inst == -1
    # The argument is VAR generic parameter248, not a typedef. Do not use the
    # direct-type specification decoder to invent a class name for that index.
    inst_pos = v['offset'](v['quad'](v['b'], inst_table + class_inst * 8))
    assert v['quad'](v['b'], inst_pos) == 1
    args_pos = v['offset'](v['quad'](v['b'], inst_pos + 8))
    arg_pos = v['offset'](v['quad'](v['b'], args_pos))
    arg_bits = v['uint'](v['b'], arg_pos + 8)
    assert (arg_bits >> 16) & 255 == 19 and v['quad'](v['b'], arg_pos) == 248
    bindings.append({'slot': slot, 'kind': 3, 'definitionBase64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
        'dataRva': v['address'](data_pos) - v['image_base'], 'dataHex': v['b'][data_pos:data_pos + 8].hex(),
        'methodSpecificationIndex': spec_index, 'definition': row, 'declaringTypeIndex': owner_type['index'],
        'declaringType': owner_type['name'], 'classInstantiationIndex': class_inst, 'genericArgumentKind': 19,
        'genericParameterIndex': 248})
assert not any(row['name'] == 'Equals' for row in buff['methods'])
result['modeSwitch']['buffNotification']['poolIdentity']['staticRecycleContext'] = {
    'moduleRva': pool_module['rva'], 'typeToken': pool_token, 'rangeIndex': range_index,
    'begin': rgctx_begin, 'length': rgctx_length, 'definitionStride': 16, 'bindings': bindings,
    'concreteRuntimeContextVerified': False,
}
notify_rva = 0x477ba87
notify_pos = v['offset'](v['image_base'] + notify_rva)
assert v['b'][notify_pos:notify_pos + 3] == bytes.fromhex('488b15')
notify_target = notify_rva + 7 + struct.unpack_from('<i', v['b'], notify_pos + 3)[0]
notify_usage = v['quad'](v['b'], v['offset'](v['image_base'] + notify_target))
assert notify_usage >> 29 == 1
notify_type_index = (notify_usage & 0x1ffffffe) >> 1
notify_type_pos = v['offset'](v['quad'](v['b'], v['type_table'] + notify_type_index * 8))
assert (v['uint'](v['b'], notify_type_pos + 8) >> 16) & 255 == 18
notify_type = v['types'][v['quad'](v['b'], notify_type_pos)]
assert notify_type['name'] == 'IReusable' and notify_type['namespace'] == 'Torappu.ObjectPool'
notify_slots = [{**row, 'slot': struct.unpack_from('<H', v['m'], v['method_start'] + row['index'] * 32 + 28)[0]}
                for row in notify_type['methods']]
assert [(row['slot'], row['name']) for row in notify_slots] == [(0, 'OnAllocate'), (1, 'OnRecycle')]
result['modeSwitch']['buffNotification']['poolIdentity']['notificationInterface'] = {
    'loadRva': notify_rva, 'targetRva': notify_target, 'encodedUsage': notify_usage, 'typeIndex': notify_type_index,
    'definitionIndex': notify_type['index'], 'namespace': notify_type['namespace'], 'name': notify_type['name'], 'slots': notify_slots}
for owner_type, name in [(battle_controller, '.ctor'), (c['type_row']('BuffContainer', ''), 'CreateBuff'), (buff, '.ctor')]:
    methods.append(c['method'](owner_type, c['unique'](lambda r: r['name'] == name, owner_type['methods'])))
options_type = v['types'][pool['nested'][0]]
assert options_type['name'] == 'Options' and [f['name'] for f in options_type['fields']] == ['preloadSize', 'maxCapacity', 'allowPoolAutoReuse']
prepare_rva = 0x28a7100
prepare_pos = v['offset'](v['image_base'] + prepare_rva)
prepare_raw = v['b'][prepare_pos:prepare_pos + 14]
assert prepare_raw.hex() == '837904007f07c74104ffffff7fc3'
prepare_instructions = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(prepare_raw, v['image_base'] + prepare_rva))
assert [(i.mnemonic, i.op_str) for i in prepare_instructions] == [
    ('cmp', 'dword ptr [rcx + 4], 0'), ('jg', '0x1828a710d'), ('mov', 'dword ptr [rcx + 4], 0x7fffffff'), ('ret', '')]
assert sum(i.size for i in prepare_instructions) == len(prepare_raw)
constructor_spec = priority['specification'](253089)
assert constructor_spec['declaringTypeIndex'] == pool['index'] and constructor_spec['definition']['name'] == '.ctor'
assert constructor_spec['instantiations']['class']['arguments'][0]['name'] == 'Buff' and constructor_spec['nativeMapping'] is None
allocation_loads = []
for load_rva, kind, expected_index in [(0x3990463, 6, 253089), (0x3990415, 3, 56747)]:
    load_pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][load_pos:load_pos + 3] in [bytes.fromhex('4c8b0d'), bytes.fromhex('4c8b05')]
    target_rva = load_rva + 7 + struct.unpack_from('<i', v['b'], load_pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target_rva))
    assert usage >> 29 == kind and (usage & 0x1ffffffe) >> 1 == expected_index
    allocation_loads.append({'instructionRva': load_rva, 'targetRva': target_rva, 'encodedUsage': usage, 'index': expected_index, 'kind': kind})
result['modeSwitch']['buffNotification']['poolIdentity']['defaultAllocation'] = {
    'constructorSpecification': constructor_spec, 'metadataLoads': allocation_loads, 'optionsFields': options_type['fields'],
    'selectedOptions': {'preloadSize': 100, 'maxCapacityBeforePrepare': 0, 'maxCapacity': 2147483647, 'allowPoolAutoReuse': False},
    'prepare': {'entryRva': prepare_rva, 'chunks': [{'beginRva': prepare_rva, 'endRva': prepare_rva + len(prepare_raw), 'unwindRva': None,
        'boundary': 'Reviewed complete four-instruction Options.Prepare leaf; one internal branch to its terminal ret',
        'base64': base64.b64encode(prepare_raw).decode(), 'sha256': v['sha'](prepare_raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in prepare_instructions]}]},
    'nativeConstructorEffectsVerified': False, 'liveAllocationPhaseVerified': False,
}
factory_type_load_rva = 0x39bfeb8
factory_type_load_pos = v['offset'](v['image_base'] + factory_type_load_rva)
assert v['b'][factory_type_load_pos:factory_type_load_pos + 3] == bytes.fromhex('488b0d')
factory_type_target = factory_type_load_rva + 7 + struct.unpack_from('<i', v['b'], factory_type_load_pos + 3)[0]
factory_type_usage = v['quad'](v['b'], v['offset'](v['image_base'] + factory_type_target))
assert factory_type_usage >> 29 == 1
factory_type_index = (factory_type_usage & 0x1ffffffe) >> 1
factory_type_pos = v['offset'](v['quad'](v['b'], v['type_table'] + factory_type_index * 8))
assert (v['uint'](v['b'], factory_type_pos + 8) >> 16) & 255 == 18
assert v['quad'](v['b'], factory_type_pos) == buff['index']
result['modeSwitch']['buffNotification']['poolIdentity']['defaultAllocation']['constructedType'] = {
    'loadRva': factory_type_load_rva, 'encodedUsage': factory_type_usage, 'typeIndex': factory_type_index,
    'definitionIndex': buff['index'], 'namespace': buff['namespace'], 'name': buff['name']}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-self-death-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static self-death action evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete action-chain methods and original self-death template')
