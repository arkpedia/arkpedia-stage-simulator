#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain original static layer/query settings, never assume runtime overrides."""
from pathlib import Path
import hashlib
import json
import sys
import UnityPy

ROOT = Path(__file__).resolve().parents[2]
sha = lambda raw: hashlib.sha256(raw).hexdigest()
pin_path = 'data/arkpedia-global-windows-settings-source.json'
pin_raw = (ROOT / pin_path).read_bytes()
pin = json.loads(pin_raw)
native_raw = (ROOT / pin['nativeSource']['path']).read_bytes()
assert sha(native_raw) == pin['nativeSource']['sha256']
raw = (ROOT / '.cache/arkpedia/global-windows-client/globalgamemanagers').read_bytes()
assert len(raw) == pin['file']['bytes'] and sha(raw) == pin['file']['sha256']
env = UnityPy.load(raw)
objects = {}
for name, path_id in [('TagManager', 3), ('Physics2DSettings', 15)]:
    rows = [obj for obj in env.objects if obj.type.name == name]
    assert len(rows) == 1 and rows[0].path_id == path_id
    tree = rows[0].read_typetree()
    original = json.dumps(tree, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    objects[name] = {'pathId': str(path_id), 'type': name, 'originalJson': original,
                     'sha256': sha(original.encode('utf8'))}
layers = json.loads(objects['TagManager']['originalJson'])['layers']
assert len(layers) == 32
indices = {}
for name in ['ALLY', 'ENEMY', 'NEUTRAL', 'MAP', 'UI', 'TILE', 'DEATH_AREA', 'EFFECT',
             'ENEMY_COLLIDER', 'PROJECTILE', 'UI_RT_PS', 'COLLIDER']:
    assert layers.count(name) == 1
    indices[name] = layers.index(name)
assert {name: indices[name] for name in ['ALLY', 'ENEMY', 'NEUTRAL']} == {'ALLY': 10, 'ENEMY': 9, 'NEUTRAL': 28}
result = {'schemaVersion': 1, 'scope': 'Static original Unity settings; runtime overrides and CN/runtime/frame parity remain unverified.',
    'runtimeOverridesVerified': False, 'crossVersionParity': False, 'frameParity': False,
    'source': {'pin': pin_path, 'pinSha256': sha(pin_raw), 'file': pin['file']},
    'unityVersion': env.file.unity_version, 'objects': objects, 'layerIndices': indices}
out = ROOT / 'data/candidates/arkpedia-windows-physics-settings-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    assert out.read_text(encoding='utf8') == serialized, 'Static Unity settings evidence differs'
else:
    out.write_text(serialized, encoding='utf8', newline='\n')
print('Verified original 32-layer table and complete Physics2D settings; no runtime override parity')
