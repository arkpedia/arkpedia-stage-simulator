#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Lappland the Decadenza's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-wisadel.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Preserves native facts separately
while leaving the unreviewed full kit unavailable.
"""
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 -- original client's LZ4 decoder
import UnityPy

C = ROOT / '.cache/arkpedia'
ID = 'char_1038_whitw2'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_whitw2_1', 'skchr_whitw2_2', 'skchr_whitw2_3']
PREFABS = SKILLS

# Blob identities independently read from the pinned Global Git tree.
TABLE_GIT_BLOBS = {'buff_template_data': {'path': 'en_US/gamedata/battle/buff_template_data.json', 'sha': 'cb995e7a8d7b5569032bca40f8842ac4df4a56bf', 'size': 15472433}, 'character_table': {'path': 'en_US/gamedata/excel/character_table.json', 'sha': '5d20e09f1f8d630528b8c25bf0c09f811fdbf2da', 'size': 11459107}, 'range_table': {'path': 'en_US/gamedata/excel/range_table.json', 'sha': 'c1e28a9f2c7350bb5f5de13ba27950dca49f0de7', 'size': 42868}, 'skill_table': {'path': 'en_US/gamedata/excel/skill_table.json', 'sha': '11a76a9f2adf5859609e4f423229ff007af30e17', 'size': 9406193}}
for name, record in TABLE_GIT_BLOBS.items():
    raw = (C / (name + ".json")).read_bytes()
    assert len(raw) == record["size"], name
    assert hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() == record["sha"], name


def read(path):
    return json.loads(path.read_text())


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def exact(value, key=''):
    if isinstance(value, dict):
        return {k: exact(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [exact(v) for v in value]
    if key == 'm_PathID':
        return str(value)
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def script(obj):
    value = obj.read().m_Script
    return value.encode('utf8', 'surrogateescape') if isinstance(value, str) else bytes(value)


hot = read(C / 'map-source/hot_update_list.json')
assert hot['versionId'] == CLIENT
source_bundles = []
bundles = {}


def load(name, local):
    raw = local.read_bytes()
    source = next(r for r in hot['abInfos'] if r['name'] == name)
    assert len(raw) == source['abSize'] and hashlib.md5(raw).hexdigest() == source['md5'], name
    source_bundles.append({'path': name, 'size': len(raw), 'md5': source['md5'], 'sha256': digest(raw)})
    env = UnityPy.load(raw)
    bundles[name] = {o.path_id: o for o in env.objects}
    return env


def records(env, roots=None):
    names, transform_go = {}, {}
    children, components = defaultdict(list), defaultdict(list)
    for obj in env.objects:
        if obj.type.name == 'GameObject':
            names[obj.path_id] = obj.read().m_Name
        elif obj.type.name == 'Transform':
            data = obj.read_typetree()
            go = data['m_GameObject']['m_PathID']
            transform_go[obj.path_id] = go
            children[data['m_Father']['m_PathID']].append(obj.path_id)
            components[go].append({'pathId': str(obj.path_id), 'data': exact(data)})
        elif obj.type.name in ['MonoBehaviour', 'CircleCollider2D', 'BoxCollider2D', 'SphereCollider', 'BoxCollider']:
            data = obj.read_typetree()
            components[data['m_GameObject']['m_PathID']].append({'pathId': str(obj.path_id), 'data': exact(data)})

    def group(name):
        wanted = set()

        def visit(transform):
            go = transform_go[transform]
            if go in wanted:
                return
            wanted.add(go)
            for child in children[transform]:
                visit(child)

        for transform, go in transform_go.items():
            if names.get(go) == name:
                visit(transform)
        assert wanted, name
        return [{'object': names[go], 'pathId': str(go), 'components': components[go]}
                for go in sorted(wanted) if components[go]]

    if roots is not None:
        return {name: group(name) for name in roots}
    return [{'object': names[go], 'pathId': str(go), 'components': components[go]}
            for go in sorted(names) if components[go]]

characters = {ID: records(load('charpack/' + ID + '.ab', C / ('all-operator-source/' + ID + '.ab')))}
art_env = load('chararts/' + ID + '.ab', C / ('lappland-alter-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), PREFABS)
projectile_env = load('battle/prefabs/[uc]projectiles.ab', C / 'map-source/ab/battle/prefabs/[uc]projectiles.ab')
projectiles = {}
projectile_names = {o.read().m_Name for o in projectile_env.objects if o.type.name == 'GameObject'}
holder_env = load('config/buff_template_holder.ab', C / 'map-source/ab/config/buff_template_holder.ab')
ct, st, rt, bt = [read(C / (name + '.json')) for name in
    ['character_table', 'skill_table', 'range_table', 'buff_template_data']]
database = read(C / 'lessing-source/buff_table.json')
holder = next(o.read_typetree()['_templates'] for o in holder_env.objects
    if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree())
native_templates = {row['templateKey']: row for row in holder}
templates, db_keys = set(), set()
def scan(value, key=""):
    if key in ["_overrideAudioSignal", "audioSignal"]: return
    if isinstance(value, dict):
        for name, item in value.items(): scan(item, name)
    elif isinstance(value, list):
        for item in value: scan(item)
    elif isinstance(value, str):
        if value.startswith('projectile_') and value != 'projectile_range' and value not in projectiles:
            assert value in projectile_names, ('unresolved projectile dependency', value)
            projectiles.update(records(projectile_env, [value])); scan(projectiles[value])
        if value in bt and value not in templates:
            templates.add(value); scan(bt[value])
        if value in database and value not in db_keys:
            db_keys.add(value); scan(database[value])
        if value.startswith(('[', '{')):
            try: decoded = json.loads(value)
            except json.JSONDecodeError: return
            scan(decoded)
scan([characters, skills, ct[ID], [st[k] for k in PREFABS]])
ranges = {phase['rangeId'] for phase in ct[ID]['phases']}
def find_ranges(value):
    if isinstance(value, dict):
        for item in value.values(): find_ranges(item)
    elif isinstance(value, list):
        for item in value: find_ranges(item)
    elif isinstance(value, str):
        if value in rt: ranges.add(value)
        if value.startswith(('[', '{')):
            try: decoded = json.loads(value)
            except json.JSONDecodeError: return
            find_ranges(decoded)
find_ranges([ct[ID], [st[k] for k in PREFABS], characters, skills, projectiles, [bt[k] for k in templates]])
models = read(C / 'lappland-alter-source/models.json')
bindings = {ID: {}}
by = bundles['chararts/' + ID + '.ab']
for art in chararts[ID]:
    if '_animations' not in art['data']: continue
    for face in ['Front', 'Back']:
        ref = art['data']['_' + face.lower()]['skeleton']
        assert ref['m_FileID'] == 0
        skeleton_id = int(ref['m_PathID'])
        skeleton = by[skeleton_id].read_typetree()
        asset_id = skeleton['skeletonDataAsset']['m_PathID']
        asset = by[asset_id].read_typetree()
        text_id = asset['skeletonJSON']['m_PathID']
        raw = script(by[text_id]); record = models[ID][face]
        imported = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
            'show', MODEL + ':' + record['path']])
        assert imported == raw and digest(raw) == record['sha256'] and len(raw) == record['bytes']
        bindings[ID][face] = {'animatorPathId': art['pathId'], 'skeletonAnimationPathId': str(skeleton_id),
            'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id), 'sha256': digest(raw), 'byteLength': len(raw)}
evidence = {
    'schemaVersion': 1,
    'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar', 'commit': GLOBAL,
        'nativeClient': CLIENT, 'tableGitBlobs': TABLE_GIT_BLOBS,
        'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
            for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
        'buffDatabase': {'path': 'en_US/gamedata/buff_table.json',
            'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
        'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Original no-module kit evidence; runtime adaptation remains required',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'recoveredFacts': [
        'The ordinary Funnel trait uses 0.2 initial ATK scale, 0.15 increment, 1.1 cap and six stacks; native ordinary mode has three drone action slots and one shared ability.',
        'Alpha Wolf has three ordered native branches: max-scale multiplier, silence mark, then one additional drone for all four named Funnel modes. Its final branch finishes the timer rather than inventing recurring drone growth.',
        'Honor of Siracusa applies modify_sp[born] through a Siracusa deck filter; base E2 grants five SP and potential rank two grants six. The no-module attack_speed blackboard is zero.',
        'S1 attaches an extra-ability passive, switches between native modes one and zero, and has an all-motion postFilter 58 selector for each remote drone; its owner loop event is 0.167 seconds rather than the ordinary 0.4 seconds.',
        'S2 has six serialized independent Funnel slots, each with its own selector and original projectile; ten ranks preserve ATK, duration, time SP and the probabilistic Fear action.',
        'S3 has four separate cruise/attachment projectile pairs and four corresponding attack abilities. The native controller starts them at radius 0.5 and clears its projectiles when detached.',
        'Original S3 spread starts at speed 0.1, accelerates by approximately 1.9 per second to two; chase starts at two and accelerates by one to four, with turn speed five and inertia enabled. Native idle orbit radius is 1.25 at speed one.',
        'S3 slow/Arts damage is a one-stack, non-independent-source buff triggered every second with no initial wait. Its action retains normal attack type; aura damage is not a second owner attack event.',
        'Original owner Front/Back skeleton pointers and bytes match the pinned resource repository, including all skill events; the drone visual signals are preserved in the serialized evidence but their particles are not yet rendered.',
    ],
    'holdReasons': ['Original drone movement, ordinary/S1/S2/S3 execution, talent/squad lifecycle, full-kit tests and browser review remain required.'],
}
(ROOT / 'data/arkpedia-lappland-alter-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Lappland source:', len(templates), 'templates,', len(projectiles), 'projectile trees and', len(source_bundles), 'verified bundles')
