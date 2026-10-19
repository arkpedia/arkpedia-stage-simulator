#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover an explicitly selected CN owner's native hierarchy and dependencies.

This creates held source evidence, never a playable kit. Referenced tokens must
resolve to original prefab graphs and embedded artwork; unsupported bindings fail.
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

bundles = {}
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
def skill_graphs(rows):
    bindings, overrides, modes = {}, {}, []
    for row in rows:
        key = row['skillId']
        if key is None:
            # Token promotion slots can be literal empty placeholders. Their
            # complete original rows remain in tables.tokens; no skill table,
            # mode skill or fallback prefab is invented for an unnamed slot.
            assert row['overridePrefabKey'] is None and row['overrideTokenKey'] is None, 'Unsupported null skill slot override'
            continue
        prefabs = list(dict.fromkeys(rank['prefabId'] for rank in st[key]['levels']))
        bindings[key] = prefabs
        override = row['overridePrefabKey']
        if override is not None:
            assert isinstance(override, str) and override, 'Invalid original skill prefab override'
            overrides[key] = override
        # Literal null ranks remain evidence; only explicit overrides resolve them.
        for prefab in [override] if override is not None else prefabs:
            if prefab is None:
                modes.append(key)
            elif prefab not in skills:
                skills[prefab] = graph(skill_path, f'dyn/battle/prefabs/[uc]skills/{prefab}.prefab')
    return bindings, overrides, modes
skill_bindings, prefab_overrides, mode_skills = skill_graphs(ct[ID]['skills'])
token_skill_bindings, token_prefab_overrides, token_mode_skills = {}, {}, {}
projectile_path = 'battle/prefabs/[uc]projectiles.ab'
projectile_bundle = load(projectile_path)
holder_bundle = load('config/buff_template_holder.ab')
holders = [r.read_typetree()['_templates'] for r in holder_bundle['objects'].values()
           if r.type.name == 'MonoBehaviour' and '_templates' in r.read_typetree()]
assert len(holders) == 1
native = {r['templateKey']: r for r in holders[0]}
parameters = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey',
              '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey',
              '_projectileIndexKey', '_multiplyParamKey', '_atkScaleKey'}
needed, db_keys, projectiles, tokens, token_sources = set(), set(), {}, {}, {}
token_containers = None
def resolve_token(key):
    global token_containers
    if token_containers is None:
        token_containers = {}
        for row in inventory['bundles']:
            if not re.fullmatch(r'pkgrps/btl_pfb_tokens_\d+\.ab', row['path']):
                continue
            for container, root in load(row['path'])['roots'].items():
                if not re.fullmatch(r'dyn/battle/prefabs/\[uc\]tokens/token_[a-z0-9_]+\.prefab', container):
                    continue
                assert container not in token_containers, ('Ambiguous original token container', container)
                token_containers[container] = (row['path'], root)
    container = f'dyn/battle/prefabs/[uc]tokens/{key}.prefab'
    assert container in token_containers, ('Missing original token container', key)
    path, root = token_containers[container]
    rows = graph(path, container)
    roots = [part for row in rows if row['pathId'] == str(root) for part in row['components']
             if '_animator' in part['data']]
    assert len(roots) == 1, ('Expected one original token animator owner', key)
    pointer = roots[0]['data']['_animator']
    assert pointer['m_FileID'] == 0 and pointer['m_PathID'] != '0', ('Unsupported external token artwork', key)
    controllers = [part for row in rows for part in row['components']
                   if part['pathId'] == pointer['m_PathID'] and '_animations' in part['data']]
    assert len(controllers) == 1, ('Missing embedded original token artwork controller', key)
    token_sources[key] = {'bundle': path, 'container': container, 'rootPathId': str(root),
                          'animatorPathId': pointer['m_PathID']}
    return rows
def scan(v, field=''):
    if field in ['_overrideAudioSignal', 'audioSignal', '_audioSignal']:
        return
    if isinstance(v, dict):
        # Native blackboard formulas assign variable names, not prefab keys.
        # Keep arbitrary _targetKey fields subject to the missing-asset guard.
        formula = {'_formulaType', '_source', '_target', '_type', '_sourceKey', '_targetKey'} <= v.keys()
        for key, value in list(v.items()):
            if key.startswith('token_') and key in ct:
                scan(key)
            scan(value, 'key' if formula and key in {'_sourceKey', '_sourceKey2', '_targetKey'} else key)
    elif isinstance(v, (list, tuple)):
        for value in v:
            scan(value, field)
    elif isinstance(v, str):
        if v.startswith('token_') and v in ct and field not in parameters and v not in tokens:
            tokens[v] = resolve_token(v)
            token_skill_bindings[v], token_prefab_overrides[v], token_mode_skills[v] = skill_graphs(ct[v]['skills'])
            scan([tokens[v], ct[v], [st[row['skillId']] for row in ct[v]['skills'] if row['skillId'] is not None], skills])
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
        [bt.get(k) for k in needed], [native.get(k) for k in needed], tokens, [ct[k] for k in tokens],
        [st[row['skillId']] for key in tokens for row in ct[key]['skills'] if row['skillId'] is not None]])
ranges = sorted(set(all_values) & rt.keys())

def export_artwork(path, animator, directory, token=None):
    by = bundles[path]['objects']
    def ref(p):
        assert p['m_FileID'] == 0 and int(p['m_PathID']) != 0
        return by[int(p['m_PathID'])]
    bindings, exports = {}, {}
    art_data = animator['data']
    facings = {face.title(): art_data['_' + face]['skeleton'] for face in ['front', 'back', 'down']
               if '_' + face in art_data and art_data['_' + face]['skeleton']['m_PathID'] != '0'}
    if '_skeleton' in art_data:
        assert not facings
        facings = {'Single': art_data['_skeleton']}
    assert facings
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
    directory.mkdir(parents=True, exist_ok=True)
    for name, raw_bytes in exports.items():
        (directory / name).write_bytes(raw_bytes)
    (directory / 'bindings.json').write_text(json.dumps(bindings, indent=2) + '\n')
    subprocess.run([NODE, 'tools/arkpedia/inspect-cn-operator.mjs', '--operator', ID,
                    *(['--token', token] if token else [])], cwd=ROOT, check=True)
    return bindings, json.loads((directory / 'models.json').read_bytes())

bindings, owner_models = export_artwork(art_path, chararts[ID][0], OUT)
all_bindings, all_models, token_art = {ID: bindings}, {ID: owner_models}, {}
for key in sorted(tokens):
    source = token_sources[key]
    controller = next(part for row in tokens[key] for part in row['components']
                      if part['pathId'] == source['animatorPathId'])
    token_art[key] = [{'pathId': controller['pathId'], 'data': controller['data']}]
    all_bindings[key], all_models[key] = export_artwork(source['bundle'], controller, OUT / 'tokens' / key, key)
# Discovery may inspect all token groups; only referenced groups belong in evidence.
base_paths = [owner_path, art_path, skill_path, projectile_path, 'config/buff_template_holder.ab']
used_paths = base_paths + sorted(set(row['bundle'] for row in token_sources.values()))
bundle_sources = [next(r for r in inventory['bundles'] if r['path'] == path) for path in used_paths]
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
            'officialSkeletonBindings': all_bindings, 'models': all_models,
            'nativeTemplateGaps': sorted(needed - native.keys()), 'jsonTemplateGaps': sorted(needed - bt.keys()),
            'reviewStatus': 'Held original CN source; combat, model delivery, modules and game-frame proof remain separate'}
if tokens:
    evidence['tokens'] = {key: tokens[key] for key in sorted(tokens)}
    evidence['tokenSources'] = {key: token_sources[key] for key in sorted(tokens)}
    evidence['tokenArtworkControllers'] = token_art
    evidence['tables']['tokens'] = {key: ct[key] for key in sorted(tokens)}
    evidence['tables']['tokenSkills'] = {key: st[key] for key in sorted({row['skillId'] for t in tokens for row in ct[t]['skills'] if row['skillId'] is not None})}
    evidence['tokenSkillBindings'] = {key: token_skill_bindings[key] for key in sorted(tokens)}
    evidence['tokenSkillPrefabOverrides'] = {key: token_prefab_overrides[key] for key in sorted(tokens)}
    evidence['tokenModeSkills'] = {key: token_mode_skills[key] for key in sorted(tokens)}
if prefab_overrides:
    evidence['skillPrefabOverrides'] = prefab_overrides
destination = ROOT / 'data/arkpedia-native-operators' / (ID + '.json')
destination.parent.mkdir(parents=True, exist_ok=True)
temporary = destination.with_suffix('.json.tmp')
temporary.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n')
temporary.replace(destination)
print(json.dumps({'operator': ID, 'components': sum(len(r['components']) for group in [characters, skills, projectiles, tokens]
                                                   for rows in group.values() for r in rows),
                  'templates': sorted(needed), 'projectiles': sorted(projectiles), 'tokens': sorted(tokens), 'ranges': ranges,
                  'nativeTemplateGaps': evidence['nativeTemplateGaps'], 'jsonTemplateGaps': evidence['jsonTemplateGaps']}))
