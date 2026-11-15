#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain the permanent deep-water contract, without copying body artwork."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
from prefab_evidence import read_prefabs

CACHE = ROOT / '.cache/arkpedia/cn-native-source'
manifest_raw = (CACHE / 'hot_update_list.json').read_bytes()
manifest_sha = hashlib.sha256(manifest_raw).hexdigest()
assert manifest_sha == 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
manifest = json.loads(manifest_raw)
prefabs, bundles = {}, []
for group, keys in [('skills', ['sktok_tidectrl_3']), ('tiles', ['tile_deepsea', 'tile_codpsea'])]:
    rows, bundle = read_prefabs(CACHE, manifest, f'battle/prefabs/[uc]{group}.ab', group, keys)
    prefabs.update(rows)
    bundles.append(bundle)

commit = 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add'
table_raw = (ROOT / f'.cache/arkpedia/skill_table_cn-{commit}.json').read_bytes()
assert hashlib.sha1(f'blob {len(table_raw)}\0'.encode() + table_raw).hexdigest() == '3793979c8672129489135e97727bfd9f9fd32873'
templates_raw = (CACHE / 'tables/buff_template_data.json').read_bytes()
assert hashlib.sha1(f'blob {len(templates_raw)}\0'.encode() + templates_raw).hexdigest() == 'a94bbb391fded80e59db38ad7c3ded89e25fd682'
templates = json.loads(templates_raw)
result = {'schemaVersion': 1, 'source': {
    'repository': 'Kengxxiao/ArknightsGameData', 'commit': commit,
    'resourceVersion': manifest['versionId'], 'manifestSha256': manifest_sha,
    'skillsGitBlob': '3793979c8672129489135e97727bfd9f9fd32873',
    'templatesGitBlob': 'a94bbb391fded80e59db38ad7c3ded89e25fd682'},
    'bundles': bundles, 'prefabs': prefabs,
    'skill': json.loads(table_raw)['sktok_tidectrl_3'],
    'templates': {key: templates[key] for key in ['periodic_damage_without_modify_no_fx', 'trap_sea_drown[enemy]', 'empty']}}
text = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
target = ROOT / 'data/arkpedia-water-source.json'
if '--check' in sys.argv:
    assert target.read_text() == text, 'Deep-water source changed'
else:
    target.write_text(text)
print('Verified original permanent deep-water skill and tiles')
