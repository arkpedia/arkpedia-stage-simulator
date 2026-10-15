#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce original-art metadata and reject forged source/delivery claims."""
from pathlib import Path
import copy,hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2];source=ROOT/'data/arkpedia-reckpr-art.json'
out=ROOT/f'.cache/arkpedia/cn-operators/char_4196_reckpr/art-audit/{os.getpid()}';out.mkdir(parents=True,exist_ok=True)
def run(tool,*args):return subprocess.run([sys.executable,f'tools/arkpedia/{tool}.py',*args],cwd=ROOT,capture_output=True,text=True)
original=source.read_bytes();m=json.loads(original)
files=[ROOT.parent/'arkpedia-sd-assets'/f['path'] for row in m['ownerModels'].values() for f in [row['files']['skeleton'],row['files']['atlas'],*row['files']['textures']]]
hashes=lambda:{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
before=hashes()
for tool in ['verify-reckpr-models','extract-reckpr-models','verify-reckpr-models']:
 r=run(tool);assert r.returncode==0,r.stdout+r.stderr
assert source.read_bytes()==original and hashes()==before

def change(path,value):
 def mutate(v):
  for k in path[:-1]:v=v[k]
  v[path[-1]]=value
 return mutate
cases=[('public approval',['enabledOperators'],['char_4196_reckpr']),('frame parity',['frameParity'],True),
 ('shader parity',['nativeShaderParity'],True),('particle parity',['nativeParticleSupport'],True),
 ('wrong owner',['owner'],'char_0_other'),('wrong foundation',['foundation','sha256'],'0'*64)]
for face in ['front','back']:
 prefix=['ownerModels',face]
 cases.extend([(face+' moving source',prefix+['source','commit'],'main'),
  (face+' skeleton hash',prefix+['files','skeleton','sha256'],'0'*64),
  (face+' file length',prefix+['files','atlas','bytes'],1),
  (face+' bundle identity',prefix+['nativeBundle','sha256'],'0'*64),
  (face+' wrong original pointer',prefix+['originalBindings','textAssetPathId'],'123'),
  (face+' wrong material',prefix+['materialPathId'],'123'),
  (face+' wrong texture',prefix+['texturePathId'],'123'),
  (face+' forged material',prefix+['materialFloats','_StraightAlphaInput'],1),
  (face+' wrong pixels',prefix+['decodedPixelSha256'],'0'*64),
  (face+' wrong dimensions',prefix+['textureDimensions'],[1,1]),
  (face+' wrong PMA',prefix+['metadata','premultipliedAlpha'],False),
  (face+' invented S2 End',prefix+['metadata','animationRoles','skills','1','end'],'Skill_End'),
  (face+' invented S1 clip',prefix+['metadata','animationRoles','skills','0','loop'],'Skill_Loop')])
for name,path,value in cases:
 v=copy.deepcopy(m);change(path,value)(v);p=out/'altered.json';p.write_text(json.dumps(v))
 r=run('verify-reckpr-models','--metadata',str(p));assert r.returncode!=0,'Accepted altered claim: '+name
 print('Rejected',name,flush=True)
assert hashes()==before and source.read_bytes()==original
print(f'Reproduced one receipt; preserved six original files; rejected {len(cases)} altered artwork/approval claims')
