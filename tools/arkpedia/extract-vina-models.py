#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract Golden Vows' original single skeleton by native pointers, not names.

Run with .cache/map-env/bin/python tools/arkpedia/extract-vina-models.py,
then node tools/arkpedia/inspect-vina.mjs before the asset importer.
Follow the reviewed default token root and animator's
SkeletonAnimation -> SkeletonDataAsset -> atlas/material/textures instead.
This prepares artwork only and does not enable an unverified combat adapter.
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

ID = 'token_10040_siege2_vlion'
VERSION = '26-09-23-17-49-43_b9cc4a'
C = ROOT / '.cache/arkpedia'
OUT = C / 'vina-source/golden-vows'
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
root = by[-5146560263001141338].read_typetree()
animator_id = local_pointer(root['_animator'])
animator = by[animator_id].read_typetree()
assert animator_id == -2334606395426926682
facings = {}
OUT.mkdir(parents=True, exist_ok=True)
for face in ['front']:
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
    assert alpha_id == 0
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
    pointers = {'rootPathId': -5146560263001141338, 'animatorPathId': animator_id,
        'skeletonAnimationPathId': skeleton_id, 'skeletonDataAssetPathId': asset_id,
        'textAssetPathId': text_id, 'atlasAssetPathId': atlas_id,
        'atlasTextAssetPathId': atlas_text_id, 'materialPathId': material_id,
        'rgbTexturePathId': rgb_id, 'alphaTexturePathId': alpha_id}
    files = {name: {'bytes': (directory/name).stat().st_size, 'sha256': digest((directory/name).read_bytes())}
        for name in [ID+'.skel', ID+'.atlas', ID+'.png']}
    facings[face] = {'directory': face, 'files': files,
        'textureDimensions': list(image.size), 'originalPathIds': {k: str(v) for k, v in pointers.items()}}
metadata = {'sourceBundle': {'path': BUNDLE, 'bytes': len(raw), 'md5': info['md5'],
    'sha256': digest(raw), 'resourceVersion': VERSION,
    'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
    'transforms': ['Native RGBA texture preserved', 'atlas texture dimensions normalized and pma: true recorded']},
    'models': {ID: facings['front']}}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Extracted Golden Vows native single skeleton and material pointer chain')
