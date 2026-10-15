#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently walk Akkord's original container roots and all declared native inputs."""
from pathlib import Path
import hashlib
import json
import math
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
C = ROOT / '.cache/arkpedia'
ID = 'char_4051_akkord'
SKILLS = ['skchr_akkord_1', 'skchr_akkord_2']
NODE = os.environ.get('ARKPEDIA_SOURCE_NODE', 'node')
e = json.loads((Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data/arkpedia-akkord-prefabs.json').read_bytes())
subprocess.run([NODE, 'tools/arkpedia/verify-cn-native.mjs'], cwd=ROOT, check=True, capture_output=True)
inventory_bytes = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_bytes)
sha = lambda b: hashlib.sha256(b).hexdigest()
assert e['schemaVersion'] == 1 and e['enabledOperators'] == [] and e['heldOperators'] == [ID]
for key in ['frameParity', 'moduleSupport', 'nativeParticleSupport']:
    assert e[key] is False, key
assert e['source']['commit'] == 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add'
assert e['source']['repository'] == 'Kengxxiao/ArknightsGameData'
assert e['source']['nativeClient'] == '26-09-22-07-47-20_6c71fa'
assert e['source']['nativeInventorySha256'] == sha(inventory_bytes)
tree = json.loads((C / 'cn-coverage/table-tree.json').read_bytes())
assert tree['sha'] == 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add' and tree['truncated'] is False
tree = {r['path']: r for r in tree['tree']}
for path, blob, size in [
    ('zh_CN/gamedata/battle/buff_template_data.json', 'a94bbb391fded80e59db38ad7c3ded89e25fd682', 27996217),
    ('zh_CN/gamedata/buff_table.json', 'b588d86b514d61c0025c0d9534f2a4e548aae302', 176162)]:
    assert tree[path]['sha'] == blob and tree[path]['size'] == size
expected_paths = {'zh_CN/gamedata/excel/' + s + '.json' for s in
                  ['character_table', 'char_patch_table', 'skill_table', 'range_table']}
expected_paths |= {'zh_CN/gamedata/battle/buff_template_data.json', 'zh_CN/gamedata/buff_table.json'}
assert {r['path'] for r in e['source']['tableGitBlobs'].values()} == expected_paths
assert len(e['source']['tableGitBlobs']) == 6
tables = {}
for name, row in e['source']['tableGitBlobs'].items():
    original = tree[row['path']]
    raw = (C / ('cn-coverage/' if '/excel/' in row['path'] else 'cn-native-source/tables/') / name).read_bytes()
    assert len(raw) == original['size'] == row['bytes']
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == original['sha'] == row['gitBlob']
    assert sha(raw) == row['sha256']
    tables[name] = json.loads(raw)
assert e['tables']['character'] == tables['character_table.json'][ID]
assert e['tables']['skills'] == {s: tables['skill_table.json'][s] for s in SKILLS}

paths = ['charpack/' + ID + '.ab', 'chararts/' + ID + '.ab', 'battle/prefabs/[uc]skills.ab',
         'battle/prefabs/[uc]projectiles.ab', 'config/buff_template_holder.ab']
assert e['source']['bundles'] == [next(r for r in inventory['bundles'] if r['path'] == path) for path in paths]
bundles, roots = {}, {}
for row in e['source']['bundles']:
    raw = (C / 'cn-native-source/bundles' / row['path']).read_bytes()
    assert len(raw) == row['bytes'] and sha(raw) == row['sha256']
    env = UnityPy.load(raw)
    bundles[row['path']] = {r.path_id: r for r in env.objects}
    roots[row['path']] = {}
    for reader in env.objects:
        if reader.type.name == 'AssetBundle':
            for name, value in reader.read_typetree()['m_Container']:
                p = value['asset']
                if p['m_FileID'] == 0:
                    roots[row['path']][name] = p['m_PathID']

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
for group, names, path, folder in [
    ('characters', [ID], paths[0], 'characters/'),
    ('skills', SKILLS, paths[2], '[uc]skills/')]:
    assert set(e[group]) == set(names)
    by = bundles[path]
    for name in names:
        root = roots[path]['dyn/battle/prefabs/' + folder + name + '.prefab']
        visited, components = set(), {}
        def visit(go_id):
            assert go_id not in visited, ('hierarchy cycle', go_id)
            visited.add(go_id)
            go = by[go_id].read_typetree()
            selected = []
            for entry in go['m_Component']:
                p = entry['component']
                assert p['m_FileID'] == 0
                reader = by[p['m_PathID']]
                d = reader.read_typetree()
                # Original visual/physics components remain referenced in the
                # GameObject metadata but are not combat behavior extraction.
                if reader.type.name in ['SpriteRenderer', 'Rigidbody2D']:
                    continue
                assert reader.type.name in ['Transform', 'MonoBehaviour', 'CircleCollider2D', 'BoxCollider2D', 'SphereCollider', 'BoxCollider']
                selected.append({'pathId': str(reader.path_id), 'data': norm(d)})
                if reader.type.name == 'Transform':
                    for child in d['m_Children']:
                        assert child['m_FileID'] == 0
                        visit(by[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID'])
            components[go_id] = selected
        visit(root)
        declared = e[group][name]
        assert len(declared) == len(visited) and {int(r['pathId']) for r in declared} == visited
        for row in declared:
            pid = int(row['pathId']); go = by[pid].read_typetree()
            assert row['object'] == go['m_Name'] and row['gameObjectData'] == norm(go)
            assert len(row['components']) == len(components[pid])
            assert {r['pathId']: r['data'] for r in row['components']} == {r['pathId']: r['data'] for r in components[pid]}
            count += len(row['components'])
assert count == 53
art = bundles[paths[1]]
animators = [{'pathId': str(r.path_id), 'data': norm(r.read_typetree())} for r in art.values()
             if r.type.name == 'MonoBehaviour' and '_animations' in r.read_typetree()]
assert e['chararts'] == {ID: animators} and len(animators) == 1

def strings(v):
    if isinstance(v, dict):
        for x in v.values():
            yield from strings(x)
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)
    elif isinstance(v, str):
        yield v
        if v.startswith(('[', '{')):
            try:
                decoded = json.loads(v)
            except json.JSONDecodeError:
                return
            yield from strings(decoded)

holder = [r.read_typetree()['_templates'] for r in bundles[paths[4]].values()
          if r.type.name == 'MonoBehaviour' and '_templates' in r.read_typetree()]
assert len(holder) == 1
native = {r['templateKey']: r for r in holder[0]}
bt, db = tables['buff_template_data.json'], tables['buff_table.json']
inputs = [e['characters'], e['skills'], e['tables']['character'], e['tables']['skills']]
needed, db_keys, all_strings = set(), set(), set()
while True:
    values = set(strings(inputs)); all_strings |= values
    new = (values & (bt.keys() | native.keys())) - needed
    new_db = (values & db.keys()) - db_keys
    if not new and not new_db:
        break
    needed |= new; db_keys |= new_db
    inputs = [bt.get(k) for k in new] + [native.get(k) for k in new] + [db[k] for k in new_db]
assert needed == {'akkord_s_2[aoe]', 'akkord_s_2[aoe_damage]', 'akkord_t_1', 'empty', 'switch_mode_restart_fsm'}
assert e['templates'] == {k: bt[k] for k in needed}
assert e['originalTemplates'] == norm({k: native[k] for k in needed})
assert e['buffDatabase'] == {k: db[k] for k in db_keys}
assert e['projectiles'] == {} and e['nativeTemplateGaps'] == [] and e['jsonTemplateGaps'] == []
assert not any(s.startswith('projectile_') for s in all_strings)
assert e['tables']['ranges'] == {k: tables['range_table.json'][k] for k in all_strings & tables['range_table.json'].keys()}

def ref(p):
    assert p['m_FileID'] == 0
    return art[p['m_PathID']]
assert set(e['officialSkeletonBindings']) == {ID} and set(e['officialSkeletonBindings'][ID]) == {'Front', 'Back'}
assert set(e['models']) == {ID} and set(e['models'][ID]) == {'Front', 'Back'}
for face in ['Front', 'Back']:
    animator = art[int(animators[0]['pathId'])].read_typetree()
    skeleton = ref(animator['_' + face.lower()]['skeleton'])
    asset = ref(skeleton.read_typetree()['skeletonDataAsset'])
    data = asset.read_typetree()
    text = ref(data['skeletonJSON'])
    assert len(data['atlasAssets']) == 1
    atlas = ref(data['atlasAssets'][0]); atlas_text = ref(atlas.read_typetree()['atlasFile'])
    def raw(reader):
        value = reader.read().m_Script
        return value.encode('utf8', 'surrogateescape') if isinstance(value, str) else bytes(value)
    skel_bytes, atlas_bytes = raw(text), raw(atlas_text)
    assert e['officialSkeletonBindings'][ID][face] == {
        'animatorPathId': animators[0]['pathId'], 'skeletonAnimationPathId': str(skeleton.path_id),
        'skeletonDataAssetPathId': str(asset.path_id), 'textAssetPathId': str(text.path_id),
        'atlasAssetPathId': str(atlas.path_id), 'atlasTextAssetPathId': str(atlas_text.path_id),
        'sha256': sha(skel_bytes), 'bytes': len(skel_bytes), 'atlasSha256': sha(atlas_bytes), 'atlasBytes': len(atlas_bytes)}
    for extension, blob in [('skel', skel_bytes), ('atlas', atlas_bytes)]:
        assert (C / 'akkord-source' / (face.lower() + '.' + extension)).read_bytes() == blob
# Parse the original bytes independently of the receipt generator/inspector.
script = """
import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto';
import {parseSkel} from './tools/assets/skel.mjs'; import {atlasInfo} from './tools/assets/atlas.mjs';
const result={}; for (const face of ['Front','Back']) {
 const path='.cache/arkpedia/akkord-source/'+face.toLowerCase();
 const bytes=readFileSync(path+'.skel'), atlas=readFileSync(path+'.atlas','utf8');
 const p=parseSkel(bytes,atlasInfo(atlas).regions,{includeEventPayloads:true});
 if(p.missingRegions.length)throw Error('Missing region');
 result[face]={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,durations:p.durations,hits:p.hits,eventPayloads:p.eventPayloads};
} console.log(JSON.stringify(result));
"""
models = json.loads(subprocess.check_output([NODE, '--input-type=module', '-e', script], cwd=ROOT))
assert e['models'][ID] == models
print('Verified 53 original CN components, all 20 skill ranks, five transitive templates and both native event tracks; public approval remains separate')
