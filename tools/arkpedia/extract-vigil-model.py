#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract the default Wolfpack's single original skeleton and RGB/alpha atlas.

The renderer's front/back records alias this one model. They do not claim two
native facing skeletons. Native pointers, material settings and file hashes
stay in the extraction metadata for independent verification.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from extract import merge_alpha, normalize_atlas

ID = 'token_10028_vigil_wolf'
C = ROOT / '.cache/arkpedia'
OUT = C / 'vigil-source/wolfpack-art'
BUNDLE = 'pkgrps/btl_pfb_tokens_0.ab'
VERSION = '26-09-23-17-49-43_b9cc4a'
COMMIT = 'd0b5af0b004b044d322397ce5ae79632b6d9fcdd'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
def script(obj):
    raw = obj.read().m_Script
    return raw.encode('utf8','surrogateescape') if isinstance(raw,str) else bytes(raw)
def pointer(p):
    assert p['m_FileID'] == 0 and p['m_PathID'] != 0
    return p['m_PathID']

hot = json.loads((C / 'map-source/hot_update_list.json').read_text())
assert hot['versionId'] == VERSION
info = next(r for r in hot['abInfos'] if r['name'] == BUNDLE)
raw = (C / 'map-source/ab' / BUNDLE).read_bytes()
assert len(raw) == info['abSize'] and hashlib.md5(raw).hexdigest() == info['md5']
by = {o.path_id:o for o in UnityPy.load(raw).objects}
root_id = -3264388375348295857
root = by[root_id].read_typetree()
animator_id = pointer(root['_animator']); animator = by[animator_id].read_typetree()
skeleton_id = pointer(animator['_skeleton']); skeleton = by[skeleton_id].read_typetree()
asset_id = pointer(skeleton['skeletonDataAsset']); asset = by[asset_id].read_typetree()
text_id = pointer(asset['skeletonJSON'])
assert len(asset['atlasAssets']) == 1
atlas_id = pointer(asset['atlasAssets'][0]); atlas = by[atlas_id].read_typetree()
atlas_text_id = pointer(atlas['atlasFile'])
assert len(atlas['materials']) == 1
material_id = pointer(atlas['materials'][0]); material = by[material_id].read_typetree()
textures = dict(material['m_SavedProperties']['m_TexEnvs'])
floats = dict(material['m_SavedProperties']['m_Floats'])
assert floats['_UseAlphaTex'] == 1 and floats['_StraightAlphaInput'] == 0
rgb_id = pointer(textures['_MainTex']['m_Texture'])
alpha_id = pointer(textures['_AlphaTex']['m_Texture'])
image = merge_alpha(by[rgb_id].read().image,by[alpha_id].read().image)
skel = script(by[text_id]); original_atlas = script(by[atlas_text_id])
assert by[text_id].read().m_Name == ID + '.skel'
assert by[atlas_text_id].read().m_Name == ID + '.atlas'
avatar = subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),
    'show',f'{COMMIT}:avatar/ASSISTANT/{ID}.png'])
directory = OUT / 'original'; directory.mkdir(parents=True,exist_ok=True)
(directory/(ID+'.skel')).write_bytes(skel)
(directory/(ID+'.atlas')).write_text(normalize_atlas(original_atlas.decode('utf8'),{ID+'.png':image.size}))
image.save(directory/(ID+'.png'))
(directory/'avatar.png').write_bytes(avatar)
ids = {'rootPathId':root_id,'animatorPathId':animator_id,'skeletonAnimationPathId':skeleton_id,
    'skeletonDataAssetPathId':asset_id,'textAssetPathId':text_id,'atlasAssetPathId':atlas_id,
    'atlasTextAssetPathId':atlas_text_id,'materialPathId':material_id,
    'rgbTexturePathId':rgb_id,'alphaTexturePathId':alpha_id,
    'faceSwitcherPathId':pointer(animator['_faceSwitcher'])}
files = {name:{'bytes':(directory/name).stat().st_size,'sha256':sha((directory/name).read_bytes())}
    for name in [ID+'.skel',ID+'.atlas',ID+'.png','avatar.png']}
metadata = {'sourceBundle':{'path':BUNDLE,'bytes':len(raw),'md5':info['md5'],'sha256':sha(raw),
    'resourceVersion':VERSION,'url':f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
    'transforms':['Original RGB plus separate alpha texture merge; material StraightAlphaInput 0',
      'Atlas texture dimensions normalized and pma: true recorded',
      'Renderer front/back aliases share one original native skeleton and FaceSwitcher']},
    'avatarSource':{'repository':'fexli/ArknightsResource','commit':COMMIT,'directory':'avatar/ASSISTANT'},
    'models':{ID:{'directory':'original','files':files,'textureDimensions':list(image.size),
      'originalPathIds':{k:str(v) for k,v in ids.items()}}}}
(OUT/'sources.json').write_text(json.dumps(metadata,indent=2)+'\n')
subprocess.check_call(['node','tools/arkpedia/inspect-vigil-model.mjs'],cwd=ROOT)
print('Extracted original single-skeleton Wolfpack with verified RGB/alpha and original avatar')
