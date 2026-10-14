#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently walk Necrass's original hierarchies and dependency closure.

Source verification only. Does not import the exporter or approve combat.
Optional receipt path supports rejecting modified evidence without changing it.
"""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401 -- original client decoder
import UnityPy

C = ROOT / '.cache/arkpedia'
OUT = C / 'necrass-source'
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data/arkpedia-necrass-prefabs.json'
E = json.loads(SOURCE.read_text())
ID = 'char_450_necras'
TOKEN = 'token_10043_necras_skeltn'
SKILLS = ['skchr_necras_' + str(n) for n in range(1, 4)]
TOKEN_SKILLS = ['sktok_necras_skeltn_' + str(n) for n in range(1, 4)]
TABLES = {
    'character_table': ('en_US/gamedata/excel/character_table.json', '5d20e09f1f8d630528b8c25bf0c09f811fdbf2da', 11459107),
    'skill_table': ('en_US/gamedata/excel/skill_table.json', '11a76a9f2adf5859609e4f423229ff007af30e17', 9406193),
    'range_table': ('en_US/gamedata/excel/range_table.json', 'c1e28a9f2c7350bb5f5de13ba27950dca49f0de7', 42868),
    'buff_template_data': ('en_US/gamedata/battle/buff_template_data.json', 'cb995e7a8d7b5569032bca40f8842ac4df4a56bf', 15472433),
}
BUFF_BLOB = {'path': 'en_US/gamedata/buff_table.json', 'sha': 'de9e0777610e3be81185ec45841f3e007b51ccbf', 'size': 126837}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def norm(v, key=''):
    if isinstance(v, dict): return {k: norm(x, k) for k, x in v.items()}
    if isinstance(v, list): return [norm(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v):
        return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v


def script(obj):
    v = obj.read().m_Script
    return v.encode('utf8', 'surrogateescape') if isinstance(v, str) else bytes(v)


assert E['schemaVersion'] == 1
assert E['source']['repository'] == 'Kengxxiao/ArknightsGameData_YoStar'
assert E['source']['commit'] == '57010cb5b2afea112cae57daa756b58676ba6850'
assert E['source']['nativeClient'] == '26-09-23-17-49-43_b9cc4a'
assert E['source']['modelRepository'] == 'fexli/ArknightsResource'
assert E['source']['modelCommit'] == 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
assert E['enabledOperators'] == [] and E['heldOperators'] == [ID]
for k in ['frameParity', 'moduleSupport', 'nativeParticleSupport']: assert E[k] is False
assert E['recoveredFacts'] == []
assert E['reviewStatus'] == 'Native source foundation; complete public kit remains unreviewed'
assert E['holdReasons'] == ['Owner attacks, servant birth/upgrade/death, S2 Sleep damage, S3 special servant, all talents and public lifecycle require review']
assert E['nativeSkillPrefabGaps'] == []
assert E['source']['tableGitBlobs'] == {k: {'path': p, 'sha': s, 'size': n} for k, (p, s, n) in TABLES.items()}
assert set(E['source']['tableHashes']) == set(TABLES)
tables = {}
for k, (_, blob, size) in TABLES.items():
    raw = (C / (k + '.json')).read_bytes()
    assert len(raw) == size and hashlib.sha1(b'blob ' + str(size).encode() + b'\0' + raw).hexdigest() == blob
    assert sha(raw) == E['source']['tableHashes'][k]
    tables[k] = json.loads(raw)
buff_raw = (C / 'lessing-source/buff_table.json').read_bytes()
assert len(buff_raw) == BUFF_BLOB['size']
assert hashlib.sha1(b'blob ' + str(len(buff_raw)).encode() + b'\0' + buff_raw).hexdigest() == BUFF_BLOB['sha']
assert E['source']['buffDatabase'] == {'path': BUFF_BLOB['path'], 'gitBlob': BUFF_BLOB, 'sha256': sha(buff_raw)}
db = json.loads(buff_raw)
ct, st, rt, bt = [tables[k] for k in ['character_table', 'skill_table', 'range_table', 'buff_template_data']]
assert E['tables']['character'] == ct[ID]
assert E['tables']['tokens'] == {TOKEN: ct[TOKEN]}
assert E['tables']['skills'] == {k: st[k] for k in SKILLS}
assert E['tables']['tokenSkills'] == {k: st[k] for k in TOKEN_SKILLS}
paths = {
    'charpack/' + ID + '.ab': C / ('all-operator-source/' + ID + '.ab'),
    'chararts/' + ID + '.ab': OUT / (ID + '-chararts.ab'),
    **{p: C / ('map-source/ab/' + p) for p in ['pkgrps/btl_pfb_tokens_0.ab', 'battle/prefabs/[uc]skills.ab',
       'battle/prefabs/[uc]projectiles.ab', 'config/buff_template_holder.ab']},
}
manifest = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert manifest['versionId'] == E['source']['nativeClient']
assert len(E['source']['bundles']) == len(paths)
assert {r['path'] for r in E['source']['bundles']} == set(paths)
bundles = {}
for p, path in paths.items():
    raw = path.read_bytes()
    m = next(x for x in manifest['abInfos'] if x['name'] == p)
    assert len(raw) == m['abSize'] and hashlib.md5(raw).hexdigest() == m['md5']
    assert next(x for x in E['source']['bundles'] if x['path'] == p) == {
        'path': p, 'size': len(raw), 'md5': m['md5'], 'sha256': sha(raw)}
    bundles[p] = {o.path_id: o for o in UnityPy.load(raw).objects}


def hierarchy(bundle, root=None):
    # Walk m_Children from original Transform objects; exporter uses m_Father.
    objects = bundles[bundle]
    wanted = set()
    if root is None:
        wanted = {i for i, o in objects.items() if o.type.name == 'GameObject'}
    else:
        starts = [o for o in objects.values() if o.type.name == 'GameObject' and o.read().m_Name == root]
        assert len(starts) == 1, root
        def visit(go_id):
            assert go_id not in wanted, ('cycle/duplicate', root, go_id)
            wanted.add(go_id)
            go = objects[go_id].read_typetree()
            tr = next(objects[r['component']['m_PathID']] for r in go['m_Component']
                      if objects[r['component']['m_PathID']].type.name == 'Transform')
            for ref in tr.read_typetree()['m_Children']:
                assert ref['m_FileID'] == 0
                visit(objects[ref['m_PathID']].read_typetree()['m_GameObject']['m_PathID'])
        visit(starts[0].path_id)
    result = []
    types = {'Transform', 'MonoBehaviour', 'CircleCollider2D', 'BoxCollider2D', 'SphereCollider', 'BoxCollider'}
    for i in sorted(wanted):
        go = objects[i].read_typetree()
        components = [objects[r['component']['m_PathID']] for r in go['m_Component']
                      if objects[r['component']['m_PathID']].type.name in types]
        if components:
            result.append({'object': go['m_Name'], 'pathId': str(i), 'gameObjectData': norm(go),
                'components': [{'pathId': str(o.path_id), 'data': norm(o.read_typetree())} for o in components]})
    return result


def canonical(rows):
    return [{**r, 'components': sorted(r['components'], key=lambda x: int(x['pathId']))} for r in rows]


characters = {ID: hierarchy('charpack/' + ID + '.ab')}
tokens = {TOKEN: hierarchy('pkgrps/btl_pfb_tokens_0.ab', TOKEN)}
skills = {k: hierarchy('battle/prefabs/[uc]skills.ab', k) for k in SKILLS + TOKEN_SKILLS}
for group, original in [('characters', characters), ('tokens', tokens), ('skills', skills)]:
    assert set(E[group]) == set(original)
    for k, v in original.items(): assert canonical(E[group][k]) == canonical(v), (group, k)
holder = next(o.read_typetree()['_templates'] for o in bundles['config/buff_template_holder.ab'].values()
              if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree())
native = {r['templateKey']: r for r in holder}
templates, buff_keys, projectiles = set(), set(), {}
parameter_fields = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey',
    '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey'}
# Iterative queue includes decoded SerializedState strings and native-only keys.
pending = [(v, '') for v in [characters, tokens, skills, ct[ID], ct[TOKEN], *[st[k] for k in SKILLS + TOKEN_SKILLS]]]
while pending:
    v, field = pending.pop()
    if field in ['_overrideAudioSignal', 'audioSignal']: continue
    if isinstance(v, dict): pending.extend((x, k) for k, x in v.items())
    elif isinstance(v, list): pending.extend((x, field) for x in v)
    elif isinstance(v, str):
        if v in native or v in bt:
            if v not in templates:
                templates.add(v); pending.extend([(bt.get(v, {}), ''), (native.get(v, {}), '')])
        if v in db and v not in buff_keys:
            buff_keys.add(v); pending.append((db[v], ''))
        if v.startswith('projectile_') and field not in parameter_fields and v not in projectiles:
            projectiles[v] = hierarchy('battle/prefabs/[uc]projectiles.ab', v)
            pending.append((projectiles[v], ''))
        if v.startswith(('[', '{')):
            try: pending.append((json.loads(v), ''))
            except json.JSONDecodeError: pass
assert E['templates'] == {k: bt[k] for k in templates if k in bt}
assert E['originalTemplates'] == {k: norm(native[k]) for k in templates if k in native}
assert E['buffDatabase'] == {k: db[k] for k in buff_keys}
assert E['nativeTemplateGaps'] == sorted(templates - native.keys())
assert E['jsonTemplateGaps'] == sorted(templates - bt.keys())
assert set(E['projectiles']) == set(projectiles)
for k, v in projectiles.items(): assert canonical(E['projectiles'][k]) == canonical(v)
ranges = {p['rangeId'] for char in [ct[ID], ct[TOKEN]] for p in char['phases']}
pending = [ct[ID], ct[TOKEN], *[st[k] for k in SKILLS + TOKEN_SKILLS], characters, tokens, skills,
           projectiles, E['templates'], E['originalTemplates'], E['buffDatabase']]
while pending:
    v = pending.pop()
    if isinstance(v, dict): pending.extend(v.values())
    elif isinstance(v, list): pending.extend(v)
    elif isinstance(v, str):
        if v in rt: ranges.add(v)
        if v.startswith(('[', '{')):
            try: pending.append(json.loads(v))
            except json.JSONDecodeError: pass
assert E['tables']['ranges'] == {k: rt[k] for k in ranges}


def binding(objects, animator_id, pointer, r, token=False):
    def ref(v, expected):
        assert v['m_FileID'] == 0 and str(v['m_PathID']) == expected
        return objects[int(expected)].read_typetree()
    skeleton = ref(pointer, r['skeletonAnimationPathId'])
    asset = ref(skeleton['skeletonDataAsset'], r['skeletonDataAssetPathId'])
    ref(asset['skeletonJSON'], r['textAssetPathId'])
    raw = script(objects[int(r['textAssetPathId'])])
    assert sha(raw) == r['sha256'] and len(raw) == r['byteLength']
    if token:
        assert len(asset['atlasAssets']) == 1
        atlas = ref(asset['atlasAssets'][0], r['atlasAssetPathId'])
        ref(atlas['atlasFile'], r['atlasTextAssetPathId'])
        atlas_raw = script(objects[int(r['atlasTextAssetPathId'])])
        assert sha(atlas_raw) == r['atlasSha256'] and len(atlas_raw) == r['atlasByteLength']
        return raw, atlas_raw
    assert r['animatorPathId'] == str(animator_id)
    return raw


arts = bundles['chararts/' + ID + '.ab']
art_rows = [{'pathId': str(i), 'data': norm(o.read_typetree())} for i, o in arts.items()
    if o.type.name == 'MonoBehaviour' and any(k in o.read_typetree() for k in ['_animations', '_spine', '_dataAsset'])]
assert E['chararts'] == {ID: art_rows}
assert set(E['officialSkeletonBindings']) == {ID}
assert set(E['officialSkeletonBindings'][ID]) == {'Front', 'Back'}
animator = next(r for r in art_rows if '_animations' in r['data'])
for face, r in E['officialSkeletonBindings'][ID].items():
    raw = binding(arts, animator['pathId'], animator['data']['_' + face.lower()]['skeleton'], r)
    path = f'spine/{ID}/{ID}/{face}/{ID}.skel'
    assert E['models'][ID][face]['path'] == path
    assert raw == subprocess.check_output(['git', '-C', str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),
        'show', E['source']['modelCommit'] + ':' + path])
assert set(E['officialTokenSkeletonBindings']) == {TOKEN}
r = E['officialTokenSkeletonBindings'][TOKEN]
assert r['bundle'] == 'pkgrps/btl_pfb_tokens_0.ab'
objects = bundles[r['bundle']]
root = next(x for x in tokens[TOKEN] if x['object'] == TOKEN)
controller = next(x for x in root['components'] if '_animator' in x['data'])
assert r['rootPathId'] == root['pathId'] and r['controllerPathId'] == controller['pathId']
assert controller['data']['_animator']['m_FileID'] == 0
assert controller['data']['_animator']['m_PathID'] == r['animatorPathId']
a = objects[int(r['animatorPathId'])].read_typetree()
assert a['_animations'] == r['animationAliases']
assert a['_faceSwitcher']['m_FileID'] == 0 and str(a['_faceSwitcher']['m_PathID']) == r['faceSwitcherPathId']
assert norm(objects[int(r['faceSwitcherPathId'])].read_typetree()) == r['faceSwitcher']
assert set(r['facings']) == {'Front', 'Back'}
for face, b in r['facings'].items():
    raw, atlas = binding(objects, r['animatorPathId'], a['_' + face.lower()]['skeleton'], b, True)
    stem = OUT / (TOKEN + '-' + face.lower())
    assert stem.with_suffix('.skel').read_bytes() == raw and stem.with_suffix('.atlas').read_bytes() == atlas
for args in [[], ['--tokens']]:
    subprocess.check_output(['node', 'tools/arkpedia/inspect-necrass.mjs', *args, '--verify', str(SOURCE)], cwd=ROOT)
assert E['modelAliasGaps'] == {k: {face: m['missingRequiredAliases'] for face, m in faces.items()
    if m['missingRequiredAliases']} for k, faces in E['tokenModels'].items()
    if any(m['missingRequiredAliases'] for m in faces.values())}
count = sum(len(r['components']) for group in [characters, tokens, skills, projectiles] for rows in group.values() for r in rows)
print(f'Verified original Necrass source: {count} components, {len(templates)} dependency templates, four facing models; no combat approval')
