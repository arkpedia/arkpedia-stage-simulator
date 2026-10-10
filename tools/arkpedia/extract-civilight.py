#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Civilight Eterna's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-civilight.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Runtime registration is reviewed separately.
Preserves all source ranks, mutable orbital projectiles and HP redistribution dependencies.
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
ID = 'char_4134_cetsyr'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_cetsyr_1', 'skchr_cetsyr_2', 'skchr_cetsyr_3']
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
art_env = load('chararts/' + ID + '.ab', C / ('civilight-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
# Keep the native facing controller, not only the animator's pointer to it.
art_by = bundles['chararts/' + ID + '.ab']
face_ids = {int(r['data']['_faceSwitcher']['m_PathID']) for r in chararts[ID]
    if '_faceSwitcher' in r['data']}
for face_id in sorted(face_ids):
    chararts[ID].append({'pathId': str(face_id), 'data': exact(art_by[face_id].read_typetree())})
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), PREFABS)
projectile_env = load('battle/prefabs/[uc]projectiles.ab', C / 'map-source/ab/battle/prefabs/[uc]projectiles.ab')
projectile_variants = sorted(o.read().m_Name for o in projectile_env.objects
    if o.type.name == 'GameObject' and o.read().m_Name.startswith('projectile_chr_cetsyr_talent'))
projectiles = records(projectile_env, projectile_variants)
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
scan([characters, skills, projectiles, ct[ID], [st[k] for k in SKILLS]])
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
models = read(C / 'civilight-source/models.json')
bindings = {ID: {}}
by = bundles['chararts/' + ID + '.ab']
for art in chararts[ID]:
    if '_animations' not in art['data']: continue
    for face in ['Front', 'Back']:
        ref = art['data']['_skeleton']
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
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [ID], 'heldOperators': [],
    'reviewStatus': 'Playable bounded three-skill orbital and HP redistribution adapter',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'projectileVariants': projectile_variants,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),

    'recoveredFacts': [
        'All thirty selected skill ranks, promotion/potential talents and complete original character/skill/projectile component graphs are retained.',
        'Original artwork uses one skeleton and a FaceSwitcher; both manifest facings alias the native Front skeleton. There are no OnAttack payloads and no ordinary attack clip to fabricate.',
        'The orbital emitter preserves mutable next_projectile_key, count, radius, cooldown and speed blackboards across default/S1/S2/S3 modes; graphic and logic projectile dependencies remain distinct.',
        'Normal/S1/S3 particle collision recipients use source-specific marks, professionMask639 and ignoreHealFree1. S2 instead targets enemy collisions with True damage and output Bind.',
        'S1 automatically activates indefinitely, increases selected trait regeneration and changes the orbital emitter generation cooldown.',
        'S2 adds selected particles, increases the capacity/radius and grants ATK Inspiration; S3 keeps particles from disappearing and grants max-HP Inspiration with expanded source range.',
        'S3 records recipient current/max HP, sums those quantities, computes the weighted total-HP ratio, applies it using skipModifierEvent1 and clears collectors. Collection/calculation have distinct native controllers with raw 1s intervals while selected table keys supply 2s. Talent2 uses a global Sarkaz filter and nonstacking one-minus damage scaling.',
        'All twelve original four-mode main/graphic/logic projectile trees and recursively referenced buffs, orbit movement and collision-controller fields are retained. Raw FP/SInt64 cooldown and speed fields are evidence, not a claim that compiled unit conversion or same-frame dispatch is recovered.'
    ],
    'holdReasons': [],
    'runtimeContract': [
        'Dedicated per-owner orbit slots move counterclockwise, sweep collision chords, disappear individually and respawn on selected cooldowns. Default/S1 use three allied-operator particles; S2 fills six enemy-damage particles and changes radius/speed; S3 preserves particles. Mode changes reset slots through an explicit local emitter contract.',
        'Per-recipient regeneration waits one second on entry, uses live owner ATK and only the same producer mark, and bypasses ordinary healing modifiers. ATK/MaxHP Inspiration uses immediate one-second refreshes and the highest selected percentage per stat. Bards remain immune.',
        'S2 collides with ground/air enemies independently of sight, issues selected True damage and attaches selected Bind through the outputDamage hook, including other issued HP damage. Original native damage/modifier callback priorities are not claimed.',
        'S3 applies an atomic collect/calculate/apply redistribution on activation and every selected two seconds. All live recipient maxHP values resolve before recording HP; their summed HP is distributed by maximum HP without healing, damage, shield or SP receipts.',
        'One strongest deployed Civilight grants global Sarkaz-source damage resistance without duplicate owner stacking. Retreat/death/end remove aura effects, owned marks and particle visuals; original Begin/Loop/End clips use generation-safe transitions.'
    ],
    'gameplayCorroboration': [{
        'url': 'https://prts.wiki/w/%E9%AD%94%E7%8E%8B',
        'scope': 'Default orbit: 30 degrees/second, radius1.15, collision radius0.4, independent respawns. S2: 0.9 radians/second, radius changes0.01/frame to2; finish replaces particles and changes speed to1 radian/second and radius to1. Bind applies to all owner HP damage. S3 uses summed HP divided by summed maximum HP. This corroborates gameplay interpretation, not native C# dispatch.'
    }],
    'fidelityLimits': [
        'Original FP/SInt64 storage, profession masks and serialized movement fields are retained. Compiled conversions/enum dispatch are not recovered; default angular speed is mapped from the talent degrees and S2/finish speed from skill radians, corroborated by gameplay reference.',
        'Radius interpolation maps the original0.01/frame field onto the simulator30Hz clock. Starting orbital phase, mode reset/refill timing, swept chords against moving bodies/huge colliders, recipient ties and same-frame mark expiry/cooldown/HP collector ordering are bounded simulator contracts.',
        'Regeneration, Inspiration, outputDamage and hit resistance hooks bridge native action/attribute phases. Shared maxHP changes preserve HP fraction; compiled collector ordering, external modifier priorities and source status AUTOMATIC dispatch remain uncertified.',
        'Native frame parity, modules and original Unity particles/audio remain unsupported. Orbital visuals are temporary markers at authoritative collision positions, not imported native VFX.'
    ]}
(ROOT / 'data/arkpedia-civilight-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Civilight Eterna kit: 30 source ranks,', len(templates), 'reachable templates,',
    len(db_keys), 'database entries,', len(projectiles), 'projectiles and', len(source_bundles), 'verified bundles')
