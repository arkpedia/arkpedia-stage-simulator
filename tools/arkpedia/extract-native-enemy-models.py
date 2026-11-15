#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Prepare exact native enemy models for the shared SD importer, one bundle at a time.
No simulator assets are installed here. Unknown material/atlas forms stay pending.
Example: --ids /tmp/missing-enemies.json --out .cache/arkpedia/enemy-art
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from extract import enemy_spine_id, write_enemy_spine, safe_name, material_alpha_ref

def digest(raw, kind='sha256'):
    return hashlib.new(kind, raw).hexdigest()

def local(ref):
    if ref['m_FileID'] != 0 or not ref['m_PathID']:
        raise ValueError('External or missing artwork pointer')
    return ref['m_PathID']

def pointer_strings(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else pointer_strings(v) for k, v in value.items()}
    if isinstance(value, list):
        return [pointer_strings(v) for v in value]
    return value

def native_bindings(wanted, cache):
    """Follow root -> animator -> SkeletonAnimation -> external SkeletonData.
    Filenames alone cannot distinguish native variant folders or animation aliases.
    """
    index = json.loads((ROOT / 'data/arkpedia-enemy-clock-source.json').read_bytes())['prefabs']
    source = json.loads((ROOT / 'data/arkpedia-cn-enemy-native-source.json').read_bytes())
    bundles = {b['path']: b for b in source['bundles']}
    grouped = {}; bindings = {}; failures = []
    for eid in sorted(wanted):
        prefab = 'dyn/battle/prefabs/enemies/' + eid + '.prefab'
        if prefab not in index:
            failures.append({'id': eid, 'reason': 'No indexed original prefab'})
            continue
        entry = index[prefab]
        grouped.setdefault(entry['bundle'], []).append((eid, prefab, entry))
    for path, rows in grouped.items():
        raw = (cache / 'bundles' / path).read_bytes(); receipt = bundles[path]
        assert len(raw) == receipt['bytes'] and digest(raw) == receipt['sha256'] and digest(raw, 'md5') == receipt['md5']
        env = UnityPy.load(raw); objects = {o.path_id: o for o in env.objects}
        for eid, prefab, entry in rows:
            try:
                root = objects[int(entry['rootPathId'])].read_typetree()
                if root['m_Name'] != eid:
                    raise ValueError('Prefab root identity mismatch')
                roots = [(local(c['component']), objects[local(c['component'])].read_typetree()) for c in root['m_Component']]
                roots = [(pid, value) for pid, value in roots if '_animator' in value]
                if len(roots) != 1:
                    raise ValueError('Ambiguous root animator binding')
                component, owner = roots[0]; aid = local(owner['_animator']); animator_obj = objects[aid]
                animator = animator_obj.read_typetree()
                if '_skeleton' not in animator:
                    raise ValueError('Native animator has no Spine body (effect/mesh renderer needs separate support)')
                sid = local(animator['_skeleton']); skeleton = objects[sid].read_typetree(); ref = skeleton['skeletonDataAsset']
                if not ref['m_FileID'] or not ref['m_PathID']:
                    raise ValueError('Expected explicit external SkeletonData binding')
                # Spine's empty initialSkinName keeps its original default skin.
                if skeleton['initialSkinName'] not in ('', 'default') or skeleton['pmaVertexColors'] != 1 or skeleton['tintBlack'] != 0:
                    raise ValueError('Non-default native skin or vertex material needs review')
                external = objects[sid].assets_file.externals[ref['m_FileID'] - 1].path
                bindings[eid] = {'prefab': prefab, 'bundle': receipt, 'rootPathId': entry['rootPathId'],
                    'componentPathId': str(component), 'animatorPathId': str(aid), 'skeletonAnimationPathId': str(sid),
                    'animator': pointer_strings(animator), 'skeleton': pointer_strings(skeleton),
                    'external': external, 'cab': external.rsplit('/', 1)[-1], 'skeletonDataAssetPathId': str(ref['m_PathID'])}
            except Exception as error:
                failures.append({'id': eid, 'bundle': path, 'reason': str(error)})
    return bindings, failures

def inspect(objects, sda, asset_id):
    if len(sda['atlasAssets']) != 1:
        raise ValueError('Multiple native atlases require separate review')
    ids = {'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(local(sda['skeletonJSON'])),
           'atlasAssetPathId': str(local(sda['atlasAssets'][0]))}
    atlas = objects[int(ids['atlasAssetPathId'])].read_typetree()
    ids['atlasTextAssetPathId'] = str(local(atlas['atlasFile']))
    material_rows = []
    for ref in atlas['materials']:
        mid = local(ref); material = objects[mid].read_typetree()
        props = material['m_SavedProperties']; floats = dict(props['m_Floats']); textures = dict(props['m_TexEnvs'])
        if floats.get('_StraightAlphaInput', 0) != 0:
            raise ValueError('Straight-alpha shader needs separate review')
        main = local(textures['_MainTex']['m_Texture']); alpha_ref = material_alpha_ref(material)
        alpha = local(alpha_ref) if alpha_ref else None
        texture = objects[main].read()
        if safe_name(texture.m_Name) != texture.m_Name:
            raise ValueError('Unsafe original texture filename')
        if alpha is not None and objects[alpha].read().image.size != texture.image.size:
            raise ValueError('Mismatched split texture dimensions')
        material_rows.append({'materialPathId': str(mid), 'mainTexturePathId': str(main),
                              'alphaTexturePathId': str(alpha) if alpha is not None else None,
                              'assignedAlphaTexture': pointer_strings(textures.get('_AlphaTex', {}).get('m_Texture')),
                              'shader': pointer_strings(material.get('m_Shader')),
                              'keywords': material.get('m_ValidKeywords', material.get('m_ShaderKeywords', '').split()), 'floats': floats})
    if not material_rows:
        raise ValueError('Missing original materials')
    ids['materials'] = material_rows
    return ids

def parse_model(directory):
    skels = list(directory.glob('*.skel')); atlases = list(directory.glob('*.atlas'))
    if len(skels) != 1 or len(atlases) != 1:
        raise ValueError('Ambiguous exported skeleton or atlas')
    script = """import {readFile} from 'node:fs/promises';
import {parseSkel} from './tools/assets/skel.mjs';import {atlasInfo} from './tools/assets/atlas.mjs';
const info=atlasInfo(await readFile(process.argv[2],'utf8'));
const parsed=parseSkel(await readFile(process.argv[1]),info.regions,{includeEventPayloads:true,includeExactDurations:true});
console.log(JSON.stringify(parsed));"""
    parsed = json.loads(subprocess.check_output([os.environ.get('ARKPEDIA_SOURCE_NODE', 'node'), '--input-type=module', '-e', script,
                                                str(skels[0]), str(atlases[0])], cwd=ROOT))
    if not re.fullmatch(r'3\.8\.\d+', parsed['version']) or parsed['missingRegions']:
        raise ValueError('Unsupported Spine version or missing atlas regions')
    return parsed

def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--ids', required=True); args.add_argument('--out', required=True)
    args.add_argument('--native-bindings', action='store_true', help='Resolve exact prefab pointers and native animation aliases')
    opt = args.parse_args(); out = Path(opt.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    wanted = json.loads(Path(opt.ids).read_text())
    if not isinstance(wanted, list) or not wanted or len(set(wanted)) != len(wanted) or any(not re.fullmatch(r'enemy_\w+', i) for i in wanted):
        raise ValueError('Expected unique explicit enemy IDs')
    wanted = set(wanted); requested = sorted(wanted); exported = []; failures = []
    pin = json.loads((ROOT / 'data/arkpedia-cn-native-source.json').read_bytes())['source']
    cache = ROOT / '.cache/arkpedia/cn-native-source'; raw_manifest = (cache / 'hot_update_list.json').read_bytes()
    assert len(raw_manifest) == pin['manifestBytes'] and digest(raw_manifest) == pin['manifestSha256']
    manifest = json.loads(raw_manifest); assert manifest['versionId'] == pin['resourceVersion']
    bindings = {}
    if opt.native_bindings:
        bindings, failures = native_bindings(wanted, cache)
    rows = [r for r in manifest['abInfos'] if re.fullmatch(r'refs/arts/enm_art_(?:base_)?\d+\.ab', r['name'])]
    for row in sorted(rows, key=lambda r: r['name']):
        if not wanted:
            break
        path = row['name']; raw = (cache / 'bundles' / path).read_bytes()
        assert len(raw) == row['abSize'] and digest(raw, 'md5') == row['md5'], path
        env = UnityPy.load(raw); objects = {o.path_id: o for o in env.objects}; models = {}; candidates = {}
        if opt.native_bindings:
            for eid in wanted:
                binding = bindings.get(eid)
                obj = objects.get(int(binding['skeletonDataAssetPathId'])) if binding else None
                if obj and obj.assets_file.name == binding['cab']:
                    names = [name for name, ref in env.container.items() if ref.path_id == obj.path_id]
                    candidates[eid] = [(names[0] if len(names) == 1 else binding['external'], obj)]
        else:
            for name, ref in env.container.items():
                eid = enemy_spine_id(name, wanted)
                if eid:
                    candidates.setdefault(eid, []).append((name, ref))
        for eid, refs in sorted(candidates.items()):
            try:
                if len(refs) != 1:
                    raise ValueError('Ambiguous original SkeletonData containers')
                name, ref = refs[0]; sda = ref.read_typetree()
                if not opt.native_bindings and sda['m_Name'] != eid + '_SkeletonData':
                    raise ValueError('Original enemy identity mismatch')
                chain = inspect(objects, sda, ref.path_id)
                files = {}; count = write_enemy_spine(objects, sda, eid, out, files, print)
                if count < 3:
                    raise ValueError('Incomplete original model')
                relative = f'spine/enemy/{eid}'; directory = out / relative; parsed = parse_model(directory)
                durations = parsed['durations']
                aliases = {a['animKey']: a['animName'] for a in bindings[eid]['animator']['_animations']} if opt.native_bindings else {}
                def clip(key):
                    name = aliases.get(key, key) if opt.native_bindings else key
                    return name if name in durations else None
                idle = clip('Idle') or clip('Default')
                if idle is None:
                    raise ValueError('No literal idle/default pose; role mapping needs review')
                models[eid] = {'kind': 'enemy', 'directory': relative, 'originalPathIds': chain, 'originalAsset': name,
                    'files': {f: {'bytes': (directory / f).stat().st_size, 'sha256': digest((directory / f).read_bytes())} for f in files[relative]},
                    'spineVersion': parsed['version'], 'durations': durations, 'hits': parsed['hits'], 'bounds': parsed['bounds'],
                    'eventPayloads': parsed['eventPayloads'], 'animationRoles': {'idle': idle,
                        'move': clip('Move'), 'deploy': clip('Start'), 'die': clip('Die'),
                        'attack': {'loop': clip('Attack')} if clip('Attack') else None}}
                if opt.native_bindings:
                    models[eid]['nativeBinding'] = bindings[eid]
                wanted.remove(eid); print(f'Prepared {eid} from {path}', flush=True)
            except Exception as error:
                failures.append({'id': eid, 'bundle': path, 'reason': str(error)})
                print(f'Pending {eid}: {error}', flush=True)
        if models:
            source = {'client': 'cn', 'path': path, 'bytes': len(raw), 'md5': row['md5'], 'sha256': digest(raw),
                'resourceVersion': pin['resourceVersion'], 'url': pin['baseURL'] + path.replace('/', '_').replace('.ab', '.dat'),
                'transforms': ['Original skeleton bytes retained', 'Original split or embedded alpha preserved; premultiplied RGB clamped to alpha',
                               'Atlas page dimensions and PMA header normalized; native regions retained']}
            target = out / (Path(path).stem + '.json')
            target.write_text(json.dumps({'sourceBundle': source, 'models': models}, ensure_ascii=False, indent=1) + '\n')
            exported.append({'metadata': str(target), 'bundle': path, 'ids': sorted(models)})
    (out / 'extraction.json').write_text(json.dumps({'source': pin, 'requested': requested, 'batches': exported,
        'pending': sorted(wanted), 'failures': failures, 'scope': 'Original body artwork preparation; no simulator publication or combat/frame fidelity approval'}, indent=1) + '\n')
    print(f'Prepared {len(requested)-len(wanted)}/{len(requested)} enemy bodies; {len(wanted)} pending', flush=True)

if __name__ == '__main__':
    main()
