#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Rebuild Ray's complete source foundation from checksum-verified original bytes.

Run with .cache/map-env/bin/python tools/arkpedia/extract-ray.py.
Requires the pinned Global tables, native client bundles and model checkout
already used by this project's source audits. Runtime registration is reviewed separately.
Preserves all source ranks, trait/talent actions and owner/Sandbeast ammunition, projectile and summon dependencies.
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
ID = 'char_4117_ray'
CLIENT = '26-09-23-17-49-43_b9cc4a'
GLOBAL = '57010cb5b2afea112cae57daa756b58676ba6850'
MODEL = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
TOKEN = 'token_10034_ray_sndbst'
SKILLS = ['skchr_ray_1', 'skchr_ray_2', 'skchr_ray_3']
TOKEN_SKILLS = ['sktok_ray_2']
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
art_env = load('chararts/' + ID + '.ab', C / ('ray-source/' + ID + '-chararts.ab'))
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
out = C / 'ray-source/sandbeast'
out.mkdir(exist_ok=True)
(out / (TOKEN + '.skel')).write_bytes(script(token_by[token_text_id]))
assert len(token_asset['atlasAssets']) == 1
token_atlas_id = token_asset['atlasAssets'][0]['m_PathID']
token_atlas = token_by[token_atlas_id].read_typetree()
token_atlas_text_id = token_atlas['atlasFile']['m_PathID']
assert token_by[token_atlas_text_id].read().m_Name == TOKEN + '.atlas'
(out / (TOKEN + '.atlas')).write_bytes(script(token_by[token_atlas_text_id]))
subprocess.check_call(['node', 'tools/arkpedia/inspect-ray.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
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
models = read(C / 'ray-source/models.json')
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
    'enabledOperators': [ID], 'heldOperators': [],
    'reviewStatus': 'Complete three-skill Ray and default Sandbeast adapter; explicit local execution contracts remain',
    'characters': characters, 'skills': skills, 'chararts': chararts,
    'tokens': tokens, 'originalSandbeastArt': original_token_art, 'models': models, 'officialSkeletonBindings': bindings, 'projectiles': projectiles,
    'templates': {k: bt[k] for k in sorted(templates)},
    'originalTemplates': {k: native_templates[k] for k in sorted(templates) if k in native_templates},
    'buffDatabase': {k: database[k] for k in sorted(db_keys)},
    'tables': {'character': ct[ID], 'tokens': {TOKEN: ct[TOKEN]}, 'skills': {k: st[k] for k in SKILLS},
        'tokenSkills': {k: st[k] for k in TOKEN_SKILLS},
        'ranges': {k: rt[k] for k in sorted(ranges)}},
    'nativeTemplateGaps': sorted(templates - native_templates.keys()),

    'recoveredFacts': [
        'All thirty Ray skill ranks and ten Sandbeast S2 ranks are preserved. The token table has null S1/S3 slots; no invented token skills are substituted.',
        'Ray trait capacities are 4/6/8 at E0/E1/E2 and attacks scale 120%. Sandbeast has its own E1/E2 capacities 6/8, starts with zero collected bullets and only exposes its bullet UI through the equipped S2 wrapper.',
        'Five ordinary/S2/S3 directional composite attacks retain fire, reload-break fire and reload branches. Fire gates distinguish RELOAD_FLAG 0/1 with valid types 0/1; reload gates accept 1/2. Numeric ammo attach callbacks remain startEvent 5/endEvent 3, not assumed literal OnAttack.',
        'Original Ray Front/Back fire events are Attack_Loop 0.366666675, S1 Loop 0.266666681, S2 Loop 0.400000006 and S3 Loop 0.300000012. Normal/S2 reload loops last 1.6s and S3 reload loops 0.4s, but these reload clips have no Spine events. Begin/break 0.167s and Down-specific clips are retained.',
        'S1 has one charge at ranks 1..3 and two at ranks 4..10. Kill reload bonus is 1 at ranks 1..7 and 2 at mastery, while push force is 1 except M3 force 2. The kill listener filters SKILL family; fallkill and ordinary kill paths write dynamic_extra separately.',
        'S2 is automatic attack-recovery with 16 SP and indefinite duration. All ranks preserve ATK and ratio respawn_time modifiers. Native token finish transfers its collected cnt to the owner via ray_tr_add; this is not damage, and collected bullets are separate from owner ammunition.',
        'S3 is 16s at every rank. Its reload_interval is an additive -1.2 and restores on finish. Initial cnt==max_cnt chooses attack modes 4/5; otherwise refill modes 3/6 wait for full before switching. Selected two-second bind is projectile-applied. Kill mark yields selected 10 SP once on buff finish, rather than 10 SP per kill.',
        'Sandbeast native deployment is limited to host attack range, requires no direction and occupies zero deployment slots. E1/E2 lifetime is 15/25s. Owner finish kills its tokens and token finish recharges stock. Aura grants range/priority and a separate physical damage scale; selector source filters are preserved without inventing per-owner filtering.',
        'Extreme Focus uses a dedicated stack-on-target controller with family mask 15, max-stack blackboard 3 and selected E2 ATK .08/.09 at potential 5; it does not use the serialized placeholder maxStackCnt 1 as the talent cap.',
        'Default Sandbeast uses one original skeleton linked from pkgrps/btl_pfb_tokens_0.ab, with its native FaceSwitcher and atlas. Alternate costume skinpack is excluded. Ray has two original facing skeletons and linked facing control; all four original projectile trees have speed 15.'
    ],
    'runtimeContracts': ['Original fire Begin/Loop/End clocks scale with selected attack speed; fixed reload uses original Begin once followed by fixed Loop deadlines. Numeric native ammo callbacks are retained without treating them as Spine events.', 'Accepted single-target projectile births consume ordinary ammunition and grant attack SP. Current ATK is sampled at impact; target-focus stacks are sampled at accepted birth and retain through idle/reload.', 'S1 is a finite original-clip command that holds its selected charge and SP lock through Loop/End, requires a legal target and bypasses ordinary ammunition. Owned direct/fall kill callbacks grant the selected bonus once.', 'S3 gates initial partial magazines on a full fixed refill. Born projectile coefficient and Bind survive expiry; one qualifying activation-owned kill returns selected SP once after skill finish.', 'Sandbeast begins its aura and selected lifetime at the original OnStart event. Its S2-only ground-hit collection has no ordinary token attacks, healing or attack-SP receipts.', 'One card is supplied on owner deployment. Token finish starts a thirty-second independent stock clock; active S2 holds its selected ratio on current and already-cooling cards, and removal restores the unscaled remainder.', 'Absent native Sandbeast extra_add is explicitly mapped to zero for collected-ammunition return. This is a local execution contract, not a recovered serialized default.', 'S1 uses numeric off-axis force reduction one and opt-in ground-hole crossing through existing instantaneous 0.1-tile displacement steps with rounded tile centres. Default callers retain reduction two and prior passability rules; native collider/frame parity is unverified.', 'The explicit phase controller owns original Ray clips; accepted attack events do not restart a generic attack animation. Source owner/selected-S2 token ammunition is presented separately from skill SP and readiness.'],
    'verificationLimits': ['Original serialized controllers and animation events do not prove compiled native callback ordering or frame parity.', 'Local reload, cast, hole collision and missing extra_add contracts are explicit; native execution parity is not established by source and fixture tests.', 'Modules, native Unity particles and audio remain separate work.'],
    'holdReasons': [],
    'historicalHoldReasons': ['Ray and Sandbeast are source-audited together but are not registered as playable until the complete ammunition and three-skill adapter is verified.', 'Reload clips have no Spine events while native reload abilities set waitForAttackEvent 1; startEvent 5/endEvent 3 ammo hooks and reload-break composite dispatch require an explicit verified scheduling contract.', 'S1 ordinary/fall kill bonus, collected-ammo refund and S3 full-reload transition must not be approximated by generic summon or per-shot timers.']}
(ROOT / 'data/arkpedia-ray-prefabs.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('Extracted Ray:', len(templates), 'templates,', len(projectiles), 'projectiles,', len(source_bundles), 'bundles')
