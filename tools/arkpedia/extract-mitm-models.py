#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract the original Cherry-3 skeleton chain and pinned avatars."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4
import UnityPy
from extract import normalize_atlas
C=ROOT/'.cache/arkpedia';OUT=C/'mitm-source/device-art'
VERSION='26-09-23-17-49-43_b9cc4a';BUNDLE='pkgrps/btl_pfb_tokens_0.ab'
COMMIT='d0b5af0b004b044d322397ce5ae79632b6d9fcdd'
SOURCE=ROOT/'data/arkpedia-mitm-prefabs.json'
SHA='a88e78b5f356eeec2f181018f666680f12ae0c9aa240067d13f6c5747bbb3783'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def pointer(p):
 assert p['m_FileID']==0 and p['m_PathID']!=0,'Unresolved original dependency'
 return p['m_PathID']
def script(o):
 s=o.read().m_Script
 return s.encode('utf8','surrogateescape') if isinstance(s,str) else bytes(s)
assert sha(SOURCE.read_bytes())==SHA
foundation=json.loads(SOURCE.read_text());hot=json.loads((C/'map-source/hot_update_list.json').read_text())
assert hot['versionId']==VERSION
info=next(r for r in hot['abInfos'] if r['name']==BUNDLE)
raw=(C/'map-source/ab'/BUNDLE).read_bytes()
assert len(raw)==info['abSize'] and hashlib.md5(raw).hexdigest()==info['md5']
by={o.path_id:o for o in UnityPy.load(raw).objects};models={}
for token in ['token_10037_mitm_trshrb']:
 binding=foundation['officialTokenSkeletonBindings'][token]
 common={k:int(binding[k]) for k in ['rootPathId','controllerPathId','animatorPathId','faceSwitcherPathId']}
 root=by[common['rootPathId']].read_typetree();assert root['m_Name']==token
 assert common['controllerPathId'] in [pointer(c['component']) for c in root['m_Component']]
 controller=by[common['controllerPathId']].read_typetree()
 assert pointer(controller['m_GameObject'])==common['rootPathId'] and pointer(controller['_animator'])==common['animatorPathId']
 animator=by[common['animatorPathId']].read_typetree();assert animator['_animations']==binding['animationAliases']
 assert pointer(animator['_faceSwitcher'])==common['faceSwitcherPathId']
 avatar=subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),'show',f'{COMMIT}:avatar/ASSISTANT/{token}.png'])
 faces={}
 for face,fb in binding['facings'].items():
  ids={**common,**{k:int(v) for k,v in fb.items() if k.endswith('PathId')}}
  sp=animator['_skeleton'] if face=='Single' else animator['_'+face.lower()]['skeleton']
  assert pointer(sp)==ids['skeletonAnimationPathId']
  skeleton=by[ids['skeletonAnimationPathId']].read_typetree()
  assert skeleton['initialSkinName']=='default' and skeleton['pmaVertexColors']==1
  assert pointer(skeleton['skeletonDataAsset'])==ids['skeletonDataAssetPathId']
  asset=by[ids['skeletonDataAssetPathId']].read_typetree()
  assert pointer(asset['skeletonJSON'])==ids['textAssetPathId'] and len(asset['atlasAssets'])==1
  assert pointer(asset['atlasAssets'][0])==ids['atlasAssetPathId']
  atlas=by[ids['atlasAssetPathId']].read_typetree()
  assert pointer(atlas['atlasFile'])==ids['atlasTextAssetPathId'] and len(atlas['materials'])==1
  ids['materialPathId']=pointer(atlas['materials'][0]);mat=by[ids['materialPathId']].read_typetree()
  textures=dict(mat['m_SavedProperties']['m_TexEnvs']);floats=dict(mat['m_SavedProperties']['m_Floats'])
  assert floats['_UseAlphaTex']==0 and floats['_StraightAlphaInput']==0
  assert textures['_AlphaTex']['m_Texture']=={'m_FileID':0,'m_PathID':0}
  ids['rgbTexturePathId']=pointer(textures['_MainTex']['m_Texture']);ids['alphaTexturePathId']=0
  image=by[ids['rgbTexturePathId']].read().image
  assert image.mode=='RGBA' and image.size==(276,276)
  skel=script(by[ids['textAssetPathId']]);ab=script(by[ids['atlasTextAssetPathId']])
  assert sha(skel)==fb['sha256'] and len(skel)==fb['byteLength']
  assert sha(ab)==fb['atlasSha256'] and len(ab)==fb['atlasByteLength']
  sn=by[ids['textAssetPathId']].read().m_Name;an=by[ids['atlasTextAssetPathId']].read().m_Name
  page=next(l.strip() for l in ab.decode().replace('\r','').splitlines() if l.strip())
  assert sn.endswith('.skel') and an.endswith('.atlas') and page.endswith('.png')
  assert all(Path(p).name==p for p in [sn,an,page])
  d=OUT/token/face.lower();d.mkdir(parents=True,exist_ok=True)
  (d/sn).write_bytes(skel);(d/an).write_text(normalize_atlas(ab.decode(),{page:image.size}));image.save(d/page);(d/'avatar.png').write_bytes(avatar)
  files={name:{'bytes':(d/name).stat().st_size,'sha256':sha((d/name).read_bytes())} for name in [sn,an,page,'avatar.png']}
  parsed=json.loads(subprocess.check_output(['node','--input-type=module','-e',
   "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel(await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,{includeEventPayloads:true})));",str(d/sn),str(d/an)],cwd=ROOT))
  assert parsed['missingRegions']==[] and parsed['version']=='3.8.99'
  for key in ['durations','hits','eventPayloads']:assert parsed[key]==foundation['tokenModels'][token][face][key]
  aliases={a['animKey']:a['animName'] for a in animator['_animations']}
  assert all(name in parsed['durations'] or a['ignoreMissing'] for a in animator['_animations'] for name in [a['animName']])
  faces[face.lower()]={'directory':f'{token}/{face.lower()}','files':files,'textureDimensions':list(image.size),
   'originalPathIds':{k:str(v) for k,v in ids.items()},'nativeAnimationBindings':animator['_animations'],'nativeAnimationAliases':aliases,'materialFloats':floats,
   'spineVersion':parsed['version'],**{k:parsed[k] for k in ['durations','hits','eventPayloads','bounds']},
   'animationRoles':{'idle':aliases['Idle'],'deploy':aliases['ReBorn'],'die':aliases['Die'],'attack':aliases.get('Attack'),'skill':aliases['Skill_Loop']}}
  print(token,face,image.size,sn,an,page,flush=True)
 models[token]=faces['single'] if 'single' in faces else {'facings':faces}
metadata={'sourceBundle':{'path':BUNDLE,'bytes':len(raw),'md5':info['md5'],'sha256':sha(raw),'resourceVersion':VERSION,
 'url':f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat',
 'transforms':['Original embedded-alpha RGBA page decoded to PNG without pixel changes; no split alpha texture',
 'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
 'Cherry-3 front/back aliases share its native single skeleton; literal static Waste and Idle_2 clips retained']},
 'avatarSource':{'repository':'fexli/ArknightsResource','commit':COMMIT,'directory':'avatar/ASSISTANT'},
 'foundation':{'path':'data/arkpedia-mitm-prefabs.json','sha256':SHA},'models':models}
(OUT/'sources.json').write_text(json.dumps(metadata,indent=2)+'\n')
print('Extracted original Cherry-3 chain',flush=True)

(ROOT/'data/arkpedia-mitm-device-art.json').write_text(json.dumps({'schemaVersion':1,'owner':'char_4147_mitm','artworkOnly':True,'enabledOperators':[],'frameParity':False,'nativeParticleSupport':False,'nativeShaderParity':False,**metadata},indent=2)+'\n')
