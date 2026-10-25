#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain original Abnormal Slug skeleton bytes and native prefab bindings; no admission approval."""
import base64
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def exact(v):
    if isinstance(v, dict):
        return {k: str(x) if k == 'm_PathID' else exact(x) for k, x in v.items()}
    if isinstance(v, list):
        return [exact(x) for x in v]
    return v

def canonical(v):
    return json.dumps(exact(v), ensure_ascii=False, sort_keys=True, separators=(',', ':'))

inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_raw)
manifest_raw = (ROOT / '.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes()
assert sha(manifest_raw) == inventory['source']['manifestSha256']
path = 'refs/arts/enm_art_23.ab'
row = next(r for r in json.loads(manifest_raw)['abInfos'] if r['name'] == path)
raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
env = UnityPy.load(raw)
objects = {o.path_id: o for o in env.objects}
graph_raw = (ROOT / 'data/candidates/arkpedia-ch16-abnormal-slug-source.json').read_bytes()
graph = json.loads(graph_raw)
prefab_path = 'battle/enm_pfb_27.ab'
prefab_pin = next(b for b in graph['source']['bundles'] if b['path'] == prefab_path)
prefab_raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / prefab_path).read_bytes()
assert sha(prefab_raw) == prefab_pin['sha256']
prefab_env = UnityPy.load(prefab_raw)
assert len(prefab_env.assets) == 1
prefab_file = prefab_env.assets[0]
result = {'schemaVersion': 1, 'scope': 'Original skeleton/Skill event evidence only; no controller, render or public admission approval.',
          'source': {'inventory': {'path': 'data/arkpedia-cn-native-source.json', 'sha256': sha(inventory_raw)},
                     'graph': {'path': 'data/candidates/arkpedia-ch16-abnormal-slug-source.json', 'sha256': sha(graph_raw)},
                     'bundle': {'path': path, 'bytes': len(raw), 'md5': row['md5'], 'sha256': sha(raw), 'manifestSha256': sha(manifest_raw)}},
          'enemies': {}}
for key in ['enemy_10126_rkbomb', 'enemy_10126_rkbomb_2']:
    container = next(k for k in env.container if k.endswith('/' + key + '_SkeletonData.asset'))
    sda = objects[env.container[container].path_id]
    tree = sda.read_typetree()
    binding = next(json.loads(r['originalJson'])['skeletonDataAsset'] for r in graph['prefabs']['dyn/battle/prefabs/enemies/' + key + '.prefab']
                   if 'skeletonDataAsset' in json.loads(r['originalJson']))
    assert int(binding['m_PathID']) == sda.path_id
    assert prefab_file.externals[binding['m_FileID'] - 1].path.endswith('/' + sda.assets_file.name)
    skeleton = objects[int(tree['skeletonJSON']['m_PathID'])]
    data = skeleton.read()
    content = data.m_Script
    content = content.encode('utf-8', errors='surrogateescape') if isinstance(content, str) else bytes(content)
    original = canonical(tree)
    result['enemies'][key] = {'container': container, 'prefabBinding': binding,
                            'serializedFile': sda.assets_file.name, 'skeletonDataPathId': str(sda.path_id),
                            'skeletonDataOriginalJson': original, 'skeletonDataSha256': sha(original.encode()),
                            'skeletonTextPathId': str(skeleton.path_id), 'skeletonName': data.m_Name,
                            'bytes': len(content), 'sha256': sha(content), 'base64': base64.b64encode(content).decode()}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/candidates/arkpedia-ch16-abnormal-slug-animation-source.json'
if '--check' in sys.argv:
    assert target.read_text() == text, 'Abnormal Slug animation differs from pinned native bundle'
else:
    target.write_text(text)
print('Verified original Abnormal Slug skeleton bytes and both native prefab bindings')
