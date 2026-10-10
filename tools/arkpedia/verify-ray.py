#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify Ray's evidence independently against pinned original tables and bundles.
Optional evidence-file argument supports negative audits. No extractor is imported.
"""
from collections import deque
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
C = ROOT / '.cache/arkpedia'
ID, TOKEN = 'char_4117_ray', 'token_10034_ray_sndbst'
E = json.loads((Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data/arkpedia-ray-prefabs.json').read_text())
SKILLS = {'skchr_ray_1', 'skchr_ray_2', 'skchr_ray_3'}
TOKEN_SKILLS = {'sktok_ray_2'}

def norm(v, key=''):
    if isinstance(v, dict): return {k: norm(x, k) for k, x in v.items()}
    if isinstance(v, list): return [norm(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

def script(obj):
    raw = obj.read().m_Script
    return raw.encode('utf8', 'surrogateescape') if isinstance(raw, str) else bytes(raw)

def sha(raw): return hashlib.sha256(raw).hexdigest()

paths = {'charpack/' + ID + '.ab': 'all-operator-source/' + ID + '.ab',
         'chararts/' + ID + '.ab': 'ray-source/' + ID + '-chararts.ab'}
for path in ['pkgrps/btl_pfb_tokens_0.ab', 'battle/prefabs/[uc]skills.ab', 'battle/prefabs/[uc]projectiles.ab', 'config/buff_template_holder.ab']:
    paths[path] = 'map-source/ab/' + path
assert len(E['source']['bundles']) == len(paths)
assert {r['path'] for r in E['source']['bundles']} == set(paths)
assert E['source']['commit'] == '57010cb5b2afea112cae57daa756b58676ba6850'
assert E['source']['modelCommit'] == 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == E['source']['nativeClient'] == '26-09-23-17-49-43_b9cc4a'
B = {}
for r in E['source']['bundles']:
    raw = (C / paths[r['path']]).read_bytes()
    manifest = next(m for m in hot['abInfos'] if m['name'] == r['path'])
    assert len(raw) == r['size'] == manifest['abSize']
    assert hashlib.md5(raw).hexdigest() == r['md5'] == manifest['md5']
    assert sha(raw) == r['sha256']
    B[r['path']] = {o.path_id: o for o in UnityPy.load(raw).objects}

# Derive hierarchy membership from GameObject component lists and Transform
# children independently; individually genuine rows can still omit behavior.
count = 0
for group, path in [('characters', 'charpack/' + ID + '.ab'), ('tokens', 'pkgrps/btl_pfb_tokens_0.ab'),
                    ('skills', 'battle/prefabs/[uc]skills.ab'), ('projectiles', 'battle/prefabs/[uc]projectiles.ab')]:
    by = B[path]
    gos = {i: o.read_typetree() for i,o in by.items() if o.type.name == 'GameObject'}
    transforms = {i: o.read_typetree() for i,o in by.items() if o.type.name == 'Transform'}
    supported = {'Transform', 'MonoBehaviour', 'CircleCollider2D', 'BoxCollider2D', 'SphereCollider', 'BoxCollider'}
    for name, rows in E[group].items():
        included = set(gos) if group == 'characters' else set()
        if group != 'characters':
            todo = [i for i,t in transforms.items() if gos[t['m_GameObject']['m_PathID']]['m_Name'] == name]
            assert len(todo) == 1, name
            while todo:
                i = todo.pop(); included.add(transforms[i]['m_GameObject']['m_PathID'])
                todo.extend(c['m_PathID'] for c in transforms[i]['m_Children'])
        expected = {}
        for i in included:
            cs = {str(c['component']['m_PathID']) for c in gos[i]['m_Component'] if by[c['component']['m_PathID']].type.name in supported}
            if cs: expected[str(i)] = cs
        actual = {}
        for row in rows:
            assert row['pathId'] not in actual, 'duplicate object'
            assert gos[int(row['pathId'])]['m_Name'] == row['object']
            ids = [c['pathId'] for c in row['components']]
            assert len(set(ids)) == len(ids), 'duplicate component'
            actual[row['pathId']] = set(ids)
            for c in row['components']:
                assert norm(by[int(c['pathId'])].read_typetree()) == c['data'], (group, c['pathId'])
                count += 1
        assert expected == actual, (group, name, 'missing component or object')
assert set(E['characters']) == {ID} and set(E['tokens']) == {TOKEN}
assert set(E['skills']) == SKILLS | TOKEN_SKILLS

for name, digest in E['source']['tableHashes'].items(): assert sha((C / (name + '.json')).read_bytes()) == digest
assert set(E['source']['tableHashes']) == {'character_table', 'skill_table', 'range_table', 'buff_template_data'}
ct, st, rt, bt = [json.loads((C / (n + '.json')).read_text()) for n in ['character_table','skill_table','range_table','buff_template_data']]
assert E['tables']['character'] == ct[ID]
assert E['tables']['tokens'] == {TOKEN: ct[TOKEN]}
assert E['tables']['skills'] == {k: st[k] for k in SKILLS}
assert E['tables']['tokenSkills'] == {k: st[k] for k in TOKEN_SKILLS}
assert all(len(st[k]['levels']) == 10 for k in SKILLS | TOKEN_SKILLS)
dbraw = (C / 'lessing-source/buff_table.json').read_bytes()
assert sha(dbraw) == E['source']['buffDatabase']['sha256']
db = json.loads(dbraw)
by = B['config/buff_template_holder.ab']
original = next(o.read_typetree()['_templates'] for o in by.values() if o.type.name == 'MonoBehaviour' and '_templates' in o.read_typetree())
nt = {r['templateKey']: r for r in original}
queue = deque([E['characters'], E['tokens'], E['skills'], ct[ID], ct[TOKEN], [st[k] for k in SKILLS | TOKEN_SKILLS]])
ts, ds, ps, ranges = set(), set(), set(), set()
while queue:
    v = queue.popleft()
    if isinstance(v, dict): queue.extend(x for k,x in v.items() if not (k == 'key' and 'value' in v))
    elif isinstance(v, list): queue.extend(v)
    elif isinstance(v, str):
        if v in bt and v not in ts:
            ts.add(v); queue.extend([bt[v], nt.get(v, {})])
        if v in db and v not in ds: ds.add(v); queue.append(db[v])
        if v in rt: ranges.add(v)
        if v.startswith('projectile_') and v not in ps:
            ps.add(v); assert v in E['projectiles'], v; queue.append(E['projectiles'][v])
        if v.startswith(('[', '{')):
            try: queue.append(json.loads(v))
            except json.JSONDecodeError: pass
assert E['templates'] == {k: bt[k] for k in ts}
assert E['originalTemplates'] == {k: nt[k] for k in ts if k in nt}
assert E['nativeTemplateGaps'] == sorted(ts - nt.keys())
assert E['buffDatabase'] == {k: db[k] for k in ds}
assert set(E['projectiles']) == ps
assert E['tables']['ranges'] == {k: rt[k] for k in ranges}

by = B['chararts/' + ID + '.ab']
expected = {i for i,o in by.items() if o.type.name == 'MonoBehaviour' and any(k in o.read_typetree() for k in ['_animations','_spine','_dataAsset'])}
expected.update(by[i].read_typetree()['_faceSwitcher']['m_PathID'] for i in list(expected) if '_faceSwitcher' in by[i].read_typetree())
assert len(E['chararts'][ID]) == len(expected)
assert {int(r['pathId']) for r in E['chararts'][ID]} == expected
for row in E['chararts'][ID]: assert row['data'] == norm(by[int(row['pathId'])].read_typetree())
assert set(E['models']) == set(E['officialSkeletonBindings']) == {ID, TOKEN}
assert set(E['officialSkeletonBindings'][ID]) == {'Front', 'Back'}
assert set(E['officialSkeletonBindings'][TOKEN]) == {'Original'}
for owner, facings in E['officialSkeletonBindings'].items():
    by = B['chararts/' + ID + '.ab' if owner == ID else 'pkgrps/btl_pfb_tokens_0.ab']
    for face, r in facings.items():
        animator = by[int(r['animatorPathId'])].read_typetree()
        ref = animator['_' + face.lower()]['skeleton'] if owner == ID else animator['_skeleton']
        assert ref['m_FileID'] == 0 and str(ref['m_PathID']) == r['skeletonAnimationPathId']
        assert str(animator['_faceSwitcher']['m_PathID']) == r['faceSwitcherPathId']
        skeleton = by[int(ref['m_PathID'])].read_typetree()
        assert str(skeleton['skeletonDataAsset']['m_PathID']) == r['skeletonDataAssetPathId']
        asset = by[int(r['skeletonDataAssetPathId'])].read_typetree()
        assert str(asset['skeletonJSON']['m_PathID']) == r['textAssetPathId']
        raw = script(by[int(r['textAssetPathId'])])
        assert sha(raw) == r['sha256'] == E['models'][owner][face]['sha256']
        assert len(raw) == r['byteLength'] == E['models'][owner][face]['bytes']
        if owner == ID:
            model = E['models'][ID][face]
            path = f'spine/{ID}/{ID}/{face}/{ID}.skel'
            assert model['path'] == path
            imported = subprocess.check_output(['git','-C',str(ROOT.parent / 'arkpedia-sd-assets/.cache/arknights-resource'),'show',E['source']['modelCommit'] + ':' + path])
            assert imported == raw
        else:
            # The original Sandbeast is single-skeleton and belongs to the
            # shared token prefab, not the alternate costume skinpack.
            root = next(c['data'] for row in E['tokens'][TOKEN] for c in row['components'] if '_animator' in c['data'])
            assert str(root['_animator']['m_PathID']) == r['animatorPathId']
            assert by[int(r['textAssetPathId'])].read().m_Name == TOKEN + '.skel'
            assert str(asset['atlasAssets'][0]['m_PathID']) == r['atlasAssetPathId']
            atlas = by[int(r['atlasAssetPathId'])].read_typetree()
            assert str(atlas['atlasFile']['m_PathID']) == r['atlasTextAssetPathId']
            ar = script(by[int(r['atlasTextAssetPathId'])])
            assert sha(ar) == E['models'][TOKEN][face]['atlasSha256']
            artids = {int(r[k]) for k in ['animatorPathId','skeletonAnimationPathId','skeletonDataAssetPathId','atlasAssetPathId','faceSwitcherPathId']}
            assert len(E['originalSandbeastArt']) == len(artids)
            assert {int(a['pathId']) for a in E['originalSandbeastArt']} == artids
            for row in E['originalSandbeastArt']: assert row['data'] == norm(by[int(row['pathId'])].read_typetree())
            (C / f'ray-source/sandbeast/{TOKEN}.skel').write_bytes(raw)
            (C / f'ray-source/sandbeast/{TOKEN}.atlas').write_bytes(ar)
subprocess.check_call(['node','tools/arkpedia/inspect-ray.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
assert json.loads((C / 'ray-source/models.json').read_text()) == E['models']
assert E['enabledOperators'] == [] and E['heldOperators'] == [ID]
assert E['runtimeContracts'] == [] and E['holdReasons']
assert all(E[k] is False for k in ['frameParity','moduleSupport','nativeParticleSupport'])
print(f'Verified {count} native components, 6 bundles, {len(ts)} templates, 40 ranks, {len(ps)} projectile trees and original Ray/Sandbeast skeleton chains; Ray remains held')
