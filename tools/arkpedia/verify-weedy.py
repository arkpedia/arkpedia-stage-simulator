#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Weedy's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-weedy.py.
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
E = json.loads((ROOT / 'data/arkpedia-weedy-prefabs.json').read_text())
C = ROOT / '.cache/arkpedia'

def normalized(v, key=''):
    if isinstance(v, dict): return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, list): return [normalized(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

bundles = {}
for record in E['source']['bundles']:
    path = record['path']
    local = C / ('weedy-source/char_400_weedy-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_400_weedy.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_400_weedy.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab')]:
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
assert E['tables']['character'] == ct['char_400_weedy']
for key, value in E['tables']['skills'].items(): assert value == st[key]
for key, value in E['tables']['tokens'].items(): assert value == ct[key]
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_400_weedy'].items():
    path = 'chararts/char_400_weedy.ab'
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
    model = E['models']['char_400_weedy'][face]
    imported = subprocess.check_output(['git', '-C', str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'), 'show', E['source']['modelCommit']+':'+model['path']])
    assert imported == raw, face
from extract import merge_alpha, normalize_atlas
from PIL import Image
assert json.loads((C/'weedy-source/cannon/sources.json').read_text()) == E['originalCannonModels']
token = 'token_10009_weedy_cannon'
by = bundles['pkgrps/btl_pfb_tokens_0.ab']
for face, record in E['officialSkeletonBindings'][token].items():
    root = by[int(record['rootPathId'])].read_typetree()
    assert str(root['_animator']['m_PathID']) == record['animatorPathId']
    animator = by[int(record['animatorPathId'])].read_typetree()
    assert str(animator['_'+face.lower()]['skeleton']['m_PathID']) == record['skeletonAnimationPathId']
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
    for role, key in [('_MainTex','rgbTexturePathId'),('_AlphaTex','alphaTexturePathId')]:
        assert str(textures[role]['m_Texture']['m_PathID']) == record[key]
    raw = by[int(record['textAssetPathId'])].read().m_Script
    if isinstance(raw, str): raw = raw.encode('utf8','surrogateescape')
    assert hashlib.sha256(raw).hexdigest() == record['sha256']
    assert len(raw) == record['byteLength']
    model = E['models'][token][face]
    assert model['sha256'] == record['sha256'] and model['bytes'] == len(raw)
    imported = E['originalCannonModels']['models'][token]['facings'][face.lower()]
    local = C / 'weedy-source/cannon' / imported['directory']
    assert (local/(token+'.skel')).read_bytes() == raw
    for name, expected in imported['files'].items():
        data = (local/name).read_bytes()
        assert len(data) == expected['bytes'] and hashlib.sha256(data).hexdigest() == expected['sha256']
    image = merge_alpha(by[int(record['rgbTexturePathId'])].read().image,
        by[int(record['alphaTexturePathId'])].read().image)
    png = Image.open(local/(token+'.png'))
    assert png.mode == image.mode and png.size == image.size and png.tobytes() == image.tobytes()
    original_atlas = by[int(record['atlasTextAssetPathId'])].read().m_Script
    if isinstance(original_atlas, bytes): original_atlas = original_atlas.decode('utf8')
    assert (local/(token+'.atlas')).read_text() == normalize_atlas(original_atlas,{token+'.png':image.size})
    avatar = subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),
        'show', E['originalCannonModels']['avatarSource']['commit']+':avatar/ASSISTANT/'+token+'.png'])
    assert (local/'avatar.png').read_bytes() == avatar
delivery = E['cannonArtworkDelivery']
asset_root = ROOT.parent/'arkpedia-sd-assets'
manifest = json.loads(subprocess.check_output(['git','-C',str(asset_root),'show',delivery['commit']+':manifest.json']))
for key in delivery['keys']:
    published = manifest['models'][key]
    face = key.rsplit('/',1)[1]
    original = E['originalCannonModels']['models'][token]['facings'][face]
    assert published['source']['originalPathIds'] == original['originalPathIds']
    assert published['animationRoles'] == original['animationRoles']
    assert published['animations'] == original['durations']
    assert published['hits'] == original['hits']
    assert published['premultipliedAlpha'] is True
    for item in [published['skeleton'],published['atlas'],*published['textures'],published['avatar']]:
        data = subprocess.check_output(['git','-C',str(asset_root),'show',delivery['commit']+':'+item['path']])
        expected = original['files'][item['path'].rsplit('/',1)[1]]
        assert len(data) == expected['bytes'] and hashlib.sha256(data).hexdigest() == expected['sha256']
rt = json.loads((C/'range_table.json').read_text())
for key, value in E['tables']['ranges'].items(): assert value == rt[key]
holder = next(o for o in bundles['config/buff_template_holder.ab'].values()
    if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree()).read_typetree()['_templates']
for key, value in E['originalTemplates'].items(): assert value == next(t for t in holder if t['templateKey'] == key)
dbpath = C/'lessing-source/buff_table.json'
assert hashlib.sha256(dbpath.read_bytes()).hexdigest() == E['source']['buffDatabase']['sha256']
db = json.loads(dbpath.read_text())
for key, value in E['buffDatabase'].items(): assert value == db[key]
for row in E['chararts']['char_400_weedy']:
    assert normalized(bundles['chararts/char_400_weedy.ab'][int(row['pathId'])].read_typetree()) == row['data']
print(f'Verified {count} native components, {len(bundles)} bundles, {len(E["templates"])} templates, 40 ranks and four original skeleton chains')
