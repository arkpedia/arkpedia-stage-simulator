#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain a complete pinned enemy/projectile/template closure; grant no support."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family', required=True)
parser.add_argument('--prefab', action='append', required=True)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[a-z][a-z0-9-]*', args.family) or any(not re.fullmatch(r'enemy_[a-z0-9_]+', k) for k in args.prefab):
    parser.error('Family and prefab names must be plain identifiers')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def exact(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else exact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def canonical(value):
    return json.dumps(exact(value), ensure_ascii=False, sort_keys=True, separators=(',', ':'))


inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
enemy_raw = (ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes()
inventory, enemy_inventory = json.loads(inventory_raw), json.loads(enemy_raw)
index = json.loads((ROOT / 'data/arkpedia-enemy-clock-source.json').read_bytes())
assert index['source']['sha256'] == sha(enemy_raw)
cache = ROOT / '.cache/arkpedia/cn-native-source'
manifest_raw = (cache / 'hot_update_list.json').read_bytes()
assert sha(manifest_raw) == inventory['source']['manifestSha256']
manifest = json.loads(manifest_raw)
loaded, receipts = {}, {}


def load(name):
    if name in loaded:
        return loaded[name]
    row = next((b for b in inventory['bundles'] + enemy_inventory['bundles'] if b['path'] == name), None)
    if row is None:
        native = next(b for b in manifest['abInfos'] if b['name'] == name)
        row = {'path': name, 'bytes': native['abSize'], 'md5': native['md5'], 'manifestSha256': sha(manifest_raw)}
    else:
        row = dict(row)
    raw = (cache / 'bundles' / name).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.md5(raw).hexdigest() == row['md5'], name
    assert 'sha256' not in row or row['sha256'] == sha(raw), name
    row['sha256'] = sha(raw)
    receipts[name] = row
    loaded[name] = {o.path_id: o for o in UnityPy.load(raw).objects}
    return loaded[name]


def refs(value):
    if isinstance(value, dict):
        if value.get('m_FileID') == 0 and value.get('m_PathID'):
            yield int(value['m_PathID'])
        for child in value.values():
            yield from refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from refs(child)


def extract(objects, wanted):
    result = {}
    for obj in objects.values():
        if obj.type.name != 'AssetBundle':
            continue
        for name, entry in obj.read_typetree()['m_Container']:
            if name.split('/')[-1].removesuffix('.prefab') not in wanted:
                continue
            pending, seen, rows = [int(entry['asset']['m_PathID'])], set(), []
            while pending:
                pid = pending.pop()
                if pid in seen or pid not in objects:
                    continue
                seen.add(pid)
                component = objects[pid]
                if component.type.name not in ('GameObject', 'Transform', 'MonoBehaviour', 'CircleCollider2D',
                    'BoxCollider2D', 'CapsuleCollider2D', 'Rigidbody2D', 'SphereCollider', 'BoxCollider', 'CapsuleCollider'):
                    continue
                tree = component.read_typetree()
                pending.extend(refs(tree))
                text = canonical(tree)
                rows.append({'pathId': str(pid), 'componentType': component.type.name,
                             'originalJson': text, 'sha256': sha(text.encode())})
            result[name] = sorted(rows, key=lambda r: int(r['pathId']))
    return result


prefabs = {}
for key in sorted(set(args.prefab)):
    name = next(p for p in index['prefabs'] if p.endswith('/' + key + '.prefab'))
    found = extract(load(index['prefabs'][name]['bundle']), {key})
    assert list(found) == [name], key
    prefabs.update(found)

available = {}
for obj in load('config/buff_template_holder.ab').values():
    if obj.type.name == 'MonoBehaviour':
        for t in obj.read_typetree().get('_templates', []):
            available[t['templateKey']] = t


def dependencies(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'templateKey' and child:
                yield 'template', child
            if 'projectile' in key.lower() and isinstance(child, str) and child.startswith('projectile_'):
                yield 'projectile', child
            if key == 'SerializedState' and isinstance(child, str):
                yield from dependencies(json.loads(child))
            yield from dependencies(child)
    elif isinstance(value, list):
        for child in value:
            yield from dependencies(child)


pending = [d for rows in prefabs.values() for row in rows for d in dependencies(json.loads(row['originalJson']))]
templates, projectiles, seen = {}, {}, set()
while pending:
    kind, key = pending.pop()
    if (kind, key) in seen:
        continue
    seen.add((kind, key))
    if kind == 'template':
        value = available[key]
        text = canonical(value)
        templates[key] = {'originalJson': text, 'sha256': sha(text.encode())}
        pending.extend(dependencies(value))
    else:
        found = extract(load('battle/prefabs/[uc]projectiles.ab'), {key})
        assert len(found) == 1, 'Missing original projectile ' + key
        projectiles.update(found)
        pending.extend(d for rows in found.values() for row in rows for d in dependencies(json.loads(row['originalJson'])))

result = {'schemaVersion': 1, 'scope': 'Complete retained native family closure. Source only; no behavioral or admission approval.',
    'source': {'inventory': 'data/arkpedia-cn-native-source.json', 'sha256': sha(inventory_raw),
        'enemyInventory': {'path': 'data/arkpedia-cn-enemy-native-source.json', 'sha256': sha(enemy_raw)},
        'bundles': [receipts[k] for k in sorted(receipts)]},
    'prefabs': dict(sorted(prefabs.items())), 'projectiles': dict(sorted(projectiles.items())),
    'templates': dict(sorted(templates.items()))}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / ('data/candidates/arkpedia-' + args.family + '-source.json')
if args.check:
    assert target.read_text(encoding='utf8') == text, 'Retained family differs from original pinned inputs'
else:
    target.write_text(text, encoding='utf8', newline='\n')
print('Verified', len(prefabs), 'prefabs,', len(projectiles), 'projectiles and', len(templates), 'templates for', args.family)
