#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Print the reviewed module prefabs of the checksum-pinned CN `[uc]equips.ab` as JSON (predefined-module-source.mjs)."""
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

path, size, sha256, keys = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4:]
raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
assert len(raw) == size and hashlib.sha256(raw).hexdigest() == sha256, 'Module bundle differs from its pin'
def exact(value, key=''):
    if isinstance(value, dict): return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, list): return [exact(v, key) for v in value]
    if isinstance(value, float) and value.is_integer(): return int(value)
    return str(value) if key == 'm_PathID' else value
env = UnityPy.load(raw)
by = {o.path_id: o for o in env.objects}
prefabs = {}
for key in keys:
    components = []
    def walk(go):
        data = go.read_typetree()
        for ref in data['m_Component']:
            obj = by[ref['component']['m_PathID']]
            value = obj.read_typetree()
            if obj.type.name == 'MonoBehaviour':
                components.append({'pathId': str(obj.path_id), 'object': data['m_Name'], 'data': exact(value)})
            elif obj.type.name == 'Transform':
                for child in value['m_Children']:
                    walk(by[by[child['m_PathID']].read_typetree()['m_GameObject']['m_PathID']])
    asset = f'dyn/battle/prefabs/[uc]equips/{key}.prefab'
    walk(env.container[asset])
    prefabs[key] = {'bundle': path, 'asset': asset, 'components': components}
json.dump(prefabs, sys.stdout, ensure_ascii=False)
