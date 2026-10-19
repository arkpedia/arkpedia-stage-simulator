#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare selected CN source receipts with original container roots.

Does not import the extractor or accept an extracted component list as proof of
completeness. Every original GameObject/component and dependency is walked again.
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
parser.add_argument('--evidence', type=Path)
args = parser.parse_args()
ID = args.operator
assert re.fullmatch(r'char_\d+_[a-z0-9]+', ID)
C = ROOT / '.cache/arkpedia'
OUT = C / 'cn-operators' / ID
NODE = os.environ.get('ARKPEDIA_SOURCE_NODE', 'node')
PIN = 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add'
e = json.loads((args.evidence or ROOT / 'data/arkpedia-native-operators' / (ID + '.json')).read_bytes())
assert e['schemaVersion'] == 2 and e['operatorId'] == ID
assert e['enabledOperators'] == [] and e['heldOperators'] == [ID]
for key in ['frameParity', 'moduleSupport', 'nativeParticleSupport']:
    assert e[key] is False
subprocess.run([NODE, 'tools/arkpedia/verify-cn-native.mjs'], cwd=ROOT, check=True, capture_output=True)
inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_raw)
assert ID in inventory['operators']
sha = lambda raw: hashlib.sha256(raw).hexdigest()
assert e['source']['repository'] == 'Kengxxiao/ArknightsGameData' and e['source']['commit'] == PIN
assert e['source']['nativeClient'] == '26-09-22-07-47-20_6c71fa'
assert e['source']['nativeInventorySha256'] == sha(inventory_raw)
# Frozen original Git blob identities, independent of the extractor's table map.
PINS = {
    'character_table.json': ('zh_CN/gamedata/excel/character_table.json', 14975251, '789dfbf21512118b357129b5f01fd2a40b29e05d'),
    'char_patch_table.json': ('zh_CN/gamedata/excel/char_patch_table.json', 48761, '5e371cce6cebd5ccdf0196584233bc386361eb8c'),
    'skill_table.json': ('zh_CN/gamedata/excel/skill_table.json', 11447929, '3793979c8672129489135e97727bfd9f9fd32873'),
    'range_table.json': ('zh_CN/gamedata/excel/range_table.json', 53368, '8ade26d87026ee7649ff8a2d1636e7c3426959c8'),
    'buff_template_data.json': ('zh_CN/gamedata/battle/buff_template_data.json', 27996217, 'a94bbb391fded80e59db38ad7c3ded89e25fd682'),
    'buff_table.json': ('zh_CN/gamedata/buff_table.json', 176162, 'b588d86b514d61c0025c0d9534f2a4e548aae302'),
}
assert set(e['source']['tableGitBlobs']) == set(PINS)
tables = {}
for name, (path, size, blob) in PINS.items():
    raw = (C / ('cn-coverage/' if '/excel/' in path else 'cn-native-source/tables/') / name).read_bytes()
    assert len(raw) == size and hashlib.sha1(b'blob ' + str(size).encode() + b'\0' + raw).hexdigest() == blob
    expected = {'path': path, 'bytes': size, 'gitBlob': blob, 'sha256': sha(raw)}
    assert e['source']['tableGitBlobs'][name] == expected
    tables[name] = json.loads(raw)
ct, st, rt, bt, db = [tables[k + '.json'] for k in
                     ['character_table', 'skill_table', 'range_table', 'buff_template_data', 'buff_table']]
assert e['tables']['character'] == ct[ID]
skill_ids = [s['skillId'] for s in ct[ID]['skills']]
assert e['tables']['skills'] == {s: st[s] for s in skill_ids}
bindings = {s: list(dict.fromkeys(rank['prefabId'] for rank in st[s]['levels'])) for s in skill_ids}
assert e['skillBindings'] == bindings
overrides = {row['skillId']: row['overridePrefabKey'] for row in ct[ID]['skills'] if row['overridePrefabKey'] is not None}
assert all(isinstance(value, str) and value for value in overrides.values())
assert e.get('skillPrefabOverrides', {}) == overrides
effective = {skill: [overrides[skill]] if skill in overrides else prefabs for skill, prefabs in bindings.items()}
assert e['ownerModeSkills'] == [s for s, prefabs in effective.items() if None in prefabs]
owner_path, art_path = f'charpack/{ID}.ab', f'chararts/{ID}.ab'
skill_path, projectile_path, holder_path = 'battle/prefabs/[uc]skills.ab', 'battle/prefabs/[uc]projectiles.ab', 'config/buff_template_holder.ab'
paths = [owner_path, art_path, skill_path, projectile_path, holder_path]
objects, containers = {}, {}
def load_original(path):
    if path in objects:
        return
    row = next(r for r in inventory['bundles'] if r['path'] == path)
    raw = (C / 'cn-native-source/bundles' / row['path']).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.md5(raw).hexdigest() == row['md5'] and sha(raw) == row['sha256']
    env = UnityPy.load(raw)
    by = objects[row['path']] = {o.path_id: o for o in env.objects}
    roots = containers[row['path']] = {}
    for reader in by.values():
        if reader.type.name == 'AssetBundle':
            for name, fields in reader.read_typetree()['m_Container']:
                p = fields['asset']
                if p['m_FileID'] == 0:
                    assert name not in roots
                    roots[name] = p['m_PathID']
for path in paths:
    load_original(path)

def norm(v, key=''):
    if isinstance(v, dict):
        return {k: norm(x, k) for k, x in v.items()}
    if isinstance(v, (tuple, list)):
        return [norm(x, key) for x in v]
    if key == 'm_PathID':
        return str(v)
    if isinstance(v, float) and not math.isfinite(v):
        return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

count = 0
def original_graph(path, container):
    global count
    by = objects[path]
    pending = [containers[path][container]]
    visited, rows = set(), []
    while pending:
        pid = pending.pop()
        assert pid not in visited
        visited.add(pid)
        reader = by[pid]
        assert reader.type.name == 'GameObject'
        go = reader.read_typetree()
        parts = []
        for entry in go['m_Component']:
            pointer = entry['component']
            assert pointer['m_FileID'] == 0
            component = by[pointer['m_PathID']]; data = component.read_typetree()
            parts.append({'pathId': str(component.path_id), 'type': component.type.name, 'data': norm(data)})
            if component.type.name == 'Transform':
                for child in data['m_Children']:
                    assert child['m_FileID'] == 0
                    pending.append(by[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID'])
        count += len(parts)
        rows.append({'object': go['m_Name'], 'pathId': str(pid), 'gameObjectData': norm(go), 'components': parts})
    return sorted(rows, key=lambda r: int(r['pathId']))
original_owner = {ID: original_graph(owner_path, f'dyn/battle/prefabs/characters/{ID}.prefab')}
original_art = {ID: original_graph(art_path, f'dyn/battle/prefabs/skins/character/{ID}/defaultskin.prefab')}
original_skills = {prefab: original_graph(skill_path, f'dyn/battle/prefabs/[uc]skills/{prefab}.prefab')
                   for prefab in dict.fromkeys(p for prefabs in effective.values() for p in prefabs if p is not None)}
assert e['characters'] == original_owner and e['artworkHierarchy'] == original_art
art_parts = [{'pathId': p['pathId'], 'data': p['data']} for row in original_art[ID] for p in row['components']
             if '_animations' in p['data']]
assert len(art_parts) == 1 and e['chararts'] == {ID: art_parts}
holder = [r.read_typetree()['_templates'] for r in objects[holder_path].values()
          if r.type.name == 'MonoBehaviour' and '_templates' in r.read_typetree()]
assert len(holder) == 1
native = {r['templateKey']: r for r in holder[0]}
# Iterative dependency closure from originals, never from the claimed closure.
queue = [original_owner, original_skills, ct[ID], [st[s] for s in skill_ids]]
needed, db_keys, projectile_graphs, strings, token_graphs, token_sources = set(), set(), {}, set(), {}, {}
token_roots = None
token_bindings, token_overrides, token_modes = {}, {}, {}
def original_token(key):
    global token_roots
    if token_roots is None:
        token_roots = {}
        for entry in inventory['bundles']:
            path = entry['path']
            if re.fullmatch(r'pkgrps/btl_pfb_tokens_\d+\.ab', path):
                load_original(path)
                for container, root in containers[path].items():
                    if re.fullmatch(r'dyn/battle/prefabs/\[uc\]tokens/token_[a-z0-9_]+\.prefab', container):
                        assert container not in token_roots
                        token_roots[container] = (path, root)
    container = f'dyn/battle/prefabs/[uc]tokens/{key}.prefab'
    path, root = token_roots[container]
    rows = original_graph(path, container)
    owners = [part for row in rows if row['pathId'] == str(root) for part in row['components']
              if '_animator' in part['data']]
    assert len(owners) == 1
    pointer = owners[0]['data']['_animator']
    assert pointer['m_FileID'] == 0 and pointer['m_PathID'] != '0'
    matches = [part for row in rows for part in row['components']
               if part['pathId'] == pointer['m_PathID'] and '_animations' in part['data']]
    assert len(matches) == 1
    named_slots = []
    for slot in ct[key]['skills']:
        if slot['skillId'] is None:
            assert slot['overridePrefabKey'] is None and slot['overrideTokenKey'] is None, 'Unresolved null token skill override'
        else:
            named_slots.append(slot)
    bindings = {r['skillId']: list(dict.fromkeys(level['prefabId'] for level in st[r['skillId']]['levels'])) for r in named_slots}
    overrides = {r['skillId']: r['overridePrefabKey'] for r in named_slots if r['overridePrefabKey'] is not None}
    assert all(isinstance(v, str) and v for v in overrides.values())
    modes = []
    for skill, prefabs in bindings.items():
        for prefab in [overrides[skill]] if skill in overrides else prefabs:
            if prefab is None:
                modes.append(skill)
            elif prefab not in original_skills:
                original_skills[prefab] = original_graph(skill_path, f'dyn/battle/prefabs/[uc]skills/{prefab}.prefab')
    token_bindings[key], token_overrides[key], token_modes[key] = bindings, overrides, modes
    token_sources[key] = {'bundle': path, 'container': container, 'rootPathId': str(root),
                          'animatorPathId': pointer['m_PathID']}
    return rows
parameters = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey',
              '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey',
              '_projectileIndexKey', '_multiplyParamKey', '_atkScaleKey'}
stack = [(item, '') for item in queue]
while stack:
    value, field = stack.pop()
    if field in ['_overrideAudioSignal', 'audioSignal', '_audioSignal']:
        continue
    if isinstance(value, dict):
        stack.extend((k, '') for k in value if k.startswith('token_') and k in ct)
        # Reconstruct native formula bindings independently of claimed assets.
        formula = all(k in value for k in ('_formulaType', '_source', '_target', '_type', '_sourceKey', '_targetKey'))
        stack.extend((v, 'key' if formula and k in ('_sourceKey', '_sourceKey2', '_targetKey') else k)
                     for k, v in value.items())
    elif isinstance(value, (list, tuple)):
        stack.extend((v, field) for v in value)
    elif isinstance(value, str):
        strings.add(value)
        if value in ct and value.startswith('token_') and field not in parameters and value not in token_graphs:
            token_graphs[value] = original_token(value)
            stack.extend([(token_graphs[value], ''), (ct[value], ''),
                          ([st[row['skillId']] for row in ct[value]['skills'] if row['skillId'] is not None], ''), (original_skills, '')])
        if value.startswith('projectile_') and field not in parameters and value not in projectile_graphs:
            g = original_graph(projectile_path, f'dyn/battle/prefabs/[uc]projectiles/{value}.prefab')
            projectile_graphs[value] = g; stack.append((g, ''))
        if value in bt or value in native:
            if value not in needed:
                needed.add(value); stack.extend([(bt.get(value), ''), (native.get(value), '')])
        if value in db and value not in db_keys:
            db_keys.add(value); stack.append((db[value], ''))
        if value.startswith(('[', '{')):
            try:
                decoded = json.loads(value)
            except json.JSONDecodeError:
                continue
            stack.append((decoded, ''))
assert e['skills'] == original_skills
assert e.get('tokens', {}) == token_graphs
assert e.get('tokenSkillBindings', {}) == token_bindings
assert e.get('tokenSkillPrefabOverrides', {}) == token_overrides
assert e.get('tokenModeSkills', {}) == token_modes
assert e['tables'].get('tokenSkills', {}) == {s: st[s] for key in token_graphs for s in token_bindings[key]}
assert e.get('tokenSources', {}) == token_sources
assert e['tables'].get('tokens', {}) == {key: ct[key] for key in token_graphs}
expected_paths = paths + sorted(set(row['bundle'] for row in token_sources.values()))
assert e['source']['bundles'] == [next(r for r in inventory['bundles'] if r['path'] == path) for path in expected_paths]
assert e['projectiles'] == projectile_graphs
assert e['templates'] == {k: bt[k] for k in needed if k in bt}
assert e['originalTemplates'] == norm({k: native[k] for k in needed if k in native})
assert e['buffDatabase'] == {k: db[k] for k in db_keys}
assert e['nativeTemplateGaps'] == sorted(needed - native.keys())
assert e['jsonTemplateGaps'] == sorted(needed - bt.keys())
assert e['tables']['ranges'] == {k: rt[k] for k in strings & rt.keys()}

def verify_artwork(key, path, animator, directory):
    art = objects[path]
    d = animator['data']
    facings = {f.title(): d['_' + f]['skeleton'] for f in ['front', 'back', 'down']
               if '_' + f in d and d['_' + f]['skeleton']['m_PathID'] != '0'}
    if '_skeleton' in d:
        assert not facings
        facings = {'Single': d['_skeleton']}
    assert set(e['officialSkeletonBindings'][key]) == set(facings)
    assert set(e['models'][key]) == set(facings)
    def ref(pointer):
        assert pointer['m_FileID'] == 0 and int(pointer['m_PathID']) != 0
        return art[int(pointer['m_PathID'])]
    for face, pointer in facings.items():
        skeleton = ref(pointer); asset = ref(skeleton.read_typetree()['skeletonDataAsset']); data = asset.read_typetree()
        text = ref(data['skeletonJSON']); assert len(data['atlasAssets']) == 1
        atlas = ref(data['atlasAssets'][0]); atlas_text = ref(atlas.read_typetree()['atlasFile'])
        def raw(reader):
            v = reader.read().m_Script
            return v.encode('utf8', 'surrogateescape') if isinstance(v, str) else bytes(v)
        skel_bytes, atlas_bytes = raw(text), raw(atlas_text)
        assert e['officialSkeletonBindings'][key][face] == {
            'animatorPathId': animator['pathId'], 'skeletonAnimationPathId': str(skeleton.path_id),
            'skeletonDataAssetPathId': str(asset.path_id), 'textAssetPathId': str(text.path_id),
            'atlasAssetPathId': str(atlas.path_id), 'atlasTextAssetPathId': str(atlas_text.path_id),
            'sha256': sha(skel_bytes), 'bytes': len(skel_bytes), 'atlasSha256': sha(atlas_bytes), 'atlasBytes': len(atlas_bytes)}
        assert (directory / (face.lower() + '.skel')).read_bytes() == skel_bytes
        assert (directory / (face.lower() + '.atlas')).read_bytes() == atlas_bytes
    script = """
    import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
    import {parseSkel} from './tools/assets/skel.mjs';import {atlasInfo} from './tools/assets/atlas.mjs';
    const root=process.argv[1],faces=JSON.parse(process.argv[2]),result={};
    for(const face of faces){const base=root+'/'+face.toLowerCase(),bytes=readFileSync(base+'.skel'),atlas=readFileSync(base+'.atlas','utf8');
     const p=parseSkel(bytes,atlasInfo(atlas).regions,{includeEventPayloads:true});if(p.missingRegions.length)throw Error('Missing native region');
     result[face]={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,spineVersion:p.version,
     durations:p.durations,hits:p.hits,eventPayloads:p.eventPayloads,bounds:p.bounds};}
    console.log(JSON.stringify(result));
    """
    models = json.loads(subprocess.check_output([NODE, '--input-type=module', '-e', script, str(directory), json.dumps(list(facings))], cwd=ROOT))
    assert e['models'][key] == models
    return len(facings)

assert set(e['officialSkeletonBindings']) == set(e['models']) == {ID, *token_graphs}
facings_count = verify_artwork(ID, art_path, art_parts[0], OUT)
token_art = {}
for key, rows in token_graphs.items():
    source = token_sources[key]
    controller = next(part for row in rows for part in row['components'] if part['pathId'] == source['animatorPathId'])
    token_art[key] = [{'pathId': controller['pathId'], 'data': controller['data']}]
    facings_count += verify_artwork(key, source['bundle'], controller, OUT / 'tokens' / key)
assert e.get('tokenArtworkControllers', {}) == token_art
print(f'Verified complete original {ID} owner/art/skill/projectile hierarchies ({count} components), '
      f'{len(needed)} transitive templates, {len(token_graphs)} token graphs and {facings_count} native facings; no public kit approval')
