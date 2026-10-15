#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently walk original Closure token art and compare pixels and delivery."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image

C = ROOT / '.cache/arkpedia'
OUT = C / 'cn-operators/char_4228_closur/device-art'
META = Path(sys.argv[sys.argv.index('--metadata') + 1]) if '--metadata' in sys.argv else OUT / 'sources.json'
NODE = os.environ.get('ARKPEDIA_SOURCE_NODE', 'node')
OWNER, TOKEN = 'char_4228_closur', 'token_10066_closur_ourbase'
COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
FOUNDATION_HASH = 'c196d4fbf6a42a4e75e0435b8507b2206411fe8fb7515dfc1c967860f9a7f6de'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def pointer(v):
    assert v['m_FileID'] == 0 and v['m_PathID'] != 0
    return v['m_PathID']


def norm(v):
    if isinstance(v, dict): return {k: str(x) if k == 'm_PathID' else norm(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [norm(x) for x in v]
    return v


def payload(obj):
    raw = obj.read().m_Script
    return raw.encode('utf8', 'surrogateescape') if isinstance(raw, str) else bytes(raw)


def model(skel, atlas):
    return json.loads(subprocess.check_output([NODE, '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';"
        "import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel("
        "await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,"
        "{includeEventPayloads:true})));", str(skel), str(atlas)], cwd=ROOT))


m = json.loads(META.read_text())
assert set(m) == {'foundation', 'sourceBundle', 'avatarSource', 'models', 'ownerModels'}
assert set(m['ownerModels']) == {'front', 'back'}
foundation_path = ROOT / 'data/arkpedia-native-operators/char_4228_closur.json'
assert sha(foundation_path.read_bytes()) == FOUNDATION_HASH
e = json.loads(foundation_path.read_bytes())
assert m['foundation'] == {'path': str(foundation_path.relative_to(ROOT)), 'sha256': FOUNDATION_HASH}
assert m['avatarSource'] == {'repository': 'fexli/ArknightsResource', 'commit': COMMIT, 'directory': 'avatar/ASSISTANT'}
assert set(m['models']) == {TOKEN} and set(m['models'][TOKEN]) == {'facings'}
assert set(m['models'][TOKEN]['facings']) == {'front', 'back'}
# Pin the publisher manifest separately from the extractor's receipt.
hot_raw = (C / 'cn-native-source/hot_update_list.json').read_bytes()
assert len(hot_raw) == 3241788 and sha(hot_raw) == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
hot = json.loads(hot_raw)
version, bundle = '26-09-22-07-47-20_6c71fa', 'pkgrps/btl_pfb_tokens_4.ab'
assert hot['versionId'] == version
entry = next(r for r in hot['abInfos'] if r['name'] == bundle)
raw = (C / 'cn-native-source/bundles' / bundle).read_bytes()
assert len(raw) == entry['abSize'] and hashlib.md5(raw).hexdigest() == entry['md5']
assert sha(raw) == 'af23c7f497862f38be2cdca0cd4079d44753bde8d61b97398e5a2777a54281e4'
source = {'path': bundle, 'bytes': len(raw), 'md5': entry['md5'], 'sha256': sha(raw), 'client': 'cn',
    'resourceVersion': version,
    'url': f'https://ak.hycdn.cn/assetbundle/official/Android/assets/{version}/pkgrps_btl_pfb_tokens_4.dat',
    'transforms': [
        'Original embedded premultiplied RGBA textures decoded; RGB clamped to alpha to remove compression bleed',
        'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
        'Distinct original Front and Back skeletons retained; no missing attack, death or stun clip invented',
    ]}
assert m['sourceBundle'] == source
objects = {o.path_id: o for o in UnityPy.load(raw).objects}
container = f'dyn/battle/prefabs/[uc]tokens/{TOKEN}.prefab'
roots = [pointer(fields['asset']) for o in objects.values() if o.type.name == 'AssetBundle'
         for name, fields in o.read_typetree()['m_Container'] if name == container]
assert len(roots) == 1
root = objects[roots[0]].read_typetree(); assert root['m_Name'] == TOKEN
components = [(pointer(c['component']), objects[pointer(c['component'])]) for c in root['m_Component']]
controllers = [(pid, obj.read_typetree()) for pid, obj in components if obj.type.name == 'MonoBehaviour']
controllers = [(pid, data) for pid, data in controllers if '_animator' in data]
assert len(controllers) == 1
controller_id, controller = controllers[0]
animator_id = pointer(controller['_animator']); animator = objects[animator_id].read_typetree()
switcher_id = pointer(animator['_faceSwitcher']); switcher = norm(objects[switcher_id].read_typetree())
assert norm(animator) == e['tokenArtworkControllers'][TOKEN][0]['data']
assets = ROOT.parent / 'arkpedia-sd-assets'
manifest = json.loads((assets / 'manifest.json').read_text()) if '--delivered' in sys.argv else None
for face in ['Front', 'Back']:
    r = m['models'][TOKEN]['facings'][face.lower()]
    assert set(r) == {'directory', 'files', 'textureDimensions', 'originalPathIds', 'materialFloats',
        'nativeFaceSwitcher', 'nativeAnimationBindings', 'nativeAnimationAliases', 'missingOptionalAliases',
        'missingRequiredAliases', 'spineVersion', 'durations', 'hits', 'eventPayloads', 'bounds', 'animationRoles'}
    assert r['directory'] == f'{TOKEN}/{face.lower()}'
    directory = META.parent / r['directory']
    # Every pointer here comes from the original root, not the export metadata.
    ids = {'rootPathId': roots[0], 'controllerPathId': controller_id, 'animatorPathId': animator_id,
           'faceSwitcherPathId': switcher_id, 'skeletonAnimationPathId': pointer(animator['_' + face.lower()]['skeleton'])}
    skeleton = objects[ids['skeletonAnimationPathId']].read_typetree()
    assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
    ids['skeletonDataAssetPathId'] = pointer(skeleton['skeletonDataAsset'])
    data = objects[ids['skeletonDataAssetPathId']].read_typetree()
    ids['textAssetPathId'] = pointer(data['skeletonJSON'])
    assert len(data['atlasAssets']) == 1
    ids['atlasAssetPathId'] = pointer(data['atlasAssets'][0])
    atlas = objects[ids['atlasAssetPathId']].read_typetree()
    ids['atlasTextAssetPathId'] = pointer(atlas['atlasFile']); assert len(atlas['materials']) == 1
    ids['materialPathId'] = pointer(atlas['materials'][0])
    props = objects[ids['materialPathId']].read_typetree()['m_SavedProperties']
    floats, textures = dict(props['m_Floats']), dict(props['m_TexEnvs'])
    assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
    assert textures['_AlphaTex']['m_Texture'] == {'m_FileID': 0, 'm_PathID': 0}
    ids['rgbTexturePathId'] = pointer(textures['_MainTex']['m_Texture'])
    assert r['originalPathIds'] == {k: str(v) for k, v in ids.items()}
    assert r['materialFloats'] == floats and r['nativeFaceSwitcher'] == switcher
    skel, original_atlas = [payload(objects[ids[k]]) for k in ['textAssetPathId', 'atlasTextAssetPathId']]
    sn, an = [objects[ids[k]].read().m_Name for k in ['textAssetPathId', 'atlasTextAssetPathId']]
    assert (directory / sn).read_bytes() == skel
    native = e['officialSkeletonBindings'][TOKEN][face]
    assert native['sha256'] == sha(skel) and native['atlasSha256'] == sha(original_atlas)
    lines = original_atlas.decode().replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff').split('\n')
    start = next(i for i, line in enumerate(lines) if line); page = lines[start]
    assert all(Path(name).name == name for name in [sn, an, page])
    original_image = objects[ids['rgbTexturePathId']].read().image.convert('RGBA')
    actual_image = Image.open(directory / page)
    assert original_image.size == actual_image.size == (84, 84) and actual_image.mode == 'RGBA'
    assert r['textureDimensions'] == [84, 84]
    for actual, (red, green, blue, alpha) in zip(actual_image.getdata(), original_image.getdata()):
        assert actual == (min(red, alpha), min(green, alpha), min(blue, alpha), alpha)
    end = start + 1
    while end < len(lines) and lines[end] and ':' in lines[end] and not lines[end][0].isspace(): end += 1
    headers = ['size: 84,84' if line.startswith('size:') else line for line in lines[start + 1:end]]
    if not any(line.startswith('size:') for line in headers): headers.insert(0, 'size: 84,84')
    if not any(line.startswith('pma:') for line in headers): headers.append('pma: true')
    assert (directory / an).read_text() == '\n'.join([*lines[:start + 1], *headers, *lines[end:]])
    avatar = subprocess.check_output(['git', '-C', str(assets / '.cache/arknights-resource'), 'show',
        f'{COMMIT}:avatar/ASSISTANT/{TOKEN}.png'])
    assert (directory / 'avatar.png').read_bytes() == avatar
    assert set(r['files']) == {sn, an, page, 'avatar.png'}
    for name, h in r['files'].items():
        file = (directory / name).read_bytes(); assert len(file) == h['bytes'] and sha(file) == h['sha256']
    parsed = model(directory / sn, directory / an)
    assert parsed['missingRegions'] == [] and parsed['version'] == r['spineVersion'] == '3.8.99'
    for k in ['durations', 'hits', 'eventPayloads', 'bounds']: assert parsed[k] == r[k]
    for k in ['durations', 'hits', 'eventPayloads']: assert parsed[k] == e['models'][TOKEN][face][k]
    assert r['nativeAnimationBindings'] == animator['_animations']
    assert r['nativeAnimationAliases'] == {a['animKey']: a['animName'] for a in animator['_animations']}
    missing = [a['animName'] for a in animator['_animations'] if a['animName'] not in parsed['durations']]
    required = [a['animName'] for a in animator['_animations'] if not a['ignoreMissing'] and a['animName'] not in parsed['durations']]
    assert missing == r['missingOptionalAliases'] == ([] if face == 'Front' else ['Die'])
    assert required == r['missingRequiredAliases'] == []
    assert not any(k.startswith('Attack') or k == 'Stun' for k in parsed['durations'])
    assert r['animationRoles'] == {'idle': 'Idle', 'deploy': 'Start', 'attack': None, 'skill': None, 'die': 'Die' if face == 'Front' else None}
    if manifest:
        d = manifest['models'][f'operator/{TOKEN}/default/{face.lower()}']
        assert d['source'] == {'key': 'cn-client', 'kind': 'assetbundle', 'bundle': source, 'directory': bundle,
            'extractedSkeleton': sn, 'originalPathIds': r['originalPathIds'], 'transforms': source['transforms']}
        assert d['premultipliedAlpha'] is True and d['spineVersion'] == r['spineVersion']
        assert d['animations'] == r['durations'] and d['animationRoles'] == r['animationRoles']
        assert d['hits'] == r['hits'] and d['bounds'] == r['bounds'] and d['avatar']['source'] == m['avatarSource']
        for f in [d['skeleton'], d['atlas'], *d['textures'], d['avatar']]:
            file = (assets / f['path']).read_bytes()
            assert file == (directory / Path(f['path']).name).read_bytes()
            assert len(file) == f['bytes'] and sha(file) == f['sha256']
    print('Verified command center', face, 'original root/pointers, every pixel, regions, avatar and literal tracks', flush=True)

receipt = {'schemaVersion': 1, 'owner': OWNER, 'artworkOnly': True, 'enabledOperators': [], 'frameParity': False,
           'nativeParticleSupport': False, 'nativeShaderParity': False, **m}
if '--metadata' not in sys.argv: assert json.loads((ROOT / 'data/arkpedia-closur-device-art.json').read_text()) == receipt
owner_bundle = next(r for r in e['source']['bundles'] if r['path'] == f'chararts/{OWNER}.ab')
owner_raw = (C / 'cn-native-source/bundles' / owner_bundle['path']).read_bytes()
owner_info = next(r for r in hot['abInfos'] if r['name'] == owner_bundle['path'])
assert len(owner_raw) == owner_info['abSize'] == owner_bundle['bytes']
assert hashlib.md5(owner_raw).hexdigest() == owner_info['md5'] == owner_bundle['md5']
assert sha(owner_raw) == owner_bundle['sha256']
owner_objects = {o.path_id: o for o in UnityPy.load(owner_raw).objects}
for face in ['Front', 'Back']:
    r = m['ownerModels'][face.lower()]; key = f'operator/{OWNER}/default/{face.lower()}'
    assert set(r) == {'modelKey', 'source', 'files', 'nativeBundle', 'materialPathId', 'texturePathId', 'materialFloats', 'decodedPixelSha256', 'metadata'}
    assert r['modelKey'] == key and r['nativeBundle'] == owner_bundle
    directory = f'spine/{OWNER}/{OWNER}/{face}'
    assert r['source'] == {'key': 'operators', 'repository': 'fexli/ArknightsResource', 'commit': COMMIT, 'directory': directory}
    assert set(r['files']) == {'skeleton', 'atlas', 'textures'} and len(r['files']['textures']) == 1
    for f in [r['files']['skeleton'], r['files']['atlas'], *r['files']['textures']]:
        file = (assets / f['path']).read_bytes()
        pinned = subprocess.check_output(['git', '-C', str(assets / '.cache/arknights-resource'), 'show', f'{COMMIT}:{directory}/{Path(f["path"]).name}'])
        assert file == pinned and len(file) == f['bytes'] and sha(file) == f['sha256']
    native = e['officialSkeletonBindings'][OWNER][face]
    assert r['files']['skeleton']['sha256'] == native['sha256']
    atlas = owner_objects[int(native['atlasAssetPathId'])].read_typetree(); assert len(atlas['materials']) == 1
    mat_id = pointer(atlas['materials'][0]); props = owner_objects[mat_id].read_typetree()['m_SavedProperties']
    floats, textures = dict(props['m_Floats']), dict(props['m_TexEnvs'])
    tex_id = pointer(textures['_MainTex']['m_Texture'])
    assert floats['_StraightAlphaInput'] == 0 and floats['_UseAlphaTex'] == 0
    assert r['materialPathId'] == str(mat_id) and r['texturePathId'] == str(tex_id) and r['materialFloats'] == floats
    original_image = owner_objects[tex_id].read().image.convert('RGBA')
    delivered_image = Image.open(assets / r['files']['textures'][0]['path']).convert('RGBA')
    assert original_image.size == delivered_image.size and original_image.tobytes() == delivered_image.tobytes()
    assert r['decodedPixelSha256'] == sha(original_image.tobytes())
    native_atlas = payload(owner_objects[int(native['atlasTextAssetPathId'])]).decode()
    assert (assets / r['files']['atlas']['path']).read_text() == '\n'.join(
        line for line in native_atlas.lstrip('\n').split('\n') if not line.startswith('size:'))
    p = model(assets / r['files']['skeleton']['path'], assets / r['files']['atlas']['path'])
    assert p['missingRegions'] == []
    for k in ['durations', 'hits', 'eventPayloads']: assert p[k] == e['models'][OWNER][face][k]
    expected = {'spineVersion': p['version'], 'premultipliedAlpha': True, 'animations': p['durations'], 'hits': p['hits'], 'bounds': p['bounds'],
        'animationRoles': {'idle': 'Idle', 'deploy': 'Start', 'attack': {'begin': 'Attack_Begin', 'loop': 'Attack_Loop', 'end': None},
            'attackDown': {'begin': 'Attack_Down_Begin', 'loop': 'Attack_Down_Loop', 'end': None} if face == 'Front' else None,
            'skill': None, 'die': 'Die' if face == 'Front' else None, 'stun': None, 'move': None}}
    assert r['metadata'] == expected
    if manifest:
        d = manifest['models'][key]
        assert d['source'] == r['source'] and {k: d[k] for k in r['files']} == r['files']
        assert {k: d[k] for k in expected} == expected
    print('Verified existing owner', face, 'pinned files, native pixels/material and literal clips', flush=True)
if manifest: assert json.loads((assets / 'source-reviews/closure-command-center.json').read_text()) == receipt
print('Verified original Closure artwork; public combat/native shader parity remain separate', flush=True)
