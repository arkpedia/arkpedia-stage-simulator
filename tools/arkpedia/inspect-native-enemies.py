#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Inspect explicit enemy prefabs with exact int64 references and bundle proofs.
Inspection never registers an enemy or grants simulator admission.
"""
import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
from prefab_evidence import read_prefabs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enemies', nargs='+', required=True)
    parser.add_argument('--out', required=True)
    options = parser.parse_args()
    if len(set(options.enemies)) != len(options.enemies) or any(not re.fullmatch(r'enemy_\w+', key) for key in options.enemies):
        parser.error('Expected unique explicit enemy keys')
    records = json.loads((ROOT / 'data/arkpedia-enemy-records.json').read_bytes())['enemies']
    index = json.loads((ROOT / 'data/arkpedia-enemy-clock-source.json').read_bytes())['prefabs']
    source = json.loads((ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes())
    bundles = {row['path']: row for row in source['bundles']}
    grouped, requested = {}, []
    for key in options.enemies:
        prefab = records[key]['levels']['0']['prefabKey']
        row = index[f'dyn/battle/prefabs/enemies/{prefab}.prefab']
        grouped.setdefault(row['bundle'], set()).add(prefab)
        requested.append({'enemy': key, 'prefab': prefab})
    receipts, prefabs = [], {}
    for bundle, keys in sorted(grouped.items()):
        pin = bundles[bundle]
        manifest = {'abInfos': [{'name': bundle, 'abSize': pin['bytes'], 'md5': pin['md5']}]}
        values, receipt = read_prefabs(ROOT / '.cache/arkpedia/cn-native-source', manifest, bundle, 'enemies',
            sorted(keys), uncensored=False, component_types=('MonoBehaviour', 'Transform', 'CircleCollider2D', 'BoxCollider2D'))
        if receipt['sha256'] != pin['sha256']:
            raise ValueError(f'Enemy bundle SHA-256 mismatch: {bundle}')
        prefabs.update(values)
        receipts.append(receipt)
    output = Path(options.out).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schemaVersion': 1, 'scope': 'Inspection only; no admission or compiled-method proof.',
        'requested': requested, 'bundles': receipts, 'prefabs': prefabs}, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'prefabs': len(prefabs), 'bundles': len(receipts),
        'components': sum(len(p['components']) for p in prefabs.values()), 'out': str(output)}))


if __name__ == '__main__':
    main()
