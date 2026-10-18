#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Adversarially verify avatar provenance against immutable original bundles."""
import argparse,copy,hashlib,json,pathlib,subprocess,sys,tempfile
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--recipe',default='data/arkpedia-mcnist-token-avatar-recipe.json');args=parser.parse_args()
recipe=ROOT/args.recipe;r=json.loads(recipe.read_bytes());metadata=ROOT/r['output'];image=ROOT/'.cache/arkpedia/cn-operators'/r['operator']/'token-avatar/avatar.png';tool=ROOT/'tools/arkpedia/cn-token-avatar.py';base=json.loads(metadata.read_bytes());sha=lambda b:hashlib.sha256(b).hexdigest()
def run(meta,img=image,rec=recipe):return subprocess.run([sys.executable,str(tool),'verify','--recipe',str(rec),'--metadata',str(meta),'--image',str(img)],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE).returncode
assert run(metadata)==0
mutations=[('approved',lambda x:x['enabledOperators'].append(x['operator'])),('frame parity',lambda x:x.update(frameParity=True)),
 ('wrong owner',lambda x:x.update(operator='char_4234_pedro')),('borrowed token',lambda x:x.update(token='token_10002_kalts_mon3tr')),
 ('source manifest',lambda x:x['source'].update(manifestSha256='0'*64)),('foundation',lambda x:x['foundation'].update(sha256='0'*64)),('recipe',lambda x:x.update(recipeSha256='0'*64)),
 ('hub key',lambda x:x['hub'].update(key='borrowed')),('hub path',lambda x:x['hub'].update(value='Arts/CharAvatars/borrowed')),
 ('sprite pointer',lambda x:x['sprite'].update(spritePathId='123')),('number pointer',lambda x:x['sprite'].update(spritePathId=int(x['sprite']['spritePathId']))),
 ('texture pointer',lambda x:x['sprite'].update(texturePathId='123')),('container',lambda x:x['sprite'].update(container='dyn/arts/charavatars/borrowed.png')),
 ('bundle',lambda x:x['sprite']['bundle'].update(sha256='0'*64)),('pixel claim',lambda x:x['avatar'].update(decodedPixelSha256='0'*64)),
 ('dimensions',lambda x:x['avatar'].update(dimensions=[90,90])),('transforms',lambda x:x.update(transforms=['resized and recolored'])),('combat scope',lambda x:x.update(scope='Combat approved'))]
with tempfile.TemporaryDirectory(prefix='arkpedia-avatar-audit-')as tmp:
 root=pathlib.Path(tmp);out=root/'proof.json'
 for label,mutate in mutations:
  value=copy.deepcopy(base);mutate(value);out.write_text(json.dumps(value));assert run(out)!=0,label
 forged=root/'avatar.png';im=Image.open(image).convert('RGBA');old=im.getpixel((90,90));im.putpixel((90,90),(old[0]^1,*old[1:]));im.save(forged)
 value=copy.deepcopy(base);value['avatar'].update(bytes=forged.stat().st_size,sha256=sha(forged.read_bytes()),decodedPixelSha256=sha(im.tobytes()));out.write_text(json.dumps(value));assert run(out,forged)!=0,'forged matching pixel/file hashes'
 # Align the forged receipt recipe hash too, so wrong pointer refusal must
 # still come from original Sprite identity rather than an incidental hash.
 rec=json.loads(recipe.read_bytes());rec['spritePathId']='-215300905893959141';wrong=root/'recipe.json';wrong.write_text(json.dumps(rec));value=copy.deepcopy(base);value['recipeSha256']=sha(wrong.read_bytes());value['sprite']['spritePathId']=rec['spritePathId'];out.write_text(json.dumps(value));assert run(out,rec=wrong)!=0,'wrong Sprite with aligned recipe hash'
print('Original native avatar reproduced; rejected',len(mutations)+2,'altered provenance, pointer, approval and pixel claims')
