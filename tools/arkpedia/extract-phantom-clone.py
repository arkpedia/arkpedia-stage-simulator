#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Extract Phantom's actual Front/Back clone models from verified Global bytes.

Python dependencies: UnityPy, Pillow, and the local-extract/aklz4.py module.
Run from any directory with --avatar-source pointing to the pinned resource Git
checkout. Same-name TextAssets are resolved through the original animator's
SkeletonAnimation -> SkeletonDataAsset -> AtlasAsset -> Material references;
selecting by filename would silently combine different facing assets.
"""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4, UnityPy
from extract import merge_alpha,normalize_atlas
VERSION='26-09-23-17-49-43_b9cc4a'
AVATAR_COMMIT='d0b5af0b004b044d322397ce5ae79632b6d9fcdd'
ID='token_10007_phatom_twin'
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--bundle-root',type=Path,default=ROOT/'.cache/arkpedia/map-source/ab')
p.add_argument('--hot-update-list',type=Path,default=ROOT/'.cache/arkpedia/map-source/hot_update_list.json')
p.add_argument('--out',type=Path,default=ROOT/'.cache/arkpedia/phantom-source/original-token-pair')
p.add_argument('--avatar-source',type=Path,required=True)
a=p.parse_args();hot=json.loads(a.hot_update_list.read_text());assert hot['versionId']==VERSION
name='pkgrps/btl_pfb_tokens_0.ab';info=next(x for x in hot['abInfos'] if x['name']==name)
raw=(a.bundle_root/name).read_bytes();assert len(raw)==info['abSize'] and hashlib.md5(raw).hexdigest()==info['md5']
env=UnityPy.load(raw);objects={o.path_id:o for o in env.objects}
def tree(ref):
 assert ref['m_FileID']==0
 return objects[ref['m_PathID']].read_typetree()
def text(ref):
 assert ref['m_FileID']==0
 d=objects[ref['m_PathID']].read().m_Script
 return d.encode('utf8','surrogateescape') if isinstance(d,str) else bytes(d)
def record(directory,names):
 return {n:{'bytes':(directory/n).stat().st_size,'sha256':hashlib.sha256((directory/n).read_bytes()).hexdigest()} for n in names}
animator=objects[571414060225093949].read_typetree()
assert [(x['animKey'],x['animName']) for x in animator['_animations']]==[('Idle','Idle'),('Attack','Attack'),('Die','Die'),('Born','Start'),('Default','Default'),('Attack_2','Attack_2'),('Skill','Skill')]
avatar=subprocess.check_output(['git','-C',str(a.avatar_source),'show',f'{AVATAR_COMMIT}:avatar/ASSISTANT/{ID}.png'])
facings={};refs={}
for facing in ['front','back']:
 skeleton_ref=animator['_'+facing]['skeleton'];skeleton=tree(skeleton_ref)
 data_ref=skeleton['skeletonDataAsset'];data=tree(data_ref)
 assert len(data['atlasAssets'])==1
 atlas_ref=data['atlasAssets'][0];atlas=tree(atlas_ref);assert len(atlas['materials'])==1
 material_ref=atlas['materials'][0];material=tree(material_ref)
 tex=dict(material['m_SavedProperties']['m_TexEnvs'])
 rgb_ref=tex['_MainTex']['m_Texture'];alpha_ref=tex['_AlphaTex']['m_Texture']
 assert rgb_ref['m_FileID']==alpha_ref['m_FileID']==0
 image=merge_alpha(objects[rgb_ref['m_PathID']].read().image,objects[alpha_ref['m_PathID']].read().image)
 directory=a.out/ID/facing;directory.mkdir(parents=True,exist_ok=True)
 (directory/(ID+'.skel')).write_bytes(text(data['skeletonJSON']))
 normalized=normalize_atlas(text(atlas['atlasFile']).decode('utf8'),{ID+'.png':image.size})
 (directory/(ID+'.atlas')).write_text(normalized)
 image.save(directory/(ID+'.png'));(directory/'avatar.png').write_bytes(avatar)
 names=[ID+'.skel',ID+'.atlas',ID+'.png','avatar.png']
 pathids={'animator':str(571414060225093949),'skeletonAnimation':str(skeleton_ref['m_PathID']),'skeletonDataAsset':str(data_ref['m_PathID']),'skeletonTextAsset':str(data['skeletonJSON']['m_PathID']),'atlasAsset':str(atlas_ref['m_PathID']),'atlasTextAsset':str(atlas['atlasFile']['m_PathID']),'material':str(material_ref['m_PathID']),'rgbTexture':str(rgb_ref['m_PathID']),'alphaTexture':str(alpha_ref['m_PathID'])}
 facings[facing]={'directory':str(Path(ID)/facing),'files':record(directory,names),'textureDimensions':list(image.size),'originalPathIds':pathids}
 refs[facing]={'skeleton':skeleton,'skeletonData':data,'atlas':atlas,'material':material}
metadata={'sourceBundle':{'path':name,'bytes':len(raw),'md5':info['md5'],'sha256':hashlib.sha256(raw).hexdigest(),'resourceVersion':VERSION,'url':f'https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/{VERSION}/pkgrps_btl_pfb_tokens_0.dat','transforms':['RGB plus separated Alpha texture merge','atlas texture dimensions normalized and pma: true recorded']},'avatarSource':{'repository':'fexli/ArknightsResource','commit':AVATAR_COMMIT,'directory':'avatar/ASSISTANT'},'models':{ID:{'facings':facings}}}
(a.out/'sources.json').write_text(json.dumps(metadata,indent=2)+'\n')
(a.out/'original-bindings.json').write_text(json.dumps({'animator':animator,'facings':refs},indent=2)+'\n')
# Parse the exact extracted slices with the client-compatible Spine parser.
# Node dependencies come from the simulator package's npm install.
subprocess.run(['node','--input-type=module','-e',"""
import fs from 'node:fs';import path from 'node:path';
import{parseSkel}from'./tools/assets/skel.mjs';
const root=process.argv[1],file=path.join(root,'sources.json');
const meta=JSON.parse(fs.readFileSync(file,'utf8'));
for(const[id,model]of Object.entries(meta.models))for(const facing of Object.values(model.facings)){
 const info=parseSkel(fs.readFileSync(path.join(root,facing.directory,id+'.skel')));
 Object.assign(facing,{spineVersion:info.version,durations:info.durations,hits:info.hits,bounds:info.bounds,
  animationRoles:{idle:'Idle',deploy:'Start',attack:{begin:null,loop:'Attack',end:null},attackDown:null,skill:{begin:null,loop:'Attack',end:null,via:'attack',index:0,idle:null},skills:[{begin:null,loop:'Attack',end:null,via:'attack',index:0,idle:null},{begin:null,loop:'Attack_2',end:null,via:'attack',index:1,idle:null},{begin:null,loop:'Skill',end:null,via:'active',index:2,idle:null}],die:info.animations.includes('Die')?'Die':null,move:null,stun:null}});
}
fs.writeFileSync(file,JSON.stringify(meta,null,2)+'\\n');
""",str(a.out.resolve())],cwd=ROOT,check=True)
print('Extracted both original clone facing models:',a.out)
