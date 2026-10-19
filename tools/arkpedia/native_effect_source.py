#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover original effect hierarchies and rendering inputs for a pinned kit.

This exports source inputs, not a certified Unity effect player. Missing foreign
resources are retained as unresolved references; publication/runtime enablement
must not silently replace them. Rebuild with the pinned official bundles fetched
by the kit's fetch script and the project's local UnityPy environment.
"""
import base64
from collections import Counter, deque
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 -- original LZ4AK support
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

VERSION = '26-09-23-17-49-43_b9cc4a'


def exact(value, key=''):
    if isinstance(value, dict):
        return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [exact(v, key) for v in value]
    if isinstance(value, bytes):
        return {'encoding': 'base64', 'data': base64.b64encode(value).decode('ascii')}
    if isinstance(value, int) and (key == 'm_PathID' or abs(value) > 2**53 - 1):
        return str(value)
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def encoded(value):
    return (json.dumps(value, ensure_ascii=True, sort_keys=True,
                       separators=(',', ':'), allow_nan=False) + '\n').encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pointers(value, field=''):
    if isinstance(value, dict):
        if set(value) == {'m_FileID', 'm_PathID'}:
            if value['m_PathID']:
                yield field, value
        else:
            for k, v in value.items():
                yield from pointers(v, k)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from pointers(v, field)


def export(cache, out, spec, manifest_out=None):
    main_name, core = spec["bundle"], set(spec["core"])
    version = spec.get('version', VERSION)
    hot_bytes = (cache / spec.get('manifest', 'map-source/hot_update_list.json')).read_bytes()
    if spec.get('manifest_sha256') and sha(hot_bytes) != spec['manifest_sha256']:
        raise ValueError('Changed pinned native resource manifest')
    hot = json.loads(hot_bytes)
    if hot['versionId'] != version:
        raise ValueError('Wrong native resource version')
    inventory = json.loads((cache / (spec["source_directory"] + "/effect-bundles.json")).read_text())
    if inventory['version'] != version:
        raise ValueError('Wrong native effect inventory version')
    names = {main_name, '[uc]shaders.ab', 'arts/[pack]common.ab', 'battle/[pack]common.ab'}
    names.update(r['name'] for r in hot['abInfos']
                 if r['name'].startswith('refs/fx/') and '/overseas/' not in r['name'])
    additional = spec.get('additional_roots', {})
    names.update(additional)
    names.update(spec.get('extra_dependencies', []))
    if len(names) != spec.get('source_count', 23) or {r['path'] for r in inventory['sources']} != names:
        raise ValueError('Incomplete original effect dependency inventory')
    env = UnityPy.Environment()
    files, bundles, sources = {}, {}, []
    for entry in sorted(inventory['sources'], key=lambda r: r['path']):
        name = entry['path']
        path = cache / (spec["local_bundle"] if name == main_name else spec.get("dependencies_directory", "map-source/ab/") + name)
        raw = path.read_bytes()
        native = next(r for r in hot['abInfos'] if r['name'] == name)
        anonymous = spec.get('anonymous_sources', {}).get(name)
        if anonymous:
            from native_anonymous_source import read_anonymous_source
            expected_entry = read_anonymous_source(cache, anonymous, hot_bytes, version)
        else:
            expected_entry = {'path': name, 'bytes': len(raw), 'md5': native['md5'], 'sha256': sha(raw)}
        if (len(raw) != native['abSize'] or hashlib.md5(raw).hexdigest() != expected_entry['md5'] or sha(raw) != expected_entry['sha256']
                or entry != expected_entry):
            raise ValueError('Native effect dependency checksum mismatch: ' + name)
        sources.append(entry)
        bundle = env.load_file(raw, name=name)
        if anonymous:
            identity = json.loads((ROOT / anonymous).read_text())['identity']
            assets = [f for f in bundle.files.values() if hasattr(f, 'objects')]
            if len(assets) != 1:
                raise ValueError('Ambiguous anonymous serialized file')
            asset = assets[0]
            if (asset.name != identity['serializedFile'] or asset.unity_version != identity['unityVersion']
                    or int(asset.target_platform) != identity['platform'] or asset.externals):
                raise ValueError('Changed anonymous resource identity')
            material = asset.objects[int(identity['materialPathId'])]
            material_tree = material.read_typetree()
            if (material.type.name != 'Material' or material_tree['m_Name'] != identity['materialName']
                    or len(material.get_raw_data()) != identity['materialBytes']
                    or sha(material.get_raw_data()) != identity['materialSha256']
                    or material_tree['m_Shader'] != {'m_FileID': 0, 'm_PathID': int(identity['shaderPathId'])}):
                raise ValueError('Changed original anonymous material')
            textures = dict(material_tree['m_SavedProperties']['m_TexEnvs'])
            if textures['_MainTex']['m_Texture'] != {'m_FileID': 0, 'm_PathID': int(identity['texturePathId'])}:
                raise ValueError('Changed original anonymous material texture')
            if asset.objects[int(identity['shaderPathId'])].type.name != 'Shader' or asset.objects[int(identity['texturePathId'])].type.name != 'Texture2D':
                raise ValueError('Changed anonymous shader/texture identity')
        for f in bundle.files.values():
            if hasattr(f, 'objects'):
                if f.name in files:
                    raise ValueError('Ambiguous native serialized-file identity')
                files[f.name], bundles[f.name] = f, name
    roots = {}
    for bundle_name, selected in {main_name: None, **additional}.items():
        main = next(f for n, f in files.items() if bundles[n] == bundle_name)
        found = set()
        for obj in main.objects.values():
            if obj.type.name != 'Transform':
                continue
            tr = obj.read()
            if tr.m_Father.path_id != 0:
                continue
            go = tr.m_GameObject.read()
            if '#' in go.m_Name or selected is not None and go.m_Name not in selected:
                continue
            if go.m_Name in roots or not go.m_Name.startswith(spec["root_prefix"]):
                raise ValueError('Unexpected or duplicate original effect root')
            roots[go.m_Name] = go.object_reader
            found.add(go.m_Name)
        if selected is not None and found != set(selected):
            raise ValueError('Missing selected original dependency effect root')
    if len(roots) != spec["roots"] or not core <= roots.keys():
        raise ValueError('Incomplete original effect hierarchy')
    out.mkdir(parents=True, exist_ok=True)
    (out / 'textures').mkdir(exist_ok=True)
    queue = deque(roots.values())
    records, unresolved, scripts, textures, meshes = {}, {}, {}, {}, {}

    def identity(obj):
        return bundles[obj.assets_file.name] + ':' + str(obj.path_id)

    while queue:
        obj = queue.popleft()
        key = identity(obj)
        if key in records:
            continue
        tree = obj.read_typetree()
        kind = obj.type.name
        row = {'type': kind, 'bundle': bundles[obj.assets_file.name],
               'pathId': str(obj.path_id), 'serializedSha256': sha(obj.get_raw_data())}
        records[key] = row
        if kind == 'Texture2D':
            image = obj.read().image.convert('RGBA')
            stem = sha(key.encode())[:24]
            file = out / 'textures' / (stem + '.webp')
            image.save(file, lossless=True, exact=True)
            blob = file.read_bytes()
            textures[key] = {'path': 'textures/' + file.name, 'bytes': len(blob),
                             'sha256': sha(blob), 'pixelSha256': sha(image.tobytes()),
                             'width': image.width, 'height': image.height}
            row['data'] = exact({k: v for k, v in tree.items()
                                 if k not in ['image data', 'm_ImageData']})
            continue
        if kind == 'Mesh':
            h = MeshHandler(obj.read())
            h.process()
            meshes[key] = {'positions': exact(h.m_Vertices), 'uv': exact(h.m_UV0),
                           'normals': exact(h.m_Normals), 'tangents': exact(h.m_Tangents),
                           'colors': exact(h.m_Colors),
                           'vertexChannels': exact(tree['m_VertexData']['m_Channels']),
                           'uvChannels': [exact(getattr(h, f'm_UV{i}')) for i in range(8)],
                           'submeshTriangles': exact(h.get_triangles())}
            row['data'] = {'name': tree['m_Name'], 'bounds': exact(tree['m_LocalAABB'])}
            continue
        if kind == 'Shader':
            # Keep the actual shader identity and raw digest, not an invented
            # browser shader or megabytes of platform executable shader blobs.
            row['data'] = {'name': tree['m_ParsedForm']['m_Name']}
            continue
        row['data'] = exact(tree)
        row['references'] = []
        for field, ptr in pointers(tree):
            f = obj.assets_file
            if ptr['m_FileID']:
                foreign = f.externals[ptr['m_FileID'] - 1].path
                f = files.get(foreign.rsplit('/', 1)[-1])
            else:
                foreign = None
            ref = {'field': field, 'pointer': exact(ptr)}
            row['references'].append(ref)
            if field == 'm_Script':
                # Script assemblies are outside artwork closure. Preserve each
                # original binding; behavior dispatch is a later runtime gate.
                ref['scriptBinding'] = True
                scripts[key] = {'foreignFile': foreign, 'pointer': exact(ptr)}
                continue
            if f is None:
                ref['unresolved'] = {'foreignFile': foreign, 'pathId': str(ptr['m_PathID'])}
                miss = foreign + ':' + str(ptr['m_PathID'])
                unresolved.setdefault(miss, {'foreignFile': foreign,
                                            'pathId': str(ptr['m_PathID']), 'references': []})
                unresolved[miss]['references'].append({'record': key, 'field': field})
                continue
            target = f.objects.get(ptr['m_PathID'])
            if target is None:
                raise ValueError('Missing native object in a loaded source bundle')
            ref['target'] = identity(target)
            queue.append(target)
    pack = {'schemaVersion': 1, 'operator': spec['operator'],
            'coordinates': 'original-unity', 'version': version,
            'roots': {name: identity(obj) for name, obj in sorted(roots.items())},
            'records': records, 'meshes': meshes, 'textures': textures,
            'scriptBindings': scripts, 'unresolvedReferences': unresolved}
    raw = encoded(pack)
    blob = gzip.compress(raw, mtime=0)
    (out / 'native-effects.bin').write_bytes(blob)
    result = {'schemaVersion': 1, 'operator': pack['operator'], 'version': version,
              'sources': sources, 'roots': pack['roots'],
              'counts': dict(sorted(Counter(r['type'] for r in records.values()).items())),
              'pack': {'path': 'native-effects.bin', 'encoding': 'gzip-json',
                       'bytes': len(blob), 'sha256': sha(blob),
                       'decodedBytes': len(raw), 'decodedSha256': sha(raw)},
              'textures': textures, 'unresolvedReferences': unresolved,
              'scope': {'sourceInputsOnly': True, 'enabledOperators': [],
                        'rendererVerified': False, 'compiledFrameParity': False,
                        'pending': ['Resolve remaining foreign/builtin inputs',
                                    'Implement original shaders, particle/trail and animator dispatch',
                                    'Connect owner/projectile lifecycle and review all skills in browser']}}
    manifest_bytes = (json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + '\n').encode()
    (out / 'native-effects.json').write_bytes(manifest_bytes)
    if manifest_out:
        manifest_out.write_bytes(manifest_bytes)
    print(json.dumps({'roots': len(roots), 'objects': len(records),
                      'meshes': len(meshes), 'textures': len(textures),
                      'unresolvedResources': len(unresolved), 'packBytes': len(blob)}))
    return result
