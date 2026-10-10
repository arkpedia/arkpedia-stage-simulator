#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify original Guard atlas/texture/avatar bytes and every native facing pointer."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4
import UnityPy
from PIL import Image
from extract import merge_alpha,normalize_atlas
C=ROOT/'.cache/arkpedia'; OUT=C/'amiya-guard-source/art'; ID='char_1001_amiya2'
E=json.loads((ROOT/'data/arkpedia-amiya-guard-prefabs.json').read_text())
M=json.loads((Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'sources.json').read_text())
record=next(r for r in E['source']['bundles'] if r['path']=='chararts/'+ID+'.ab')
raw=(C/'amiya-guard-source/char_1001_amiya2-chararts.ab').read_bytes()
assert hashlib.sha256(raw).hexdigest()==record['sha256']
assert (len(raw),hashlib.md5(raw).hexdigest())==(record['size'],record['md5'])
assert (M['sourceBundle']['bytes'],M['sourceBundle']['md5'],M['sourceBundle']['sha256'])==(len(raw),record['md5'],record['sha256'])
assert M['sourceBundle']['path']==record['path'] and M['sourceBundle']['resourceVersion']==E['source']['nativeClient']
by={o.path_id:o for o in UnityPy.load(raw).objects}
def script(o):
 v=o.read().m_Script
 return v.encode('utf8','surrogateescape') if isinstance(v,str) else bytes(v)
def ptr(v):
 assert v['m_FileID']==0 and v['m_PathID']!=0
 return v['m_PathID']
assert set(M['models'])=={ID} and set(M['models'][ID]['facings'])=={'front','back'}
assert M['avatarSource']=={'repository':'fexli/ArknightsResource','commit':E['source']['modelCommit'],'directory':'avatar/ASSISTANT'}
avatar=subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),'show',E['source']['modelCommit']+':avatar/ASSISTANT/'+ID+'.png'])
for face,r in M['models'][ID]['facings'].items():
 binding=E['officialSkeletonBindings'][ID][face.title()]
 animator_id=int(binding['animatorPathId']); animator=by[animator_id].read_typetree()
 sid=ptr(animator['_'+face]['skeleton']); skeleton=by[sid].read_typetree()
 aid=ptr(skeleton['skeletonDataAsset']); asset=by[aid].read_typetree()
 tid=ptr(asset['skeletonJSON']); atlasid=ptr(asset['atlasAssets'][0]); atlas=by[atlasid].read_typetree()
 atid=ptr(atlas['atlasFile']); mid=ptr(atlas['materials'][0]); material=by[mid].read_typetree()
 tex=dict(material['m_SavedProperties']['m_TexEnvs']); rgb=ptr(tex['_MainTex']['m_Texture']); alpha=ptr(tex['_AlphaTex']['m_Texture'])
 assert dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex']==1
 expected={'animatorPathId':animator_id,'skeletonAnimationPathId':sid,'skeletonDataAssetPathId':aid,
  'textAssetPathId':tid,'atlasAssetPathId':atlasid,'atlasTextAssetPathId':atid,'materialPathId':mid,
  'rgbTexturePathId':rgb,'alphaTexturePathId':alpha,'faceSwitcherPathId':ptr(animator['_faceSwitcher'])}
 assert r['originalPathIds']=={k:str(v) for k,v in expected.items()}
 assert r['directory']==face
 d=OUT/face
 assert (d/(ID+'.skel')).read_bytes()==script(by[tid])
 image=merge_alpha(by[rgb].read().image,by[alpha].read().image)
 assert Image.open(d/(ID+'.png')).convert('RGBA').tobytes()==image.convert('RGBA').tobytes()
 assert r['textureDimensions']==list(image.size)
 assert (d/(ID+'.atlas')).read_text()==normalize_atlas(script(by[atid]).decode(),{ID+'.png':image.size})
 assert (d/'avatar.png').read_bytes()==avatar
 assert set(r['files'])=={ID+'.skel',ID+'.atlas',ID+'.png','avatar.png'}
 for name,expected in r['files'].items():
  data=(d/name).read_bytes(); assert expected=={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 model=E['models'][ID][face.title()]
 for key in ['durations','hits','eventPayloads']: assert r[key]==model[key]
 assert r['spineVersion']=='3.8.99'
 assert r['animationRoles']=={'idle':'Idle','deploy':'Start',**({'die':'Die'} if 'Die' in model['durations'] else {}),
  'attack':'Attack','skills':['Skill_1','Skill_2']}
print('Verified Guard Front/Back native pointers, original skeletons, normalized atlases, merged RGBA pixels, avatar and parsed event metadata')
