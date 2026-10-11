#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Entelechia's source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-entelechia.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. This does not enable the kit.
Heart Candle has an EmptyAnimator; do not invent an enemy Spine binding.
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
ID = 'char_4010_etlchi'
CANDLE = 'enemy_5601_entlec'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_etlchi_1', 'skchr_etlchi_2', 'skchr_etlchi_3']


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
art_env = load('chararts/' + ID + '.ab', C / ('entelechia-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
                for o in art_env.objects if o.type.name == 'MonoBehaviour' and
                any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), SKILLS)
# The checksum-bound projectile bundle is intentionally empty for this kit.
load('battle/prefabs/[uc]projectiles.ab', C / 'map-source/ab/battle/prefabs/[uc]projectiles.ab')
holder_env = load('config/buff_template_holder.ab', C / 'map-source/ab/config/buff_template_holder.ab')
enemies = records(load('battle/enm_pfb_23.ab', C / 'map-source/ab/battle/enm_pfb_23.ab'), [CANDLE])

ct, st, rt, bt = [read(C / (name + '.json')) for name in
                  ['character_table', 'skill_table', 'range_table', 'buff_template_data']]
database = read(C / 'lessing-source/buff_table.json')
holder = next(o.read_typetree()['_templates'] for o in holder_env.objects
              if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree())
native_templates = {row['templateKey']: row for row in holder}
templates, db_keys = set(), set()


def scan(value):
    if isinstance(value, dict):
        key = value.get('buffKey') or value.get('_buffKey')
        if (value.get('loadFromDB') or 'CreateBuffById' in value.get('$type', '')) and key in database and key not in db_keys:
            db_keys.add(key)
            scan(database[key])
        for key, item in value.items():
            if key in ['templateKey', '_buffKey'] and isinstance(item, str) and item in bt:
                templates.add(item)
            else:
                scan(item)
    elif isinstance(value, list):
        for item in value:
            scan(item)


scan([characters, skills, enemies])
while True:
    count = len(templates)
    for key in list(templates):
        scan(bt[key])
    if count == len(templates):
        break

ranges = {phase['rangeId'] for phase in ct[ID]['phases']}


def find_ranges(value):
    if isinstance(value, dict):
        for item in value.values():
            find_ranges(item)
    elif isinstance(value, list):
        for item in value:
            find_ranges(item)
    elif isinstance(value, str) and value in rt:
        ranges.add(value)


find_ranges([ct[ID], [st[key] for key in SKILLS], characters, skills, enemies, [bt[key] for key in templates]])
models = read(C / 'entelechia-source/models.json')
assert models[ID]['commit'] == MODEL
bindings = {ID: {}}
by = bundles['chararts/' + ID + '.ab']
for art in chararts[ID]:
    animator = art['data']
    if '_animations' not in animator:
        continue
    for face in ['Front', 'Back']:
        pointer = animator['_' + face.lower()]['skeleton']
        assert pointer['m_FileID'] == 0
        skeleton_id = int(pointer['m_PathID'])
        skeleton = by[skeleton_id].read_typetree()
        asset_id = skeleton['skeletonDataAsset']['m_PathID']
        asset = by[asset_id].read_typetree()
        text_id = asset['skeletonJSON']['m_PathID']
        raw = script(by[text_id])
        record = models[ID][face]
        imported = subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
                                            'show', MODEL + ':' + record['path']])
        assert imported == raw and digest(raw) == record['sha256'] and len(raw) == record['bytes'], face
        bindings[ID][face] = {'animatorPathId': art['pathId'], 'skeletonAnimationPathId': str(skeleton_id),
                              'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id),
                              'sha256': digest(raw), 'byteLength': len(raw)}

evidence = {
    'schemaVersion': 1,
    'source': {'repository': 'Kengxxiao/ArknightsGameData_YoStar', 'commit': GLOBAL,
               'nativeClient': CLIENT, 'tableHashes': {name: digest((C / (name + '.json')).read_bytes())
                    for name in ['character_table', 'skill_table', 'range_table', 'buff_template_data', 'enemy_database']},
               'buffDatabase': {'path': 'en_US/gamedata/buff_table.json',
                    'sha256': digest((C / 'lessing-source/buff_table.json').read_bytes()),
                    'gitBlob': next(row['sha'] for row in read(C / 'guard-six-star-third-source/table-tree.json')['tree']
                                    if row['path'] == 'en_US/gamedata/buff_table.json')},
               'bundles': source_bundles, 'modelRepository': 'fexli/ArknightsResource', 'modelCommit': MODEL},
    'frameParity': False, 'moduleSupport': False, 'nativeParticleSupport': False,
    'enabledOperators': [ID], 'reviewStatus': 'Full-kit combat adapter with explicit native fidelity limits',
    'enemies': enemies, 'tokens': {}, 'characters': characters, 'skills': skills, 'projectiles': {},
    'chararts': chararts, 'officialSkeletonBindings': bindings, 'models': models,
    'templates': {key: bt[key] for key in sorted(templates)},
    'originalTemplates': {key: native_templates[key] for key in sorted(templates) if key in native_templates},
    'buffDatabase': {key: database[key] for key in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {},
               'enemies': {row['Key']: row['Value'] for row in read(C / 'enemy_database.json')['enemies'] if row['Key'] == CANDLE},
               'skills': {key: st[key] for key in SKILLS}, 'ranges': {key: rt[key] for key in sorted(ranges)}},
    'runtimeMapping': {
        'adapter': 'server/sim/content/arkpedia-entelechia.js',
        'trait': 'Ground range AoE; .05s block-count collector and .12s self-heal queue, including S2 NORMAL pulses; excludes BUFF DoT.',
        'bloodBank': 'Pre-mitigation final-addition HP transfer with persistent owner cap; current HP clamp; per-source Arts DoT extends and survives removal.',
        'secondServing': 'Native initial undeadable guard, strict below25 percent check, one heal and Physical-only resistance; scripted removal bypasses guard.',
        'S1': 'Two immediate captured-input strikes at the original .4s attack event; uncapped ASPD scaling.',
        'S2': 'Self plus one other ground carrier, x-4 tile pulses every source interval; lifted carrier admits air; ordinary attacks disabled.',
        'S3': 'Source ATK/ASPD/range, A/B strike clips, three highest-current-HP ground hosts, current HP/DEF/RES copy, non-scoring candle lifecycle.',
        'heartCandle': 'Explicit S3 TargetFree selection; Entelechia source restriction, non-BUFF35 percent ATK floor, sourceless host-loss bridge and global skill-end cleanup.',
        'visuals': 'Original operator facing skeletons and skill clips; Heart Candle uses a labelled temporary marker, no fabricated Spine model.'
    },
    'verificationLimits': [
        'Source checks and local engine/browser checks are distinct. The adapter does not establish game frame parity.',
        'The pinned Global table contains entlec_a[line_effect_core], absent from this older native template holder; preserve both sources without claiming particle parity.',
        'Heart Candle uses the native EmptyAnimator, not an enemy Spine skeleton. Its labelled temporary marker is not original effect artwork.',
        'Closed selector enums are bounded: S2 carrier ranking uses nearby enemy count then distance; S3 mask639 excludes marked candles/props/traps but permits bosses.',
        'S2 first pulse uses an interval clock and S3 creation follows the .333s begin clip; exact native FSM/event ordering remains unverified.',
        'Nearest passable tile and .35 owner-facing offset are a local placement bridge, not recovered native placement execution.',
        'The native unmodifiable NoSourceDamage/mask/shield pipeline is bridged to sourceless host HP loss; direct HP-loss cancellation and native undeath bypass are unverified.',
        'Pre-mitigation steal, post-acceptance DoT/heal and current-HP preservation are engine event bridges; native miss/cancellation order is unverified.',
        'Original particles/audio, modules, closed controller execution and exact frame timing remain unfinished.'],
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
}
(ROOT / 'data/arkpedia-entelechia-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(f'Rebuilt {len(templates)} reachable table templates, {len(evidence["originalTemplates"])} native templates and 30 source ranks; retained bounded adapter review')
