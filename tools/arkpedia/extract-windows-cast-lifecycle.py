#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain complete static cast/wait code from the pinned Windows client.

No client execution, inferred animation markers, or runtime admission. Reuse the
checked v29/PE reader; resolve each image's tokens through its own code-gen module.
"""
from pathlib import Path
import base64
import bisect
import json
import runpy
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
v = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-ability-events.py'))
b, m, base = v['b'], v['m'], v['image_base']
unique, uint, sint, quad = v['unique'], v['uint'], v['sint'], v['quad']
modules = {}


def module(name):
    if name in modules:
        return modules[name]
    im = unique(lambda row: v['text'](row[0]) == name, v['image_rows'])
    needle = struct.pack('<Q', v['address'](b.index(name.encode() + b'\0')))
    matches, pos = [], 0
    rows = v['types'][im[2]:im[2] + im[3]]
    count = max(method['token'] & 0xffffff for t in rows for method in t['methods'])
    while (pos := b.find(needle, pos)) >= 0:
        if quad(b, pos + 8) == count:
            matches.append(pos)
        pos += 8
    assert len(matches) == 1
    p = matches[0]
    modules[name] = {'name': name, 'rva': v['address'](p) - base,
                     'methodCount': count, 'methodPointerTableRva': quad(b, p + 16) - base,
                     'typeStart': im[2], 'typeCount': im[3]}
    return modules[name]


def type_row(name, namespace):
    return unique(lambda t: t['name'] == name and t['namespace'] == namespace, v['types'])


def code(rva):
    i = bisect.bisect_right(v['starts'], rva) - 1
    root = v['runtime'][i]
    if root[0] != rva:
        # Reviewed FP(float) conversion is a true x64 leaf: no stack changes,
        # calls or branches. Its exact three decoded instructions terminate in
        # ret; never use a next-method-pointer window as a function boundary.
        pos = v['offset'](base + rva)
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(b[pos:pos + 32], base + rva))[:3]
        assert [ins.mnemonic for ins in decoded] == ['mulss', 'cvttss2si', 'ret']
        assert decoded[0].op_str.startswith('xmm0, dword ptr [rip + ')
        assert decoded[1].op_str == 'rax, xmm0' and decoded[2].op_str == ''
        raw = b[pos:pos + sum(ins.size for ins in decoded)]
        return [{'beginRva': rva, 'endRva': rva + len(raw), 'unwindRva': None,
                 'boundary': 'Reviewed straight-line leaf through decoded ret; no calls, branches or stack changes',
                 'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                 'instructions': [{'rva': ins.address - base, 'mnemonic': ins.mnemonic,
                                   'operands': ins.op_str} for ins in decoded]}]
    chunks = []
    for entry in v['families'][v['parent'](root)]:
        raw = b[v['offset'](base + entry[0]):v['offset'](base + entry[0]) + entry[1] - entry[0]]
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, base + entry[0]))
        assert sum(ins.size for ins in decoded) == len(raw), 'Incomplete native chunk disassembly'
        instructions = [{'rva': ins.address - base, 'mnemonic': ins.mnemonic, 'operands': ins.op_str}
                        for ins in decoded]
        chunks.append({'beginRva': entry[0], 'endRva': entry[1], 'unwindRva': entry[2],
                       'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                       'instructions': instructions})
    return chunks


def fields(t):
    if not t['fields']:
        return []
    ptr = v['offset'](quad(b, v['field_table'] + t['index'] * 8))
    out = []
    for n, f in enumerate(t['fields']):
        tp = v['offset'](quad(b, v['type_table'] + f['typeIndex'] * 8))
        out.append({**f, 'offset': sint(b, ptr + n * 4),
                    'typeData': quad(b, tp), 'typeBits': uint(b, tp + 8)})
    return out


def enum(t):
    underlying = unique(lambda f: f['name'] == 'value__', t['fields'])
    tp = v['offset'](quad(b, v['type_table'] + underlying['typeIndex'] * 8))
    assert (uint(b, tp + 8) >> 16) & 255 == 8, 'This decoder accepts signed Int32 enums only'
    out = []
    for f in t['fields']:
        if f['name'] == 'value__':
            continue
        ti, di = v['defaults'][f['index']]
        p = uint(m, 72) + di
        encoded = m[p]
        assert encoded < 128
        out.append({**f, 'defaultTypeIndex': ti, 'defaultFileOffset': p,
                    'encodedHex': bytes([encoded]).hex(),
                    'value': ~(encoded >> 1) if encoded & 1 else encoded >> 1})
    return {'typeIndex': t['index'], 'name': t['name'], 'fields': out}


def method(t, row, image='Assembly-CSharp.dll'):
    mod = module(image)
    assert mod['typeStart'] <= t['index'] < mod['typeStart'] + mod['typeCount']
    rid = row['token'] & 0xffffff
    assert 0 < rid <= mod['methodCount']
    va = quad(b, v['offset'](base + mod['methodPointerTableRva']) + (rid - 1) * 8)
    assert va
    p = v['method_start'] + row['index'] * 32
    return {'image': image, 'typeIndex': t['index'], 'namespace': t['namespace'],
            'type': t['name'], **row, 'virtualSlot': struct.unpack_from('<H', m, p + 28)[0],
            'parameterCount': struct.unpack_from('<H', m, p + 30)[0],
            'entryRva': va - base, 'chunks': code(va - base)}


def lineage(t):
    result, seen = [], set()
    while t['index'] not in seen:
        seen.add(t['index'])
        result.append(t)
        ti = sint(m, v['type_start'] + t['index'] * 88 + 16)
        if ti < 0:
            return result
        tp = v['offset'](quad(b, v['type_table'] + ti * 8))
        index = quad(b, tp)
        assert 0 <= index < len(v['types'])
        t = v['types'][index]
    raise AssertionError('Cyclic native type hierarchy')


def resolved_slot(t, slot):
    p = v['type_start'] + t['index'] * 88
    assert 0 <= slot < struct.unpack_from('<H', m, p + 74)[0]
    start = sint(m, p + 56)
    encoded = uint(m, uint(m, 144) + (start + slot) * 4)
    assert encoded >> 29 == 3 and encoded != 1
    index = (encoded & 0x1ffffffe) >> 1
    rows = [(owner, row) for owner in v['image_types'] for row in owner['methods'] if row['index'] == index]
    assert len(rows) == 1
    owner, row = rows[0]
    return {'type': t['name'], 'typeIndex': t['index'], 'slot': slot,
            'encodedMethod': encoded, 'declaringType': owner['name'],
            'declaringTypeIndex': owner['index'], **row,
            'entryRva': v['pointer'](row) - base}


ns = 'Torappu.Battle.Abilities'
animated = type_row('AbstractAnimatedAbility', ns)
easy = type_row('EasyToStartAbility', ns)
ranged = type_row('RangedAttack', ns)
standard = type_row('AbilityStandard', 'Torappu.Battle')
asynchronous = type_row('AsyncUtil', 'Torappu.Battle')
entity = type_row('Entity', 'Torappu.Battle')
unit = type_row('Unit', 'Torappu.Battle')
unit_animator = type_row('UnitAnimator', 'Torappu.Battle')
spine = type_row('SpineAnimator', 'Torappu.Battle')
single_spine = type_row('SingleSpineAnimator', 'Torappu.Battle')
animation_data = unique(lambda t: t['name'] == 'AnimationData', [v['types'][n] for n in spine['nested']])
enemy = type_row('Enemy', 'Torappu.Battle')
spine_animation = type_row('Animation', 'Spine')
selected = []
for t, names in [
    (animated, ['get_cooldown', 'get_preDelay', 'GetDuration', 'UpdatePlaybackSpeed', 'ApplyAttackTime']),
    (easy, ['get_waitForAttackEvent', 'get_postDelay', 'OnCastStart', 'WaitForNextEvent', '_CheckNotReceiveEvent', '_OnReceiveEvent']),
    (ranged, ['DoCastOnTargets', 'OnCastOnTarget', 'OnCastEnd', 'CreateProjectile', 'ClearProjectile']),
    (standard, ['OnSpellStart', 'OnCastOnTarget', 'DoCastOnTargets', 'OnCastEnd']),
    (asynchronous, ['WaitWhileForFixedSeconds']),
    (unit, ['GetAnimationTime']), (unit_animator, ['GetAnimationTime']),
    (spine, ['GetAnimationTimeInternal', 'GetAnimationData', 'InitAnimationDataIfNot', 'UpdateAnimationData', 'GetAnimName']),
]:
    for name in names:
        rows = [r for r in t['methods'] if r['name'] == name]
        assert rows
        selected.extend(method(t, row) for row in rows)
for t, prefixes in [(easy, ['<WaitForNextEvent>', '<OnWaitForPreDelay>', '<OnWaitForPostDelay>']),
                    (standard, ['<_DoCast>']), (asynchronous, ['<WaitWhileForFixedSeconds>'])]:
    for index in t['nested']:
        nested = v['types'][index]
        if any(nested['name'].startswith(prefix) for prefix in prefixes):
            selected.append(method(nested, unique(lambda r: r['name'] == 'MoveNext', nested['methods'])))
for name, token in [('FP', 0x60002b2), ('FP', 0x60002c9), ('FP', 0x60002d0), ('MathUtil', 0x600022e)]:
    t = type_row(name, 'Torappu')
    selected.append(method(t, unique(lambda r: r['token'] == token, t['methods']), 'Torappu.Common.dll'))
fp_type = type_row('FP', 'Torappu')
for name in ['Round', '.cctor']:
    selected.append(method(fp_type, unique(lambda r: r['name'] == name, fp_type['methods']), 'Torappu.Common.dll'))
battle_controller = type_row('BattleController', 'Torappu.Battle')
selected.append(method(battle_controller, unique(lambda r: r['name'] == 'get_deltaPlayTime', battle_controller['methods'])))
spine_data = type_row('SkeletonData', 'Spine')
selected.append(method(spine_data, unique(lambda r: r['name'] == 'FindAnimation', spine_data['methods']), 'spine-unity.dll'))

entity_event = enum(unique(lambda t: t['name'] == 'Event', [v['types'][n] for n in entity['nested']]))
time_mode = enum(unique(lambda t: t['name'] == 'TimeMode', [v['types'][n] for n in animated['nested']]))
assert unique(lambda f: f['name'] == 'ON_ATTACK_EVENT', entity_event['fields'])['value'] == 19
virtual_bindings = []
for t, names in [(standard, ['OnEvent', 'OnSpellStart', 'OnWaitForPreDelay', 'OnWaitForPostDelay']),
                 (easy, ['GetDuration', 'get_preDelay']), (animated, ['get_cooldown']),
                 (entity, ['GetAnimationTime'])]:
    for row in t['methods']:
        if row['name'] in names:
            p = v['method_start'] + row['index'] * 32
            virtual_bindings.append({'typeIndex': t['index'], 'type': t['name'], **row,
                                     'slot': struct.unpack_from('<H', m, p + 28)[0]})

script_path = 'data/candidates/arkpedia-ch16-script-bindings-source.json'
script_source = json.loads((ROOT / script_path).read_bytes())
graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
graph = json.loads((ROOT / graph_path).read_bytes())
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
bridges = []
for path_id in ['4729572091462136098', '-4003912029476114142', '-2847013522971053790', '-5930072227765702366', '8176622560865923362']:
    binding = unique(lambda r: r['graph'] == graph_path and r['prefab'] == prefab and r['componentPathId'] == path_id,
                     script_source['bindings'])
    script = script_source['scripts'][binding['scriptPathId']]
    assert v['sha'](script['originalJson'].encode()) == script['sha256']
    identity = json.loads(script['originalJson'])
    assert identity['m_AssemblyName'] == 'Assembly-CSharp.dll'
    t = type_row(identity['m_ClassName'], identity['m_Namespace'])
    module_row = module('Assembly-CSharp.dll')
    assert module_row['typeStart'] <= t['index'] < module_row['typeStart'] + module_row['typeCount']
    ancestors = lineage(t)
    available = {}
    for ancestor in ancestors:
        if not ancestor['namespace'].startswith('Torappu.Battle'):
            continue
        for field in fields(ancestor):
            available.setdefault(field['name'], {**field, 'declaringTypeIndex': ancestor['index'],
                                                  'declaringType': ancestor['name']})
    row = unique(lambda r: r['pathId'] == path_id, graph['prefabs'][prefab])
    assert row['sha256'] == binding['componentSha256'] == v['sha'](row['originalJson'].encode())
    native = json.loads(row['originalJson'])
    mapped, unmatched = [], {}
    for name in sorted(set(native) - {'m_Script', 'm_Enabled', 'm_GameObject', 'm_Name'}):
        if name in available:
            mapped.append(available[name])
        else:
            unmatched[name] = native[name]
    if t['name'] in ['RangedAttack', 'BuffToOwner', 'EmptyAnimatedAbility']:
        assert not unmatched, f'Unmatched serialized cast fields: {unmatched}'
    bridges.append({**binding, 'scriptIdentity': identity, 'windowsTypeIndex': t['index'],
                    'lineage': [{'typeIndex': a['index'], 'name': a['name'], 'namespace': a['namespace']} for a in ancestors],
                    'matchedSerializedFields': mapped, 'unmatchedSerializedFields': unmatched,
                    'serializedFieldParity': not unmatched})

wait_delegates = []
for load_rva, expected in [(0xc30803, '_CheckNotReceiveEvent'),
                          (0xc30866, '_CheckNotReceiveEventAndTargetAlive'),
                          (0xc307af, '_OnReceiveEvent'), (0xc306c7, '_OnReceiveEvent')]:
    pos = v['offset'](base + load_rva)
    assert b[pos:pos + 3] == bytes.fromhex('4c8b05')
    slot = load_rva + 7 + struct.unpack_from('<i', b, pos + 3)[0]
    usage = quad(b, v['offset'](base + slot))
    assert usage >> 29 == 3
    index = (usage & 0x1ffffffe) >> 1
    row = unique(lambda r: r['index'] == index and r['name'] == expected, easy['methods'])
    wait_delegates.append({'callerLoadRva': load_rva, 'encodedUsage': usage, 'type': easy['name'], **row})

result = {'schemaVersion': 1,
          'scope': 'Static default cast/wait evidence only; no runtime hotfix, frame or cross-version parity and no enemy/stage admission.',
          'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())}
                      for p in ['data/arkpedia-global-windows-client-source.json',
                                'data/candidates/arkpedia-windows-ability-events-source.json',
                                'data/candidates/arkpedia-ch16-fear-projectile-source.json', script_path]},
          'nativeFiles': v['pin']['files'], 'metadataVersion': 29, 'imageBase': base,
          'codeGenModules': list(modules.values()), 'entityEvent': entity_event, 'timeMode': time_mode,
          'fields': {t['name']: {'typeIndex': t['index'], 'fields': fields(t)} for t in [standard, easy, animated, ranged, animation_data, spine_animation]},
          'virtualBindings': virtual_bindings,
          'resolvedSlots': [resolved_slot(t, slot) for t, slots in [(enemy, [102, 103]), (single_spine, [45, 46, 60]),
                                                                   (ranged, [75, 80, 87, 101, 116])] for slot in slots],
          'prefabScriptBridges': bridges,
          'eventWaitDelegateBindings': wait_delegates,
          'waitFrameArithmetic': {'fractionalBits': 32, 'fractionalHalfRaw': str(1 << 31),
              'divisionOverflowPositiveRaw': str((1 << 63) - 2),
              'divisionOverflowNegativeRaw': str(-(1 << 63) + 2),
              'divisionByZeroRaw': str(-(1 << 32)), 'fpFields': fields(fp_type)},
          'virtualHelpers': [{'entryRva': rva, 'chunks': code(rva)} for rva in [0x57b0, 0x1cf10]],
          'methods': selected,
          'review': [
              'EasyToStartAbility caches virtual GetDuration at cast start. Its attack-event branch subscribes to Entity.Event19 ON_ATTACK_EVENT and passes that cached duration to the fixed-point WaitWhileForFixedSeconds overload.',
              'The fixed-point waiter divides duration by FP(deltaPlayTime), calls MathUtil.RoundToInt and clamps the count to at least one; it yields before testing the predicate on resumption. This is a bounded frame count, not a fabricated OnAttack marker.',
              'AbstractAnimatedAbility GetDuration returns m_attackTime. UpdatePlaybackSpeed initializes it from virtual get_cooldown; in timeMode0 get_cooldown reads owner.attackTime. The animation-query, minimum/maximum scale and fixed-point conversion paths remain in full for review.',
              'The ordinary _DoCast coroutine dispatches OnSpellStart, checks CheckAnotherSpell, then emits ability event5 before its post-delay. RangedAttack projectile creation and self-death wrapper ordering still require caller/lifecycle review before admission.',
              'Exact CN MonoScript references identify RangedAttack, BuffToOwner, EmptyAnimatedAbility, SingleSpineAnimator and Enemy. Cast field names bind through actual Windows inheritance chains; unmatched animator/owner fields remain explicit with serializedFieldParity=false. No unmatched field is assumed inert and no blanket cross-version behavioral parity follows.',
              'Enemy virtual animation lookup resolves to Unit, then UnitAnimator and the SingleSpineAnimator inherited SpineAnimator implementation. The latter returns AnimationData.time / speed; its update path reads the original animation duration into time.',
              'The pinned Global Windows code and retained CN prefab/skeleton are different platform/version sources. Runtime hotfix state, scheduler/frame parity and local miner talent attachment remain separate requirements.'
          ]}
out = ROOT / 'data/candidates/arkpedia-windows-cast-lifecycle-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows cast-lifecycle evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(selected)} complete native cast/wait methods, image-local tokens, fields, enums and dispatch helpers')
