#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract the original Wisadel Revenant's Shadow skeleton through native pointers.

Run with .cache/map-env/bin/python tools/arkpedia/extract-wisadel-models.py,
then node tools/arkpedia/inspect-wisadel.mjs before the asset importer.
The original token uses one skeleton with a native left/right switcher; front/back
records intentionally alias the same bytes. Follow SkeletonAnimation ->
SkeletonDataAsset -> atlas/material/embedded RGBA texture.
This prepares artwork; combat enablement requires its separate source audit.
"""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 -- original client LZ4 decoder
import UnityPy
from extract import normalize_atlas

ID = 'token_10035_wisdel_wward'
VERSION = '26-09-23-17-49-43_b9cc4a'
C = ROOT / '.cache/arkpedia'
OUT = C / 'wisadel-source/equipment'
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
root = by[7531983340995195566].read_typetree()
animator_id = local_pointer(root['_animator'])
animator = by[animator_id].read_typetree()
assert animator_id == -4280882534783470930
assert animator['_faceSwitcher']['m_PathID'] == 40550321937560238
assert by[40550321937560238].read_typetree()['_defaultLOrR'] == 3
facings = {}
OUT.mkdir(parents=True, exist_ok=True)
for face in ['front', 'back']:
    # This original token has one skeleton with a native left/right switcher.
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
    assert alpha_id == 0 and dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex'] == 0
    image = by[rgb_id].read().image
    assert image.mode == 'RGBA'
    skel = script(by[text_id])
    atlas_bytes = script(by[atlas_text_id])
    directory = OUT / face
    directory.mkdir(exist_ok=True)
    assert by[text_id].read().m_Name == ID + '.skel'
    assert by[atlas_text_id].read().m_Name == ID + '.atlas'
    (directory / (ID + '.skel')).write_bytes(skel)
    (directory / (ID + '.atlas')).write_text(normalize_atlas(atlas_bytes.decode('utf8'), {ID + '.png': image.size}))
    image.save(directory / (ID + '.png'))
    pointers = {'rootPathId': 7531983340995195566, 'animatorPathId': animator_id,
        'skeletonAnimationPathId': skeleton_id, 'skeletonDataAssetPathId': asset_id,
        'textAssetPathId': text_id, 'atlasAssetPathId': atlas_id,
        'atlasTextAssetPathId': atlas_text_id, 'materialPathId': material_id,
        'rgbTexturePathId': rgb_id, 'alphaTexturePathId': alpha_id,
        'faceSwitcherPathId': str(animator['_faceSwitcher']['m_PathID'])}
    files = {name: {'bytes': (directory/name).stat().st_size, 'sha256': digest((directory/name).read_bytes())}
        for name in [ID+'.skel', ID+'.atlas', ID+'.png']}
    facings[face] = {'directory': face, 'files': files,
        'textureDimensions': list(image.size), 'originalPathIds': {k: str(v) for k, v in pointers.items()}}
metadata = {'sourceBundle': {'path': BUNDLE, 'bytes': len(raw), 'md5': info['md5'],
    'sha256': digest(raw), 'resourceVersion': VERSION,
    'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
    'transforms': ['Original embedded RGBA texture decoded', 'atlas texture dimensions normalized and pma: true recorded']},
    'models': {ID: {'facings': facings}}}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
print("Extracted original Revenant Shadow with single-skeleton facing aliases and original embedded RGBA texture")
