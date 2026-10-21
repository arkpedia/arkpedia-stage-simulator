#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the original serialized content of the enemy ability components that
reviewed enemy features read (shared/arkpedia/enemy-features.js).

Each component is located through the verified timing index
(data/arkpedia-enemy-clock-source.json) and kept as the exact canonical JSON whose
sha256 the index already records as originalDataSha256, so the content is tied to
the pinned CN bundles without re-trusting this script.

  python tools/arkpedia/extract-enemy-native-abilities.py [--check]
"""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

C = ROOT / '.cache/arkpedia/cn-native-source'
OUT = ROOT / 'data/arkpedia-enemy-native-abilities.json'
index_raw = (ROOT / 'data/arkpedia-enemy-clock-source.json').read_bytes()
index = json.loads(index_raw)
source = json.loads((ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes())
bundles = {r['path']: r for r in source['bundles']}
# Component object names whose content a reviewed feature reads.
OBJECTS = ['DefDown']


def exact(v, key=''):
    if isinstance(v, dict): return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [exact(x, key) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v


def canonical(v):
    return json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


wanted = {}
for path, p in index['prefabs'].items():
    for c in p['clockComponents']:
        if c['objectName'] in OBJECTS: wanted.setdefault(p['bundle'], []).append((path, c))
loaded = {}
components = {}
for bundle in sorted(wanted):
    row = bundles[bundle]
    raw = (C / 'bundles' / bundle).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256']
    by = {o.path_id: o for o in UnityPy.load(raw).objects}
    for path, c in wanted[bundle]:
        text = canonical(exact(by[int(c['pathId'])].read_typetree()))
        assert hashlib.sha256(text.encode()).hexdigest() == c['originalDataSha256'], (path, c['pathId'])
        components.setdefault(path, []).append({'pathId': c['pathId'], 'objectName': c['objectName'], 'originalJson': text})
result = {'schemaVersion': 1,
    'scope': 'Original serialized content of the enemy ability components reviewed enemy features read. Each originalJson hashes to the originalDataSha256 the native timing index records for that component.',
    'source': {'nativeTimingIndex': 'data/arkpedia-enemy-clock-source.json',
               'sha256': hashlib.sha256(index_raw).hexdigest()},
    'objects': OBJECTS,
    'prefabs': {k: sorted(v, key=lambda r: int(r['pathId'])) for k, v in sorted(components.items())}}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    if OUT.read_text() != text: sys.exit('Enemy native ability evidence is stale')
    print('Enemy native ability evidence matches the pinned bundles')
else:
    OUT.write_text(text)
    print('Wrote', sum(len(v) for v in components.values()), 'components from', len(components), 'prefabs')
