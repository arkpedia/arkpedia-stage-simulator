#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export Delivery Coordinates from its native default animator/material chain.

One original skeleton supplies both renderer-facing aliases. The material uses
embedded premultiplied RGBA, not a separate alpha texture. This artwork export
does not enable Exusiai or certify native combat/particle/shader parity.
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
from extract import normalize_atlas

ID = 'token_10056_angel2_target'
C = ROOT / '.cache/arkpedia'
OUT = C / 'exusiai-covenant-source/coordinates-art'
BUNDLE = 'pkgrps/btl_pfb_tokens_0.ab'
VERSION = '26-09-23-17-49-43_b9cc4a'
COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pointer(p):
    assert p['m_FileID'] == 0 and p['m_PathID'] != 0, 'Unresolved native art dependency'
    return p['m_PathID']


def script(obj):
    raw = obj.read().m_Script
    return raw.encode('utf8', 'surrogateescape') if isinstance(raw, str) else bytes(raw)


hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == VERSION
info = next(r for r in hot['abInfos'] if r['name'] == BUNDLE)
raw = (C / 'map-source/ab' / BUNDLE).read_bytes()
assert len(raw) == info['abSize'] and hashlib.md5(raw).hexdigest() == info['md5']
by = {o.path_id: o for o in UnityPy.load(raw).objects}
root_id = 5469880532721077243
root = by[root_id].read_typetree()
go = by[pointer(root['m_GameObject'])].read_typetree()
assert go['m_Name'] == ID
animator_id = pointer(root['_animator'])
assert animator_id == -4645504156103930885
animator = by[animator_id].read_typetree()
aliases = {r['animKey']: r['animName'] for r in animator['_animations']}
assert aliases == {'Default': 'Default', 'Born': 'Start', 'Die': 'Die', 'Idle': 'Idle'}
skeleton_id = pointer(animator['_skeleton'])
skeleton = by[skeleton_id].read_typetree()
asset_id = pointer(skeleton['skeletonDataAsset'])
asset = by[asset_id].read_typetree()
assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
text_id = pointer(asset['skeletonJSON'])
assert len(asset['atlasAssets']) == 1
atlas_id = pointer(asset['atlasAssets'][0])
atlas = by[atlas_id].read_typetree()
atlas_text_id = pointer(atlas['atlasFile'])
assert len(atlas['materials']) == 1
material_id = pointer(atlas['materials'][0])
material = by[material_id].read_typetree()
textures = dict(material['m_SavedProperties']['m_TexEnvs'])
floats = dict(material['m_SavedProperties']['m_Floats'])
assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
assert textures['_AlphaTex']['m_Texture']['m_PathID'] == 0
texture_id = pointer(textures['_MainTex']['m_Texture'])
image = by[texture_id].read().image.convert('RGBA')
skel = script(by[text_id])
atlas_bytes = script(by[atlas_text_id])
assert by[text_id].read().m_Name == ID + '.skel'
assert by[atlas_text_id].read().m_Name == ID + '.atlas'
avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
    'show', f'{COMMIT}:avatar/ASSISTANT/{ID}.png'])
directory = OUT / 'original'
directory.mkdir(parents=True, exist_ok=True)
(directory / (ID + '.skel')).write_bytes(skel)
(directory / (ID + '.atlas')).write_text(normalize_atlas(atlas_bytes.decode('utf8'), {ID + '.png': image.size}))
image.save(directory / (ID + '.png'))
(directory / 'avatar.png').write_bytes(avatar)
ids = {'rootPathId': root_id, 'animatorPathId': animator_id, 'skeletonAnimationPathId': skeleton_id,
    'skeletonDataAssetPathId': asset_id, 'textAssetPathId': text_id, 'atlasAssetPathId': atlas_id,
    'atlasTextAssetPathId': atlas_text_id, 'materialPathId': material_id, 'rgbaTexturePathId': texture_id,
    'faceSwitcherPathId': pointer(animator['_faceSwitcher'])}
files = {name: {'bytes': (directory / name).stat().st_size, 'sha256': sha((directory / name).read_bytes())}
    for name in [ID + '.skel', ID + '.atlas', ID + '.png', 'avatar.png']}
metadata = {'sourceBundle': {'path': BUNDLE, 'bytes': len(raw), 'md5': info['md5'], 'sha256': sha(raw),
    'resourceVersion': VERSION,
    'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
    'transforms': ['Original embedded RGBA texture; material StraightAlphaInput 0',
        'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
        'Renderer front/back aliases share one original native skeleton and FaceSwitcher']},
    'avatarSource': {'repository': 'fexli/ArknightsResource', 'commit': COMMIT, 'directory': 'avatar/ASSISTANT'},
    'models': {ID: {'directory': 'original', 'files': files, 'textureDimensions': list(image.size),
        'originalPathIds': {k: str(v) for k, v in ids.items()}, 'nativeAnimationAliases': aliases}}}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
subprocess.check_call(['node', 'tools/arkpedia/inspect-exusiai-coordinate-model.mjs'], cwd=ROOT)
print('Extracted original single-skeleton Delivery Coordinates, embedded RGBA and pinned avatar')
