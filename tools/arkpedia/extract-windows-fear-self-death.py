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
