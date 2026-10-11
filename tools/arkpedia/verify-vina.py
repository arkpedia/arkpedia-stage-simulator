#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently compare Vina Victoria's durable evidence to cached original client bytes.
Run with .cache/map-env/bin/python tools/arkpedia/verify-vina.py.
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
E = json.loads((ROOT / 'data/arkpedia-vina-prefabs.json').read_text())
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
    local = C / ('vina-source/char_1019_siege2-chararts.ab' if path.startswith('chararts/') else 'all-operator-source/char_1019_siege2.ab' if path.startswith('charpack/') else 'map-source/ab/' + path)
    raw = local.read_bytes()
    assert len(raw) == record['size'], path
    assert hashlib.md5(raw).hexdigest() == record['md5'], path
    assert hashlib.sha256(raw).hexdigest() == record['sha256'], path
    bundles[path] = {o.path_id: o for o in UnityPy.load(raw).objects}

count = 0
for group, path in [('characters','charpack/char_1019_siege2.ab'), ('skills','battle/prefabs/[uc]skills.ab'), ('tokens','pkgrps/btl_pfb_tokens_0.ab')]:
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
assert E['tables']['character'] == ct['char_1019_siege2']
for key, value in E['tables']['skills'].items(): assert value == st[key]
bt = json.loads((C/'buff_template_data.json').read_text())
for key, value in E['templates'].items(): assert value == bt[key]
import subprocess
for face, record in E['officialSkeletonBindings']['char_1019_siege2'].items():
    path = 'chararts/char_1019_siege2.ab'
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
    model = E['models']['char_1019_siege2'][face]
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
for row in E['chararts']['char_1019_siege2']:
    assert normalized(bundles['chararts/char_1019_siege2.ab'][int(row['pathId'])].read_typetree()) == row['data']
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
scan([E['characters'], E['skills'], E['tokens']])
while True:
    size = len(reachable)
    for key in list(reachable): scan(bt[key])
    if size == len(reachable): break
assert reachable == set(E['templates'])
assert dbkeys == set(E['buffDatabase'])
assert len(E['tables']['skills']) == 3
assert all(len(value['levels']) == 10 for value in E['tables']['skills'].values())
assert E['enabledOperators'] == ['char_1019_siege2']
assert set(E['runtimeMapping']) == {'normal', 'talent1', 'talent2', 's1', 's2', 's3', 'token'}
assert len(E['tokens']) == 1
assert E['frameParity'] is False and E['moduleSupport'] is False and E['nativeParticleSupport'] is False
# Independently validate the token animator, exact RGBA texture and file hashes.
by = bundles['pkgrps/btl_pfb_tokens_0.ab']
record = E['models']['token_10040_siege2_vlion']
refs = record['originalPathIds']
root = by[int(refs['rootPathId'])].read_typetree()
assert str(root['_animator']['m_PathID']) == refs['animatorPathId']
animator = by[int(refs['animatorPathId'])].read_typetree()
assert str(animator['_skeleton']['m_PathID']) == refs['skeletonAnimationPathId']
skeleton = by[int(refs['skeletonAnimationPathId'])].read_typetree()
assert str(skeleton['skeletonDataAsset']['m_PathID']) == refs['skeletonDataAssetPathId']
asset = by[int(refs['skeletonDataAssetPathId'])].read_typetree()
assert str(asset['skeletonJSON']['m_PathID']) == refs['textAssetPathId']
assert str(asset['atlasAssets'][0]['m_PathID']) == refs['atlasAssetPathId']
atlas = by[int(refs['atlasAssetPathId'])].read_typetree()
assert str(atlas['atlasFile']['m_PathID']) == refs['atlasTextAssetPathId']
assert str(atlas['materials'][0]['m_PathID']) == refs['materialPathId']
material = by[int(refs['materialPathId'])].read_typetree()
tex = dict(material['m_SavedProperties']['m_TexEnvs'])
assert str(tex['_MainTex']['m_Texture']['m_PathID']) == refs['rgbTexturePathId']
assert str(tex['_AlphaTex']['m_Texture']['m_PathID']) == refs['alphaTexturePathId'] == '0'
floats = dict(material['m_SavedProperties']['m_Floats'])
assert floats['_UseAlphaTex'] == 0 and floats['_StraightAlphaInput'] == 0
from PIL import Image
folder = C/'vina-source/golden-vows/front'
for name, file in record['files'].items():
    raw = (folder/name).read_bytes()
    assert len(raw) == file['bytes'] and hashlib.sha256(raw).hexdigest() == file['sha256']
assert Image.open(folder/'token_10040_siege2_vlion.png').tobytes() == by[int(refs['rgbTexturePathId'])].read().image.convert('RGBA').tobytes()
assert E['tables']['tokens']['token_10040_siege2_vlion'] == ct['token_10040_siege2_vlion']
print(f'Verified {count} native components, {len(bundles)} bundles, {len(E["templates"])} templates, 30 ranks and both original skeleton chains')
