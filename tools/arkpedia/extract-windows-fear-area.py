#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain arrival collider/query/filter evidence without claiming physics parity."""
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
methods = []
for name, namespace, names in [
    ('HitBehaviour', 'Torappu.Battle.Projectiles', ['Init', 'OnProjectileReached', 'DealHitTarget']),
    ('CircleRange', 'Torappu.Battle', ['get_radius', 'FetchColliders', 'InitCollidersIfNot', 'UpdateExtend']),
    ('Box2dPhysicsUtil', 'Torappu.Battle', ['FindTargets_DISPOSE', '_OverlapCollider', 'CheckOverlap', 'GetWorldRadius']),
    ('TargetOptions', 'Torappu.Battle', ['Init', 'VerifyTargetWithoutCheckingTargetSide', '_VerifyAdvanced',
        '_TryGetSourceMotionMode', '_InitSourceSnapshot']),
    ('BattleUtil', 'Torappu.Battle', ['GetLayerMask', 'VerifyTarget', 'CheckProfessionMask']),
    ('Entity', 'Torappu.Battle', ['OnProjectileSelectTargets', 'get_isTargetFree',
        'get_isAllyTargetFree', 'get_changeableMotionMode', 'isStillMotionTargetFreeWithImmuneFlag',
        'isMotionTargetFreeWithImmuneFlag']),
    ('Character', 'Torappu.Battle', ['isStillMotionTargetFreeWithImmuneFlag']),
    ('Enemy', 'Torappu.Battle', ['_InitPhysics', 'get_ColliderRadius']),
    ('Map', 'Torappu.Battle', ['WorldToMapPositionV3']),
]:
    t = c['type_row'](name, namespace)
    for name in names:
        rows = [r for r in t['methods'] if r['name'] == name]
        assert rows
        methods.extend(c['method'](t, row) for row in rows)

options = c['type_row']('TargetOptions', 'Torappu.Battle')
get_layer = c['unique'](lambda r: r['name'] == 'GetLayerMask', options['methods'])
assert v['pointer'](get_layer) == base + 0x787570
p = v['offset'](base + 0x787570)
raw = b[p:p + 10]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, base + 0x787570))
assert [(i.mnemonic, i.op_str) for i in decoded] == [
    ('mov', 'ecx, dword ptr [rcx + 0x44]'), ('xor', 'edx, edx'), ('jmp', '0x180876380')]
assert sum(i.size for i in decoded) == len(raw)
layer_leaf = {'type': 'TargetOptions', **get_layer, 'entryRva': 0x787570,
    'chunks': [{'beginRva': 0x787570, 'endRva': 0x78757a, 'unwindRva': None,
                'boundary': 'Reviewed exact three-instruction tail-jump leaf; no calls, stack changes or fallthrough',
                'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                'instructions': [{'rva': i.address - base, 'size': i.size,
                                  'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]}

graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
binding_path = 'data/candidates/arkpedia-ch16-script-bindings-source.json'
graph = json.loads((ROOT / graph_path).read_bytes())
bindings = json.loads((ROOT / binding_path).read_bytes())
prefab = 'dyn/battle/prefabs/[uc]projectiles/projectile_enemy_fearpj.prefab'
rows = graph['projectiles'][prefab]
bridges = []
for path_id, name, ns in [('4624766879530493019', 'CircleRange', 'Torappu.Battle'),
                          ('-3651642949027093413', 'HitBehaviour', 'Torappu.Battle.Projectiles')]:
    row = c['unique'](lambda r: r['pathId'] == path_id, rows)
    binding = c['unique'](lambda r: r['prefab'] == prefab and r['componentPathId'] == path_id, bindings['bindings'])
    script = json.loads(bindings['scripts'][binding['scriptPathId']]['originalJson'])
    assert (script['m_ClassName'], script['m_Namespace']) == (name, ns)
    assert binding['componentSha256'] == row['sha256'] == v['sha'](row['originalJson'].encode())
    t = c['type_row'](name, ns)
    fields = {f['name']: {**f, 'declaringType': ancestor['name']} for ancestor in c['lineage'](t)
              if ancestor['namespace'].startswith('Torappu.Battle') or ancestor['index'] == t['index']
              for f in c['fields'](ancestor)}
    native = json.loads(row['originalJson'])
    unmatched = {k: val for k, val in native.items() if k not in fields and k not in ['m_Script', 'm_Enabled', 'm_GameObject', 'm_Name']}
    bridges.append({**binding, 'scriptIdentity': script, 'originalJson': row['originalJson'],
                    'matchedFields': {k: fields[k] for k in native if k in fields},
                    'unmatchedSerializedFields': unmatched, 'serializedFieldParity': not unmatched})
geometry = {}
for role, path_id, component_type in [
    ('collider', '-1252346135216839589', 'CircleCollider2D'),
    ('transform', '4060486982346286171', 'Transform'),
    ('gameObject', '2677365147323147355', 'GameObject'),
]:
    row = c['unique'](lambda r: r['pathId'] == path_id, rows)
    assert row['componentType'] == component_type and v['sha'](row['originalJson'].encode()) == row['sha256']
    geometry[role] = row
collider = json.loads(geometry['collider']['originalJson'])
transform = json.loads(geometry['transform']['originalJson'])
go = json.loads(geometry['gameObject']['originalJson'])
assert collider['m_Radius'] == 1 and collider['m_Offset'] == {'x': 0, 'y': 0}
assert collider['m_IsTrigger'] and collider['m_Enabled'] == 1
assert transform['m_LocalScale'] == {'x': 1, 'y': 1, 'z': 1}
assert collider['m_GameObject']['m_PathID'] == transform['m_GameObject']['m_PathID'] == geometry['gameObject']['pathId']
assert {r['component']['m_PathID'] for r in go['m_Component']} >= {
    geometry['collider']['pathId'], geometry['transform']['pathId'], bridges[0]['componentPathId'], bridges[1]['componentPathId']}
option_fields = [{**f, 'unboxedOffset': f['offset'] - 16} for f in c['fields'](options)]
native_options = json.loads(bridges[1]['originalJson'])['_targetOptions']
unmatched_options = {k: value for k, value in native_options.items() if k not in {f['name'] for f in option_fields}}
assert unmatched_options == {'ignoreMotionMode': 0}

# Resolve the actual zero-argument List<Entity>.Sort usage loaded by both
# deterministic return paths. This does not certify concrete comparer RGCTX.
load = 0x731dd5
p = v['offset'](base + load)
assert b[p:p + 3] == bytes.fromhex('488b15')
slot = load + 7 + struct.unpack_from('<i', b, p + 3)[0]
usage = v['quad'](b, v['offset'](base + slot))
assert usage >> 29 == 6
priority = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
sort = priority['specification']((usage & 0x1ffffffe) >> 1)
assert sort['declaringType'] == 'List`1' and sort['definition']['name'] == 'Sort'
assert sort['instantiations']['class']['arguments'][0]['name'] == 'Entity'
mp = v['method_start'] + sort['definition']['index'] * 32
assert struct.unpack_from('<H', v['m'], mp + 30)[0] == 0

# Bind the query's actual generic usage, rather than inferring parent lookup
# from Unity's attached-rigidbody relationship.
component_queries = []
for caller, load_rva, expected in [
    ('FindTargets_DISPOSE', 0x731c53, 'Entity'),
    ('Enemy._InitPhysics', 0x81152d, 'Rigidbody2D'),
    ('Enemy._InitPhysics', 0x8115e3, 'Collider2D'),
]:
    p = v['offset'](base + load_rva)
    assert b[p:p + 3] == bytes.fromhex('488b15')
    slot = load_rva + 7 + struct.unpack_from('<i', b, p + 3)[0]
    encoded = v['quad'](b, v['offset'](base + slot))
    assert encoded >> 29 == 6
    spec = priority['specification']((encoded & 0x1ffffffe) >> 1)
    assert spec['declaringType'] == 'Component' and spec['definition']['name'] == 'GetComponent'
    assert spec['instantiations']['method']['arguments'][0]['name'] == expected
    component_queries.append({**spec, 'caller': caller, 'callerLoadRva': load_rva,
                              'encodedUsage': encoded, 'concreteContextVerified': False})

miner_path = 'data/candidates/arkpedia-ch16-miner-source.json'
miner = json.loads((ROOT / miner_path).read_bytes())
miner_prefab = 'dyn/battle/prefabs/enemies/enemy_3010_mcreep.prefab'
miner_rows = miner['prefabs'][miner_prefab]
miner_geometry = {}
for role, path_id, kind in [
    ('root', '5644796134861044698', 'GameObject'),
    ('transform', '5122364892917791706', 'Transform'),
    ('trigger', '4604174670646148058', 'CircleCollider2D'),
    ('rigidbody', '8259759216037133274', 'Rigidbody2D'),
    ('collisionHolder', '8685857770053630938', 'GameObject'),
    ('collisionTransform', '7561822508265110490', 'Transform'),
    ('collisionCapsule', '-8609449613250790438', 'CapsuleCollider2D'),
    ('entity', '3577167244923435994', 'MonoBehaviour'),
]:
    row = c['unique'](lambda r: r['pathId'] == path_id, miner_rows)
    assert row['componentType'] == kind and v['sha'](row['originalJson'].encode()) == row['sha256']
    miner_geometry[role] = row
native = {key: json.loads(row['originalJson']) for key, row in miner_geometry.items()}
root_id = miner_geometry['root']['pathId']
assert native['root']['m_Layer'] == 28
assert native['trigger']['m_GameObject']['m_PathID'] == root_id
assert native['rigidbody']['m_GameObject']['m_PathID'] == root_id
assert native['entity']['m_GameObject']['m_PathID'] == root_id
assert native['trigger']['m_Radius'] == 0.10000000149011612
assert native['trigger']['m_Offset'] == {'x': 0, 'y': 0}
assert native['trigger']['m_IsTrigger'] and native['trigger']['m_Enabled'] == 1
assert native['collisionTransform']['m_Father']['m_PathID'] == miner_geometry['transform']['pathId']
assert {r['component']['m_PathID'] for r in native['collisionHolder']['m_Component']} == {
    miner_geometry['collisionTransform']['pathId'], miner_geometry['collisionCapsule']['pathId']}
entity_binding = c['unique'](lambda r: r['prefab'] == miner_prefab and
    r['componentPathId'] == miner_geometry['entity']['pathId'], bindings['bindings'])
entity_script = json.loads(bindings['scripts'][entity_binding['scriptPathId']]['originalJson'])
assert entity_binding['componentSha256'] == miner_geometry['entity']['sha256']
assert (entity_script['m_ClassName'], entity_script['m_Namespace']) == ('Enemy', 'Torappu.Battle')
enemy = c['type_row']('Enemy', 'Torappu.Battle')
assert any(t['name'] == 'Entity' and t['namespace'] == 'Torappu.Battle' for t in c['lineage'](enemy))
motion_free_dispatch = {'entryRva': 0x158d0, 'chunks': c['code'](0x158d0),
    'metadataIdentityVerified': False,
    'slots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), 84)
              for name in ['Entity', 'Enemy', 'Character']]}
assert all(row['name'] == 'isStillMotionTargetFreeWithImmuneFlag' for row in motion_free_dispatch['slots'])
snapshot_load = 0x787917
pos = v['offset'](base + snapshot_load)
assert b[pos:pos + 3] == bytes.fromhex('488b0d')
slot = snapshot_load + 7 + struct.unpack_from('<i', b, pos + 3)[0]
snapshot_usage = v['quad'](b, v['offset'](base + slot))
assert snapshot_usage >> 29 == 1
snapshot_type_index = (snapshot_usage & 0x1ffffffe) >> 1
tp = v['offset'](v['quad'](b, v['type_table'] + snapshot_type_index * 8))
assert (v['uint'](b, tp + 8) >> 16) & 255 == 0x12
snapshot_type = v['types'][v['quad'](b, tp)]
source_motion = {'concreteContextVerified': False, 'concreteSpecifications': [], 'canonicalBodies': [],
    'snapshotType': {'index': snapshot_type['index'], 'name': snapshot_type['name'],
                     'fields': c['fields'](snapshot_type), 'allocationLoadRva': snapshot_load,
                     'encodedUsage': snapshot_usage, 'nativeTypeIndex': snapshot_type_index},
    'aliveOrDyingSlots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), 39)
                         for name in ['Entity', 'Enemy', 'Character']]}
assert source_motion['snapshotType']['name'] == 'SourceSnapshot'
assert [f['name'] for f in source_motion['snapshotType']['fields']] == ['sourceMotionMode']
for load_rva, name in [(0x7878fb, '.ctor'), (0x787a5c, 'ValidAndAliveOrDying'), (0x787ab7, 'Get')]:
    pos = v['offset'](base + load_rva)
    assert b[pos:pos + 3] in [bytes.fromhex('4c8b05'), bytes.fromhex('488b15')]
    slot = load_rva + 7 + struct.unpack_from('<i', b, pos + 3)[0]
    encoded = v['quad'](b, v['offset'](base + slot))
    assert encoded >> 29 == 6
    spec = priority['specification']((encoded & 0x1ffffffe) >> 1)
    assert spec['definition']['name'] == name
    assert next(iter(spec['instantiations'].values()))['arguments'][0]['name'] == 'Entity'
    assert spec['nativeMapping'] is None
    source_motion['concreteSpecifications'].append({**spec, 'callerLoadRva': load_rva, 'encodedUsage': encoded})
for index, rva in [(151158, 0x47b7990), (207899, 0x3f4ec20), (151162, 0x47b7720)]:
    spec = priority['specification'](index)
    assert v['quad'](b, priority['pointer_table'] + spec['nativeMapping']['methodPointerIndex'] * 8) == base + rva
    assert spec['definition'] == source_motion['concreteSpecifications'][len(source_motion['canonicalBodies'])]['definition']
    source_motion['canonicalBodies'].append({**spec, 'entryRva': rva, 'chunks': c['code'](rva)})

result = {
    'schemaVersion': 1,
    'scope': 'Static original arrival collider and native query pipeline; no physics/frame/cross-version parity or admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'imageBase': base, 'metadataVersion': 29,
    'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())} for p in [
        'data/arkpedia-global-windows-client-source.json', graph_path, binding_path,
        'data/candidates/arkpedia-windows-filter-priority-source.json', miner_path]},
    'prefabScriptBridges': bridges, 'geometry': geometry, 'targetOptionFields': option_fields,
    'unmatchedTargetOptions': unmatched_options, 'targetOptionParity': False,
    'methods': methods, 'layerMaskLeaf': layer_leaf,
    'deterministicSort': {**sort, 'callerLoadRva': load, 'encodedUsage': usage, 'parameterCount': 0, 'concreteContextVerified': False},
    'queryLimit': 128,
    'componentQueries': component_queries,
    'motionTargetFreeDispatch': motion_free_dispatch,
    'sourceMotionSnapshot': source_motion,
    'minerColliderOwnership': {'prefab': miner_prefab, 'geometry': miner_geometry,
        'entityBinding': entity_binding, 'entityScript': entity_script,
        'enemyLineage': [{'name': t['name'], 'namespace': t['namespace'], 'index': t['index']}
                         for t in c['lineage'](enemy)],
        'worldGeometryVerified': False, 'physicsOverlapParity': False},
    'review': [
        'The original arrival range is a CircleRange on the same root as an enabled trigger CircleCollider2D: local radius1, offset0 and unit root scale. This is authored local geometry, not proof of final runtime world radius, target-body geometry or collider ordering.',
        'FindTargets_DISPOSE obtains a side layer mask, queries actual collider overlaps, resolves entities, checks native validity and selectability, deduplicates by instanceUid, then runs TargetOptions.VerifyTargetWithoutCheckingTargetSide and an optional predicate before adding each UID/entity. Collection stops at128 before optional deterministic List<Entity>.Sort; sorting all possible targets before truncation would change selection. Concrete generic comparer dispatch remains unverified.',
        'HitBehaviour.OnProjectileReached performs its overlap query only when onlyCheckHitWhenReachTarget is enabled. It notifies a still-valid source through Entity.OnProjectileSelectTargets when the found count is positive, then forwards each candidate to DealHitTarget. Selected ignoreCamouflage=true disables that extra rejection; exceptSource, exceptTraceTarget and onlyTraceTarget are false. Native layer masks, target geometry, dynamic range scaling and current target options remain integration obligations.',
        'The original nested TargetOptions contains ignoreMotionMode=0 absent from the Windows struct. CircleRange._useBlackboardRangeId=0 and HitBehaviour._exceptFlyCharacter=0 also have no matching Windows fields. None of these zero-valued differences proves inertness or full layout/runtime parity.',
        'The query uses same-component GetComponent<Entity>, not parent lookup. The original miner root contains the script-bound Enemy, Rigidbody2D and enabled radius0.1 trigger; its child collision capsule has only a Transform and CapsuleCollider2D, so attached-rigidbody ancestry alone does not make that child an Entity hit body. Enemy._InitPhysics reads the root circle radius into its main-trigger radius field. This does not prove runtime transform scale or Unity physics boundary tolerance.',
        'VerifyTargetWithoutCheckingTargetSide first calls BattleUtil.VerifyTarget for motion/category, then _VerifyAdvanced. Advanced target-free checks depend on retained source side and source motion snapshot; the motion-target-free trampoline dispatches slot84 with flags44 and combo2. Entity and Character implement distinct motion comparisons. A zero profession mask is accepted by CheckProfessionMask only through its explicit accept-zero argument. Native source snapshot, abnormal state and runtime target-side/layer mappings are not supplied by a ground-only point-distance filter.'
    ]}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-area-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows arrival-area evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete arrival-area methods, authored collider and bounded layer-mask leaf')
