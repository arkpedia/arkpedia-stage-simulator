#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the three native Hui-Ming tile prefabs and the Global buff templates
they name, from the checksum-pinned tile bundle. `--check` verifies the
committed file is reproducible. Retention is evidence, not stage admission."""
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

OUT = ROOT / 'data/arkpedia-hui-ming-tile-source.json'
BUNDLE = {'path': 'battle/prefabs/[uc]tiles.ab', 'bytes': 59712,
          'sha256': '5a913749bb207f004ac0d5f6050dc5b751e3abceb3bf834aea21ff663ff615f0'}
KEYS = ['tile_yinyang_road', 'tile_yinyang_wall', 'tile_yinyang_switch']
TEMPLATES = ['buff_yinyang[same]', 'buff_yinyang[diff]', 'buff_yinyang[log]', 'buff_yinyang_switch', 'buff_yin', 'buff_yang', 'empty']

def exact(value, key=''):
    if isinstance(value, dict): return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, list): return [exact(v, key) for v in value]
    if isinstance(value, float) and value.is_integer(): return int(value)
    return str(value) if key == 'm_PathID' else value

pin = json.loads((ROOT / 'data/arkpedia-cn-native-source.json').read_bytes())['source']
raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / BUNDLE['path']).read_bytes()
assert len(raw) == BUNDLE['bytes'] and hashlib.sha256(raw).hexdigest() == BUNDLE['sha256']
env = UnityPy.load(raw)
by = {o.path_id: o for o in env.objects}
prefabs = {}
for key in KEYS:
    asset = f'dyn/battle/prefabs/[uc]tiles/{key}.prefab'
    go = env.container[asset].read_typetree()
    assert go['m_Name'] == key
    components = []
    for ref in go['m_Component']:
        obj = by[ref['component']['m_PathID']]
        if obj.type.name == 'Transform':
            assert not obj.read_typetree()['m_Children'], 'Hui-Ming tile prefabs have no child objects'
        elif obj.type.name == 'MonoBehaviour':
            components.append({'pathId': str(obj.path_id), 'data': exact(obj.read_typetree())})
    assert len(components) == 1
    prefabs[key] = {'asset': asset, 'components': components}
templates_raw = (ROOT / '.cache/arkpedia/buff_template_data.json').read_bytes()
template_pin = json.loads((ROOT / 'data/arkpedia-mvp.json').read_bytes())['behaviors']['source']
assert hashlib.sha256(templates_raw).hexdigest() == template_pin['sha256']
all_templates = json.loads(templates_raw)
result = {'schemaVersion': 1,
          'scope': 'Retained native Hui-Ming tile prefabs (pinned CN client) and the pinned Global buff templates they name. Evidence only; stage admission is decided by the stage compiler.',
          'source': {'repository': pin['repository'], 'commit': pin['commit'], 'clientVersion': pin['clientVersion'], 'resourceVersion': pin['resourceVersion']},
          'bundle': BUNDLE, 'templateSource': template_pin,
          'prefabs': prefabs, 'templates': {k: all_templates[k] for k in TEMPLATES}}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    assert OUT.read_text() == text, 'Hui-Ming tile source differs from the pinned bundle'
    print('Hui-Ming tile source matches the pinned bundle')
else:
    OUT.write_text(text)
    print(f'Wrote {len(prefabs)} tile prefabs and {len(TEMPLATES)} templates')
