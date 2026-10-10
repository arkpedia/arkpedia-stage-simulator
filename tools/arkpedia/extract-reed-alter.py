#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Reed the Flame Shadow's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-reed-alter.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Runtime registration is reviewed separately.
Preserves all source ranks, trait/talent actions and orbital fireball/diffusion dependencies.
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
ID = 'char_1020_reed2'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skcom_quickattack[3]', 'skchr_reed2_2', 'skchr_reed2_3']
PREFABS = ['skcom_quickattack', 'skchr_reed2_2', 'skchr_reed2_3']


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
art_env = load('chararts/' + ID + '.ab', C / ('reed-alter-source/' + ID + '-chararts.ab'))
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
models = read(C / 'reed-alter-source/models.json')
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
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Complete source foundation: three-skill regular-stage adapter pending',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),

    'recoveredFacts': [
        'Original ordinary Attack has one0.433333s event in each facing; S3 Attack has one0.466667s event. Ordinary and S3 homing Arts projectiles travel at10 and retain one-victim hit caps. S3 selects up to two ground/air targets. Both native attack controllers cap maximum animation scale at1, which must remain separate from arbitrary simulator animation caps.',
        'Trait listens after output damage, assigns calculated damage rather than real HP delta, scales by selected0.5 and either heals the allied projectile trace target or uses TraitHealRange to select one lowest-HP legal ally. The direct fireball-host branch checks HEAL_FREE; the selector has its own target-free/abnormal checks. T2 excludes self-target healing, assigns calculated healing rather than effective HP gain and heals the owner by selected0.5/0.55.',
        'T1 listens to output damage, rolls selected0.3 probability and creates/extends Cinder. Existing ordinary Cinder is compared by damage_scale before replacement; its ATK multiplier and database ArtsFragility remain distinct. Skill3 additive effects use a source-specific DOT, shared diffuse holder and coefficient comparison; they are not applied retroactively to every pre-skill ordinary mark.',
        'S1 uses generic skcom_quickattack prefab with selected ATK and ASPD at all ten ranks. Skill table identity skcom_quickattack[3] remains distinct from the shared native prefab identity.',
        'S2 native selector retains postFilter47 and professionMask639, selecting one/two allied operators and requiring a target in manual mode. Emission owns three particles per selected host, override radius0.5, Arts coefficient, selected1.5s collision cooldown and exact selected projectile lifetime. The original fire projectile retains radius0.600000024, speed150, counterclockwise movement, source/host invalidation and camouflage bypass. Raw FP/SInt64 cooldown8589934592 is retained without assuming its compiled conversion.',
        'S2 native fireball ability waits for an attack event and its front Skill_2 clip contains one0.166667s OnAttack event, while the original back Skill_2 clip has none. Both0.5s clips and native facing/mix settings remain retained; compiled eventless-facing dispatch is not guessed.',
        'S3 copies selected promotion/potential talent@atk and talent@damage_scale into its skill blackboard before applying mode1. Its selected probability1, ATK increase, DOT coefficient, explosion coefficient and radius remain separate. Native holder compares aoe_scale before replacing a shared diffuse buff; DOT is independent per producer with first trigger0.2s followed by1s intervals.',
        'S3 owner-killed diffusion checks a live source, emits its visual projectile, then immediately creates holder/DOT and a separate delayed0.1s Arts splash buff on eligible ground/air targets. Native radius default1.1 and selected range_radius1.7 remain separate. The splash buff lifetime0.15 and first trigger0.1 are not an instant explosion. Source-specific finish actions remove DOT/diffuse; owner control cleanup separately removes ordinary Cinder.'
    ],
    'holdReasons': [
        'The complete three-skill adapter must implement calculated-damage healing and self-heal without recursion, ordinary versus S3 Cinder ownership/priority, per-host orbital fireball collisions and source-bound delayed diffusion cleanup before enabling the operator.',
        'Compiled eventless back-facing S2 dispatch, selector postFilter47/professionMask639, raw collision FP conversion, native damage/healing callback order and same-frame chain priorities remain uncertified. They require explicit reviewed gameplay mappings rather than invented source events.',
        'Native frame parity, modules and original Unity particles/audio remain separate work. Full source evidence and prepared art do not establish playable coverage.'
    ]}
(ROOT / 'data/arkpedia-reed-alter-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Reed the Flame Shadow:', len(templates), 'templates,', len(projectiles), 'projectiles,', len(source_bundles), 'bundles')
