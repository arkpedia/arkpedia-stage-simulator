#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Entelechia's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-entelechia.py.
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
E = json.loads((ROOT / 'data/arkpedia-entelechia-prefabs.json').read_text())
C = ROOT / '.cache/arkpedia'

def normalized(v, key=''):
    if isinstance(v, dict): return {k: normalized(x, k) for k, x in v.items()}
    if isinstance(v, list): return [normalized(x) for x in v]
    if key == 'm_PathID': return str(v)
    if isinstance(v, float) and not math.isfinite(v): return 'Infinity' if v > 0 else '-Infinity' if v < 0 else 'NaN'
    return v

bundles = {}
for record in E['source']['bundles']:
    path = record['path']
    local = C / ('entelechia-source/char_4010_etlchi-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_4010_etlchi.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_4010_etlchi.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('projectiles','battle/prefabs/[uc]projectiles.ab'), ('enemies','battle/enm_pfb_23.ab')]:
    for objects in E[group].values():
        for obj in objects:
            native = bundles[path][int(obj['pathId'])].read_typetree()
            assert native['m_Name'] == obj['object']
            for component in obj['components']:
                original = bundles[path][int(component['pathId'])].read_typetree()
                assert normalized(original) == component['data'], (path, component['pathId'])
                count += 1

for name, digest in E['source']['tableHashes'].items():
    assert hashlib.sha256((C/(name+'.json')).read_bytes()).hexdigest() == digest
ct = json.loads((C/'character_table.json').read_text()); st = json.loads((C/'skill_table.json').read_text())
assert E['tables']['character'] == ct['char_4010_etlchi']
for key, value in E['tables']['skills'].items(): assert value == st[key]
ed = json.loads((C/'enemy_database.json').read_text())
for key, value in E['tables']['enemies'].items(): assert value == next(r['Value'] for r in ed['enemies'] if r['Key'] == key)
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_4010_etlchi'].items():
    path = 'chararts/char_4010_etlchi.ab'
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
    model = E['models']['char_4010_etlchi'][face]
    imported = subprocess.check_output(['git', '-C', str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'), 'show', E['source']['modelCommit']+':'+model['path']])
    assert imported == raw, face
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
for row in E['chararts']['char_4010_etlchi']:
    assert normalized(bundles['chararts/char_4010_etlchi.ab'][int(row['pathId'])].read_typetree()) == row['data']
# Verify the complete recursive buff-template closure, not just stored records.
reachable, dbkeys = set(), set()
def scan(v):
    if isinstance(v, dict):
        key = v.get('buffKey') or v.get('_buffKey')
        if (v.get('loadFromDB') or 'CreateBuffById' in v.get('$type', '')) and key in db and key not in dbkeys:
            dbkeys.add(key); scan(db[key])
        for k, x in v.items():
            if k in ['templateKey','_buffKey'] and isinstance(x,str) and x in bt: reachable.add(x)
            else: scan(x)
    elif isinstance(v,list):
        for x in v: scan(x)
scan([E['characters'], E['skills'], E['enemies']])
while True:
    size = len(reachable)
    for key in list(reachable): scan(bt[key])
    if size == len(reachable): break
assert reachable == set(E['templates'])
assert dbkeys == set(E['buffDatabase'])
assert len(E['tables']['skills']) == 3
assert all(len(value['levels']) == 10 for value in E['tables']['skills'].values())
assert E['enabledOperators'] == ['char_4010_etlchi']
assert E['runtimeMapping']['adapter'] == 'server/sim/content/arkpedia-entelechia.js'
assert E['frameParity'] is False and E['moduleSupport'] is False and E['nativeParticleSupport'] is False
print(f'Verified {count} native components, {len(bundles)} bundles, {len(E["templates"])} templates, 30 ranks and both original skeleton chains')
