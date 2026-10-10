#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Amiya Medic's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-amiya-medic.py.
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
ID = 'char_1037_amiya3'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_amiya3_1', 'skchr_amiya3_2']
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
art_env = load('chararts/' + ID + '.ab', C / ('amiya-medic-source/' + ID + '-chararts.ab'))
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
patch_source = read(C / 'amiya-medic-source/patch-table-source.json')
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
            # AdvancedApplyHeal's native default is a blackboard parameter;
            # a coincidentally named template is not a dependency.
            if key == '_healScaleKey': continue
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
            # The original client graph can retain fields absent from the
            # decoded game-data table. Include dependencies from both.
            if value in native_templates:
                scan(native_templates[value])
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
find_ranges([ct[ID], [st[k] for k in SKILLS], characters, skills, projectiles,
    [bt[k] for k in templates], [native_templates[k] for k in templates if k in native_templates]])
models = read(C / 'amiya-medic-source/models.json')
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
    'reviewStatus': 'Complete Global Medic-form source foundation; combat adapter pending',
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
        'The Global patch table groups Medic Amiya with Caster and Guard Amiya and requires main_14-20 PASS; she is a ranged Incantation Medic, not a separate squad identity.',
        'Ordinary and S1 attacks use distinct one-victim Arts projectiles at native speed 10. S2 ordinary attacks use a direct two-victim True-damage controller. All native attack controllers preserve maxAnimScale=1.',
        'The trait receives ON_AFTER_OUTPUT_DAMAGE, scales calculated damage by the selected trait scale (0.5), explicitly does not use real HP loss, and heals one eligible ally through TraitHealRange with heal-free validation.',
        'S1 preserves all ten ranks, selected ASPD and heal_scale, its ATTACK-family ON_CALCULATE_DAMAGE callback, and the separate unlimited allied selector in the x-1 healing area. This area is not an instruction to enlarge the enemy attack range.',
        'S2 preserves all ten ranks, an all-enemy Arts burst at Skill_2_Begin OnAttack, target ASPD/movement debuffs, a capped ATK stack graph driven by the burst selector, and subsequent two-target True attacks. The table specifies one ATK bonus per enemy hit; the holder uses S2Attack selection, not ON_TARGET_KILLED.',
        'S2 permits no-target manual activation. Native limitGlobalTriggerTime=1 combines with selected skill_max_trigger_time=1; the serialized maxTriggerTime=0 alone does not establish a zero-use limit. Passive skill-finish actions restore mode and remove the ATK holder.',
        'Prayer of Sincerity retains separate E1/E2 max-HP and active-skill max-HP-based regeneration values, three native aura nodes, their target validators and remove-on-detach flags; S1 and S2 regeneration holders share one buff key.',
        'Both original facing skeleton chains are byte-identical to their pinned imported originals. Attack, S1 Attack, S2 Attack and S2 Begin retain exact original OnAttack payloads; Front and Back S1 Begin durations differ.',
        'All 102 character, skill and projectile components, both projectile trees, nine recursive table/native templates, all 20 ranks, animation hooks, FaceSwitcher and form unlock data are retained without substituting a partial combat kit.',
    ],
    'runtimeContracts': [],
    'verificationLimits': [
        'Serialized controllers, selectors, animation payloads and action graphs establish source facts, not execution of the compiled client. Damage/heal callback order, target acquisition ties, skill-clock origin and burst-stack sampling still require explicit executable contracts.',
        'Exact OnAttack payload times are retained. Parsed clip durations are rounded to three decimals; compiled animation transition/frame parity, maxAnimScale scheduling and distinct-facing Begin timing are not certified.',
        'Native Unity particles, audio and module combat behavior remain unimplemented. Preserved effect/audio references are not evidence of rendering or gameplay support.',
        'This record does not enable Medic Amiya, publish her models to the playable asset manifest, or validate browser combat. Existing coverage and the pinned 348-form runtime remain unchanged.',
    ],
    'holdReasons': [
        'Implement and combat-test calculated-damage trait healing, separate S1 ATTACK-family area healing, healing eligibility and projectile invalidation before roster registration.',
        'Implement and combat-test the S2 burst, selected enemy-count stack cap, debuff lifetime, two-target True mode, interruption/cleanup and once-per-battle persistence across redeployment.',
        'Implement and combat-test the owned max-HP/regeneration aura, selected promotion values, later allies, removal and stacking with existing auras without duplicate S1/S2 regeneration.',
        'Import and verify both original facing models, compile the complete Global patch form, preserve squad identity, and validate the complete adapter locally before marking the form playable.',
    ]}
(ROOT / 'data/arkpedia-amiya-medic-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Amiya Medic:', len(templates), 'templates,', len(projectiles), 'projectiles,', len(source_bundles), 'bundles')
