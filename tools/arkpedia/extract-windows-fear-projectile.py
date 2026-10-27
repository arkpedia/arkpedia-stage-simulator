#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default projectile hit/lifetime paths without admitting its controller."""
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
simple = c['type_row']('SimpleProjectile', 'Torappu.Battle')
projectile = c['type_row']('Projectile', 'Torappu.Battle')
hit = c['type_row']('HitBehaviour', 'Torappu.Battle.Projectiles')
methods = []
for t, names in [
    (simple, ['get_limitedHitNum', 'GetMaxHitNum', 'get_needLifeTime', 'GetLifeTime',
              'get_stopWhenSourceInvalid', 'get_stopAfterFirstHit', 'get_stopAfterMaxHit']),
    (projectile, ['OnTick', 'ExtraCheckToFinish', 'OnHitTarget', 'DealHitTarget', '_DealHitTraceTarget',
                  'OnProjectileReached', 'DealProjectileReached', 'StopMe', 'get_source', 'get_ability']),
    (hit, ['OnProjectileReached', 'DealHitTarget']),
    (c['type_row']('ActionController', ''), ['OnHitTarget', '_AttachBuffs', '_RunActions']),
    (c['type_row']('AbilityAttachment', 'Torappu.Battle'), ['Apply']),
    (c['type_row']('RangedAttack', 'Torappu.Battle.Abilities'), ['NewDamageNode', 'get_useCachedAtkOnly', 'GetProjectileActions']),
    (c['type_row']('AbstractAnimatedAbility', 'Torappu.Battle.Abilities'), ['NewDamageNode']),
    (c['type_row']('ApplyDamage', ''), ['PreprocessForProjectile', 'CreateDamageModifier', 'Execute', '.ctor']),
    (c['type_row']('BattleUtil', 'Torappu.Battle'), ['CalculateDamageBySource', 'CalculateDamageByAtkNoSource']),
]:
    for name in names:
        rows = [r for r in t['methods'] if r['name'] == name]
        assert rows
        methods.extend(c['method'](t, row) for row in rows)

# LifeType is an unsigned byte enum. Do not apply the signed int32 zigzag
# decoder used for Entity.Event/AbnormalFlag to these raw byte defaults.
life_field = c['unique'](lambda f: f['name'] == '_hitNumType', c['fields'](simple))
life = v['types'][life_field['typeData']]
value_field = c['unique'](lambda f: f['name'] == 'value__', life['fields'])
tp = v['offset'](v['quad'](b, v['type_table'] + value_field['typeIndex'] * 8))
assert (v['uint'](b, tp + 8) >> 16) & 255 == 5  # IL2CPP_TYPE_U1
enum_values = []
for field in life['fields']:
    if field['name'] == 'value__':
        continue
    ti, di = v['defaults'][field['index']]
    pos = v['uint'](v['m'], 72) + di
    enum_values.append({**field, 'defaultTypeIndex': ti, 'defaultFileOffset': pos,
                        'encodedHex': v['m'][pos:pos + 1].hex(), 'value': v['m'][pos]})
assert {f['name']: f['value'] for f in enum_values} == {'IMMEDIATELY': 0, 'LIMITED': 1, 'INFINITY': 2, 'CUSTOM': 3}

# The exact caller loads this method specification and calls this small leaf.
# Both return paths and the single internal branch are decoded and bounded;
# never use the next method pointer as its boundary or relax the shared reader.
call_load_rva = 0x6b7635
p = v['offset'](v['image_base'] + call_load_rva)
assert b[p:p + 3] == bytes.fromhex('4c8b0d')
slot = call_load_rva + 7 + struct.unpack_from('<i', b, p + 3)[0]
usage = v['quad'](b, v['offset'](v['image_base'] + slot))
assert usage >> 29 == 6 and usage & 1
index = (usage & 0x1ffffffe) >> 1
reg = v['registration']
assert index < v['quad'](b, reg + 64)
spec_pos = v['offset'](v['quad'](b, reg + 72)) + index * 12
definition, class_inst, method_inst = struct.unpack_from('<iii', b, spec_pos)
misc = c['type_row']('Misc', 'Torappu')
definition_row = c['unique'](lambda r: r['index'] == definition, misc['methods'])
assert definition_row['name'] == 'GetLifeValue' and class_inst == -1
assert 0 <= method_inst < v['quad'](b, reg + 16)
inst_table = v['offset'](v['quad'](b, reg + 24))
inst = v['offset'](v['quad'](b, inst_table + method_inst * 8))
assert v['quad'](b, inst) == 1
args = v['offset'](v['quad'](b, inst + 8))
tp = v['offset'](v['quad'](b, args))
argument = v['types'][v['quad'](b, tp)]
assert (argument['namespace'], argument['name']) == ('System', 'Int32')
rva, end = 0x402c5d0, 0x402c5e2
p = v['offset'](v['image_base'] + rva)
raw = b[p:p + end - rva]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + rva))
assert [(i.mnemonic, i.op_str) for i in decoded] == [
    ('test', 'dl, dl'), ('je', '0x18402c5df'), ('cmp', 'dl, 2'), ('cmovne', 'r8d, ecx'),
    ('mov', 'eax, r8d'), ('ret', ''), ('xor', 'eax, eax'), ('ret', '')]
assert sum(i.size for i in decoded) == len(raw)
leaf = {'type': 'Misc', **definition_row, 'methodSpecIndex': index, 'encodedUsage': usage,
         'methodInstantiationIndex': method_inst, 'callerLoadRva': call_load_rva,
         'typeArgument': {'namespace': argument['namespace'], 'name': argument['name'], 'typeIndex': argument['index']},
         'entryRva': rva, 'chunks': [{'beginRva': rva, 'endRva': end, 'unwindRva': None,
                                    'boundary': 'Reviewed complete two-return leaf with one internal branch, no calls or stack changes',
                                    'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                                    'instructions': [{'rva': i.address - v['image_base'], 'size': i.size,
                                                      'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]}

graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
binding_path = 'data/candidates/arkpedia-ch16-script-bindings-source.json'
graph = json.loads((ROOT / graph_path).read_bytes())
bindings = json.loads((ROOT / binding_path).read_bytes())
prefab = 'dyn/battle/prefabs/[uc]projectiles/projectile_enemy_fearpj.prefab'
bridges = []
for path_id, name, namespace in [('3827519080143594587', 'SimpleProjectile', 'Torappu.Battle'),
                                 ('-3651642949027093413', 'HitBehaviour', 'Torappu.Battle.Projectiles')]:
    row = c['unique'](lambda r: r['pathId'] == path_id, graph['projectiles'][prefab])
    binding = c['unique'](lambda r: r['prefab'] == prefab and r['componentPathId'] == path_id, bindings['bindings'])
    script = json.loads(bindings['scripts'][binding['scriptPathId']]['originalJson'])
    assert (script['m_ClassName'], script['m_Namespace']) == (name, namespace)
    assert binding['componentSha256'] == row['sha256'] == v['sha'](row['originalJson'].encode())
    t = c['type_row'](name, namespace)
    fields = {f['name']: {**f, 'declaringType': a['name']} for a in c['lineage'](t)
              if a['namespace'].startswith('Torappu.Battle') for f in c['fields'](a)}
    native = json.loads(row['originalJson'])
    unmatched = {k: val for k, val in native.items() if k not in fields and k not in ['m_Script', 'm_Enabled', 'm_GameObject', 'm_Name']}
    bridges.append({**binding, 'scriptIdentity': script, 'originalJson': row['originalJson'],
                    'fields': {k: fields[k] for k in native if k in fields},
                    'unmatchedSerializedFields': unmatched, 'serializedFieldParity': not unmatched})

result = {
    'schemaVersion': 1,
    'scope': 'Static default projectile hit/lifetime paths; no concrete runtime, cross-version/frame parity or admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'imageBase': v['image_base'], 'metadataVersion': 29,
    'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())} for p in [
        'data/arkpedia-global-windows-client-source.json', graph_path, binding_path]},
    'lifeType': {'typeIndex': life['index'], 'name': life['name'], 'underlyingType': 'System.Byte', 'fields': enum_values},
    'fields': {t['name']: c['fields'](t) for t in [simple, projectile, hit]},
    'damageFields': c['fields'](c['type_row']('ApplyDamage', '')),
    'damageNodeSlot': c['resolved_slot'](c['type_row']('RangedAttack', 'Torappu.Battle.Abilities'), 106),
    'methods': methods, 'lifeValueLeaf': leaf, 'prefabScriptBridges': bridges,
    'resolvedSlots': [c['resolved_slot'](simple, slot) for slot in [38, 39, 40, 41, 42, 43]],
    'review': [
        'SimpleProjectile uses raw-byte LifeType: LIMITED=1 and INFINITY=2. get_limitedHitNum returns hitNumType !=2, so the original _maxHitNum=1 is not an active one-hit limit in this default configuration.',
        'GetMaxHitNum passes the serialized value, byte hitNumType and safety value128 to Misc.GetLifeValue<int>. The exact complete leaf returns the safety argument for INFINITY, zero for IMMEDIATELY and the supplied value otherwise. Blackboard and block-count overrides are separately retained; the CN prefab disables both.',
        'Projectile.OnTick combines finite lifetime expiry with the virtual stopWhenSourceInvalid condition before its finish path. The CN prefab has finite life10 and stopWhenSourceInvalid=false. Born projectile ownership must therefore not be inferred solely from source death.',
        'ActionController.OnHitTarget calls _AttachBuffs first, then AbilityAttachment.Apply, then _RunActions. The selected projectile enables active buffs, disables trace-target-only and once-only buff gates, and has no extra buff list. Damage/source-attribute evaluation remains a separate caller review; buff-before-damage ordering must not be reversed by a convenience explosion helper.',
        'RangedAttack.NewDamageNode tests useCachedAtkOnly. Its false branch tail-calls AbstractAnimatedAbility.NewDamageNode, which constructs ordinary ApplyDamage rather than ApplyCacheAtkDamageFromProjectile. PreprocessForProjectile stores source ATK in m_cachedAtk; CreateDamageModifier uses CalculateDamageBySource when its source reference is valid and CalculateDamageByAtkNoSource with the cached value when the source is missing. Source-reference identity validity and reuse timing remain separate from merely testing an alive flag.',
        'Reached handling, trace-target end hit and HitBehaviour area selection/dispatch are retained in complete bodies. Cross-version field differences remain explicit. Source identity reuse, reentrant impact ordering and event5 self-death still require integration tests before admission.'
    ]}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows projectile evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete projectile methods, byte life enum and bounded life-value leaf')
