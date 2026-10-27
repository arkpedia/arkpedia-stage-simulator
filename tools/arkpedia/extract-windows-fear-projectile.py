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
                  'OnProjectileReached', 'DealProjectileReached', 'StopMe', 'get_source', 'get_ability',
                  'Init', 'RegisterActions']),
    (hit, ['OnProjectileReached', 'DealHitTarget']),
    (c['type_row']('ActionController', ''), ['OnHitTarget', '_AttachBuffs', '_RunActions', 'Init', 'RegisterActions']),
    (c['type_row']('Ability', 'Torappu.Battle'), ['PreprocessActionsForProjectile', 'get_owner']),
    (c['type_row']('BattleController', 'Torappu.Battle'), ['CreateProjectile']),
    (c['type_row']('AbilityAttachment', 'Torappu.Battle'), ['Apply']),
    (c['type_row']('RangedAttack', 'Torappu.Battle.Abilities'), ['NewDamageNode', 'get_useCachedAtkOnly', 'GetProjectileActions', 'CreateProjectile']),
    (c['type_row']('AbstractAnimatedAbility', 'Torappu.Battle.Abilities'), ['NewDamageNode']),
    (c['type_row']('ApplyDamage', ''), ['PreprocessForProjectile', 'CreateDamageModifier', 'Execute', '.ctor']),
    (c['type_row']('BattleUtil', 'Torappu.Battle'), ['CalculateDamageBySource', 'CalculateDamageByAtkNoSource']),
    (c['type_row']('BObject', 'Torappu.Battle'), ['OnAllocate', 'OnRecycle']),
]:
    for name in names:
        rows = [r for r in t['methods'] if r['name'] == name]
        assert rows
        methods.extend(c['method'](t, row) for row in rows)

# Resolve the common-image null/destroyed predicate through its own module.
mod = c['module']('Torappu.Common.dll')
table = v['offset'](v['image_base'] + mod['methodPointerTableRva'])
common_rows = v['types'][mod['typeStart']:mod['typeStart'] + mod['typeCount']]
owner, null_row = c['unique'](lambda pair: True, [(t, m) for t in common_rows for m in t['methods']
    if v['quad'](b, table + ((m['token'] & 0xffffff) - 1) * 8) == v['image_base'] + 0x5a445f0])
assert owner['name'] == 'ObjectExtensions' and null_row['name'] == 'IsDestroyedOrNull'
methods.append(c['method'](owner, null_row, 'Torappu.Common.dll'))

source_load = 0x67e418
p = v['offset'](v['image_base'] + source_load)
assert b[p:p + 3] == bytes.fromhex('488b15')
source_slot = source_load + 7 + struct.unpack_from('<i', b, p + 3)[0]
source_usage = v['quad'](b, v['offset'](v['image_base'] + source_slot))
assert source_usage >> 29 == 6
source_index = (source_usage & 0x1ffffffe) >> 1
reg = v['registration']
source_spec = struct.unpack_from('<iii', b, v['offset'](v['quad'](b, reg + 72)) + source_index * 12)
object_ptr = c['type_row']('ObjectPtr`1', 'Torappu')
source_method = c['unique'](lambda row: row['index'] == source_spec[0], object_ptr['methods'])
assert source_method['name'] == 'Lock'
assert source_spec[2] == -1 and 0 <= source_spec[1] < v['quad'](b, reg + 16)
inst_table = v['offset'](v['quad'](b, reg + 24))
inst = v['offset'](v['quad'](b, inst_table + source_spec[1] * 8))
assert v['quad'](b, inst) == 1
args = v['offset'](v['quad'](b, inst + 8))
tp = v['offset'](v['quad'](b, args))
source_argument = v['types'][v['quad'](b, tp)]
assert (source_argument['namespace'], source_argument['name']) == ('Torappu.Battle', 'Entity')
thunk_rva = 0xb9be0
p = v['offset'](v['image_base'] + thunk_rva)
thunk = b[p:p + 5]
assert thunk[0] == 0xe9
assert thunk_rva + 5 + struct.unpack_from('<i', thunk, 1)[0] == 0x477cd80
interface_load = 0x477cdf0
p = v['offset'](v['image_base'] + interface_load)
assert b[p:p + 3] == bytes.fromhex('488b15')
interface_slot = interface_load + 7 + struct.unpack_from('<i', b, p + 3)[0]
interface_usage = v['quad'](b, v['offset'](v['image_base'] + interface_slot))
assert interface_usage >> 29 == 1
type_index = (interface_usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](b, v['type_table'] + type_index * 8))
interface = v['types'][v['quad'](b, tp)]
assert interface['name'] == 'IPtrObject' and [m['name'] for m in interface['methods']] == ['get_instanceUid']
uid = c['unique'](lambda f: f['name'] == '<instanceUid>k__BackingField', c['fields'](c['type_row']('BObject', 'Torappu.Battle')))
assert uid['offset'] == 0x18
source_reference = {
    'methodSpecIndex': source_index, 'encodedUsage': source_usage, 'method': source_method,
    'classInstantiationIndex': source_spec[1], 'methodInstantiationIndex': source_spec[2],
    'typeArgument': {'namespace': source_argument['namespace'], 'name': source_argument['name'], 'typeIndex': source_argument['index']},
    'declaredFields': object_ptr['fields'], 'instanceUidField': uid,
    'interface': {'typeIndex': interface['index'], 'name': interface['name'],
                  'encodedUsage': interface_usage, 'methods': interface['methods']},
    'lock': {'entryRva': 0x477cad0, 'chunks': c['code'](0x477cad0)},
    'validity': {'entryRva': 0x477cd80, 'chunks': c['code'](0x477cd80)},
    'validityThunk': {'entryRva': thunk_rva, 'targetRva': 0x477cd80,
                      'boundary': 'Reviewed exact five-byte unconditional tail jump; no stack changes or fallthrough',
                      'base64': base64.b64encode(thunk).decode(), 'sha256': v['sha'](thunk)},
    'concreteContextVerified': False,
}

# Bind both preprocessing interface casts through the actual metadata usages.
# The ordinary birth path asks the ability for its existing action list; it
# does not create an independently cached damage node for each projectile.
preprocess_bindings = []
for load in [0x390fbd5, 0x67b3b5]:
    p = v['offset'](v['image_base'] + load)
    assert b[p:p + 3] == bytes.fromhex('488b15')
    slot = load + 7 + struct.unpack_from('<i', b, p + 3)[0]
    usage = v['quad'](b, v['offset'](v['image_base'] + slot))
    assert usage >> 29 == 1
    index = (usage & 0x1ffffffe) >> 1
    tp = v['offset'](v['quad'](b, v['type_table'] + index * 8))
    interface = v['types'][v['quad'](b, tp)]
    assert (interface['namespace'], interface['name']) == ('Torappu.Battle.Action', 'IDamageOrHealSourceNode')
    assert [m['name'] for m in interface['methods']] == ['get_purposeMask', 'PreprocessForProjectile']
    preprocess_bindings.append({'callerLoadRva': load, 'encodedUsage': usage,
                               'typeIndex': interface['index'], 'name': interface['name'],
                               'namespace': interface['namespace'], 'methods': interface['methods']})
actions_field = c['unique'](lambda f: f['name'] == 'm_actions',
    c['fields'](c['type_row']('AbstractBasicAttack', 'Torappu.Battle.Abilities')))
assert actions_field['offset'] == 0x1f8
preprocessing = {
    'interfaceBindings': preprocess_bindings,
    'getActionsSlot': c['resolved_slot'](c['type_row']('RangedAttack', 'Torappu.Battle.Abilities'), 45),
    'preprocessSlot': c['resolved_slot'](c['type_row']('RangedAttack', 'Torappu.Battle.Abilities'), 65),
    'actionListField': actions_field,
    'rootInitEntryRva': 0x678950,
    'independentDamageNodePerProjectileVerified': False,
}

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
    'sourceReference': source_reference,
    'preprocessing': preprocessing,
    'damageNodeSlot': c['resolved_slot'](c['type_row']('RangedAttack', 'Torappu.Battle.Abilities'), 106),
    'methods': methods, 'lifeValueLeaf': leaf, 'prefabScriptBridges': bridges,
    'resolvedSlots': [c['resolved_slot'](simple, slot) for slot in [38, 39, 40, 41, 42, 43]],
    'review': [
        'SimpleProjectile uses raw-byte LifeType: LIMITED=1 and INFINITY=2. get_limitedHitNum returns hitNumType !=2, so the original _maxHitNum=1 is not an active one-hit limit in this default configuration.',
        'GetMaxHitNum passes the serialized value, byte hitNumType and safety value128 to Misc.GetLifeValue<int>. The exact complete leaf returns the safety argument for INFINITY, zero for IMMEDIATELY and the supplied value otherwise. Blackboard and block-count overrides are separately retained; the CN prefab disables both.',
        'Projectile.OnTick combines finite lifetime expiry with the virtual stopWhenSourceInvalid condition before its finish path. The CN prefab has finite life10 and stopWhenSourceInvalid=false. Born projectile ownership must therefore not be inferred solely from source death.',
        'ActionController.OnHitTarget calls _AttachBuffs first, then AbilityAttachment.Apply, then _RunActions. The selected projectile enables active buffs, disables trace-target-only and once-only buff gates, and has no extra buff list. Damage/source-attribute evaluation remains a separate caller review; buff-before-damage ordering must not be reversed by a convenience explosion helper.',
        'RangedAttack.NewDamageNode tests useCachedAtkOnly. Its false branch tail-calls AbstractAnimatedAbility.NewDamageNode, which constructs ordinary ApplyDamage rather than ApplyCacheAtkDamageFromProjectile. PreprocessForProjectile stores source ATK in m_cachedAtk; CreateDamageModifier uses CalculateDamageBySource when its source reference is valid and CalculateDamageByAtkNoSource with the cached value when the source is missing. Source-reference identity validity and reuse timing remain separate from merely testing an alive flag.',
        'Projectile.get_source loads the exact ObjectPtr Lock method specification. Its shared body reaches the reviewed validity tail-jump/body: IsDestroyedOrNull is checked first, then IPtrObject.instanceUid is compared with cachedUid. BObject.OnAllocate assigns an incremented UID and OnRecycle clears it to zero. The simulator must preserve output identity across a dead but unrecycled source and reject the replacement body after retirement/reuse. Concrete generic context and precise recycle/frame timing remain unverified.',
        'The ordinary birth chain is RangedAttack.CreateProjectile -> BattleController.CreateProjectile -> Projectile.Init at 0x678950 -> ActionController.Init -> ability virtual slot45 GetProjectileActions. In the default event0 branch RangedAttack passes its existing m_actions list through slot65 Ability.PreprocessActionsForProjectile before returning that same list. The preprocessor obtains ability.owner and invokes IDamageOrHealSourceNode slot1 on matching nodes. Ordinary ActionController.RegisterActions appends lists without preprocessing; explicit Projectile.RegisterActions has a separate boolean-gated preprocessing path using projectile.source. A per-projectile immutable damage-node cache is not proven by this path.',
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
