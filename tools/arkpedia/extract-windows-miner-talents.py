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
    'literals': [literal(0xdd1871, 'times'), literal(0xdd184a, 'range_id')],
    'review': [
        'Enemy._AssignTalent iterates the prefab talent list and constructs a fresh blackboard/TalentData even when the incoming parameter blackboard is absent; absence of a named parameter group is not evidence that the prefab talent is absent.',
        'Enemy.OnInit checks BasicTalent.CheckRootOrValidModeTalent before Attach. Validity depends on assigned data; root identity depends on parentMode. Unit.OnAwake/RecollectTalents/_InitUnitModes and SetParentMode are retained for hierarchy review rather than inferring roots from defaultModeIndex alone.',
        'Main16ChangeTileShadowViaRange.Execute loads the exact metadata literal times and calls Blackboard.GetFloatOrDefault with xmm2 cleared to zero. It passes that result to ChangeShadowTileEscapeTimeViaRangeId. No canonical catalogue fallback is present in this default action path.',
        'The range manager visits shadow tiles and calls _UpdateOneTileEscapeTime, which updates the timer and immediately calls _UpdateTileState. Zero-duration effects and interaction with existing timers require review of the retained state path before local-miner integration.',
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
