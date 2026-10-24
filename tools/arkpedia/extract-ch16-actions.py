#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain serialized chapter 16 actions/projectiles from the existing pinned CN bundles."""
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
        return {key: str(v) if key == 'm_PathID' else exact(v) for key, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [exact(v) for v in value]
    return value


def canonical(value):
    return json.dumps(exact(value), sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def sha(value):
    return hashlib.sha256(value).hexdigest()


inventory_path = ROOT / 'data/arkpedia-cn-native-source.json'
inventory_bytes = inventory_path.read_bytes()
inventory = json.loads(inventory_bytes)
sources = []


def load(name):
    row = next((b for b in inventory['bundles'] if b['path'] == name), None)
    if row is None:
        manifest_bytes = (ROOT / '.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes()
        assert sha(manifest_bytes) == inventory['source']['manifestSha256']
        original = next(b for b in json.loads(manifest_bytes)['abInfos'] if b['name'] == name)
        row = {'path': name, 'bytes': original['abSize'], 'md5': original['md5'],
               'manifestSha256': sha(manifest_bytes)}
    raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / name).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.md5(raw).hexdigest() == row['md5'], name
    if 'sha256' in row:
        assert sha(raw) == row['sha256'], name
    else:
        row['sha256'] = sha(raw)
    sources.append(row)
    return {o.path_id: o for o in UnityPy.load(raw).objects}


holder = load('config/buff_template_holder.ab')
templates = {}
for obj in holder.values():
    if obj.type.name != 'MonoBehaviour':
        continue
    tree = obj.read_typetree()
    for template in tree.get('_templates', []):
        key = template['templateKey']
        if key.startswith(('mcreep_', 'muveg_', 'enemy_mumag_', 'enemy_muveg_', 'enemy_mucow_', 'enemy_muwiz_', 'enemy_murad_', 'trap_rift')):
            text = canonical(template)
            templates[key] = {'originalJson': text, 'sha256': sha(text.encode())}

projectile_objects = load('battle/prefabs/[uc]projectiles.ab')
projectiles = {}
for obj in projectile_objects.values():
    if obj.type.name != 'AssetBundle':
        continue
    for path, entry in obj.read_typetree()['m_Container']:
        if not any('/' + name + '.' in path for name in ['projectile_enemy_murad', 'projectile_enemy_murad_hide',
                                                        'projectile_enemy_muwiz_line', 'projectile_enemy_mumag_charge',
                                                        'projectile_enemy_muwiz', 'projectile_enemy_mumag']):
            continue
        root = entry['asset']['m_PathID']
        rows, seen = [], set()

        def visit_game_object(pid):
            go = projectile_objects[pid].read_typetree()
            for comp in go['m_Component']:
                cid = comp['component']['m_PathID']
                component = projectile_objects[cid]
                if component.type.name == 'Transform':
                    text = canonical(component.read_typetree())
                    rows.append({'pathId': str(cid), 'objectName': go['m_Name'], 'componentType': 'Transform',
                                 'originalJson': text, 'sha256': sha(text.encode())})
                    seen.add(cid)
                    for child in component.read_typetree()['m_Children']:
                        tr = projectile_objects[child['m_PathID']].read_typetree()
                        visit_game_object(tr['m_GameObject']['m_PathID'])
                elif component.type.name in ('MonoBehaviour', 'SphereCollider', 'BoxCollider', 'CapsuleCollider', 'CircleCollider2D', 'BoxCollider2D', 'CapsuleCollider2D') and cid not in seen:
                    seen.add(cid)
                    text = canonical(component.read_typetree())
                    rows.append({'pathId': str(cid), 'objectName': go['m_Name'],
                                 'originalJson': text, 'sha256': sha(text.encode())})

        visit_game_object(root)
        # Range assets/selectors can be same-bundle ScriptableObjects outside
        # the GameObject hierarchy. Retain their transitive serialized closure.
        def references(value):
            if isinstance(value, dict):
                if value.get('m_FileID') == 0 and 'm_PathID' in value:
                    yield int(value['m_PathID'])
                for child in value.values():
                    yield from references(child)
            elif isinstance(value, list):
                for child in value:
                    yield from references(child)

        pending = [json.loads(row['originalJson']) for row in rows]
        while pending:
            for cid in references(pending.pop()):
                component = projectile_objects.get(cid)
                if cid in seen or component is None or component.type.name != 'MonoBehaviour':
                    continue
                seen.add(cid)
                tree = component.read_typetree()
                text = canonical(tree)
                rows.append({'pathId': str(cid), 'objectName': tree.get('m_Name', ''),
                             'referenced': True, 'originalJson': text, 'sha256': sha(text.encode())})
                pending.append(tree)
        projectiles[path] = sorted(rows, key=lambda row: int(row['pathId']))

env_objects = load('battle/prefabs/[uc]envsystems.ab')
environments = {}
for obj in env_objects.values():
    if obj.type.name != 'AssetBundle':
        continue
    for path, entry in obj.read_typetree()['m_Container']:
        if 'mainline16_ctrl' not in path and 'mainline17_ctrl' not in path and 'mainline17_boss_ctrl' not in path:
            continue
        go = env_objects[entry['asset']['m_PathID']].read_typetree()
        rows = []
        for comp in go['m_Component']:
            cid = comp['component']['m_PathID']
            component = env_objects[cid]
            if component.type.name == 'MonoBehaviour':
                text = canonical(component.read_typetree())
                rows.append({'pathId': str(cid), 'objectName': go['m_Name'],
                             'originalJson': text, 'sha256': sha(text.encode())})
        environments[path] = sorted(rows, key=lambda row: int(row['pathId']))

result = {'schemaVersion': 1, 'scope': 'Serialized source data only; no runtime or public admission approval.',
          'source': {'inventory': 'data/arkpedia-cn-native-source.json', 'sha256': sha(inventory_bytes), 'bundles': sources},
          'environments': dict(sorted(environments.items())),
          'templates': dict(sorted(templates.items())), 'projectiles': dict(sorted(projectiles.items()))}
assert len(projectiles) == 6 and 'mcreep_t[get_heal]' in templates
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/candidates/arkpedia-ch16-action-source.json'
if '--check' in sys.argv:
    assert target.read_text() == text, 'Chapter 16 serialized action evidence differs from pinned source'
else:
    target.write_text(text)
print(f'Verified {len(templates)} templates and {len(projectiles)} projectiles from pinned native bundles')
