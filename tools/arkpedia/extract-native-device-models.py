#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Prepare explicitly selected native device bodies using the shared Spine pipeline.
Only indexed single-Graphic, local-SkeletonData prefabs are admitted. Other body
layouts require their own binding review; no filenames or operator facing copies.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('native_body', Path(__file__).with_name('extract-native-enemy-models.py'))
body = importlib.util.module_from_spec(spec)
spec.loader.exec_module(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ids', required=True)
    parser.add_argument('--out', required=True)
    opt = parser.parse_args()
    ids = json.loads(Path(opt.ids).read_text())
    if not isinstance(ids, list) or not ids or len(set(ids)) != len(ids) or any(not re.fullmatch(r'trap_\w+', i) for i in ids):
        raise ValueError('Expected unique explicit device IDs')
    native = json.loads((ROOT / 'data/arkpedia-device-native-source.json').read_bytes())
    bundles = {b['path']: b for b in native['bundles']}
    out = Path(opt.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    grouped = {}
    for did in ids:
        prefab = native['prefabs'][did]
        grouped.setdefault(prefab['bundle'], []).append((did, prefab))
    batches = []
    for path, rows in grouped.items():
        bundle = bundles[path]
        raw = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
        if len(raw) != bundle['bytes'] or body.digest(raw) != bundle['sha256'] or body.digest(raw, 'md5') != bundle['md5']:
            raise ValueError('Original device bundle checksum mismatch')
        env = body.UnityPy.load(raw)
        objects = {o.path_id: o for o in env.objects}
        models = {}
        for did, prefab in rows:
            root = env.container[prefab['asset']].read_typetree()
            if root['m_Name'] != did:
                raise ValueError('Original device root mismatch')
            graphics = [c for c in prefab['components'] if c['object'] == 'Graphic' and '_skeleton' in c['data']]
            if len(graphics) != 1:
                raise ValueError('Device requires a reviewed single Graphic binding')
            graphic = graphics[0]
            animator = objects[int(graphic['pathId'])].read_typetree()
            if body.pointer_strings(animator) != graphic['data']:
                raise ValueError('Original device animator changed')
            sid = body.local(animator['_skeleton'])
            skeleton = objects[sid].read_typetree()
            if skeleton['initialSkinName'] not in ('', 'default') or skeleton['pmaVertexColors'] != 1 or skeleton['tintBlack'] != 0:
                raise ValueError('Unreviewed device skin/material')
            sda_id = body.local(skeleton['skeletonDataAsset'])
            sda = objects[sda_id].read_typetree()
            chain = body.inspect(objects, sda, sda_id)
            chain.update(animatorPathId=graphic['pathId'], skeletonAnimationPathId=str(sid))
            files = {}
            if body.write_enemy_spine(objects, sda, did, out, files, print, kind='device') < 3:
                raise ValueError('Incomplete device model')
            relative = f'spine/device/{did}'
            directory = out / relative
            parsed = body.parse_model(directory)
            aliases = {a['animKey']: a['animName'] for a in animator['_animations']}
            def clip(key):
                name = aliases.get(key, key)
                return name if name in parsed['durations'] else None
            idle = clip('Idle') or clip('Default')
            if not idle:
                raise ValueError('No reviewed device idle pose')
            models[did] = {'kind': 'device', 'directory': relative, 'originalAsset': prefab['asset'], 'originalPathIds': chain,
                'files': {f: {'bytes': (directory / f).stat().st_size, 'sha256': body.digest((directory / f).read_bytes())} for f in files[relative]},
                'spineVersion': parsed['version'], 'durations': parsed['durations'], 'hits': parsed['hits'], 'bounds': parsed['bounds'],
                'eventPayloads': parsed['eventPayloads'], 'animationRoles': {'idle': idle, 'die': clip('Die')},
                'nativeBinding': {'rootPathId': str(env.container[prefab['asset']].path_id), 'animator': body.pointer_strings(animator),
                                  'skeleton': body.pointer_strings(skeleton)}}
            # Device Start is an activation action, not the placement animation.
            print(f'Prepared {did} from {path}', flush=True)
        source = {**bundle, 'client': 'cn', 'resourceVersion': native['source']['resourceVersion'],
            'transforms': ['Original skeleton bytes retained', 'Original split or embedded alpha preserved; premultiplied RGB clamped to alpha',
                           'Atlas page dimensions and PMA header normalized; native regions retained']}
        target = out / (Path(path).stem + '.json')
        target.write_text(json.dumps({'sourceBundle': source, 'models': models}, ensure_ascii=False, indent=1) + '\n')
        batches.append({'metadata': str(target), 'bundle': path, 'ids': sorted(models)})
    (out / 'extraction.json').write_text(json.dumps({'source': native['source'], 'requested': ids, 'batches': batches,
        'scope': 'Original body preparation; no combat or pixel parity claim'}, indent=1) + '\n')


if __name__ == '__main__':
    main()
