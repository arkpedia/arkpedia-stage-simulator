#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default ActionController Init/RegisterActions and concrete ability slots."""
from pathlib import Path
import json
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
parent = json.loads(raws[paths[1]])
methods = []
for index, entry in [(62270, 0x6a1340), (62272, 0x6a1ed0)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][9555]['methods'])
    method = c['method'](v['types'][9555], row)
    assert method['entryRva'] == entry
    assert method == c['unique'](lambda r: r['index'] == index, parent['methods'])
    methods.append(method)
slots = [c['resolved_slot'](v['types'][11695], slot) for slot in [44, 45, 46]]
assert [s['name'] for s in slots] == ['GetActiveBuffs', 'GetProjectileActions', 'GetAbilityAttachments']
fields = []
for name, offset in [('_useSelfBlackboard', 0x16), ('m_buffsToAttach', 0x30), ('m_attachmentsToAttach', 0x38),
                     ('m_actionsToAttach', 0x28), ('m_attachedBuffsForTargetMap', 0x40), ('m_attachedExtraBuffsForTargetMap', 0x48),
                     ('m_addBuffsToTargetCnt', 0x24), ('<blackboard>k__BackingField', 0x50), ('<projectile>k__BackingField', 0x58)]:
    f = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][9555]))
    assert f['offset'] == offset
    fields.append(f)
direct = []
for entry in [0x3910ac0, 0x2166fa0, 0x67e760]:
    matches = [(t, r) for t in v['image_types'] for r in t['methods'] if v['pointer'](r) - v['image_base'] == entry]
    assert len(matches) == 1
    t, row = matches[0]
    direct.append({'declaringTypeIndex': t['index'], 'declaringType': t['name'], **row, 'entryRva': entry})
assert [r['name'] for r in direct] == ['get_blackboard', 'Of', 'get_type']
result = {'schemaVersion': 1, 'scope': 'Default projectile action Init and RegisterActions; collection, preprocessor, hotfix and live runtime effects remain held.',
          'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
          'methods': methods, 'fields': fields, 'virtualSlots': slots, 'directCalls': direct,
          'init': {'selfBlackboardCall': 0x6a13b2, 'blackboardWrite': 0x6a13be, 'projectileWrite': 0x6a13cd,
                   'buffCall': 0x6a13fa, 'emptyBuffCall': 0x6a14b8, 'buffRangeCall': 0x6a14d8,
                   'attachmentCall': 0x6a1502, 'actionClearCall': 0x6a155e, 'eventSlotLiteral': 0x6a1563,
                   'projectileActionsCall': 0x6a1571, 'registerCall': 0x6a1586, 'eventLimit': 7,
                   'firstMapClear': 0x6a15a2, 'secondMapClear': 0x6a15b7, 'counterReset': 0x6a15cb},
          'register': {'typeCall': 0x6a1f4f, 'graphicCheck': 0x6a1f54, 'emptyCall': 0x6a1f67, 'clearCall': 0x6a1fb8,
                       'constructCall': 0x6a1fdd, 'elementCheckCall': 0x6a1fec, 'elementWrite': 0x6a2006,
                       'arrayReread': 0x6a200e, 'rangeCall': 0x6a2030},
          'nativeCollectionEffectsVerified': False, 'nativePreprocessorEffectsVerified': False,
          'hotfixDispatchVerified': False, 'liveActionInitVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-action-init-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile action Init evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified complete action Init/RegisterActions, seven-event registration and concrete ability slots')
