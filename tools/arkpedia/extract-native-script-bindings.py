#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Bind retained CN components to their exact shared MonoScript objects."""
from pathlib import Path
import hashlib
import json
import math
import sys
from native_anonymous_source import read_anonymous_source

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: E402,F401
import UnityPy  # noqa: E402

CACHE = ROOT / '.cache/arkpedia/cn-native-source'
RECIPE = 'data/arkpedia-cn-mono-script-source.json'
recipe = json.loads((ROOT / RECIPE).read_bytes())
receipt = read_anonymous_source(ROOT / '.cache/arkpedia', RECIPE,
                               (CACHE / 'hot_update_list.json').read_bytes(), recipe['version'],
                               fetch='--fetch' in sys.argv)
env = UnityPy.load((CACHE / 'bundles' / receipt['path']).read_bytes())
scripts = {o.path_id: o for o in env.objects if o.type.name == 'MonoScript'}
assert len(scripts) == recipe['identity']['scriptCount']
assert {o.assets_file.name for o in scripts.values()} == {recipe['identity']['serializedFile']}


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


families = ['ch16-fear-projectile', 'ch16-miner', 'ch16-story-guardian',
            'ch16-artillery', 'ch16-crossbow', 'ch16-patrol']
sources, loaded, used_scripts, bindings = {}, {}, {}, []
for family in families:
    path = 'data/candidates/arkpedia-' + family + '-source.json'
    raw = (ROOT / path).read_bytes()
    sources[path] = {'path': path, 'sha256': sha(raw)}
    graph = json.loads(raw)
    candidates = {}
    for bundle in graph['source']['bundles']:
        name = bundle['path']
        if name not in loaded:
            content = (CACHE / 'bundles' / name).read_bytes()
            assert len(content) == bundle['bytes'] and sha(content) == bundle['sha256']
            assert hashlib.md5(content).hexdigest() == bundle['md5']
            loaded[name] = [o for o in UnityPy.load(content).objects if o.type.name == 'MonoBehaviour']
        for obj in loaded[name]:
            candidates.setdefault(str(obj.path_id), []).append((name, obj))
    for prefab, rows in sorted({**graph['prefabs'], **graph['projectiles']}.items()):
        for row in rows:
            native = json.loads(row['originalJson'])
            ref = native.get('m_Script')
            if not ref:
                continue
            assert sha(row['originalJson'].encode()) == row['sha256']
            matches = [(name, obj) for name, obj in candidates.get(row['pathId'], [])
                       if canonical(obj.read_typetree()) == row['originalJson']]
            assert len(matches) == 1, 'Ambiguous retained component owner'
            name, obj = matches[0]
            assert 0 < ref['m_FileID'] <= len(obj.assets_file.externals)
            external = obj.assets_file.externals[ref['m_FileID'] - 1]
            assert external.name == recipe['identity']['serializedFile'], 'Unresolved script-file identity'
            script = scripts[int(ref['m_PathID'])]
            original = canonical(script.read_typetree())
            used_scripts[str(script.path_id)] = {
                'pathId': str(script.path_id), 'serializedFile': script.assets_file.name,
                'originalJson': original, 'sha256': sha(original.encode())}
            bindings.append({'graph': path, 'prefab': prefab, 'bundle': name,
                             'componentPathId': row['pathId'], 'componentSha256': row['sha256'],
                             'scriptFileId': ref['m_FileID'], 'scriptPathId': ref['m_PathID'],
                             'externalSerializedFile': external.name})

result = {'schemaVersion': 1,
          'scope': 'Exact retained CN MonoScript identity only; no compiled cross-version/frame parity, behavioral support or stage admission.',
          'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'source': receipt, 'graphs': sources,
          'scripts': dict(sorted(used_scripts.items(), key=lambda item: int(item[0]))),
          'bindings': sorted(bindings, key=lambda r: (r['graph'], r['prefab'], int(r['componentPathId'])))}
out = ROOT / 'data/candidates/arkpedia-ch16-script-bindings-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if '--check' in sys.argv:
    assert out.read_text(encoding='utf8') == serialized, 'Native script bindings differ'
else:
    out.write_text(serialized, encoding='utf8', newline='\n')
print(f'Verified {len(bindings)} original component references against {len(used_scripts)} exact shared MonoScript objects')
