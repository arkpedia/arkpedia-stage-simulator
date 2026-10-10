#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Rosmontis's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-rosmontis.py.
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
ID = 'char_391_rosmon'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_rosmon_1', 'skchr_rosmon_2', 'skchr_rosmon_3']
TOKEN = 'token_10012_rosmon_shield'
TOKEN_SKILLS = ['sktok_rosmon']
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
art_env = load('chararts/' + ID + '.ab', C / ('rosmontis-source/' + ID + '-chararts.ab'))
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
models = read(C / 'rosmontis-source/models.json')
token_artwork = read(C / 'rosmontis-source/equipment/sources.json')
token_models = read(C / 'rosmontis-source/equipment/models.json')
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
    'reviewStatus': 'Source foundation only: aftershocks, Caster aura and tactical equipment controllers await review',
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
        'All thirty owner ranks and ten paired equipment ranks retain the pinned Global blackboards. S1 is an automatic offensive-recovery next-attack skill; S2 and S3 are manual time-recovery skills. Promotion, potential, trust and token level data are retained without registering playable support.',
        'Ordinary attacks alternate original Attack_A and Attack_B abilities. Each uses one Physical main projectile and one delayed aftershock at native delta .15, with append_atk_scale .5 and native circular radius approximately .9. Separate attack input, projectile birth, hit recipients and source-invalid behavior must not be collapsed into a generic two-target attack.',
        'S1 uses the original Attack_A clip, main Physical projectile and one .15-delayed aftershock. Only the first projectile receives the rosmon_s_1 active buff; its ON_BUFF_START applies the selected extra_atk_scale as Magical damage. The Arts receipt belongs to the main splash recipients and does not repeat on the aftershock.',
        'S2 selects mode one, applies ATK and base-attack-time percentage modifiers and fires one main plus three aftershock projectiles at .15 deltas. Native radius is 1.5 for both projectile types; the stun action rolls selected prob on each buff start. The attached-to-mount projectile has checkReached false and immediatelyReach false; damage timing cannot be inferred solely from the Skill_2 OnAttack clip marker.',
        'S3 sequences the two-tile summon ability before its mode-two switch. Its selector retains abnormalFlag20/combo2, shrink-to-two and pickMyTokenFirst; attacks use the S3 Physical projectile plus one half-scale aftershock. The selected base-attack-time value is a percentage modifier, not a flat seconds delta. Native selection/FSM and original Loop event scheduling need explicit runtime contracts.',
        'The equipment selector requires ground-buildable/passable tiles, minimum one tile and maximum two, native filter seven and random-final ordering. Created tokens carry rosmon_token_s3_mark; skill buff finish kills marked tokens and owner finish kills owned tokens. The equipment is hidden from the deck, fixed facing and occupies zero deployment slots.',
        'Equipment native born-time follows the original .133-second Start clip. Its hidden zero-SP automatic skill applies surrounding ground-target stun; its block checker feeds the selected flat DEF reduction to blocked enemies. Its passive retains heal-free and zero modifier entries, and its born withdrawal buff uses source-owned finish lifecycle. Original table HP, DEF, block and paired skill values remain separate from owner attack stats.',
        'Talent one uses native flat DEF penetration with selected promotion/potential values. Talent two checks at least one Caster profession bit32 and enables a one-recipient aura plus self option; aura removal on recipient leave and ability detach are retained. Random selection/replacement and silence/lifecycle ordering are not established by serialized fields alone.',
        'Both original operator facing skeletons match native chararts pointers and the pinned original resource commit. Tactical Equipment uses one fixed-facing original skeleton with two deliberate facing aliases, complete atlas/material/RGB-plus-alpha chain and no invented avatar. Original animation events are retained separately from visual particles, modules and compiled frame/FSM parity.'
    ],
    'holdReasons': [
        'Source-fed ordinary/S1 aftershocks, main-only Arts damage, S2 attack and per-receipt stun scheduling, and S3 blocked-recipient targeting require full selected-rank runtime verification.',
        'Caster aura recipients/lifecycle, automatic tactical equipment placement/stats/birth/stun/block debuff and owner/skill cleanup require complete controllers and original asset publication.',
        'Serialized actions and clip markers alone do not establish compiled Unity callback/FSM/frame parity. Rosmontis remains unavailable until all three skills pass public runtime integration checks.'
    ],
}
(ROOT / 'data/arkpedia-rosmontis-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Rosmontis source:', len(templates), 'templates,',
    len(projectiles), 'projectiles and', len(source_bundles), 'verified bundles')
