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
for name in ['OnAllocate', 'OnRecycle', 'set_instanceUid']:
    methods.append(c['method'](buff, c['unique'](lambda r: r['name'] == name, buff['methods'])))
pool = c['type_row']('ObjectPool`1', 'Torappu.ObjectPool')
pool_methods = []
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
