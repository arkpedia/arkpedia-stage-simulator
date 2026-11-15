#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain Gramophone skin bindings and native capture clip durations."""
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request
import zipfile
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

cache = ROOT / '.cache/arkpedia/cn-native-source'
raw = (cache / 'hot_update_list.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
manifest = json.loads(raw)
bundles = []
def load(path):
    row = next(r for r in manifest['abInfos'] if r['name'] == path)
    target = cache / 'bundles' / path
    if not target.exists():
        archive = path.replace('/', '_').replace('.ab', '.dat')
        url = 'https://ak.hycdn.cn/assetbundle/official/Android/assets/26-09-22-07-47-20_6c71fa/' + urllib.parse.quote(archive)
        with urllib.request.urlopen(url) as response:
            raw = zipfile.ZipFile(io.BytesIO(response.read())).read(path)
        assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    raw = target.read_bytes()
    assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
    bundles.append({'path': path, 'bytes': len(raw), 'md5': row['md5'], 'sha256': hashlib.sha256(raw).hexdigest()})
    return UnityPy.load(raw)

skin = load('battle/prefabs/skins/trap.ab')
model = load('arts/maps/common/meshes/s_mgcity_tower.ab')
by = {o.path_id: o for o in skin.objects}
animation = by[-687697140237622539].read_typetree()
hook = next(o.read_typetree() for o in skin.objects if o.type.name == 'MonoBehaviour'
            and o.read_typetree().get('_animation', {}).get('m_PathID') == -687697140237622539
            and '_animations' in o.read_typetree())
external = by[-687697140237622539].assets_file.externals[4].path.rsplit('/', 1)[-1]
assert external == next(iter(model.objects)).assets_file.name
clips = {o.path_id: o.read_typetree() for o in model.objects if o.type.name == 'AnimationClip'}
assert all(p['m_FileID'] == 5 and p['m_PathID'] in clips for p in animation['m_Animations'])
result = {}
for binding in hook['_animations']:
    path_id, clip = next((k, v) for k, v in clips.items() if v['m_Name'] == binding['animName'])
    muscle = clip['m_MuscleClip']
    result[binding['animKey']] = {'clip': clip['m_Name'], 'pathId': str(path_id), 'speed': binding['speed'],
        'duration': (muscle['m_StopTime'] - muscle['m_StartTime']) / binding['speed'],
        'sha256': hashlib.sha256(json.dumps(clip, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}
out = {'schemaVersion': 1, 'resourceVersion': manifest['versionId'], 'bundles': bundles,
       'skin': 'dyn/battle/prefabs/skins/trap/skin_tower_default.prefab', 'animations': result,
       'scope': 'Native default-skin capture clip clocks only; no rendering or compiled-client frame parity approval.'}
encoded = json.dumps(out, indent=1) + '\n'
target = ROOT / 'data/arkpedia-gramophone-animations.json'
if '--check' in sys.argv:
    assert target.read_text() == encoded, 'Gramophone animation evidence changed'
else:
    target.write_text(encoded)
print('Verified Gramophone capture animation bindings')
