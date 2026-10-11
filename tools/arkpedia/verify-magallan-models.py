#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently audit Magallan's default drone pointer chains and artwork.

No extractor helpers imported. --metadata accepts altered fixtures;
--delivered checks both published SD aliases and their exact file bytes.
"""
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
OUT = C / 'magallan-source/drone-art'
metadata = Path(sys.argv[sys.argv.index('--metadata') + 1]) if '--metadata' in sys.argv else OUT / 'sources.json'
m = json.loads(metadata.read_text())
foundation_raw = (ROOT / 'data/arkpedia-magallan-prefabs.json').read_bytes()
foundation_sha = 'f07014ea063f905a2358371f4a5449b02963b4326fbf92af4c4fe7e24b5799f8'
assert hashlib.sha256(foundation_raw).hexdigest() == foundation_sha
foundation = json.loads(foundation_raw)
assert m['foundation'] == {'path': 'data/arkpedia-magallan-prefabs.json', 'sha256': foundation_sha}
assert set(m['models']) == {'token_10005_mgllan_drone' + str(n) for n in range(1, 4)}
assert m['sourceBundle']['path'] == 'pkgrps/btl_pfb_tokens_0.ab'
assert m['sourceBundle']['resourceVersion'] == '26-09-23-17-49-43_b9cc4a'
assert m['avatarSource'] == {'repository': 'fexli/ArknightsResource',
    'commit': 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd', 'directory': 'avatar/ASSISTANT'}
hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == m['sourceBundle']['resourceVersion']
original = next(i for i in hot['abInfos'] if i['name'] == m['sourceBundle']['path'])
assert original['abSize'] == m['sourceBundle']['bytes'] and original['md5'] == m['sourceBundle']['md5']
raw = (C / 'map-source/ab' / m['sourceBundle']['path']).read_bytes()
assert len(raw) == original['abSize'] and hashlib.md5(raw).hexdigest() == original['md5']
assert hashlib.sha256(raw).hexdigest() == m['sourceBundle']['sha256']
objects = {o.path_id: o for o in UnityPy.load(raw).objects}
# Material/texture identities were independently read from the native bundle.
materials = [('-1133531210983741310', '-562959550119812498', '-9112049303499132683'),
    ('7559940055076177480', '-3938847152795514094', '5274213136120217236'),
    ('-4739457242541426281', '-8643012407382366551', '-5804471832254354054')]


def exact(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else exact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v) for v in value]
    return value


for n, (material, rgb_id, alpha_id) in enumerate(materials, 1):
    token = 'token_10005_mgllan_drone' + str(n)
    r = m['models'][token]
    binding = foundation['officialTokenSkeletonBindings'][token]
    expected_ids = {k: v for k, v in binding.items() if k.endswith('PathId')}
    expected_ids.update(materialPathId=material, rgbTexturePathId=rgb_id, alphaTexturePathId=alpha_id)
    assert r['originalPathIds'] == expected_ids
    assert r['directory'] == token
    d = metadata.parent / token

    def obj(key):
        return objects[int(expected_ids[key])]

    def tree(key):
        return obj(key).read_typetree()

    def ptr(value, key):
        assert value['m_FileID'] == 0 and value['m_PathID'] == int(expected_ids[key]), key

    def text(key):
        s = obj(key).read().m_Script
        return s.encode('utf8', 'surrogateescape') if isinstance(s, str) else bytes(s)

    root = tree('rootPathId')
    assert root['m_Name'] == token
    assert {'m_FileID': 0, 'm_PathID': int(expected_ids['controllerPathId'])} in [c['component'] for c in root['m_Component']]
    controller = tree('controllerPathId')
    ptr(controller['m_GameObject'], 'rootPathId')
    ptr(controller['_animator'], 'animatorPathId')
    animator = tree('animatorPathId')
    ptr(animator['_skeleton'], 'skeletonAnimationPathId')
    ptr(animator['_faceSwitcher'], 'faceSwitcherPathId')
    assert exact(tree('faceSwitcherPathId')) == binding['faceSwitcher']
    aliases = {a['animKey']: a['animName'] for a in animator['_animations']}
    assert animator['_animations'] == r['nativeAnimationBindings'] == binding['animationAliases']
    assert aliases == r['nativeAnimationAliases']
    assert aliases['Die'] == 'Idle' and aliases.get('Attack') == (None if n == 1 else 'Attack')
    skeleton = tree('skeletonAnimationPathId')
    assert skeleton['initialSkinName'] == 'default' and skeleton['pmaVertexColors'] == 1
    ptr(skeleton['skeletonDataAsset'], 'skeletonDataAssetPathId')
    asset = tree('skeletonDataAssetPathId')
    ptr(asset['skeletonJSON'], 'textAssetPathId')
    assert len(asset['atlasAssets']) == 1
    ptr(asset['atlasAssets'][0], 'atlasAssetPathId')
    atlas = tree('atlasAssetPathId')
    ptr(atlas['atlasFile'], 'atlasTextAssetPathId')
    assert len(atlas['materials']) == 1
    ptr(atlas['materials'][0], 'materialPathId')
    props = tree('materialPathId')['m_SavedProperties']
    floats, textures = dict(props['m_Floats']), dict(props['m_TexEnvs'])
    assert floats == r['materialFloats'] and floats['_UseAlphaTex'] == 1
    ptr(textures['_MainTex']['m_Texture'], 'rgbTexturePathId')
    ptr(textures['_AlphaTex']['m_Texture'], 'alphaTexturePathId')
    assert obj('textAssetPathId').read().m_Name == token + '.skel'
    assert obj('atlasTextAssetPathId').read().m_Name == token + '.atlas'
    assert (d / (token + '.skel')).read_bytes() == text('textAssetPathId')
    rgb = obj('rgbTexturePathId').read().image.convert('RGB')
    alpha = obj('alphaTexturePathId').read().image.convert('L')
    png = Image.open(d / (token + '.png')).convert('RGBA')
    assert rgb.size == alpha.size == png.size == (128, 128)
    assert r['textureDimensions'] == [128, 128]
    # Independent per-pixel reconstruction of split-alpha compression-bleed clamp.
    expected_pixels = bytes(channel for color, a in zip(rgb.get_flattened_data(), alpha.get_flattened_data())
        for channel in (*[min(c, a) for c in color], a))
    assert png.tobytes() == expected_pixels
    # Preserve all original region lines, normalizing only the page header.
    lines = text('atlasTextAssetPathId').decode().replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff').split('\n')
    start = next(i for i, line in enumerate(lines) if line)
    assert lines[start] == token + '.png'
    i = start + 1
    while i < len(lines) and lines[i] and ':' in lines[i] and not lines[i][0].isspace():
        i += 1
    fields = lines[start + 1:i]
    fields = ['size: 128,128' if line.startswith('size:') else line for line in fields]
    if not any(line.startswith('size:') for line in fields):
        fields.insert(0, 'size: 128,128')
    if not any(line.startswith('pma:') for line in fields):
        fields.append('pma: true')
    assert (d / (token + '.atlas')).read_text() == '\n'.join([*lines[:start + 1], *fields, *lines[i:]])
    avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
        'show', f"{m['avatarSource']['commit']}:avatar/ASSISTANT/{token}.png"])
    assert avatar == (d / 'avatar.png').read_bytes()
    assert set(r['files']) == {token + '.skel', token + '.atlas', token + '.png', 'avatar.png'}
    for name, record in r['files'].items():
        data = (d / name).read_bytes()
        assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256']
    parsed = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import {readFile} from 'node:fs/promises';import {parseSkel} from './tools/assets/skel.mjs';import {atlasInfo} from './tools/assets/atlas.mjs';const d=process.argv[1],id=process.argv[2];console.log(JSON.stringify(parseSkel(await readFile(d+'/'+id+'.skel'),atlasInfo(await readFile(d+'/'+id+'.atlas','utf8')).regions,{includeEventPayloads:true})));",
        str(d), token], cwd=ROOT))
    assert parsed['missingRegions'] == [] and parsed['version'] == r['spineVersion'] == '3.8.99'
    for key in ['durations', 'hits', 'eventPayloads', 'bounds']:
        assert parsed[key] == r[key], key
        if key != 'bounds':
            assert parsed[key] == foundation['tokenModels'][token][key]
    assert r['animationRoles'] == {'idle': 'Idle', 'deploy': 'Start', 'die': 'Idle',
        'attack': None if n == 1 else 'Attack', 'skill': None}
    if '--delivered' in sys.argv:
        assets = ROOT.parent / 'arkpedia-sd-assets'
        manifest = json.loads((assets / 'manifest.json').read_text())
        for facing in ['front', 'back']:
            a = manifest['models'][f'operator/{token}/default/{facing}']
            assert a['source']['facingAlias'] == 'single-original-model'
            assert a['source']['originalPathIds'] == expected_ids and a['source']['bundle'] == m['sourceBundle']
            assert a['premultipliedAlpha'] is True and a['spineVersion'] == r['spineVersion']
            assert a['animations'] == r['durations'] and a['animationRoles'] == r['animationRoles']
            assert a['hits'] == r['hits'] and a['bounds'] == r['bounds']
            assert a['avatar']['source'] == m['avatarSource']
            for file in [a['skeleton'], a['atlas'], *a['textures'], a['avatar']]:
                data = (assets / file['path']).read_bytes()
                assert data == (d / Path(file['path']).name).read_bytes()
                assert len(data) == file['bytes'] and hashlib.sha256(data).hexdigest() == file['sha256']
    print('Verified native default', token, 'pointer chain, split-alpha pixels, aliases and events')

receipt = json.loads((ROOT / 'data/arkpedia-magallan-drone-art.json').read_text())
assert receipt == {'schemaVersion': 1, 'owner': 'char_248_mgllan', 'artworkOnly': True, 'enabledOperators': [],
    'frameParity': False, 'nativeParticleSupport': False, 'nativeShaderParity': False, **m}
print('Verified all three default drone models and artwork-only receipt')
