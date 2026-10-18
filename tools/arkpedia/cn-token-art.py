#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce recipe-bound original CN token art; never approve combat/public use."""
from pathlib import Path
import argparse,base64,hashlib,io,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image
from extract import normalize_atlas
parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['bind','verify']);parser.add_argument('--recipe',required=True);parser.add_argument('--metadata');parser.add_argument('--assets',action='store_true');parser.add_argument('--extracted-root');args=parser.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
def ptr(v):
 assert v['m_FileID']==0 and int(v['m_PathID'])!=0
 return int(v['m_PathID'])
def exact(v):
 if isinstance(v,dict):return {k:str(x)if k=='m_PathID'else exact(x)for k,x in v.items()}
 if isinstance(v,list):return [exact(x)for x in v]
 return v
def payload(o):
 s=o.read().m_Script
 return s.encode('utf8','surrogateescape')if isinstance(s,str)else bytes(s)
def clips(v):
 if isinstance(v,str):return[v]
 if isinstance(v,dict):return[c for k,x in v.items()if k!='via'for c in clips(x)]
 return[]
def atomic(p,b):
 p.parent.mkdir(parents=True,exist_ok=True);temp=p.with_name(p.name+f'.{os.getpid()}.tmp')
 try:temp.write_bytes(b);temp.replace(p)
 finally:temp.unlink(missing_ok=True)
recipe_raw=Path(args.recipe).read_bytes();recipe=json.loads(recipe_raw);owner,token=recipe['operator'],recipe['model']
import re
assert re.fullmatch(r'char_\d+_[a-z0-9]+',owner)and re.fullmatch(r'token_\d+_[a-z0-9_]+',token)
foundation=ROOT/f'data/arkpedia-native-operators/{owner}.json';raw=foundation.read_bytes();assert sha(raw)==recipe['foundationSha256'];e=json.loads(raw)
assert e['operatorId']==owner and e['enabledOperators']==[]and owner in e['heldOperators']and token in e['tokens']
inv_raw=(ROOT/'data/arkpedia-cn-native-source.json').read_bytes();assert sha(inv_raw)==e['source']['nativeInventorySha256'];inv=json.loads(inv_raw)
hot_raw=(ROOT/'.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes();assert len(hot_raw)==inv['source']['manifestBytes']and sha(hot_raw)==inv['source']['manifestSha256'];hot=json.loads(hot_raw)
assert hot['versionId']==e['source']['nativeClient'];binding=e['tokenSources'][token];bundle=next(v for v in e['source']['bundles']if v['path']==recipe['bundle'])
assert binding['bundle']==bundle['path'];assert bundle==next(v for v in inv['bundles']if v['path']==bundle['path'])
entry=next(v for v in hot['abInfos']if v['name']==bundle['path']);raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/bundle['path']).read_bytes()
assert len(raw)==bundle['bytes']==entry['abSize']and hashlib.md5(raw).hexdigest()==bundle['md5']==entry['md5']and sha(raw)==bundle['sha256']
objects={o.path_id:o for o in UnityPy.load(raw).objects};container=f'dyn/battle/prefabs/[uc]tokens/{token}.prefab';assert binding['container']==container
roots=[ptr(fields['asset'])for o in objects.values()if o.type.name=='AssetBundle'for name,fields in o.read_typetree()['m_Container']if name==container];assert len(roots)==1
root=objects[roots[0]].read_typetree();assert root['m_Name']==token and str(roots[0])==binding['rootPathId']
cs=[(ptr(c['component']),objects[ptr(c['component'])])for c in root['m_Component']];cs=[(pid,o.read_typetree())for pid,o in cs if o.type.name=='MonoBehaviour'];cs=[(pid,d)for pid,d in cs if '_animator'in d];assert len(cs)==1
controller_id,controller=cs[0];animator_id=ptr(controller['_animator']);assert str(animator_id)==binding['animatorPathId'];animator=objects[animator_id].read_typetree()
assert exact(animator)==e['tokenArtworkControllers'][token][0]['data'];switcher_id=ptr(animator['_faceSwitcher']);switcher=exact(objects[switcher_id].read_typetree())
assert [{k:m[k]for k in ['sourceAnimName','targetAnimName','mixAnimName']}for m in animator['_mixSettings']]==recipe['nativeMixes']
native_faces=set(e['officialSkeletonBindings'][token]);single=native_faces=={'Single'}
assert set(recipe['roles'])==native_faces
assert native_faces=={'Front','Back'}or(single and recipe.get('nativeFacing')=='Single')
assert recipe.get('nativeFacing')==('Single'if single else None)
node=os.environ.get('ARKPEDIA_SOURCE_NODE','node');files={};facings={}
for face,n in e['officialSkeletonBindings'][token].items():
 ids={'rootPathId':roots[0],'controllerPathId':controller_id,'animatorPathId':animator_id,'faceSwitcherPathId':switcher_id,'skeletonAnimationPathId':ptr(animator['_skeleton']if single else animator['_'+face.lower()]['skeleton'])}
 skeleton=objects[ids['skeletonAnimationPathId']].read_typetree();assert skeleton['initialSkinName']=='default'and skeleton['pmaVertexColors']==1
 ids['skeletonDataAssetPathId']=ptr(skeleton['skeletonDataAsset']);data=objects[ids['skeletonDataAssetPathId']].read_typetree();ids['textAssetPathId']=ptr(data['skeletonJSON']);assert len(data['atlasAssets'])==1
 ids['atlasAssetPathId']=ptr(data['atlasAssets'][0]);atlas=objects[ids['atlasAssetPathId']].read_typetree();ids['atlasTextAssetPathId']=ptr(atlas['atlasFile']);assert len(atlas['materials'])==1
 for k,v in n.items():
  if k.endswith('PathId'):assert str(ids[k])==v
 ids['materialPathId']=ptr(atlas['materials'][0]);props=objects[ids['materialPathId']].read_typetree()['m_SavedProperties'];floats,tex=dict(props['m_Floats']),dict(props['m_TexEnvs'])
 assert floats['_StraightAlphaInput']==0 and floats['_UseAlphaTex']==0 and ptr(tex['_MainTex']['m_Texture'])!=0
 ids['texturePathId']=ptr(tex['_MainTex']['m_Texture']);image=objects[ids['texturePathId']].read().image.convert('RGBA');pixels=image.tobytes();encoded=io.BytesIO();image.save(encoded,format='PNG')
 skel,atlas_raw=payload(objects[ids['textAssetPathId']]),payload(objects[ids['atlasTextAssetPathId']]);assert len(skel)==n['bytes']and sha(skel)==n['sha256']and len(atlas_raw)==n['atlasBytes']and sha(atlas_raw)==n['atlasSha256']
 sn,an=[objects[ids[k]].read().m_Name for k in ['textAssetPathId','atlasTextAssetPathId']];page=next(v.strip()for v in atlas_raw.decode().splitlines()if v.strip())
 assert sn.endswith('.skel')and an.endswith('.atlas')and page.endswith('.png')and all(Path(v).name==v for v in [sn,an,page])
 normalized=normalize_atlas(atlas_raw.decode(),{page:image.size});assert normalized.count('pma: true')==1
 contents={sn:skel,an:normalized.encode(),page:encoded.getvalue()}
 # Parse raw, newly recovered inputs rather than trusting export metadata.
 parsed=json.loads(subprocess.check_output([node,'--input-type=module','-e',"import{readFileSync}from'node:fs';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';const v=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify(parseSkel(Buffer.from(v.skel,'base64'),atlasInfo(v.atlas).regions,{includeEventPayloads:true})));"],input=json.dumps({'skel':base64.b64encode(skel).decode(),'atlas':normalized}).encode(),cwd=ROOT))
 assert parsed['missingRegions']==[]
 for k in ['durations','hits','eventPayloads']:assert parsed[k]==e['models'][token][face][k]
 empty=recipe.get('emptyClips',{}).get(face,[]);assert len(set(empty))==len(empty)and all(parsed['durations'].get(k)==0 and not parsed['eventPayloads'].get(k)for k in empty)
 roles=recipe['roles'][face];assert all(v in parsed['durations']for v in clips(roles));missing=[a['animName']for a in animator['_animations']if a['animName']not in parsed['durations']]
 assert missing==recipe['missingOptionalAliases'][face]and all(a['ignoreMissing']==1 for a in animator['_animations']if a['animName']in missing)
 directory=f'{token}/{face.lower()}';files.update({f'{directory}/{name}':b for name,b in contents.items()})
 facings[face.lower()]={'directory':directory,'files':{name:{'bytes':len(b),'sha256':sha(b)}for name,b in contents.items()},'originalPathIds':{k:str(v)for k,v in ids.items()},'textureDimensions':list(image.size),'emptyClips':empty,'decodedPixelSha256':sha(pixels),'materialFloats':floats,'nativeFaceSwitcher':switcher,'nativeAnimationBindings':exact(animator['_animations']),'nativeAnimationAliases':{a['animKey']:a['animName']for a in animator['_animations']},'missingOptionalAliases':missing,'missingRequiredAliases':[],'spineVersion':parsed['version'],**{k:parsed[k]for k in ['durations','hits','eventPayloads','bounds']},'animationRoles':roles}
 print('Recovered',token,face,'original pointers, skeleton, regions, exact decoded pixels and PMA',flush=True)
source={**{k:bundle[k]for k in ['path','bytes','md5','sha256','url']},'client':'cn','resourceVersion':hot['versionId'],'transforms':['Original embedded premultiplied RGBA texture decoded with every decoded pixel unchanged','Atlas page dimensions normalized and pma: true recorded; native regions unchanged','One native Single skeleton retained; front/back manifest slots are explicit compatibility aliases, not distinct original facings'if single else'Distinct original Front/Back skeletons and zero-duration clips retained; no missing clip invented']}
record={**facings['single'],'nativeFacing':'Single'}if single else{'facings':facings}
expected={'schemaVersion':1,'owner':owner,'artworkOnly':True,'enabledOperators':[],'frameParity':False,'moduleSupport':False,'nativeParticleSupport':False,'nativeShaderParity':False,'foundation':{'path':str(foundation.relative_to(ROOT)),'sha256':recipe['foundationSha256']},'recipeSha256':sha(recipe_raw),'scope':recipe['scope'],'sourceBundle':source,'models':{token:record}}
output=ROOT/recipe['output'];assert output.resolve().is_relative_to(ROOT/'data');out=Path(args.extracted_root)if args.extracted_root else ROOT/'.cache/arkpedia/cn-operators'/owner/'token-art'
if args.mode=='bind':
 for name,b in files.items():atomic(out/name,b)
 atomic(output,(json.dumps(expected,ensure_ascii=False,indent=2)+'\n').encode())
else:
 assert json.loads((Path(args.metadata)if args.metadata else output).read_bytes())==expected
 for name,b in files.items():assert (out/name).read_bytes()==b
 if args.assets:
  assets=ROOT.parent/'arkpedia-sd-assets';manifest=json.loads((assets/'manifest.json').read_bytes());assert json.loads((assets/recipe['sdReview']).read_bytes())==expected
  delivered=[(face,facings['single'])for face in ['front','back']]if single else list(facings.items())
  for face,r in delivered:
   key=f'operator/{token}/default/{face}';d=manifest['models'][key];expected_source={'key':'cn-client','kind':'assetbundle','bundle':source,'directory':source['path'],'extractedSkeleton':next(v for v in r['files']if v.endswith('.skel')),'originalPathIds':r['originalPathIds'],'transforms':source['transforms']}
   if single:expected_source['facingAlias']='single-original-model'
   assert d['source']==expected_source
   for k,v in {'spineVersion':r['spineVersion'],'premultipliedAlpha':True,'animations':r['durations'],'animationRoles':r['animationRoles'],'hits':r['hits'],'bounds':r['bounds']}.items():assert d[k]==v
   for f in [d['skeleton'],d['atlas'],*d['textures']]:
    name=Path(f['path']).name;b=files[r['directory']+'/'+name];assert (assets/f['path']).read_bytes()==b and f['bytes']==len(b)and f['sha256']==sha(b)
print('Verified original token delivery; combat, summon runtime and game-frame/pixel parity remain separate')
