#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently walk original Vetochki art pointers and verify delivery."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image
ID='char_4207_branch';PIN='9166668d00123dc82ad7a2116141ef55a3d3cc9328217d832ca40104508d1705'
COMMIT='d0b5af0b004b044d322397ce5ae79632b6d9fcdd'
NODE=os.environ.get('ARKPEDIA_SOURCE_NODE','node');assets=ROOT.parent/'arkpedia-sd-assets'
arg=lambda flag:Path(sys.argv[sys.argv.index(flag)+1]) if flag in sys.argv else None
sha=lambda b:hashlib.sha256(b).hexdigest()
def pointer(v):
 assert v['m_FileID']==0 and int(v['m_PathID'])!=0
 return int(v['m_PathID'])
def payload(o):
 s=o.read().m_Script
 return s.encode('utf8','surrogateescape') if isinstance(s,str) else bytes(s)
def parse(skel,atlas):
 return json.loads(subprocess.check_output([NODE,'--input-type=module','-e',
  "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel(await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,{includeEventPayloads:true})));",str(skel),str(atlas)],cwd=ROOT))
raw=(ROOT/f'data/arkpedia-native-operators/{ID}.json').read_bytes();assert sha(raw)==PIN
e=json.loads(raw)
m=json.loads((arg('--metadata') or ROOT/'data/arkpedia-branch-art.json').read_bytes())
assert set(m)=={'schemaVersion','owner','artworkOnly','enabledOperators','frameParity','nativeParticleSupport','nativeShaderParity','foundation','scope','ownerModels'}
assert m['schemaVersion']==1 and m['owner']==ID and m['artworkOnly'] is True and m['enabledOperators']==[]
for k in ['frameParity','nativeParticleSupport','nativeShaderParity']:assert m[k] is False
assert m['foundation']=={'path':f'data/arkpedia-native-operators/{ID}.json','sha256':PIN}
assert m['scope']=='Original owner files unchanged; native pixels and PMA input verified. S1 retains Attack; S2 uses literal Begin/Loop/Idle and the two explicit native End mixes. No gameplay/browser approval.'
assert set(m['ownerModels'])=={'front','back'}
bundle=next(b for b in e['source']['bundles'] if b['path']==f'chararts/{ID}.ab')
hot_raw=(ROOT/'.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes()
assert len(hot_raw)==3241788 and sha(hot_raw)=='d1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
original=next(b for b in json.loads(hot_raw)['abInfos'] if b['name']==bundle['path'])
raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/bundle['path']).read_bytes()
assert len(raw)==bundle['bytes']==original['abSize'] and hashlib.md5(raw).hexdigest()==bundle['md5']==original['md5'] and sha(raw)==bundle['sha256']
objects={v.path_id:v for v in UnityPy.load(raw).objects}
art=e['chararts'][ID][0];native_controller=objects[int(art['pathId'])].read_typetree()
assert [(v['sourceAnimName'],v['targetAnimName'],v['mixAnimName']) for v in native_controller['_mixSettings']]==[('Skill_2_Idle','Idle','Skill_2_End'),('Skill_2_Loop','Idle','Skill_2_End')]
manifest=json.loads((assets/'manifest.json').read_bytes()) if '--assets' in sys.argv else None
for face in ['Front','Back']:
 r=m['ownerModels'][face.lower()];n=e['officialSkeletonBindings'][ID][face]
 assert set(r)=={'modelKey','source','files','nativeBundle','originalBindings','materialPathId','texturePathId','materialFloats','decodedPixelSha256','textureDimensions','metadata'}
 assert r['nativeBundle']==bundle and r['originalBindings']==n
 key=f'operator/{ID}/default/{face.lower()}';assert r['modelKey']==key
 assert r['source']=={'key':'operators','repository':'fexli/ArknightsResource','commit':COMMIT,'directory':f'spine/{ID}/{ID}/{face}'}
 skel_id=pointer(native_controller['_'+face.lower()]['skeleton']);assert str(skel_id)==n['skeletonAnimationPathId']
 skeleton=objects[skel_id].read_typetree();data_id=pointer(skeleton['skeletonDataAsset']);assert str(data_id)==n['skeletonDataAssetPathId']
 data=objects[data_id].read_typetree();text_id=pointer(data['skeletonJSON']);assert str(text_id)==n['textAssetPathId']
 assert len(data['atlasAssets'])==1;atlas_id=pointer(data['atlasAssets'][0]);assert str(atlas_id)==n['atlasAssetPathId']
 atlas=objects[atlas_id].read_typetree();atlas_text=pointer(atlas['atlasFile']);assert str(atlas_text)==n['atlasTextAssetPathId']
 assert len(atlas['materials'])==1;mat_id=pointer(atlas['materials'][0])
 props=objects[mat_id].read_typetree()['m_SavedProperties'];floats=dict(props['m_Floats']);tex_id=pointer(dict(props['m_TexEnvs'])['_MainTex']['m_Texture'])
 assert r['materialPathId']==str(mat_id) and r['texturePathId']==str(tex_id) and r['materialFloats']==floats
 assert floats['_StraightAlphaInput']==0 and floats['_UseAlphaTex']==0
 assert set(r['files'])=={'skeleton','atlas','textures'} and len(r['files']['textures'])==1
 for f in [r['files']['skeleton'],r['files']['atlas'],*r['files']['textures']]:
  b=(assets/f['path']).read_bytes();pinned=subprocess.check_output(['git','-C',str(assets/'.cache/arknights-resource'),'show',f"{COMMIT}:{r['source']['directory']}/{Path(f['path']).name}"])
  assert b==pinned and len(b)==f['bytes'] and sha(b)==f['sha256']
 assert (assets/r['files']['skeleton']['path']).read_bytes()==payload(objects[text_id])
 native_atlas=payload(objects[atlas_text]).decode();assert (assets/r['files']['atlas']['path']).read_text()=='\n'.join(v for v in native_atlas.lstrip('\n').split('\n') if not v.startswith('size:'))
 native=objects[tex_id].read().image.convert('RGBA');delivered=Image.open(assets/r['files']['textures'][0]['path']).convert('RGBA')
 assert native.size==delivered.size and native.tobytes()==delivered.tobytes()
 assert r['textureDimensions']==list(native.size) and r['decodedPixelSha256']==sha(native.tobytes())
 p=parse(assets/r['files']['skeleton']['path'],assets/r['files']['atlas']['path']);assert p['missingRegions']==[]
 for k in ['durations','hits','eventPayloads']:assert p[k]==e['models'][ID][face][k]
 one={'begin':None,'loop':'Attack','end':None,'idle':None,'index':0,'via':'attack'}
 two={'begin':'Skill_2_Begin','loop':'Skill_2_Loop','end':'Skill_2_End','idle':'Skill_2_Idle','index':1,'via':'skill'}
 expected={'spineVersion':p['version'],'premultipliedAlpha':True,'animations':p['durations'],'hits':p['hits'],'bounds':p['bounds'],
  'animationRoles':{'idle':'Idle','deploy':'Start','attack':{'begin':None,'loop':'Attack','end':None},'attackDown':None,
   'skill':one,'skills':{'0':one,'1':two},'die':'Die' if face=='Front' else None,'stun':None,'move':None}}
 assert r['metadata']==expected
 if manifest:
  d=manifest['models'][key];assert d['source']==r['source'] and {k:d[k] for k in r['files']}==r['files']
  assert {k:d[k] for k in expected}==expected
 print('Verified',face,'native pointer chain, original files, pixels, PMA and selected literal roles',flush=True)
if manifest:assert json.loads((assets/'source-reviews/vetochki.json').read_bytes())==m
print('Verified original Vetochki art; combat, browser and native shader/frame parity remain separate')
