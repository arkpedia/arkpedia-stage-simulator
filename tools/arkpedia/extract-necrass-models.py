#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export Necrass's original Front/Back servant art; no combat approval."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image
from extract import normalize_atlas

C = ROOT / '.cache/arkpedia'
OUT = C / 'necrass-source/device-art'
TOKEN = 'token_10043_necras_skeltn'
BUNDLE = 'pkgrps/btl_pfb_tokens_0.ab'
VERSION = '26-09-23-17-49-43_b9cc4a'
COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
FOUNDATION_HASH = '175bf1e9b3dd661d83992b9a7435a97819ae5a3b9dda28f1671002d10dbe5f45'
TRANSFORMS = [
    'Original embedded premultiplied RGBA texture decoded; RGB clamped to alpha to remove compression bleed',
    'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
    'Original Front/Back skeletons and all clips retained; absent Back Stun/Stun_2 are not replaced',
]


def sha(raw): return hashlib.sha256(raw).hexdigest()


def ptr(value):
    assert value['m_FileID'] == 0 and value['m_PathID'] != 0
    return value['m_PathID']


def script(obj):
    value = obj.read().m_Script
    return value.encode('utf8', 'surrogateescape') if isinstance(value, str) else bytes(value)


def parse(skel, atlas):
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';"
        "import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel("
        "await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,"
        "{includeEventPayloads:true})));", str(skel), str(atlas)], cwd=ROOT))


foundation_path = ROOT / 'data/arkpedia-necrass-prefabs.json'
assert sha(foundation_path.read_bytes()) == FOUNDATION_HASH
foundation = json.loads(foundation_path.read_text())
hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == VERSION
info = next(row for row in hot['abInfos'] if row['name'] == BUNDLE)
raw = (C / 'map-source/ab' / BUNDLE).read_bytes()
assert len(raw) == info['abSize'] and hashlib.md5(raw).hexdigest() == info['md5']
objects = {obj.path_id: obj for obj in UnityPy.load(raw).objects}
binding = foundation['officialTokenSkeletonBindings'][TOKEN]
common = {key: int(binding[key]) for key in ['rootPathId', 'controllerPathId', 'animatorPathId', 'faceSwitcherPathId']}
root = objects[common['rootPathId']].read_typetree()
assert root['m_Name'] == TOKEN and common['controllerPathId'] in [ptr(c['component']) for c in root['m_Component']]
controller = objects[common['controllerPathId']].read_typetree()
assert ptr(controller['m_GameObject']) == common['rootPathId']
assert ptr(controller['_animator']) == common['animatorPathId']
animator = objects[common['animatorPathId']].read_typetree()
assert animator['_animations'] == binding['animationAliases']
assert ptr(animator['_faceSwitcher']) == common['faceSwitcherPathId']
avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
    'show', f'{COMMIT}:avatar/ASSISTANT/{TOKEN}.png'])
faces = {}
for face, record in binding['facings'].items():
    ids = {**common, **{key: int(value) for key, value in record.items() if key.endswith('PathId')}}
    assert ptr(animator['_' + face.lower()]['skeleton']) == ids['skeletonAnimationPathId']
    skeleton = objects[ids['skeletonAnimationPathId']].read_typetree()
    assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
    assert ptr(skeleton['skeletonDataAsset']) == ids['skeletonDataAssetPathId']
    asset = objects[ids['skeletonDataAssetPathId']].read_typetree()
    assert ptr(asset['skeletonJSON']) == ids['textAssetPathId'] and len(asset['atlasAssets']) == 1
    assert ptr(asset['atlasAssets'][0]) == ids['atlasAssetPathId']
    atlas = objects[ids['atlasAssetPathId']].read_typetree()
    assert ptr(atlas['atlasFile']) == ids['atlasTextAssetPathId'] and len(atlas['materials']) == 1
    ids['materialPathId'] = ptr(atlas['materials'][0])
    props = objects[ids['materialPathId']].read_typetree()['m_SavedProperties']
    textures, floats = dict(props['m_TexEnvs']), dict(props['m_Floats'])
    assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
    assert textures['_AlphaTex']['m_Texture'] == {'m_FileID': 0, 'm_PathID': 0}
    ids['rgbTexturePathId'] = ptr(textures['_MainTex']['m_Texture'])
    original_image = objects[ids['rgbTexturePathId']].read().image.convert('RGBA')
    assert original_image.size == (428, 428)
    image = Image.new('RGBA', original_image.size)
    image.putdata([(min(r, a), min(g, a), min(b, a), a) for r, g, b, a in original_image.getdata()])
    skel, atlas_raw = script(objects[ids['textAssetPathId']]), script(objects[ids['atlasTextAssetPathId']])
    assert sha(skel) == record['sha256'] and len(skel) == record['byteLength']
    assert sha(atlas_raw) == record['atlasSha256'] and len(atlas_raw) == record['atlasByteLength']
    sn = objects[ids['textAssetPathId']].read().m_Name
    an = objects[ids['atlasTextAssetPathId']].read().m_Name
    page = next(line.strip() for line in atlas_raw.decode().splitlines() if line.strip())
    assert sn.endswith('.skel') and an.endswith('.atlas') and page.endswith('.png')
    assert all(Path(name).name == name for name in [sn, an, page])
    directory = OUT / TOKEN / face.lower()
    directory.mkdir(parents=True, exist_ok=True)
    (directory / sn).write_bytes(skel)
    (directory / an).write_text(normalize_atlas(atlas_raw.decode(), {page: image.size}))
    image.save(directory / page)
    (directory / 'avatar.png').write_bytes(avatar)
    parsed = parse(directory / sn, directory / an)
    assert parsed['missingRegions'] == [] and parsed['version'] == '3.8.99'
    for key in ['durations', 'hits', 'eventPayloads']:
        assert parsed[key] == foundation['tokenModels'][TOKEN][face][key]
    gaps = [a['animName'] for a in animator['_animations'] if not a['ignoreMissing'] and a['animName'] not in parsed['durations']]
    assert gaps == foundation['tokenModels'][TOKEN][face]['missingRequiredAliases']
    faces[face.lower()] = {
        'directory': f'{TOKEN}/{face.lower()}',
        'files': {name: {'bytes': (directory / name).stat().st_size, 'sha256': sha((directory / name).read_bytes())}
                  for name in [sn, an, page, 'avatar.png']},
        'textureDimensions': list(image.size), 'originalPathIds': {key: str(value) for key, value in ids.items()},
        'materialFloats': floats, 'nativeAnimationBindings': animator['_animations'],
        'nativeAnimationAliases': {a['animKey']: a['animName'] for a in animator['_animations']},
        'missingRequiredAliases': gaps, 'spineVersion': parsed['version'],
        **{key: parsed[key] for key in ['durations', 'hits', 'eventPayloads', 'bounds']},
        # Public role defaults describe the ordinary form; the source controller
        # explicitly selects dragon and skill clips on this same skeleton.
        'animationRoles': {'idle': 'Idle_2', 'deploy': 'Start_2', 'attack': 'Attack_2',
                           'die': 'Die_2' if 'Die_2' in parsed['durations'] else None, 'skill': None},
    }
    print(TOKEN, face, image.size, 'missing required aliases:', gaps, flush=True)

metadata = {
    'sourceBundle': {'path': BUNDLE, 'bytes': len(raw), 'md5': info['md5'], 'sha256': sha(raw),
        'resourceVersion': VERSION,
        'url': f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
        'transforms': TRANSFORMS},
    'avatarSource': {'repository': 'fexli/ArknightsResource', 'commit': COMMIT, 'directory': 'avatar/ASSISTANT'},
    'foundation': {'path': 'data/arkpedia-necrass-prefabs.json', 'sha256': FOUNDATION_HASH},
    'models': {TOKEN: {'facings': faces}},
}
(OUT / 'sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
(ROOT / 'data/arkpedia-necrass-device-art.json').write_text(json.dumps({
    'schemaVersion': 1, 'owner': 'char_450_necras', 'artworkOnly': True, 'enabledOperators': [],
    'frameParity': False, 'nativeParticleSupport': False, 'nativeShaderParity': False, **metadata,
}, indent=2) + '\n')
