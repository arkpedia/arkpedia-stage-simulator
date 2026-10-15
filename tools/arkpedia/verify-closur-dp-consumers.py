#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently verify the original CN merchant borrowing flags and inventory."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data/arkpedia-closur-dp-consumers.json'
r = json.loads(target.read_bytes())
assert set(r) == {'schemaVersion', 'scope', 'enabledOperators', 'frameParity', 'moduleSupport', 'source', 'checkCostInventory', 'selectedOriginalTemplates'}
assert r['schemaVersion'] == 1 and r['enabledOperators'] == [] and r['frameParity'] is False and r['moduleSupport'] is False
cache = ROOT / '.cache/arkpedia/cn-native-source'
manifest = (cache / 'hot_update_list.json').read_bytes()
manifest_sha = hashlib.sha256(manifest).hexdigest()
assert len(manifest) == 3241788 and manifest_sha == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
h = json.loads(manifest)
assert h['versionId'] == '26-09-22-07-47-20_6c71fa'
entry = next(x for x in h['abInfos'] if x['name'] == 'config/buff_template_holder.ab')
raw = (cache / 'bundles/config/buff_template_holder.ab').read_bytes()
assert len(raw) == entry['abSize'] == 1963907
assert hashlib.md5(raw).hexdigest() == entry['md5'] == '8d395a42a34fbbb5af1f2e4ad7d39ef8'
assert hashlib.sha256(raw).hexdigest() == '30bacb35c8962817931d8fd2cad66cd5a4455b86f6f34e21257829ff7f0fd0a3'
objects = list(UnityPy.load(raw).objects)
asset_bundles = [o for o in objects if o.type.name == 'AssetBundle']
assert len(asset_bundles) == 1
roots = [(name, v['asset']) for name, v in asset_bundles[0].read_typetree()['m_Container']
         if name == 'dyn/config/buff_template_holder.asset']
assert len(roots) == 1 and roots[0][1] == {'m_FileID': 0, 'm_PathID': 6070581171229484677}
holders = [o for o in objects if o.path_id == roots[0][1]['m_PathID']]
assert len(holders) == 1 and holders[0].type.name == 'MonoBehaviour'
templates = holders[0].read_typetree()['_templates']
assert len({t['templateKey'] for t in templates}) == len(templates)
assert r['source'] == {'client': 'cn', 'resourceVersion': h['versionId'], 'manifestSha256': manifest_sha,
    'bundle': {'path': entry['name'], 'bytes': len(raw), 'md5': entry['md5'], 'sha256': hashlib.sha256(raw).hexdigest(),
        'url': 'https://ak.hycdn.cn/assetbundle/official/Android/assets/26-09-22-07-47-20_6c71fa/config_buff_template_holder.dat'},
    'container': roots[0][0], 'pathId': str(holders[0].path_id)}
# Traverse independently using a queue, including original serialized action graphs.
inventory = {}
for t in templates:
    pending, found = [('', t)], []
    while pending:
        loc, v = pending.pop(0)
        if isinstance(v, dict):
            if v.get('$type', '').split(',')[0] == 'Torappu.Battle.Action.Nodes+CheckCost':
                found.append({'location': loc, 'node': v})
            pending.extend((loc + '.' + k, json.loads(x) if k == 'SerializedState' and isinstance(x, str) else x)
                           for k, x in v.items())
        elif isinstance(v, list):
            pending.extend((loc + f'[{i}]', x) for i, x in enumerate(v))
    if found:
        inventory[t['templateKey']] = sorted(found, key=lambda x: x['location'])
assert set(inventory) == set(r['checkCostInventory'])
assert all(v == sorted(r['checkCostInventory'][k], key=lambda x: x['location']) for k, v in inventory.items())
selected = {'strong_tr', 'nothin_tr', 'lmlee_tr', 'swire2_tr', 'swire2_t_2', 'talr_tr'}
assert set(r['selectedOriginalTemplates']) == selected
assert all(t == r['selectedOriginalTemplates'][t['templateKey']] for t in templates if t['templateKey'] in selected)
print(f'Verified all {len(inventory)} original CheckCost templates and six complete selected graphs; no public admission')
