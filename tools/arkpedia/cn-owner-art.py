#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Bind or verify an explicitly reviewed pair of original CN owner models.

Recipes choose literal roles, never infer combat admission or game parity. Verify
walks the native pointers afresh and compares the entire generated receipt.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image
parser=argparse.ArgumentParser()
parser.add_argument('mode',choices=['bind','verify'])
parser.add_argument('--recipe',required=True)
parser.add_argument('--metadata')
parser.add_argument('--hydrate',action='store_true')
parser.add_argument('--assets',action='store_true')
args=parser.parse_args()
assert not args.hydrate or args.mode=='bind'
sha=lambda b:hashlib.sha256(b).hexdigest()
def atomic(path,value):
 temp=path.with_name(path.name+f'.{os.getpid()}.tmp')
 try:temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
 finally:temp.unlink(missing_ok=True)
recipe_raw=Path(args.recipe).read_bytes();recipe=json.loads(recipe_raw)
ID=recipe['operator'];assert re.fullmatch(r'char_\d+_[a-z0-9]+',ID)
assert re.fullmatch(r'[a-f0-9]{40}',recipe['artCommit'])
assert set(recipe['roles'])=={'Front','Back'}
foundation=ROOT/f'data/arkpedia-native-operators/{ID}.json';raw=foundation.read_bytes()
assert sha(raw)==recipe['foundationSha256'];e=json.loads(raw)
assert e['operatorId']==ID and e['enabledOperators']==[] and ID in e['heldOperators']
inv_raw=(ROOT/'data/arkpedia-cn-native-source.json').read_bytes();assert sha(inv_raw)==e['source']['nativeInventorySha256']
inv=json.loads(inv_raw);hot_raw=(ROOT/'.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes()
assert len(hot_raw)==inv['source']['manifestBytes'] and sha(hot_raw)==inv['source']['manifestSha256']
bundle=next(v for v in e['source']['bundles'] if v['path']==f'chararts/{ID}.ab')
assert bundle==next(v for v in inv['bundles'] if v['path']==bundle['path'])
hot=next(v for v in json.loads(hot_raw)['abInfos'] if v['name']==bundle['path'])
raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/bundle['path']).read_bytes()
assert len(raw)==bundle['bytes']==hot['abSize'] and hashlib.md5(raw).hexdigest()==bundle['md5']==hot['md5'] and sha(raw)==bundle['sha256']
objects={v.path_id:v for v in UnityPy.load(raw).objects}
def ptr(v):
 assert v['m_FileID']==0 and int(v['m_PathID'])!=0
 return int(v['m_PathID'])
def text(o):
 s=o.read().m_Script
 return s.encode('utf8','surrogateescape') if isinstance(s,str) else bytes(s)
controller=objects[int(e['chararts'][ID][0]['pathId'])].read_typetree()
mixes=[{k:v[k] for k in ['sourceAnimName','targetAnimName','mixAnimName']} for v in controller['_mixSettings']]
assert mixes==recipe['nativeMixes']
assets=ROOT.parent/'arkpedia-sd-assets';manifest_path=assets/'manifest.json';manifest=json.loads(manifest_path.read_bytes())
rows={};node=os.environ.get('ARKPEDIA_SOURCE_NODE','node')
def clips(roles):
 if isinstance(roles,str):return [roles]
 if isinstance(roles,dict):return [v for k,x in roles.items() if k not in ['via'] for v in clips(x)]
 return []
for face in ['Front','Back']:
 n=e['officialSkeletonBindings'][ID][face];key=f'operator/{ID}/default/{face.lower()}';d=manifest['models'][key]
 # Independent original pointer traversal, not a claimed cached file identity.
 skeleton_id=ptr(controller['_'+face.lower()]['skeleton']);assert str(skeleton_id)==n['skeletonAnimationPathId']
 skeleton=objects[skeleton_id].read_typetree();data_id=ptr(skeleton['skeletonDataAsset']);assert str(data_id)==n['skeletonDataAssetPathId']
 data=objects[data_id].read_typetree();text_id=ptr(data['skeletonJSON']);assert str(text_id)==n['textAssetPathId'];assert len(data['atlasAssets'])==1
 atlas_id=ptr(data['atlasAssets'][0]);assert str(atlas_id)==n['atlasAssetPathId'];atlas=objects[atlas_id].read_typetree()
 atlas_text=ptr(atlas['atlasFile']);assert str(atlas_text)==n['atlasTextAssetPathId'];assert len(atlas['materials'])==1
 material_id=ptr(atlas['materials'][0]);props=objects[material_id].read_typetree()['m_SavedProperties'];floats=dict(props['m_Floats'])
 texture_id=ptr(dict(props['m_TexEnvs'])['_MainTex']['m_Texture']);assert floats['_StraightAlphaInput']==0 and floats['_UseAlphaTex']==0
 source={'key':'operators','repository':'fexli/ArknightsResource','commit':recipe['artCommit'],'directory':f'spine/{ID}/{ID}/{face}'}
 assert d['source']==source
 for f in [d['skeleton'],d['atlas'],*d['textures']]:
  original=subprocess.check_output(['git','-C',str(assets/'.cache/arknights-resource'),'show',f"{recipe['artCommit']}:{source['directory']}/{Path(f['path']).name}"])
  assert (assets/f['path']).read_bytes()==original and len(original)==f['bytes'] and sha(original)==f['sha256']
 assert (assets/d['skeleton']['path']).read_bytes()==text(objects[text_id])
 assert d['skeleton']['sha256']==n['sha256'] and d['skeleton']['bytes']==n['bytes']
 native_atlas=text(objects[atlas_text]).decode();assert (assets/d['atlas']['path']).read_text()=='\n'.join(v for v in native_atlas.lstrip('\n').split('\n') if not v.startswith('size:'))
 assert len(d['textures'])==1
 native=objects[texture_id].read().image.convert('RGBA');delivered=Image.open(assets/d['textures'][0]['path']).convert('RGBA')
 assert native.size==delivered.size and native.tobytes()==delivered.tobytes()
 p=json.loads(subprocess.check_output([node,'--input-type=module','-e',
  "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel(await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,{includeEventPayloads:true})));",
  str(assets/d['skeleton']['path']),str(assets/d['atlas']['path'])],cwd=ROOT))
 assert p['missingRegions']==[]
 for k in ['durations','hits','eventPayloads']:assert p[k]==e['models'][ID][face][k]
 roles=recipe['roles'][face];assert all(v in p['durations'] for v in clips(roles))
 metadata={'spineVersion':p['version'],'premultipliedAlpha':True,'animations':p['durations'],'hits':p['hits'],'bounds':p['bounds'],'animationRoles':roles}
 rows[face.lower()]={'modelKey':key,'source':source,'files':{k:d[k] for k in ['skeleton','atlas','textures']},'nativeBundle':bundle,
  'originalBindings':n,'materialPathId':str(material_id),'texturePathId':str(texture_id),'materialFloats':floats,
  'decodedPixelSha256':sha(native.tobytes()),'textureDimensions':list(native.size),'metadata':metadata}
 if args.mode=='verify' and args.assets:assert {k:d[k] for k in metadata}==metadata
 print('Verified',ID,face,'original pointers, bytes, pixels, PMA and literal roles',flush=True)
expected={'schemaVersion':1,'owner':ID,'artworkOnly':True,'enabledOperators':[],'frameParity':False,'nativeParticleSupport':False,'nativeShaderParity':False,
 'foundation':{'path':str(foundation.relative_to(ROOT)),'sha256':recipe['foundationSha256']},'recipeSha256':sha(recipe_raw),'scope':recipe['scope'],'ownerModels':rows}
output=ROOT/recipe['output'];output.relative_to(ROOT/'data')
if args.mode=='bind':
 atomic(output,expected)
 if args.hydrate:
  for row in rows.values():manifest['models'][row['modelKey']].update(row['metadata'])
  atomic(manifest_path,manifest)
else:
 assert json.loads((Path(args.metadata) if args.metadata else output).read_bytes())==expected
 if args.assets:assert json.loads((assets/recipe['sdReview']).read_bytes())==expected
print('Original owner artwork verified; combat/public admission and native shader/frame parity remain separate')
