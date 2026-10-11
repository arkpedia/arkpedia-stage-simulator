#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently check the native effect export against original client bytes.

This is a source-input audit, not rendering/frame-parity certification. Unlike
the exporter, this reads each exported object's identity back into the original
serialized file and compares data, pixels, decoded geometry and reference closure.
"""
import argparse
import base64
from collections import Counter
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image
from UnityPy.helpers.MeshHelper import MeshHandler


def normalized(v, key=''):
    if isinstance(v, dict):
        return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [normalized(x, key) for x in v]
    if isinstance(v, bytes):
        return {'encoding': 'base64', 'data': base64.b64encode(v).decode('ascii')}
    if isinstance(v, int) and (key == 'm_PathID' or abs(v) > 9007199254740991):
        return str(v)
    if isinstance(v, float) and not math.isfinite(v):
        return 'NaN' if math.isnan(v) else 'Infinity' if v > 0 else '-Infinity'
    return v


def digest(v):
    return hashlib.sha256(v).hexdigest()


def refs(v, field=''):
    if isinstance(v, dict):
        if set(v) == {'m_FileID', 'm_PathID'}:
            if v['m_PathID']:
                yield field, v
        else:
            for k, x in v.items():
                yield from refs(x, k)
    elif isinstance(v, (list, tuple)):
        for x in v:
            yield from refs(x, field)


def verify(cache, directory, manifest):
    meta = json.loads(manifest.read_text())
    assert meta['schemaVersion'] == 1 and meta['operator'] == 'char_1038_whitw2'
    assert meta['version'] == '26-09-23-17-49-43_b9cc4a'
    scope = meta['scope']
    assert scope['sourceInputsOnly'] is True and scope['enabledOperators'] == []
    assert scope['rendererVerified'] is False and scope['compiledFrameParity'] is False
    assert len(scope['pending']) == 3
    hot = json.loads((cache / 'map-source/hot_update_list.json').read_text())
    assert hot['versionId'] == meta['version']
    expected = {'battle/prefabs/effects/whitw2.ab', '[uc]shaders.ab',
                'arts/[pack]common.ab', 'battle/[pack]common.ab'}
    expected |= {r['name'] for r in hot['abInfos']
                 if r['name'].startswith('refs/fx/') and '/overseas/' not in r['name']}
    assert len(meta['sources']) == len(expected) == 23
    assert {r['path'] for r in meta['sources']} == expected
    env, source_files, foreign_files = UnityPy.Environment(), {}, {}
    for r in meta['sources']:
        name = r['path']
        file = cache / ('lappland-alter-source/whitw2-effects.ab'
                        if name.endswith('/whitw2.ab') else 'map-source/ab/' + name)
        raw = file.read_bytes()
        pinned = next(x for x in hot['abInfos'] if x['name'] == name)
        assert len(raw) == pinned['abSize'] == r['bytes']
        assert hashlib.md5(raw).hexdigest() == pinned['md5'] == r['md5']
        assert digest(raw) == r['sha256']
        bundle = env.load_file(raw, name=name)
        for f in bundle.files.values():
            if hasattr(f, 'objects'):
                assert name not in source_files and f.name not in foreign_files
                source_files[name], foreign_files[f.name] = f, (name, f)
    blob = (directory / meta['pack']['path']).read_bytes()
    assert meta['pack']['encoding'] == 'gzip-json'
    assert len(blob) == meta['pack']['bytes'] and digest(blob) == meta['pack']['sha256']
    raw = gzip.decompress(blob)
    assert len(raw) == meta['pack']['decodedBytes'] and digest(raw) == meta['pack']['decodedSha256']
    pack = json.loads(raw)
    assert pack['schemaVersion'] == 1 and pack['operator'] == meta['operator']
    assert pack['version'] == meta['version'] and pack['coordinates'] == 'original-unity'
    main = source_files['battle/prefabs/effects/whitw2.ab']
    roots = {}
    for o in main.objects.values():
        if o.type.name == 'Transform':
            tr = o.read()
            if tr.m_Father.path_id == 0:
                go = tr.m_GameObject.read()
                if '#' not in go.m_Name:
                    roots[go.m_Name] = 'battle/prefabs/effects/whitw2.ab:' + str(go.object_reader.path_id)
    assert len(roots) == 35 and meta['roots'] == pack['roots'] == roots
    assert all('#' not in n for n in roots)
    assert meta['textures'] == pack['textures']
    assert meta['counts'] == dict(Counter(r['type'] for r in pack['records'].values()))
    assert len(pack['meshes']) == 20 and len(pack['textures']) == 90
    unresolved, scripts, graph = {}, {}, {}
    for key, r in pack['records'].items():
        assert key == r['bundle'] + ':' + r['pathId']
        o = source_files[r['bundle']].objects[int(r['pathId'])]
        assert o.type.name == r['type'] and digest(o.get_raw_data()) == r['serializedSha256']
        tree = o.read_typetree()
        kind = r['type']
        graph[key] = []
        if kind == 'Texture2D':
            native = o.read().image.convert('RGBA')
            entry = pack['textures'][key]
            file = directory / entry['path']
            data = file.read_bytes()
            assert len(data) == entry['bytes'] and digest(data) == entry['sha256']
            image = Image.open(file).convert('RGBA')
            assert native.size == image.size == (entry['width'], entry['height'])
            assert digest(native.tobytes()) == digest(image.tobytes()) == entry['pixelSha256']
            assert r['data'] == normalized({k: v for k, v in tree.items()
                                           if k not in ['image data', 'm_ImageData']})
            continue
        if kind == 'Mesh':
            h = MeshHandler(o.read())
            h.process()
            assert pack['meshes'][key] == {'positions': normalized(h.m_Vertices), 'uv': normalized(h.m_UV0),
                'normals': normalized(h.m_Normals), 'tangents': normalized(h.m_Tangents),
                'submeshTriangles': normalized(h.get_triangles())}
            assert r['data'] == {'name': tree['m_Name'], 'bounds': normalized(tree['m_LocalAABB'])}
            continue
        if kind == 'Shader':
            assert r['data'] == {'name': tree['m_ParsedForm']['m_Name']}
            continue
        assert r['data'] == normalized(tree), ('Changed original effect component', key)
        expected_refs = []
        for field, pointer in refs(tree):
            f = o.assets_file
            foreign = f.externals[pointer['m_FileID'] - 1].path if pointer['m_FileID'] else None
            if pointer['m_FileID']:
                loaded = foreign_files.get(foreign.rsplit('/', 1)[-1])
                f = loaded[1] if loaded else None
                bundle_name = loaded[0] if loaded else None
            else:
                bundle_name = r['bundle']
            ref = {'field': field, 'pointer': normalized(pointer)}
            expected_refs.append(ref)
            if field == 'm_Script':
                ref['scriptBinding'] = True
                scripts[key] = {'foreignFile': foreign, 'pointer': normalized(pointer)}
            elif f is None:
                ref['unresolved'] = {'foreignFile': foreign, 'pathId': str(pointer['m_PathID'])}
                missing = foreign + ':' + str(pointer['m_PathID'])
                unresolved.setdefault(missing, {**ref['unresolved'], 'references': []})
                unresolved[missing]['references'].append({'record': key, 'field': field})
            else:
                target = bundle_name + ':' + str(pointer['m_PathID'])
                assert int(pointer['m_PathID']) in f.objects and target in pack['records']
                ref['target'] = target
                graph[key].append(target)
        assert r['references'] == expected_refs
    assert pack['scriptBindings'] == scripts
    assert meta['unresolvedReferences'] == pack['unresolvedReferences']
    assert set(unresolved) == set(pack['unresolvedReferences'])
    for key, expected_ref in unresolved.items():
        actual = pack['unresolvedReferences'][key]
        assert actual['foreignFile'] == expected_ref['foreignFile']
        assert actual['pathId'] == expected_ref['pathId']
        # The canonical pack sorts record keys. Closure membership has no BFS
        # ordering contract, while duplicate references must still be retained.
        assert Counter((r['record'], r['field']) for r in actual['references']) == Counter(
            (r['record'], r['field']) for r in expected_ref['references'])
    seen, todo = set(), list(roots.values())
    while todo:
        key = todo.pop()
        if key in seen:
            continue
        seen.add(key)
        todo.extend(graph[key])
    assert seen == set(pack['records']), 'Omitted hierarchy member or unrelated source object'
    assert len(unresolved) == 9
    print(f'Verified {len(roots)} original effects, {len(seen)} source objects, twenty meshes and ninety exact RGBA textures; nine unresolved references remain explicit')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/arkpedia')
    parser.add_argument('--directory', type=Path,
                        default=ROOT / '.cache/arkpedia/lappland-alter-source/effects')
    parser.add_argument('--manifest', type=Path, default=ROOT / 'data/arkpedia-lappland-effects.json')
    args = parser.parse_args()
    verify(args.cache, args.directory, args.manifest)
