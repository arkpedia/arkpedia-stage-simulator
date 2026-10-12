#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent pointer, original pixel, atlas, animation and metadata verification."""
import hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4
import UnityPy
from PIL import Image
C=ROOT/'.cache/arkpedia';OUT=C/'muelsyse-source/device-art'
p=Path(sys.argv[sys.argv.index('--metadata')+1]) if '--metadata' in sys.argv else OUT/'sources.json'
m=json.loads(p.read_text());SHA='61b12822227e45497f9e68aba5d0d929a7211fe8b535d0e0b177cc69c6527549'
rawfoundation=(ROOT/'data/arkpedia-muelsyse-prefabs.json').read_bytes();assert hashlib.sha256(rawfoundation).hexdigest()==SHA
foundation=json.loads(rawfoundation)
assert m['foundation']=={'path':'data/arkpedia-muelsyse-prefabs.json','sha256':SHA}
assert set(m['models'])=={'token_10030_mlyss_wtrman'}
assert m['sourceBundle']['path']=='pkgrps/btl_pfb_tokens_0.ab'
assert m['sourceBundle']['resourceVersion']=='26-09-23-17-49-43_b9cc4a'
assert m['sourceBundle']['url']=='https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/26-09-23-17-49-43_b9cc4a/pkgrps_btl_pfb_tokens_0.dat'
assert m['sourceBundle']['transforms']==[
 'Original premultiplied RGB and separate grayscale alpha pages merged; RGB clamped to alpha to remove block-compression bleed',
 'Atlas page dimensions normalized and pma: true recorded; native regions unchanged',
 'Flowing Shape front/back aliases share one original skeleton; default, melee, ranged and literal zero-duration Idle_2 clips retained']
assert m['avatarSource']=={'repository':'fexli/ArknightsResource','commit':'d0b5af0b004b044d322397ce5ae79632b6d9fcdd','directory':'avatar/ASSISTANT'}
hot=json.loads((C/'map-source/hot_update_list.json').read_text());assert hot['versionId']==m['sourceBundle']['resourceVersion']
original=next(r for r in hot['abInfos'] if r['name']==m['sourceBundle']['path']);raw=(C/'map-source/ab'/original['name']).read_bytes()
assert len(raw)==original['abSize']==m['sourceBundle']['bytes']
assert hashlib.md5(raw).hexdigest()==original['md5']==m['sourceBundle']['md5']
assert hashlib.sha256(raw).hexdigest()==m['sourceBundle']['sha256']
by={o.path_id:o for o in UnityPy.load(raw).objects}
def ptr(p):
 assert p['m_FileID']==0 and p['m_PathID']!=0
 return p['m_PathID']
def text(i):
 s=by[i].read().m_Script
 return s.encode('utf8','surrogateescape') if isinstance(s,str) else bytes(s)
def exact(value):
 if isinstance(value,dict):return {k:str(v) if k=='m_PathID' else exact(v) for k,v in value.items()}
 if isinstance(value,list):return [exact(v) for v in value]
 return value
for token in ['token_10030_mlyss_wtrman']:
 binding=foundation['officialTokenSkeletonBindings'][token]
 records=m['models'][token].get('facings')
 assert records is None;records={'single':m['models'][token]}
 common={k:int(binding[k]) for k in ['rootPathId','controllerPathId','animatorPathId','faceSwitcherPathId']}
 root=by[common['rootPathId']].read_typetree();assert root['m_Name']==token
 assert {'m_FileID':0,'m_PathID':common['controllerPathId']} in [c['component'] for c in root['m_Component']]
 controller=by[common['controllerPathId']].read_typetree();assert ptr(controller['m_GameObject'])==common['rootPathId']
 assert ptr(controller['_animator'])==common['animatorPathId']
 animator=by[common['animatorPathId']].read_typetree();assert ptr(animator['_faceSwitcher'])==common['faceSwitcherPathId']
 assert exact(by[common['faceSwitcherPathId']].read_typetree())==binding['faceSwitcher']
 assert animator['_animations']==binding['animationAliases']
 for face,r in records.items():
  assert r['directory']==f'{token}/{face}'
  d=p.parent/r['directory'];fb=binding['facings'][face.title()]
  ids={**common,**{k:int(v) for k,v in fb.items() if k.endswith('PathId')}}
  ref=animator['_skeleton'] if face=='single' else animator['_'+face]['skeleton']
  assert ptr(ref)==ids['skeletonAnimationPathId']
  skel=by[ids['skeletonAnimationPathId']].read_typetree();assert skel['initialSkinName']=='default' and skel['pmaVertexColors']==1
  assert ptr(skel['skeletonDataAsset'])==ids['skeletonDataAssetPathId']
  asset=by[ids['skeletonDataAssetPathId']].read_typetree()
  assert ptr(asset['skeletonJSON'])==ids['textAssetPathId'] and len(asset['atlasAssets'])==1 and ptr(asset['atlasAssets'][0])==ids['atlasAssetPathId']
  atlas=by[ids['atlasAssetPathId']].read_typetree();assert len(atlas['materials'])==1 and ptr(atlas['atlasFile'])==ids['atlasTextAssetPathId']
  ids['materialPathId']=ptr(atlas['materials'][0]);props=by[ids['materialPathId']].read_typetree()['m_SavedProperties']
  textures=dict(props['m_TexEnvs']);floats=dict(props['m_Floats']);assert floats['_UseAlphaTex']==1 and floats['_StraightAlphaInput']==0 and floats==r['materialFloats']
  ids['rgbTexturePathId']=ptr(textures['_MainTex']['m_Texture']);ids['alphaTexturePathId']=ptr(textures['_AlphaTex']['m_Texture'])
  assert r['originalPathIds']=={k:str(v) for k,v in ids.items()}
  sn=by[ids['textAssetPathId']].read().m_Name;an=by[ids['atlasTextAssetPathId']].read().m_Name
  assert hashlib.sha256(text(ids['textAssetPathId'])).hexdigest()==fb['sha256'] and len(text(ids['textAssetPathId']))==fb['byteLength']
  ab=text(ids['atlasTextAssetPathId']);assert hashlib.sha256(ab).hexdigest()==fb['atlasSha256'] and len(ab)==fb['atlasByteLength']
  assert (d/sn).read_bytes()==text(ids['textAssetPathId'])
  lines=ab.decode().replace('\r\n','\n').replace('\r','\n').lstrip('\ufeff').split('\n');start=next(i for i,l in enumerate(lines) if l)
  page=lines[start];assert page.endswith('.png')
  rgb=by[ids['rgbTexturePathId']].read().image.convert('RGB');alpha=by[ids['alphaTexturePathId']].read().image.convert('L');png=Image.open(d/page)
  size=512
  assert rgb.size==alpha.size==png.size==(size,size) and r['textureDimensions']==[size,size]
  assert png.mode=='RGBA'
  # Independent per-byte check, without importing the extractor's merge helper.
  for actual,channels,a in zip(png.getdata(),rgb.getdata(),alpha.getdata()):
   assert actual==(*[min(ch,a) for ch in channels],a)
  i=start+1
  while i<len(lines) and lines[i] and ':' in lines[i] and not lines[i][0].isspace():i+=1
  fields=[f'size: {size},{size}' if l.startswith('size:') else l for l in lines[start+1:i]]
  if not any(l.startswith('size:') for l in fields):fields.insert(0,f'size: {size},{size}')
  if not any(l.startswith('pma:') for l in fields):fields.append('pma: true')
  assert (d/an).read_text()=='\n'.join([*lines[:start+1],*fields,*lines[i:]])
  avatar=subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),'show',f"{m['avatarSource']['commit']}:avatar/ASSISTANT/{token}.png"])
  assert avatar==(d/'avatar.png').read_bytes()
  assert set(r['files'])=={sn,an,page,'avatar.png'}
  for name,h in r['files'].items():
   file=(d/name).read_bytes();assert len(file)==h['bytes'] and hashlib.sha256(file).hexdigest()==h['sha256']
  parsed=json.loads(subprocess.check_output(['node','--input-type=module','-e',
   "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel(await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,{includeEventPayloads:true})));",str(d/sn),str(d/an)],cwd=ROOT))
  assert parsed['missingRegions']==[] and parsed['version']==r['spineVersion']=='3.8.99'
  for k in ['durations','hits','eventPayloads','bounds']:assert parsed[k]==r[k]
  for k in ['durations','hits','eventPayloads']:assert parsed[k]==foundation['tokenModels'][token][face.title()][k]
  aliases={a['animKey']:a['animName'] for a in animator['_animations']}
  assert aliases==r['nativeAnimationAliases'] and animator['_animations']==r['nativeAnimationBindings']
  assert r['animationRoles']=={'idle':'Idle_1','deploy':'Start','die':'Die','attack':'Attack','skill':None}
  if '--delivered' in sys.argv:
   assets=ROOT.parent/'arkpedia-sd-assets';manifest=json.loads((assets/'manifest.json').read_text())
   for delivered_face in ['front','back'] if face=='single' else [face]:
    a=manifest['models'][f'operator/{token}/default/{delivered_face}']
    assert a['source']['bundle']==m['sourceBundle'] and a['source']['originalPathIds']==r['originalPathIds']
    assert a['source'].get('facingAlias')==('single-original-model' if face=='single' else None)
    assert a['premultipliedAlpha'] is True and a['spineVersion']==r['spineVersion']
    assert a['animations']==r['durations'] and a['animationRoles']==r['animationRoles']
    assert a['hits']==r['hits'] and a['bounds']==r['bounds'] and a['avatar']['source']==m['avatarSource']
    for file in [a['skeleton'],a['atlas'],*a['textures'],a['avatar']]:
     delivered=(assets/file['path']).read_bytes()
     assert delivered==(d/Path(file['path']).name).read_bytes()
     assert len(delivered)==file['bytes'] and hashlib.sha256(delivered).hexdigest()==file['sha256']
  print('Verified',token,face,'original pointers, pixels, regions, avatar, aliases and events',flush=True)
print('Verified original Flowing Shape chain',flush=True)

if '--metadata' not in sys.argv:
 receipt=json.loads((ROOT/'data/arkpedia-muelsyse-device-art.json').read_text())
 assert receipt=={'schemaVersion':1,'owner':'char_249_mlyss','artworkOnly':True,'enabledOperators':[],'frameParity':False,'nativeParticleSupport':False,'nativeShaderParity':False,**m}

if '--delivered' in sys.argv:
 # Muelsyse already has pinned Git assets. Verify the complete delivered owner
 # pages as well; an unmodified filename or animation label alone is insufficient.
 assets=ROOT.parent/'arkpedia-sd-assets';manifest=json.loads((assets/'manifest.json').read_text())
 checkout=assets/'.cache/arknights-resource';owner='char_249_mlyss'
 for face in ['Front','Back']:
  a=manifest['models'][f'operator/{owner}/default/{face.lower()}'];native=foundation['models'][owner][face]
  directory=f'spine/{owner}/{owner}/{face}'
  assert a['source']=={'key':'operators','repository':'fexli/ArknightsResource','commit':foundation['models'][owner]['commit'],'directory':directory}
  def blob(name):return subprocess.check_output(['git','-C',str(checkout),'show',f"{a['source']['commit']}:{directory}/{name}"])
  files=[a['skeleton'],a['atlas'],*a['textures']]
  for f in files:
   delivered=(assets/f['path']).read_bytes()
   assert len(delivered)==f['bytes'] and hashlib.sha256(delivered).hexdigest()==f['sha256']
   assert delivered==blob(Path(f['path']).name)
  assert a['skeleton']['sha256']==native['sha256'] and a['skeleton']['bytes']==native['bytes']
  parsed=json.loads(subprocess.check_output(['node','--input-type=module','-e',
   "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel(await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,{includeEventPayloads:true})));",str(assets/a['skeleton']['path']),str(assets/a['atlas']['path'])],cwd=ROOT))
  assert parsed['missingRegions']==[] and parsed['version']==a['spineVersion']=='3.8.99'
  for k in ['durations','hits','eventPayloads']:assert parsed[k]==native[k]
  assert a['animations']==native['durations'] and a['hits']==native['hits'] and a['bounds']==parsed['bounds']
  assert a['animationRoles']['die']==('Die' if face=='Front' else None)
  print('Verified existing Muelsyse',face,'pinned skeleton, complete texture, atlas regions and events',flush=True)
