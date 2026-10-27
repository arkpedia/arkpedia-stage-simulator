#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain trace-target and birth callback sequencing, without stage admission."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-inline-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
assert json.loads(raws[paths[1]])['sources'][paths[0]]['sha256'] == v['sha'](raws[paths[0]])
methods = []
for index, entry in [(62172, 0x67bc40), (62196, 0x67a570)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][9558]['methods'])
    record = c['method'](v['types'][9558], row)
    assert record['entryRva'] == entry
    methods.append(record)
fields = []
for ti, name, offset in [(9558, 'm_traceTarget', 0x110), (9558, 'm_traceTargetMapPos', 0x120), (9529, 'm_entity', 0x18),
                         (9558, '_mainEffect', 0x50), (9558, '_actionController', 0x60), (9558, 'm_behaviours', 0x140),
                         (9558, 'm_type', 0xc8), (9558, 'm_ExtraLogIds', 0xe0)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert field['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **field})
slots = [c['resolved_slot'](v['types'][9559], 24), c['resolved_slot'](c['type_row']('HitBehaviour', 'Torappu.Battle.Projectiles'), 6)]
assert [s['name'] for s in slots] == ['Born', 'OnProjectileBorn']
direct = []
for ti, index, entry in [(9558, 62213, 0x67c7d0), (9555, 62279, 0x6a1990), (8911, 55976, 0x39933a0),
                         (9112, 58407, 0x3a36020), (9558, 62160, 0x67da70), (10214, 68283, 0x871a30),
                         (8911, 56198, 0x397f6c0), (10214, 68281, 0x871900), (9044, 57855, 0x3a2ba70)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})
return_index = v['sint'](v['m'], v['method_start'] + 57855 * 32 + 8)
tp = v['offset'](v['quad'](v['b'], v['type_table'] + return_index * 8))
assert v['quad'](v['b'], tp) == 9529 and (v['uint'](v['b'], tp + 8) >> 16) & 255 == 18
loads = []
for rva, kind, index in [(0x67bcef, 1, 46681), (0x67bd61, 1, 55825), (0x67bed2, 1, 71649),
                          (0x67bee1, 6, 253213), (0x67bf67, 6, 139396), (0x67a6b6, 6, 254542), (0x67a7a5, 5, 14744)]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b15'), bytes.fromhex('4c8b05'), bytes.fromhex('488b0d')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == kind and (usage & 0x1ffffffe) >> 1 == index
    record = {'loadRva': rva, 'encodedUsage': usage, 'index': index}
    if kind == 1:
        tp = v['offset'](v['quad'](v['b'], v['type_table'] + index * 8))
        definition = v['quad'](v['b'], tp)
        assert definition == {46681: 9044, 55825: 9529, 71649: 9504}[index]
        record.update({'definitionIndex': definition, 'name': v['types'][definition]['name']})
    elif kind == 6:
        spec = p['specification'](index)
        assert spec['definition']['name'] == {253213: 'op_Implicit', 139396: '.ctor', 254542: 'get_instance'}[index]
        if index == 139396:
            assert spec['declaringType'] == 'Nullable`1' and spec['instantiations']['class']['arguments'][0]['typeIndex'] == 42145
            assert spec['nativeMapping'] is not None
        else:
            assert spec['nativeMapping'] is None
        record['specification'] = spec
    else:
        length, offset = struct.unpack_from('<II', v['m'], v['uint'](v['m'], 8) + index * 8)
        raw = v['m'][v['uint'](v['m'], 16) + offset:v['uint'](v['m'], 16) + offset + length]
        assert raw == b'ON_PROJECTILE_BORN'
        record.update({'value': raw.decode(), 'sha256': v['sha'](raw)})
    loads.append(record)
result = {'schemaVersion': 1, 'scope': 'Default SetTraceTarget/OnProjectileBorn sequencing; cast, nullable, action/behavior/base/effect/log/audio runtime effects remain explicit.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
    'methods': methods, 'fields': fields, 'virtualSlots': slots, 'directCalls': direct, 'metadataLoads': loads,
    'hitMountReturn': {'typeIndex': return_index, 'definitionIndex': 9529, 'name': 'MountPoint'},
    'trace': {'mountLockCall': 0x67bdfa, 'mountTraceWrite': 0x67be21, 'mountTraceRelock': 0x67be3b, 'mountPositionCall': 0x67be4e,
        'entityTraceWrite': 0x67beb2, 'entityPositionCall': 0x67bec8, 'tileCastCall': 0x67bedc, 'noneTraceWrite': 0x67bf07,
        'someTraceWrite': 0x67bf45, 'tilePositionCall': 0x67bf62, 'nullableCall': 0x67bf88},
    'born': {'effectCall': 0x67a5eb, 'actionCall': 0x67a5ff, 'behaviourCall': 0x67a666, 'arrayReread': 0x67a66c,
        'baseCall': 0x67a6a3, 'graphicTypeRead': 0x67a6a9, 'controllerCall': 0x67a6bd, 'loggerCall': 0x67a6d0,
        'logCall': 0x67a6f4, 'audioKeyCall': 0x67a6fe, 'worldPositionCall': 0x67a711, 'sourceLockCall': 0x67a770, 'audioCall': 0x67a7c5},
    'nativeCastAndPointerEffectsVerified': False, 'nativeNullableLayoutVerified': False, 'nativeActionAndBehaviourBornVerified': False,
    'nativeBaseBornVerified': False, 'nativeMainEffectVerified': False, 'nativeLoggerAndAudioEffectsVerified': False,
    'hotfixDispatchVerified': False, 'liveTraceAndBornVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-born-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile trace/birth evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified complete trace-target/birth bodies, mount return type, nullable usage and graphic-only gate')
