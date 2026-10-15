#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Preserve the frozen CN CheckCost flags needed by Closure's debt allowance."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

C = ROOT / '.cache/arkpedia/cn-native-source'
hot_raw = (C / 'hot_update_list.json').read_bytes()
assert len(hot_raw) == 3241788
assert hashlib.sha256(hot_raw).hexdigest() == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
hot = json.loads(hot_raw)
version, path = '26-09-22-07-47-20_6c71fa', 'config/buff_template_holder.ab'
assert hot['versionId'] == version
entry = next(r for r in hot['abInfos'] if r['name'] == path)
raw = (C / 'bundles' / path).read_bytes()
assert len(raw) == entry['abSize'] == 1963907
assert hashlib.md5(raw).hexdigest() == entry['md5'] == '8d395a42a34fbbb5af1f2e4ad7d39ef8'
digest = hashlib.sha256(raw).hexdigest()
assert digest == '30bacb35c8962817931d8fd2cad66cd5a4455b86f6f34e21257829ff7f0fd0a3'
objects = {o.path_id: o for o in UnityPy.load(raw).objects}
container = 'dyn/config/buff_template_holder.asset'
refs = [fields['asset'] for o in objects.values() if o.type.name == 'AssetBundle'
        for name, fields in o.read_typetree()['m_Container'] if name == container]
assert len(refs) == 1 and refs[0]['m_FileID'] == 0
root_id = refs[0]['m_PathID']
holder = objects[root_id].read_typetree()

def checks(value, location=''):
    if isinstance(value, dict):
        if value.get('$type', '').split(',')[0] == 'Torappu.Battle.Action.Nodes+CheckCost':
            yield {'location': location, 'node': value}
        for k, v in value.items():
            if k == 'SerializedState' and isinstance(v, str):
                yield from checks(json.loads(v), location + '.' + k)
            else:
                yield from checks(v, location + '.' + k)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            yield from checks(v, location + f'[{i}]')

inventory = {}
for template in holder['_templates']:
    found = list(checks(template))
    if found:
        key = template['templateKey']
        assert key not in inventory
        inventory[key] = found
selected = ['strong_tr', 'nothin_tr', 'lmlee_tr', 'swire2_tr', 'swire2_t_2', 'talr_tr']
templates = {k: next(t for t in holder['_templates'] if t['templateKey'] == k) for k in selected}
receipt = {'schemaVersion': 1, 'scope': 'Selected unmoduled merchant debt checks; no playable Closure approval or compiled frame parity.',
    'enabledOperators': [], 'frameParity': False, 'moduleSupport': False,
    'source': {'client': 'cn', 'resourceVersion': version, 'manifestSha256': hashlib.sha256(hot_raw).hexdigest(),
        'bundle': {'path': path, 'bytes': len(raw), 'md5': entry['md5'], 'sha256': digest,
            'url': f'https://ak.hycdn.cn/assetbundle/official/Android/assets/{version}/config_buff_template_holder.dat'},
        'container': container, 'pathId': str(root_id)},
    'checkCostInventory': inventory, 'selectedOriginalTemplates': templates}
target = ROOT / 'data/arkpedia-closur-dp-consumers.json'
target.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n')
print(f'Preserved {len(inventory)} native CheckCost templates and {len(templates)} selected original graphs')
