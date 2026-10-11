#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract the original Amiya Medic skeleton through native pointers.

Run with .cache/map-env/bin/python tools/arkpedia/extract-amiya-medic-models.py,
then node tools/arkpedia/inspect-amiya-medic-art.mjs before the asset importer.
The original operator uses two original facing skeletons and a FaceSwitcher; front/back
records retain different native bytes. Follow SkeletonAnimation ->
SkeletonDataAsset -> atlas/material and original embedded-RGBA textures.
This prepares artwork; combat enablement requires its separate source audit.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 -- original client LZ4 decoder
import UnityPy
from extract import merge_alpha, normalize_atlas

ID = 'char_1037_amiya3'
VERSION = '26-09-23-17-49-43_b9cc4a'
AVATAR_COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
C = ROOT / '.cache/arkpedia'
OUT = C / 'amiya-medic-source/art'
BUNDLE = 'chararts/char_1037_amiya3.ab'

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def script(obj):
    value = obj.read().m_Script
    return value.encode('utf8', 'surrogateescape') if isinstance(value, str) else bytes(value)

def local_pointer(value):
    assert value['m_FileID'] == 0, 'External pointer needs an explicit source bundle'
    assert value['m_PathID'] != 0, 'Missing native dependency'
    return value['m_PathID']

hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == VERSION
info = next(r for r in hot['abInfos'] if r['name'] == BUNDLE)
raw = (C / 'amiya-medic-source/char_1037_amiya3-chararts.ab').read_bytes()
assert len(raw) == info['abSize'] and hashlib.md5(raw).hexdigest() == info['md5']
env = UnityPy.load(raw)
by = {o.path_id: o for o in env.objects}
# Preserve the animator and original FaceSwitcher already independently bound
# to both original skeletons in the full Medic source evidence.
evidence = json.loads((ROOT / 'data/arkpedia-amiya-medic-prefabs.json').read_text())
binding = evidence['officialSkeletonBindings'][ID]['Front']
animator_id = int(binding['animatorPathId'])
animator = by[animator_id].read_typetree()
facings = {}
OUT.mkdir(parents=True, exist_ok=True)
skin_bytes = (C / 'amiya-medic-source/skin_table.json').read_bytes()
skin_source = json.loads((C / 'amiya-medic-source/skin-table-source.json').read_text())
assert skin_source == {'path': 'en_US/gamedata/excel/skin_table.json', 'sha': '0317e4b9816b64a76084592891c8bf9c63b6fab6', 'size': 2815110}
assert len(skin_bytes) == skin_source['size'] and hashlib.sha1(f'blob {len(skin_bytes)}\0'.encode() + skin_bytes).hexdigest() == skin_source['sha']
skin_table = json.loads(skin_bytes)
skin_id = skin_table['buildinPatchMap']['char_002_amiya'][ID]
skin = skin_table['charSkins'][skin_id]
assert skin['tmplId'] == ID and skin['charId'] == 'char_002_amiya' and not skin['isBuySkin']
assert skin['battleSkin'] == {'overwritePrefab': False, 'skinOrPrefabId': 'DefaultSkin'}
avatar_id = skin['avatarId']
avatar_source = {'repository': 'fexli/ArknightsResource', 'commit': AVATAR_COMMIT, 'directory': 'avatar/ASSISTANT',
    'file': avatar_id + '.png', 'formSkin': {'skinId': skin_id, 'formId': ID, 'characterId': skin['charId']},
    'skinTable': {**skin_source, 'repository': 'Kengxxiao/ArknightsGameData_YoStar', 'commit': evidence['source']['commit']}}
avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
    'show', f'{AVATAR_COMMIT}:avatar/ASSISTANT/{avatar_id}.png'])
for face in ['front', 'back']:
    # This original operator has two original facing skeletons and a FaceSwitcher.
    # Each facing follows its own original pointer chain.
    skeleton_id = local_pointer(animator['_' + face]['skeleton'])
    skeleton = by[skeleton_id].read_typetree()
    asset_id = local_pointer(skeleton['skeletonDataAsset'])
    asset = by[asset_id].read_typetree()
    text_id = local_pointer(asset['skeletonJSON'])
    assert len(asset['atlasAssets']) == 1
    atlas_id = local_pointer(asset['atlasAssets'][0])
    atlas = by[atlas_id].read_typetree()
    atlas_text_id = local_pointer(atlas['atlasFile'])
    assert len(atlas['materials']) == 1
    material_id = local_pointer(atlas['materials'][0])
    material = by[material_id].read_typetree()
    textures = dict(material['m_SavedProperties']['m_TexEnvs'])
    rgb_id = local_pointer(textures['_MainTex']['m_Texture'])
    alpha_id = textures['_AlphaTex']['m_Texture']['m_PathID']
    assert alpha_id == 0 and dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex'] == 0
    assert dict(material['m_SavedProperties']['m_Floats'])['_StraightAlphaInput'] == 0
    image = by[rgb_id].read().image.convert('RGBA')
    skel = script(by[text_id])
    atlas_bytes = script(by[atlas_text_id])
    directory = OUT / face
    directory.mkdir(exist_ok=True)
    assert by[text_id].read().m_Name == ID + '.skel'
    assert by[atlas_text_id].read().m_Name == ID + '.atlas'
    (directory / (ID + '.skel')).write_bytes(skel)
    (directory / (ID + '.atlas')).write_text(normalize_atlas(atlas_bytes.decode('utf8'), {ID + '.png': image.size}))
    image.save(directory / (ID + '.png'))
    (directory / 'avatar.png').write_bytes(avatar)
    pointers = {'animatorPathId': animator_id,
        'skeletonAnimationPathId': skeleton_id, 'skeletonDataAssetPathId': asset_id,
        'textAssetPathId': text_id, 'atlasAssetPathId': atlas_id,
        'atlasTextAssetPathId': atlas_text_id, 'materialPathId': material_id,
        'rgbTexturePathId': rgb_id, 'alphaTexturePathId': alpha_id,
        'faceSwitcherPathId': local_pointer(animator['_faceSwitcher'])}
    files = {name: {'bytes': (directory/name).stat().st_size, 'sha256': digest((directory/name).read_bytes())}
        for name in [ID+'.skel', ID+'.atlas', ID+'.png', 'avatar.png']}
    facings[face] = {'directory': face, 'files': files,
        'textureDimensions': list(image.size), 'originalPathIds': {k: str(v) for k, v in pointers.items()}}
metadata = {'sourceBundle': {'path': BUNDLE, 'bytes': len(raw), 'md5': info['md5'],
    'sha256': digest(raw), 'resourceVersion': VERSION,
    'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/chararts_char_1037_amiya3.dat',
    'transforms': ['Original embedded-RGBA texture decode', 'atlas texture dimensions normalized and pma: true recorded']},
    'avatarSource': avatar_source,
    'models': {ID: {'facings': facings}}}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Extracted original two-skeleton Amiya Medic with two distinct facings and original embedded-RGBA textures')
