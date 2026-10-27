#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain complete Projectile.Init ordering and its default key/miss setters."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
parent_path = 'data/candidates/arkpedia-windows-cast-lifecycle-source.json'
parent_raw = (ROOT / parent_path).read_bytes()
assert parent_raw.decode() == c['serialized']
controller_path = 'data/candidates/arkpedia-windows-fear-projectile-controller-source.json'
controller_raw = (ROOT / controller_path).read_bytes()
controller = json.loads(controller_raw)
assert controller['sources'][parent_path]['sha256'] == v['sha'](parent_raw)
projectile = v['types'][9558]
methods = []
for index, entry in [(62167, 0x678950), (62157, 0x67e910), (62159, 0x67ea00), (62164, 0x67e830)]:
    row = c['unique'](lambda r: r['index'] == index, projectile['methods'])
    method = c['method'](projectile, row)
    assert method['entryRva'] == entry
    methods.append(method)
assert controller['directCalls'][0]['index'] == methods[0]['index']
fields = []
for ti, name, offset in [(9558, '<key>k__BackingField', 0x170), (9558, '<originalKey>k__BackingField', 0x178),
                         (9558, '<damageMissFlag>k__BackingField', 0x180), (9558, 'm_source', 0xf0),
                         (9558, 'm_sourceMapPos', 0x100), (9558, 'm_ability', 0x130), (9558, 'm_effectReplacePairs', 0xd0),
                         (9558, 'm_type', 0xc8), (9558, '_actionController', 0x60), (9558, 'm_startMapPos', 0x108),
                         (9558, 'm_ExtraLogIds', 0xe0), (9558, '_managedBySource', 0x84),
                         (8926, '<side>k__BackingField', 0x1c), (8926, '<playerSide>k__BackingField', 0x20)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert field['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **field})
direct = []
for ti, index, entry in [(8742, 54564, 0x3911530), (10214, 68281, 0x871900), (8742, 54590, 0x3910c70),
                         (9555, 62270, 0x6a1340), (9558, 62130, 0x67e3d0), (8926, 56485, 0x3998190),
                         (9558, 62170, 0x67ccc0), (9044, 57769, 0x3a2bf80), (10204, 67981, 0x8577b0),
                         (8742, 54561, 0x3910d50), (10301, 68829, 0x87b560)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})
slot = c['resolved_slot'](c['enemy'], 52)
assert slot['name'] == 'get_managedProjectiles'
loads = []
for rva, index, name in [(0x678aa8, 269317, 'Wrap'), (0x678ad6, 253211, 'get_isValid'), (0x678ae9, 253210, 'Lock'),
                          (0x678b72, 269312, 'Wrap'), (0x678b98, 253168, 'get_isValid'), (0x678bb1, 253167, 'Lock'),
                          (0x678cee, 254456, 'get_instance'), (0x679054, 253233, 'op_Implicit')]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b0d'), bytes.fromhex('488b15'), bytes.fromhex('4c8b05')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    spec = p['specification'](index)
    assert spec['definition']['name'] == name and spec['nativeMapping'] is None
    loads.append({'loadRva': rva, 'encodedUsage': usage, 'specification': spec})
signatures = []
for index in [62167, 62270, 56485, 62170, 68829, 58275, 58280]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': v['sint'](v['m'], pp + 8)})
    ti = v['sint'](v['m'], pos + 8)
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    signatures.append({'index': index, 'parameters': parameters, 'returnTypeIndex': ti,
                       'returnKind': (v['uint'](v['b'], tp + 8) >> 16) & 255,
                       'virtualSlot': struct.unpack_from('<H', v['m'], pos + 28)[0]})
assert [s['returnKind'] for s in signatures] == [1, 1, 1, 1, 1, 17, 12]
assert [s['virtualSlot'] for s in signatures[-2:]] == [0, 5]
assert [p['name'] for p in signatures[2]['parameters']] == ['side', 'playerSide', 'pos', 'height']
types = []
for rva, name, definition in [(0x678c2d, 'ILocatable', 9062), (0x678de2, 'Character', 10105), (0x678ea0, 'Character', 10105)]:
    pos = v['offset'](v['image_base'] + rva)
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 1
    ti = (usage & 0x1ffffffe) >> 1
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    assert v['quad'](v['b'], tp) == definition and v['types'][definition]['name'] == name
    types.append({'loadRva': rva, 'encodedUsage': usage, 'typeIndex': ti, 'definitionIndex': definition, 'name': name})
result = {'schemaVersion': 1, 'scope': 'Default Projectile.Init orchestration and key/original-key/miss setters; inner setup, BObject and external effects remain explicit.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in [(parent_path, parent_raw), (controller_path, controller_raw)]},
    'methods': methods, 'fields': fields, 'directCalls': direct, 'managedProjectileSlot': slot, 'metadataLoads': loads, 'typeLoads': types, 'signatures': signatures,
    'init': {'keyCall': 0x678a72, 'originalKeyCall': 0x678a88, 'ownerCall': 0x678aa3, 'sourceWrite': 0x678acd,
        'sourcePositionCall': 0x678b06, 'abilityWrite': 0x678b8c, 'missCall': 0x678bd2, 'missWriteCall': 0x678be0,
        'pairsWrite': 0x678bfb, 'typeWrite': 0x678bfe, 'actionInitCall': 0x678c1f, 'startPositionCall': 0x678c39,
        'sourceSideCall': 0x678c64, 'sourcePlayerSideCall': 0x678c7b, 'secondStartPositionCall': 0x678c9d, 'startHeightCall': 0x678cb6,
        'baseInitCall': 0x678cd8, 'inlineInitCall': 0x678ce9, 'loggerCall': 0x678cf5, 'idsCapture': 0x678cfa,
        'sourceIdCall': 0x678da5, 'modeCall': 0x678f4f, 'modeStringCall': 0x678f5f, 'abilityExtraCall': 0x678fa5,
        'loggerFetchCall': 0x678fed, 'managedFlagRead': 0x678ff2, 'managedListCall': 0x679051, 'managedPointerCall': 0x679066},
    'nativeInnerInitVerified': False, 'nativeBaseInitVerified': False, 'nativeActionControllerInitVerified': False,
    'nativeLogAndManagedListEffectsVerified': False, 'nativeStaticDefaultsVerified': False, 'nativePointerEffectsVerified': False,
    'hotfixDispatchVerified': False, 'liveProjectileInitVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-init-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile-Init evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified complete projectile Init/setters, pointer usages, interface slots and source/log sampling')
