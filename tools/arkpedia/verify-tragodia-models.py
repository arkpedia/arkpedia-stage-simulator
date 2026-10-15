#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify original Tragodia pointers, pixels, atlas regions and delivered art independently."""
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

C = ROOT / '.cache/arkpedia'
OUT = C / 'tragodia-source/device-art'
META = Path(sys.argv[sys.argv.index('--metadata') + 1]) if '--metadata' in sys.argv else OUT / 'sources.json'
m = json.loads(META.read_text())
TOKEN, OWNER = 'token_10054_phatm2_encdool', 'char_1042_phatm2'
FOUNDATION_HASH = '8cf0b20b348240ef7a18d04871fff8f2585d2ae5d128f98c438b6fd87868a14f'


def digest(raw): return hashlib.sha256(raw).hexdigest()


def pointer(value):
    assert value['m_FileID'] == 0 and value['m_PathID'] != 0
    return value['m_PathID']


def exact(value):
    if isinstance(value, dict): return {k: str(v) if k == 'm_PathID' else exact(v) for k, v in value.items()}
    if isinstance(value, list): return [exact(v) for v in value]
    return value


def script(obj):
    value = obj.read().m_Script
    return value.encode('utf8', 'surrogateescape') if isinstance(value, str) else bytes(value)


def parsed_model(skel, atlas):
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';"
        "import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel("
        "await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,"
        "{includeEventPayloads:true})));", str(skel), str(atlas)], cwd=ROOT))


foundation_raw = (ROOT / 'data/arkpedia-tragodia-prefabs.json').read_bytes()
assert digest(foundation_raw) == FOUNDATION_HASH
foundation = json.loads(foundation_raw)
assert m['foundation'] == {'path': 'data/arkpedia-tragodia-prefabs.json', 'sha256': FOUNDATION_HASH}
assert set(m['models']) == {TOKEN}
assert 'facings' not in m['models'][TOKEN]
source = m['sourceBundle']
assert source['path'] == 'pkgrps/btl_pfb_tokens_0.ab'
assert source['resourceVersion'] == '26-09-23-17-49-43_b9cc4a'
assert source['url'] == ('https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/'
    '26-09-23-17-49-43_b9cc4a/pkgrps_btl_pfb_tokens_0.dat')
assert source['transforms'] == [
    'Original embedded premultiplied RGBA texture decoded; RGB clamped to alpha to remove compression bleed',
    'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
    'Original Single skeleton retains literal Start/Loop/End; Front/Back entries explicitly alias it',
]
assert m['avatarSource'] == {'repository': 'fexli/ArknightsResource',
    'commit': 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd', 'directory': 'avatar/ASSISTANT'}
hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == source['resourceVersion']
info = next(r for r in hot['abInfos'] if r['name'] == source['path'])
raw = (C / 'map-source/ab' / info['name']).read_bytes()
assert len(raw) == info['abSize'] == source['bytes']
assert hashlib.md5(raw).hexdigest() == info['md5'] == source['md5']
assert digest(raw) == source['sha256']
objects = {o.path_id: o for o in UnityPy.load(raw).objects}
binding = foundation['officialTokenSkeletonBindings'][TOKEN]
common = {key: int(binding[key]) for key in ['rootPathId', 'controllerPathId', 'animatorPathId', 'faceSwitcherPathId']}
go = objects[common['rootPathId']].read_typetree()
assert go['m_Name'] == TOKEN
assert {'m_FileID': 0, 'm_PathID': common['controllerPathId']} in [c['component'] for c in go['m_Component']]
controller = objects[common['controllerPathId']].read_typetree()
assert pointer(controller['m_GameObject']) == common['rootPathId']
assert pointer(controller['_animator']) == common['animatorPathId']
animator = objects[common['animatorPathId']].read_typetree()
assert pointer(animator['_faceSwitcher']) == common['faceSwitcherPathId']
assert exact(objects[common['faceSwitcherPathId']].read_typetree()) == binding['faceSwitcher']
assert animator['_animations'] == binding['animationAliases']
assets = ROOT.parent / 'arkpedia-sd-assets'
manifest = json.loads((assets / 'manifest.json').read_text()) if '--delivered' in sys.argv else None
for face, r in {'single':m['models'][TOKEN]}.items():
    assert r['directory'] == f'{TOKEN}/{face}'
    directory = META.parent / r['directory']
    native = binding['facings'][face.title()]
    ids = {**common, **{key: int(value) for key, value in native.items() if key.endswith('PathId')}}
    assert pointer(animator['_skeleton']) == ids['skeletonAnimationPathId']
    skeleton = objects[ids['skeletonAnimationPathId']].read_typetree()
    assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
    assert pointer(skeleton['skeletonDataAsset']) == ids['skeletonDataAssetPathId']
    asset = objects[ids['skeletonDataAssetPathId']].read_typetree()
    assert pointer(asset['skeletonJSON']) == ids['textAssetPathId']
    assert len(asset['atlasAssets']) == 1 and pointer(asset['atlasAssets'][0]) == ids['atlasAssetPathId']
    atlas = objects[ids['atlasAssetPathId']].read_typetree()
    assert len(atlas['materials']) == 1 and pointer(atlas['atlasFile']) == ids['atlasTextAssetPathId']
    ids['materialPathId'] = pointer(atlas['materials'][0])
    props = objects[ids['materialPathId']].read_typetree()['m_SavedProperties']
    floats, textures = dict(props['m_Floats']), dict(props['m_TexEnvs'])
    assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0 and floats == r['materialFloats']
    assert textures['_AlphaTex']['m_Texture'] == {'m_FileID': 0, 'm_PathID': 0}
    ids['rgbTexturePathId'] = pointer(textures['_MainTex']['m_Texture'])
    assert r['originalPathIds'] == {key: str(value) for key, value in ids.items()}
    sn, an = [objects[ids[k]].read().m_Name for k in ['textAssetPathId', 'atlasTextAssetPathId']]
    skel, atlas_raw = [script(objects[ids[k]]) for k in ['textAssetPathId', 'atlasTextAssetPathId']]
    assert digest(skel) == native['sha256'] and len(skel) == native['byteLength']
    assert digest(atlas_raw) == native['atlasSha256'] and len(atlas_raw) == native['atlasByteLength']
    assert (directory / sn).read_bytes() == skel
    lines = atlas_raw.decode().replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff').split('\n')
    start = next(i for i, line in enumerate(lines) if line)
    page = lines[start]
    assert all(Path(name).name == name for name in [sn, an, page])
    original = objects[ids['rgbTexturePathId']].read().image.convert('RGBA')
    decoded = Image.open(directory / page)
    assert original.size == decoded.size == (116, 116) and r['textureDimensions'] == [116, 116]
    assert decoded.mode == 'RGBA'
    for actual, (red, green, blue, alpha) in zip(decoded.getdata(), original.getdata()):
        assert actual == (min(red, alpha), min(green, alpha), min(blue, alpha), alpha)
    # Rebuild only page headers independently; region text must be untouched.
    end = start + 1
    while end < len(lines) and lines[end] and ':' in lines[end] and not lines[end][0].isspace(): end += 1
    fields = ['size: 116,116' if line.startswith('size:') else line for line in lines[start + 1:end]]
    if not any(line.startswith('size:') for line in fields): fields.insert(0, 'size: 116,116')
    if not any(line.startswith('pma:') for line in fields): fields.append('pma: true')
    assert (directory / an).read_text() == '\n'.join([*lines[:start + 1], *fields, *lines[end:]])
    avatar = subprocess.check_output(['git', '-C', str(assets / '.cache/arknights-resource'), 'show',
        f"{m['avatarSource']['commit']}:avatar/ASSISTANT/{TOKEN}.png"])
    assert (directory / 'avatar.png').read_bytes() == avatar
    assert set(r['files']) == {sn, an, page, 'avatar.png'}
    for name, h in r['files'].items():
        file = (directory / name).read_bytes()
        assert len(file) == h['bytes'] and digest(file) == h['sha256']
    parsed = parsed_model(directory / sn, directory / an)
    assert parsed['missingRegions'] == [] and parsed['version'] == r['spineVersion'] == '3.8.99'
    for key in ['durations', 'hits', 'eventPayloads', 'bounds']: assert parsed[key] == r[key]
    for key in ['durations', 'hits', 'eventPayloads']: assert r[key] == foundation['tokenModels'][TOKEN][face.title()][key]
    aliases = {a['animKey']: a['animName'] for a in animator['_animations']}
    assert aliases == r['nativeAnimationAliases'] and animator['_animations'] == r['nativeAnimationBindings']
    missing = [a['animName'] for a in animator['_animations'] if not a['ignoreMissing'] and a['animName'] not in parsed['durations']]
    assert missing == r['missingRequiredAliases'] == []
    assert r['animationRoles'] == {'idle': 'Loop', 'deploy': 'Start', 'attack': None, 'die': None, 'skill': None}
    if manifest:
        for delivered_face in ['front','back']:
            delivered = manifest['models'][f'operator/{TOKEN}/default/{delivered_face}']
            assert delivered['source'] == {'key': 'global-client', 'kind': 'assetbundle', 'bundle': source,
                'directory': source['path'], 'extractedSkeleton': sn, 'originalPathIds': r['originalPathIds'],
                'transforms': source['transforms'], 'facingAlias': 'single-original-model'}
            assert delivered['premultipliedAlpha'] is True and delivered['spineVersion'] == r['spineVersion']
            assert delivered['animations'] == r['durations'] and delivered['animationRoles'] == r['animationRoles']
            assert delivered['hits'] == r['hits'] and delivered['bounds'] == r['bounds']
            assert delivered['avatar']['source'] == m['avatarSource']
            for f in [delivered['skeleton'], delivered['atlas'], *delivered['textures'], delivered['avatar']]:
                file = (assets / f['path']).read_bytes()
                assert file == (directory / Path(f['path']).name).read_bytes()
                assert len(file) == f['bytes'] and digest(file) == f['sha256']
    print('Verified lure', face, 'original pointers, pixels, regions, avatar and all clips', flush=True)

if '--metadata' not in sys.argv:
    receipt = json.loads((ROOT / 'data/arkpedia-tragodia-device-art.json').read_text())
    assert receipt == {'schemaVersion': 1, 'owner': OWNER, 'artworkOnly': True, 'enabledOperators': [],
        'frameParity': False, 'nativeParticleSupport': False, 'nativeShaderParity': False, **m}

if manifest:
    assert json.loads((assets / 'source-reviews/tragodia-lure.json').read_text()) == {
        'schemaVersion': 1, 'owner': OWNER, 'artworkOnly': True, 'enabledOperators': [],
        'frameParity': False, 'nativeParticleSupport': False, 'nativeShaderParity': False, **m}
    # Owner art was already delivered. Check complete pinned Git files, not names.
    for face in ['Front', 'Back']:
        delivered = manifest['models'][f'operator/{OWNER}/default/{face.lower()}']
        directory = f'spine/{OWNER}/{OWNER}/{face}'
        assert delivered['source'] == {'key': 'operators', 'repository': 'fexli/ArknightsResource',
            'commit': foundation['source']['modelCommit'], 'directory': directory}
        for f in [delivered['skeleton'], delivered['atlas'], *delivered['textures']]:
            file = (assets / f['path']).read_bytes()
            original = subprocess.check_output(['git', '-C', str(assets / '.cache/arknights-resource'),
                'show', f"{foundation['source']['modelCommit']}:{directory}/{Path(f['path']).name}"])
            assert original == file and len(file) == f['bytes'] and digest(file) == f['sha256']
        native = foundation['models'][OWNER][face]
        assert delivered['skeleton']['sha256'] == native['sha256'] and delivered['skeleton']['bytes'] == native['bytes']
        parsed = parsed_model(assets / delivered['skeleton']['path'], assets / delivered['atlas']['path'])
        assert parsed['missingRegions'] == []
        for key in ['durations', 'hits', 'eventPayloads']: assert parsed[key] == native[key]
        assert delivered['animations'] == native['durations'] and delivered['hits'] == native['hits']
        assert delivered['bounds'] == parsed['bounds']
        print('Verified owner', face, 'complete pinned files and native events', flush=True)
print('Verified original Tragodia artwork; public combat and shader parity remain separate', flush=True)
