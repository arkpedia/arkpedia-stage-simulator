#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce an original token-card Sprite through its pinned native hub/bundle."""
import argparse,hashlib,io,json,pathlib,re,sys,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
args=argparse.ArgumentParser();args.add_argument('mode',choices=['bind','verify']);args.add_argument('--recipe',required=True);args.add_argument('--metadata');args.add_argument('--image');args.add_argument('--assets',action='store_true');args=args.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
recipe_raw=pathlib.Path(args.recipe).read_bytes();r=json.loads(recipe_raw);owner,token=r['operator'],r['token']
assert re.fullmatch(r'char_\d+_[a-z0-9]+',owner)and re.fullmatch(r'token_\d+_[a-z0-9_]+',token)
foundation=ROOT/f'data/arkpedia-native-operators/{owner}.json';raw=foundation.read_bytes();assert sha(raw)==r['foundationSha256'];e=json.loads(raw)
assert e['operatorId']==owner and token in e['tokens']and e['enabledOperators']==[]and owner in e['heldOperators']
inv_raw=(ROOT/'data/arkpedia-cn-native-source.json').read_bytes();assert sha(inv_raw)==e['source']['nativeInventorySha256'];source=json.loads(inv_raw)['source']
manifest_raw=(ROOT/'.cache/arkpedia/cn-native-source/hot_update_list.json').read_bytes();assert len(manifest_raw)==source['manifestBytes']and sha(manifest_raw)==source['manifestSha256'];hot=json.loads(manifest_raw)
assert hot['versionId']==source['resourceVersion']==e['source']['nativeClient']
def bundle(name):
 assert re.fullmatch(r'[a-z0-9_/]+\.ab',name)
 row=next(v for v in hot['abInfos']if v['name']==name);data=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/name).read_bytes()
 assert data.startswith(b'UnityFS\0')and len(data)==row['abSize']and hashlib.md5(data).hexdigest()==row['md5']
 archive=name.replace('/','_').removesuffix('.ab')+'.dat'
 return {o.path_id:o for o in UnityPy.load(data).objects},{'path':name,'bytes':len(data),'md5':row['md5'],'sha256':sha(data),'url':urllib.parse.urljoin(source['baseURL'],urllib.parse.quote(archive,safe=''))}
hub,hub_source=bundle(r['hubBundle']);hub_object=hub[int(r['hubPathId'])];assert hub_object.type.name=='MonoBehaviour';mapping=hub_object.read_typetree()
assert mapping['_rootPackingTag']=='UI_CHAR_AVATAR'and len(mapping['_keys'])==len(set(mapping['_keys']))==len(mapping['_values'])
index=mapping['_keys'].index(token);value=mapping['_values'][index];assert value=='Arts/CharAvatars/'+token
objects,sprite_source=bundle(r['spriteBundle']);sprite=objects[int(r['spritePathId'])];assert sprite.type.name=='Sprite';s=sprite.read_typetree();texture=s['m_RD']['texture']
assert s['m_Name']==token and texture['m_FileID']==0 and str(texture['m_PathID'])==r['texturePathId']and objects[texture['m_PathID']].type.name=='Texture2D'
assert s['m_SpriteAtlas']['m_PathID']==0 and s['m_RD']['alphaTexture']['m_PathID']==0 and not s['m_IsPolygon']and s['m_RD']['settingsRaw']==0
assert s['m_Rect']=={'x':0.0,'y':0.0,'width':180.0,'height':180.0}and s['m_RD']['textureRect']==s['m_Rect']
assert s['m_Offset']=={'x':0.0,'y':0.0}and s['m_Pivot']=={'x':.5,'y':.5}
entries=[v['asset']for o in objects.values()if o.type.name=='AssetBundle'for k,v in o.read_typetree()['m_Container']if k==r['container']]
assert r['container']=='dyn/arts/charavatars/'+token+'.png'and sorted((x['m_FileID'],str(x['m_PathID']))for x in entries)==sorted([(0,r['spritePathId']),(0,r['texturePathId'])])
image=sprite.read().image;assert image.mode=='RGBA'and image.size==(180,180);encoded=io.BytesIO();image.save(encoded,format='PNG');png=encoded.getvalue()
expected={'schemaVersion':1,'operator':owner,'token':token,'artworkOnly':True,'enabledOperators':[],'frameParity':False,
 'foundation':{'path':str(foundation.relative_to(ROOT)),'sha256':r['foundationSha256']},'recipeSha256':sha(recipe_raw),'sdReview':r['sdReview'],
 'source':{'client':'cn','resourceVersion':hot['versionId'],'manifestBytes':len(manifest_raw),'manifestSha256':sha(manifest_raw),'manifestURL':source['manifestURL']},
 'hub':{'bundle':hub_source,'pathId':r['hubPathId'],'packingTag':mapping['_rootPackingTag'],'key':token,'value':value,'index':index},
 'sprite':{'bundle':sprite_source,'container':r['container'],'spritePathId':r['spritePathId'],'texturePathId':r['texturePathId'],'name':token,'rect':s['m_Rect'],'offset':s['m_Offset'],'pivot':s['m_Pivot'],'packingRotation':0},
 'avatar':{'name':'avatar.png','bytes':len(png),'sha256':sha(png),'dimensions':list(image.size),'decodedPixelSha256':sha(image.tobytes())},
 'transforms':['Original named 180x180 RGBA Sprite decoded without resizing, recoloring, pixel edits or a substitute portrait; lossless PNG encoding only'],
 'scope':'Original token deployment-card portrait only. Native hub key/value, Sprite/Texture2D/container pointers and unchanged decoded pixels. No combat, rendering, module or game-frame approval.'}
output=ROOT/r['output'];assert output.resolve().is_relative_to(ROOT/'data');image_path=pathlib.Path(args.image)if args.image else ROOT/'.cache/arkpedia/cn-operators'/owner/'token-avatar/avatar.png'
if args.mode=='bind':
 image_path.parent.mkdir(parents=True,exist_ok=True);image_path.write_bytes(png);output.write_text(json.dumps(expected,ensure_ascii=False,indent=2)+'\n')
else:
 assert json.loads((pathlib.Path(args.metadata)if args.metadata else output).read_bytes())==expected
 assert image_path.read_bytes()==png
if args.assets:
 assets=ROOT.parent/'arkpedia-sd-assets';review_raw=(assets/r['sdReview']).read_bytes();assert json.loads(review_raw)==expected
 manifest=json.loads((assets/'manifest.json').read_bytes());provenance={'kind':'cn-native-sprite','resourceVersion':hot['versionId'],'bundleSha256':sprite_source['sha256'],'spritePathId':r['spritePathId'],'texturePathId':r['texturePathId'],'proof':r['sdReview'],'proofSha256':sha(review_raw)}
 for face in ['front','back']:
  avatar=manifest['models'][f'operator/{token}/default/{face}']['avatar'];assert avatar['source']==provenance and avatar['bytes']==len(png)and avatar['sha256']==sha(png)and (assets/avatar['path']).read_bytes()==png
print('Verified original',token,'avatar: pinned hub, container, Sprite/Texture2D pointers and unchanged 180x180 RGBA pixels')
