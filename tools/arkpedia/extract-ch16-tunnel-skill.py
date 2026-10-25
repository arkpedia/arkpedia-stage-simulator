#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the tunnel's original manual-mode skill, without approving a stage."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402


def exact(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else exact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v) for v in value]
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


inventory_bytes = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_bytes)
name = 'battle/prefabs/[uc]skills.ab'
source = next(b for b in inventory['bundles'] if b['path'] == name)
raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / name).read_bytes()
assert len(raw) == source['bytes'] and hashlib.md5(raw).hexdigest() == source['md5']
assert sha(raw) == source['sha256']
objects = {o.path_id: o for o in UnityPy.load(raw).objects}


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
for obj in objects.values():
    if obj.type.name != 'AssetBundle':
        continue
    for path, entry in obj.read_typetree()['m_Container']:
        if not path.endswith('/sktok_spawnp.prefab'):
            continue
        pending, seen, rows = [int(entry['asset']['m_PathID'])], set(), []
        while pending:
            pid = pending.pop()
            if pid in seen or pid not in objects:
                continue
            seen.add(pid)
            component = objects[pid]
            if component.type.name not in ('GameObject', 'Transform', 'MonoBehaviour'):
                continue
            tree = component.read_typetree()
            pending.extend(refs(tree))
            text = json.dumps(exact(tree), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
            rows.append({'pathId': str(pid), 'componentType': component.type.name,
                         'originalJson': text, 'sha256': sha(text.encode())})
        prefabs[path] = sorted(rows, key=lambda r: int(r['pathId']))
assert len(prefabs) == 1
result = {'schemaVersion': 1, 'scope': 'Retained native skill; no stage admission.',
          'source': {'inventory': 'data/arkpedia-cn-native-source.json',
                     'sha256': sha(inventory_bytes), 'bundle': source}, 'prefabs': prefabs}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/candidates/arkpedia-ch16-tunnel-skill-source.json'
if '--check' in sys.argv:
    assert target.read_text() == text, 'Tunnel skill evidence differs from pinned original'
else:
    target.write_text(text)
print('Verified original sktok_spawnp manual-mode skill')
