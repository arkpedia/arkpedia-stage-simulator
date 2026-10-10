#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Pozëmka's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-pozemka.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Runtime registration is reviewed separately.
Preserves all source ranks, trait/talent actions and operator/Typewriter projectile and synchronization dependencies.
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
ID = 'char_4055_bgsnow'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
TOKEN = 'token_10026_bgsnow_subbow'
SKILLS = ['skchr_bgsnow_1', 'skchr_bgsnow_2', 'skchr_bgsnow_3']
TOKEN_SKILLS = ['sktok_bgsnow_1', 'sktok_bgsnow_2', 'sktok_bgsnow_3']
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
art_env = load('chararts/' + ID + '.ab', C / ('pozemka-source/' + ID + '-chararts.ab'))
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
            templates.add(value); scan(bt[value])
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
find_ranges([ct[ID], ct[TOKEN], [st[k] for k in SKILLS + TOKEN_SKILLS], characters, skills, tokens, projectiles, [bt[k] for k in templates]])
models = read(C / 'pozemka-source/models.json')
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
token_model = read(C / 'pozemka-source/typewriter/sources.json')
models[TOKEN] = {}
bindings[TOKEN] = {}
for face, record in token_model['models'][TOKEN]['facings'].items():
    name = face.capitalize()
    skeleton = record['files'][TOKEN + '.skel']
    models[TOKEN][name] = {**record, 'sha256': skeleton['sha256'], 'bytes': skeleton['bytes']}
    bindings[TOKEN][name] = {**record['originalPathIds'], 'sha256': skeleton['sha256'], 'byteLength': skeleton['bytes']}
evidence = {'schemaVersion': 1, 'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar',
    'commit': GLOBAL, 'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Complete source foundation; operator and Typewriter runtime adapter pending',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'tokens': tokens, 'originalTypewriterModels': token_model, 'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {TOKEN: ct[TOKEN]}, 'skills': {k: st[k] for k in SKILLS},
        'tokenSkills': {k: st[k] for k in TOKEN_SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),

    'recoveredFacts': [
        "All three owner and three corresponding Typewriter skill prefab hierarchies, thirty ranks each, selected promotion/potential talents and six original projectile trees are retained. Typewriter has independent table stats, cost5, respawn40, block0, maxDeployCount1 and native slot occupancy0; owner finish kills owned tokens and token finish recharges stock.",
        "Original owner Attack uses first-only Attack_Begin0.5 then Attack_Loop1.6 with OnAttack0.133333 in both facings. S1 Front Skill_1_Loop event is0.133333 while Back is0.3. S3 Begin0.666667 and Loop1 with OnAttack0.133333 are separate from End0.5. Original Typewriter Attack has OnAttack0.066667 and duration1.6 in both facings; Down-specific clips are preserved.",
        "S1 uses attack-recovery automatic activation with unlimited duration, selected ATK increase and Dice(prob) followed by AtkScaleUp on calculated damage. Owner and Typewriter each retain their own bgsnow_s_1[random_atk] template and rank coefficients. Owner mode aura triggers the token skill; this is not an independently charging visible token control.",
        "S2 owner and token each retain one Ranged projectile ability plus a serialized action graph containing two AdvancedApplyDamage executions via an explicit reference. Both attack graphs wait for their original single attack event; no additionalTimes or staggered multi-emission timer is serialized. Selected one-charge ranks1..3 and two-charge ranks4..10 plus skill range3-1 are retained separately from attack3-2 default range.",
        "S2 owner skill owns a separate trigger_token_skill action. Token native blackboard copier applies the equipped owner respawn_time ratio only for skill index1, and its card modifier on finish lasts UNTIL_NEXT_SPAWN. The original finish/recharge/card-buff dispatch order is not recovered from the serialized fields alone.",
        "S3 owner selected base_attack_time modifier and front-three-tile focus mark use separate damage templates. Focus check is source-specific; the ordinary coefficient is used when that mark is absent. Token gets selected attack@atk_scale and base_attack_time from its own ranks, switches to directional modes2/3 and restores modes0/1 on buff finish. Owner skill finish removes the matching token switch buff.",
        "Typewriter talent lifetime is15/20/25s atE0/E1/E2 through a one-trigger withdrawal buff. AtE2 its calculated-damage listener checks owner adjacency mark, then applies separate prioritized FINAL_SCALER DEF debuffs:18%/23% for4s, or20%/25% for5s atpotential5. Adjacent eligibility uses original owner range x-5; base and stronger debuff keys are preserved independently.",
        "Owner and Typewriter use two different original front/back skeletons each, with native FaceSwitchers. Token skeleton, atlas, material, RGB and separate alpha dependencies follow exact pointer chains; merged PNG pixels and normalized atlas are derived explicitly. Every homing projectile retains speed10, lifetime10, one-victim hit limit and independent source-invalidation fields."
],
    'verificationLimits': ['Serialized S2 default/extra damage execution, native event consumption, charge finish and token trigger dispatch need a reviewed executable contract; one original event plus referenced action graphs does not establish staggered emissions.', 'Native first-only attack Begin/reset timing, token attachment during active skills, focus-mark sampling, separate DEF debuff priority and finish/recharge/card-buff ordering remain unverified compiled contracts.', 'Frame parity, modules and original Unity particles/audio remain separate work. The original token art extraction is not a combat registration or asset publication.'],
    'holdReasons': ['Complete owner and Typewriter combat, synchronization and lifecycle adapter is pending; source evidence alone does not establish playability.']}
(ROOT / 'data/arkpedia-pozemka-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Pozëmka:', len(templates), 'templates,', len(projectiles), 'projectiles,', len(source_bundles), 'bundles')
