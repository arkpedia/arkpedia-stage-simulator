#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Mitm's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-mitm.py.
An optional evidence-file argument supports checking modified audit records.
Requires the pinned bundles/tables used by the existing source extractors.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local-extract'))
import aklz4  # noqa: F401 -- game's LZ4 decoder
import UnityPy
ROOT = Path(__file__).resolve().parents[2]
E = json.loads((Path(sys.argv[1]) if len(sys.argv) > 1 else
    ROOT / 'data/arkpedia-mitm-prefabs.json').read_text())
C = ROOT / '.cache/arkpedia'

# Blob identities independently read from the pinned Global Git tree.
TABLE_GIT_BLOBS = {'buff_template_data': {'path': 'en_US/gamedata/battle/buff_template_data.json', 'sha': 'cb995e7a8d7b5569032bca40f8842ac4df4a56bf', 'size': 15472433}, 'character_table': {'path': 'en_US/gamedata/excel/character_table.json', 'sha': '5d20e09f1f8d630528b8c25bf0c09f811fdbf2da', 'size': 11459107}, 'range_table': {'path': 'en_US/gamedata/excel/range_table.json', 'sha': 'c1e28a9f2c7350bb5f5de13ba27950dca49f0de7', 'size': 42868}, 'skill_table': {'path': 'en_US/gamedata/excel/skill_table.json', 'sha': '11a76a9f2adf5859609e4f423229ff007af30e17', 'size': 9406193}}
for name, record in TABLE_GIT_BLOBS.items():
    raw = (C / (name + ".json")).read_bytes()
    assert len(raw) == record["size"], name
    assert hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() == record["sha"], name
assert E["source"]["tableGitBlobs"] == TABLE_GIT_BLOBS
assert E["source"]["commit"] == "57010cb5b2afea112cae57daa756b58676ba6850"
assert E['source']['modelCommit'] == 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
assert set(E['source']['tableHashes']) == set(TABLE_GIT_BLOBS)
assert {r['path'] for r in E['source']['bundles']} == {'charpack/char_4147_mitm.ab','chararts/char_4147_mitm.ab','battle/prefabs/[uc]skills.ab','battle/prefabs/[uc]projectiles.ab','config/buff_template_holder.ab','pkgrps/btl_pfb_tokens_0.ab'}
assert len(E['source']['bundles']) == 6
TOKENS = {'token_10037_mitm_trshrb'}
assert set(E['tokens']) == TOKENS
assert set(E['tables']['tokens']) == TOKENS
assert set(E['officialTokenSkeletonBindings']) == TOKENS
assert set(E['tokenModels']) == TOKENS
assert set(E['characters']) == {'char_4147_mitm'}
assert set(E['chararts']) == {'char_4147_mitm'}
assert set(E['officialSkeletonBindings']) == {'char_4147_mitm'}
assert set(E['officialSkeletonBindings']['char_4147_mitm']) == {'Front', 'Back'}
assert set(E['models']) == {'char_4147_mitm'}
assert set(E['models']['char_4147_mitm']) == {'commit', 'Front', 'Back'}

BUFF_GIT_BLOB = {'path': 'en_US/gamedata/buff_table.json', 'sha': 'de9e0777610e3be81185ec45841f3e007b51ccbf', 'size': 126837}
buff_raw = (C / 'lessing-source/buff_table.json').read_bytes()
assert len(buff_raw) == BUFF_GIT_BLOB['size']
assert hashlib.sha1(b'blob ' + str(len(buff_raw)).encode() + b'\0' + buff_raw).hexdigest() == BUFF_GIT_BLOB['sha']
assert E['source']['buffDatabase']['gitBlob'] == BUFF_GIT_BLOB

def normalized(v, key=''):
    if isinstance(v, dict): return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, list): return [normalized(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

bundles = {}
for record in E['source']['bundles']:
    path = record['path']
    local = C / ('mitm-source/char_4147_mitm-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_4147_mitm.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_4147_mitm.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
    for objects in E[group].values():
        for obj in objects:
            native = bundles[path][int(obj['pathId'])].read_typetree()
            assert native['m_Name'] == obj['object']
            assert normalized(native) == obj['gameObjectData'], (path, obj['pathId'], 'changed GameObject metadata')
            for component in obj['components']:
                original = bundles[path][int(component['pathId'])].read_typetree()
                assert normalized(original) == component['data'], (path, component['pathId'])
                count += 1

for name, digest in E['source']['tableHashes'].items():
    assert hashlib.sha256((C/(name+'.json')).read_bytes()).hexdigest() == digest
ct = json.loads((C/'character_table.json').read_text()); st = json.loads((C/'skill_table.json').read_text())
assert E['tables']['character'] == ct['char_4147_mitm']
for key, value in E['tables']['tokens'].items(): assert value == ct[key]
assert set(E['tables']['tokenSkills']) == {'sktok_mitm_trshrb_1', 'sktok_mitm_trshrb_2'}
for key, value in E['tables']['tokenSkills'].items(): assert value == st[key]
for key, value in E['tables']['skills'].items(): assert value == st[key]
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_4147_mitm'].items():
    path = 'chararts/char_4147_mitm.ab'
    by = bundles[path]
    animator = by[int(record['animatorPathId'])].read_typetree()
    assert str(animator['_'+face.lower()]['skeleton']['m_PathID']) == record['skeletonAnimationPathId']
    skeleton = by[int(record['skeletonAnimationPathId'])].read_typetree()
    assert str(skeleton['skeletonDataAsset']['m_PathID']) == record['skeletonDataAssetPathId']
    asset = by[int(record['skeletonDataAssetPathId'])].read_typetree()
    assert str(asset['skeletonJSON']['m_PathID']) == record['textAssetPathId']
    raw = by[int(record['textAssetPathId'])].read().m_Script
    if isinstance(raw, str): raw = raw.encode('utf8', 'surrogateescape')
    assert hashlib.sha256(raw).hexdigest() == record['sha256']
    assert len(raw) == record['byteLength']
    model = E['models']['char_4147_mitm'][face]
    imported = subprocess.check_output(['git', '-C', str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'), 'show', E['source']['modelCommit']+':'+model['path']])
    assert imported == raw, face

# Independently walk the native Cherry-3 skeleton instead of trusting the
# exported pointer and clip summaries or deriving it from owner artwork.
by = bundles['pkgrps/btl_pfb_tokens_0.ab']
out = C / 'mitm-source'
for token in sorted(TOKENS):
    record = E['officialTokenSkeletonBindings'][token]
    assert record['bundle'] == 'pkgrps/btl_pfb_tokens_0.ab'
    root = by[int(record['rootPathId'])].read_typetree()
    assert root['m_Name'] == token
    assert any(str(c['component']['m_PathID']) == record['controllerPathId'] for c in root['m_Component'])
    controller = by[int(record['controllerPathId'])].read_typetree()

    def reference(value, expected):
        assert value['m_FileID'] == 0
        assert str(value['m_PathID']) == expected
        return by[int(expected)].read_typetree()

    animator = reference(controller['_animator'], record['animatorPathId'])
    switcher = reference(animator['_faceSwitcher'], record['faceSwitcherPathId'])
    assert normalized(switcher) == record['faceSwitcher']
    assert normalized(animator['_animations']) == record['animationAliases']
    pointers = {'Single': animator['_skeleton']} if '_skeleton' in animator else {
        key.title(): animator['_' + key]['skeleton'] for key in ['front', 'back', 'down']}
    assert set(record['facings']) == set(pointers)
    assert set(E['tokenModels'][token]) == set(pointers)
    for face, pointer in pointers.items():
        facing = record['facings'][face]
        skeleton = reference(pointer, facing['skeletonAnimationPathId'])
        asset = reference(skeleton['skeletonDataAsset'], facing['skeletonDataAssetPathId'])
        reference(asset['skeletonJSON'], facing['textAssetPathId'])
        assert len(asset['atlasAssets']) == 1
        atlas = reference(asset['atlasAssets'][0], facing['atlasAssetPathId'])
        reference(atlas['atlasFile'], facing['atlasTextAssetPathId'])
        for field, extension, hash_key, length_key in [
            ('textAssetPathId', 'skel', 'sha256', 'byteLength'),
            ('atlasTextAssetPathId', 'atlas', 'atlasSha256', 'atlasByteLength')]:
            raw = by[int(facing[field])].read().m_Script
            if isinstance(raw, str): raw = raw.encode('utf8', 'surrogateescape')
            assert hashlib.sha256(raw).hexdigest() == facing[hash_key]
            assert len(raw) == facing[length_key]
            (out / (token + '-' + face.lower() + '.' + extension)).write_bytes(raw)
        assert E['tokenModels'][token][face]['sha256'] == facing['sha256']
        assert E['tokenModels'][token][face]['bytes'] == facing['byteLength']
(out / 'token-bindings.json').write_text(json.dumps(E['officialTokenSkeletonBindings']) + '\n')
subprocess.check_call(['node', 'tools/arkpedia/inspect-mitm.mjs', '--tokens'], cwd=ROOT, stdout=subprocess.DEVNULL)
assert json.loads((out / 'token-models.json').read_text()) == E['tokenModels']
rt = json.loads((C/'range_table.json').read_text())
for key, value in E['tables']['ranges'].items(): assert value == rt[key]
holder = next(o for o in bundles['config/buff_template_holder.ab'].values()
    if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree()).read_typetree()['_templates']
for key, value in E['originalTemplates'].items(): assert value == next(t for t in holder if t['templateKey'] == key)
assert E['nativeTemplateGaps'] == sorted(set(E['templates']) - {t['templateKey'] for t in holder})
assert set(E['originalTemplates']) == set(E['templates']) - set(E['nativeTemplateGaps'])
dbpath = C/'lessing-source/buff_table.json'
assert hashlib.sha256(dbpath.read_bytes()).hexdigest() == E['source']['buffDatabase']['sha256']
db = json.loads(dbpath.read_text())
for key, value in E['buffDatabase'].items(): assert value == db[key]
art_objects = bundles['chararts/char_4147_mitm.ab']
expected_art = {str(i) for i,o in art_objects.items() if o.type.name == 'MonoBehaviour' and any(k in o.read_typetree() for k in ['_animations','_spine','_dataAsset'])}
assert {r['pathId'] for r in E['chararts']['char_4147_mitm']} == expected_art
for row in E['chararts']['char_4147_mitm']:
    assert normalized(bundles['chararts/char_4147_mitm.ab'][int(row['pathId'])].read_typetree()) == row['data']

from collections import deque
queue = deque([(value, '') for value in [E['characters'], E['tokens'], E['skills'], ct['char_4147_mitm'], [ct[k] for k in TOKENS],
    [st[key] for key in [*E['tables']['skills'], *E['tables']['tokenSkills']]]]])
reachable, dbkeys, projectile_keys, range_keys = set(), set(), set(), set()
PROJECTILE_PARAMETER_FIELDS = {'key', '_blackboardKey', '_blackboardKeys', '_fromBlackboardKeys', '_sourceBlackboardKey', '_targetBlackboardKey', '_inputKey', '_outputKey', '_maxValueKey', '_anotherKeyToCompare', '_addParamKey'}
while queue:
    value, key = queue.popleft()
    if key in ['_overrideAudioSignal', 'audioSignal']: continue
    if isinstance(value, dict): queue.extend((v, k) for k, v in value.items())
    elif isinstance(value, list): queue.extend((v, key) for v in value)
    elif isinstance(value, str):
        if value in bt and value not in reachable:
            reachable.add(value); queue.append((bt[value], '')); queue.append((next((t for t in holder if t['templateKey'] == value), {}), ''))
        if value in db and value not in dbkeys:
            dbkeys.add(value); queue.append((db[value], ''))
        if value.startswith('projectile_') and key not in PROJECTILE_PARAMETER_FIELDS and value not in projectile_keys:
            projectile_keys.add(value)
            assert value in E['projectiles'], ('missing projectile dependency', value)
            queue.append((E['projectiles'][value], ''))
        if value in rt: range_keys.add(value)
        if value.startswith(('[', '{')):
            try: queue.append((json.loads(value), ''))
            except json.JSONDecodeError: pass
assert reachable == set(E['templates'])
assert dbkeys == set(E['buffDatabase'])
assert projectile_keys == set(E['projectiles'])
assert range_keys == set(E['tables']['ranges'])
# Require whole original object/component membership, not a selected subset of
# individually valid components. Derive hierarchy independently from native
# Transform parent pointers and GameObject component lists.
for group, path in [('characters','charpack/char_4147_mitm.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('skills','battle/prefabs/[uc]skills.ab'),
                    ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
    by = bundles[path]
    gos = {i: o.read_typetree() for i, o in by.items() if o.type.name == 'GameObject'}
    transforms = {i: o.read_typetree() for i, o in by.items() if o.type.name == 'Transform'}
    owners = {i: t['m_GameObject']['m_PathID'] for i, t in transforms.items()}
    supported = {'Transform','MonoBehaviour','CircleCollider2D','BoxCollider2D','SphereCollider','BoxCollider'}
    for name, rows in E[group].items():
        assert len(rows) == len({r['pathId'] for r in rows}), (group, name, 'duplicate objects')
        for row in rows:
            assert len(row['components']) == len({c['pathId'] for c in row['components']}), (group, name, 'duplicate components')
        included = set(gos) if group == 'characters' else set()
        if group != 'characters':
            todo = [i for i, go in owners.items() if gos[go]['m_Name'] == name]
            assert len(todo) == 1, name
            while todo:
                t = todo.pop(); included.add(owners[t])
                todo.extend(i for i,v in transforms.items() if v['m_Father']['m_PathID'] == t)
        expected = {}
        for go in included:
            ids = {str(c['component']['m_PathID']) for c in gos[go]['m_Component']
                   if by[c['component']['m_PathID']].type.name in supported}
            if ids: expected[str(go)] = ids
        actual = {r['pathId']: {c['pathId'] for c in r['components']} for r in rows}
        assert actual == expected, (group, name, 'incomplete component membership')
hot = json.loads((C/'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == E['source']['nativeClient'] == '26-09-23-17-49-43_b9cc4a'
for record in E['source']['bundles']:
    native = next(row for row in hot['abInfos'] if row['name'] == record['path'])
    assert (record['md5'], record['size']) == (native['md5'], native['abSize'])
assert E['enabledOperators'] == [] and E['heldOperators'] == ['char_4147_mitm']
assert E['reviewStatus'] == 'Native source foundation; complete public kit remains unreviewed'
assert E['holdReasons'] == ['Complete owner combat, tactical point, Cherry-3 and Wreckage lifecycle, skills, talents and public lifecycle require review']
assert E['frameParity'] is False and E['moduleSupport'] is False and E['nativeParticleSupport'] is False
assert set(E['tables']['skills']) == {'skchr_mitm_1', 'skchr_mitm_2'}
assert set(E['skills']) == set(E['tables']['skills']) | set(E['tables']['tokenSkills'])
assert all(len(s['levels']) == 10 for s in E['tables']['skills'].values())
assert all(len(s['levels']) == 1 for s in E['tables']['tokenSkills'].values())
assert E['projectiles'] and E['templates']
# Independently parse the pinned skeleton/atlas bytes, including unrounded event
# payloads. Hash-valid art is insufficient if the event summaries were edited.
subprocess.check_call(['node', 'tools/arkpedia/inspect-mitm.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
assert json.loads((C/'mitm-source/models.json').read_text()) == E['models']
unique = set()
for group, path in [('characters','charpack/char_4147_mitm.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab')]:
    for rows in E[group].values():
        unique.update((path, c['pathId']) for row in rows for c in row['components'])
print(f"Verified {count} component records ({len(unique)} unique), six original bundles, {len(E['templates'])} templates, twenty owner ranks and two single-rank token passives, {len(E['projectiles'])} projectile trees and two owner and one token skeleton chains")
