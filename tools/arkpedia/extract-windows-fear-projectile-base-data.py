#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default owner/blackboard/options setup and standard behaviour data."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-attack-data-source.json',
         'data/candidates/arkpedia-ch16-fear-projectile-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
methods = []
for ti, index, entry in [(8742, 54596, 0x390eac0), (8752, 54678, 0x3909480), (8742, 54559, 0x3911b30)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    method = c['method'](v['types'][ti], row)
    assert method['entryRva'] == entry
    methods.append(method)
fields = []
for ti, name, offset in [(8742, 'm_owner', 0x48), (8742, '_selector', 0x28), (8742, '_metadata', 0x30),
                         (8737, 'blackboardPrefix', 0x18), (8742, '<blackboard>k__BackingField', 0x80),
                         (8742, '<options>k__BackingField', 0x90), (8736, 'blackboard', 0x10),
                         (8752, 'm_behaviours', 0xf8), (8752, 'm_purposeMask', 0x104)]:
    f = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert f['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **f})
behaviour_field = fields[7]
assert (behaviour_field['typeBits'] >> 16) & 255 == 29
pos = v['offset'](behaviour_field['typeData'])
assert v['quad'](v['b'], pos) == 8749 and (v['uint'](v['b'], pos + 8) >> 16) & 255 == 18
behaviour = c['unique'](lambda r: r['index'] == 54752, v['types'][8749]['methods'])
slot = struct.unpack_from('<H', v['m'], v['method_start'] + 54752 * 32 + 28)[0]
assert behaviour['name'] == 'SetData' and slot == 6
purpose = c['resolved_slot'](v['types'][11695], 92)
assert purpose['name'] == 'GeneratePurposeMask'
direct = []
for ti, index, entry in [(3918, 28606, 0x2167ea0), (3918, 28607, 0x2167de0), (3918, 28644, 0x2165f80)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})
rva = 0x390eb36
pos = v['offset'](v['image_base'] + rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('4c8b05')
address = rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
assert usage >> 29 == 6
spec = p['specification']((usage & 0x1ffffffe) >> 1)
assert spec['definition']['name'] == 'op_Implicit' and spec['declaringType'] == 'ObjectPtr`1'
assert spec['instantiations']['class']['arguments'][0]['typeIndex'] == 9044
graph = json.loads(raws[paths[2]])
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
component = c['unique'](lambda r: r['pathId'] == '4729572091462136098', graph['prefabs'][prefab])
native = json.loads(component['originalJson'])
assert native['_metadata'] == {'blackboardPrefix': '', 'namedAsAlias': ''}
assert native['_selector'] == {'m_FileID': 0, 'm_PathID': '0'}
result = {'schemaVersion': 1, 'scope': 'Default Ability and AbilityStandard data setup plus blackboard setter; underlying pointer/blackboard/selector/behaviour runtime effects held.',
          'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
          'methods': methods, 'fields': fields, 'behaviour': {'declaringTypeIndex': 8749, **behaviour, 'slot': slot},
          'purposeSlot': purpose, 'directCalls': direct, 'ownerConversion': {'loadRva': rva, 'encodedUsage': usage, 'specification': spec},
          'fearComponent': {'prefab': prefab, 'pathId': component['pathId'], 'sha256': v['sha'](component['originalJson'].encode()),
                            'metadata': native['_metadata'], 'selector': native['_selector']},
          'nativePointerAndCopyEffectsVerified': False, 'nativeBlackboardEffectsVerified': False,
          'nativeSelectorAndBehaviourEffectsVerified': False, 'nativePurposeGenerationVerified': False,
          'hotfixDispatchVerified': False, 'liveBaseDataVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-base-data-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile base-data evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified owner, blackboard/options and standard live behaviour setup ordering')
