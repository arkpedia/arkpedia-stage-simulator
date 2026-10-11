#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independent native pointer/pixel/atlas/avatar audit, optionally delivered aliases."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4
import UnityPy
from PIL import Image
C=ROOT/'.cache/arkpedia'; OUT=C/'ray-source/sandbeast-art'; ID='token_10034_ray_sndbst'
metadata=Path(sys.argv[sys.argv.index('--metadata')+1]) if '--metadata' in sys.argv else OUT/'sources.json'
m=json.loads(metadata.read_text()); r=m['models'][ID]; d=metadata.parent/r['directory']
assert m['sourceBundle']['path']=='pkgrps/btl_pfb_tokens_0.ab'
assert m['sourceBundle']['resourceVersion']=='26-09-23-17-49-43_b9cc4a'
assert m['avatarSource']['commit']=='d0b5af0b004b044d322397ce5ae79632b6d9fcdd'
hot=json.loads((C/'map-source/hot_update_list.json').read_text())
assert hot['versionId']==m['sourceBundle']['resourceVersion']
original=next(i for i in hot['abInfos'] if i['name']==m['sourceBundle']['path'])
assert original['abSize']==m['sourceBundle']['bytes'] and original['md5']==m['sourceBundle']['md5']
raw=(C/'map-source/ab'/m['sourceBundle']['path']).read_bytes()
assert len(raw)==m['sourceBundle']['bytes']
assert hashlib.sha256(raw).hexdigest()==m['sourceBundle']['sha256']
assert hashlib.md5(raw).hexdigest()==m['sourceBundle']['md5']
objs={o.path_id:o for o in UnityPy.load(raw).objects}
def obj(k):return objs[int(r['originalPathIds'][k])]
def tree(k):return obj(k).read_typetree()
def ptr(p,k):assert p['m_FileID']==0 and p['m_PathID']==int(r['originalPathIds'][k])
def text(k):
 s=obj(k).read().m_Script
 return s.encode('utf8','surrogateescape') if isinstance(s,str) else bytes(s)
assert int(r['originalPathIds']['rootPathId'])==-2468620494337328075
ptr(tree('rootPathId')['_animator'],'animatorPathId')
ptr(tree('animatorPathId')['_skeleton'],'skeletonAnimationPathId')
ptr(tree('animatorPathId')['_faceSwitcher'],'faceSwitcherPathId')
ptr(tree('skeletonAnimationPathId')['skeletonDataAsset'],'skeletonDataAssetPathId')
a=tree('skeletonDataAssetPathId');ptr(a['skeletonJSON'],'textAssetPathId')
assert len(a['atlasAssets'])==1;ptr(a['atlasAssets'][0],'atlasAssetPathId')
a=tree('atlasAssetPathId');ptr(a['atlasFile'],'atlasTextAssetPathId')
assert len(a['materials'])==1;ptr(a['materials'][0],'materialPathId')
props=tree('materialPathId')['m_SavedProperties']; f=dict(props['m_Floats']); ts=dict(props['m_TexEnvs'])
assert f['_UseAlphaTex']==0 and f['_StraightAlphaInput']==0
assert ts['_AlphaTex']['m_Texture']['m_PathID']==0
ptr(ts['_MainTex']['m_Texture'],'rgbaTexturePathId')
assert obj('textAssetPathId').read().m_Name==ID+'.skel'
assert obj('atlasTextAssetPathId').read().m_Name==ID+'.atlas'
assert (d/(ID+'.skel')).read_bytes()==text('textAssetPathId')
rgba=obj('rgbaTexturePathId').read().image.convert('RGBA')
png=Image.open(d/(ID+'.png')).convert('RGBA');assert png.size==rgba.size
assert png.tobytes()==rgba.tobytes()
# Preserve all original region text; only normalize the page's size and pma.
s=text('atlasTextAssetPathId').decode().replace('\r\n','\n').replace('\r','\n').lstrip('\ufeff')
lines=s.split('\n');start=next(i for i,l in enumerate(lines) if l);i=start+1
while i<len(lines) and lines[i] and ':'in lines[i] and not lines[i][0].isspace():i+=1
fields=lines[start+1:i];size=f'size: {png.width},{png.height}'
fields=[size if l.startswith('size:') else l for l in fields]
if not any(l.startswith('size:')for l in fields):fields.insert(0,size)
if not any(l.startswith('pma:')for l in fields):fields.append('pma: true')
assert (d/(ID+'.atlas')).read_text()=='\n'.join([*lines[:start+1],*fields,*lines[i:]])
commit=m['avatarSource']['commit']; avatar=subprocess.check_output(['git','-C',str(ROOT.parent/'arkpedia-sd-assets/.cache/arknights-resource'),'show',f'{commit}:avatar/ASSISTANT/{ID}.png'])
assert avatar==(d/'avatar.png').read_bytes()
for name,v in r['files'].items():
 b=(d/name).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256']
assert r['spineVersion']=='3.8.99' and r['animationRoles']=={'idle':'Idle','deploy':'Start','die':'Idle'}
assert r['eventPayloads']['Start'][0]['time']==0.06666667014360428
parsed=json.loads(subprocess.check_output(['node','--input-type=module','-e',
 "import {readFile} from 'node:fs/promises';import {parseSkel} from './tools/assets/skel.mjs';import {atlasInfo} from './tools/assets/atlas.mjs';const d=process.argv[1],id=process.argv[2];const atlas=await readFile(d+'/'+id+'.atlas','utf8');console.log(JSON.stringify(parseSkel(await readFile(d+'/'+id+'.skel'),atlasInfo(atlas).regions,{includeEventPayloads:true})));",str(d),ID],cwd=ROOT))
assert parsed['missingRegions']==[] and parsed['version']==r['spineVersion']
for k in ['durations','hits','eventPayloads','bounds']:assert parsed[k]==r[k],k
if '--delivered' in sys.argv:
 assets=ROOT.parent/'arkpedia-sd-assets'; manifest=json.loads((assets/'manifest.json').read_text())
 for facing in ['front','back']:
  a=manifest['models'][f'operator/{ID}/default/{facing}'];assert a['source']['facingAlias']=='single-original-model'
  assert a['source']['originalPathIds']==r['originalPathIds']
  for f in [a['skeleton'],a['atlas'],*a['textures'],a['avatar']]:
   raw=(assets/f['path']).read_bytes();assert raw==(d/Path(f['path']).name).read_bytes()
print('Verified native single skeleton, full pixel alpha, unchanged regions, original avatar and selected aliases')
