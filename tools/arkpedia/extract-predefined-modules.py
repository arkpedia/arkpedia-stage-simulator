#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain complete native graphs for canonical predefined level-three modules."""
import argparse, hashlib, json, math, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
sha = lambda b: hashlib.sha256(b).hexdigest()
tables_raw = (ROOT / 'data/candidates/arkpedia-stage-predefined-module-tables.json').read_bytes()
tables = json.loads(tables_raw)
lock_raw = (ROOT / tables['lock']['path']).read_bytes()
assert sha(lock_raw) == tables['lock']['sha256']
lock = json.loads(lock_raw)
assert tables['testOnly'] and lock['testOnly']
cache = ROOT / '.cache/arkpedia/predefined-modules'
bundles = {}
for key, pin in lock['bundles'].items():
    raw = (cache / (key + '.ab')).read_bytes()
    assert len(raw) == pin['bytes'] and sha(raw) == pin['sha256']
    assert hashlib.md5(raw).hexdigest() == pin['md5']
    bundles[key] = {o.path_id: o for o in UnityPy.load(raw).objects}
def exact(v):
    if isinstance(v, dict):
        return {k: str(x) if k == 'm_PathID' else exact(x) for k, x in v.items()}
    if isinstance(v, list):
        return [exact(x) for x in v]
    if isinstance(v, float) and not math.isfinite(v):
        return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v
def refs(v):
    if isinstance(v, dict):
        if v.get('m_FileID') == 0 and v.get('m_PathID'):
            yield int(v['m_PathID'])
        for x in v.values(): yield from refs(x)
    elif isinstance(v, list):
        for x in v: yield from refs(x)
roots = {}
for o in bundles['equips'].values():
    if o.type.name == 'AssetBundle':
        for path, entry in o.read_typetree()['m_Container']:
            assert path not in roots
            assert entry['asset']['m_FileID'] == 0
            roots[path] = int(entry['asset']['m_PathID'])
wanted = sorted({p['resKey'] for m in tables['modules'].values() for p in m['phase']['parts'] if p['resKey']})
graphs = {}
for key in wanted:
    path = f'dyn/battle/prefabs/[uc]equips/{key}.prefab'
    assert path in roots, ('Missing original module prefab', path)
    pending, seen, rows = [roots[path]], set(), []
    while pending:
        pid = pending.pop()
        if pid in seen: continue
        assert pid in bundles['equips'], ('Missing module local reference', pid)
        seen.add(pid); obj = bundles['equips'][pid]
        assert obj.type.name in ('GameObject', 'Transform', 'MonoBehaviour', 'Rigidbody2D', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D', 'EdgeCollider2D', 'CompositeCollider2D', 'CapsuleCollider2D'), obj.type.name
        tree = obj.read_typetree(); pending.extend(refs(tree))
        text = json.dumps(exact(tree), ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        rows.append({'pathId': str(pid), 'componentType': obj.type.name, 'originalJson': text, 'sha256': sha(text.encode())})
    graphs[key] = {'container': path, 'rootPathId': str(roots[path]), 'components': sorted(rows, key=lambda r: int(r['pathId']))}
holders = []
for obj in bundles['templates'].values():
    if obj.type.name == 'MonoBehaviour':
        tree = obj.read_typetree()
        if '_templates' in tree: holders.append(tree['_templates'])
assert len(holders) == 1
native = {t['templateKey']: exact(t) for t in holders[0]}
needed = {}
def scan(v, field=''):
    if isinstance(v, dict):
        for k, x in v.items(): scan(x, k)
    elif isinstance(v, list):
        for x in v: scan(x, field)
    elif isinstance(v, str):
        if field == 'templateKey' and v: assert v in native, ('Missing module template', v)
        if v in native and v not in needed:
            needed[v] = native[v]; scan(native[v])
        if v.startswith(('{', '[')):
            try: decoded = json.loads(v)
            except json.JSONDecodeError: return
            scan(decoded)
for g in graphs.values():
    for row in g['components']: scan(json.loads(row['originalJson']))
result = {'schemaVersion': 1, 'testOnly': True,
          'scope': 'Complete original graphs/template closure for seven predefined module parts. No stage, module or visual admission; external compiled script execution is not recovered.',
          'source': {'tables': {'path': 'data/candidates/arkpedia-stage-predefined-module-tables.json', 'sha256': sha(tables_raw)}, 'bundles': lock['bundles']},
          'prefabs': graphs, 'templates': dict(sorted(needed.items()))}
target = ROOT / 'data/candidates/arkpedia-stage-predefined-module-native.json'
text = (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode('utf8')
if args.check: assert target.read_bytes() == text, 'Predefined module native artifact differs'
else: target.write_bytes(text)
print('Verified', len(graphs), 'module prefabs,', sum(len(g['components']) for g in graphs.values()), 'components and', len(needed), 'templates; gameplay remains held')
