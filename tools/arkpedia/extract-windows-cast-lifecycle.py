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
    ptr = v['offset'](quad(b, v['field_table'] + t['index'] * 8))
    out = []
    for n, f in enumerate(t['fields']):
        tp = v['offset'](quad(b, v['type_table'] + f['typeIndex'] * 8))
        out.append({**f, 'offset': sint(b, ptr + n * 4),
                    'typeData': quad(b, tp), 'typeBits': uint(b, tp + 8)})
    return out


def enum(t):
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


ns = 'Torappu.Battle.Abilities'
animated = type_row('AbstractAnimatedAbility', ns)
easy = type_row('EasyToStartAbility', ns)
ranged = type_row('RangedAttack', ns)
standard = type_row('AbilityStandard', 'Torappu.Battle')
asynchronous = type_row('AsyncUtil', 'Torappu.Battle')
entity = type_row('Entity', 'Torappu.Battle')
selected = []
for t, names in [
    (animated, ['get_cooldown', 'get_preDelay', 'GetDuration', 'UpdatePlaybackSpeed', 'ApplyAttackTime']),
    (easy, ['get_waitForAttackEvent', 'get_postDelay', 'OnCastStart', 'WaitForNextEvent', '_CheckNotReceiveEvent', '_OnReceiveEvent']),
    (ranged, ['DoCastOnTargets', 'OnCastOnTarget', 'OnCastEnd']),
    (standard, ['OnSpellStart', 'OnCastOnTarget', 'DoCastOnTargets', 'OnCastEnd']),
    (asynchronous, ['WaitWhileForFixedSeconds']),
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

result = {'schemaVersion': 1,
          'scope': 'Static default cast/wait evidence only; no runtime hotfix, frame or cross-version parity and no enemy/stage admission.',
          'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())}
                      for p in ['data/arkpedia-global-windows-client-source.json',
                                'data/candidates/arkpedia-windows-ability-events-source.json',
                                'data/candidates/arkpedia-ch16-fear-projectile-source.json']},
          'nativeFiles': v['pin']['files'], 'metadataVersion': 29, 'imageBase': base,
          'codeGenModules': list(modules.values()), 'entityEvent': entity_event, 'timeMode': time_mode,
          'fields': {t['name']: {'typeIndex': t['index'], 'fields': fields(t)} for t in [standard, easy, animated, ranged]},
          'virtualBindings': virtual_bindings,
          'virtualHelpers': [{'entryRva': rva, 'chunks': code(rva)} for rva in [0x57b0, 0x1cf10]],
          'methods': selected,
          'review': [
              'EasyToStartAbility caches virtual GetDuration at cast start. Its attack-event branch subscribes to Entity.Event19 ON_ATTACK_EVENT and passes that cached duration to the fixed-point WaitWhileForFixedSeconds overload.',
              'The fixed-point waiter divides duration by FP(deltaPlayTime), calls MathUtil.RoundToInt and clamps the count to at least one; it yields before testing the predicate on resumption. This is a bounded frame count, not a fabricated OnAttack marker.',
              'AbstractAnimatedAbility GetDuration returns m_attackTime. UpdatePlaybackSpeed initializes it from virtual get_cooldown; in timeMode0 get_cooldown reads owner.attackTime. The animation-query, minimum/maximum scale and fixed-point conversion paths remain in full for review.',
              'The ordinary _DoCast coroutine dispatches OnSpellStart, checks CheckAnotherSpell, then emits ability event5 before its post-delay. RangedAttack projectile creation and self-death wrapper ordering still require caller/lifecycle review before admission.',
              'The pinned Global Windows code and retained CN prefab/skeleton are different platform/version sources. Native Enemy animation lookup, hotfix state, scheduler/frame parity and local miner talent attachment are not proved by these chunks.'
          ]}
out = ROOT / 'data/candidates/arkpedia-windows-cast-lifecycle-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    assert out.read_text(encoding='utf8') == serialized, 'Static Windows cast-lifecycle evidence differs'
else:
    out.write_text(serialized, encoding='utf8', newline='\n')
print(f'Verified {len(selected)} complete native cast/wait methods, image-local tokens, fields, enums and dispatch helpers')
