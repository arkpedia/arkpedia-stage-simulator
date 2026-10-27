#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain selected action providers and shared damage-node preprocessing."""
from pathlib import Path
import json
import runpy
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-source.json',
         'data/candidates/arkpedia-windows-fear-projectile-action-init-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
parent = json.loads(raws[paths[1]])
methods = []
damage = c['type_row']('ApplyDamage', '')
for ti, index, entry in [(11695, 80001, 0xbfb750), (8742, 54641, 0x390fa70), (11775, 80968, 0xc1dba0), (damage['index'], 86256, 0xd7a0e0)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    method = c['method'](v['types'][ti], row)
    assert method['entryRva'] == entry
    if index != 80968:
        assert method == c['unique'](lambda r: r['index'] == index, parent['methods'])
    methods.append(method)
slots = [c['resolved_slot'](v['types'][11695], slot) for slot in [44, 45, 65]]
assert slots[1] == parent['preprocessing']['getActionsSlot'] and slots[2] == parent['preprocessing']['preprocessSlot']
fields = []
for ti, name, offset in [(11654, 'm_actions', 0x1f8), (11775, '_activeBuffs', 0x190), (damage['index'], 'm_cachedAtk', 0x28)]:
    f = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert f['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **f})
direct = []
for ti, index, entry in [(8742, 54564, 0x3911530), (9044, 57883, 0x3a29060)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    assert v['pointer'](row) - v['image_base'] == entry
    direct.append({'declaringTypeIndex': ti, 'declaringType': v['types'][ti]['name'], **row, 'entryRva': entry})
assert [d['name'] for d in direct] == ['get_owner', 'get_atk']
binding = parent['preprocessing']['interfaceBindings'][0]
assert binding['typeIndex'] == 12102 and binding['methods'][1]['name'] == 'PreprocessForProjectile'
result = {'schemaVersion': 1, 'scope': 'Default RangedAttack event0 provider, Ability preprocessing, active buffs and ApplyDamage cached ATK; no live/hotfix/interface admission.',
          'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
          'methods': methods, 'fields': fields, 'virtualSlots': slots, 'interfaceBinding': binding, 'directCalls': direct,
          'provider': {'eventCheck': 0xbfb79d, 'listCapture': 0xbfb7ba, 'preprocessCall': 0xbfb7db, 'listReread': 0xbfb7e1},
          'preprocess': {'ownerCall': 0x390faf1, 'validityCall': 0x390fb16, 'countCall': 0x390fb42,
                         'firstElementCall': 0x390fbd2, 'firstCastCall': 0x390fbdf, 'secondElementCall': 0x390fbf8,
                         'secondCastCall': 0x390fc0a, 'thirdCastCall': 0x390fc22, 'nodeCall': 0x390fc39},
          'damage': {'validityCall': 0xd7a158, 'atkCall': 0xd7a16b, 'invalidRawInput': 0xd7a189, 'invalidRawCall': 0xd7a18c, 'cacheWrite': 0xd7a196},
          'nativeCollectionAndInterfaceEffectsVerified': False, 'nativeAtkGetterEffectsVerified': False,
          'independentDamageNodePerProjectileVerified': False, 'hotfixDispatchVerified': False, 'liveActionProviderVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-action-provider-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile action provider evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified shared event0 actions, captured preprocessing traversal and cached ATK write')
