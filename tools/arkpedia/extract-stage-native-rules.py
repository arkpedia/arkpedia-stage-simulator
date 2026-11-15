#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain selected stage-rule prefabs and templates from checksum-pinned CN inputs.

Run after cn-native-source/fetch-cn-battle-tables. --check compares without writing.
Shared bundles remain in the cache; only the selected serialized components are kept.
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

CACHE = ROOT / '.cache/arkpedia/cn-native-source'
PIN = json.loads((ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes())['source']
manifest = (CACHE / 'hot_update_list.json').read_bytes()
assert hashlib.sha256(manifest).hexdigest() == PIN['manifestSha256']
members = {r['name']: r for r in json.loads(manifest)['abInfos']}

def exact(value, key=''):
    if isinstance(value, dict): return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, list): return [exact(v, key) for v in value]
    if isinstance(value, float) and value.is_integer(): return int(value)
    return str(value) if key == 'm_PathID' else value

def sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

prefabs, bundles = {}, []
for group, keys in [('dynamicabilities', ['silenceimmue', 'invisible']),
                    ('globalbuffs', ['common_char_melee_built', 'deploy_damage'])]:
    path = f'battle/prefabs/[uc]{group}.ab'
    raw, row = (CACHE / 'bundles' / path).read_bytes(), members[path]
    assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
    bundles.append({'path': path, 'bytes': len(raw), 'md5': row['md5'], 'sha256': hashlib.sha256(raw).hexdigest()})
    env = UnityPy.load(raw)
    by_id = {o.path_id: o for o in env.objects}
    for key in keys:
        asset = f'dyn/battle/prefabs/[uc]{group}/{key}.prefab'
        components = []
        def walk(go):
            tree = go.read_typetree()
            for ref in tree['m_Component']:
                obj = by_id[ref['component']['m_PathID']]
                data = obj.read_typetree()
                if obj.type.name == 'MonoBehaviour':
                    value = exact(data)
                    components.append({'pathId': str(obj.path_id), 'object': tree['m_Name'], 'data': value, 'sha256': sha(value)})
                if obj.type.name == 'Transform':
                    for child in data['m_Children']:
                        walk(by_id[by_id[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID']])
        walk(env.container[asset])
        prefabs[key] = {'bundle': path, 'asset': asset, 'components': components}

raw = (CACHE / 'tables/buff_template_data.json').read_bytes()
blob = hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest()
assert len(raw) == 27996217 and blob == 'a94bbb391fded80e59db38ad7c3ded89e25fd682'
table = json.loads(raw)
out = {'schemaVersion': 1, 'source': {k: PIN[k] for k in ['repository', 'commit', 'clientVersion', 'resourceVersion', 'manifestSha256']},
       'bundles': bundles, 'prefabs': prefabs,
       'templateSource': {'repository': PIN['repository'], 'commit': PIN['commit'],
                          'path': 'zh_CN/gamedata/battle/buff_template_data.json', 'gitBlob': blob, 'sha256': hashlib.sha256(raw).hexdigest()},
       'templates': {key: table[key] for key in ['common_char_melee_built', 'deploy_damage']}}
target = ROOT / 'data/arkpedia-native-stage-rules.json'
encoded = json.dumps(out, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    assert target.read_text() == encoded, 'Stage-rule evidence changed; regenerate and review'
else:
    target.write_text(encoded)
print(f'Verified {len(prefabs)} original stage-rule prefabs and {len(out["templates"])} templates')
