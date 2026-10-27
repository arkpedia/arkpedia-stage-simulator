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
    'fields': {t['name']: c['fields'](t) for t in hierarchy},
    'resolvedSlots': [c['resolved_slot'](movement, slot) for slot in [19, 21, 22, 23, 30]],
    'review': [
        'The original CN component resolves to AdvancedMovement. The Windows signed-int MoveType enum assigns value1 to TRACE_TARGET_WITH_SPEED; this is static enum evidence, not proof of historical CN runtime dispatch.',
        'Six original serialized movement fields have no matching Windows hierarchy field. Their zero values are retained as explicit cross-version differences, not treated as proof of inertness or complete layout parity.',
        'OnInit and OnTick each subtract one from the selected movement value and bound the switch index to five before an image-relative six-entry jump table. Every chained PE unwind range and all table bytes are retained, and every table target is an actual decoded instruction boundary. The shared strict code reader remains unchanged.',
        'The selected value1 enters OnInit at 0xa7c3aa and OnTick at 0xa7ca2c. Slot23 resolves to BasicMovement.GetTraceTargetMapPosition, which keeps m_targetPos when the target mount-point reference no longer locks. Slot30 resolves to GetSpeed, whose default body returns the supplied speed rather than applying the estimate ratio.',
        'AdvancedMovement.DoCheckReached first calls BasicMovement.CheckReached. Its un-reached path dispatches slot22 to AdvancedMovement.DoCheckReachedInternal, which invokes slot21 BasicMovement.DealReached on proximity. DealReached sets m_reachedTarget before dispatching Behaviour.Reached -> Projectile.OnProjectileReached. The projectile sets its own reached flag before DealProjectileReached. Only after that return does AdvancedMovement.DoCheckReached call EnsureLifeTime, passing clearTraceTargetWhenReached, then schedule completion. Trace identity must not be cleared before arrival impact.',
        'The exact callback delegate method usage binds the complete two-tail-jump leaf. With comeBack=false it tails to Behaviour.Stop -> Projectile.StopMe. The separate BasicMovement.OnProjectileReached fix guard sets m_reachedTarget before its repeated check; no invented second arrival is required. Delayed scheduler dispatch/frame timing and remaining movement arithmetic remain unverified before delivery integration.'
    ]}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-movement-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows movement evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete movement methods including both embedded six-entry tables')
