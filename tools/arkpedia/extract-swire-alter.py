#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Swire the Elegant Wit's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-swire-alter.py.
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
ID = 'char_1033_swire2'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_swire2_1', 'skchr_swire2_2', 'skchr_swire2_3']
TOKEN = 'token_10031_swire2_gdtrap'
TOKEN_SKILLS = ['sktok_swire2_gdtrap']
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
art_env = load('chararts/' + ID + '.ab', C / ('swire-alter-source/' + ID + '-chararts.ab'))
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
models = read(C / 'swire-alter-source/models.json')
token_artwork = read(C / 'swire-alter-source/champagne/sources.json')
token_models = read(C / 'swire-alter-source/champagne/models.json')
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
    'reviewStatus': 'Source foundation only: coin, Champagne Bomb and lethal recovery controllers await review',
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
        'All thirty owner and ten paired token ranks retain original blackboards. S1/S2 use passive zero-cost special SP; S3 retains native AUTO activation at five time-SP with unlimited duration. Selected Coin capacities are one-to-three for S1, three-to-five for S2 and ten for S3. Native coin transport uses the character SP resource, not an ordinary shared skill cooldown.',
        'Trait costs three DP every three seconds, withdraws without enough DP and refunds zero DP on retreat. Native swire2_tr clamps its negative cost, checks the paired talent/skill buffs, credits selected trait_sp and creates persistent selected ATK stacks. Elite/potential selects zero/three/four-percent ATK and zero/five/six/eight/nine stack caps.',
        'Talent1 clears native SP and grants selected starting sp on successful skill cast. Native preprocessing separately adds hidden talent key11 sp to this value; exact compiled preprocessing and resource capacity transition ordering remain unresolved.',
        'Talent2 consumes the before-HP-zero modifier only when enough DP is available, spends the current cost and doubles it. Its separate post-HP-zero event creates an immediate heal buff through HealViaMaxHpRatio, ignoring heal-free but retaining modifier events. Selected HP ratio is .7 or .8; this is not generic evasion or flat mitigation.',
        'S1 has a surrounding x-4 ally selector with HP ratio strictly below the native approximately .7 threshold, one target and an original Skill_1 OnAttack.2 event. Its healing action modifies SP at native event4. S2 randomly selects a ground/passable/buildable tile in x-6, plays Skill_2 OnAttack about .333 and spends through a separate native event4 action; their compiled callback acceptance order is unverified.',
        'The Champagne Bomb is hidden from the deck, infinite-health, zero slots, fixed facing and selects one walking enemy. Its hidden passive changes mode after three seconds. The aged attack adds one extra hit separated by about .1 seconds and feeds Slow only to the first hit; young attacks hit once. Withdrawal is dispatched at native event3, while the original hit event is .2 in a .2-second Attack clip; callback ordering must be reviewed before runtime support.',
        'S3 uses two separate original attack events about .233 and .5 per loop, gains one Coin on owner-attributed kills and snapshots native Coin SP into RandomGold times on finish before clearing it. Its ending selector uses random post-filter14, marks in-range/blockee enemies, emits source projectile speed8 at .07-second intervals and applies relative knockback. Source-invalid, lifecycle and callback ordering remain unverified.',
        'Both original operator skeletons match native chararts pointer chains. The original Champagne Bomb follows its animator, single skeleton, atlas, material, RGB and separate alpha textures with two intentional facing aliases; no alternate skin or generic trap replaces that artwork.',
    ],
    'holdReasons': [
        'Coin gain/spending/capacity and selected stacking, periodic DP consumption and doubling lethal-recovery cost need complete source-fed lifecycle controllers.',
        'S1 conditional ally healing, S2 original Champagne Bomb placement/age-trigger/owner-finish behavior and S3 two attack events/random coin-spending knockback must be integrated and verified at all ranks.',
        'Serialized fields and original animation events do not establish compiled Unity callback/FSM/frame parity. No partial skill, inherited Stronghold kit or asset-only import counts as playable support.',
    ],
}
# Keep native extraction and its original holds separate from reviewed local execution.
evidence['historicalReviewStatus'] = evidence['reviewStatus']
evidence['historicalHoldReasons'] = evidence['holdReasons']
evidence['enabledOperators'] = [ID]
evidence['heldOperators'] = []
evidence['runtimeMapping'] = {ID: 'swire-alter'}
evidence['reviewStatus'] = 'Complete ordinary kit with explicit local execution contracts'
evidence['holdReasons'] = []
evidence['runtimeContracts'] = [
    'All thirty no-module selected source ranks and public promotion, level, trust and potential feed the three ordinary-stage skills. Override inherited Merchant payment and Stronghold talent installers; source Coin economy alone owns upkeep and talent state. Native zero retreat refund is retained.',
    'Coins use a separate source-owned wallet and HUD. Active-skill upkeep charges three DP every three seconds, gains selected coins and adds capped ordinary ATK percentages; ATK survives skill end until owner finish. Starting coins, kill credit, capacity and accepted spending retain selected source values without ordinary attack-SP transport.',
    'Lethal recovery checks available DP, charges the current five/doubling cost, applies the one-HP floor and then ordinary max-HP-ratio healing. The .01-second protection window is an authored PRTS note quantized to simulation ticks; compiled Unity protection and callback parity are unverified.',
    'Ordinary attacks capture one PRECAST enemy. S1 replaces that attack with the selected lowest-HP-ratio eligible surrounding ally and consumes a coin at accepted original healing birth. S2 prefers an enemy root tile or random legal cross-range tile, rechecks CAST legality, consumes a coin and automatically creates the original zero-slot/no-card Champagne Bomb. No duplicated profession payment occurs.',
    'Bomb placement snapshots owner ATK and attack scale separately from token table stats. Original Start does not postpone arming; PRECAST age at three seconds selects one or two same-input Physical receipts with a native .1-second delta, first-receipt Slow and final-receipt withdrawal. Owner finish clears idle/unborn bombs, while an accepted delayed receipt may finish. Infinite lifetime/HP-hide flags are recorded; untargetable device category is not a blanket damage bypass.',
    'S3 automatically opens at five time-SP and retains unlimited duration. One PRECAST ordinary attack uses two separate original scaled Loop markers, full ATK per receipt and one attack identity/event. Manual cancellation snapshots closing coins once before skillEnd clears the wallet, immediately claims source frontal/blockee marks and holds ordinary SP through the original unscaled End clip.',
    'S3 ending independently chooses a currently eligible ground recipient bearing the shared mark per coin, including marked enemies outside the initial area. Original End event and .07-second native delta create speed-eight/ten-second homing shots with selected Physical coefficient, current owner ATK at impact and radial push. Mark claims, control/range rechecks, root geometry and impact ordering are local policies; born shots survive owner finish, battle finish cancels them and fresh owners cannot inherit resources.',
    'Original owner facing skeletons and Champagne Bomb skeleton/atlas/material/RGB-plus-alpha chain remain intact. Resource HUD and original clip playback are supported; original coin trails, random mount-point offsets, particles, audio, modules and compiled Unity FSM/frame parity are not implemented or certified.'
]

(ROOT / 'data/arkpedia-swire-alter-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Swire the Elegant Wit source:', len(templates), 'templates,',
    len(projectiles), 'projectiles and', len(source_bundles), 'verified bundles')
