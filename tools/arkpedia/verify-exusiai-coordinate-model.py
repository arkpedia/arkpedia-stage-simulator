#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently audit native Coordinates pointers, pixels, regions and clips.

--metadata selects a disposable extracted fixture. --delivered also checks both
SD manifest aliases. The verifier does not import the extraction helpers.
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
OUT = C / 'exusiai-covenant-source/coordinates-art'
ID = 'token_10056_angel2_target'
metadata = Path(sys.argv[sys.argv.index('--metadata') + 1]) if '--metadata' in sys.argv else OUT / 'sources.json'
m = json.loads(metadata.read_text())
assert set(m['models']) == {ID}
r = m['models'][ID]
d = metadata.parent / r['directory']
assert r['directory'] == 'original'
assert m['sourceBundle']['path'] == 'pkgrps/btl_pfb_tokens_0.ab'
assert m['sourceBundle']['resourceVersion'] == '26-09-23-17-49-43_b9cc4a'
assert m['avatarSource'] == {'repository': 'fexli/ArknightsResource',
    'commit': 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd', 'directory': 'avatar/ASSISTANT'}
hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == m['sourceBundle']['resourceVersion']
original = next(i for i in hot['abInfos'] if i['name'] == m['sourceBundle']['path'])
assert original['abSize'] == m['sourceBundle']['bytes'] and original['md5'] == m['sourceBundle']['md5']
raw = (C / 'map-source/ab' / m['sourceBundle']['path']).read_bytes()
assert len(raw) == m['sourceBundle']['bytes']
assert hashlib.sha256(raw).hexdigest() == m['sourceBundle']['sha256']
assert hashlib.md5(raw).hexdigest() == original['md5']
objects = {o.path_id: o for o in UnityPy.load(raw).objects}


def obj(key):
    return objects[int(r['originalPathIds'][key])]


def tree(key):
    return obj(key).read_typetree()


def ptr(value, key):
    assert value['m_FileID'] == 0 and value['m_PathID'] == int(r['originalPathIds'][key]), key


def text(key):
    s = obj(key).read().m_Script
    return s.encode('utf8', 'surrogateescape') if isinstance(s, str) else bytes(s)


assert int(r['originalPathIds']['rootPathId']) == 5469880532721077243
root = tree('rootPathId')
assert root['m_GameObject']['m_FileID'] == 0
assert objects[root['m_GameObject']['m_PathID']].read_typetree()['m_Name'] == ID
ptr(root['_animator'], 'animatorPathId')
assert int(r['originalPathIds']['animatorPathId']) == -4645504156103930885
animator = tree('animatorPathId')
ptr(animator['_skeleton'], 'skeletonAnimationPathId')
ptr(animator['_faceSwitcher'], 'faceSwitcherPathId')
aliases = {a['animKey']: a['animName'] for a in animator['_animations']}
assert aliases == r['nativeAnimationAliases'] == {'Default': 'Default', 'Born': 'Start', 'Die': 'Die', 'Idle': 'Idle'}
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
assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
assert textures['_AlphaTex']['m_Texture']['m_PathID'] == 0
ptr(textures['_MainTex']['m_Texture'], 'rgbaTexturePathId')
assert obj('textAssetPathId').read().m_Name == ID + '.skel'
assert obj('atlasTextAssetPathId').read().m_Name == ID + '.atlas'
assert (d / (ID + '.skel')).read_bytes() == text('textAssetPathId')
rgba = obj('rgbaTexturePathId').read().image.convert('RGBA')
png = Image.open(d / (ID + '.png')).convert('RGBA')
assert list(png.size) == r['textureDimensions'] == list(rgba.size)
assert png.tobytes() == rgba.tobytes()
# Preserve every native region line. Only normalize line endings/page size/PMA.
lines = text('atlasTextAssetPathId').decode().replace('\r\n', '\n').replace('\r', '\n').lstrip('\ufeff').split('\n')
start = next(i for i, line in enumerate(lines) if line)
assert lines[start] == ID + '.png'
i = start + 1
while i < len(lines) and lines[i] and ':' in lines[i] and not lines[i][0].isspace():
    i += 1
fields = lines[start + 1:i]
size = f'size: {png.width},{png.height}'
fields = [size if line.startswith('size:') else line for line in fields]
if not any(line.startswith('size:') for line in fields):
    fields.insert(0, size)
if not any(line.startswith('pma:') for line in fields):
    fields.append('pma: true')
assert (d / (ID + '.atlas')).read_text() == '\n'.join([*lines[:start + 1], *fields, *lines[i:]])
avatar = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
    'show', f"{m['avatarSource']['commit']}:avatar/ASSISTANT/{ID}.png"])
assert avatar == (d / 'avatar.png').read_bytes()
assert set(r['files']) == {ID + '.skel', ID + '.atlas', ID + '.png', 'avatar.png'}
for name, record in r['files'].items():
    data = (d / name).read_bytes()
    assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256']
parsed = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import {readFile} from 'node:fs/promises';import {parseSkel} from './tools/assets/skel.mjs';import {atlasInfo} from './tools/assets/atlas.mjs';const d=process.argv[1],id=process.argv[2];const atlas=await readFile(d+'/'+id+'.atlas','utf8');console.log(JSON.stringify(parseSkel(await readFile(d+'/'+id+'.skel'),atlasInfo(atlas).regions,{includeEventPayloads:true})));",
    str(d), ID], cwd=ROOT))
assert parsed['missingRegions'] == [] and parsed['version'] == r['spineVersion'] == '3.8.99'
for key in ['durations', 'hits', 'eventPayloads', 'bounds']:
    assert parsed[key] == r[key], key
assert r['animationRoles'] == {'idle': 'Idle', 'deploy': 'Start', 'die': 'Die', 'attack': None, 'skill': None}
assert r['hits'] == r['eventPayloads'] == {}
receipt = json.loads((ROOT / 'data/arkpedia-exusiai-covenant-coordinates-art.json').read_text())
assert receipt == {'schemaVersion': 1, 'token': ID, 'artworkOnly': True, 'enabledOperators': [],
    'frameParity': False, 'nativeParticleSupport': False, 'nativeShaderParity': False, **m}
if '--delivered' in sys.argv:
    assets = ROOT.parent / 'arkpedia-sd-assets'
    manifest = json.loads((assets / 'manifest.json').read_text())
    for facing in ['front', 'back']:
        a = manifest['models'][f'operator/{ID}/default/{facing}']
        assert a['source']['facingAlias'] == 'single-original-model'
        assert a['source']['originalPathIds'] == r['originalPathIds']
        assert a['source']['bundle'] == m['sourceBundle']
        assert a['premultipliedAlpha'] is True
        assert a['spineVersion'] == r['spineVersion']
        assert a['animations'] == r['durations'] and a['animationRoles'] == r['animationRoles']
        assert a['hits'] == r['hits'] and a['bounds'] == r['bounds']
        assert a['avatar']['source'] == m['avatarSource']
        for file in [a['skeleton'], a['atlas'], *a['textures'], a['avatar']]:
            data = (assets / file['path']).read_bytes()
            assert data == (d / Path(file['path']).name).read_bytes()
            assert len(data) == file['bytes'] and hashlib.sha256(data).hexdigest() == file['sha256']
print('Verified Coordinates native pointer chain, exact RGBA pixels, atlas regions, pinned avatar, clips and artwork-only receipt')
