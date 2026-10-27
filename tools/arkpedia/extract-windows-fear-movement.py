#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default movement code, including both embedded switch tables."""
from pathlib import Path
import base64
import json
import runpy
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v, b = c['v'], c['b']
base = v['image_base']
movement = c['type_row']('AdvancedMovement', 'Torappu.Battle.Projectiles')
methods = [c['method'](movement, c['unique'](lambda r: r['name'] == name, movement['methods']))
           for name in ['Init', 'DoCheckReached', 'DoCheckReachedInternal', '_UpdateAfterReach',
                        'get_moveType', 'get_movementCalculator', 'get_isTwoPoint']]
behaviour = c['unique'](lambda t: t['name'] == 'Behaviour' and t['namespace'] == '', c['lineage'](movement))
for t, names in [
    (c['type_row']('BasicMovement', 'Torappu.Battle'), ['CheckReached', 'DealReached',
        'OnProjectileReached', 'GetTraceTargetMapPosition', 'OnProjectileStop']),
    (behaviour, ['Reached', 'Stop']),
    (movement, ['GetSpeed', 'get_speed']),
    (c['type_row']('Projectile', 'Torappu.Battle'), ['EnsureLifeTime', 'OnProjectileReached', 'DealProjectileReached']),
]:
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))

# The delayed completion callback has no unwind entry: retain its exact complete
# two-tail-jump leaf, checking both internal branches and the destination methods.
callback_row = c['unique'](lambda r: r['name'] == '<_UpdateAfterReach>b__75_0', movement['methods'])
assert v['pointer'](callback_row) == base + 0xa7d790
callback_begin, callback_end = 0xa7d790, 0xa7d7b0
p = v['offset'](base + callback_begin)
callback_raw = b[p:p + callback_end - callback_begin]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(callback_raw, base + callback_begin))
assert [(i.mnemonic, i.op_str) for i in decoded] == [
    ('cmp', 'byte ptr [rcx + 0xc0], 0'), ('je', '0x180a7d7a9'),
    ('cmp', 'byte ptr [rcx + 0x108], 0'), ('jne', '0x180a7d7a9'),
    ('xor', 'edx, edx'), ('jmp', '0x180a7b410'),
    ('xor', 'edx, edx'), ('jmp', '0x1806a8e00')]
assert sum(i.size for i in decoded) == len(callback_raw)
assert v['pointer'](c['unique'](lambda r: r['name'] == 'Comeback', movement['methods'])) == base + 0xa7b410
assert v['pointer'](c['unique'](lambda r: r['name'] == 'Stop', behaviour['methods'])) == base + 0x6a8e00
callback = {'type': movement['name'], **callback_row, 'entryRva': callback_begin,
    'chunks': [{'beginRva': callback_begin, 'endRva': callback_end, 'unwindRva': None,
                'boundary': 'Reviewed complete two-tail-jump leaf with two internal branches; no calls or stack changes',
                'sha256': v['sha'](callback_raw), 'base64': base64.b64encode(callback_raw).decode(),
                'instructions': [{'rva': i.address - base, 'size': i.size,
                                  'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]}
load = 0xa7d83c
p = v['offset'](base + load)
assert b[p:p + 3] == bytes.fromhex('4c8b05')
usage_slot = load + 7 + struct.unpack_from('<i', b, p + 3)[0]
usage = v['quad'](b, v['offset'](base + usage_slot))
assert usage >> 29 == 3 and (usage & 0x1ffffffe) >> 1 == callback_row['index']
callback['delegateLoadRva'] = load
callback['encodedUsage'] = usage

# Retain the actual invocation specification and independently mapped canonical
# reference bodies. Do not infer an independent concrete RGCTX specialization.
priority = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
load = 0xa7d879
p = v['offset'](base + load)
assert b[p:p + 3] == bytes.fromhex('488b05')
slot = load + 7 + struct.unpack_from('<i', b, p + 3)[0]
usage = v['quad'](b, v['offset'](base + slot))
assert usage >> 29 == 6
concrete_delay = priority['specification']((usage & 0x1ffffffe) >> 1)
assert concrete_delay['declaringType'] == 'AsyncUtil'
assert concrete_delay['definition']['name'] == 'InvokeAsyncFixedSeconds'
assert concrete_delay['instantiations']['method']['arguments'][0]['name'] == 'AdvancedMovement'
assert concrete_delay['nativeMapping'] is None
delay_bodies = []
for index, expected in [(207531, 0x3f2bbf0), (207539, 0x3f2bf40), (2813, 0x4695170)]:
    spec = priority['specification'](index)
    ptr = v['quad'](b, priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8)
    assert ptr == base + expected
    delay_bodies.append({**spec, 'entryRva': expected, 'chunks': c['code'](expected)})
assert concrete_delay['definition'] == delay_bodies[0]['definition']
delay = {'callerLoadRva': load, 'encodedUsage': usage, 'concreteSpecification': concrete_delay,
         'concreteContextVerified': False, 'canonicalBodies': delay_bodies,
         'genericPointerTableRva': v['address'](priority['pointer_table']) - base,
         'pointerAnchors': [priority['filter_spec'], priority['math_spec']]}
async_type = c['type_row']('AsyncUtil', 'Torappu.Battle')
waiter = c['unique'](lambda t: t['name'] == '<WaitForFixedSeconds>d__0',
                     [v['types'][index] for index in async_type['nested']])
for t, index in [(async_type, 55607), (waiter, 55629),
                  (c['type_row']('BattleController', 'Torappu.Battle'), 56201)]:
    methods.append(c['method'](t, c['unique'](lambda r: r['index'] == index, t['methods'])))
delay['floatWaiterFields'] = c['fields'](waiter)

math_type = c['type_row']('MathUtil', 'Torappu')
distance = c['method'](math_type, c['unique'](lambda r: r['index'] == 196179, math_type['methods']), 'Torappu.Common.dll')
assert distance['name'] == 'CheckDistance' and distance['entryRva'] == 0x5a40470
methods.append(distance)
load = 0xa7baa3
p = v['offset'](base + load)
assert b[p:p + 4] == bytes.fromhex('f30f1015')
tolerance_rva = load + 8 + struct.unpack_from('<i', b, p + 4)[0]
p = v['offset'](base + tolerance_rva)
tolerance_raw = b[p:p + 4]
assert tolerance_raw.hex() == 'cdcccc3d'
tolerance = {'callerLoadRva': load, 'valueRva': tolerance_rva, 'hex': tolerance_raw.hex(),
             'float32': struct.unpack('<f', tolerance_raw)[0], 'dimensions': 3,
             'comparison': 'inclusive squared float32 distance'}

for name, names in [
    ('BasicMovement', ['Init', 'OnInit']), ('MountPoint', ['get_mapPositionV3']),
    ('Unit', ['GetMountPoint']), ('MapUtil', ['WorldToMapPosV3']),
]:
    t = c['type_row'](name, 'Torappu.Battle')
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))
map_type = c['type_row']('Map', 'Torappu.Battle')
methods.append(c['method'](map_type, c['unique'](lambda r: r['index'] == 60931, map_type['methods'])))
load = 0x662e87
p = v['offset'](base + load)
assert b[p:p + 3] == bytes.fromhex('4c8b05')
slot = load + 7 + struct.unpack_from('<i', b, p + 3)[0]
usage = v['quad'](b, v['offset'](base + slot))
assert usage >> 29 == 1
tp = v['offset'](v['quad'](b, v['type_table'] + ((usage & 0x1ffffffe) >> 1) * 8))
locatable = v['types'][v['quad'](b, tp)]
assert (locatable['namespace'], locatable['name']) == ('Torappu.Battle', 'ILocatable')
assert locatable['methods'][1]['name'] == 'get_mapPositionV3'
ranged = c['type_row']('RangedAttack', 'Torappu.Battle.Abilities')
mount_fields = {name: c['unique'](lambda f: f['name'] == name, c['fields'](ranged))
                for name in ['_mountPointType', '_projectileDestination']}
mount_mapping = {'locatable': {**locatable, 'callerLoadRva': load, 'encodedUsage': usage},
                 'castFields': mount_fields,
                 'enums': {name: c['enum'](v['types'][field['typeData']]) for name, field in mount_fields.items()},
                 'sourceMountSlot': c['resolved_slot'](c['type_row']('Enemy', 'Torappu.Battle'), 90),
                 'unitToMountPointMappingVerified': False}

# These direct movement-call helpers have complete PE ranges but no separately
# resolved metadata identity. Bind the actual caller RVAs and bodies explicitly.
arithmetic_helpers = []
for name, rva, caller in [('normalize', 0x511250, 0xa7cad0), ('magnitude', 0x72eb40, 0xa7ce50)]:
    arithmetic_helpers.append({'role': name, 'entryRva': rva, 'callerRva': caller,
                               'metadataIdentityVerified': False, 'chunks': c['code'](rva)})
load = 0x5112f4
p = v['offset'](base + load)
assert b[p:p + 3] == bytes.fromhex('0f2f1d')
epsilon_rva = load + 7 + struct.unpack_from('<i', b, p + 3)[0]
p = v['offset'](base + epsilon_rva)
epsilon_raw = b[p:p + 4]
assert epsilon_raw.hex() == 'acc52737'
normalization_epsilon = {'callerLoadRva': load, 'valueRva': epsilon_rva,
                         'hex': epsilon_raw.hex(), 'float32': struct.unpack('<f', epsilon_raw)[0]}


def mixed_method(name, entry_rva, table_rva, end_rva, dispatch):
    row = c['unique'](lambda r: r['name'] == name, movement['methods'])
    assert v['pointer'](row) == base + entry_rva
    root = c['unique'](lambda r: r[0] == entry_rva, v['runtime'])
    ranges = v['families'][v['parent'](root)]
    assert ranges[-1][1] == end_rva == table_rva + 6 * 4
    chunks, all_instructions, tables = [], {}, []
    for begin, end, unwind in ranges:
        p = v['offset'](base + begin)
        raw = b[p:p + end - begin]
        code_end = table_rva if begin <= table_rva < end else end
        code_bytes = raw[:code_end - begin]
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(code_bytes, base + begin))
        assert sum(i.size for i in decoded) == len(code_bytes)
        instructions = [{'rva': i.address - base, 'size': i.size,
                         'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]
        all_instructions.update({i['rva']: i for i in instructions})
        chunk = {'beginRva': begin, 'endRva': end, 'unwindRva': unwind,
                 'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                 'instructions': instructions}
        if code_end != end:
            assert end == end_rva
            table_bytes = raw[code_end - begin:]
            targets = list(struct.unpack('<6I', table_bytes))
            chunk['codeRange'] = {'beginRva': begin, 'endRva': code_end, 'sha256': v['sha'](code_bytes)}
            chunk['jumpTable'] = {'beginRva': code_end, 'endRva': end, 'entryBytes': 4,
                                  'count': 6, 'indexBias': -1, 'sha256': v['sha'](table_bytes),
                                  'targetRvas': targets}
            tables.append(chunk['jumpTable'])
        chunks.append(chunk)
    assert len(tables) == 1
    assert all(target in all_instructions for target in tables[0]['targetRvas'])
    for rva, mnemonic, operands in dispatch:
        assert all_instructions[rva]['mnemonic'] == mnemonic
        assert all_instructions[rva]['operands'] == operands
    assert all_instructions[table_rva - 1]['mnemonic'] == 'nop'
    p = v['method_start'] + row['index'] * 32
    return {'image': 'Assembly-CSharp.dll', 'typeIndex': movement['index'],
            'namespace': movement['namespace'], 'type': movement['name'], **row,
            'virtualSlot': struct.unpack_from('<H', v['m'], p + 28)[0],
            'parameterCount': struct.unpack_from('<H', v['m'], p + 30)[0],
            'entryRva': entry_rva, 'chunks': chunks,
            'dispatcher': [{'rva': rva, 'mnemonic': op, 'operands': args} for rva, op, args in dispatch]}


methods.append(mixed_method('OnInit', 0xa7c1a0, 0xa7c780, 0xa7c798, [
    (0xa7c37d, 'mov', 'eax, dword ptr [rbx + 0xa8]'),
    (0xa7c383, 'dec', 'eax'), (0xa7c38c, 'cmp', 'eax, 5'),
    (0xa7c38f, 'ja', '0x180a7c5ba'),
    (0xa7c395, 'lea', 'rdx, [rip - 0xa7c39c]'), (0xa7c39c, 'cdqe', ''),
    (0xa7c39e, 'mov', 'ecx, dword ptr [rdx + rax*4 + 0xa7c780]'),
    (0xa7c3a5, 'add', 'rcx, rdx'), (0xa7c3a8, 'jmp', 'rcx')]))
methods.append(mixed_method('OnTick', 0xa7c850, 0xa7d598, 0xa7d5b0, [
    (0xa7ca06, 'mov', 'eax, dword ptr [rdi + 0xa8]'),
    (0xa7ca0c, 'dec', 'eax'), (0xa7ca0e, 'cmp', 'eax, 5'),
    (0xa7ca11, 'ja', '0x180a7d461'),
    (0xa7ca17, 'lea', 'rdx, [rip - 0xa7ca1e]'), (0xa7ca1e, 'cdqe', ''),
    (0xa7ca20, 'mov', 'ecx, dword ptr [rdx + rax*4 + 0xa7d598]'),
    (0xa7ca27, 'add', 'rcx, rdx'), (0xa7ca2a, 'jmp', 'rcx')]))

graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
binding_path = 'data/candidates/arkpedia-ch16-script-bindings-source.json'
graph = json.loads((ROOT / graph_path).read_bytes())
bindings = json.loads((ROOT / binding_path).read_bytes())
prefab = 'dyn/battle/prefabs/[uc]projectiles/projectile_enemy_fearpj.prefab'
path_id = '4186589668486489179'
component = c['unique'](lambda r: r['pathId'] == path_id, graph['projectiles'][prefab])
binding = c['unique'](lambda r: r['prefab'] == prefab and r['componentPathId'] == path_id, bindings['bindings'])
script = json.loads(bindings['scripts'][binding['scriptPathId']]['originalJson'])
assert (script['m_ClassName'], script['m_Namespace']) == ('AdvancedMovement', 'Torappu.Battle.Projectiles')
assert binding['componentSha256'] == component['sha256'] == v['sha'](component['originalJson'].encode())
native = json.loads(component['originalJson'])
hierarchy = [t for t in c['lineage'](movement) if t['namespace'].startswith('Torappu.Battle')]
fields = {f['name']: {**f, 'declaringType': t['name']} for t in hierarchy for f in c['fields'](t)}
unmatched = {k: val for k, val in native.items() if k not in fields and k not in ['m_Script', 'm_Enabled', 'm_GameObject', 'm_Name']}
assert unmatched == {k: 0 for k in ['_adjustSourceToTargetArcAngleBySourceFace',
    '_drawFuncTurnAndWaveDebugLine', '_fixProjectileHasReached', '_fixProjectileZWhenReached',
    '_rotateToTargetOnDelayToStart', '_sourceToTargetArcAngle']}
move_type = c['enum'](v['types'][fields['_moveType']['typeData']])
assert next(f for f in move_type['fields'] if f['value'] == native['_moveType'])['name'] == 'TRACE_TARGET_WITH_SPEED'
result = {
    'schemaVersion': 1,
    'scope': 'Static movement and complete mixed code/table ranges; no runtime/frame/cross-version parity or admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'imageBase': base, 'metadataVersion': 29,
    'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())} for p in [
        'data/arkpedia-global-windows-client-source.json', graph_path, binding_path]},
    'component': {**binding, 'scriptIdentity': script, 'originalJson': component['originalJson'],
                  'matchedFields': {k: fields[k] for k in native if k in fields},
                  'unmatchedSerializedFields': unmatched, 'serializedFieldParity': not unmatched},
    'moveType': move_type, 'methods': methods, 'completionCallback': callback,
    'completionDelay': delay, 'arrivalTolerance': tolerance,
    'mountMapping': mount_mapping, 'arithmeticHelpers': arithmetic_helpers,
    'normalizationEpsilon': normalization_epsilon,
    'fields': {t['name']: c['fields'](t) for t in hierarchy},
    'resolvedSlots': [c['resolved_slot'](movement, slot) for slot in [19, 21, 22, 23, 30]],
    'review': [
        'The original CN component resolves to AdvancedMovement. The Windows signed-int MoveType enum assigns value1 to TRACE_TARGET_WITH_SPEED; this is static enum evidence, not proof of historical CN runtime dispatch.',
        'Six original serialized movement fields have no matching Windows hierarchy field. Their zero values are retained as explicit cross-version differences, not treated as proof of inertness or complete layout parity.',
        'OnInit and OnTick each subtract one from the selected movement value and bound the switch index to five before an image-relative six-entry jump table. Every chained PE unwind range and all table bytes are retained, and every table target is an actual decoded instruction boundary. The shared strict code reader remains unchanged.',
        'The selected value1 enters OnInit at 0xa7c3aa and OnTick at 0xa7ca2c. Slot23 resolves to BasicMovement.GetTraceTargetMapPosition, which keeps m_targetPos when the target mount-point reference no longer locks. Slot30 resolves to GetSpeed, whose default body returns the supplied speed rather than applying the estimate ratio.',
        'AdvancedMovement.DoCheckReached first calls BasicMovement.CheckReached. Its un-reached path dispatches slot22 to AdvancedMovement.DoCheckReachedInternal, which invokes slot21 BasicMovement.DealReached on proximity. DealReached sets m_reachedTarget before dispatching Behaviour.Reached -> Projectile.OnProjectileReached. The projectile sets its own reached flag before DealProjectileReached. Only after that return does AdvancedMovement.DoCheckReached call EnsureLifeTime, passing clearTraceTargetWhenReached, then schedule completion. Trace identity must not be cleared before arrival impact.',
        'The exact callback delegate method usage binds the complete two-tail-jump leaf. With comeBack=false it tails to Behaviour.Stop -> Projectile.StopMe. The separate BasicMovement.OnProjectileReached fix guard sets m_reachedTarget before its repeated check; no invented second arrival is required. Delayed scheduler dispatch/frame timing and remaining movement arithmetic remain unverified before delivery integration.',
        'The completion call loads InvokeAsyncFixedSeconds<AdvancedMovement>. Its independently mapped Object canonical wrapper and coroutine bodies are retained without claiming concrete RGCTX execution. The float WaitForFixedSeconds iterator calculates a frame count, clamps it to at least one, and yields before incrementing its frame index. A configured zero delay must not be replaced with a same-stack stop callback; precise battle-coroutine scheduling and cancellation still require separate integration evidence.',
        'The arrival proximity constant is float32 0.1. The separately image-bound Torappu.Common MathUtil.CheckDistance squares all three float32 coordinate deltas, adds the y/x/z squares and inclusively compares against the squared tolerance. This is neither exact coordinate equality nor an unverified two-dimensional radius.',
        'BasicMovement.OnInit obtains source and target mapPositionV3 through the exact ILocatable interface slot1. The selected RangedAttack mountPointType2 is MUZZLE in the Windows enum; its source call dispatches Enemy slot90 to Unit.GetMountPoint. MountPoint.get_mapPositionV3 calls MapUtil.WorldToMapPosV3 and Map.WorldToMapPositionV3. Runtime unit-to-mount-point mapping, native camera/scene transforms and historical CN field parity remain unverified; no fixed tile-center height is inferred.',
        'Selected movement calls the retained complete normalization and magnitude helper bodies. The normalization body sums float32 y/x/z squares, rounds the square-root result to float32, uses a strict greater-than float32 1e-5 magnitude threshold and divides each component at float32 precision. The movement branch compares float32 speed*delta with magnitude, snaps on greater-or-equal, or applies component*delta then *speed before adding position. Helpers have bound callers and complete bytes but no separately verified metadata identity. Effective-delta scaling and mount-point tracking remain caller/integration obligations.'
    ]}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-movement-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows movement evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete movement methods including both embedded six-entry tables')
