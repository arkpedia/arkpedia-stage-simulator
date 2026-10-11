#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Wisadel's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-wisadel.py.
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
    ROOT / 'data/arkpedia-wisadel-prefabs.json').read_text())
C = ROOT / '.cache/arkpedia'

# Blob identities independently read from the pinned Global Git tree.
TABLE_GIT_BLOBS = {'buff_template_data': {'path': 'en_US/gamedata/battle/buff_template_data.json', 'sha': 'cb995e7a8d7b5569032bca40f8842ac4df4a56bf', 'size': 15472433}, 'character_table': {'path': 'en_US/gamedata/excel/character_table.json', 'sha': '5d20e09f1f8d630528b8c25bf0c09f811fdbf2da', 'size': 11459107}, 'range_table': {'path': 'en_US/gamedata/excel/range_table.json', 'sha': 'c1e28a9f2c7350bb5f5de13ba27950dca49f0de7', 'size': 42868}, 'skill_table': {'path': 'en_US/gamedata/excel/skill_table.json', 'sha': '11a76a9f2adf5859609e4f423229ff007af30e17', 'size': 9406193}}
for name, record in TABLE_GIT_BLOBS.items():
    raw = (C / (name + ".json")).read_bytes()
    assert len(raw) == record["size"], name
    assert hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() == record["sha"], name
assert E["source"]["tableGitBlobs"] == TABLE_GIT_BLOBS
assert E["source"]["commit"] == "57010cb5b2afea112cae57daa756b58676ba6850"
assert E['source']['modelCommit'] == 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
assert set(E['source']['tableHashes']) == set(TABLE_GIT_BLOBS)
assert {r['path'] for r in E['source']['bundles']} == {'charpack/char_1035_wisdel.ab','chararts/char_1035_wisdel.ab','pkgrps/btl_pfb_tokens_0.ab','battle/prefabs/[uc]skills.ab','battle/prefabs/[uc]projectiles.ab','config/buff_template_holder.ab'}
assert len(E['source']['bundles']) == 6
assert set(E['characters']) == {'char_1035_wisdel'}
assert set(E['tokens']) == {'token_10035_wisdel_wward'}
assert set(E['chararts']) == {'char_1035_wisdel'}
assert set(E['officialSkeletonBindings']) == {'char_1035_wisdel'}
assert set(E['officialSkeletonBindings']['char_1035_wisdel']) == {'Front', 'Back'}

def normalized(v, key=''):
    if isinstance(v, dict): return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, list): return [normalized(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

bundles = {}
for record in E['source']['bundles']:
    path = record['path']
    local = C / ('wisadel-source/char_1035_wisdel-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_1035_wisdel.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_1035_wisdel.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
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
assert E['tables']['character'] == ct['char_1035_wisdel']
assert E['tables']['token'] == ct['token_10035_wisdel_wward']
for key, value in {**E['tables']['skills'], **E['tables']['tokenSkills']}.items(): assert value == st[key]
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_1035_wisdel'].items():
    path = 'chararts/char_1035_wisdel.ab'
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
    model = E['models']['char_1035_wisdel'][face]
    imported = subprocess.check_output(['git', '-C', str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'), 'show', E['source']['modelCommit']+':'+model['path']])
    assert imported == raw, face
rt = json.loads((C/'range_table.json').read_text())
for key, value in E['tables']['ranges'].items(): assert value == rt[key]
holder = next(o for o in bundles['config/buff_template_holder.ab'].values()
    if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree()).read_typetree()['_templates']
for key, value in E['originalTemplates'].items(): assert value == next(t for t in holder if t['templateKey'] == key)
assert E['nativeTemplateGaps'] == sorted(set(E['templates']) - {t['templateKey'] for t in holder})
assert set(E['originalTemplates']) == set(E['templates']) - set(E['nativeTemplateGaps'])
dbpath = C/'lessing-source/buff_table.json'
assert hashlib.sha256(dbpath.read_bytes()).hexdigest() == E['source']['buffDatabase']['sha256']
db = json.loads(dbpath.read_text())
for key, value in E['buffDatabase'].items(): assert value == db[key]
art_objects = bundles['chararts/char_1035_wisdel.ab']
expected_art = {str(i) for i,o in art_objects.items() if o.type.name == 'MonoBehaviour' and any(k in o.read_typetree() for k in ['_animations','_spine','_dataAsset'])}
assert {r['pathId'] for r in E['chararts']['char_1035_wisdel']} == expected_art
for row in E['chararts']['char_1035_wisdel']:
    assert normalized(bundles['chararts/char_1035_wisdel.ab'][int(row['pathId'])].read_typetree()) == row['data']

from collections import deque
queue = deque([E['characters'], E['tokens'], E['skills'], ct['char_1035_wisdel'], ct['token_10035_wisdel_wward'],
    [st[key] for key in {**E['tables']['skills'], **E['tables']['tokenSkills']}]])
reachable, dbkeys, projectile_keys, range_keys = set(), set(), set(), set()
while queue:
    value = queue.popleft()
    if isinstance(value, dict): queue.extend(value.values())
    elif isinstance(value, list): queue.extend(value)
    elif isinstance(value, str):
        if value in bt and value not in reachable:
            reachable.add(value); queue.append(bt[value])
        if value in db and value not in dbkeys:
            dbkeys.add(value); queue.append(db[value])
        if value.startswith('projectile_') and value != 'projectile_range' and value not in projectile_keys:
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
for group, path in [('characters','charpack/char_1035_wisdel.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('skills','battle/prefabs/[uc]skills.ab'),
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
        assert actual == expected, (group, name, 'incomplete component membership')
hot = json.loads((C/'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == E['source']['nativeClient'] == '26-09-23-17-49-43_b9cc4a'
for record in E['source']['bundles']:
    native = next(row for row in hot['abInfos'] if row['name'] == record['path'])
    assert (record['md5'], record['size']) == (native['md5'], native['abSize'])
assert E['enabledOperators'] == [] and E['heldOperators'] == ['char_1035_wisdel']
assert E['reviewStatus'] == 'Private ordinary/S1/S2/S3 and Shadow components checked separately; full kit remains unavailable pending public integration'
assert len(E['holdReasons']) == 3 and len(E['recoveredFacts']) == 10
assert 'runtimeMapping' not in E and 'runtimeContracts' not in E
assert E['frameParity'] is False and E['moduleSupport'] is False and E['nativeParticleSupport'] is False
assert set(E['tables']['skills']) == {'skchr_wisdel_1', 'skchr_wisdel_2', 'skchr_wisdel_3'}
assert set(E['tables']['tokenSkills']) == {'sktok_wisdel_wward'}
assert set(E['skills']) == set(E['tables']['skills']) | set(E['tables']['tokenSkills'])
assert all(len(s['levels']) == 10 for s in {**E['tables']['skills'], **E['tables']['tokenSkills']}.values())
assert len(E['projectiles']) == 8 and len(E['templates']) == 13
# Independently parse the pinned skeleton/atlas bytes, including unrounded event
# payloads. Hash-valid art is insufficient if the event summaries were edited.
subprocess.check_call(['node', 'tools/arkpedia/inspect-wisadel.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
assert json.loads((C/'wisadel-source/models.json').read_text()) == E['models']
# Independently follow the original Revenant Shadow animator, skeleton, material and
# embedded RGBA texture and native facing pointers. No importer record substitutes for bytes.
from extract import normalize_atlas
from PIL import Image
TOKEN = 'token_10035_wisdel_wward'
art = E['tokenArtwork']
assert set(art['models']) == {TOKEN}
assert set(art['models'][TOKEN]['facings']) == {'front', 'back'}
assert set(E['tokenModels']) == {TOKEN}
assert set(E['tokenModels'][TOKEN]) == {'front', 'back'}
assert json.loads((C/'wisadel-source/equipment/sources.json').read_text()) == art
by = bundles['pkgrps/btl_pfb_tokens_0.ab']
bundle = next(r for r in E['source']['bundles'] if r['path'] == art['sourceBundle']['path'])
assert (bundle['size'],bundle['md5'],bundle['sha256']) == (art['sourceBundle']['bytes'],art['sourceBundle']['md5'],art['sourceBundle']['sha256'])
assert art['sourceBundle']['resourceVersion'] == E['source']['nativeClient']
for face, record in art['models'][TOKEN]['facings'].items():
    refs = record['originalPathIds']
    assert refs['rootPathId'] == '7531983340995195566'
    assert refs['animatorPathId'] == '-4280882534783470930'
    def obj(key): return by[int(refs[key])].read_typetree()
    def linked(data, field, key):
        ptr = data[field]
        assert ptr['m_FileID'] == 0 and str(ptr['m_PathID']) == refs[key], (face, field)
    linked(obj('rootPathId'), '_animator', 'animatorPathId')
    linked(obj('animatorPathId'), '_skeleton', 'skeletonAnimationPathId')
    linked(obj('animatorPathId'), '_faceSwitcher', 'faceSwitcherPathId')
    assert refs['faceSwitcherPathId'] == '40550321937560238'
    assert obj('faceSwitcherPathId')['_defaultLOrR'] == 3
    assert abs(obj('faceSwitcherPathId')['_switchTime'] - .15) < 1e-6
    linked(obj('skeletonAnimationPathId'), 'skeletonDataAsset', 'skeletonDataAssetPathId')
    asset = obj('skeletonDataAssetPathId')
    linked(asset, 'skeletonJSON', 'textAssetPathId')
    assert len(asset['atlasAssets']) == 1
    linked({'atlas':asset['atlasAssets'][0]}, 'atlas', 'atlasAssetPathId')
    atlas = obj('atlasAssetPathId')
    linked(atlas,'atlasFile','atlasTextAssetPathId')
    assert len(atlas['materials']) == 1
    linked({'material':atlas['materials'][0]},'material','materialPathId')
    material = obj('materialPathId')
    textures = dict(material['m_SavedProperties']['m_TexEnvs'])
    for role,key in [('_MainTex','rgbTexturePathId'),('_AlphaTex','alphaTexturePathId')]:
        linked(textures[role],'m_Texture',key)
    assert refs['alphaTexturePathId'] == '0'
    assert dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex'] == 0
    folder = C / 'wisadel-source/equipment' / record['directory']
    for name, expected in record['files'].items():
        raw = (folder/name).read_bytes()
        assert len(raw) == expected['bytes'] and hashlib.sha256(raw).hexdigest() == expected['sha256']
    raw = by[int(refs['textAssetPathId'])].read().m_Script
    if isinstance(raw,str): raw = raw.encode('utf8','surrogateescape')
    assert (folder/(TOKEN+'.skel')).read_bytes() == raw
    image = by[int(refs['rgbTexturePathId'])].read().image
    assert image.mode == 'RGBA' and image.size == (216,216)
    png = Image.open(folder/(TOKEN+'.png'))
    assert png.mode == image.mode and png.size == image.size and png.tobytes() == image.tobytes()
    raw_atlas = by[int(refs['atlasTextAssetPathId'])].read().m_Script
    if isinstance(raw_atlas,bytes): raw_atlas = raw_atlas.decode('utf8')
    assert (folder/(TOKEN+'.atlas')).read_text() == normalize_atlas(raw_atlas,{TOKEN+'.png':image.size})
assert json.loads((C/'wisadel-source/equipment/models.json').read_text()) == E['tokenModels']
for face,model in E['tokenModels'][TOKEN].items():
    record=art['models'][TOKEN]['facings'][face]['files'][TOKEN+'.skel']
    assert model['sha256'] == record['sha256'] and model['bytes'] == record['bytes']
# Both facing aliases intentionally point at the same original skeleton.
assert art['models'][TOKEN]['facings']['front']['files'] == art['models'][TOKEN]['facings']['back']['files']
print(f'Verified {count} native components, {len(bundles)} bundles, {len(E["templates"])} templates, 30 owner plus 10 token ranks, {len(E["projectiles"])} projectile trees and three original skeleton chains; complete held source foundation; combat, asset publication and compiled frame parity remain unverified')
