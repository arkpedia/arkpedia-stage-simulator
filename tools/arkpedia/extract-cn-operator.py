#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover an explicitly selected CN owner's native hierarchy and dependencies.

This creates held source evidence, never a playable kit. Token-dependent owners
fail closed until their separate native token/artwork graphs can be recovered.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
parser = argparse.ArgumentParser()
parser.add_argument('--operator', required=True)
args = parser.parse_args()
ID = args.operator
assert re.fullmatch(r'char_\d+_[a-z0-9]+', ID), 'Expected an original CN operator ID'
C = ROOT / '.cache/arkpedia'
OUT = C / 'cn-operators' / ID
NODE = os.environ.get('ARKPEDIA_SOURCE_NODE', 'node')
PIN = 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add'
subprocess.run([NODE, 'tools/arkpedia/verify-cn-native.mjs'], cwd=ROOT, check=True, capture_output=True)
source_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(source_raw)
assert ID in inventory['operators']
cn = json.loads((ROOT / 'data/arkpedia-cn-source.json').read_bytes())
assert cn['source']['commit'] == PIN
TABLES = {r['path'].split('/')[-1]: r for r in cn['source']['tables']}
TABLES.update({
    'buff_template_data.json': {'path': 'zh_CN/gamedata/battle/buff_template_data.json', 'bytes': 27996217,
                                'gitBlob': 'a94bbb391fded80e59db38ad7c3ded89e25fd682'},
    'buff_table.json': {'path': 'zh_CN/gamedata/buff_table.json', 'bytes': 176162,
                       'gitBlob': 'b588d86b514d61c0025c0d9534f2a4e548aae302'},
})
sha = lambda b: hashlib.sha256(b).hexdigest()
tables, table_sources = {}, {}
for filename, row in TABLES.items():
    raw = (C / ('cn-coverage/' if '/excel/' in row['path'] else 'cn-native-source/tables/') / filename).read_bytes()
    assert len(raw) == row['bytes']
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == row['gitBlob']
    tables[filename] = json.loads(raw)
    table_sources[filename] = {**row, 'sha256': sha(raw)}
ct, st, rt, bt, db = [tables[k + '.json'] for k in
                     ['character_table', 'skill_table', 'range_table', 'buff_template_data', 'buff_table']]
assert ct[ID] == cn['tables']['characters'][ID]
skill_ids = [s['skillId'] for s in ct[ID]['skills']]
assert all(st[s] == cn['tables']['skills'][s] for s in skill_ids)

def exact(v, key=''):
    if isinstance(v, dict):
        return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, (tuple, list)):
        return [exact(x, key) for x in v]
    if key == 'm_PathID':
        return str(v)
    if isinstance(v, float) and not math.isfinite(v):
        return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

bundles, bundle_sources = {}, []
def load(path):
    if path in bundles:
        return bundles[path]
    row = next(r for r in inventory['bundles'] if r['path'] == path)
    raw = (C / 'cn-native-source/bundles' / path).read_bytes()
    assert len(raw) == row['bytes'] and sha(raw) == row['sha256']
    env = UnityPy.load(raw)
    objects, roots = {o.path_id: o for o in env.objects}, {}
    for reader in env.objects:
        if reader.type.name == 'AssetBundle':
            for name, fields in reader.read_typetree()['m_Container']:
                pointer = fields['asset']
                if pointer['m_FileID'] == 0:
                    assert name not in roots
                    roots[name] = pointer['m_PathID']
    bundles[path] = {'objects': objects, 'roots': roots}
    bundle_sources.append(row)
    return bundles[path]

def graph(path, container):
    bundle = load(path); by = bundle['objects']
    root = bundle['roots'][container]
    found = {}
    def walk(go_id):
        assert go_id not in found, ('Repeated native hierarchy node', go_id)
        go = by[go_id]
        assert go.type.name == 'GameObject'
        data = go.read_typetree()
        row = {'object': data['m_Name'], 'pathId': str(go_id), 'gameObjectData': exact(data), 'components': []}
        found[go_id] = row
        for entry in data['m_Component']:
            pointer = entry['component']
            assert pointer['m_FileID'] == 0
            reader = by[pointer['m_PathID']]; part = reader.read_typetree()
            row['components'].append({'pathId': str(reader.path_id), 'type': reader.type.name, 'data': exact(part)})
            if reader.type.name == 'Transform':
                for child in part['m_Children']:
                    assert child['m_FileID'] == 0
                    walk(by[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID'])
    walk(root)
    return [found[k] for k in sorted(found)]

owner_path, art_path = f'charpack/{ID}.ab', f'chararts/{ID}.ab'
characters = {ID: graph(owner_path, f'dyn/battle/prefabs/characters/{ID}.prefab')}
artwork = {ID: graph(art_path, f'dyn/battle/prefabs/skins/character/{ID}/defaultskin.prefab')}
art_parts = [r for row in artwork[ID] for r in row['components'] if '_animations' in r['data']]
assert len(art_parts) == 1, 'Expected one original default-skin animation controller'
chararts = {ID: [{'pathId': r['pathId'], 'data': r['data']} for r in art_parts]}
skill_path = 'battle/prefabs/[uc]skills.ab'
skill_bundle = load(skill_path)
skills, skill_bindings, mode_skills, prefab_overrides = {}, {}, [], {}
for key in skill_ids:
    prefabs = list(dict.fromkeys(rank['prefabId'] for rank in st[key]['levels']))
    skill_bindings[key] = prefabs
    override = next(s for s in ct[ID]['skills'] if s['skillId'] == key)['overridePrefabKey']
    if override is not None:
        assert isinstance(override, str) and override, 'Invalid original skill prefab override'
        prefab_overrides[key] = override
    # Preserve literal rank bindings, but follow an explicit character override
    # instead of treating a null shared prefab as an inferred owner-mode skill.
    for prefab in [override] if override is not None else prefabs:
        if prefab is None:
            mode_skills.append(key)
        elif prefab not in skills:
            skills[prefab] = graph(skill_path, f'dyn/battle/prefabs/[uc]skills/{prefab}.prefab')
projectile_path = 'battle/prefabs/[uc]projectiles.ab'
projectile_bundle = load(projectile_path)
holder_bundle = load('config/buff_template_holder.ab')
holders = [r.read_typetree()['_templates'] for r in holder_bundle['objects'].values()
           if r.type.name == 'MonoBehaviour' and '_templates' in r.read_typetree()]
assert len(holders) == 1
native = {r['templateKey']: r for r in holders[0]}
parameters = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey',
              '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey'}
needed, db_keys, projectiles, token_refs = set(), set(), {}, set()
def scan(v, field=''):
    if field in ['_overrideAudioSignal', 'audioSignal']:
        return
    if isinstance(v, dict):
        for key, value in v.items():
            scan(value, key)
    elif isinstance(v, (list, tuple)):
        for value in v:
            scan(value, field)
    elif isinstance(v, str):
        if v.startswith('token_') and v in ct and field not in parameters:
            token_refs.add(v)
        if v.startswith('projectile_') and field not in parameters and v not in projectiles:
            container = f'dyn/battle/prefabs/[uc]projectiles/{v}.prefab'
            assert container in projectile_bundle['roots'], ('Missing native projectile', v)
            projectiles[v] = graph(projectile_path, container)
            scan(projectiles[v])
        if v in bt or v in native:
            if v not in needed:
                needed.add(v); scan(bt.get(v)); scan(native.get(v))
        if v in db and v not in db_keys:
            db_keys.add(v); scan(db[v])
        if v.startswith(('[', '{')):
            try:
                decoded = json.loads(v)
            except json.JSONDecodeError:
                return
            scan(decoded)
scan([characters, skills, ct[ID], [st[s] for s in skill_ids]])
assert not token_refs, f'Token-dependent source remains held for a native token/artwork graph extension: {sorted(token_refs)}'
all_values = []
def values(v):
    if isinstance(v, dict):
        for x in v.values():
            values(x)
    elif isinstance(v, (tuple, list)):
        for x in v:
            values(x)
    elif isinstance(v, str):
        all_values.append(v)
        if v.startswith(('[', '{')):
            try:
                decoded = json.loads(v)
            except json.JSONDecodeError:
                return
            values(decoded)
values([ct[ID], [st[s] for s in skill_ids], characters, skills, projectiles,
        [bt.get(k) for k in needed], [native.get(k) for k in needed]])
ranges = sorted(set(all_values) & rt.keys())

by = bundles[art_path]['objects']
def ref(p):
    assert p['m_FileID'] == 0 and int(p['m_PathID']) != 0
    return by[int(p['m_PathID'])]
animator = chararts[ID][0]
bindings = {}
art_data = animator['data']
facings = {face.title(): art_data['_' + face]['skeleton'] for face in ['front', 'back', 'down']
           if '_' + face in art_data and art_data['_' + face]['skeleton']['m_PathID'] != '0'}
if '_skeleton' in art_data:
    assert not facings
    facings = {'Single': art_data['_skeleton']}
assert facings
exports = {}
for face, pointer in facings.items():
    skeleton = ref(pointer); asset = ref(skeleton.read_typetree()['skeletonDataAsset'])
    data = asset.read_typetree(); text = ref(data['skeletonJSON'])
    assert len(data['atlasAssets']) == 1
    atlas = ref(data['atlasAssets'][0]); atlas_text = ref(atlas.read_typetree()['atlasFile'])
    def raw(reader):
        text = reader.read().m_Script
        return text.encode('utf8', 'surrogateescape') if isinstance(text, str) else bytes(text)
    skel_bytes, atlas_bytes = raw(text), raw(atlas_text)
    bindings[face] = {'animatorPathId': animator['pathId'], 'skeletonAnimationPathId': str(skeleton.path_id),
                      'skeletonDataAssetPathId': str(asset.path_id), 'textAssetPathId': str(text.path_id),
                      'atlasAssetPathId': str(atlas.path_id), 'atlasTextAssetPathId': str(atlas_text.path_id),
                      'sha256': sha(skel_bytes), 'bytes': len(skel_bytes),
                      'atlasSha256': sha(atlas_bytes), 'atlasBytes': len(atlas_bytes)}
    exports[face.lower() + '.skel'] = skel_bytes
    exports[face.lower() + '.atlas'] = atlas_bytes
OUT.mkdir(parents=True, exist_ok=True)
for name, raw_bytes in exports.items():
    (OUT / name).write_bytes(raw_bytes)
(OUT / 'bindings.json').write_text(json.dumps(bindings, indent=2) + '\n')
subprocess.run([NODE, 'tools/arkpedia/inspect-cn-operator.mjs', '--operator', ID], cwd=ROOT, check=True)
evidence = {'schemaVersion': 2, 'operatorId': ID, 'enabledOperators': [], 'heldOperators': [ID],
            'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
            'source': {'repository': inventory['source']['repository'], 'commit': PIN,
                       'nativeClient': inventory['source']['resourceVersion'], 'nativeInventorySha256': sha(source_raw),
                       'tableGitBlobs': table_sources, 'bundles': bundle_sources},
            'characters': characters, 'artworkHierarchy': artwork, 'chararts': chararts,
            'skills': skills, 'skillBindings': skill_bindings, 'ownerModeSkills': mode_skills,
            'projectiles': projectiles, 'templates': {k: bt[k] for k in sorted(needed) if k in bt},
            'originalTemplates': {k: exact(native[k]) for k in sorted(needed) if k in native},
            'buffDatabase': {k: db[k] for k in sorted(db_keys)},
            'tables': {'character': ct[ID], 'skills': {s: st[s] for s in skill_ids}, 'ranges': {k: rt[k] for k in ranges}},
            'officialSkeletonBindings': {ID: bindings}, 'models': {ID: json.loads((OUT / 'models.json').read_bytes())},
            'nativeTemplateGaps': sorted(needed - native.keys()), 'jsonTemplateGaps': sorted(needed - bt.keys()),
            'reviewStatus': 'Held original CN source; combat, model delivery, modules and game-frame proof remain separate'}
if prefab_overrides:
    evidence['skillPrefabOverrides'] = prefab_overrides
destination = ROOT / 'data/arkpedia-native-operators' / (ID + '.json')
destination.parent.mkdir(parents=True, exist_ok=True)
temporary = destination.with_suffix('.json.tmp')
temporary.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n')
temporary.replace(destination)
print(json.dumps({'operator': ID, 'components': sum(len(r['components']) for group in [characters, skills, projectiles]
                                                   for rows in group.values() for r in rows),
                  'templates': sorted(needed), 'projectiles': sorted(projectiles), 'ranges': ranges,
                  'nativeTemplateGaps': evidence['nativeTemplateGaps'], 'jsonTemplateGaps': evidence['jsonTemplateGaps']}))
