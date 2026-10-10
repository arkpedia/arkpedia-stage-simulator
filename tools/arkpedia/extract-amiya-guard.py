#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Amiya Guard's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-amiya-guard.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Runtime registration is reviewed separately.
Preserves all source ranks, trait/talent actions and form unlock rules and whole action graph dependencies.
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
ID = 'char_1001_amiya2'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_amiya2_1', 'skchr_amiya2_2']
PREFABS = SKILLS


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
art_env = load('chararts/' + ID + '.ab', C / ('amiya-guard-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
# Retain the linked original facing controller as well as both animator chains.
art_by = bundles['chararts/' + ID + '.ab']
for face_id in sorted({int(r['data']['_faceSwitcher']['m_PathID']) for r in chararts[ID]
    if '_faceSwitcher' in r['data']}):
    chararts[ID].append({'pathId': str(face_id), 'data': exact(art_by[face_id].read_typetree())})
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), PREFABS)
projectile_env = load('battle/prefabs/[uc]projectiles.ab', C / 'map-source/ab/battle/prefabs/[uc]projectiles.ab')
projectiles = {}
holder_env = load('config/buff_template_holder.ab', C / 'map-source/ab/config/buff_template_holder.ab')
ct, st, rt, bt = [read(C / (name + '.json')) for name in
    ['character_table', 'skill_table', 'range_table', 'buff_template_data']]
patch = read(C / 'char_patch_table.json')
patch_source = read(C / 'amiya-guard-source/patch-table-source.json')
patch_bytes = (C / 'char_patch_table.json').read_bytes()
assert patch_source == {'path': 'en_US/gamedata/excel/char_patch_table.json',
    'sha': 'fc84d705f44b9c2e430069c482fbf935a995952e', 'size': 47115}
assert patch_source['size'] == len(patch_bytes)
assert patch_source['sha'] == hashlib.sha1(f'blob {len(patch_bytes)}\0'.encode() + patch_bytes).hexdigest()
ct = {**ct, **patch['patchChars']}
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
scan([characters, skills, ct[ID], [st[k] for k in SKILLS]])
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
find_ranges([ct[ID], [st[k] for k in SKILLS], characters, skills, projectiles, [bt[k] for k in templates]])
models = read(C / 'amiya-guard-source/models.json')
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
evidence = {'schemaVersion': 1, 'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar',
    'commit': GLOBAL, 'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
        for name in ['character_table', 'char_patch_table', 'skill_table', 'range_table', 'buff_template_data']},
    'patchTable': patch_source,
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Complete Global Guard-form source foundation; combat adapter pending',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)},
        'formInfo': patch['infos']['char_002_amiya'], 'unlockConds': patch['unlockConds'],
        'patchDetailInfoList': patch['patchDetailInfoList']},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'recoveredFacts': [
        'The pinned Global char_patch_table supplies Guard char_1001_amiya2, both original skill IDs and the parent Amiya form group. Guard unlock requires main_08-16 PASS. Patch detail identifies Guard independently of Caster/Medic; neither CN text nor a second character identity is substituted.',
        'Ordinary native melee Arts attack has one 0.566667s OnAttack in both facings. S1 native additionalTimes=1/waitAttackEventForAllAttacks=1 matches two original events at 0.366667/0.733333s, selected ATK/Arts dodge and mode 1. Ordinary/S1 native maximum animation scale is uncapped.',
        'E1/E2 talent uses its own selected 0.04/0.07 ATK and DEF aura with original allied-unit validator. Active skill talent variant applies selected talent_scale=2; shared amiya2_t_1 has maxStackCnt=1 and is removed when its ability detaches. No module variant or potential-only bonus is inferred.',
        'S2 limits global trigger time to 1 with manual selector required. It owns MultiAttack and SkillEnd as distinct extra abilities and restarts mode 2. The selector uses ground targetMotion=1/postFilter=16 and limit 1, distinct from ordinary postFilter=4; selected description requires lowest HP in front.',
        'Both original Skill_2 clips retain eleven OnAttack payloads at 0.6, 0.766667, 0.933333, 1.1, 1.266667, 1.433333, 1.6, 1.766667, 1.933333, 2.333333, 3.066667s. Native MultiAttack retains timeMode=1, selectTargetTiming=2, preDelay=0.867, waitAttackEventForAllAttacks=1, minPostDelay=0.2 and onlyFeedActiveBuffToLastOne=1. Those fields alone do not identify which payloads the compiled ten-hit controller consumes.',
        'The final cirtical branch first attaches a source cancellation buff whose ON_CALCULATE_DAMAGE sets ATK scale zero. Its target delay_attack waits 0.4s, removes that cancellation, applies separate PURE damage using selected atk_scale_2 with emitSourceOnCalculateDamage=false, then finishes itself. This is not an extra immediate ordinary Arts hit.',
        'MultiAttack attack-state buff listens ON_TARGET_KILLED and creates stacked selected ATK/RES holders with stripBlackboardParamsWithBuffKey=true. Selected kill cap is 3; ATK 0.4/RES 20 at M3. Attack-state finish removes cancellation and triggers SkillEnd. SkillEnd preserves 0.2s original End; mode 2 subsequent ordinary attacks use PURE and Skill_2_Loop through the native Skill_2_Attack animation alias.',
        'Skill lifetime finish removes kill and visual holders and restores the default mode with FSM restart. Original Front/Back binaries follow native FaceSwitcher and skeleton pointer chains byte-for-byte; no native particles/audio are claimed.'
    ],
    'verificationLimits': [
        'S2 native timing 2 retarget phase, preDelay versus original event cursor, ten damage strikes versus eleven payloads and final delayed damage/cancellation ordering require an explicit executable combat contract.',
        'Shared aura replacement/removal, global once-per-battle persistence across redeployment and kills during the final delayed branch must be verified together; isolated S1 or a guessed ten-hit burst does not establish complete Guard-form support.',
        'Compiled callback ordering, native frame parity, modules and original Unity VFX/audio remain unverified.'
    ],
    'holdReasons': ['Complete ordinary attack, both skills and all talent/lifecycle actions require a reviewed combat adapter.']}
(ROOT / 'data/arkpedia-amiya-guard-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Amiya Guard:', len(templates), 'templates,', len(projectiles), 'projectiles,', len(source_bundles), 'bundles')
