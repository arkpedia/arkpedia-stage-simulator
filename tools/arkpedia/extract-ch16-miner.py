#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain Collapsing miner graph/actions; extraction never approves admission."""
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


def canonical(value):
    return json.dumps(exact(value), ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_raw)
enemy_inventory_raw = (ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes()
enemy_inventory = json.loads(enemy_inventory_raw)
sources = []


def load(path):
    row = next((b for b in inventory['bundles'] + enemy_inventory['bundles'] if b['path'] == path), None)
    if row is None:
        manifest_bytes = (ROOT / '.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes()
        assert sha(manifest_bytes) == inventory['source']['manifestSha256']
        original = next(b for b in json.loads(manifest_bytes)['abInfos'] if b['name'] == path)
        row = {'path': path, 'bytes': original['abSize'], 'md5': original['md5'],
               'manifestSha256': sha(manifest_bytes)}
    raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.md5(raw).hexdigest() == row['md5'], path
    if 'sha256' in row:
        assert sha(raw) == row['sha256'], path
    else:
        row['sha256'] = sha(raw)
    sources.append(row)
    return {o.path_id: o for o in UnityPy.load(raw).objects}


def refs(value):
    if isinstance(value, dict):
        if value.get('m_FileID') == 0 and value.get('m_PathID'):
            yield int(value['m_PathID'])
        for child in value.values():
            yield from refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from refs(child)


def extract(objects, names):
    prefabs = {}
    for obj in objects.values():
        if obj.type.name != 'AssetBundle':
            continue
        for path, entry in obj.read_typetree()['m_Container']:
            if not any('/' + key + '.prefab' in path for key in names):
                continue
            pending, seen, rows = [int(entry['asset']['m_PathID'])], set(), []
            while pending:
                pid = pending.pop()
                if pid in seen or pid not in objects:
                    continue
                seen.add(pid)
                component = objects[pid]
                if component.type.name not in ('GameObject', 'Transform', 'MonoBehaviour', 'CircleCollider2D',
                                               'BoxCollider2D', 'CapsuleCollider2D', 'Rigidbody2D',
                                               'SphereCollider', 'BoxCollider', 'CapsuleCollider'):
                    continue
                tree = component.read_typetree()
                pending.extend(refs(tree))
                text = canonical(tree)
                rows.append({'pathId': str(pid), 'componentType': component.type.name,
                             'originalJson': text, 'sha256': sha(text.encode())})
            prefabs[path] = sorted(rows, key=lambda r: int(r['pathId']))
    return prefabs


enemies = extract(load('battle/enm_pfb_28.ab'), ['enemy_3010_mcreep'])
assert len(enemies) == 1
projectiles = {}
holder = load('config/buff_template_holder.ab')
available = {}
for obj in holder.values():
    if obj.type.name == 'MonoBehaviour':
        for template in obj.read_typetree().get('_templates', []):
            available[template['templateKey']] = template


def template_refs(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'templateKey' and isinstance(child, str):
                yield child
            if key == 'SerializedState' and isinstance(child, str):
                yield from template_refs(json.loads(child))
            yield from template_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from template_refs(child)


pending = [key for rows in list(enemies.values()) + list(projectiles.values()) for row in rows
           for key in template_refs(json.loads(row['originalJson']))]
templates = {}
while pending:
    key = pending.pop()
    if key in templates:
        continue
    assert key in available, f'Missing native template {key}'
    value = available[key]
    text = canonical(value)
    templates[key] = {'originalJson': text, 'sha256': sha(text.encode())}
    pending.extend(template_refs(value))

result = {'schemaVersion': 1, 'scope': 'Source evidence only; no behavior or admission approval.',
          'source': {'inventory': 'data/arkpedia-cn-native-source.json', 'sha256': sha(inventory_raw),
                     'enemyInventory': {'path': 'data/arkpedia-cn-enemy-native-source.json', 'sha256': sha(enemy_inventory_raw)},
                     'bundles': sources},
          'prefabs': dict(sorted(enemies.items())), 'projectiles': dict(sorted(projectiles.items())),
          'templates': dict(sorted(templates.items()))}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/candidates/arkpedia-ch16-miner-source.json'
if '--check' in sys.argv:
    assert target.read_text(encoding='utf8') == text, 'Miner evidence differs from pinned native bundles'
else:
    target.write_text(text, encoding='utf8', newline='\n')
print(f'Verified {len(enemies)} miner prefabs, {len(projectiles)} projectile and {len(templates)} templates')
