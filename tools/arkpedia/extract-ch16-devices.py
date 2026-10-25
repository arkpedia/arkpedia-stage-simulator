#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain device graphs and action closure; extraction never approves admission."""
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
sources = []


def load(path):
    row = next(b for b in inventory['bundles'] if b['path'] == path)
    raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.md5(raw).hexdigest() == row['md5'], path
    assert sha(raw) == row['sha256'], path
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


objects = load('pkgrps/btl_pfb_tokens_4.ab')
prefabs = {}
for obj in objects.values():
    if obj.type.name != 'AssetBundle':
        continue
    for path, entry in obj.read_typetree()['m_Container']:
        if not any(key in path for key in ['trap_270_spawnp', 'trap_271_fowstn', 'trap_272_nomstn']):
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
            text = canonical(tree)
            rows.append({'pathId': str(pid), 'componentType': component.type.name,
                         'originalJson': text, 'sha256': sha(text.encode())})
        prefabs[path] = sorted(rows, key=lambda r: int(r['pathId']))
assert len(prefabs) == 3, list(prefabs)

# Use the serialized native holder, rather than an unverified cached table.
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
            # The native holder embeds actions as serialized JSON strings.
            if key == 'SerializedState' and isinstance(child, str):
                yield from template_refs(json.loads(child))
            yield from template_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from template_refs(child)


pending = [key for rows in prefabs.values() for row in rows
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

tables = {}
for name in ['character_table.json', 'skill_table.json', 'range_table.json']:
    row = next(t for t in inventory['source']['tableSource']['tables'] if t['path'].endswith('/' + name))
    raw = (ROOT / '.cache/arkpedia/cn-coverage' / name).read_bytes()
    assert len(raw) == row['bytes'] and sha(raw) == row['sha256'], name
    tables[name] = json.loads(raw)
characters = {key: tables['character_table.json'][key] for key in ['trap_270_spawnp', 'trap_271_fowstn', 'trap_272_nomstn']}
skills = {s['skillId']: tables['skill_table.json'][s['skillId']]
          for record in characters.values() for s in record['skills']}
result = {'schemaVersion': 1, 'scope': 'Source evidence only; no behavior or admission approval.',
          'source': {'inventory': 'data/arkpedia-cn-native-source.json',
                     'sha256': sha(inventory_raw), 'bundles': sources},
          'prefabs': dict(sorted(prefabs.items())), 'templates': dict(sorted(templates.items())),
          'tableSource': inventory['source']['tableSource'], 'characters': characters, 'skills': skills,
          'ranges': {key: tables['range_table.json'][key] for key in ['x-2', 'x-4', '0-1']}}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/candidates/arkpedia-ch16-device-source.json'
if '--check' in sys.argv:
    assert target.read_text() == text, 'Device evidence differs from pinned native bundles'
else:
    target.write_text(text)
print(f'Verified {len(prefabs)} devices and {len(templates)} native templates')
