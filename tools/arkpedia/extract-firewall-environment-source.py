#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the two original Chapter 17 environment graphs; approve no stage."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
sha = lambda raw: hashlib.sha256(raw).hexdigest()
inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_raw)
cache = ROOT / '.cache/arkpedia/cn-native-source'
manifest_raw = (cache / 'hot_update_list.json').read_bytes()
assert sha(manifest_raw) == inventory['source']['manifestSha256']
name = 'battle/prefabs/[uc]envsystems.ab'
row = next(b for b in json.loads(manifest_raw)['abInfos'] if b['name'] == name)
raw = (cache / 'bundles' / name).read_bytes()
assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
assert sha(raw) == '42d2b4ed4b533fa4f001107f476c4cc6a10ff8d8e7c04448b9886a8052058e3f'
objects = {o.path_id: o for o in UnityPy.load(raw).objects}


def exact(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else exact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def refs(value):
    if isinstance(value, dict):
        if value.get('m_FileID') == 0 and value.get('m_PathID'):
            yield int(value['m_PathID'])
        for child in value.values():
            yield from refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from refs(child)


prefabs = {}
wanted = {'env_v073_mainline17_boss_ctrl', 'env_v073_mainline17_ctrl'}
for obj in objects.values():
    if obj.type.name != 'AssetBundle':
        continue
    for path, entry in obj.read_typetree()['m_Container']:
        if path.split('/')[-1].removesuffix('.prefab') not in wanted:
            continue
        pending, seen, rows = [int(entry['asset']['m_PathID'])], set(), []
        while pending:
            pid = pending.pop()
            if pid in seen or pid not in objects:
                continue
            seen.add(pid)
            component = objects[pid]
            assert component.type.name in ('GameObject', 'Transform', 'MonoBehaviour'), component.type.name
            tree = component.read_typetree()
            pending.extend(refs(tree))
            text = json.dumps(exact(tree), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
            rows.append({'pathId': str(pid), 'componentType': component.type.name, 'originalJson': text, 'sha256': sha(text.encode())})
        prefabs[path] = sorted(rows, key=lambda r: int(r['pathId']))
assert len(prefabs) == len(wanted)
result = {'schemaVersion': 1, 'scope': 'Complete retained Chapter 17 boss/firewall and Leak Source environment graphs. Source only; no stage, controller, geometry or visual support approval.',
          'source': {'inventory': {'path': 'data/arkpedia-cn-native-source.json', 'sha256': sha(inventory_raw)},
                     'bundle': {'path': name, 'bytes': len(raw), 'md5': row['md5'], 'sha256': sha(raw), 'manifestSha256': sha(manifest_raw)}},
          'prefabs': dict(sorted(prefabs.items()))}
target = ROOT / 'data/candidates/arkpedia-ch17-firewall-environment-source.json'
text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
if args.check:
    assert target.read_text(encoding='utf-8') == text, 'Environment graph differs from original bundle'
else:
    target.write_text(text, encoding='utf-8')
print('Verified two original environment graphs with', sum(map(len, prefabs.values())), 'components; no support admitted')
