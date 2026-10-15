#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently check selected roots against original AssetBundle maps/objects."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy

parser = argparse.ArgumentParser()
parser.add_argument('--index', type=Path, default=ROOT / 'data/arkpedia-cn-native-index.json')
args = parser.parse_args()
source_file = ROOT / 'data/arkpedia-cn-native-source.json'
raw_source = source_file.read_bytes()
source = json.loads(raw_source)
index = json.loads(args.index.read_bytes())
assert index['schemaVersion'] == 1
assert index['enabledOperators'] == []
for key in ['graphClosureVerified', 'animationBindingsVerified', 'frameParity', 'moduleSupport', 'nativeParticleSupport']:
    assert index[key] is False, key
assert index['source'] == {'receipt': 'data/arkpedia-cn-native-source.json',
                           'receiptSha256': hashlib.sha256(raw_source).hexdigest(),
                           'commit': source['source']['commit'], 'resourceVersion': source['source']['resourceVersion']}
assert set(index['operators']) == set(source['operators'])
assert index['missingBindings'] == [] and index['ambiguousBindings'] == []
assert [b['path'] for b in index['bundles']] == [b['path'] for b in source['bundles']]
subprocess.run([os.environ.get('ARKPEDIA_SOURCE_NODE', 'node'), str(ROOT / 'tools/arkpedia/verify-cn-native.mjs')],
               cwd=ROOT, check=True, capture_output=True)

catalogue = {}
for expected, declared in zip(source['bundles'], index['bundles']):
    path = expected['path']
    blob = (ROOT / '.cache/arkpedia/cn-native-source/bundles' / path).read_bytes()
    assert hashlib.sha256(blob).hexdigest() == expected['sha256']
    env = UnityPy.load(blob)
    roots, count = {}, 0
    for obj in env.objects:
        if obj.type.name != 'AssetBundle':
            continue
        container_rows = obj.read_typetree()['m_Container']
        count += len(container_rows)
        for name, fields in container_rows:
            pointer = fields['asset']
            if pointer['m_FileID'] != 0:
                continue  # External containers never become local source roots.
            native = obj.assets_file.objects.get(pointer['m_PathID'])
            if native is None:
                continue
            assert name not in roots, (path, name)
            roots[name] = native
    assert declared == {'path': path, 'sha256': expected['sha256'], 'objects': len(env.objects), 'containerRoots': count}
    catalogue[path] = roots


def compare_root(declared, bundle, container):
    reader = catalogue[bundle][container]
    assert reader.type.name == 'GameObject'
    node = reader.read_typetree()
    assert declared == {'bundle': bundle, 'container': container, 'pathId': str(reader.path_id),
                        'type': 'GameObject', 'name': node['m_Name'],
                        'components': [{'fileId': entry['component']['m_FileID'],
                                        'pathId': str(entry['component']['m_PathID'])} for entry in node['m_Component']]}


mode_skills, source_skill_refs, bound_refs = [], 0, 0
for owner, expected in source['operators'].items():
    declared = index['operators'][owner]
    owner_path = f'dyn/battle/prefabs/characters/{owner}.prefab'
    art_path = f'dyn/battle/prefabs/skins/character/{owner}/defaultskin.prefab'
    compare_root(declared['owner'], f'charpack/{owner}.ab', owner_path)
    compare_root(declared['defaultArtwork'], f'chararts/{owner}.ab', art_path)
    skills = [(s['id'], p) for s in expected['skills'] for p in s['prefabIds']]
    assert [(s['id'], s['prefabId']) for s in declared['skills']] == skills
    for row, (skill, prefab) in zip(declared['skills'], skills):
        source_skill_refs += 1
        if prefab is None:
            assert row['bindings'] == []
            mode_skills.append({'owner': owner, 'skill': skill})
            continue
        candidates = [(path, name) for path, roots in catalogue.items() for name in roots
                      if name.startswith('dyn/battle/prefabs/[uc]skills/') and name.split('/')[-1] == prefab + '.prefab']
        assert len(candidates) == 1, (owner, skill, prefab, candidates)
        assert len(row['bindings']) == 1
        compare_root(row['bindings'][0], *candidates[0])
        bound_refs += 1
assert index['ownerModeSkills'] == mode_skills
assert index['summary'] == {'operators': len(source['operators']), 'ownerRoots': len(source['operators']),
                            'defaultArtworkRoots': len(source['operators']), 'selectedSkills': source_skill_refs,
                            'boundSkillPrefabs': bound_refs, 'ownerModeSkills': len(mode_skills),
                            'missingBindings': 0, 'ambiguousBindings': 0}
print(f'Verified {len(source["operators"])} original owner/default-art pairs and {bound_refs} skill-prefab roots; '
      f'{len(mode_skills)} explicit null-prefab skill stays held for owner-mode review; graph/animation/gameplay approval remains false')
