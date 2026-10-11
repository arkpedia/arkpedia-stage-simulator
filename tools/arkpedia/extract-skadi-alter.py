#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Skadi the Corrupting Heart's source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-skadi-alter.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. This does not enable an unresolved kit.
Includes the operator, skills, Seaborn token and original buff closure.
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
ID = 'char_1012_skadi2'
TOKEN = 'token_10017_skadi2_dedant'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SKILLS = ['skchr_skadi2_1', 'skchr_skadi2_2', 'skchr_skadi2_3']
TOKEN_SKILLS = ['sktok_skadi2_1', 'sktok_skadi2_2', 'sktok_skadi2_3']


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
art_env = load('chararts/' + ID + '.ab', C / ('skadi-alter-source/' + ID + '-chararts.ab'))
chararts = {ID: [{'pathId': str(o.path_id), 'data': exact(o.read_typetree())}
    for o in art_env.objects if o.type.name == 'MonoBehaviour' and
    any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]}
skills = records(load('battle/prefabs/[uc]skills.ab', C / 'map-source/ab/battle/prefabs/[uc]skills.ab'), SKILLS + TOKEN_SKILLS)
token_bundle = 'pkgrps/btl_pfb_tokens_0.ab'
tokens = records(load(token_bundle, C / ('map-source/ab/' + token_bundle)), [TOKEN])
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
models = read(C / 'skadi-alter-source/models.json')
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
            'skeletonDataAssetPathId': str(asset_id), 'textAssetPathId': str(text_id), 'sha256': digest(raw), 'byteLength': len(raw), 'faceSwitcherPathId': art['data']['_faceSwitcher']['m_PathID'], 'facingAlias': 'single-original-model'}
token_model = read(C / 'skadi-alter-source/seaborn/sources.json')
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
    'enabledOperators': [ID], 'heldOperators': [],
    'reviewStatus': 'Complete bounded owner/Seaborn runtime; native dispatch and frame parity remain unverified',
    'runtimeContract': [
        'S1 shares the post-mitigation amount at damageFinal priority -2000, before shields; the owner receives HP loss with inherited credit/origin, bypassing repeat mitigation and sharing recursion. Strongest protection wins across overlapping areas. Serialized NORMAL is not reinterpreted as a fresh attack.',
        'Seaborn areas use live host ATK/DEF and selected matching ranks, immediately mirror an active owner mode, interrupt when it ends, expire independently after15/25s and recharge one stock30s after removal. Host removal clears owned Seaborn and all recipient effects.',
        'Healing reaches self and eligible allies once per second with immediate entry, merging owner/Seaborn overlap. It bypasses heal-free/no-heal and healing multipliers as regeneration but honors regeneration multipliers and isolation. Inspiration ignores isolation and excludes immune bards.',
        'Inspiration chooses the strongest source ratio per attribute and applies live host-derived final additions refreshed every1s; owner and Seaborn do not stack support effects. Predatory Habits follows other operators in either area and Abyssal group tags.',
        'S3 uses independent per-enemy clocks with native first delays .9s/.85s, then1s, plus owner-only5% maxHP loss beginning .95s. Both damage areas credit the host and stack; no ordinary attack or visible token skill is invented.'
    ],
    'gameplayCorroboration': [
        {'url': 'https://prts.wiki/w/Skadi_the_Corrupting_Heart', 'checked': '2026-10-10',
         'claims': ['Transferred damage is HP loss, cannot transfer existing HP loss and has priority -2000.', 'Inspiration prioritizes ratio rather than final numerical value.', 'S1 full-heal precedes subsequent effects.']},
        {'url': 'https://arknights.wiki.gg/wiki/Skadi_the_Corrupting_Heart', 'checked': '2026-10-10',
         'claims': ['S1 transfer follows damage mitigation and becomes direct HP removal.']}
    ],
    'characters': characters, 'skills': skills, 'tokens': tokens, 'chararts': chararts,
    'models': models, 'officialSkeletonBindings': bindings, 'originalSeabornModels': token_model, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {TOKEN: ct[TOKEN]},
        'skills': {k: st[k] for k in SKILLS}, 'tokenSkills': {k: st[k] for k in TOKEN_SKILLS}, 'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),
    'recoveredFacts': [
        'Source trait is 10% owner ATK per second and not direct attacks. Owner and Seaborn healing buffs share skadi2_heal, independentCharacterSource1, interval1 and waitFirstTriggerInterval0; heal-free and target-free restrictions are explicitly ignored by the native heal selector.',
        'All three owner skills and all three corresponding Seaborn skill prefab hierarchies are retained, not just the owner graphs. Token skill roots are hidden, infinite wrappers; S1 and S2 explicitly fetch attack blackboards from modes1/2.',
        'S1 owner MaxHP modifier and full-HP restoration are distinct from the range protect aura. Protect action sequence is DamageSplit(BUFF_SOURCE,NORMAL) then nonstack one-minus DamageScale, at LOWER_PRIORITY.',
        'S2 ATK and DEF Inspiration auras trigger immediately then every1s; S3 ATK Inspiration shares that clock, but enemy PURE damage waits for distinct native initial offsets (owner .9s, token .85s), then repeats every1s. Owned Seaborn has separate hidden infinite skill wrappers; their compiled host-stat ownership is not recovered.',
        'S3 PURE damage applies independently in owner and Seaborn areas; healing is replaced with a separate HP loss buff on the owner. Native owner HP-loss firstTriggerInterval is .95s, distinct from both damage auras. Token base ATK100 is not used as a replacement for unresolved owner-stat ownership.',
        'Talent2 owner aura uses selfOption2 and professionMask639; token additionally excludes Skadi mark recipients. Ordinary or Abyssal Hunter ATK multiplier buffs share one override bucket. Table-selected E2 bonuses are6%/15% or9%/18% at potential5.',
        'Seaborn is native category2, slot0, any deployable tile and no direction picker. Source cost5, respawn30, maxDeployCount1; selected E1/E2 lifetime15/25 is separate from recharge on owner finish. Host death removes owned tokens.',
        'Seaborn uses one original skeleton plus a FaceSwitcher; front/back publication intentionally aliases the same native skeleton. RGB and separate alpha dependencies are followed through material pointers, not duplicate filenames.'
    ],
    'holdReasons': [],
    'fidelityLimits': [
        'Original compiled C# DamageSplit dispatcher and exact event envelope are not recovered. Post-mitigation/pre-shield sharing, inherited origin and HP-loss bookkeeping are explicit local mappings corroborated by gameplay references, not native frame certification.',
        'Token host-stat transfer, nonstack overlap and mode synchronization are bounded contracts tested locally. Source-source tie order, tick quantization and same-frame modifier ordering are not certified.',
        'All original owner/token graphs and selected ranks remain retained. Modules, native particles and audio are unavailable; original art alone does not imply full visual fidelity.'
    ]}
(ROOT / 'data/arkpedia-skadi-alter-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted bounded Skadi/Seaborn full source kit:', len(templates), 'templates,',len(source_bundles),'verified bundles')
