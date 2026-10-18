#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce original token delivery and reject forged provenance and pixels."""
from pathlib import Path
import argparse,copy,hashlib,json,os,shutil,subprocess,sys,tempfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];p=argparse.ArgumentParser();p.add_argument('--recipe',required=True);args=p.parse_args();recipe=json.loads(Path(args.recipe).read_bytes());owner,token=recipe['operator'],recipe['model']
source=ROOT/recipe['output'];raw=source.read_bytes();meta=json.loads(raw);single=recipe.get('nativeFacing')=='Single';record=meta['models'][token];facings={'single':record}if single else record['facings'];out=ROOT/'.cache/arkpedia/cn-operators'/owner/'token-art';paths=[source,*[out/r['directory']/name for r in facings.values()for name in r['files']]]
hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before={p:hash(p)for p in paths}
def run(mode,*extra):return subprocess.run([sys.executable,'tools/arkpedia/cn-token-art.py',mode,'--recipe',args.recipe,*extra],cwd=ROOT,capture_output=True,text=True)
for mode,extra in [('verify',[]),('bind',[]),('verify',['--assets'])]:
 r=run(mode,*extra);assert r.returncode==0,r.stdout+r.stderr
assert source.read_bytes()==raw and {p:hash(p)for p in paths}==before
cases=[('wrong owner',['owner'],'char_0_other'),('public approval',['enabledOperators'],[owner]),('frame parity',['frameParity'],True),('module approval',['moduleSupport'],True),('particle approval',['nativeParticleSupport'],True),('shader parity',['nativeShaderParity'],True),('wrong foundation',['foundation','sha256'],'0'*64),('wrong recipe',['recipeSha256'],'0'*64),('wrong client',['sourceBundle','client'],'global'),('wrong source URL',['sourceBundle','url'],'https://invalid.example/native.dat'),('wrong bundle SHA',['sourceBundle','sha256'],'0'*64),('wrong bundle MD5',['sourceBundle','md5'],'0'*32),('wrong bundle length',['sourceBundle','bytes'],1),('moving source',['sourceBundle','resourceVersion'],'latest'),('undeclared transforms',['sourceBundle','transforms'],[]),('invented facing',['models',token,'facings']if single else['models',token,'facings','down'],{})]
for face,r in facings.items():
 path=['models',token]if single else['models',token,'facings',face]
 attack=r['animationRoles']['attack']['loop'];duration=next(iter(r['durations']))
 cases += [(face+' rebound root',path+['originalPathIds','rootPathId'],'1'),(face+' rounded pointer',path+['originalPathIds','animatorPathId'],3830167749147248000.0),(face+' wrong skeleton',path+['originalPathIds','textAssetPathId'],'1'),(face+' wrong material',path+['originalPathIds','materialPathId'],'1'),(face+' wrong texture',path+['originalPathIds','texturePathId'],'1'),(face+' wrong pixels',path+['decodedPixelSha256'],'0'*64),(face+' wrong dimensions',path+['textureDimensions'],[1,1]),(face+' wrong PMA',path+['materialFloats','_StraightAlphaInput'],1),(face+' wrong Spine version',path+['spineVersion'],'4.1'),(face+' changed face switcher',path+['nativeFaceSwitcher'],{}),(face+' changed native aliases',path+['nativeAnimationAliases'],{}),(face+' wrong event',path+['eventPayloads',attack,0,'time'],.12345),(face+' invented loop length',path+['durations',duration],999),(face+' invented skill role',path+['animationRoles','skill'],{'loop':'Skill_Loop'}),(face+' wrong bounds',path+['bounds'],{}),(face+' wrong skeleton hash',path+['files',token+'.skel','sha256'],'0'*64)]
if single:cases += [('invented native facing',['models',token,'nativeFacing'],'Front')]
else:cases += [('invented Back death',['models',token,'facings','back','animationRoles','die'],'Die'),('invented Back alias',['models',token,'facings','back','missingOptionalAliases'],[])]
temporary=tempfile.TemporaryDirectory(prefix='token-art-audit-',dir=out.parent);isolated=Path(temporary.name)
for r in facings.values():
 for name in r['files']:
  dest=isolated/r['directory']/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(out/r['directory']/name,dest)
negative=isolated/'altered-metadata.json'
try:
 for name,path,value in cases:
  m=copy.deepcopy(meta);v=m
  for k in path[:-1]:v=v[k]
  v[path[-1]]=value;negative.write_text(json.dumps(m));r=run('verify','--metadata',str(negative),'--extracted-root',str(isolated));assert r.returncode!=0 and 'AssertionError'in r.stderr,name+': '+r.stdout+r.stderr
  print('Rejected',name,flush=True)
 face=next(iter(facings));r=facings[face]
 for name in [next(n for n in r['files']if n.endswith('.png')),next(n for n in r['files']if n.endswith('.atlas'))]:
  file=isolated/r['directory']/name;original=file.read_bytes()
  try:
   if name.endswith('.png'):
    im=Image.open(file).copy();im.putpixel((0,0),(255,255,255,255));im.save(file)
   else:file.write_text(file.read_text().replace('pma: true','pma: false'))
   assert file.read_bytes()!=original;m=copy.deepcopy(meta);mr=m['models'][token]if single else m['models'][token]['facings'][face];mr['files'][name]={'bytes':file.stat().st_size,'sha256':hash(file)};negative.write_text(json.dumps(m));result=run('verify','--metadata',str(negative),'--extracted-root',str(isolated));assert result.returncode!=0 and 'AssertionError'in result.stderr,result.stdout+result.stderr
   print('Rejected altered bytes with forged file hash:',name,flush=True)
  finally:file.write_bytes(original)
finally:temporary.cleanup()
assert {p:hash(p)for p in paths}==before
print(f'Reproduced {len(paths)} original delivery outputs; rejected {len(cases)+2} altered claims; original outputs unchanged',flush=True)
