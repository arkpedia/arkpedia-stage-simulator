#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce an original owner-art receipt and reject altered delivery claims."""
from pathlib import Path
import argparse,copy,hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2];parser=argparse.ArgumentParser();parser.add_argument('--recipe',required=True);args=parser.parse_args()
recipe=json.loads(Path(args.recipe).read_bytes());source=ROOT/recipe['output'];original=source.read_bytes();receipt=json.loads(original)
out=ROOT/f".cache/arkpedia/cn-operators/{recipe['operator']}/art-audit/{os.getpid()}";out.mkdir(parents=True,exist_ok=True)
files=[ROOT.parent/'arkpedia-sd-assets'/f['path'] for r in receipt['ownerModels'].values() for f in [r['files']['skeleton'],r['files']['atlas'],*r['files']['textures']]]
hashes=lambda:{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
before=hashes()
def run(mode,*extra):return subprocess.run([sys.executable,'tools/arkpedia/cn-owner-art.py',mode,'--recipe',args.recipe,*extra],cwd=ROOT,capture_output=True,text=True)
for mode in ['verify','bind','verify']:
 r=run(mode);assert r.returncode==0,r.stdout+r.stderr
assert source.read_bytes()==original and hashes()==before
cases=[('public approval',['enabledOperators'],[recipe['operator']]),('frame parity',['frameParity'],True),('shader parity',['nativeShaderParity'],True),
 ('particle parity',['nativeParticleSupport'],True),('wrong owner',['owner'],'char_0_other'),('wrong foundation',['foundation','sha256'],'0'*64),('wrong recipe',['recipeSha256'],'0'*64)]
for face in ['front','back']:
 p=['ownerModels',face]
 roles=receipt['ownerModels'][face]['metadata']['animationRoles']
 skill_path=['skills','0','loop'] if '0' in roles.get('skills',{}) else ['skill']
 skill_value='Default' if len(skill_path)>1 else {'begin':None,'loop':'Default','end':None}
 cases.extend([(face+' moving source',p+['source','commit'],'main'),(face+' skeleton hash',p+['files','skeleton','sha256'],'0'*64),
  (face+' file length',p+['files','atlas','bytes'],1),(face+' bundle identity',p+['nativeBundle','sha256'],'0'*64),
  (face+' wrong original pointer',p+['originalBindings','textAssetPathId'],'123'),(face+' wrong material',p+['materialPathId'],'123'),
  (face+' wrong texture',p+['texturePathId'],'123'),(face+' forged material',p+['materialFloats','_StraightAlphaInput'],1),
  (face+' wrong pixels',p+['decodedPixelSha256'],'0'*64),(face+' wrong dimensions',p+['textureDimensions'],[1,1]),
  (face+' wrong PMA',p+['metadata','premultipliedAlpha'],False),(face+' wrong skill role',p+['metadata','animationRoles']+skill_path,skill_value),
  (face+' invented clip duration',p+['metadata','animations','Attack'],999)])
for name,path,value in cases:
 v=copy.deepcopy(receipt);row=v
 for k in path[:-1]:row=row[k]
 row[path[-1]]=value;altered=out/'altered.json';altered.write_text(json.dumps(v))
 r=run('verify','--metadata',str(altered));assert r.returncode!=0,'Accepted altered artwork: '+name
 print('Rejected',name,flush=True)
assert source.read_bytes()==original and hashes()==before
print(f'Reproduced original artwork receipt; kept six source files unchanged; rejected {len(cases)} altered claims')
