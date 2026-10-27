#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain exact default action-chain evidence for event5's self-death buff."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
nodes = c['type_row']('Nodes', 'Torappu.Battle.Action')
methods, fields = [], {}
for name in ['CheckAbnormalFlag', 'CheckAbnormalCombo', 'SwitchMode', 'CreateBuff', 'AlwaysNext', 'InstantKill']:
    t = c['type_row'](name, '')
    assert t['index'] in nodes['nested']
    fields[name] = c['fields'](t)
    methods.append(c['method'](t, c['unique'](lambda r: r['name'] == 'Execute', t['methods'])))
    if name == 'AlwaysNext':
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == 'get_executeCondition', t['methods'])))
base_node = c['type_row']('ActionNode', 'Torappu.Battle.Action')
methods.append(c['method'](base_node, c['unique'](lambda r: r['name'] == 'get_executeCondition', base_node['methods'])))
util = c['type_row']('ActionUtil', 'Torappu.Battle.Action')
for rva in [0xe43d80, 0xe44600, 0xe44890]:
    methods.append(c['method'](util, c['unique'](lambda r: v['pointer'](r) == v['image_base'] + rva, util['methods'])))
entity = c['type_row']('Entity', 'Torappu.Battle')
parameters = {}
for name in ['Suicide', 'SetHpInternal', 'get_alive']:
    row = c['unique'](lambda r: r['name'] == name, entity['methods'])
    methods.append(c['method'](entity, row))
    pos = v['method_start'] + row['index'] * 32
    start, count = v['sint'](v['m'], pos + 12), struct.unpack_from('<H', v['m'], pos + 30)[0]
    assert v['uint'](v['m'], 92) % 12 == 0
    parameters[name] = []
    for index in range(count):
        pp = v['uint'](v['m'], 88) + (start + index) * 12
        parameters[name].append({'index': start + index, 'name': v['text'](v['uint'](v['m'], pp)),
                                'typeIndex': v['sint'](v['m'], pp + 8)})
assert [p['name'] for p in parameters['Suicide']] == ['noSource', 'skipReborn']
assert [p['name'] for p in parameters['SetHpInternal']] == ['value', 'force', 'noSource', 'skipReborn']
graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
graph_raw = (ROOT / graph_path).read_bytes()
template = json.loads(graph_raw)['templates']['fearpj_m0_t[switch_to_die]']
assert v['sha'](template['originalJson'].encode()) == template['sha256']
original = json.loads(template['originalJson'])
events = original['eventToActions']['_items']
assert len(events) == 1 and events[0]['key'] == 0
actions = json.loads(events[0]['value']['SerializedState'])
assert [a['$type'].split('+')[-1] for a in actions] == [
    'CheckAbnormalFlag', 'CheckAbnormalFlag', 'CheckAbnormalFlag', 'CheckAbnormalCombo',
    'SwitchMode', 'CreateBuff', 'AlwaysNext', 'InstantKill']
result = {'schemaVersion': 1, 'scope': 'Static selected self-death action chain; no runtime/frame/cross-version parity or support admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'imageBase': v['image_base'],
    'sources': {path: {'path': path, 'sha256': v['sha']((ROOT / path).read_bytes())} for path in [
        'data/arkpedia-global-windows-client-source.json', graph_path]},
    'template': template, 'eventKey': 0, 'actions': actions, 'fields': fields, 'methods': methods,
    'entityParameters': parameters, 'suicideFlag': c['unique'](lambda f: f['name'] == 'm_isSuicide', c['fields'](entity)),
    'entitySlots': [c['resolved_slot'](c['type_row'](name, 'Torappu.Battle'), slot)
                    for name in ['Entity', 'Enemy', 'Character'] for slot in [38, 108]],
    'setHpDispatch': {'entryRva': 0x12f30, 'chunks': c['code'](0x12f30), 'metadataIdentityVerified': False}}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-self-death-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static self-death action evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete action-chain methods and original self-death template')
