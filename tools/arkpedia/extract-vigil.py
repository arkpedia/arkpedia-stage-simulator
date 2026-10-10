#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Vigil's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-vigil.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Runtime registration is reviewed separately.
Preserves all source ranks, trait/talent actions and owner/Wolfpack lifecycle,
projectile and summon dependencies.
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
ID = 'char_427_vigil'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
TOKEN = 'token_10028_vigil_wolf'
SKILLS = ['skchr_vigil_1', 'skchr_vigil_2', 'skchr_vigil_3']
TOKEN_SKILLS = ['sktok_vigil_wolf_1', 'sktok_vigil_wolf_2', 'sktok_vigil_wolf_3']
PREFABS = SKILLS + TOKEN_SKILLS


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
art_env = load('chararts/' + ID + '.ab', C / ('vigil-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
# Retain the linked original facing controller as well as both animator chains.
art_by = bundles['chararts/' + ID + '.ab']
for face_id in sorted({int(r['data']['_faceSwitcher']['m_PathID']) for r in chararts[ID]
    if '_faceSwitcher' in r['data']}):
    chararts[ID].append({'pathId': str(face_id), 'data': exact(art_by[face_id].read_typetree())})
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), PREFABS)
tokens = records(load('pkgrps/btl_pfb_tokens_0.ab', C / 'map-source/ab/pkgrps/btl_pfb_tokens_0.ab'), [TOKEN])
token_by = bundles['pkgrps/btl_pfb_tokens_0.ab']
token_animator_id = next(int(c['data']['_animator']['m_PathID']) for r in tokens[TOKEN] for c in r['components'] if '_animator' in c['data'])
token_animator = token_by[token_animator_id].read_typetree()
token_skeleton_id = token_animator['_skeleton']['m_PathID']
token_skeleton = token_by[token_skeleton_id].read_typetree()
token_asset_id = token_skeleton['skeletonDataAsset']['m_PathID']
token_asset = token_by[token_asset_id].read_typetree()
token_text_id = token_asset['skeletonJSON']['m_PathID']
assert token_by[token_text_id].read().m_Name == TOKEN + '.skel'
out = C / 'vigil-source/wolfpack'
out.mkdir(exist_ok=True)
(out / (TOKEN + '.skel')).write_bytes(script(token_by[token_text_id]))
assert len(token_asset['atlasAssets']) == 1
token_atlas_id = token_asset['atlasAssets'][0]['m_PathID']
token_atlas = token_by[token_atlas_id].read_typetree()
token_atlas_text_id = token_atlas['atlasFile']['m_PathID']
assert token_by[token_atlas_text_id].read().m_Name == TOKEN + '.atlas'
(out / (TOKEN + '.atlas')).write_bytes(script(token_by[token_atlas_text_id]))
subprocess.check_call(['node', 'tools/arkpedia/inspect-vigil.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
original_token_art = [{'pathId': str(i), 'data': exact(token_by[i].read_typetree())} for i in [token_animator_id, token_skeleton_id, token_asset_id, token_atlas_id, token_animator['_faceSwitcher']['m_PathID']]]
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
        for key, item in value.items():
            # Blackboard key names (e.g. projectile_range) are parameters, not prefab references.
            if key == 'key' and 'value' in value: continue
            scan(item)
    elif isinstance(value, list):
        for item in value: scan(item)
    elif isinstance(value, str):
        # Serialized action graphs retain their exact string bytes in the
        # evidence, but references inside those graphs must enter the closure.
        if value.startswith('projectile_') and value not in projectiles:
            projectiles.update(records(projectile_env, [value]))
            scan(projectiles[value])
        if value in bt and value not in templates:
            templates.add(value); scan(bt[value]); scan(native_templates.get(value, {}))
        if value in database and value not in db_keys:
            db_keys.add(value); scan(database[value])
        if value.startswith(('[', '{')):
            try: decoded = json.loads(value)
            except json.JSONDecodeError: return
            scan(decoded)
scan([characters, skills, tokens, ct[ID], ct[TOKEN], [st[k] for k in SKILLS + TOKEN_SKILLS]])
ranges = {phase['rangeId'] for phase in ct[ID]['phases'] + ct[TOKEN]['phases']}
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
find_ranges([ct[ID], ct[TOKEN], [st[k] for k in SKILLS + TOKEN_SKILLS], characters, skills, tokens, projectiles, [bt[k] for k in templates], [native_templates[k] for k in templates if k in native_templates], [database[k] for k in db_keys]])
models = read(C / 'vigil-source/models.json')
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
            'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id), 'faceSwitcherPathId': str(art['data']['_faceSwitcher']['m_PathID']), 'sha256': digest(raw), 'byteLength': len(raw)}
bindings[TOKEN] = {'Original': {'bundle': 'pkgrps/btl_pfb_tokens_0.ab',
    'animatorPathId': str(token_animator_id), 'skeletonAnimationPathId': str(token_skeleton_id),
    'skeletonDataAssetPathId': str(token_asset_id), 'textAssetPathId': str(token_text_id),
    'atlasAssetPathId': str(token_atlas_id), 'atlasTextAssetPathId': str(token_atlas_text_id),
    'faceSwitcherPathId': str(token_animator['_faceSwitcher']['m_PathID']),
    'sha256': digest(script(token_by[token_text_id])), 'byteLength': len(script(token_by[token_text_id]))}}
evidence = {'schemaVersion': 1, 'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar',
    'commit': GLOBAL, 'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Full Vigil and default Wolfpack source foundation; Wolfpack lifecycle and three-skill combat adapter pending',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'tokens': tokens, 'originalWolfpackArt': original_token_art, 'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {TOKEN: ct[TOKEN]}, 'skills': {k: st[k] for k in SKILLS},
        'tokenSkills': {k: st[k] for k in TOKEN_SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),

    'recoveredFacts': [
        'Preserve all thirty Vigil ranks and the exact Wolfpack wrappers: S1 and S2 each have one passive placeholder rank; S3 has ten real passive ranks. No additional token ranks are invented.',
        'Every promotion begins with two Wolf Shadows. The token has independent phase/level stats, base block zero, a base +1 block holder and up to two extra head holders. Head recovery intervals are 30/27/25 seconds at E0/E1/E2.',
        'The initial extra head is guarded by a retained born_override marker. Extra heads each derive a separate Physical damage receipt filtered to the Attack ability, not extra attack targets or independent attack/SP events.',
        'Fatal handling retains separate before/post HP-zero actions: consume the lethal modifier, remove one extra head and its derived damage holder, clear the cap override, then heal from the token maximum HP while ignoring HealFree. Losing the last head instead switches to the persistent tactical-point mode.',
        'The original persistent point retains its head-recovery trigger, rebirth/block/state holders, HealFree, initial-head guard and S2/S3 marks across death. Rebirth is a separate ability with preDelay 1, cooldown 1, waitForAttackEvent 0 and ReBorn mapped to the original Start clip.',
        'Wolfpack placement is ground-only, inside Vigil attack range, has no facing picker, occupies zero deployment slots and has zero retreat refund. Its source card policy, passive state flags and both modes are retained without assigning unverified numeric flag semantics.',
        'Vigil trait applies 150% ATK only against targets blocked by his own token. His E2 DEF penetration is 175 or 200 at potential rank 4. The token E2 penetration graph instead checks any blocked target; neither graph is replaced with a permanent unconditional penetration stat.',
        'S1 is automatic time-recovery, generates seven DP at every rank and branches on first tactical-point mode. It triggers rebirth for the resting point; an active point adds a head below cap or heals through HealFree at the cap.',
        'S2 is automatic time-recovery, generates two DP and sends one nonstacking infinite next-attack buff to the token with selected owner blackboard parameters. The native Attack-filtered scale, kill DP, cast-target heal and ability-finish cleanup remain separate callbacks.',
        'S3 lasts fifteen seconds with native interval-based DP, a duration-held attack-mode switch and derived token marks. Its selected Arts ratio is 10/13/16/20/23/26/30/35/40/50 percent in both owner and token skill ranks.',
        'The S3 owner composite cycles A/B/C without resetting subabilities or cooldowns. Each ranged subability retains additionalTimes 2, triggerDelta 0, waitAttackEventForAllAttacks 0, three different projectile keys and mount points 2/8/9. Those native fields do not establish how the three OnAttack animation events are consumed.',
        'Owner S3 Arts checks own-token blocking, uses owner ATK and suppresses source calculation callbacks. Token S3 checks its own blocking, counts extra damage holders plus one and emits that many separate Arts receipts using host ATK; it also suppresses source calculation callbacks.',
        'Both original Vigil facings retain normal fire at 0.266666681 and S3 A/B/C OnAttack payloads at 0.033333335/0.133333340/0.333333343. Skill1/Skill2 last one second with no Spine events despite event-waiting native abilities and separate numeric runActionOnEvent 2 buff hooks.',
        'The default Wolfpack uses one original skeleton linked through the shared token bundle animator, SkeletonAnimation, SkeletonDataAsset and atlas, plus its native FaceSwitcher. Its Attack event is 0.466666669 and Start event 0.400000006. Alternate skinpack models are excluded.',
        'All four original projectiles have speed ten, lifetime ten and stopWhenSourceInvalid zero. The complete template closure also retains module-dependent fatal/dodge branches as source evidence without enabling module support.'
    ],
    'runtimeContracts': [],
    'verificationLimits': ['Native compiled ordering, frame parity, modules and original Unity particles/audio are unverified.'],
    'holdReasons': [
        'Vigil and Wolfpack remain unregistered until their complete linked lifecycle and three-skill combat adapter is verified.',
        'Event-free Skill1/Skill2 clips, waitForAttackEvent 1 and numeric runActionOnEvent 2 do not establish compiled cast/buff dispatch. No guessed animation release or one-second cast timer is substituted.',
        'S3 additionalTimes 2, zero triggerDelta and waitAttackEventForAllAttacks 0 must be reconciled with three identical OnAttack payloads per A/B/C clip; one projectile per animation event is not assumed.',
        'Lethal before/post modifier ordering, retained-point recovery and head-count damage receipts must preserve ownership and callback boundaries, including S2 next-attack cleanup and S3 host-ATK Arts receipts.'
    ]}
(ROOT / 'data/arkpedia-vigil-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Vigil:', len(templates), 'templates,', len(projectiles), 'projectiles,', len(source_bundles), 'bundles')
