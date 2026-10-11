#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Amiya Medic's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-amiya-medic.py.
An optional evidence-file argument supports checking modified audit records.
Requires the pinned bundles/tables used by the existing source extractors.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local-extract'))
import aklz4  # noqa: F401 -- game's LZ4 decoder
import UnityPy
ROOT = Path(__file__).resolve().parents[2]
E = json.loads((Path(sys.argv[1]) if len(sys.argv) > 1 else
    ROOT / 'data/arkpedia-amiya-medic-prefabs.json').read_text())
C = ROOT / '.cache/arkpedia'

def normalized(v, key=''):
    if isinstance(v, dict): return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, list): return [normalized(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

assert set(E['source']['tableHashes']) == {'character_table', 'char_patch_table',
    'skill_table', 'range_table', 'buff_template_data'}
assert E['source']['tableHashes'] == {
    'character_table': 'cf86d1690bdae2bf02378081ef8ae61731da042902bb284d339b7c0d889e66a9',
    'char_patch_table': '9604bc88f2593a4c9dd25d6f7524aeddfa352d11de990134c5fe0f12ede7ef46',
    'skill_table': '3f389ab49b038c3d701e059c2377a2b03e14276248c5ed42ebfc169578a4e809',
    'range_table': '676cedce20d46f37c46e1099b2f94907d0c84ac62b674957355c245ce16f0856',
    'buff_template_data': '79dce42d1ffa76196984b80678422e0323e406f6a044f1a25b1de75e0c5b9d27',
}, 'unexpected source table revision'
assert len(E['source']['bundles']) == 5
assert {r['path'] for r in E['source']['bundles']} == {
    'charpack/char_1037_amiya3.ab', 'chararts/char_1037_amiya3.ab',
    'battle/prefabs/[uc]skills.ab', 'battle/prefabs/[uc]projectiles.ab',
    'config/buff_template_holder.ab'}
bundles = {}
for record in E['source']['bundles']:
    path = record['path']
    local = C / ('amiya-medic-source/char_1037_amiya3-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_1037_amiya3.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_1037_amiya3.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
    for objects in E[group].values():
        for obj in objects:
            native = bundles[path][int(obj['pathId'])].read_typetree()
            assert native['m_Name'] == obj['object']
            for component in obj['components']:
                original = bundles[path][int(component['pathId'])].read_typetree()
                assert normalized(original) == component['data'], (path, component['pathId'])
                count += 1

for name, digest in E['source']['tableHashes'].items():
    assert hashlib.sha256((C/(name+'.json')).read_bytes()).hexdigest() == digest
ct = json.loads((C/'character_table.json').read_text()); st = json.loads((C/'skill_table.json').read_text())
patch_bytes = (C/'char_patch_table.json').read_bytes()
patch = json.loads(patch_bytes)
ct = {**ct, **patch['patchChars']}
p = E['source']['patchTable']
assert p == {'path': 'en_US/gamedata/excel/char_patch_table.json',
    'sha': 'fc84d705f44b9c2e430069c482fbf935a995952e', 'size': 47115}
assert p['size'] == len(patch_bytes)
assert p['sha'] == hashlib.sha1(f'blob {len(patch_bytes)}\0'.encode() + patch_bytes).hexdigest()
assert E['tables']['formInfo'] == patch['infos']['char_002_amiya']
assert E['tables']['unlockConds'] == patch['unlockConds']
assert E['tables']['patchDetailInfoList'] == patch['patchDetailInfoList']
assert E['tables']['character'] == ct['char_1037_amiya3']
for key, value in E['tables']['skills'].items(): assert value == st[key]
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_1037_amiya3'].items():
    path = 'chararts/char_1037_amiya3.ab'
    by = bundles[path]
    animator = by[int(record['animatorPathId'])].read_typetree()
    assert str(animator['_'+face.lower()]['skeleton']['m_PathID']) == record['skeletonAnimationPathId']
    skeleton = by[int(record['skeletonAnimationPathId'])].read_typetree()
    assert str(skeleton['skeletonDataAsset']['m_PathID']) == record['skeletonDataAssetPathId']
    asset = by[int(record['skeletonDataAssetPathId'])].read_typetree()
    assert str(asset['skeletonJSON']['m_PathID']) == record['textAssetPathId']
    raw = by[int(record['textAssetPathId'])].read().m_Script
    if isinstance(raw, str): raw = raw.encode('utf8', 'surrogateescape')
    assert hashlib.sha256(raw).hexdigest() == record['sha256']
    assert len(raw) == record['byteLength']
    model = E['models']['char_1037_amiya3'][face]
    imported = subprocess.check_output(['git', '-C', str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'), 'show', E['source']['modelCommit']+':'+model['path']])
    assert imported == raw, face
rt = json.loads((C/'range_table.json').read_text())
for key, value in E['tables']['ranges'].items(): assert value == rt[key]
holder = next(o for o in bundles['config/buff_template_holder.ab'].values()
    if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree()).read_typetree()['_templates']
native_templates = {t['templateKey']: t for t in holder}
for key, value in E['originalTemplates'].items(): assert value == next(t for t in holder if t['templateKey'] == key)
assert E['nativeTemplateGaps'] == sorted(set(E['templates']) - {t['templateKey'] for t in holder})
assert set(E['originalTemplates']) == set(E['templates']) - set(E['nativeTemplateGaps'])
dbpath = C/'lessing-source/buff_table.json'
assert hashlib.sha256(dbpath.read_bytes()).hexdigest() == E['source']['buffDatabase']['sha256']
db = json.loads(dbpath.read_text())
for key, value in E['buffDatabase'].items(): assert value == db[key]
for row in E['chararts']['char_1037_amiya3']:
    assert normalized(bundles['chararts/char_1037_amiya3.ab'][int(row['pathId'])].read_typetree()) == row['data']

from collections import deque
queue = deque([E['characters'], E['skills'], ct['char_1037_amiya3'],
    [st[key] for key in E['tables']['skills']]])
reachable, dbkeys, projectile_keys, range_keys = set(), set(), set(), set()
while queue:
    value = queue.popleft()
    if isinstance(value, dict):
        queue.extend(v for k, v in value.items()
            if not (k == 'key' and 'value' in value) and k != '_healScaleKey')
    elif isinstance(value, list): queue.extend(value)
    elif isinstance(value, str):
        if value in bt and value not in reachable:
            reachable.add(value); queue.append(bt[value])
            if value in native_templates: queue.append(native_templates[value])
        if value in db and value not in dbkeys:
            dbkeys.add(value); queue.append(db[value])
        if value.startswith('projectile_') and value not in projectile_keys:
            projectile_keys.add(value)
            assert value in E['projectiles'], ('missing projectile dependency', value)
            queue.append(E['projectiles'][value])
        if value in rt: range_keys.add(value)
        if value.startswith(('[', '{')):
            try: queue.append(json.loads(value))
            except json.JSONDecodeError: pass
assert reachable == set(E['templates'])
assert dbkeys == set(E['buffDatabase'])
assert projectile_keys == set(E['projectiles'])
assert range_keys == set(E['tables']['ranges'])
# Require whole original object/component membership, not a selected subset of
# individually valid components. Derive hierarchy independently from native
# Transform parent pointers and GameObject component lists.
for group, path in [('characters','charpack/char_1037_amiya3.ab'), ('skills','battle/prefabs/[uc]skills.ab'),
                    ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
    by = bundles[path]
    gos = {i: o.read_typetree() for i, o in by.items() if o.type.name == 'GameObject'}
    transforms = {i: o.read_typetree() for i, o in by.items() if o.type.name == 'Transform'}
    owners = {i: t['m_GameObject']['m_PathID'] for i, t in transforms.items()}
    supported = {'Transform','MonoBehaviour','CircleCollider2D','BoxCollider2D','SphereCollider','BoxCollider'}
    for name, rows in E[group].items():
        included = set(gos) if group == 'characters' else set()
        if group != 'characters':
            todo = [i for i, go in owners.items() if gos[go]['m_Name'] == name]
            assert len(todo) == 1, name
            while todo:
                t = todo.pop(); included.add(owners[t])
                todo.extend(i for i,v in transforms.items() if v['m_Father']['m_PathID'] == t)
        expected = {}
        for go in included:
            ids = {str(c['component']['m_PathID']) for c in gos[go]['m_Component']
                   if by[c['component']['m_PathID']].type.name in supported}
            if ids: expected[str(go)] = ids
        actual = {r['pathId']: {c['pathId'] for c in r['components']} for r in rows}
        assert len(actual) == len(rows), (group, name, 'duplicate object')
        assert all(len(r['components']) == len(actual[r['pathId']]) for r in rows), (group, name, 'duplicate component')
        assert actual == expected, (group, name, 'incomplete component membership')
hot = json.loads((C/'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == E['source']['nativeClient'] == '26-09-23-17-49-43_b9cc4a'
for record in E['source']['bundles']:
    native = next(row for row in hot['abInfos'] if row['name'] == record['path'])
    assert (record['md5'], record['size']) == (native['md5'], native['abSize'])
# Require the complete native animator/facing-controller set, not just valid retained rows.
art_by = bundles['chararts/char_1037_amiya3.ab']
expected_art = {str(i) for i,o in art_by.items() if o.type.name=='MonoBehaviour'
    and any(k in o.read_typetree() for k in ['_animations','_spine','_dataAsset'])}
expected_art |= {str(art_by[int(i)].read_typetree()['_faceSwitcher']['m_PathID'])
    for i in list(expected_art) if '_faceSwitcher' in art_by[int(i)].read_typetree()}
assert expected_art == {r['pathId'] for r in E['chararts']['char_1037_amiya3']}
assert len(expected_art) == len(E['chararts']['char_1037_amiya3'])
for face, record in E['officialSkeletonBindings']['char_1037_amiya3'].items():
    animator = art_by[int(record['animatorPathId'])].read_typetree()
    assert str(animator['_faceSwitcher']['m_PathID']) == record['faceSwitcherPathId']
    assert record['faceSwitcherPathId'] in expected_art
assert count == 102
assert len(E['templates']) == 9 and len(E['projectiles']) == 2
assert E['source']['commit'] == '57010cb5b2afea112cae57daa756b58676ba6850'
assert E['source']['modelCommit'] == 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
assert E['enabledOperators'] == ['char_1037_amiya3'] and E['heldOperators'] == []
assert E['reviewStatus'] == 'Complete Global Medic-form source and bounded two-skill combat adapter'
assert len(E['recoveredFacts']) == 9 and len(E['verificationLimits']) == 3 and E['holdReasons'] == [] and len(E['runtimeContracts']) == 7
assert E['frameParity'] is False and E['moduleSupport'] is False and E['nativeParticleSupport'] is False
assert set(E['tables']['skills']) == set(E['skills']) == {'skchr_amiya3_1','skchr_amiya3_2'}
assert all(len(s['levels']) == 10 for s in E['tables']['skills'].values())
assert set(E['models']['char_1037_amiya3']) == {'commit','Front','Back'}
assert set(E['officialSkeletonBindings']['char_1037_amiya3']) == {'Front','Back'}
# Reparse original skeleton bytes independently, including every retained event.
subprocess.check_call(['node', 'tools/arkpedia/inspect-amiya-medic.mjs'],
    cwd=ROOT, stdout=subprocess.DEVNULL)
assert json.loads((C/'amiya-medic-source/models.json').read_text()) == E['models']
print(f'Verified {count} native components, {len(bundles)} bundles, {len(E["templates"])} templates, 20 ranks, both original facing skeleton chains and pinned Global form unlock data; bounded combat contracts remain explicit')
