#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Mon3tr's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-mon3tr.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Preserves native facts separately
while keeping module, native particle and compiled frame claims separate.
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
ID = 'char_4179_monstr'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_monstr_1', 'skchr_monstr_2', 'skchr_monstr_3']
TOKENS = ['token_10050_monstr_prosts']
TOKEN_SKILLS = ['sktok_monstr_prosts1', 'sktok_monstr_prosts2', 'sktok_monstr_prosts3']
PREFAB_GAPS = []
PREFABS = SKILLS + TOKEN_SKILLS

# Blob identities independently read from the pinned Global Git tree.
TABLE_GIT_BLOBS = {'buff_template_data': {'path': 'en_US/gamedata/battle/buff_template_data.json', 'sha': 'cb995e7a8d7b5569032bca40f8842ac4df4a56bf', 'size': 15472433}, 'character_table': {'path': 'en_US/gamedata/excel/character_table.json', 'sha': '5d20e09f1f8d630528b8c25bf0c09f811fdbf2da', 'size': 11459107}, 'range_table': {'path': 'en_US/gamedata/excel/range_table.json', 'sha': 'c1e28a9f2c7350bb5f5de13ba27950dca49f0de7', 'size': 42868}, 'skill_table': {'path': 'en_US/gamedata/excel/skill_table.json', 'sha': '11a76a9f2adf5859609e4f423229ff007af30e17', 'size': 9406193}}
for name, record in TABLE_GIT_BLOBS.items():
    raw = (C / (name + ".json")).read_bytes()
    assert len(raw) == record["size"], name
    assert hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() == record["sha"], name


BUFF_GIT_BLOB = {'path': 'en_US/gamedata/buff_table.json', 'sha': 'de9e0777610e3be81185ec45841f3e007b51ccbf', 'size': 126837}
buff_raw = (C / 'lessing-source/buff_table.json').read_bytes()
assert len(buff_raw) == BUFF_GIT_BLOB['size']
assert hashlib.sha1(b'blob ' + str(len(buff_raw)).encode() + b'\0' + buff_raw).hexdigest() == BUFF_GIT_BLOB['sha']

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
    names, game_objects, transform_go = {}, {}, {}
    children, components = defaultdict(list), defaultdict(list)
    for obj in env.objects:
        if obj.type.name == 'GameObject':
            game_objects[obj.path_id] = exact(obj.read_typetree())
            names[obj.path_id] = game_objects[obj.path_id]['m_Name']
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
        return [{'object': names[go], 'pathId': str(go), 'gameObjectData': game_objects[go], 'components': components[go]}
                for go in sorted(wanted) if components[go]]

    if roots is not None:
        return {name: group(name) for name in roots}
    return [{'object': names[go], 'pathId': str(go), 'gameObjectData': game_objects[go], 'components': components[go]}
            for go in sorted(names) if components[go]]

characters = {ID: records(load('charpack/' + ID + '.ab', C / ('all-operator-source/' + ID + '.ab')))}
tokens = records(load('pkgrps/btl_pfb_tokens_0.ab', C / 'map-source/ab/pkgrps/btl_pfb_tokens_0.ab'), TOKENS)
art_env = load('chararts/' + ID + '.ab', C / ('mon3tr-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
skill_env = load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab')
assert not set(PREFAB_GAPS) & {o.read().m_Name for o in skill_env.objects if o.type.name == 'GameObject'}
skills = records(skill_env, PREFABS)
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
# These serialized fields name blackboard parameters, not projectile assets.
# Unknown projectile names in all other fields still fail extraction.
PROJECTILE_PARAMETER_FIELDS = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey', '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey'}
def scan(value, key=""):
    if key in ["_overrideAudioSignal", "audioSignal"]: return
    if isinstance(value, dict):
        for name, item in value.items(): scan(item, name)
    elif isinstance(value, list):
        for item in value: scan(item, key)
    elif isinstance(value, str):
        if value.startswith('projectile_') and key not in PROJECTILE_PARAMETER_FIELDS and value not in projectiles:
            assert value in projectile_names, ('unresolved projectile dependency', value)
            projectiles.update(records(projectile_env, [value])); scan(projectiles[value])
        if (value in bt or value in native_templates) and value not in templates:
            templates.add(value); scan(bt.get(value, {})); scan(native_templates.get(value, {}))
        if value in database and value not in db_keys:
            db_keys.add(value); scan(database[value])
        if value.startswith(('[', '{')):
            try: decoded = json.loads(value)
            except json.JSONDecodeError: return
            scan(decoded)
scan([characters, tokens, skills, ct[ID], [ct[k] for k in TOKENS], [st[k] for k in SKILLS + TOKEN_SKILLS]])
ranges = {phase['rangeId'] for character in [ct[ID], *(ct[k] for k in TOKENS)] for phase in character['phases']}
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
find_ranges([ct[ID], [ct[k] for k in TOKENS], [st[k] for k in SKILLS + TOKEN_SKILLS], characters, tokens, skills,
    projectiles, [bt[k] for k in templates if k in bt], [native_templates[k] for k in templates if k in native_templates],
    [database[k] for k in db_keys]])
models = read(C / 'mon3tr-source/models.json')
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

# Preserve Reconstruction's original animator and embedded facing chains.
token_bindings = {}
by = bundles['pkgrps/btl_pfb_tokens_0.ab']
out = C / 'mon3tr-source'
for token in TOKENS:
    root = next(row for row in tokens[token] if row['object'] == token)
    controller = next(c for c in root['components'] if '_animator' in c['data'])

    def reference(value):
        assert value['m_FileID'] == 0
        path_id = int(value['m_PathID'])
        assert path_id in by
        return path_id

    animator_id = reference(controller['data']['_animator'])
    animator = by[animator_id].read_typetree()
    if '_skeleton' not in animator and '_front' not in animator:
        assert set(animator) == {'m_GameObject', 'm_Enabled', 'm_Script', 'm_Name',
            '_hitTransform', '_headTransform', '_muzzle', '_effectWhiteList'}
        token_bindings[token] = {'bundle': 'pkgrps/btl_pfb_tokens_0.ab',
            'rootPathId': root['pathId'], 'controllerPathId': controller['pathId'],
            'animatorPathId': str(animator_id), 'renderingKind': 'effect-only',
            'animatorData': exact(animator), 'facings': {}, 'animationAliases': []}
        continue
    face_id = reference(animator['_faceSwitcher'])
    pointers = {'Single': animator['_skeleton']} if '_skeleton' in animator else {
        face.title(): animator['_' + face]['skeleton'] for face in ['front', 'back', 'down']
        if '_' + face in animator and animator['_' + face]['skeleton']['m_PathID'] != 0}
    facings = {}
    for face, pointer in pointers.items():
        skeleton_id = reference(pointer)
        skeleton = by[skeleton_id].read_typetree()
        asset_id = reference(skeleton['skeletonDataAsset'])
        asset = by[asset_id].read_typetree()
        text_id = reference(asset['skeletonJSON'])
        assert len(asset['atlasAssets']) == 1
        atlas_id = reference(asset['atlasAssets'][0])
        atlas = by[atlas_id].read_typetree()
        atlas_text_id = reference(atlas['atlasFile'])
        raw, atlas_raw = script(by[text_id]), script(by[atlas_text_id])
        stem = token + '-' + face.lower()
        (out / (stem + '.skel')).write_bytes(raw)
        (out / (stem + '.atlas')).write_bytes(atlas_raw)
        facings[face] = {'skeletonAnimationPathId': str(skeleton_id),
            'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id),
            'atlasAssetPathId': str(atlas_id), 'atlasTextAssetPathId': str(atlas_text_id),
            'sha256': digest(raw), 'byteLength': len(raw),
            'atlasSha256': digest(atlas_raw), 'atlasByteLength': len(atlas_raw)}
    token_bindings[token] = {'bundle': 'pkgrps/btl_pfb_tokens_0.ab',
        'rootPathId': root['pathId'], 'controllerPathId': controller['pathId'],
        'animatorPathId': str(animator_id), 'facings': facings,
        'faceSwitcherPathId': str(face_id), 'faceSwitcher': exact(by[face_id].read_typetree()),
        'animationAliases': exact(animator['_animations'])}
(out / 'token-bindings.json').write_text(json.dumps(token_bindings, indent=2) + '\n')
subprocess.check_call(['node', 'tools/arkpedia/inspect-mon3tr.mjs', '--tokens'], cwd=ROOT)
token_models = read(out / 'token-models.json')
evidence = {
    'schemaVersion': 1,
    'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar', 'commit': GLOBAL,
        'nativeClient': CLIENT, 'tableGitBlobs': TABLE_GIT_BLOBS,
        'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
            for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
        'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'gitBlob': BUFF_GIT_BLOB,
            'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
        'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Native source foundation; complete public kit remains unreviewed',
    'characters': characters, 'tokens': tokens, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'tokenModels': token_models,
    'officialTokenSkeletonBindings': token_bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates) if k in bt},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {k: ct[k] for k in TOKENS}, 'tokenSkills': {k: st[k] for k in TOKEN_SKILLS}, 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'jsonTemplateGaps': sorted(templates - bt.keys()),
    'nativeSkillPrefabGaps': PREFAB_GAPS,
    'recoveredFacts': [],
    'holdReasons': ['Chain healing, Reconstruction lifecycle/inheritance, heal-triggered buffs, S1/S2, S3 movement/mode/return, death interception, artwork and public lifecycle require review'],
}
(ROOT / 'data/arkpedia-mon3tr-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Mon3tr source:', len(templates), 'templates,', len(projectiles), 'projectile trees and', len(source_bundles), 'verified bundles')
