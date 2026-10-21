#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the original serialized content of the enemy ability components that
reviewed enemy features read (shared/arkpedia/enemy-features.js).

Each component is located through the verified timing index
(data/arkpedia-enemy-clock-source.json) and kept as the exact canonical JSON whose
sha256 the index already records as originalDataSha256, so the content is tied to
the pinned CN bundles without re-trusting this script. Same-prefab MonoBehaviours
those components reference (validators, selectors), which the index does not
hash, are kept from the same hash-verified bundles with their own sha256. Buff
templates the kept content names are copied from the pinned Global
buff_template_data (data/arkpedia-mvp.json behaviors.source).

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
OBJECTS = ['DefDown', 'enhance', 'Blink', 'enemy_1220_dzoms', 'enemy_1220_dzoms_2', 'enemy_1221_dzomg', 'enemy_1221_dzomg_2', 'dmg_res', 'buff_to_blocker']
templates_raw = (ROOT / '.cache/arkpedia/buff_template_data.json').read_bytes()
template_pin = json.loads((ROOT / 'data/arkpedia-mvp.json').read_bytes())['behaviors']['source']
assert hashlib.sha256(templates_raw).hexdigest() == template_pin['sha256']
TEMPLATES = json.loads(templates_raw)


def exact(v, key=''):
    if isinstance(v, dict): return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [exact(x, key) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v


def canonical(v):
    return json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':'))


def local_refs(v):
    if isinstance(v, dict):
        if set(v) == {'m_FileID', 'm_PathID'}:
            if v['m_FileID'] == 0 and str(v['m_PathID']) != '0': yield str(v['m_PathID'])
            return
        for k, x in v.items():
            if k not in ('m_GameObject', 'm_Script'): yield from local_refs(x)
    elif isinstance(v, list):
        for x in v: yield from local_refs(x)


def template_keys(v):
    if isinstance(v, dict):
        for k, x in v.items():
            if k in ('templateKey', '_templateKey') and isinstance(x, str) and x in TEMPLATES: yield x
            else: yield from template_keys(x)
    elif isinstance(v, list):
        for x in v: yield from template_keys(x)


wanted = {}
for path, p in index['prefabs'].items():
    for c in p['clockComponents']:
        if c['objectName'] in OBJECTS: wanted.setdefault(p['bundle'], []).append((path, c))
components = {}
used_templates = set()
for bundle in sorted(wanted):
    row = bundles[bundle]
    raw = (C / 'bundles' / bundle).read_bytes()
    assert len(raw) == row['bytes'] and hashlib.sha256(raw).hexdigest() == row['sha256']
    by = {o.path_id: o for o in UnityPy.load(raw).objects}
    for path, c in wanted[bundle]:
        data = exact(by[int(c['pathId'])].read_typetree())
        text = canonical(data)
        assert hashlib.sha256(text.encode()).hexdigest() == c['originalDataSha256'], (path, c['pathId'])
        rows = components.setdefault(path, [])
        rows.append({'pathId': c['pathId'], 'objectName': c['objectName'], 'originalJson': text})
        # Referenced same-bundle MonoBehaviours, transitively; each keeps its own digest.
        seen, todo = {r['pathId'] for r in rows}, list(local_refs(data))
        while todo:
            ref = todo.pop()
            if ref in seen or by[int(ref)].type.name != 'MonoBehaviour': continue
            seen.add(ref)
            d = exact(by[int(ref)].read_typetree()); t = canonical(d)
            go = by[int(d['m_GameObject']['m_PathID'])].read_typetree()['m_Name']
            rows.append({'pathId': ref, 'objectName': go, 'referenced': True, 'sha256': hashlib.sha256(t.encode()).hexdigest(), 'originalJson': t})
            todo.extend(local_refs(d))
        for r in rows: used_templates.update(template_keys(json.loads(r['originalJson'])))
templates, todo = {}, sorted(used_templates)
while todo:
    k = todo.pop()
    if k in templates: continue
    templates[k] = TEMPLATES[k]; todo.extend(template_keys(TEMPLATES[k]))
result = {'schemaVersion': 1,
    'scope': 'Original serialized content of the enemy ability components reviewed enemy features read. Each indexed originalJson hashes to the originalDataSha256 the native timing index records for that component; referenced components carry their own sha256 from the same verified bundles.',
    'source': {'nativeTimingIndex': 'data/arkpedia-enemy-clock-source.json',
               'sha256': hashlib.sha256(index_raw).hexdigest(), 'templates': template_pin},
    'objects': OBJECTS,
    'prefabs': {k: sorted(v, key=lambda r: int(r['pathId'])) for k, v in sorted(components.items())},
    'templates': dict(sorted(templates.items()))}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    if OUT.read_text() != text: sys.exit('Enemy native ability evidence is stale')
    print('Enemy native ability evidence matches the pinned bundles')
else:
    OUT.write_text(text)
    print('Wrote', sum(len(v) for v in components.values()), 'components from', len(components), 'prefabs')
