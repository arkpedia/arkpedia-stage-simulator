#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify original Medic atlas/texture/avatar bytes and every native facing pointer."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4
import UnityPy
from PIL import Image
from extract import merge_alpha,normalize_atlas
C=ROOT/'.cache/arkpedia'; OUT=C/'amiya-medic-source/art'; ID='char_1037_amiya3'
E=json.loads((ROOT/'data/arkpedia-amiya-medic-prefabs.json').read_text())
M=json.loads((Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'sources.json').read_text())
record=next(r for r in E['source']['bundles'] if r['path']=='chararts/'+ID+'.ab')
raw=(C/'amiya-medic-source/char_1037_amiya3-chararts.ab').read_bytes()
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
skin_bytes=(C/'amiya-medic-source/skin_table.json').read_bytes()
assert len(skin_bytes)==2815110 and hashlib.sha1(f'blob {len(skin_bytes)}\0'.encode()+skin_bytes).hexdigest()=='0317e4b9816b64a76084592891c8bf9c63b6fab6'
st=json.loads(skin_bytes); skin_id=st['buildinPatchMap']['char_002_amiya'][ID]; skin=st['charSkins'][skin_id]
assert skin_id==ID+'#2' and skin['tmplId']==ID and skin['charId']=='char_002_amiya' and not skin['isBuySkin']
assert skin['battleSkin']=={'overwritePrefab':False,'skinOrPrefabId':'DefaultSkin'}
assert M['avatarSource']=={'repository':'fexli/ArknightsResource','commit':E['source']['modelCommit'],'directory':'avatar/ASSISTANT',
 'file':skin['avatarId']+'.png','formSkin':{'skinId':skin_id,'formId':ID,'characterId':skin['charId']},
 'skinTable':{'path':'en_US/gamedata/excel/skin_table.json','sha':'0317e4b9816b64a76084592891c8bf9c63b6fab6','size':2815110,
  'repository':'Kengxxiao/ArknightsGameData_YoStar','commit':E['source']['commit']}}
avatar=subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),'show',E['source']['modelCommit']+':avatar/ASSISTANT/'+skin['avatarId']+'.png'])
for face,r in M['models'][ID]['facings'].items():
 binding=E['officialSkeletonBindings'][ID][face.title()]
 animator_id=int(binding['animatorPathId']); animator=by[animator_id].read_typetree()
 sid=ptr(animator['_'+face]['skeleton']); skeleton=by[sid].read_typetree()
 aid=ptr(skeleton['skeletonDataAsset']); asset=by[aid].read_typetree()
 tid=ptr(asset['skeletonJSON']); atlasid=ptr(asset['atlasAssets'][0]); atlas=by[atlasid].read_typetree()
 atid=ptr(atlas['atlasFile']); mid=ptr(atlas['materials'][0]); material=by[mid].read_typetree()
 tex=dict(material['m_SavedProperties']['m_TexEnvs']); rgb=ptr(tex['_MainTex']['m_Texture']); alpha=tex['_AlphaTex']['m_Texture']['m_PathID']
 assert alpha==0 and dict(material['m_SavedProperties']['m_Floats'])['_UseAlphaTex']==0
 assert dict(material['m_SavedProperties']['m_Floats'])['_StraightAlphaInput']==0
 expected={'animatorPathId':animator_id,'skeletonAnimationPathId':sid,'skeletonDataAssetPathId':aid,
  'textAssetPathId':tid,'atlasAssetPathId':atlasid,'atlasTextAssetPathId':atid,'materialPathId':mid,
  'rgbTexturePathId':rgb,'alphaTexturePathId':alpha,'faceSwitcherPathId':ptr(animator['_faceSwitcher'])}
 assert r['originalPathIds']=={k:str(v) for k,v in expected.items()}
 assert r['directory']==face
 d=OUT/face
 assert (d/(ID+'.skel')).read_bytes()==script(by[tid])
 image=by[rgb].read().image.convert('RGBA')
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
  'attack':'Attack','skills':['Skill_1_Attack','Skill_2_Attack']}
print('Verified Medic Front/Back native pointers, original skeletons, normalized atlases, original RGBA pixels, avatar and parsed event metadata')
