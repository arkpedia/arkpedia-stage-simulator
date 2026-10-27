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
action_context_type = c['type_row']('Context', 'Torappu.Battle')
change_guard_type = c['type_row']('ChangeGuard', '')
run_action_methods = []
for owner, name, entry in [(buff, '_RunActions', 0x39b5370), (buff, 'get_context', 0x39b6660), (buff, 'get_source', 0x39b7460),
    (action_context_type, 'BeginChangeGard', 0x39ed790), (change_guard_type, 'set_buff', 0x39eb000),
    (change_guard_type, 'set_source', 0x39eb350), (change_guard_type, 'set_target', 0x39eb3e0),
    (change_guard_type, 'set_tile', 0x39eb470), (change_guard_type, 'Dispose', 0x39ea8f0)]:
    row = c['unique'](lambda r: r['name'] == name, owner['methods'])
    retained = c['method'](owner, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
    run_action_methods.append({'type': owner['name'], 'name': name, 'index': row['index'], 'entryRva': entry})
run_action_row = c['unique'](lambda r: r['name'] == '_RunActions', buff['methods'])
result_type_index = v['sint'](v['m'], v['method_start'] + run_action_row['index'] * 32 + 8)
tp = v['offset'](v['quad'](v['b'], v['type_table'] + result_type_index * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 17
action_snapshot_type = v['types'][v['quad'](v['b'], tp)]
assert action_snapshot_type['name'] == 'Snapshot' and action_snapshot_type['index'] in action_context_type['nested']
owner_slots = []
for name, slot, table_offset in [('get_alive', 38, 0x398), ('get_rootTile', 50, 0x458)]:
    row = c['unique'](lambda r: r['name'] == name, entity['methods'])
    assert struct.unpack_from('<H', v['m'], v['method_start'] + row['index'] * 32 + 28)[0] == slot
    owner_slots.append({**row, 'virtualSlot': slot, 'tableOffset': table_offset})
dispose_load = 0x39b562e
pos = v['offset'](v['image_base'] + dispose_load)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
target = dispose_load + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
dispose_ti = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + dispose_ti * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18
dispose_type = v['types'][v['quad'](v['b'], tp)]
assert dispose_type['name'] == 'IDisposable' and dispose_type['namespace'] == 'System'
dispose_row = c['unique'](lambda r: r['name'] == 'Dispose', dispose_type['methods'])
assert struct.unpack_from('<H', v['m'], v['method_start'] + dispose_row['index'] * 32 + 28)[0] == 0
result['modeSwitch']['buffNotification']['newBuff']['runActions'] = {
    'methods': run_action_methods, 'ownerSlots': owner_slots,
    'fields': [c['unique'](lambda f: f['name'] == name, c['fields'](buff)) for name in ['m_actions', 'm_blackboard']],
    'snapshot': {'name': action_snapshot_type['name'], 'typeIndex': action_snapshot_type['index'], 'fields': c['fields'](action_snapshot_type), 'boxedHeaderBytes': 16, 'byteLength': 240},
    'disposeInterface': {'loadRva': dispose_load, 'encodedUsage': usage, 'typeIndex': dispose_ti, 'definitionIndex': dispose_type['index'], 'name': dispose_type['name'], 'method': {**dispose_row, 'virtualSlot': 0}},
    'zeroLengthInputRva': 0x39b53ce, 'contextGetterCallRva': 0x39b5417, 'beginGuardCallRva': 0x39b542a,
    'setBuffCallRva': 0x39b545b, 'sourceGetterCallRva': 0x39b546a, 'setSourceCallRva': 0x39b5481,
    'targetOwnerCallRva': 0x39b5495, 'setTargetCallRva': 0x39b54ac, 'aliveOwnerCallRva': 0x39b54b6,
    'aliveSlotReadRva': 0x39b54db, 'aliveVirtualCallRva': 0x39b54ec, 'tileOwnerCallRva': 0x39b54fc,
    'tileSlotReadRva': 0x39b5521, 'tileVirtualCallRva': 0x39b5532, 'setTileCallRva': 0x39b5546,
    'actionsCaptureRva': 0x39b554b, 'eventIdentityCallRva': 0x39b555c, 'eventBoundsRva': 0x39b556d,
    'blackboardReadRva': 0x39b557f, 'fromBuffSourceTypeRva': 0x39b5586, 'runArrayCallRva': 0x39b5599,
    'firstResultCopyRva': 0x39b55a6, 'normalDisposeCallRva': 0x39b5635, 'exceptionDisposeCallRva': 0x39b564f, 'returnCopyRva': 0x39b5672,
    'nativeGuardEffectsVerified': False, 'nativeActionArrayExecutionVerified': False, 'nativeSnapshotCopyVerified': False, 'liveRunActionsVerified': False,
}
guard_stack_specs = []
for load_rva, method_name, stack_name in [
    (0x39eb04a, 'Pop', 'ContextPtrStack`1'), (0x39eb068, 'Push', 'ContextPtrStack`1'),
    (0x39eb39a, 'Pop', 'ContextPtrStack`1'), (0x39eb3b8, 'Push', 'ContextPtrStack`1'),
    (0x39eb42a, 'Pop', 'ContextPtrStack`1'), (0x39eb448, 'Push', 'ContextPtrStack`1'),
    (0x39eb4ba, 'Pop', 'ContextPtrStack`1'), (0x39eb4d8, 'Push', 'ContextPtrStack`1'),
    (0x39ea983, 'Pop', 'ContextPtrStack`1'), (0x39ea99c, 'Pop', 'ContextPtrStack`1'), (0x39ea9b5, 'Pop', 'ContextPtrStack`1'),
    (0x39ea9ce, 'Pop', 'ContextValueStack`1'), (0x39ea9e7, 'Pop', 'ContextValueStack`1'),
    (0x39eaa01, 'Pop', 'ContextPtrStack`1'), (0x39eaa16, 'Pop', 'ContextPtrStack`1'),
    (0x39eaa2b, 'Pop', 'ContextValueStack`1'), (0x39eaa40, 'Pop', 'ContextValueStack`1'), (0x39eaa5a, 'Pop', 'ContextPtrStack`1')]:
    pos = v['offset'](v['image_base'] + load_rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]
    target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == 6
    spec = priority['specification']((usage & 0x1ffffffe) >> 1)
    assert spec['declaringType'] == stack_name and spec['definition']['name'] == method_name
    guard_stack_specs.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
guard_type_load = 0x39ed7bc
pos = v['offset'](v['image_base'] + guard_type_load)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b0d')
target = guard_type_load + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
assert usage >> 29 == 1
ti = (usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18 and v['quad'](v['b'], tp) == change_guard_type['index']
guard_duplicate_all = c['unique'](lambda r: r['name'] == '_DuplicateAll', action_context_type['methods'])
assert v['pointer'](guard_duplicate_all) - v['image_base'] == 0x39edc70
result['modeSwitch']['buffNotification']['newBuff']['contextGuards'] = {
    'guardField': c['unique'](lambda f: f['name'] == 'm_context', c['fields'](change_guard_type)),
    'contextFields': [c['unique'](lambda f: f['name'] == name, c['fields'](action_context_type)) for name in
        ['m_source', 'm_target', 'm_buff', 'm_ability', 'm_modifier', 'm_projectile', 'm_tile', 'm_mainTarget', 'm_atkInfo', 'm_mainBuff']],
    'stackSpecifications': guard_stack_specs,
    'guardTypeLoad': {'loadRva': guard_type_load, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': change_guard_type['index']},
    'duplicateAllTarget': {**guard_duplicate_all, 'entryRva': 0x39edc70},
    'allocateCallRva': 0x39ed7c3, 'initializeCallRva': 0x39ed7dd, 'contextWriteRva': 0x39ed7e5,
    'contextRereadRva': 0x39ed7f2, 'duplicateAllCallRva': 0x39ed80b,
    'setterPopCalls': [0x39eb051, 0x39eb3a1, 0x39eb431, 0x39eb4c1],
    'setterContextRereads': [0x39eb056, 0x39eb3a6, 0x39eb436, 0x39eb4c6],
    'setterPushTails': [0x39eb07c, 0x39eb3cc, 0x39eb45c, 0x39eb4ec],
    'disposeContextCaptureRva': 0x39ea8f9,
    'disposePopCalls': [0x39ea98a, 0x39ea9a3, 0x39ea9bc, 0x39ea9d5, 0x39ea9f3, 0x39eaa08, 0x39eaa1d, 0x39eaa32, 0x39eaa4c, 0x39eaa69],
    'nativeGuardAllocationVerified': False, 'nativeContextDuplicationVerified': False, 'nativeContextStackEffectsVerified': False, 'liveContextGuardsVerified': False,
}
context_snapshot_methods = []
for name, entry in [('TakeSnapshot', 0x39ed9a0), ('_DuplicateAll', 0x39edc70)]:
    row = c['unique'](lambda r: r['name'] == name, action_context_type['methods'])
    retained = c['method'](action_context_type, row)
    assert retained['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == 'Assembly-CSharp.dll' for m in methods):
        methods.append(retained)
    context_snapshot_methods.append(retained)
snapshot_stack_specs = []
for method, expected_name in zip(context_snapshot_methods, ['get_value', 'Push']):
    bindings = []
    for chunk in method['chunks']:
        for instruction in chunk['instructions']:
            if instruction['mnemonic'] != 'mov' or '[rip +' not in instruction['operands']:
                continue
            load_rva = instruction['rva']
            pos = v['offset'](v['image_base'] + load_rva)
            if v['b'][pos:pos + 3] not in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]:
                continue
            target = load_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
            usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
            if usage >> 29 != 6:
                continue
            spec = priority['specification']((usage & 0x1ffffffe) >> 1)
            assert spec['definition']['name'] == expected_name
            assert spec['declaringType'] in ['ContextPtrStack`1', 'ContextValueStack`1', 'Stack`1']
            bindings.append({'loadRva': load_rva, 'encodedUsage': usage, 'specification': spec})
    assert len(bindings) == 10
    snapshot_stack_specs.append({'method': method['name'], 'bindings': bindings})
result['modeSwitch']['buffNotification']['newBuff']['contextSnapshots'] = {
    'stackSpecifications': snapshot_stack_specs,
    'captureFieldReads': [0x39eda33, 0x39eda5a, 0x39eda82, 0x39edaaa, 0x39edad2, 0x39edb5f, 0x39edb8a, 0x39edbb5, 0x39edbf9, 0x39edc20],
    'captureCalls': [0x39eda47, 0x39eda6e, 0x39eda96, 0x39edabe, 0x39edaeb, 0x39edb73, 0x39edb9e, 0x39edbce, 0x39edc09, 0x39edc30],
    'captureModifierCopyRva': 0x39edb00, 'captureAttackCopyRva': 0x39edbdd,
    'duplicateCaptureCallRva': 0x39edd1a, 'duplicateFirstCopyRva': 0x39edd37,
    'pushFieldReads': [0x39edda8, 0x39ede59, 0x39edefe, 0x39edfa3, 0x39ee048, 0x39ee14c, 0x39ee1f0, 0x39ee294, 0x39ee338, 0x39ee3f6],
    'pushCalls': [0x39ede51, 0x39edef6, 0x39edf9b, 0x39ee040, 0x39ee144, 0x39ee1e8, 0x39ee28c, 0x39ee330, 0x39ee3ee, 0x39ee48e],
    'nativeContextStackEffectsVerified': False, 'nativeNestedValueCopiesVerified': False, 'liveContextSnapshotsVerified': False,
}
managed_reference_stack = []
for index, expected_name, expected_entry in [(174660, 'Peek', 0x490a400), (174661, 'Pop', 0x490a6b0),
    (174662, 'Push', 0x490b650), (174663, 'PushWithResize', 0x490b470)]:
    spec = priority['specification'](index)
    assert spec['declaringType'] == 'Stack`1' and spec['definition']['name'] == expected_name
    assert spec['instantiations']['class']['arguments'][0]['name'] == 'Object'
    entry = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8) - v['image_base']
    assert entry == expected_entry
    managed_reference_stack.append({**spec, 'entryRva': entry, 'chunks': c['code'](entry)})
result['modeSwitch']['buffNotification']['newBuff']['managedReferenceStack'] = {
    'canonicalMethods': managed_reference_stack,
    'nativeInstructionFieldOffsets': {'_array': 0x10, '_size': 0x18, '_version': 0x1c},
    'popVersionIncrementRva': 0x490a6f4, 'popSizeWriteRva': 0x490a6fb,
    'popValueReadRva': 0x490a705, 'popClearRva': 0x490a71b,
    'resizeCallRva': 0x490b4b7, 'resizeArrayReloadRva': 0x490b4ba, 'resizeSizeReloadRva': 0x490b4c3,
    'nativeArrayResizeVerified': False, 'nativeGcBarrierVerified': False,
    'nativePointerAndValueSpecializationsVerified': False, 'liveContextStorageVerified': False,
}
managed_value_stacks = []
for name, width, entries in [('Modifier', 136, [(174642, 'Peek', 0x490a640), (174643, 'Pop', 0x490aa50),
    (174644, 'Push', 0x490b820), (174645, 'PushWithResize', 0x490b000)]),
    ('AttackInfo', 40, [(174768, 'Peek', 0x490a370), (174769, 'Pop', 0x490a990),
    (174770, 'Push', 0x490b790), (174771, 'PushWithResize', 0x490b340)])]:
    retained = []
    for index, expected_name, expected_entry in entries:
        spec = priority['specification'](index)
        assert spec['declaringType'] == 'Stack`1' and spec['definition']['name'] == expected_name
        argument = spec['instantiations']['class']['arguments'][0]
        assert argument['name'] == name and (argument['typeBits'] >> 16) & 255 == 17
        entry = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8) - v['image_base']
        assert entry == expected_entry
        retained.append({**spec, 'entryRva': entry, 'chunks': c['code'](entry)})
    managed_value_stacks.append({'specialization': name, 'valueWidth': width, 'clearOnPop': name == 'Modifier', 'canonicalMethods': retained})
result['modeSwitch']['buffNotification']['newBuff']['managedValueStacks'] = {
    'specializations': managed_value_stacks,
    'modifierPeekArrayCopy': {'entryRva': 0x1d5270, 'chunks': c['code'](0x1d5270)},
    'modifierPopVersionRva': 0x490aac8, 'modifierPopSizeRva': 0x490aacf,
    'modifierPopCopyRva': 0x490aae4, 'modifierPopClearRva': 0x490ab7b,
    'attackPopVersionRva': 0x490a9ee, 'attackPopSizeRva': 0x490a9f5,
    'attackPopCopyRva': 0x490aa01,
    'modifierPushResizeCallRva': 0x490b8b1, 'attackPushResizeCallRva': 0x490b7e0,
    'nativeTypedValueCopiesVerified': False, 'nativeArrayResizeVerified': False,
    'nativePointerSpecializationVerified': False, 'liveValueStackStorageVerified': False,
}
# Decode only Stack<ObjectPtr<Object>>'s selected nested canonical signature.
# Do not broaden the shared direct-type specification reader.
pointer_stack_inst_table = v['offset'](v['quad'](v['b'], v['registration'] + 24))
pointer_stack_inst = v['offset'](v['quad'](v['b'], pointer_stack_inst_table + 12499 * 8))
assert v['quad'](v['b'], pointer_stack_inst) == 1
pointer_stack_args = v['offset'](v['quad'](v['b'], pointer_stack_inst + 8))
pointer_stack_arg = v['offset'](v['quad'](v['b'], pointer_stack_args))
pointer_stack_bits = v['uint'](v['b'], pointer_stack_arg + 8)
assert (pointer_stack_bits >> 16) & 255 == 21
pointer_stack_generic = v['offset'](v['quad'](v['b'], pointer_stack_arg))
pointer_stack_definition = v['offset'](v['quad'](v['b'], pointer_stack_generic))
assert v['quad'](v['b'], pointer_stack_definition) == 1324
assert v['types'][1324]['name'] == 'ObjectPtr`1'
assert (v['uint'](v['b'], pointer_stack_definition + 8) >> 16) & 255 == 17
pointer_stack_object_inst = v['offset'](v['quad'](v['b'], pointer_stack_generic + 8))
assert v['quad'](v['b'], pointer_stack_object_inst) == 1
pointer_stack_object_args = v['offset'](v['quad'](v['b'], pointer_stack_object_inst + 8))
pointer_stack_object = v['offset'](v['quad'](v['b'], pointer_stack_object_args))
assert v['quad'](v['b'], pointer_stack_object) == 37078 and v['types'][37078]['name'] == 'Object'
assert (v['uint'](v['b'], pointer_stack_object + 8) >> 16) & 255 == 28
pointer_stack_methods = []
for index, expected_definition, expected_entry in [(174542, 225124, 0x490a5c0), (174543, 225125, 0x490acc0),
    (174544, 225127, 0x490b6c0), (174545, 225128, 0x490b2a0)]:
    definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + index * 12)
    assert (definition, class_inst, method_inst) == (expected_definition, 12499, -1)
    row = c['unique'](lambda r: r['index'] == definition, v['types'][38203]['methods'])
    assert v['types'][38203]['name'] == 'Stack`1'
    mapping = priority['mapping'][index]
    entry = v['quad'](v['b'], priority['pointer_table'] + mapping['methodPointerIndex'] * 8) - v['image_base']
    assert entry == expected_entry
    pointer_stack_methods.append({'index': index, 'definition': row, 'declaringType': 'Stack`1', 'declaringTypeIndex': 38203,
        'classInstantiation': class_inst, 'methodInstantiation': method_inst,
        'nativeMapping': mapping, 'entryRva': entry, 'chunks': c['code'](entry)})
result['modeSwitch']['buffNotification']['newBuff']['managedPointerStack'] = {
    'canonicalMethods': pointer_stack_methods, 'valueWidth': 16, 'classInstantiation': 12499,
    'nestedSignature': {'definitionIndex': 1324, 'name': 'ObjectPtr`1', 'typeBits': pointer_stack_bits,
        'typeHex': v['b'][pointer_stack_arg:pointer_stack_arg + 16].hex(),
        'definitionTypeHex': v['b'][pointer_stack_definition:pointer_stack_definition + 16].hex(),
        'argument': {'typeIndex': 37078, 'name': 'Object', 'kind': 28,
            'typeHex': v['b'][pointer_stack_object:pointer_stack_object + 16].hex()}},
    'popVersionRva': 0x490ad17, 'popSizeRva': 0x490ad1e, 'popCopyRva': 0x490ad32,
    'popClearRva': 0x490ad4c, 'popReturnCopyRva': 0x490ad54,
    'pushTemporaryCopyRva': 0x490b6eb, 'pushResizeCallRva': 0x490b701,
    'resizeCallRva': 0x490b2e7, 'resizeArrayReloadRva': 0x490b2ea, 'resizeSizeReloadRva': 0x490b2f3,
    'nativeConcreteContextDispatchVerified': False, 'nativeArrayResizeVerified': False,
    'nativeGcBarrierVerified': False, 'livePointerStackStorageVerified': False,
}
array_resize_methods = []
for index, expected_entry in [(205814, 0x3e71cf0), (205813, 0x3e70400), (205845, 0x3e6bdf0), (205761, 0x3e70660)]:
    if index == 205761:
        definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + index * 12)
        assert (definition, class_inst, method_inst) == (216298, -1, 12499)
        spec = {'index': index, 'definition': c['unique'](lambda r: r['index'] == definition, c['type_row']('Array', 'System')['methods']),
            'declaringType': 'Array', 'declaringTypeIndex': c['type_row']('Array', 'System')['index'],
            'classInstantiation': class_inst, 'methodInstantiation': method_inst, 'nativeMapping': priority['mapping'][index],
            'nestedMethodArgument': result['modeSwitch']['buffNotification']['newBuff']['managedPointerStack']['nestedSignature']}
    else:
        spec = priority['specification'](index)
    assert spec['declaringType'] == 'Array' and spec['definition']['index'] == 216298
    entry = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8) - v['image_base']
    assert entry == expected_entry
    array_resize_methods.append({**spec, 'entryRva': entry, 'chunks': c['code'](entry)})
stack_type = v['types'][38203]
stack_token = v['uint'](v['m'], v['type_start'] + stack_type['index'] * 88 + 84)
stack_module = c['module']('mscorlib.dll')
stack_module_pos = v['offset'](v['image_base'] + stack_module['rva'])
stack_ranges = v['offset'](v['quad'](v['b'], stack_module_pos + 72))
stack_definitions = v['offset'](v['quad'](v['b'], stack_module_pos + 88))
stack_range = c['unique'](lambda r: r[0] == stack_token, [struct.unpack_from('<Iii', v['b'], stack_ranges + n * 12) for n in range(v['quad'](v['b'], stack_module_pos + 64))])
assert stack_range == (0x200061f, 1444, 8)
resize_rgctx = stack_definitions + (stack_range[1] + 7) * 16
assert v['uint'](v['b'], resize_rgctx) == 3
resize_descriptor = v['offset'](v['quad'](v['b'], resize_rgctx + 8))
assert v['sint'](v['b'], resize_descriptor) == 205737
assert struct.unpack_from('<iii', v['b'], priority['spec_start'] + 205737 * 12) == (216298, -1, 5331)
array_type = c['type_row']('Array', 'System')
copy_row = c['unique'](lambda r: r['index'] == 216439, array_type['methods'])
copy_table = v['offset'](v['image_base'] + stack_module['methodPointerTableRva'])
assert v['quad'](v['b'], copy_table + ((copy_row['token'] & 0xffffff) - 1) * 8) - v['image_base'] == 0x51ce8a0
copy_pos = v['method_start'] + copy_row['index'] * 32
copy_parameter_start = v['sint'](v['m'], copy_pos + 12)
assert struct.unpack_from('<H', v['m'], copy_pos + 30)[0] == 5
copy_parameters = []
for n in range(5):
    pos = v['uint'](v['m'], 88) + (copy_parameter_start + n) * 12
    copy_parameters.append({'index': copy_parameter_start + n, 'name': v['text'](v['uint'](v['m'], pos)), 'typeIndex': v['sint'](v['m'], pos + 8)})
assert [p['name'] for p in copy_parameters] == ['sourceArray', 'sourceIndex', 'destinationArray', 'destinationIndex', 'length']
result['modeSwitch']['buffNotification']['newBuff']['managedArrayResize'] = {
    'canonicalMethods': array_resize_methods,
    'stackGenericBinding': {'typeIndex': 38203, 'token': stack_token, 'start': 1444, 'length': 8, 'slot': 7,
        'specificationIndex': 205737, 'methodDefinition': 216298, 'methodInstantiation': 5331,
        'entryHex': v['b'][resize_rgctx:resize_rgctx + 16].hex(), 'descriptorHex': v['b'][resize_descriptor:resize_descriptor + 12].hex()},
    'copyTarget': {'definition': copy_row, 'entryRva': 0x51ce8a0, 'parameters': copy_parameters, 'bodyVerified': False},
    'referenceAllocateCallRva': 0x3e71d3b, 'referenceCopyLengthReadRva': 0x3e71d40,
    'referenceCopyCallRva': 0x3e71d63, 'referencePublishRva': 0x3e71d6b,
    'nativeClassInitializationAndAllocationVerified': False, 'nativeArrayCopyEffectsVerified': False,
    'nativeConcreteGenericDispatchVerified': False, 'liveArrayResizeVerified': False,
}
copy_method = c['method'](array_type, copy_row, 'mscorlib.dll')
assert copy_method['entryRva'] == 0x51ce8a0
methods.append(copy_method)
rank_entry = 0x489ae0
rank_pos = v['offset'](v['image_base'] + rank_entry)
rank_raw = v['b'][rank_pos:rank_pos + 11]
assert rank_raw.hex() == '488b010fb6802e010000c3'
assert v['b'][rank_pos + 11:rank_pos + 16] == bytes.fromhex('cc' * 5)
rank_decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(rank_raw, v['image_base'] + rank_entry))
assert [i.mnemonic for i in rank_decoded] == ['mov', 'movzx', 'ret'] and sum(i.size for i in rank_decoded) == 11
rank_chunks = [{'beginRva': rank_entry, 'endRva': rank_entry + 11, 'unwindRva': None,
    'boundary': 'Reviewed complete eleven-byte array class rank-byte load leaf; no stack changes; five following INT3 bytes',
    'base64': base64.b64encode(rank_raw).decode(), 'sha256': v['sha'](rank_raw),
    'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in rank_decoded]}]
result['modeSwitch']['buffNotification']['newBuff']['managedArrayCopy'] = {
    'method': {'index': copy_method['index'], 'image': 'mscorlib.dll', 'entryRva': copy_method['entryRva']},
    'rankReader': {'entryRva': rank_entry, 'chunks': rank_chunks},
    'fastCopy': {'entryRva': 0x4892f0, 'chunks': c['code'](0x4892f0)},
    'sourceNullTestRva': 0x51ce8cb, 'destinationNullTestRva': 0x51ce8d4, 'lengthTestRva': 0x51ce8e5,
    'sourceRankCallRva': 0x51ce8ee, 'destinationRankCallRva': 0x51ce8f8, 'rankComparisonRva': 0x51ce8fd,
    'sourceIndexTestRva': 0x51ce905, 'destinationIndexTestRva': 0x51ce90e,
    'fastCopyCallRva': 0x51ce928, 'fastCopyResultBranchRva': 0x51ce92f,
    'fallbackFirstCallRva': 0x51ce93a,
    'nativeFastCopyEffectsVerified': False, 'nativeFallbackConversionAndExceptionEffectsVerified': False,
    'nativeRuntimeArrayLayoutVerified': False, 'liveArrayCopyVerified': False,
}
fast_copy_leaves = []
for label, entry, expected_hex, padding, mnemonics in [
    ('length', 0x7990, '8b4118c3', 12, ['mov', 'ret']),
    ('valueType', 0x428be0, '8b4128c1e81fc3', 9, ['mov', 'shr', 'ret']),
    ('flagsBit2', 0x428890, '0fb68132010000c0e8022401c3', 3, ['movzx', 'shr', 'and', 'ret']),
    ('unbox', 0x388ec0, '488d4110c3', 11, ['lea', 'ret']),
    ('elementSizeThunk', 0x445270, 'e97b130000', 11, ['jmp']),
    ('elementSize', 0x4465f0, '8b8100010000c3', 9, ['mov', 'ret']),
]:
    pos = v['offset'](v['image_base'] + entry)
    raw = bytes.fromhex(expected_hex)
    assert v['b'][pos:pos + len(raw)] == raw and v['b'][pos + len(raw):pos + len(raw) + padding] == bytes.fromhex('cc' * padding)
    decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + entry))
    assert [i.mnemonic for i in decoded] == mnemonics and sum(i.size for i in decoded) == len(raw)
    fast_copy_leaves.append({'name': label, 'entryRva': entry, 'chunks': [{'beginRva': entry, 'endRva': entry + len(raw), 'unwindRva': None,
        'boundary': f'Reviewed complete no-stack-change leaf/thunk with {padding} following INT3 bytes; exact bytes pinned',
        'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]})
result['modeSwitch']['buffNotification']['newBuff']['managedArrayCopy']['fastCopyFlow'] = {
    'reviewedLeaves': fast_copy_leaves,
    'subclassProbe': {'entryRva': 0x428a40, 'chunks': c['code'](0x428a40)},
    'destinationClassReadRva': 0x489309, 'sourceClassReadRva': 0x48930f,
    'rankComparisonRva': 0x489323, 'sourceBoundsTestRva': 0x489330, 'destinationBoundsTestRva': 0x48933b,
    'destinationLengthCallRva': 0x489349, 'sourceLengthCallRva': 0x489369,
    'sourceElementReadRva': 0x489379, 'destinationElementReadRva': 0x489387,
    'boxedProbeCallRva': 0x4893bb, 'boxedZeroCallRva': 0x489404,
    'boxedUnboxCallRva': 0x48942c, 'boxedMoveCallRva': 0x489448, 'boxedNotifyCallRva': 0x489464,
    'firstSubclassCallRva': 0x4894c2, 'referenceCastCallRva': 0x4894eb, 'secondSubclassCallRva': 0x489510,
    'plainSizeCallRva': 0x48951c, 'plainMoveCallRva': 0x489549, 'plainNotifyCallRva': 0x489558,
    'nativeClassFieldOffsets': {'rank': 0x12e, 'elementClass': 0x40, 'typeBits': 0x28, 'flags132': 0x132, 'elementSize': 0x100},
    'nativeArrayFieldOffsets': {'bounds': 0x10, 'length': 0x18, 'data': 0x20},
    'nativeSubclassAndCastEffectsVerified': False, 'nativeMemoryAndGcEffectsVerified': False,
    'nativeExceptionConstructionVerified': False, 'liveFastCopyVerified': False,
}
context_struct_layouts = []
for type_index, width, expected in [(9524, 136, [
    ('m_source', 0), ('m_target', 16), ('m_value', 32), ('ignoreForSp', 40), ('sharedFlagMask', 44),
    ('ignoreMissFlag', 48), ('ignoreCancelReasonMask', 52), ('realDelta', 56), ('extraData', 64), ('customKeys', 72),
    ('<targetType>k__BackingField', 80), ('<deltaType>k__BackingField', 84), ('<damageType>k__BackingField', 88),
    ('<applyWay>k__BackingField', 92), ('<cancelReason>k__BackingField', 96), ('<attackType>k__BackingField', 100),
    ('<elementType>k__BackingField', 104), ('<originAtk>k__BackingField', 112), ('<originValue>k__BackingField', 120), ('<playerSide>k__BackingField', 128)]),
    (8913, 40, [('damageType', 0), ('originAtk', 8), ('atk', 16), ('atkScale', 24), ('atkAddition', 32)])]:
    t = v['types'][type_index]
    instance_fields = [{**f, 'unboxedOffset': f['offset'] - 16} for f in c['fields'](t) if not f['typeBits'] & 16]
    assert [(f['name'], f['unboxedOffset']) for f in instance_fields] == expected
    context_struct_layouts.append({'typeIndex': type_index, 'namespace': t['namespace'], 'name': t['name'], 'width': width,
        'boxedHeaderSize': 16, 'fields': instance_fields})
context_struct_generics = []
for name, expected_definition, expected_argument, expected_kind in [('m_source', 1324, 9044, 18), ('m_target', 1324, 9044, 18), ('customKeys', 38190, 36784, 14)]:
    field = c['unique'](lambda f: f['name'] == name, context_struct_layouts[0]['fields'])
    assert (field['typeBits'] >> 16) & 255 == 21
    generic = v['offset'](field['typeData'])
    definition_pos = v['offset'](v['quad'](v['b'], generic))
    definition_index = v['quad'](v['b'], definition_pos)
    assert definition_index == expected_definition
    inst = v['offset'](v['quad'](v['b'], generic + 8))
    assert v['quad'](v['b'], inst) == 1
    args = v['offset'](v['quad'](v['b'], inst + 8))
    argument_pos = v['offset'](v['quad'](v['b'], args))
    argument_index, argument_bits = v['quad'](v['b'], argument_pos), v['uint'](v['b'], argument_pos + 8)
    assert argument_index == expected_argument and (argument_bits >> 16) & 255 == expected_kind
    context_struct_generics.append({'field': name, 'definitionIndex': definition_index, 'definitionName': v['types'][definition_index]['name'],
        'definitionTypeHex': v['b'][definition_pos:definition_pos + 16].hex(),
        'argument': {'typeIndex': argument_index, 'name': v['types'][argument_index]['name'], 'kind': expected_kind,
            'typeHex': v['b'][argument_pos:argument_pos + 16].hex()}})
context_struct_enums = []
for index in [8705, 9523, 9521, 9519, 8704, 34298, 9522, 9520, 8706, 34292]:
    t = v['types'][index]
    underlying = c['unique'](lambda f: f['name'] == 'value__', c['fields'](t))
    assert (underlying['typeBits'] >> 16) & 255 == 8
    context_struct_enums.append({'typeIndex': index, 'name': t['name'], 'underlyingField': underlying})
fp_instance_fields = [f for f in c['fields'](v['types'][34370]) if not f['typeBits'] & 16]
assert len(fp_instance_fields) == 1 and fp_instance_fields[0]['name'] == '_serializedValue' and fp_instance_fields[0]['offset'] == 16
assert (fp_instance_fields[0]['typeBits'] >> 16) & 255 == 10
result['modeSwitch']['buffNotification']['newBuff']['contextStructLayouts'] = {
    'layouts': context_struct_layouts, 'genericFields': context_struct_generics, 'enumTypes': context_struct_enums,
    'fpType': {'typeIndex': 34370, 'name': 'FP', 'namespace': 'Torappu', 'instanceFields': fp_instance_fields},
    'nativePaddingAndByteEncodingVerified': False, 'nativeGcAndPointerAddressEffectsVerified': False,
    'liveTypedContextValuesVerified': False,
}
action_util_parameters = []
for index, expected_names in [(89084, ['nextAction', 'lastOneIsSucceed']),
    (89085, ['actions', 'sourceType', 'blackboard', 'snapshot']), (89086, ['actions', 'sourceType', 'blackboard'])]:
    row = c['unique'](lambda r: r['index'] == index, util['methods'])
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    arguments = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        type_index = v['sint'](v['m'], pp + 8)
        tp = v['offset'](v['quad'](v['b'], v['type_table'] + type_index * 8))
        arguments.append({'index': start + n, 'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': type_index,
            'typeData': v['quad'](v['b'], tp), 'typeBits': v['uint'](v['b'], tp + 8)})
    assert [p['name'] for p in arguments] == expected_names
    action_util_parameters.append({'methodIndex': index, 'name': row['name'], 'parameters': arguments})
assert action_util_parameters[1]['parameters'][1]['typeData'] == 12106
assert action_util_parameters[1]['parameters'][3]['typeData'] == action_snapshot_type['index']
assert action_util_parameters[1]['parameters'][3]['typeBits'] == 0x20110000
action_node_slots = []
for name, expected_slot in [('get_allowedSource', 4), ('get_executeCondition', 5), ('Execute', 6)]:
    row = c['unique'](lambda r: r['name'] == name, base_node['methods'])
    slot = struct.unpack_from('<H', v['m'], v['method_start'] + row['index'] * 32 + 28)[0]
    assert slot == expected_slot
    action_node_slots.append({**row, 'virtualSlot': slot})
empty_spec = priority['specification'](258790)
empty_canonical = priority['specification'](208287)
assert empty_spec['definition']['index'] == empty_canonical['definition']['index'] == 195680
assert empty_spec['nativeMapping'] is None and empty_spec['instantiations']['method']['arguments'][0]['name'] == 'ActionNode'
assert empty_canonical['instantiations']['method']['arguments'][0]['name'] == 'Object'
empty_entry = v['quad'](v['b'], priority['pointer_table'] + empty_canonical['nativeMapping']['methodPointerIndex'] * 8) - v['image_base']
assert empty_entry == 0x3f62450
empty_load_rva = 0xe44928
empty_load_pos = v['offset'](v['image_base'] + empty_load_rva)
assert v['b'][empty_load_pos:empty_load_pos + 3] == bytes.fromhex('488b15')
empty_load_target = empty_load_rva + 7 + struct.unpack_from('<i', v['b'], empty_load_pos + 3)[0]
empty_usage = v['quad'](v['b'], v['offset'](v['image_base'] + empty_load_target))
assert empty_usage >> 29 == 6 and (empty_usage & 0x1ffffffe) >> 1 == 258790
result['modeSwitch']['buffNotification']['newBuff']['actionUtil'] = {
    'parameters': action_util_parameters, 'nodeSlots': action_node_slots,
    'sourceTypes': c['enum'](v['types'][12106]), 'executeConditions': c['enum'](v['types'][12107]),
    'emptyCollection': {'loadRva': empty_load_rva, 'encodedUsage': empty_usage, 'concreteSpecification': empty_spec, 'canonicalSpecification': empty_canonical, 'entryRva': empty_entry, 'chunks': c['code'](empty_entry)},
    'conditionGetterCallRva': 0xe43deb, 'runBattleReadCallRva': 0xe4466d, 'runContextReadCallRva': 0xe44680,
    'captureCallRva': 0xe4469c, 'captureFirstCopyRva': 0xe446c3, 'runIntoCallRva': 0xe4473c, 'returnFirstCopyRva': 0xe4475b,
    'emptyCallRva': 0xe44932, 'countCallRva': 0xe4496c, 'nodeReadCallRva': 0xe44988,
    'allowedGetterCallRva': 0xe449be, 'sourceMaskAndRva': 0xe449c1, 'sourceMaskCompareRva': 0xe449c3,
    'conditionCallRva': 0xe449d1, 'executeCallRva': 0xe449f1, 'resultReadRva': 0xe449f6,
    'reportAllowedGetterCallRva': 0xe44a23, 'reportCallRva': 0xe44a78,
    'nativeHotfixAndClassInitializationVerified': False, 'nativeCollectionAndVirtualDispatchVerified': False,
    'nativeActionNodeEffectsVerified': False, 'liveActionUtilVerified': False,
}
predicate_fields = {}
for name, expected in [('CheckAbnormalFlag', [('_abnormalFlag', 16), ('_targetType', 20), ('_isUnset', 24), ('_abnormalFlagKey', 32)]),
    ('CheckAbnormalCombo', [('_abnormalCombo', 16), ('_targetType', 20), ('_isUnset', 24)])]:
    predicate_fields[name] = [f for f in fields[name] if not f['typeBits'] & 16]
    assert [(f['name'], f['offset']) for f in predicate_fields[name]] == expected
target_resolver = c['unique'](lambda r: r['name'] == 'GetActionTarget', nodes['methods'])
assert v['pointer'](target_resolver) - v['image_base'] == 0xced380
try:
    c['code'](0xced380)
except AssertionError as error:
    assert str(error) == 'Incomplete native chunk disassembly'
    target_reader_status = str(error)
else:
    raise AssertionError('Review newly readable target resolver before changing its evidence gate')
result['modeSwitch']['buffNotification']['newBuff']['predicateNodes'] = {
    'fields': predicate_fields, 'targetTypes': c['enum'](v['types'][12109]),
    'abnormalFlags': c['enum'](v['types'][34285]), 'abnormalCombos': c['enum'](v['types'][34286]),
    'targetResolver': {'declaringType': 'Nodes', 'definition': target_resolver, 'entryRva': 0xced380, 'bodyVerified': False, 'readerStatus': target_reader_status},
    'flagTargetReadRva': 0xd331c3, 'flagResolveCallRva': 0xd331cc, 'flagValidityCallRva': 0xd331f1,
    'flagKeyReadRva': 0xd331fa, 'flagEmptyCallRva': 0xd33200, 'flagFallbackReadRva': 0xd33213,
    'flagCurrentKeyReadRva': 0xd3321a, 'flagBlackboardReadRva': 0xd3322a,
    'flagInverseReadRva': 0xd33231, 'flagAttributesCallRva': 0xd3323f, 'flagQueryCallRva': 0xd33251, 'flagInvertRva': 0xd33256,
    'comboResolveCallRva': 0xd32ff8, 'comboValidityCallRva': 0xd3301d, 'comboInverseReadRva': 0xd33026,
    'comboAttributesCallRva': 0xd33034, 'comboValueReadRva': 0xd3303e, 'comboQueryCallRva': 0xd33047, 'comboInvertRva': 0xd3304c,
    'alwaysTrueRva': 0xd32b63, 'alwaysConditionZeroRva': 0xd32cac,
    'nativeEntitySelectionVerified': False, 'nativeUnityAndBlackboardEffectsVerified': False,
    'nativeAttributeQueryEffectsVerified': False, 'livePredicateNodeDispatchVerified': False,
}
context_stack_canonical = []
switch_node_unit = c['type_row']('Unit', 'Torappu.Battle')
switch_node_calls = []
for index, entry, names in [(68052, 0x855090, ['index', 'restartFSM']), (68054, 0x855260, ['restartFSM'])]:
    row = c['unique'](lambda r: r['index'] == index, switch_node_unit['methods'])
    record = c['method'](switch_node_unit, row)
    assert record['entryRva'] == entry
    if not any(m['index'] == index and m['image'] == record['image'] for m in methods):
        methods.append(record)
    pos = v['method_start'] + index * 32
    return_type = v['sint'](v['m'], pos + 8)
    return_pos = v['offset'](v['quad'](v['b'], v['type_table'] + return_type * 8))
    assert (v['uint'](v['b'], return_pos + 8) >> 16) & 255 == 1
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        parameters.append({'index': start + n, 'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    assert [p['name'] for p in parameters] == names
    switch_node_calls.append({'index': index, 'name': row['name'], 'entryRva': entry, 'returnKind': 1, 'parameters': parameters})
switch_node_type_load, switch_node_key_load = 0xd45f15, 0xd45f96
switch_node_usage = []
for rva, tag in [(switch_node_type_load, 1), (switch_node_key_load, 5)]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    target = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + target))
    assert usage >> 29 == tag
    switch_node_usage.append({'loadRva': rva, 'encodedUsage': usage, 'index': (usage & 0x1ffffffe) >> 1})
unit_type_pos = v['offset'](v['quad'](v['b'], v['type_table'] + switch_node_usage[0]['index'] * 8))
assert v['quad'](v['b'], unit_type_pos) == switch_node_unit['index']
mode_key_index = switch_node_usage[1]['index']
assert mode_key_index == 31621
mode_key_length, mode_key_data = struct.unpack_from('<II', v['m'], v['uint'](v['m'], 8) + mode_key_index * 8)
mode_key_pos = v['uint'](v['m'], 16) + mode_key_data
assert mode_key_length == 4 and v['m'][mode_key_pos:mode_key_pos + 4] == b'mode'
result['modeSwitch']['buffNotification']['newBuff']['switchModeNode'] = {
    'fields': [f for f in fields['SwitchMode'] if not f['typeBits'] & 16], 'unitCalls': switch_node_calls,
    'unitType': {**switch_node_usage[0], 'definitionIndex': switch_node_unit['index'], 'name': 'Unit'},
    'modeKey': {**switch_node_usage[1], 'length': 4, 'metadataFileOffset': mode_key_pos, 'hex': '6d6f6465', 'value': 'mode'},
    'targetReadRva': 0xd45f07, 'targetCallRva': 0xd45f10, 'validityCallRva': 0xd45f7f,
    'loadFlagReadRva': 0xd45f88, 'tryReadIntCallRva': 0xd45fa8, 'fallbackIndexReadRva': 0xd45fb7,
    'restoreFlagReadRva': 0xd45fc3, 'switchCallRva': 0xd45fd4, 'switchSuccessRva': 0xd45fd9,
    'restoreCallRva': 0xd45fe4, 'restoreSuccessRva': 0xd45fe9,
    'nativeUnitCastVerified': False, 'nativeBlackboardTryReadVerified': False, 'nativeUnitModeEffectsVerified': False, 'liveSwitchModeNodeVerified': False,
}
target_getter_methods = []
for type_index, name, entry in [(8933, 'get_owner', 0x39b6ff0), (8933, 'get_source', 0x39b7460),
    (8931, 'get_owner', 0x39d8230), (9524, 'get_source', 0x671d50), (9524, 'get_target', 0x671f30),
    (8742, 'get_owner', 0x3911530), (9558, 'get_source', 0x67e3d0), (9558, 'get_traceTarget', 0x67e6f0)]:
    t = v['types'][type_index]
    row = c['unique'](lambda r: r['name'] == name, t['methods'])
    record = c['method'](t, row)
    assert record['entryRva'] == entry
    if not any(m['index'] == row['index'] and m['image'] == record['image'] for m in methods):
        methods.append(record)
    target_getter_methods.append({'typeIndex': type_index, 'type': t['name'], 'name': name, 'index': row['index'], 'entryRva': entry})
target_getter_fields = []
for type_index, name, offset in [(8933, 'm_container', 16), (8933, 'm_source', 24), (8931, '<owner>k__BackingField', 16),
    (8742, 'm_owner', 72), (9558, 'm_source', 240), (9558, 'm_traceTarget', 272)]:
    t = v['types'][type_index]
    field = c['unique'](lambda f: f['name'] == name, c['fields'](t))
    assert field['offset'] == offset
    target_getter_fields.append({'typeIndex': type_index, 'type': t['name'], **field})
result['modeSwitch']['buffNotification']['newBuff']['targetGetters'] = {
    'methods': target_getter_methods, 'fields': target_getter_fields,
    'buffContainerReadRva': 0x39b7044, 'containerOwnerTailRva': 0x39b7054, 'containerOwnerReadRva': 0x39d826b,
    'buffSourceAddressRva': 0x39b74c7, 'buffSourceLockTailRva': 0x39b74d0,
    'modifierSourceAddressRva': 0x671dbd, 'modifierSourceLockTailRva': 0x671dc8,
    'modifierTargetAddressRva': 0x671f9d, 'modifierTargetLockTailRva': 0x671fa9,
    'abilityOwnerAddressRva': 0x391157f, 'abilityOwnerLockTailRva': 0x3911588,
    'projectileSourceAddressRva': 0x67e41f, 'projectileSourceLockTailRva': 0x67e42b,
    'projectileTraceAddressRva': 0x67e73f, 'projectileTraceLockTailRva': 0x67e74b,
    'nativeHotfixAndClassInitializationVerified': False, 'nativeConcretePointerLockDispatchVerified': False, 'liveTargetGettersVerified': False,
}
target_lock_specification = priority['specification'](253210)
assert target_lock_specification['declaringType'] == 'ObjectPtr`1' and target_lock_specification['definition']['name'] == 'Lock'
assert target_lock_specification['nativeMapping'] is None
assert target_lock_specification['instantiations']['class']['arguments'][0]['typeIndex'] == 9044
target_lock_loads = []
for rva in [0x39b74c0, 0x671db6, 0x671f96, 0x3911578, 0x67e418, 0x67e738]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == 253210
    target_lock_loads.append({'loadRva': rva, 'encodedUsage': usage})
result['modeSwitch']['buffNotification']['newBuff']['targetGetters'].update({'lockSpecification': target_lock_specification, 'lockLoads': target_lock_loads})
target_region = c['unique'](lambda region: region[0] == 0xced380, v['runtime'])
assert target_region == (0xced380, 0xced5c0, 0x7261558)
assert v['families'][v['parent'](target_region)] == [target_region]
target_pos = v['offset'](v['image_base'] + target_region[0])
target_raw = v['b'][target_pos:target_pos + 576]
target_code, target_table = target_raw[:532], target_raw[532:]
target_decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(target_code, v['image_base'] + 0xced380))
assert sum(i.size for i in target_decoded) == 532
target_entries = list(struct.unpack('<11I', target_table))
assert target_entries == [0xced3d4, 0xced3e3, 0xced3f1, 0xced40f, 0xced42d, 0xced457, 0xced481, 0xced493, 0xced49f, 0xced4f1, 0xced53b]
assert all(entry in {i.address - v['image_base'] for i in target_decoded} for entry in target_entries)
assert any(i.address - v['image_base'] == 0xced3c8 and i.op_str == 'ecx, dword ptr [rdx + rdi*4 + 0xced594]' for i in target_decoded)
result['modeSwitch']['buffNotification']['newBuff']['actionTargets'] = {
    'definition': target_resolver, 'entryRva': 0xced380,
    'region': {'beginRva': target_region[0], 'endRva': target_region[1], 'unwindRva': target_region[2], 'base64': base64.b64encode(target_raw).decode(), 'sha256': v['sha'](target_raw)},
    'code': {'beginRva': 0xced380, 'endRva': 0xced594, 'base64': base64.b64encode(target_code).decode(), 'sha256': v['sha'](target_code),
        'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in target_decoded]},
    'jumpTable': {'beginRva': 0xced594, 'endRva': 0xced5c0, 'base64': base64.b64encode(target_table).decode(), 'sha256': v['sha'](target_table), 'entries': target_entries},
    'boundary': 'Complete PE unwind region partitioned into 532 code bytes and eleven little-endian RVA entries; every case points to a decoded instruction',
    'nativeOwnerAndPointerEffectsVerified': False, 'nativeUnityEffectsVerified': False, 'nativeClassInitializationVerified': False, 'liveActionTargetsVerified': False,
}
for index in [24503, 24504, 24505, 24506, 24513, 24514, 24515, 24509, 24510, 24511, 24517, 24518, 24519]:
    spec = priority['specification'](index)
    assert spec['declaringType'] in ['ContextPtrStack`1', 'ContextValueStack`1'] and spec['nativeMapping'] is not None
    entry = v['quad'](v['b'], priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8) - v['image_base']
    if entry == 0x432a930:
        pos = v['offset'](v['image_base'] + entry)
        raw = v['b'][pos:pos + 22]
        assert raw.hex() == '488b4220488b90c0000000488b5210488b420848ffe0'
        assert v['b'][pos + 22:pos + 32] == bytes.fromhex('cc' * 10)
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + entry))
        assert [i.mnemonic for i in decoded] == ['mov', 'mov', 'mov', 'mov', 'jmp'] and sum(i.size for i in decoded) == 22
        chunks = [{'beginRva': entry, 'endRva': entry + 22, 'unwindRva': None,
            'boundary': 'Reviewed complete read-only RGCTX slot2 method tail-dispatch leaf; no stack changes; ten INT3 bytes follow',
            'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
            'instructions': [{'rva': i.address - v['image_base'], 'size': i.size, 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]
    else:
        chunks = c['code'](entry)
    context_stack_canonical.append({**spec, 'entryRva': entry, 'chunks': chunks})
context_stack_rgctx = []
context_stack_module = c['module']('Assembly-CSharp.dll')
context_stack_module_pos = v['offset'](v['image_base'] + context_stack_module['rva'])
context_stack_ranges = v['offset'](v['quad'](v['b'], context_stack_module_pos + 72))
context_stack_range_count = v['quad'](v['b'], context_stack_module_pos + 64)
context_stack_definitions = v['offset'](v['quad'](v['b'], context_stack_module_pos + 88))
context_stack_definition_count = v['quad'](v['b'], context_stack_module_pos + 80)
for type_index, expected_length, selected in [(8957, 10, [(2, 'ContextPtrStack`1', 'Peek'), (3, 'ObjectPtr', 'Wrap'),
    (4, 'Stack`1', 'Push'), (5, 'Stack`1', 'get_Count'), (6, 'Stack`1', 'Pop'), (7, 'ObjectPtr`1', 'Lock'), (9, 'Stack`1', 'Peek')]),
    (8958, 6, [(2, 'ContextValueStack`1', 'Peek'), (3, 'Stack`1', 'get_Count'), (4, 'Stack`1', 'Pop'), (5, 'Stack`1', 'Peek')])]:
    token = v['uint'](v['m'], v['type_start'] + type_index * 88 + 84)
    number, start, length, found_token = c['unique'](lambda row: row[3] == token,
        [(n, *struct.unpack_from('<Iii', v['b'], context_stack_ranges + n * 12)[1:], v['uint'](v['b'], context_stack_ranges + n * 12)) for n in range(context_stack_range_count)])
    assert length == expected_length and 0 <= start < start + length <= context_stack_definition_count
    bindings = []
    for slot, expected_owner, expected_name in selected:
        pos = context_stack_definitions + (start + slot) * 16
        assert v['uint'](v['b'], pos) == 3
        data = v['offset'](v['quad'](v['b'], pos + 8))
        spec_index = v['sint'](v['b'], data)
        definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], priority['spec_start'] + spec_index * 12)
        owner, row = c['unique'](lambda pair: pair[1]['index'] == definition, [(t, r) for t in v['types'] for r in t['methods']])
        assert owner['name'] == expected_owner and row['name'] == expected_name
        bindings.append({'slot': slot, 'kind': 3, 'specificationIndex': spec_index, 'definition': row,
            'declaringType': owner['name'], 'declaringTypeIndex': owner['index'], 'classInstantiation': class_inst, 'methodInstantiation': method_inst,
            'descriptorHex': v['b'][data:data + 12].hex(), 'entryHex': v['b'][pos:pos + 16].hex()})
    context_stack_rgctx.append({'typeIndex': type_index, 'name': v['types'][type_index]['name'], 'token': token, 'rangeIndex': number, 'start': start, 'length': length, 'bindings': bindings})
result['modeSwitch']['buffNotification']['newBuff']['contextStackOperations'] = {
    'canonicalMethods': context_stack_canonical, 'genericContextBindings': context_stack_rgctx,
    'pointerPeekCountCallRva': 0x4be7df8, 'pointerPeekCountBranchRva': 0x4be7dfc, 'pointerPeekStoredCallRva': 0x4be7e26,
    'pointerPeekCopyRva': 0x4be7e2f, 'pointerPeekLockCallRva': 0x4be7e44,
    'pointerPopCountCallRva': 0x4be7e88, 'pointerPopCountBranchRva': 0x4be7e8c, 'pointerPopStoredCallRva': 0x4be7eb6,
    'pointerPopCopyRva': 0x4be7ebf, 'pointerPopLockCallRva': 0x4be7ed4,
    'pointerWrapCallRva': 0x4be7f18, 'pointerPushReceiverTestRva': 0x4be7f1a, 'pointerPushCopyRva': 0x4be7f2b, 'pointerPushStoredCallRva': 0x4be7f41,
    'referencePeekCountBranchRva': 0x4be815c, 'referencePopCountBranchRva': 0x4be81cc,
    'modifierPeekCountBranchRva': 0x4be805e, 'modifierPopCountBranchRva': 0x4be824e,
    'nativeConcreteGenericContextVerified': False, 'nativeUnderlyingStackStorageVerified': False, 'nativeValueDefaultsAndCopiesVerified': False, 'liveContextStackOperationsVerified': False,
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
