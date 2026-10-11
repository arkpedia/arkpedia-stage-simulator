#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Pozëmka's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-pozemka.py.
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
    ROOT / 'data/arkpedia-pozemka-prefabs.json').read_text())
C = ROOT / '.cache/arkpedia'
assert E['source']['commit'] == '57010cb5b2afea112cae57daa756b58676ba6850'
assert E['source']['modelCommit'] == 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
assert set(E['models']) == set(E['officialSkeletonBindings']) == {'char_4055_bgsnow','token_10026_bgsnow_subbow'}
for owner in E['models']:
    assert set(E['officialSkeletonBindings'][owner]) == {'Front','Back'}
    assert set(E['models'][owner]) - {'commit'} == {'Front','Back'}

def normalized(v, key=''):
    if isinstance(v, dict): return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, list): return [normalized(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

bundles = {}
for record in E['source']['bundles']:
    path = record['path']
    local = C / ('pozemka-source/char_4055_bgsnow-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_4055_bgsnow.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_4055_bgsnow.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
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
assert E['tables']['character'] == ct['char_4055_bgsnow']
for key, value in {**E['tables']['skills'], **E['tables']['tokenSkills']}.items(): assert value == st[key]
assert E['tables']['tokens'] == {'token_10026_bgsnow_subbow': ct['token_10026_bgsnow_subbow']}
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_4055_bgsnow'].items():
    path = 'chararts/char_4055_bgsnow.ab'
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
    model = E['models']['char_4055_bgsnow'][face]
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
for row in E['chararts']['char_4055_bgsnow']:
    assert normalized(bundles['chararts/char_4055_bgsnow.ab'][int(row['pathId'])].read_typetree()) == row['data']

from collections import deque
queue = deque([E['characters'], E['skills'], E['tokens'], ct['char_4055_bgsnow'], ct['token_10026_bgsnow_subbow'],
    [st[key] for key in {**E['tables']['skills'], **E['tables']['tokenSkills']}]])
reachable, dbkeys, projectile_keys, range_keys = set(), set(), set(), set()
while queue:
    value = queue.popleft()
    if isinstance(value, dict):
        queue.extend(v for k, v in value.items() if not (k == 'key' and 'value' in value))
    elif isinstance(value, list): queue.extend(value)
    elif isinstance(value, str):
        if value in bt and value not in reachable:
            reachable.add(value); queue.append(bt[value])
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
for group, path in [('characters','charpack/char_4055_bgsnow.ab'), ('skills','battle/prefabs/[uc]skills.ab'),
                    ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
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
assert len(E['recoveredFacts']) == 8 and len(E['verificationLimits']) == 3 and len(E['holdReasons']) == 0 and len(E['runtimeContracts']) == 8
assert E['enabledOperators'] == ['char_4055_bgsnow'] and E['heldOperators'] == []
assert E['reviewStatus'] == 'Reviewed three-skill owner and Typewriter adapter with explicit native-dispatch limits'
assert E['frameParity'] is False and E['moduleSupport'] is False and E['nativeParticleSupport'] is False
assert set(E['tables']['skills']) == {'skchr_bgsnow_1','skchr_bgsnow_2','skchr_bgsnow_3'}
assert set(E['tables']['tokenSkills']) == {'sktok_bgsnow_1','sktok_bgsnow_2','sktok_bgsnow_3'}
assert set(E['skills']) == set(E['tables']['skills']) | set(E['tables']['tokenSkills'])
assert all(len(s['levels']) == 10 for s in {**E['tables']['skills'], **E['tables']['tokenSkills']}.values())
# Require the complete native animator/facing-controller set, not just valid retained rows.
art_by = bundles['chararts/char_4055_bgsnow.ab']
expected_art = {str(i) for i,o in art_by.items() if o.type.name=='MonoBehaviour'
    and any(k in o.read_typetree() for k in ['_animations','_spine','_dataAsset'])}
expected_art |= {str(art_by[int(i)].read_typetree()['_faceSwitcher']['m_PathID'])
    for i in list(expected_art) if '_faceSwitcher' in art_by[int(i)].read_typetree()}
assert expected_art == {r['pathId'] for r in E['chararts']['char_4055_bgsnow']}
for face, record in E['officialSkeletonBindings']['char_4055_bgsnow'].items():
    animator = art_by[int(record['animatorPathId'])].read_typetree()
    assert str(animator['_faceSwitcher']['m_PathID']) == record['faceSwitcherPathId']
    assert record['faceSwitcherPathId'] in expected_art
from extract import merge_alpha, normalize_atlas
from PIL import Image
assert json.loads((C/'pozemka-source/typewriter/sources.json').read_text()) == E['originalTypewriterModels']
token = 'token_10026_bgsnow_subbow'
by = bundles['pkgrps/btl_pfb_tokens_0.ab']
artwork = E['originalTypewriterModels']
assert set(artwork['models']) == {token}
assert set(artwork['models'][token]['facings']) == {'front','back'}
assert artwork['avatarSource'] == {'repository':'fexli/ArknightsResource',
    'commit':E['source']['modelCommit'],'directory':'avatar/ASSISTANT'}
source_bundle = next(r for r in E['source']['bundles'] if r['path']=='pkgrps/btl_pfb_tokens_0.ab')
for key in ['path','md5','sha256']:
    assert artwork['sourceBundle'][key] == source_bundle[key]
assert artwork['sourceBundle']['bytes'] == source_bundle['size']
assert artwork['sourceBundle']['resourceVersion'] == E['source']['nativeClient']
for face, record in E['officialSkeletonBindings'][token].items():
    root = by[int(record['rootPathId'])].read_typetree()
    assert str(root['_animator']['m_PathID']) == record['animatorPathId']
    animator = by[int(record['animatorPathId'])].read_typetree()
    assert str(animator['_' + face.lower()]['skeleton']['m_PathID']) == record['skeletonAnimationPathId']
    assert str(animator['_faceSwitcher']['m_PathID']) == record['faceSwitcherPathId']
    skeleton = by[int(record['skeletonAnimationPathId'])].read_typetree()
    assert str(skeleton['skeletonDataAsset']['m_PathID']) == record['skeletonDataAssetPathId']
    asset = by[int(record['skeletonDataAssetPathId'])].read_typetree()
    assert str(asset['skeletonJSON']['m_PathID']) == record['textAssetPathId']
    assert str(asset['atlasAssets'][0]['m_PathID']) == record['atlasAssetPathId']
    atlas = by[int(record['atlasAssetPathId'])].read_typetree()
    assert str(atlas['atlasFile']['m_PathID']) == record['atlasTextAssetPathId']
    assert str(atlas['materials'][0]['m_PathID']) == record['materialPathId']
    material = by[int(record['materialPathId'])].read_typetree()
    textures = dict(material['m_SavedProperties']['m_TexEnvs'])
    assert record['alphaTexturePathId'] != '0'
    assert dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex'] == 1
    for role, key in [('_MainTex','rgbTexturePathId'),('_AlphaTex','alphaTexturePathId')]:
        assert str(textures[role]['m_Texture']['m_PathID']) == record[key]
    raw = by[int(record['textAssetPathId'])].read().m_Script
    if isinstance(raw, str): raw = raw.encode('utf8','surrogateescape')
    assert hashlib.sha256(raw).hexdigest() == record['sha256']
    assert len(raw) == record['byteLength']
    model = E['models'][token][face]
    assert model['sha256'] == record['sha256'] and model['bytes'] == len(raw)
    imported = E['originalTypewriterModels']['models'][token]['facings'][face.lower()]
    local = C / 'pozemka-source/typewriter' / imported['directory']
    assert (local/(token+'.skel')).read_bytes() == raw
    for name, expected in imported['files'].items():
        data = (local/name).read_bytes()
        assert len(data) == expected['bytes'] and hashlib.sha256(data).hexdigest() == expected['sha256']
    image = merge_alpha(by[int(record['rgbTexturePathId'])].read().image, by[int(record['alphaTexturePathId'])].read().image)
    png = Image.open(local/(token+'.png'))
    assert png.mode == image.mode and png.size == image.size and png.tobytes() == image.tobytes()
    original_atlas = by[int(record['atlasTextAssetPathId'])].read().m_Script
    if isinstance(original_atlas, bytes): original_atlas = original_atlas.decode('utf8')
    assert (local/(token+'.atlas')).read_text() == normalize_atlas(original_atlas,{token+'.png':image.size})
    avatar = subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),
        'show', E['originalTypewriterModels']['avatarSource']['commit']+':avatar/ASSISTANT/'+token+'.png'])
    assert (local/'avatar.png').read_bytes() == avatar


# Independently reparse original owner and token event payloads.
subprocess.check_call(['node','tools/arkpedia/inspect-pozemka.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
assert json.loads((C/'pozemka-source/models.json').read_text()) == {'char_4055_bgsnow': E['models']['char_4055_bgsnow']}
assert json.loads((C/'pozemka-source/typewriter/sources.json').read_text()) == E['originalTypewriterModels']
for face,r in E['originalTypewriterModels']['models']['token_10026_bgsnow_subbow']['facings'].items():
    assert E['models']['token_10026_bgsnow_subbow'][face.capitalize()] == {**r,'sha256':r['files']['token_10026_bgsnow_subbow.skel']['sha256'],'bytes':r['files']['token_10026_bgsnow_subbow.skel']['bytes']}
print(f'Verified {count} native components, {len(bundles)} bundles, {len(E["templates"])} templates, 30 owner plus 30 token ranks, {len(E["projectiles"])} projectile trees and four original facing skeleton chains; eight reviewed runtime contracts enabled')
