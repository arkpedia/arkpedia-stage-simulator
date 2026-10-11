#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Wisadel's complete source foundation from checksum-verified original bytes.

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
ID = 'char_1035_wisdel'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_wisdel_1', 'skchr_wisdel_2', 'skchr_wisdel_3']
TOKEN = 'token_10035_wisdel_wward'
TOKEN_SKILLS = ['sktok_wisdel_wward']
PREFABS = SKILLS + TOKEN_SKILLS

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
tokens = records(load('pkgrps/btl_pfb_tokens_0.ab', C / 'map-source/ab/pkgrps/btl_pfb_tokens_0.ab'), [TOKEN])
art_env = load('chararts/' + ID + '.ab', C / ('wisadel-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), PREFABS)
projectile_env = load('battle/prefabs/[uc]projectiles.ab', C / 'map-source/ab/battle/prefabs/[uc]projectiles.ab')
projectiles = {}
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
        for item in value.values(): scan(item)
    elif isinstance(value, list):
        for item in value: scan(item)
    elif isinstance(value, str):
        # Serialized action graphs retain their exact string bytes in the
        # evidence, but references inside those graphs must enter the closure.
        # projectile_range is a blackboard parameter, not a prefab reference.
        if value.startswith('projectile_') and value != 'projectile_range' and value not in projectiles:
            projectiles.update(records(projectile_env, [value]))
            scan(projectiles[value])
        if value in bt and value not in templates:
            templates.add(value); scan(bt[value])
        if value in database and value not in db_keys:
            db_keys.add(value); scan(database[value])
        if value.startswith(('[', '{')):
            try: decoded = json.loads(value)
            except json.JSONDecodeError: return
            scan(decoded)
scan([characters, tokens, skills, ct[ID], ct[TOKEN], [st[k] for k in PREFABS]])
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
find_ranges([ct[ID], ct[TOKEN], [st[k] for k in PREFABS], characters, tokens, skills, projectiles, [bt[k] for k in templates]])
models = read(C / 'wisadel-source/models.json')
token_artwork = read(C / 'wisadel-source/equipment/sources.json')
token_models = read(C / 'wisadel-source/equipment/models.json')
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
    'reviewStatus': 'Private ordinary/S1/S2/S3 and Shadow components checked separately; full kit remains unavailable pending public integration',
    'characters': characters, 'tokens': tokens, 'skills': skills, 'chararts': chararts,
    'models': models, 'tokenArtwork': token_artwork, 'tokenModels': token_models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'token': ct[TOKEN], 'skills': {k: st[k] for k in SKILLS},
        'tokenSkills': {k: st[k] for k in TOKEN_SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'recoveredFacts': [
        'The native ordinary selector has three attack abilities, disallows consecutive repeats and does not require visiting every ability once.',
        'Ordinary/S1 owner attack events occur at 0.6s; S2 loops at 0.267s and S3 loops at 0.533s in the pinned original skeletons.',
        'Ordinary, S2, S1 and S3 projectile collision radii are 0.9, 0.9, 1.1 and 2.5 tiles; ordinary/S1/S3 reached delay is 0.15s.',
        'Afterimage ownership follows the source talent buff; detonation checks probability and a shared mark, applies a 1.1-tile all-motion physical explosion without requiring a live centre, then consumes the mark.',
        'All ten S1 ranks preserve offensive SP and next-attack aftershock/stun coefficients; the native skill graph retains distinct common, shock and terminal stun abilities.',
        'S2 is explicitly an overload skill with ordinary skill mode 1 and overload mode 2; its BAT modifier is additive and the overload attack adds three emissions at 0.1s spacing.',
        'All ten S3 ranks preserve ammunition, additive BAT and immediate Shadow counts; M3 grants six rounds and two new Shadows. The new-token SP action checks and consumes a host marker.',
        'Revenant Shadows have a zero deployment-limit occupation count; their native notShowInDeck flag is false, so automatic local spawning must not misrepresent that flag.',
        'The Shadow aura uses x-5 and validates its host before granting Camouflage; owner finish invokes KillTokens and S3 text explicitly preserves Shadows after skill expiry.',
        'The original Shadow uses one skeleton with a left/right switcher and embedded 216x216 RGBA texture; front/back import aliases preserve those same source bytes.'
    ],
    'holdReasons': [
        'Ordinary/S1/S2/S3 controllers and the Shadow helper are private; full selected-loadout/public lifecycle integration and browser review remain required.',
        'S3 cached ATK, ammunition-holder clocks and persistent Shadow/SP integration use reviewed local mappings; public transaction and lifecycle tests remain required.',
        'Disabled Shadow ordinary-trigger binding, original Shadow publication, selected-loadout/public lifecycle tests and browser review remain open; serialized data does not establish compiled frame parity.'
    ],
}
(ROOT / 'data/arkpedia-wisadel-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Wisadel source:', len(templates), 'templates,', len(projectiles), 'projectile trees and', len(source_bundles), 'verified bundles')
