#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover Akkord's pinned CN hierarchy, skill and transitive template inputs."""
from collections import defaultdict
from pathlib import Path
import hashlib
import json
import math
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
C = ROOT / '.cache/arkpedia'
OUT = C / 'akkord-source'
OUT.mkdir(parents=True, exist_ok=True)
ID = 'char_4051_akkord'
SKILLS = ['skchr_akkord_1', 'skchr_akkord_2']
CN = 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add'
NODE = os.environ.get('ARKPEDIA_SOURCE_NODE', 'node')
subprocess.run([NODE, str(ROOT / 'tools/arkpedia/verify-cn-native.mjs')], check=True, capture_output=True, cwd=ROOT)
inventory_raw = (ROOT / 'data/arkpedia-cn-native-source.json').read_bytes()
inventory = json.loads(inventory_raw)
cn = json.loads((ROOT / 'data/arkpedia-cn-source.json').read_bytes())
assert cn['source']['commit'] == CN


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    return json.loads(path.read_bytes())


def exact(v, key=''):
    if isinstance(v, dict):
        return {k: exact(x, k) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [exact(x, key) for x in v]
    if key == 'm_PathID':
        return str(v)
    if isinstance(v, float) and not math.isfinite(v):
        return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v


tables = {r['path'].rsplit('/', 1)[-1]: r for r in cn['source']['tables']}
extra = [
    {'path': 'zh_CN/gamedata/battle/buff_template_data.json', 'bytes': 27996217,
     'gitBlob': 'a94bbb391fded80e59db38ad7c3ded89e25fd682'},
    {'path': 'zh_CN/gamedata/buff_table.json', 'bytes': 176162,
     'gitBlob': 'b588d86b514d61c0025c0d9534f2a4e548aae302'},
]
raw_tables, table_sources = {}, {}
for row in list(tables.values()) + extra:
    filename = row['path'].rsplit('/', 1)[-1]
    path = C / ('cn-native-source/tables/' if row in extra else 'cn-coverage/') / filename
    raw = path.read_bytes()
    assert len(raw) == row['bytes']
    assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == row['gitBlob']
    table_sources[filename] = {**row, 'sha256': sha(raw)}
    raw_tables[filename] = json.loads(raw)
ct, st, rt = [raw_tables[k + '.json'] for k in ['character_table', 'skill_table', 'range_table']]
bt, database = raw_tables['buff_template_data.json'], raw_tables['buff_table.json']
assert ct[ID] == cn['tables']['characters'][ID]
bundles, objects, source_bundles = {}, {}, []


def load(path):
    expected = next(r for r in inventory['bundles'] if r['path'] == path)
    raw = (C / 'cn-native-source/bundles' / path).read_bytes()
    assert len(raw) == expected['bytes'] and sha(raw) == expected['sha256']
    env = UnityPy.load(raw)
    bundles[path] = env
    objects[path] = {o.path_id: o for o in env.objects}
    source_bundles.append(expected)
    return env


def records(env, root_name):
    gos, names, transform_go, children, parts = {}, {}, {}, defaultdict(list), defaultdict(list)
    for o in env.objects:
        if o.type.name == 'GameObject':
            d = o.read_typetree(); gos[o.path_id] = exact(d); names[o.path_id] = d['m_Name']
        elif o.type.name == 'Transform':
            d = o.read_typetree(); go = d['m_GameObject']['m_PathID']
            transform_go[o.path_id] = go; children[d['m_Father']['m_PathID']].append(o.path_id)
            parts[go].append({'pathId': str(o.path_id), 'data': exact(d)})
        elif o.type.name in ['MonoBehaviour', 'CircleCollider2D', 'BoxCollider2D', 'SphereCollider', 'BoxCollider']:
            d = o.read_typetree(); parts[d['m_GameObject']['m_PathID']].append({'pathId': str(o.path_id), 'data': exact(d)})
    roots = [tr for tr, go in transform_go.items() if names[go] == root_name]
    assert len(roots) == 1, (root_name, roots)
    chosen = set()

    def visit(tr):
        go = transform_go[tr]
        if go in chosen:
            return
        chosen.add(go)
        for child in children[tr]:
            visit(child)

    visit(roots[0])
    return [{'object': names[go], 'pathId': str(go), 'gameObjectData': gos[go], 'components': parts[go]}
            for go in sorted(chosen) if parts[go]]


owner_env = load('charpack/' + ID + '.ab')
characters = {ID: records(owner_env, ID)}
art_path = 'chararts/' + ID + '.ab'
art_env = load(art_path)
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())} for o in art_env.objects
                if o.type.name == 'MonoBehaviour' and '_animations' in o.read_typetree()]}
assert len(chararts[ID]) == 1
skill_env = load('battle/prefabs/[uc]skills.ab')
skills = {key: records(skill_env, key) for key in SKILLS}
projectile_env = load('battle/prefabs/[uc]projectiles.ab')
holder_env = load('config/buff_template_holder.ab')
holder = [o.read_typetree()['_templates'] for o in holder_env.objects
          if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree()]
assert len(holder) == 1
native = {row['templateKey']: row for row in holder[0]}
projectile_names = {o.read().m_Name for o in projectile_env.objects if o.type.name == 'GameObject'}
templates, db_keys, projectiles = set(), set(), {}
parameter_fields = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey',
                    '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey'}


def scan(v, key=''):
    if key in ['_overrideAudioSignal', 'audioSignal']:
        return
    if isinstance(v, dict):
        for k, x in v.items():
            scan(x, k)
    elif isinstance(v, list):
        for x in v:
            scan(x, key)
    elif isinstance(v, str):
        if v.startswith('projectile_') and key not in parameter_fields and v not in projectiles:
            assert v in projectile_names, ('unresolved projectile', v)
            projectiles[v] = records(projectile_env, v); scan(projectiles[v])
        if (v in bt or v in native) and v not in templates:
            templates.add(v); scan(bt.get(v, {})); scan(native.get(v, {}))
        if v in database and v not in db_keys:
            db_keys.add(v); scan(database[v])
        if v.startswith(('[', '{')):
            try:
                decoded = json.loads(v)
            except json.JSONDecodeError:
                return
            scan(decoded)


scan([characters, skills, ct[ID], [st[k] for k in SKILLS]])
ranges = set()


def find_ranges(v):
    if isinstance(v, dict):
        for x in v.values():
            find_ranges(x)
    elif isinstance(v, list):
        for x in v:
            find_ranges(x)
    elif isinstance(v, str):
        if v in rt:
            ranges.add(v)
        if v.startswith(('[', '{')):
            try:
                decoded = json.loads(v)
            except json.JSONDecodeError:
                return
            find_ranges(decoded)


find_ranges([ct[ID], [st[k] for k in SKILLS], characters, skills, projectiles,
             [bt[k] for k in templates if k in bt], [native[k] for k in templates if k in native]])
bindings = {}
art = chararts[ID][0]['data']
by = objects[art_path]
for face in ['Front', 'Back']:
    pointer = art['_' + face.lower()]['skeleton']
    assert pointer['m_FileID'] == 0
    skel_id = int(pointer['m_PathID'])
    skeleton = by[skel_id].read_typetree()
    asset_id = skeleton['skeletonDataAsset']['m_PathID']
    asset = by[asset_id].read_typetree()
    text_id = asset['skeletonJSON']['m_PathID']
    atlas_id = asset['atlasAssets'][0]['m_PathID']
    atlas = by[atlas_id].read_typetree()
    atlas_text_id = atlas['atlasFile']['m_PathID']

    def text_bytes(reader):
        v = reader.read().m_Script
        return v.encode('utf8', 'surrogateescape') if isinstance(v, str) else bytes(v)

    raw, atlas_raw = text_bytes(by[text_id]), text_bytes(by[atlas_text_id])
    stem = face.lower()
    (OUT / (stem + '.skel')).write_bytes(raw); (OUT / (stem + '.atlas')).write_bytes(atlas_raw)
    bindings[face] = {'animatorPathId': chararts[ID][0]['pathId'], 'skeletonAnimationPathId': str(skel_id),
                      'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id),
                      'atlasAssetPathId': str(atlas_id), 'atlasTextAssetPathId': str(atlas_text_id),
                      'sha256': sha(raw), 'bytes': len(raw), 'atlasSha256': sha(atlas_raw), 'atlasBytes': len(atlas_raw)}
subprocess.run([NODE, str(ROOT / 'tools/arkpedia/inspect-akkord.mjs')], check=True, cwd=ROOT)
evidence = {'schemaVersion': 1,
            'source': {'repository': inventory['source']['repository'], 'commit': CN,
                       'nativeClient': inventory['source']['resourceVersion'], 'nativeInventorySha256': sha(inventory_raw),
                       'tableGitBlobs': table_sources, 'bundles': source_bundles},
            'enabledOperators': [], 'heldOperators': [ID], 'frameParity': False, 'moduleSupport': False,
            'nativeParticleSupport': False, 'characters': characters, 'skills': skills, 'chararts': chararts,
            'projectiles': projectiles, 'templates': {k: bt[k] for k in sorted(templates) if k in bt},
            'originalTemplates': {k: native[k] for k in sorted(templates) if k in native},
            'buffDatabase': {k: database[k] for k in sorted(db_keys)},
            'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS}, 'ranges': {k: rt[k] for k in sorted(ranges)}},
            'officialSkeletonBindings': {ID: bindings}, 'models': {ID: read(OUT / 'models.json')},
            'nativeTemplateGaps': sorted(templates - native.keys()), 'jsonTemplateGaps': sorted(templates - bt.keys()),
            'reviewStatus': 'Pinned CN source recovery; complete combat, artwork delivery and public review remain separate'}
(ROOT / 'data/arkpedia-akkord-prefabs.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'components': sum(len(r['components']) for group in [characters, skills, projectiles]
                                   for rows in group.values() for r in rows), 'templates': sorted(templates),
                  'projectiles': list(projectiles), 'ranges': sorted(ranges),
                  'nativeTemplateGaps': evidence['nativeTemplateGaps'], 'jsonTemplateGaps': evidence['jsonTemplateGaps']}))
