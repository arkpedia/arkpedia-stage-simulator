#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract the original Champagne Bomb skeleton through native pointers.

Run with .cache/map-env/bin/python tools/arkpedia/extract-swire-alter-models.py,
then node tools/arkpedia/inspect-swire-alter.mjs before the asset importer.
The original token uses one skeleton and a horizontal FaceSwitcher; front/back
records intentionally alias the same bytes. Follow SkeletonAnimation ->
SkeletonDataAsset -> atlas/material/RGB and separate alpha textures.
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

ID = 'token_10031_swire2_gdtrap'
VERSION = '26-09-23-17-49-43_b9cc4a'
AVATAR_COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
C = ROOT / '.cache/arkpedia'
OUT = C / 'swire-alter-source/champagne'
BUNDLE = 'pkgrps/btl_pfb_tokens_0.ab'

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
raw = (C / 'map-source/ab' / BUNDLE).read_bytes()
assert len(raw) == info['abSize'] and hashlib.md5(raw).hexdigest() == info['md5']
env = UnityPy.load(raw)
by = {o.path_id: o for o in env.objects}
# The reviewed root points at this animator; assert that relationship as well.
root = by[6574921324621103369].read_typetree()
animator_id = local_pointer(root['_animator'])
animator = by[animator_id].read_typetree()
assert animator_id == -2099772112291200759
facings = {}
OUT.mkdir(parents=True, exist_ok=True)
avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
    'show', f'{AVATAR_COMMIT}:avatar/ASSISTANT/{ID}.png'])
for face in ['front', 'back']:
    # This original token has one skeleton and a horizontal FaceSwitcher.
    # Both imported facing records intentionally share those exact bytes.
    skeleton_id = local_pointer(animator['_skeleton'])
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
    assert alpha_id != 0 and dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex'] == 1
    image = merge_alpha(by[rgb_id].read().image, by[alpha_id].read().image)
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
    pointers = {'rootPathId': 6574921324621103369, 'animatorPathId': animator_id,
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
    'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
    'transforms': ['Original RGB plus separated alpha texture merge', 'atlas texture dimensions normalized and pma: true recorded']},
    'avatarSource': {'repository': 'fexli/ArknightsResource', 'commit': AVATAR_COMMIT, 'directory': 'avatar/ASSISTANT'},
    'models': {ID: {'facings': facings}}}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Extracted original single-skeleton Champagne Bomb with two facing aliases and original RGB plus alpha textures')
