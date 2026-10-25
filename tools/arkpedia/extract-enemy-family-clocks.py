#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain prefab-bound original skeleton bytes for mechanical event clocks only."""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family', required=True)
parser.add_argument('--bundle', required=True)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[a-z][a-z0-9-]*', args.family) or not re.fullmatch(r'refs/arts/enm_art_\d+\.ab', args.bundle):
    parser.error('Expected a plain family identifier and one native enemy art bundle')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def exact(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else exact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def canonical(value):
    return json.dumps(exact(value), ensure_ascii=False, sort_keys=True, separators=(',', ':'))


cache = ROOT / '.cache/arkpedia/cn-native-source'
inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_raw)
manifest_raw = (cache / 'hot_update_list.json').read_bytes()
assert sha(manifest_raw) == inventory['source']['manifestSha256']
row = next(b for b in json.loads(manifest_raw)['abInfos'] if b['name'] == args.bundle)
raw = (cache / 'bundles' / args.bundle).read_bytes()
assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
env = UnityPy.load(raw)
objects = {o.path_id: o for o in env.objects}
graph_path = 'data/candidates/arkpedia-' + args.family + '-source.json'
graph_raw = (ROOT / graph_path).read_bytes()
graph = json.loads(graph_raw)
assert graph['source']['sha256'] == sha(inventory_raw)
index = json.loads((ROOT / 'data/arkpedia-enemy-clock-source.json').read_bytes())
result = {'schemaVersion': 1, 'scope': 'Original prefab-bound skeleton/event clock source only; no visual import or behavior/admission approval.',
    'source': {'inventory': {'path': 'data/arkpedia-cn-native-source.json', 'sha256': sha(inventory_raw)},
        'graph': {'path': graph_path, 'sha256': sha(graph_raw)},
        'bundle': {'path': args.bundle, 'bytes': len(raw), 'md5': row['md5'], 'sha256': sha(raw), 'manifestSha256': sha(manifest_raw)}},
    'enemies': {}}
prefab_files = {}
for name, rows in graph['prefabs'].items():
    key = name.split('/')[-1].removesuffix('.prefab')
    bindings = [json.loads(r['originalJson'])['skeletonDataAsset'] for r in rows if 'skeletonDataAsset' in json.loads(r['originalJson'])]
    assert len(bindings) == 1, 'Multiple native owner skeleton bindings require separate review: ' + key
    binding = bindings[0]
    bundle = index['prefabs'][name]['bundle']
    if bundle not in prefab_files:
        data = (cache / 'bundles' / bundle).read_bytes()
        pin = next(p for p in graph['source']['bundles'] if p['path'] == bundle)
        assert sha(data) == pin['sha256']
        prefab_env = UnityPy.load(data)
        assert len(prefab_env.assets) == 1
        prefab_files[bundle] = prefab_env.assets[0]
    sda = objects[int(binding['m_PathID'])]
    assert binding['m_FileID'] > 0
    assert prefab_files[bundle].externals[binding['m_FileID'] - 1].path.endswith('/' + sda.assets_file.name)
    containers = sorted(p for p, obj in env.container.items() if obj.path_id == sda.path_id)
    assert containers
    tree = sda.read_typetree()
    skeleton = objects[int(tree['skeletonJSON']['m_PathID'])]
    text_asset = skeleton.read()
    content = text_asset.m_Script
    content = content.encode('utf8', errors='surrogateescape') if isinstance(content, str) else bytes(content)
    original = canonical(tree)
    result['enemies'][key] = {'containers': containers, 'prefabBinding': binding,
        'serializedFile': sda.assets_file.name, 'skeletonDataPathId': str(sda.path_id),
        'skeletonDataOriginalJson': original, 'skeletonDataSha256': sha(original.encode()),
        'skeletonTextPathId': str(skeleton.path_id), 'skeletonName': text_asset.m_Name,
        'bytes': len(content), 'sha256': sha(content), 'base64': base64.b64encode(content).decode()}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / ('data/candidates/arkpedia-' + args.family + '-animation-source.json')
if args.check:
    assert target.read_text(encoding='utf8') == text, 'Original bound event clock bytes changed'
else:
    target.write_text(text, encoding='utf8', newline='\n')
print('Verified', len(result['enemies']), 'original prefab-bound event clock sources for', args.family)
