#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Fuze's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-fuze.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. This does not enable the kit.
Preserves all source ranks, ammunition and Cluster Charge dependencies without enabling an unverified kit.
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
ID = 'char_4126_fuze'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_fuze_1', 'skchr_fuze_2']
PREFABS = ['skchr_fuze_1', 'skchr_fuze_2']


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
art_env = load('chararts/' + ID + '.ab', C / ('fuze-source/' + ID + '-chararts.ab'))
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
models = read(C / 'fuze-source/models.json')
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
proof.update({'lines': '2767-2785', 'facts': [
    'Calculator applies selected S1 ATK and ASPD and limits ordinary/S1 victim count to E0/E1 two, E2 three.',
    'S2 displays five Physical explosions at selected ATK scale; the calculator does not simulate destinations, projectiles or detonation timing.'],
    'limitations': 'Independent calculator does not model animation frames or projectile destinations. It cannot establish native Fuze offset-axis, stop or collision dispatch. Read for corroboration only; no calculator implementation copied.'})
raw = (C / 'mlynar-source/primary-damage-formulas.py').read_bytes()
assert digest(raw) == proof['sha256']
assert hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() == proof['gitBlobSha']
proof['excerpt'] = ''.join(raw.decode().splitlines(keepends=True)[2766:2785])
evidence = {'schemaVersion': 1, 'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar',
    'commit': GLOBAL, 'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
        for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data']},
    'buffDatabase': {'path': 'en_US/gamedata/buff_table.json', 'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes())},
    'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [], 'heldOperators': [ID],
    'reviewStatus': 'Source foundation only: Cluster Charge destination and stop dispatch remain unresolved',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'skills': {k: st[k] for k in SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'primaryCalculator': proof,
    'recoveredFacts': [
        'Both native ordinary and S1 selectors limit victim count to the current block count. S1 can extend its range; ordinary cannot. Both retain selectTargetTiming0/targetMotion3, Physical damage and native Attack events; compiled selector phase ordering is not certified.',
        'S1 is manual ammunition at all ten ranks: 100 rounds, selected ATK/ASPD/range-forward extension, switch_mode_restart_fsm, native counter event4/expenditure1, finishSkillWithProgress1/canDiscardRemainingCount1, no earlySkillFinishAtAttackFinished.',
        'Selected E1/E2/potential talent uses fuze_t_1: ranged modifier-source guard, Dice(prob), Physical BlockDamage; this is probabilistic full damage prevention, not flat percentage mitigation. Talent is not silenceable.',
        'S2 specialized manual trigger has no serialized tile geometry. Selected text requires adjacent high ground and a passable tile behind; _useTriggerInManualMode1 and _maxTriggerTime3 are explicit.',
        'S2 source emission has additionalTimes4, triggerDelta.5, waitAttackEventForAllAttacks0, _offset.25 and _beginOffset0. Five emissions separated by .5s are distinct from the original single OnAttack1.2 event and do not establish five destination locations.',
        'Native grenade speed8, delayAfterReached1.8, radius1.2, onlyCheckHitWhenStop1, ground-only and ignoreCamouflage1 are preserved. hitNumType2/maxHitNum1/stopAfterMaxHit1 do not independently settle AoE collision versus stopping dispatch.',
        'Both original facing skeletons match native chararts pointers; original Skill_2 and Front Skill_Down_2 have OnAttack1.2/full duration3.333. S1 Begin.233/Loop1.2/OnAttack.2; original End is Front1.367/Back1.267.'
    ],
    'holdReasons': [
        'Cluster Charge uses a specialized trigger with no serialized tile geometry and a specialized MultiProjectile ability with offset.25/beginOffset0. Its compiled destination axis, offset ordering and allowed passable/high-ground combinations are not recovered. Collapsing five grenades to one center or inventing a dispersion pattern materially changes damage coverage.',
        'The projectile retains delayAfterReached1.8 and collision only at stop. Native reach/stop/lifetime and hitNumType2 dispatch cannot be inferred from those fields alone; a simple five immediate explosions would change timing and possibly victim count.',
        'The complete ordinary kit remains unavailable until both skills can be implemented. S1 alone, a generic AoE S2, or unrelated attack-projectile substitutions do not establish complete operator support.'
    ]}

(ROOT / 'data/arkpedia-fuze-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted held Fuze kit: 20 source ranks,', len(templates), 'reachable templates,',
    len(db_keys), 'database entries,', len(projectiles), 'projectiles and', len(source_bundles), 'verified bundles')
