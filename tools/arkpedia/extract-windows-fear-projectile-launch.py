#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain ranged destination/creation ordering without admitting a controller."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v, ranged = c['v'], c['ranged']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
parent_path = 'data/candidates/arkpedia-windows-cast-lifecycle-source.json'
parent_raw = (ROOT / parent_path).read_bytes()
assert parent_raw.decode() == c['serialized']
methods = []
for index, entry in [(79998, 0xbfbea0), (80009, 0xbfaec0)]:
    row = c['unique'](lambda r: r['index'] == index, ranged['methods'])
    record = c['method'](ranged, row)
    assert record['entryRva'] == entry
    methods.append(record)
assert methods[0] == c['unique'](lambda r: r['index'] == 79998, json.loads(parent_raw)['methods'])
slots = [c['resolved_slot'](ranged, slot) for slot in [75, 116, 117]]
slots.extend([c['resolved_slot'](c['enemy'], 50), c['resolved_slot'](v['types'][9044], 90)])
assert [s['name'] for s in slots] == ['OnCastOnTarget', 'CreateProjectile', 'GetProjectileKey', 'get_rootTile', 'GetMountPoint']
fields = []
for name, offset in [('_projectileDestination', 0x230), ('m_projectiles', 0x250), ('_useMountGroup', 0x214),
                     ('m_mountPointsCache', 0x258), ('m_mountPointIndex', 0x260), ('_mountPointType', 0x210), ('_fireCreateProjectileEvent', 0x248)]:
    field = c['unique'](lambda f: f['name'] == name, c['fields'](ranged))
    assert field['offset'] == offset
    fields.append(field)
destinations = c['enum'](v['types'][11693])
assert [(f['name'], f['value']) for f in destinations['fields']] == [('TARGET', 0), ('INPUT_POINT', 1), ('INPUT_VECTOR3', 2), ('TARGET_ROOT_TILE', 3), ('INPUT_VEC3_WITH_TILE_HEIGHT', 4)]
event = c['unique'](lambda f: f['value'] == 40, c['entity_event']['fields'])
direct = []
for ti, index, entry in [(8752, 54695, 0x390a6c0), (8742, 54564, 0x3911530), (8911, 56170, 0x3975090),
                         (9044, 57785, 0x3a2ad70), (9044, 57855, 0x3a2ba70), (10214, 68282, 0x8718b0),
                         (9060, 58260, 0x3a42930), (9060, 58262, 0x3a427b0), (9060, 58265, 0x3a42840)]:
    owner = v['types'][ti]
    row = c['unique'](lambda r: r['index'] == index, owner['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': owner['name'], **row, 'entryRva': entry})
signatures = []
for index in [79998, 80009, 56170, 54564, 57855, 58260, 58262, 58265]:
    pos = v['method_start'] + index * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    parameters = []
    for n in range(count):
        pp = v['uint'](v['m'], 88) + (start + n) * 12
        ti = v['sint'](v['m'], pp + 8)
        tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
        parameters.append({'name': v['text'](v['uint'](v['m'], pp)), 'typeIndex': ti, 'typeData': v['quad'](v['b'], tp), 'typeBits': v['uint'](v['b'], tp + 8)})
    ti = v['sint'](v['m'], pos + 8)
    tp = v['offset'](v['quad'](v['b'], v['type_table'] + ti * 8))
    signatures.append({'index': index, 'parameters': parameters, 'returnKind': (v['uint'](v['b'], tp + 8) >> 16) & 255})
assert signatures[0]['returnKind'] == 1 and signatures[1]['parameters'][1]['typeBits'] & 0x20000000
loads = []
for rva, name, index in [(0xbfaf34, 'get_instance', 254542), (0xbfafe2, 'SafeCount', 261079),
                          (0xbfb018, 'get_Item', 250986), (0xbfb0f9, 'Emit', 236561), (0xbfbfdb, 'op_Implicit', 253233),
                          (0xbfc34b, 'Add', 242465)]:
    pos = v['offset'](v['image_base'] + rva)
    assert v['b'][pos:pos + 3] in [bytes.fromhex('488b0d'), bytes.fromhex('488b15'), bytes.fromhex('4c8b0d'), bytes.fromhex('4c8b05')]
    address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
    assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == index
    if index == 242465:
        definition, inst_index, method_inst = struct.unpack_from('<iii', v['b'], p['spec_start'] + index * 12)
        assert method_inst == -1
        row = c['unique'](lambda r: r['index'] == definition, v['types'][38190]['methods'])
        assert row['name'] == name
        table = v['offset'](v['quad'](v['b'], v['registration'] + 24))
        inst = v['offset'](v['quad'](v['b'], table + inst_index * 8))
        assert v['quad'](v['b'], inst) == 1
        tp = v['offset'](v['quad'](v['b'], v['offset'](v['quad'](v['b'], inst + 8))))
        assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 21
        generic = v['offset'](v['quad'](v['b'], tp))
        dt = v['offset'](v['quad'](v['b'], generic))
        assert v['quad'](v['b'], dt) == 1324
        args = v['offset'](v['quad'](v['b'], generic + 8))
        assert v['quad'](v['b'], args) == 1
        inner = v['offset'](v['quad'](v['b'], v['offset'](v['quad'](v['b'], args + 8))))
        assert v['quad'](v['b'], inner) == 9558 and (v['uint'](v['b'], inner + 8) >> 16) & 255 == 18
        spec = {'index': index, 'definition': row, 'declaringTypeIndex': 38190, 'classInstantiationIndex': inst_index,
                'nestedArgument': {'definitionIndex': 1324, 'name': 'ObjectPtr`1', 'argumentTypeIndex': 9558}, 'nativeMapping': p['mapping'].get(index)}
    else:
        spec = p['specification'](index)
        assert spec['definition']['name'] == name
    assert spec['nativeMapping'] is None
    loads.append({'loadRva': rva, 'encodedUsage': usage, 'specification': spec})
graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
graph_raw = (ROOT / graph_path).read_bytes()
graph = json.loads(graph_raw)
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
component = c['unique'](lambda r: r['pathId'] == '4729572091462136098', graph['prefabs'][prefab])
assert v['sha'](component['originalJson'].encode()) == component['sha256']
data = json.loads(component['originalJson'])
expected = {'_projectileDestination': 0, '_projectileKey': 'projectile_enemy_fearpj', '_mountPointType': 2,
            '_useMountGroup': 0, '_fireCreateProjectileEvent': 0, '_emitToInputPosWhenTargetIsInvalid': 0,
            '_emitToInputRootTileWhenTargetIsInvalid': 0}
for key, value in expected.items():
    assert data[key] == value
result = {'schemaVersion': 1, 'scope': 'Selected default RangedAttack.OnCastOnTarget/CreateProjectile and inlined shoot-point selection; no controller/stage admission.',
    'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in [(parent_path, parent_raw), (graph_path, graph_raw)]},
    'methods': methods, 'virtualSlots': slots, 'fields': fields, 'destinationEnum': destinations, 'creationEvent': event,
    'directCalls': direct, 'signatures': signatures, 'metadataLoads': loads,
    'fearComponent': {'prefab': prefab, 'pathId': component['pathId'], 'sha256': component['sha256'], 'selectedFields': expected},
    'targetCast': {'baseCastCall': 0xbfbf64, 'destinationRead': 0xbfbf69, 'createCalls': [0xbfbfd8, 0xbfc0dc, 0xbfc196, 0xbfc265, 0xbfc321],
                   'primaryAppendCall': 0xbfc357, 'fakeValidityCall': 0xbfc37d, 'freshFakeListRead': 0xbfc395},
    'creation': {'controllerCall': 0xbfaf3b, 'keyCall': 0xbfaf68, 'sourceOwnerCall': 0xbfaf73, 'mountGroupRead': 0xbfafda,
                 'cacheCountCall': 0xbfaff0, 'indexRead': 0xbfaff5, 'indexIncrement': 0xbfb009, 'mountItemCall': 0xbfb01f,
                 'createCall': 0xbfb0ca, 'fireEventRead': 0xbfb0cf, 'eventOwnerCall': 0xbfb0e0, 'eventPoolCall': 0xbfb0ef, 'eventEmitCall': 0xbfb10b},
    'nativeControllerCreationVerified': False, 'nativeMountAndPositionEffectsVerified': False, 'nativeProjectileListEffectsVerified': False,
    'nativeEventEffectsVerified': False, 'hotfixDispatchVerified': False, 'liveProjectileLaunchVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-launch-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile-launch evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified ranged destination/creation bodies, concrete slots, pointer-list metadata and Fear prefab settings')
