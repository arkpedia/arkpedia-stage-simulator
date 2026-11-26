#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain original global-buff controllers and their transitive templates."""
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
C = ROOT / '.cache/arkpedia/cn-native-source'
manifest_raw = (C / 'hot_update_list.json').read_bytes()
assert len(manifest_raw) == 3241788 and hashlib.sha256(manifest_raw).hexdigest() == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
manifest = json.loads(manifest_raw)
bundle = 'battle/prefabs/[uc]globalbuffs.ab'
row = next(r for r in manifest['abInfos'] if r['name'] == bundle)
raw = (C / 'bundles' / bundle).read_bytes()
assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
env = UnityPy.load(raw); by = {o.path_id: o for o in env.objects}
def exact(v, key=''):
    if isinstance(v, dict): return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, list): return [exact(x) for x in v]
    return str(v) if key == 'm_PathID' else v
def sha(raw): return hashlib.sha256(raw).hexdigest()
prefabs = {}
for key in ['periodic_damage', 'kill_to_add_cost', 'character_in_magiccircuit_env', 'legion_mode_enemy_boost', 'strife_mode_feature', 'rogue_4_parasitic_buff', 'rogue_4_apoptosis[random_tile]', 'mainline12_sightManager', 'mainline14_enemy_sign_effect']:
    rows = []
    def walk(go):
        d = go.read_typetree()
        for c in d['m_Component']:
            o = by[c['component']['m_PathID']]; data = o.read_typetree()
            if o.type.name == 'MonoBehaviour':
                data = exact(data)
                rows.append({'object': d['m_Name'], 'pathId': str(o.path_id), 'data': data,
                             'sha256': sha(json.dumps(data, sort_keys=True, separators=(',', ':')).encode())})
            if o.type.name == 'Transform':
                for child in data['m_Children']:
                    walk(by[by[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID']])
    walk(env.container[f'dyn/battle/prefabs/[uc]globalbuffs/{key.lower()}.prefab'])
    prefabs[key] = rows
# Level environment systems (compiled controllers): retain their serialized configuration.
env_bundle = 'battle/prefabs/[uc]envsystems.ab'
env_row = next(r for r in manifest['abInfos'] if r['name'] == env_bundle)
env_raw = (C / 'bundles' / env_bundle).read_bytes()
assert len(env_raw) == env_row['abSize'] and hashlib.md5(env_raw).hexdigest() == env_row['md5']
env_by = {o.path_id: o for o in UnityPy.load(env_raw).objects}
env_container = UnityPy.load(env_raw).container
env_systems = {}
for key in ['env_005_mainline12_sightSystem']:
    rows = []
    go = env_container[f'dyn/battle/prefabs/[uc]envsystems/{key.lower()}.prefab'].read_typetree()
    for c in go['m_Component']:
        o = env_by[c['component']['m_PathID']]
        if o.type.name != 'MonoBehaviour': continue
        data = exact(o.read_typetree())
        rows.append({'object': go['m_Name'], 'pathId': str(o.path_id), 'data': data,
                     'sha256': sha(json.dumps(data, sort_keys=True, separators=(',', ':')).encode())})
    env_systems[key] = rows
template_raw = (C / 'tables/buff_template_data.json').read_bytes()
assert hashlib.sha1(f'blob {len(template_raw)}\0'.encode() + template_raw).hexdigest() == 'a94bbb391fded80e59db38ad7c3ded89e25fd682'
table = json.loads(template_raw)
def keys(v):
    if isinstance(v, dict):
        for k, x in v.items():
            if k in ('templateKey', '_templateKey') and isinstance(x, str) and x in table: yield x
            elif k == 'SerializedState' and isinstance(x, str): yield from keys(json.loads(x))
            else: yield from keys(x)
    elif isinstance(v, list):
        for x in v: yield from keys(x)
templates, todo = {}, list(keys(prefabs))
while todo:
    k = todo.pop()
    if k in templates: continue
    templates[k] = table[k]; todo.extend(keys(table[k]))
result = {'schemaVersion': 1, 'source': {
    'repository': 'Kengxxiao/ArknightsGameData', 'commit': 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add',
    'resourceVersion': manifest['versionId'], 'manifestSha256': sha(manifest_raw),
    'bundle': {'path': bundle, 'bytes': len(raw), 'md5': row['md5'], 'sha256': sha(raw)},
    'templates': {'gitBlob': 'a94bbb391fded80e59db38ad7c3ded89e25fd682', 'sha256': sha(template_raw)},
    'envBundle': {'path': env_bundle, 'bytes': len(env_raw), 'md5': env_row['md5'], 'sha256': sha(env_raw)}},
    'envSystems': env_systems,
    'prefabs': prefabs, 'templates': dict(sorted(templates.items()))}
path = ROOT / 'data/arkpedia-environment-native-source.json'
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    assert path.read_text() == text, 'Stage environment source changed'
    print('Verified original stage environment controllers')
else:
    path.write_text(text); print('Retained', len(prefabs), 'global-buff prefabs and', len(templates), 'templates')
