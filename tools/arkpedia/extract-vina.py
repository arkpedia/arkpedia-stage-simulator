#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Vina Victoria's source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-vina.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. This does not enable the kit.
Includes the operator, skills, Golden Vows token and original buff closure.
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
ID = 'char_1019_siege2'
TOKEN = 'token_10040_siege2_vlion'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_siege2_1', 'skchr_siege2_2', 'skchr_siege2_3']


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
art_env = load('chararts/' + ID + '.ab', C / ('vina-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), SKILLS)
token_bundle = 'pkgrps/btl_pfb_tokens_0.ab'
tokens = records(load(token_bundle, C / ('map-source/ab/' + token_bundle)), [TOKEN])
holder_env = load('config/buff_template_holder.ab', C / 'map-source/ab/config/buff_template_holder.ab')
ct, st, rt, bt = [read(C / (name + '.json')) for name in
    ['character_table', 'skill_table', 'range_table', 'buff_template_data']]
database = read(C / 'lessing-source/buff_table.json')
holder = next(o.read_typetree()['_templates'] for o in holder_env.objects
    if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree())
native_templates = {row['templateKey']: row for row in holder}
templates, db_keys = set(), set()
def scan(value):
    if isinstance(value, dict):
        key = value.get('buffKey') or value.get('_buffKey')
        if (value.get('loadFromDB') or 'CreateBuffById' in value.get('$type', '')) and key in database and key not in db_keys:
            db_keys.add(key); scan(database[key])
        for key, item in value.items():
            if key in ['templateKey', '_buffKey'] and isinstance(item, str) and item in bt: templates.add(item)
            else: scan(item)
    elif isinstance(value, list):
        for item in value: scan(item)
scan([characters, skills, tokens])
while True:
    count = len(templates)
    for key in list(templates): scan(bt[key])
    if count == len(templates): break
ranges = {phase['rangeId'] for phase in ct[ID]['phases'] + ct[TOKEN]['phases']}
def find_ranges(value):
    if isinstance(value, dict):
        for item in value.values(): find_ranges(item)
    elif isinstance(value, list):
        for item in value: find_ranges(item)
    elif isinstance(value, str) and value in rt: ranges.add(value)
find_ranges([ct[ID], ct[TOKEN], [st[k] for k in SKILLS], characters, skills, tokens, [bt[k] for k in templates]])
models = read(C / 'vina-source/models.json')
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
        raw = script(by[text_id])
        record = models[ID][face]
        imported = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
            'show', MODEL + ':' + record['path']])
        assert imported == raw and digest(raw) == record['sha256'] and len(raw) == record['bytes']
        bindings[ID][face] = {'animatorPathId': art['pathId'], 'skeletonAnimationPathId': str(skeleton_id),
            'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id), 'sha256': digest(raw), 'byteLength': len(raw)}
token_model = read(C / 'vina-source/golden-vows/sources.json')
models[TOKEN] = token_model['models'][TOKEN]
evidence = {'schemaVersion': 1, 'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar',
    'commit': GLOBAL, 'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [ID], 'reviewStatus': 'Reviewed local whole-kit mappings; not native controller certification',
    'characters': characters, 'skills': skills, 'tokens': tokens, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'originalTokenModel': token_model,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {TOKEN: ct[TOKEN]},
        'skills': {k: st[k] for k in SKILLS}, 'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'runtimeMapping': {
        'normal': 'One captured WALK target; alternating Attack_1/Attack_2, Arts and original .5s hit; maxAnimScale1.',
        'talent1': 'Eight neighbouring op/token recipients, excluding self by selfOption2; separate self physical resistance. Each recipient adds one ATK stack and selected S2 mark.',
        'talent2': 'First enemy modifier receipt per live source: DISARMED_COMBAT before mitigation/dodge; immunity skips the mark; mark resets on owner finish.',
        's1': 'Captured normal Arts hit plus independently selected unlimited WALK True-damage x-5 area action, once per attackId at original Skill_1 event.',
        's2': 'Two other allies enable additive rank SP regen. Skill_2_Begin gates the permanent two-target 2-2 Arts mode; ATK comes from the selected rank.',
        's3': 'Skill_3_Begin gates mode2 and summons on free LOW ground deployment tiles in x-4. Default-range targets union enemies blocked by friendly units in x-4; rank cap/ATK/flat BAT and True damage.',
        'token': 'Source phase/level interpolation, 4000HP/one block/True attacks/heal-free/zero deployment slots. One native default skeleton aliases both facing keys; cleanup uses Die_2, combat death Die_1.'},
    'verificationLimits': [
        'Original C# controller execution, event dispatch order and frame parity are not recovered from these serialized components.',
        'S1 primary Arts then area True receipt is the local ordering of the two original actions; source animation/action handoff is not certified.',
        'S2/S3 begin gating and summon dispatch run on the local combat tick. Source filter27, group-selector sorting and spatial tie handling are explicitly mapped to free surrounding tiles and local targeting; not certified native selector execution.',
        'The original Golden Vows default model has no portrait in the pinned source. Its automatic-only record has no invented portrait or manually deployable card.',
        'Native particles/audio and modules are not implemented.']}
(ROOT / 'data/arkpedia-vina-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Vina, Golden Vows, 30 source ranks and', len(templates), 'reachable templates')
