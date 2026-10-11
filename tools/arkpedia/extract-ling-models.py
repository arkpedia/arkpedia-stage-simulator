#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export the three default Ling dragons from the reviewed native bundle.

Preserve the original animator/FaceSwitcher,
split-alpha material chain and source alias names. This is artwork, not a
native shader/particle/frame-parity claim or a public roster enablement.
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

C = ROOT / '.cache/arkpedia'
OUT = C / 'ling-source/dragon-art'
BUNDLE = 'pkgrps/btl_pfb_tokens_0.ab'
VERSION = '26-09-23-17-49-43_b9cc4a'
COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SOURCE = ROOT / 'data/arkpedia-ling-prefabs.json'
SOURCE_SHA = 'a6ea709bc740129046c81e35b3a760a9d2ab5ef212b62d82e0dc7bb948adf9c1'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pointer(p):
    assert p['m_FileID'] == 0 and p['m_PathID'] != 0, 'Unresolved native art dependency'
    return p['m_PathID']


def script(obj):
    raw = obj.read().m_Script
    return raw.encode('utf8', 'surrogateescape') if isinstance(raw, str) else bytes(raw)


assert sha(SOURCE.read_bytes()) == SOURCE_SHA
foundation = json.loads(SOURCE.read_text())
hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == VERSION
info = next(r for r in hot['abInfos'] if r['name'] == BUNDLE)
raw = (C / 'map-source/ab' / BUNDLE).read_bytes()
assert len(raw) == info['abSize'] and hashlib.md5(raw).hexdigest() == info['md5']
by = {o.path_id: o for o in UnityPy.load(raw).objects}
models = {}
for n in range(1, 4):
    token = 'token_10020_ling_soul' + str(n)
    binding = foundation['officialTokenSkeletonBindings'][token]
    ids = {k: int(v) for k, v in binding.items() if k.endswith('PathId')}
    root = by[ids['rootPathId']].read_typetree()
    assert root['m_Name'] == token
    assert ids['controllerPathId'] in [pointer(c['component']) for c in root['m_Component']]
    controller = by[ids['controllerPathId']].read_typetree()
    assert pointer(controller['m_GameObject']) == ids['rootPathId']
    assert pointer(controller['_animator']) == ids['animatorPathId']
    animator = by[ids['animatorPathId']].read_typetree()
    assert animator['_animations'] == binding['animationAliases']
    assert pointer(animator['_faceSwitcher']) == ids['faceSwitcherPathId']
    assert pointer(animator['_skeleton']) == ids['skeletonAnimationPathId']
    skeleton = by[ids['skeletonAnimationPathId']].read_typetree()
    assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
    assert pointer(skeleton['skeletonDataAsset']) == ids['skeletonDataAssetPathId']
    asset = by[ids['skeletonDataAssetPathId']].read_typetree()
    assert pointer(asset['skeletonJSON']) == ids['textAssetPathId'] and len(asset['atlasAssets']) == 1
    assert pointer(asset['atlasAssets'][0]) == ids['atlasAssetPathId']
    atlas = by[ids['atlasAssetPathId']].read_typetree()
    assert pointer(atlas['atlasFile']) == ids['atlasTextAssetPathId'] and len(atlas['materials']) == 1
    ids['materialPathId'] = pointer(atlas['materials'][0])
    material = by[ids['materialPathId']].read_typetree()
    textures = dict(material['m_SavedProperties']['m_TexEnvs'])
    floats = dict(material['m_SavedProperties']['m_Floats'])
    assert floats['_UseAlphaTex'] == 1
    ids['rgbTexturePathId'] = pointer(textures['_MainTex']['m_Texture'])
    ids['alphaTexturePathId'] = pointer(textures['_AlphaTex']['m_Texture'])
    rgb = by[ids['rgbTexturePathId']].read().image
    alpha = by[ids['alphaTexturePathId']].read().image
    assert rgb.size == alpha.size == ((256, 256) if n < 3 else (512, 512))
    image = merge_alpha(rgb, alpha)
    skel, atlas_bytes = script(by[ids['textAssetPathId']]), script(by[ids['atlasTextAssetPathId']])
    assert sha(skel) == binding['sha256'] and len(skel) == binding['byteLength']
    assert sha(atlas_bytes) == binding['atlasSha256'] and len(atlas_bytes) == binding['atlasByteLength']
    assert by[ids['textAssetPathId']].read().m_Name == token + '.skel'
    assert by[ids['atlasTextAssetPathId']].read().m_Name == token + '.atlas'
    avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
        'show', f'{COMMIT}:avatar/ASSISTANT/{token}.png'])
    directory = OUT / token
    directory.mkdir(parents=True, exist_ok=True)
    (directory / (token + '.skel')).write_bytes(skel)
    (directory / (token + '.atlas')).write_text(normalize_atlas(atlas_bytes.decode('utf8'), {token + '.png': image.size}))
    image.save(directory / (token + '.png'))
    (directory / 'avatar.png').write_bytes(avatar)
    files = {name: {'bytes': (directory / name).stat().st_size, 'sha256': sha((directory / name).read_bytes())}
        for name in [token + '.skel', token + '.atlas', token + '.png', 'avatar.png']}
    models[token] = {'directory': token, 'files': files, 'textureDimensions': list(image.size),
        'originalPathIds': {k: str(v) for k, v in ids.items()},
        'nativeAnimationAliases': {r['animKey']: r['animName'] for r in animator['_animations']},
        'nativeAnimationBindings': animator['_animations'], 'materialFloats': floats}

metadata = {'sourceBundle': {'path': BUNDLE, 'bytes': len(raw), 'md5': info['md5'], 'sha256': sha(raw),
    'resourceVersion': VERSION,
    'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
    'transforms': ['Original split RGB/alpha textures merged to premultiplied RGBA; compression bleed clamped to alpha',
        'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
        'Renderer front/back aliases share each original native skeleton and FaceSwitcher']},
    'avatarSource': {'repository': 'fexli/ArknightsResource', 'commit': COMMIT, 'directory': 'avatar/ASSISTANT'},
    'foundation': {'path': 'data/arkpedia-ling-prefabs.json', 'sha256': SOURCE_SHA}, 'models': models}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
subprocess.check_call(['node', 'tools/arkpedia/inspect-ling-models.mjs'], cwd=ROOT)
print('Extracted all three original default Ling dragons, split-alpha pages and pinned avatars')
