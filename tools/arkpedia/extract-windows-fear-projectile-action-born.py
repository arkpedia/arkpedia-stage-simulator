#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain base Born and projectile action-context execution/cleanup ordering."""
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
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-source.json',
         'data/candidates/arkpedia-windows-fear-projectile-born-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
parent = json.loads(raws[paths[1]])
methods = []
for ti, index, entry in [(8926, 56482, 0x3997cb0), (8926, 56497, 0x511a50), (9555, 62279, 0x6a1990),
                         (9555, 62283, 0x6a2fa0), (8959, 57138, 0x39eaec0), (8959, 57142, 0x39eb2c0), (8959, 57148, 0x39eb120)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    if index in [56497, 62279]:
        # Two individually reviewed complete leaves; never widen c.code's
        # shared boundary rules or include bytes through a next-method pointer.
        size = 3 if index == 56497 else 15
        pos = v['offset'](v['image_base'] + entry)
        raw = v['b'][pos:pos + size]
        decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + entry))
        assert sum(i.size for i in decoded) == size
        expected = [('ret', '0')] if index == 56497 else [('xor', 'r9d, r9d'), ('xor', 'r8d, r8d'), ('lea', 'edx, [r9 + 5]'), ('jmp', '0x1806a2fa0')]
        assert [(i.mnemonic, i.op_str) for i in decoded] == expected
        record = {'image': 'Assembly-CSharp.dll', 'typeIndex': ti, 'namespace': v['types'][ti]['namespace'], 'type': v['types'][ti]['name'], **row,
                  'entryRva': entry, 'chunks': [{'beginRva': entry, 'endRva': entry + size, 'unwindRva': None,
                    'boundary': 'Reviewed exact ret0 leaf' if index == 56497 else 'Reviewed exact four-instruction tail wrapper; no stack changes or fallthrough',
                    'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                    'instructions': [{'rva': i.address - v['image_base'], 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}]}
    else:
        record = c['method'](v['types'][ti], row)
    methods.append(record)
assert methods[3] == c['unique'](lambda r: r['index'] == 62283, parent['methods'])
slot = c['resolved_slot'](v['types'][9559], 32)
assert slot['index'] == 56497 and slot['name'] == 'OnBorn'
fields = []
for ti, name, offset in [(8926, '<borned>k__BackingField', 0x25), (9555, 'm_actionsToAttach', 0x28),
                         (9555, '<blackboard>k__BackingField', 0x50), (9555, '<projectile>k__BackingField', 0x58),
                         (9558, 'm_eventCallbacks', 0x90), (8959, 'm_context', 0x10),
                         (8960, 'm_projectile', 0x38), (8960, 'm_ability', 0x28), (8960, 'm_mainTarget', 0x50)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert field['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **field})
direct = []
for ti, index, entry in [(9558, 62147, 0x67dc50), (9558, 62130, 0x67e3d0), (9558, 62133, 0x67e6f0),
                         (9558, 62135, 0x67d950), (13668, 89086, 0xe44600)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})
signatures = []
for index in [62279, 62283, 89086]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    signatures.append({'index': index, 'parameters': parameters})
assert len(signatures[0]['parameters']) == 0 and len(signatures[1]['parameters']) == 2 and len(signatures[2]['parameters']) == 3
result = {'schemaVersion': 1, 'scope': 'Default BObject.Born, empty OnBorn, ActionController born wrapper/action runner and three remaining context setters; no native EH/runtime admission.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
    'methods': methods, 'fields': fields, 'baseOnBornSlot': slot, 'directCalls': direct, 'signatures': signatures,
    'baseBorn': {'callbackCall': 0x3997cd7, 'flagWrite': 0x3997cdd},
    'actionRunner': {'contextCall': 0x6a2ff9, 'beginGuardCall': 0x6a300c, 'setProjectileCall': 0x6a303e,
        'setSourceCall': 0x6a306e, 'targetNullCall': 0x6a3095, 'fallbackTraceCall': 0x6a30ad, 'setTargetCall': 0x6a30c7,
        'mainTraceCall': 0x6a30e0, 'setMainTargetCall': 0x6a30f7, 'abilityCall': 0x6a3110, 'setAbilityCall': 0x6a3127,
        'blackboardRead': 0x6a314b, 'actionCall': 0x6a315f, 'normalDisposeCall': 0x6a3178, 'exceptionDisposeCall': 0x6a3192,
        'callbackProjectileRead': 0x6a31b4, 'callbackArrayRead': 0x6a31bd, 'callbackCall': 0x6a31e4, 'event': 5, 'actionSource': 4},
    'nativeExceptionUnwindVerified': False, 'nativeContextAndActionEffectsVerified': False, 'nativeDelegateEffectsVerified': False,
    'nativeGCAndStackEffectsVerified': False, 'liveActionBornVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-action-born-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile action-birth evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified base Born flag order, exact empty/tail leaves and projectile action-context cleanup paths')
