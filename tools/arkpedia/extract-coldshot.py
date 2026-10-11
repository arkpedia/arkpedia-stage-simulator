#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Coldshot's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-coldshot.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. This does not enable the kit.
Preserves all source ranks and reload dependencies without enabling an unverified kit.
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
ID = 'char_4104_coldst'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skcom_atk_up[3]', 'skchr_coldst_2']
PREFABS = ['skcom_atk_up', 'skchr_coldst_2']


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
art_env = load('chararts/' + ID + '.ab', C / ('coldshot-source/' + ID + '-chararts.ab'))
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
models = read(C / 'coldshot-source/models.json')
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
proof = read(C / 'mlynar-source/primary-proof.json')
proof.update({'lines': '1650-1685', 'facts': ['Capacity4+2elite, trait1.2 and talent multiplicative coefficient are independent in calculator.', 'Normal reload1.6/S2reload2.4 are absolute. Continuous out-of-ammo cycle is current attack interval/ASPD+reloadtime.', 'Calculator omits reload animation event, early enemy reentry, reload-break, ammo-spend startEvent5 and composite flag dispatch.'], 'limitations': 'Independent calculator does not model animation frames or lifecycle phases; cannot establish native dispatcher or timing. Read for corroboration only; no calculator implementation copied.'})
raw = (C / 'mlynar-source/primary-damage-formulas.py').read_bytes()
assert digest(raw) == proof['sha256']
assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == proof['gitBlobSha']
proof['excerpt'] = ''.join(raw.decode().splitlines(keepends=True)[1649:1685])
evidence = {'schemaVersion': 1, 'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar',
    'commit': GLOBAL, 'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Source foundation only: conditional reload interruption is unresolved',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'primaryCalculator': proof, 'recoveredFacts': ['Original trait coldst_tr starts by assigning selected value to cnt and max_cnt (4/6/8 atE0/E1/E2). Source coldst_tr_sub/add clamps numerical count, with selected dynamic−1/+1; no-module extra_add is absent. Trait1.2 multiplier and talentE1 1.2/1.23pot5,E2 1.3/1.33pot5 are corroborated by primary calculator.', 'Native ordinary composite1926503580086732505 and S2composite4316055058026563289 contain separate ordinary Attack, ReloadAttack and Reload subabilities; selectAbilitySequentially0, clearInternalCooldownWhenFinish1, updateCooldownBySubAbilityCooldownDuringCasting1, firstAttackIfAbilityChanged1, resetSubAbilityCooldown1. Attack/ReloadAttack triggers use triggerValidTypes[0,1], distinguished by checkReloadFlag1/reloadFlag0 versus1. Reload trigger uses[1,2]/checkReloadFlag0. Native valid-type enums are not recovered.', 'Normal ReloadAttack AnimationController−6518740036063951143 explicitly uses Reload_Break→Attack_Loop; S2controller1918141978749470425 uses Skill_2_Reload_Break→Skill_2_Loop. Both first-only begin, uncapped min/maxAnimScale−1, fixAnimWhenCooldownSlow1 and explicit Down variants. Those contracts make simply locking reload to full clip an unjustified gameplay assumption.', 'Actual native two-facing ordinary Attack_Begin.167,Attack_Loop1.6 OnAttack.067; Reload_Begin.167,Reload_Loop1.6 OnAttack1; Reload_Break.167. S2attackLoop2.4 OnAttack.067, reloadLoop2.4 OnAttack1.5 with same .167 begin/break. Original ammo increment/decrement AttachBuff controllers have numeric startEvent5/endEvent3; no executable mapping from that event to literal OnAttack or cast completion is recovered.', 'S1 source standard manual duration30 ATK up all10ranks. S2 exact manual duration20..40/ATK40..140%, reload_interval+.8 and1s Sluggish. Native coldst_s_2[reload] adds/removes reload_interval in traitBB; selected behavior corroborates longer absolute reload. Talents own .02 delayed-first checker and not-valid attack/2s-delay phase; exact startup versus clip-finish timer remains unrecovered.'], 'holdReasons': ['Whole regular kit remains unsupported because native composite reload→ReloadAttack switch timing, retained partial reload clock, triggerValidTypes enum and reloadFlag interruption ordering are material gameplay contracts. A legal victim returning during reload could interrupt before any refill, immediately after numeric event5/refill, or at a later cooldown phase. Existing Reload_Break is explicit but does not recover that phase. Do not impose full-window-only reentry for implementation convenience.', 'Independent primary calculator corroborates overall exhausted1.6/2.4+current attack interval cycle, but has no event/FSM/reentry simulation. It cannot settle the first bullet timing, first-only Begin/Break accumulation or whether ammunition is spent/restored at literal events versus class callback5.', 'No generic trait-ammo approximation or invented Attack/Reload event is enabled. Original complete graphs, all20 ranks, native pointer-chain facing bytes and calculator blob/excerpt are durable for a later native controller or independently measured source recovery.']}
# Runtime mappings remain distinct from the recovered serialized facts.
evidence['historicalHoldReasons'] = evidence['holdReasons']
evidence['enabledOperators'] = [ID]
evidence['heldOperators'] = []
evidence['holdReasons'] = []
evidence['reviewStatus'] = 'Complete ordinary kit with explicit local execution contracts'
evidence['runtimeContracts'] = [
    'Use each original Loop OnAttack payload as the local fire/refill deadline. Numeric native startEvent5/endEvent3 are preserved, not decoded or asserted equivalent. Fire animation rate fits the current attack interval; original reload1.6/2.4 and Begin remain fixed against ASPD.',
    'A legal target interrupts partial reload immediately when a round exists, retaining completed refills and discarding unfinished work. With zero rounds, wait for the original refill event then enter original Reload_Break before remaining fixed cooldown ends. Skill2 restarts cancel pending work but preserve stored rounds.',
    'Selected trait capacities4/6/8 deploy full. Consume one only at accepted single-target projectile birth; add one at each accepted refill event and clamp. Missing native no-module extra_add is mapped to zero as a local contract, not a recovered field.',
    'Sample the selected talent validator before entering attack-invalid Begin/Loop. Keep invalid until birth or cancellation; start the selected two-second delay there and observe the source .02 checker on engine ticks. Initial deployment delay is separate. Numeric attack-finish callback3 and compiled same-frame order remain unrecovered.',
    'S1 applies selected ATK/duration without a mode restart. S2 applies selected ATK/duration, original skill attack/reload mode and additive .8 reload interval, restoring ordinary mode at expiry. Born projectiles retain selected talent/skill/Slow metadata while reading current ATK at impact.',
    'Single-target speed15/projectile lifetime10 are source fields. S2 applies source one-second80%Sluggish after an accepted calculated damage receipt, including shielded hits; miss, cancellation and invulnerability do not apply it. Native status-before/after-damage ordering is not claimed.',
    'Controller owns original facing Begin/Loop/Reload_Break animations; attack events use animation none and do not replace them. Ammunition HUD is separate from SP. Removal cancels unborn work and resource callbacks while already born projectiles retain their victim effects.'
]
(ROOT / 'data/arkpedia-coldshot-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted reviewed Coldshot kit: 20 source ranks,', len(templates), 'reachable templates,',
    len(db_keys), 'database entries,', len(projectiles), 'projectiles and', len(source_bundles), 'verified bundles')
