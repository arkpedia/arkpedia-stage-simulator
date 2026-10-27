#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain exact default talent assignment and missing-duration code, without admission."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
types = [
    ('Enemy', 'Torappu.Battle', ['_AssignTalent', 'OnInit']),
    ('Unit', 'Torappu.Battle', ['OnAwake', 'RecollectTalents', '_InitUnitModes']),
    ('UnitMode', 'Torappu.Battle', ['InitOnce', '_InitTalents']),
    ('BasicTalent', 'Torappu.Battle', ['AssignData', 'Attach', 'DoAttach', 'SetParentMode',
                                     'CheckRootOrValidModeTalent', 'get_isValid', 'get_isRootTalent',
                                     'get_talentKey', '_CreateBlackboard']),
    ('Blackboard', 'Torappu', ['AssignByPrefix', 'GetFloatOrDefault', 'TryGetFloat', '_TryGetNumber']),
    ('Main16ChangeTileShadowViaRange', '', ['Execute']),
    ('Mainline16Manager', 'Torappu.Battle', ['ChangeShadowTileEscapeTimeViaRangeId',
                                          '_UpdateOneTileEscapeTime', '_UpdateTileState',
                                          '_isShadowTileInShadowState', 'OnTick']),
]
methods, fields = [], {}
for name, namespace, names in types:
    t = c['type_row'](name, namespace)
    fields[name] = {'typeIndex': t['index'], 'fields': c['fields'](t)}
    for method_name in names:
        rows = [r for r in t['methods'] if r['name'] == method_name]
        assert rows, (name, method_name)
        methods.extend(c['method'](t, row) for row in rows)

# Resolve the actual generic method usage passed by the timer updater. A usage6
# index is an Il2CppMethodSpec, not a metadata method-definition index.
reg = v['registration']
slot = 0x7b39d20
instruction = v['offset'](v['image_base'] + 0x600092)
assert v['b'][instruction:instruction + 3] == bytes.fromhex('4c8b05')
assert 0x600092 + 7 + struct.unpack_from('<i', v['b'], instruction + 3)[0] == slot
usage = v['quad'](v['b'], v['offset'](v['image_base'] + slot))
assert usage >> 29 == 6 and usage & 1
spec_index = (usage & 0x1ffffffe) >> 1
assert spec_index < v['quad'](v['b'], reg + 64)
spec_pos = v['offset'](v['quad'](v['b'], reg + 72)) + spec_index * 12
definition, class_inst, method_inst = struct.unpack_from('<iii', v['b'], spec_pos)
math = c['type_row']('MathUtil', 'Torappu')
max_row = c['unique'](lambda r: r['index'] == definition, math['methods'])
assert max_row['name'] == 'Max' and class_inst == -1
assert 0 <= method_inst < v['quad'](v['b'], reg + 16)
inst_table = v['offset'](v['quad'](v['b'], reg + 24))
inst = v['offset'](v['quad'](v['b'], inst_table + method_inst * 8))
assert v['quad'](v['b'], inst) == 1
args = v['offset'](v['quad'](v['b'], inst + 8))
tp = v['offset'](v['quad'](v['b'], args))
single = c['type_row']('Single', 'System')
assert v['quad'](v['b'], tp) == single['index']
assert (v['uint'](v['b'], tp + 8) >> 16) & 255 == 12  # IL2CPP_TYPE_R4
compare = [c['method'](single, row, 'mscorlib.dll') for row in single['methods'] if row['name'] == 'CompareTo']
assert any(row['entryRva'] == 0x51d7130 for row in compare)
methods.extend(compare)
generic_max = {'type': math['name'], 'name': max_row['name'], 'definition': max_row,
               'usageSlotRva': slot, 'encodedUsage': usage, 'methodSpecIndex': spec_index,
               'classInstantiation': class_inst, 'methodInstantiation': method_inst,
               'typeArgument': {'name': 'System.Single', 'typeIndex': single['index'],
                                'typeBits': v['uint'](v['b'], tp + 8)},
               'entryRva': 0x400deb0, 'chunks': c['code'](0x400deb0)}
threshold_rva = 0x62c9d1c
instruction = v['offset'](v['image_base'] + 0x600672)
assert v['b'][instruction:instruction + 4] == bytes.fromhex('f30f100d')
assert 0x600672 + 8 + struct.unpack_from('<i', v['b'], instruction + 4)[0] == threshold_rva
threshold_bytes = v['b'][v['offset'](v['image_base'] + threshold_rva):v['offset'](v['image_base'] + threshold_rva) + 4]
assert threshold_bytes.hex() == '6f12833a'

# Preserve the actual transform route from each exact MonoScript-bound talent
# to its nearest UnitMode. These are mode talents, not root talents.
graph_path = 'data/candidates/arkpedia-ch16-miner-source.json'
graph = json.loads((ROOT / graph_path).read_bytes())
bindings = json.loads((ROOT / 'data/candidates/arkpedia-ch16-script-bindings-source.json').read_bytes())
prefab = 'dyn/battle/prefabs/enemies/enemy_3010_mcreep.prefab'
rows = {row['pathId']: json.loads(row['originalJson']) for row in graph['prefabs'][prefab]}
assert rows['3577167244923435994']['_modes'] == [{'m_FileID': 0, 'm_PathID': '6500173912443190234'}]
talents = []
for path_id in ['6788834655205915610', '7523757030189431770', '8323649833717595098']:
    binding = c['unique'](lambda r: r['prefab'] == prefab and r['componentPathId'] == path_id, bindings['bindings'])
    script = json.loads(bindings['scripts'][binding['scriptPathId']]['originalJson'])
    assert script['m_ClassName'] == 'Talent'
    talent = rows[path_id]
    go_id = talent['m_GameObject']['m_PathID']
    chain, go_chain = [], []
    while True:
        go = rows[go_id]
        transform_id = c['unique'](lambda ref: 'm_Father' in rows[ref['component']['m_PathID']], go['m_Component'])['component']['m_PathID']
        chain.append(transform_id)
        go_chain.append(go_id)
        if any(ref['component']['m_PathID'] == '6500173912443190234' for ref in go['m_Component']):
            break
        parent_id = rows[transform_id]['m_Father']['m_PathID']
        assert parent_id != '0' and parent_id not in chain
        go_id = rows[parent_id]['m_GameObject']['m_PathID']
    talents.append({'componentPathId': path_id, 'gameObjectPathId': talent['m_GameObject']['m_PathID'],
                    'name': rows[talent['m_GameObject']['m_PathID']]['m_Name'],
                    'transformPathIds': chain, 'gameObjectPathIds': go_chain,
                    'nearestModeComponentPathId': '6500173912443190234', 'modeIndex': 0,
                    'defaultModeIndex': talent['_defaultModeIndex']})


def literal(rva, expected):
    # Exact RIP-relative MOV -> original encoded metadata string-literal usage.
    p = v['offset'](v['image_base'] + rva)
    raw = v['b'][p:p + 7]
    assert raw[:3] == bytes.fromhex('488b15')
    slot = rva + 7 + struct.unpack_from('<i', raw, 3)[0]
    usage = v['quad'](v['b'], v['offset'](v['image_base'] + slot))
    assert usage >> 29 == 5 and usage & 1
    index = (usage & 0x1ffffffe) >> 1
    table = v['uint'](v['m'], 8)
    assert index * 8 < v['uint'](v['m'], 12)
    length, offset = struct.unpack_from('<II', v['m'], table + index * 8)
    assert offset + length <= v['uint'](v['m'], 20)
    value = v['m'][v['uint'](v['m'], 16) + offset: v['uint'](v['m'], 16) + offset + length].decode()
    assert value == expected
    return {'instructionRva': rva, 'slotRva': slot, 'encodedUsage': usage,
            'literalIndex': index, 'length': length, 'dataOffset': offset, 'value': value}


result = {
    'schemaVersion': 1,
    'scope': 'Static Windows default talent assignment and missing miner duration; CN runtime/frame parity and stage admission remain unverified.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'metadataVersion': 29, 'imageBase': v['image_base'],
    'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())} for p in [
        'data/arkpedia-global-windows-client-source.json',
        'data/candidates/arkpedia-ch16-script-bindings-source.json',
        'data/candidates/arkpedia-ch16-miner-source.json',
        'data/candidates/arkpedia-stage-16-9-source.json']},
    'methods': methods, 'fields': fields,
    'genericTimerMaximum': generic_max,
    'shadowThreshold': {'instructionRva': 0x600672, 'valueRva': threshold_rva,
                        'hex': threshold_bytes.hex(), 'value': struct.unpack('<f', threshold_bytes)[0]},
    'minerModeTalents': talents,
    'modeInitializationSlot': c['resolved_slot'](c['type_row']('UnitMode', 'Torappu.Battle'), 6),
    'literals': [literal(0xdd1871, 'times'), literal(0xdd184a, 'range_id')],
    'review': [
        'Enemy._AssignTalent iterates the prefab talent list and constructs a fresh blackboard/TalentData even when the incoming parameter blackboard is absent; absence of a named parameter group is not evidence that the prefab talent is absent.',
        'Enemy.OnInit checks BasicTalent.CheckRootOrValidModeTalent before Attach. Validity depends on assigned data; root identity depends on parentMode. Unit.OnAwake/RecollectTalents/_InitUnitModes and SetParentMode are retained for hierarchy review rather than inferring roots from defaultModeIndex alone.',
        'Main16ChangeTileShadowViaRange.Execute loads the exact metadata literal times and calls Blackboard.GetFloatOrDefault with xmm2 cleared to zero. It passes that result to ChangeShadowTileEscapeTimeViaRangeId. No canonical catalogue fallback is present in this default action path.',
        'The range manager visits shadow tiles and calls _UpdateOneTileEscapeTime. Its exact usage6 method specification resolves to Torappu.MathUtil.Max<System.Single>; the shared generic body compares via the retained System.Single.CompareTo implementation, preserving the larger current/new timer. It then immediately calls _UpdateTileState. _isShadowTileInShadowState requires timer < the retained float32 0.001 threshold as well as a shadow tile and no permanent escape state.',
        'All three CN talent transforms descend from the single default UnitMode. Unit._InitUnitModes dispatches slot6 to UnitMode.InitOnce, which calls _InitTalents; that routine sets each descendant talent parentMode. These are mode0 talents even though their serialized defaultModeIndex is -1. Enemy.OnInit can attach them through the current-mode validity branch, not the root branch. Runtime hotfix and cross-version parity remain unverified.',
        'The retained CN local miner has FearLoseBlood.value=0 and no TileEscapeShadowManager.times group. This evidence does not fill missing parameters from canonical enemy records or admit enemy_3010_mcreep_a / stage16-9.',
    ],
}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-miner-talents-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows miner talent evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete native talent/shadow methods and exact duration literals')
