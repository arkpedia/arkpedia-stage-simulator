#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export Closure's original CN command-center artwork, without combat approval."""
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
from extract import normalize_atlas

NODE = os.environ.get('ARKPEDIA_SOURCE_NODE', 'node')
C = ROOT / '.cache/arkpedia'
OUT = C / 'cn-operators/char_4228_closur/device-art'
OWNER, TOKEN = 'char_4228_closur', 'token_10066_closur_ourbase'
BUNDLE, VERSION = 'pkgrps/btl_pfb_tokens_4.ab', '26-09-22-07-47-20_6c71fa'
COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
FOUNDATION_HASH = 'c196d4fbf6a42a4e75e0435b8507b2206411fe8fb7515dfc1c967860f9a7f6de'
TRANSFORMS = [
    'Original embedded premultiplied RGBA textures decoded; RGB clamped to alpha to remove compression bleed',
    'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
    'Distinct original Front and Back skeletons retained; no missing attack, death or stun clip invented',
]
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def ptr(value):
    assert value['m_FileID'] == 0 and value['m_PathID'] != 0
    return value['m_PathID']


def exact(v):
    if isinstance(v, dict): return {k: str(x) if k == 'm_PathID' else exact(x) for k, x in v.items()}
    if isinstance(v, (tuple, list)): return [exact(x) for x in v]
    return v


def text_asset(obj):
    s = obj.read().m_Script
    return s.encode('utf8', 'surrogateescape') if isinstance(s, str) else bytes(s)


def parse(skel, atlas):
    return json.loads(subprocess.check_output([NODE, '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';"
        "import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel("
        "await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,"
        "{includeEventPayloads:true})));", str(skel), str(atlas)], cwd=ROOT))


p = ROOT / 'data/arkpedia-native-operators/char_4228_closur.json'
assert sha(p.read_bytes()) == FOUNDATION_HASH
e = json.loads(p.read_bytes())
assert e['enabledOperators'] == [] and e['source']['nativeClient'] == VERSION
info = next(r for r in e['source']['bundles'] if r['path'] == BUNDLE)
raw = (C / 'cn-native-source/bundles' / BUNDLE).read_bytes()
assert len(raw) == info['bytes'] and hashlib.md5(raw).hexdigest() == info['md5'] and sha(raw) == info['sha256']
objects = {o.path_id: o for o in UnityPy.load(raw).objects}
binding = e['tokenSources'][TOKEN]
ids = {k: int(binding[k]) for k in ['rootPathId', 'animatorPathId']}
root = objects[ids['rootPathId']].read_typetree()
assert root['m_Name'] == TOKEN
controllers = [(ptr(c['component']), objects[ptr(c['component'])].read_typetree()) for c in root['m_Component']
               if objects[ptr(c['component'])].type.name == 'MonoBehaviour']
controllers = [(pid, data) for pid, data in controllers if '_animator' in data]
assert len(controllers) == 1
ids['controllerPathId'], controller = controllers[0]
assert ptr(controller['_animator']) == ids['animatorPathId']
animator = objects[ids['animatorPathId']].read_typetree()
assert exact(animator) == e['tokenArtworkControllers'][TOKEN][0]['data']
ids['faceSwitcherPathId'] = ptr(animator['_faceSwitcher'])
switcher = exact(objects[ids['faceSwitcherPathId']].read_typetree())
avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
    'show', f'{COMMIT}:avatar/ASSISTANT/{TOKEN}.png'])
faces = {}
for face, r in e['officialSkeletonBindings'][TOKEN].items():
    chain = {**ids, **{k: int(v) for k, v in r.items() if k.endswith('PathId')}}
    assert ptr(animator['_' + face.lower()]['skeleton']) == chain['skeletonAnimationPathId']
    skeleton = objects[chain['skeletonAnimationPathId']].read_typetree()
    assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
    assert ptr(skeleton['skeletonDataAsset']) == chain['skeletonDataAssetPathId']
    asset = objects[chain['skeletonDataAssetPathId']].read_typetree()
    assert ptr(asset['skeletonJSON']) == chain['textAssetPathId'] and len(asset['atlasAssets']) == 1
    assert ptr(asset['atlasAssets'][0]) == chain['atlasAssetPathId']
    atlas = objects[chain['atlasAssetPathId']].read_typetree()
    assert ptr(atlas['atlasFile']) == chain['atlasTextAssetPathId'] and len(atlas['materials']) == 1
    chain['materialPathId'] = ptr(atlas['materials'][0])
    props = objects[chain['materialPathId']].read_typetree()['m_SavedProperties']
    floats, textures = dict(props['m_Floats']), dict(props['m_TexEnvs'])
    assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
    assert textures['_AlphaTex']['m_Texture'] == {'m_FileID': 0, 'm_PathID': 0}
    chain['rgbTexturePathId'] = ptr(textures['_MainTex']['m_Texture'])
    original = objects[chain['rgbTexturePathId']].read().image.convert('RGBA')
    assert original.size == (84, 84)
    image = Image.new('RGBA', original.size)
    image.putdata([(min(red, a), min(green, a), min(blue, a), a) for red, green, blue, a in original.getdata()])
    skel, atlas_raw = [text_asset(objects[chain[k]]) for k in ['textAssetPathId', 'atlasTextAssetPathId']]
    assert sha(skel) == r['sha256'] and len(skel) == r['bytes']
    assert sha(atlas_raw) == r['atlasSha256'] and len(atlas_raw) == r['atlasBytes']
    sn, an = [objects[chain[k]].read().m_Name for k in ['textAssetPathId', 'atlasTextAssetPathId']]
    page = next(line.strip() for line in atlas_raw.decode().splitlines() if line.strip())
    assert sn.endswith('.skel') and an.endswith('.atlas') and page.endswith('.png')
    assert all(Path(name).name == name for name in [sn, an, page])
    directory = OUT / TOKEN / face.lower(); directory.mkdir(parents=True, exist_ok=True)
    (directory / sn).write_bytes(skel)
    (directory / an).write_text(normalize_atlas(atlas_raw.decode(), {page: image.size}))
    image.save(directory / page); (directory / 'avatar.png').write_bytes(avatar)
    parsed = parse(directory / sn, directory / an)
    assert parsed['version'] == '3.8.99' and parsed['missingRegions'] == []
    for key in ['durations', 'hits', 'eventPayloads']: assert parsed[key] == e['models'][TOKEN][face][key]
    missing = [a['animName'] for a in animator['_animations'] if a['animName'] not in parsed['durations']]
    assert missing == ([] if face == 'Front' else ['Die'])
    assert not any(k.startswith('Attack') or k == 'Stun' for k in parsed['durations'])
    names = [sn, an, page, 'avatar.png']
    faces[face.lower()] = {
        'directory': f'{TOKEN}/{face.lower()}',
        'files': {name: {'bytes': (directory / name).stat().st_size, 'sha256': sha((directory / name).read_bytes())} for name in names},
        'textureDimensions': list(image.size), 'originalPathIds': {k: str(v) for k, v in chain.items()},
        'materialFloats': floats, 'nativeFaceSwitcher': switcher,
        'nativeAnimationBindings': animator['_animations'], 'nativeAnimationAliases': {a['animKey']: a['animName'] for a in animator['_animations']},
        'missingOptionalAliases': missing, 'missingRequiredAliases': [], 'spineVersion': parsed['version'],
        **{k: parsed[k] for k in ['durations', 'hits', 'eventPayloads', 'bounds']},
        'animationRoles': {'idle': 'Idle', 'deploy': 'Start', 'attack': None, 'skill': None, 'die': 'Die' if face == 'Front' else None},
    }
    print('Exported original command center', face, len(skel), 'bytes; unavailable aliases:', missing, flush=True)

owner_bundle = next(r for r in e['source']['bundles'] if r['path'] == f'chararts/{OWNER}.ab')
owner_raw = (C / 'cn-native-source/bundles' / owner_bundle['path']).read_bytes()
assert len(owner_raw) == owner_bundle['bytes'] and sha(owner_raw) == owner_bundle['sha256']
owner_objects = {o.path_id: o for o in UnityPy.load(owner_raw).objects}
assets = ROOT.parent / 'arkpedia-sd-assets'
manifest = json.loads((assets / 'manifest.json').read_text())
owner_models = {}
for face in ['Front', 'Back']:
    key = f'operator/{OWNER}/default/{face.lower()}'
    delivered = manifest['models'][key]
    expected_source = {'key': 'operators', 'repository': 'fexli/ArknightsResource', 'commit': COMMIT,
                       'directory': f'spine/{OWNER}/{OWNER}/{face}'}
    assert delivered['source'] == expected_source
    parsed = parse(assets / delivered['skeleton']['path'], assets / delivered['atlas']['path'])
    native = e['officialSkeletonBindings'][OWNER][face]
    assert delivered['skeleton']['sha256'] == native['sha256']
    for k in ['durations', 'hits', 'eventPayloads']: assert parsed[k] == e['models'][OWNER][face][k]
    for file in [delivered['skeleton'], delivered['atlas'], *delivered['textures']]:
        original_git = subprocess.check_output(['git', '-C', str(assets / '.cache/arknights-resource'), 'show',
            f"{COMMIT}:{expected_source['directory']}/{Path(file['path']).name}"])
        assert (assets / file['path']).read_bytes() == original_git and sha(original_git) == file['sha256']
    atlas = owner_objects[int(native['atlasAssetPathId'])].read_typetree(); assert len(atlas['materials']) == 1
    material_id = ptr(atlas['materials'][0]); props = owner_objects[material_id].read_typetree()['m_SavedProperties']
    floats, textures = dict(props['m_Floats']), dict(props['m_TexEnvs'])
    assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
    texture_id = ptr(textures['_MainTex']['m_Texture'])
    original_pixels = owner_objects[texture_id].read().image.convert('RGBA')
    assert len(delivered['textures']) == 1
    git_pixels = Image.open(assets / delivered['textures'][0]['path']).convert('RGBA')
    assert original_pixels.size == git_pixels.size and original_pixels.tobytes() == git_pixels.tobytes()
    native_atlas = text_asset(owner_objects[int(native['atlasTextAssetPathId'])]).decode()
    assert (assets / delivered['atlas']['path']).read_text() == '\n'.join(
        line for line in native_atlas.lstrip('\n').split('\n') if not line.startswith('size:'))
    owner_models[face.lower()] = {'modelKey': key, 'source': expected_source,
        'files': {'skeleton': delivered['skeleton'], 'atlas': delivered['atlas'], 'textures': delivered['textures']},
        'nativeBundle': owner_bundle, 'materialPathId': str(material_id), 'texturePathId': str(texture_id),
        'materialFloats': floats, 'decodedPixelSha256': sha(original_pixels.tobytes()),
        'metadata': {'spineVersion': parsed['version'], 'premultipliedAlpha': True, 'animations': parsed['durations'],
            'hits': parsed['hits'], 'bounds': parsed['bounds'], 'animationRoles': {'idle': 'Idle', 'deploy': 'Start',
                'attack': {'begin': 'Attack_Begin', 'loop': 'Attack_Loop', 'end': None},
                'attackDown': {'begin': 'Attack_Down_Begin', 'loop': 'Attack_Down_Loop', 'end': None} if face == 'Front' else None,
                'skill': None, 'die': 'Die' if face == 'Front' else None, 'stun': None, 'move': None}}}
    print('Bound existing owner', face, 'to native pixels, PMA material and literal continuous-fire clips', flush=True)

m = {'sourceBundle': {**{k: info[k] for k in ['path', 'bytes', 'md5', 'sha256', 'url']}, 'client': 'cn',
    'resourceVersion': VERSION, 'transforms': TRANSFORMS},
    'avatarSource': {'repository': 'fexli/ArknightsResource', 'commit': COMMIT, 'directory': 'avatar/ASSISTANT'},
    'foundation': {'path': str(p.relative_to(ROOT)), 'sha256': FOUNDATION_HASH},
    'models': {TOKEN: {'facings': faces}}, 'ownerModels': owner_models}
(OUT / 'sources.json').write_text(json.dumps(m, indent=2) + '\n')
(ROOT / 'data/arkpedia-closur-device-art.json').write_text(json.dumps({'schemaVersion': 1, 'owner': OWNER,
    'artworkOnly': True, 'enabledOperators': [], 'frameParity': False, 'nativeParticleSupport': False,
    'nativeShaderParity': False, **m}, indent=2) + '\n')
if '--hydrate-owner-metadata' in sys.argv:
    for r in owner_models.values(): manifest['models'][r['modelKey']].update(r['metadata'])
    temporary = assets / f'manifest.json.closur-{os.getpid()}.tmp'
    temporary.write_text(json.dumps(manifest, indent=2) + '\n')
    temporary.replace(assets / 'manifest.json')
    print('Hydrated two existing owner metadata records; original files unchanged', flush=True)
