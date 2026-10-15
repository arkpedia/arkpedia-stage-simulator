#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Bind Record Keeper's existing published files to original CN pixels/materials.

Metadata only: no pixel edits, gameplay admission or native shader-parity claim.
"""
from pathlib import Path
import hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from PIL import Image
ID='char_4196_reckpr'; PIN='f90d041979ffbb891c4083c5392ba44c15ab7a265fe63bc67db4957f1a0a6430'
COMMIT='d0b5af0b004b044d322397ce5ae79632b6d9fcdd'
NODE=os.environ.get('ARKPEDIA_SOURCE_NODE','node')
assets=ROOT.parent/'arkpedia-sd-assets'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def ptr(v):
 assert v['m_FileID']==0 and v['m_PathID']!=0
 return v['m_PathID']
def text(o):
 v=o.read().m_Script
 return v.encode('utf8','surrogateescape') if isinstance(v,str) else bytes(v)
def parse(skel,atlas):
 return json.loads(subprocess.check_output([NODE,'--input-type=module','-e',
  "import{readFile}from'node:fs/promises';import{parseSkel}from'./tools/assets/skel.mjs';import{atlasInfo}from'./tools/assets/atlas.mjs';console.log(JSON.stringify(parseSkel(await readFile(process.argv[1]),atlasInfo(await readFile(process.argv[2],'utf8')).regions,{includeEventPayloads:true})));",str(skel),str(atlas)],cwd=ROOT))
foundation=ROOT/f'data/arkpedia-native-operators/{ID}.json';raw=foundation.read_bytes();assert sha(raw)==PIN
e=json.loads(raw);assert e['enabledOperators']==[] and e['source']['nativeClient']=='26-09-22-07-47-20_6c71fa'
info=next(v for v in e['source']['bundles'] if v['path']==f'chararts/{ID}.ab')
raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/info['path']).read_bytes()
assert len(raw)==info['bytes'] and hashlib.md5(raw).hexdigest()==info['md5'] and sha(raw)==info['sha256']
objects={o.path_id:o for o in UnityPy.load(raw).objects}
manifest=json.loads((assets/'manifest.json').read_bytes());rows={}
for face in ['Front','Back']:
 key=f'operator/{ID}/default/{face.lower()}';d=manifest['models'][key]
 source={'key':'operators','repository':'fexli/ArknightsResource','commit':COMMIT,'directory':f'spine/{ID}/{ID}/{face}'}
 assert d['source']==source
 n=e['officialSkeletonBindings'][ID][face]
 assert d['skeleton']['sha256']==n['sha256']
 for f in [d['skeleton'],d['atlas'],*d['textures']]:
  original=subprocess.check_output(['git','-C',str(assets/'.cache/arknights-resource'),'show',f"{COMMIT}:{source['directory']}/{Path(f['path']).name}"])
  assert (assets/f['path']).read_bytes()==original and len(original)==f['bytes'] and sha(original)==f['sha256']
 p=parse(assets/d['skeleton']['path'],assets/d['atlas']['path']);assert p['missingRegions']==[]
 for k in ['durations','hits','eventPayloads']:assert p[k]==e['models'][ID][face][k]
 atlas=objects[int(n['atlasAssetPathId'])].read_typetree();assert len(atlas['materials'])==1
 material=ptr(atlas['materials'][0]);props=objects[material].read_typetree()['m_SavedProperties']
 floats,tex=dict(props['m_Floats']),dict(props['m_TexEnvs'])
 assert floats['_StraightAlphaInput']==0 and floats['_UseAlphaTex']==0
 texture=ptr(tex['_MainTex']['m_Texture']);image=objects[texture].read().image.convert('RGBA')
 assert len(d['textures'])==1
 delivered=Image.open(assets/d['textures'][0]['path']).convert('RGBA')
 assert image.size==delivered.size and image.tobytes()==delivered.tobytes()
 native_atlas=text(objects[int(n['atlasTextAssetPathId'])]).decode()
 assert (assets/d['atlas']['path']).read_text()=='\n'.join(v for v in native_atlas.lstrip('\n').split('\n') if not v.startswith('size:'))
 s1={'begin':None,'loop':'Attack','end':None,'idle':None,'index':0,'via':'attack'}
 s2={'begin':'Skill_Begin','loop':'Skill_Loop','end':None,'idle':'Skill_Idle','index':1,'via':'skill'}
 roles={'idle':'Idle','deploy':'Start','attack':{'begin':None,'loop':'Attack','end':None},'attackDown':None,
  'skill':s1,'skills':{'0':s1,'1':s2},'die':'Die' if face=='Front' else None,'stun':None,'move':None}
 rows[face.lower()]={'modelKey':key,'source':source,'files':{k:d[k] for k in ['skeleton','atlas','textures']},
  'nativeBundle':info,'originalBindings':n,'materialPathId':str(material),'texturePathId':str(texture),
  'materialFloats':floats,'decodedPixelSha256':sha(image.tobytes()),'textureDimensions':list(image.size),
  'metadata':{'spineVersion':p['version'],'premultipliedAlpha':True,'animations':p['durations'],
   'hits':p['hits'],'bounds':p['bounds'],'animationRoles':roles}}
 print('Bound original',face,'files, every decoded pixel, material and literal animation tracks',flush=True)
receipt={'schemaVersion':1,'owner':ID,'artworkOnly':True,'enabledOperators':[],'frameParity':False,
 'nativeParticleSupport':False,'nativeShaderParity':False,'foundation':{'path':str(foundation.relative_to(ROOT)),'sha256':PIN},
 'scope':'Original owner files unchanged; native pixels and PMA input verified. Selected S1 retains Attack; S2 uses explicit Begin/Loop/Idle with no inferred End. No gameplay/browser approval.',
 'ownerModels':rows}
p=ROOT/'data/arkpedia-reckpr-art.json';temporary=p.with_suffix(f'.json.{os.getpid()}.tmp')
try:
 temporary.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');temporary.replace(p)
finally:temporary.unlink(missing_ok=True)
if '--hydrate-owner-metadata' in sys.argv:
 for row in rows.values():manifest['models'][row['modelKey']].update(row['metadata'])
 p=assets/'manifest.json';temporary=p.with_suffix(f'.json.reckpr-{os.getpid()}.tmp')
 try:temporary.write_text(json.dumps(manifest,indent=2)+'\n');temporary.replace(p)
 finally:temporary.unlink(missing_ok=True)
 print('Updated two metadata records; source files unchanged')
