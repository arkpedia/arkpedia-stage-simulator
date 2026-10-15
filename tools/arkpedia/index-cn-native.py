#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Index original owner/default-art/selected-skill roots without enabling kits.

Requires the checksum-pinned CN input receipt and UnityPy environment. Root
membership is not component-graph closure, behavior or artwork-delivery approval.
"""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 - original client's compression codec registration
import UnityPy

CACHE = ROOT / '.cache/arkpedia/cn-native-source'
SOURCE = ROOT / 'data/arkpedia-cn-native-source.json'
subprocess.run([os.environ.get('ARKPEDIA_SOURCE_NODE', 'node'), str(ROOT / 'tools/arkpedia/verify-cn-native.mjs')],
               cwd=ROOT, check=True, capture_output=True)
raw_source = SOURCE.read_bytes()
source = json.loads(raw_source)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def root_record(bundle, path, reader):
    if reader.type.name != 'GameObject':
        raise ValueError(f'Unexpected native prefab root type: {bundle}/{path}: {reader.type.name}')
    data = reader.read_typetree()
    components = []
    for item in data['m_Component']:
        ref = item['component']
        components.append({'fileId': ref['m_FileID'], 'pathId': str(ref['m_PathID'])})
    return {'bundle': bundle, 'container': path, 'pathId': str(reader.path_id),
            'type': reader.type.name, 'name': data['m_Name'], 'components': components}


containers, bundles = {}, []
all_roots = []
for bundle in source['bundles']:
    path = bundle['path']
    raw = (CACHE / 'bundles' / path).read_bytes()
    if len(raw) != bundle['bytes'] or sha(raw) != bundle['sha256']:
        raise ValueError('Changed original CN bundle: ' + path)
    env = UnityPy.load(raw)
    # Read the original AssetBundle map directly. Environment.container eagerly
    # resolves preload dependencies and can mutate its CAB dictionary while
    # iterating it. No incidental external lookup may supply our source roots.
    roots = {}
    root_count = 0
    for asset in env.objects:
        if asset.type.name != 'AssetBundle':
            continue
        for key, info in asset.read_typetree()['m_Container']:
            ref = info['asset']
            reader = asset.assets_file.objects.get(ref['m_PathID']) if ref['m_FileID'] == 0 else None
            root_count += 1
            all_roots.append({'bundle': path, 'container': key, 'fileId': ref['m_FileID'],
                              'pathId': str(ref['m_PathID']), 'type': reader.type.name if reader else None})
            if reader is not None:
                if key in roots:
                    raise ValueError('Duplicate original container root: ' + path + '/' + key)
                roots[key] = reader
    containers[path] = roots
    bundles.append({'path': path, 'sha256': bundle['sha256'],
                    'objects': len(env.objects), 'containerRoots': root_count})

operators, gaps, ambiguities, owner_mode_skills = {}, [], [], []
for owner, record in source['operators'].items():
    targets = [('owner', f'charpack/{owner}.ab', f'dyn/battle/prefabs/characters/{owner}.prefab'),
               ('defaultArtwork', f'chararts/{owner}.ab', f'dyn/battle/prefabs/skins/character/{owner}/defaultskin.prefab')]
    out = {'skills': []}
    for role, path, key in targets:
        reader = containers[path].get(key)
        if reader is None:
            gaps.append({'owner': owner, 'role': role, 'bundle': path, 'container': key})
            out[role] = None
        else:
            out[role] = root_record(path, key, reader)
    for skill in record['skills']:
        for prefab in skill['prefabIds']:
            if prefab is None:
                # The table explicitly supplies no active prefab (Jacinta's
                # shared passive cost skill). Preserve null; its owner-mode
                # component graph needs separate review, never an empty fallback.
                owner_mode_skills.append({'owner': owner, 'skill': skill['id']})
                out['skills'].append({'id': skill['id'], 'prefabId': None, 'bindings': []})
                continue
            matches = [r for r in all_roots if r['fileId'] == 0 and r['type'] is not None
                       and r['container'].startswith('dyn/battle/prefabs/[uc]skills/')
                       and r['container'].rsplit('/', 1)[-1] == prefab + '.prefab']
            if len(matches) != 1:
                (gaps if not matches else ambiguities).append({'owner': owner, 'role': 'skill', 'skill': skill['id'],
                                                             'prefabId': prefab, 'matches': matches})
            bindings = [root_record(m['bundle'], m['container'], containers[m['bundle']][m['container']])
                        for m in matches]
            out['skills'].append({'id': skill['id'], 'prefabId': prefab, 'bindings': bindings})
    operators[owner] = out

index = {'schemaVersion': 1,
         'scope': 'Original Unity container roots for every pinned CN-only owner, default skin and selected skill prefab. Not component-graph closure or gameplay/rendering approval.',
         'enabledOperators': [], 'graphClosureVerified': False, 'animationBindingsVerified': False,
         'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
         'source': {'receipt': 'data/arkpedia-cn-native-source.json', 'receiptSha256': sha(raw_source),
                    'commit': source['source']['commit'], 'resourceVersion': source['source']['resourceVersion']},
         'summary': {'operators': len(operators), 'ownerRoots': sum(o['owner'] is not None for o in operators.values()),
                     'defaultArtworkRoots': sum(o['defaultArtwork'] is not None for o in operators.values()),
                     'selectedSkills': sum(len(o['skills']) for o in operators.values()),
                     'boundSkillPrefabs': sum(len(s['bindings']) for o in operators.values() for s in o['skills']),
                     'ownerModeSkills': len(owner_mode_skills),
                     'missingBindings': len(gaps), 'ambiguousBindings': len(ambiguities)},
         'bundles': bundles, 'operators': operators, 'ownerModeSkills': owner_mode_skills,
         'missingBindings': gaps, 'ambiguousBindings': ambiguities}
output = ROOT / 'data/arkpedia-cn-native-index.json'
output.write_text(json.dumps(index, indent=2, ensure_ascii=False) + '\n')
(CACHE / 'all-container-roots.json').write_text(json.dumps(all_roots, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(index['summary']))
