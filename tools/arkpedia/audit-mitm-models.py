#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reject altered native artwork metadata without relying on receipt equality."""
import copy,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'.cache/arkpedia/mitm-source/device-art'
metadata=json.loads((out/'sources.json').read_text());cases=out/'negative-fixtures';cases.mkdir(exist_ok=True)
token='token_10037_mitm_trshrb';link=cases/token
if not link.exists():link.symlink_to(out/token,target_is_directory=True)
files=[out/'sources.json',root/'data/arkpedia-mitm-device-art.json',*(out/token/'single').iterdir()]
def hashes():return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
before=hashes()
subprocess.run([str(root/'.cache/map-env/bin/python'),str(root/'tools/arkpedia/extract-mitm-models.py')],cwd=root,check=True)
assert hashes()==before,'Native artwork re-extraction changed reviewed bytes'
print('Byte-identical re-extraction:',len(files),'files',flush=True)
control=cases/'control.json';control.write_text(json.dumps(metadata))
valid=subprocess.run([str(root/'.cache/map-env/bin/python'),str(root/'tools/arkpedia/verify-mitm-models.py'),'--metadata',str(control)],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
assert valid.returncode==0,valid.stdout
print('Accepted unaltered metadata through the same fixture path',flush=True)
checks=[]
def add(name,change):checks.append((name,change))
def model(m):return m['models'][token]
add('bundle-sha',lambda m:m['sourceBundle'].update(sha256='0'*64))
add('bundle-bytes',lambda m:m['sourceBundle'].update(bytes=1))
add('bundle-md5',lambda m:m['sourceBundle'].update(md5='0'*32))
add('resource-version',lambda m:m['sourceBundle'].update(resourceVersion='different'))
add('source-path',lambda m:m['sourceBundle'].update(path='different.ab'))
add('source-url',lambda m:m['sourceBundle'].update(url='https://example.invalid/'))
add('invented-alpha-merge',lambda m:m['sourceBundle'].update(transforms=['Split alpha merged']))
add('foundation-sha',lambda m:m['foundation'].update(sha256='0'*64))
add('avatar-pin',lambda m:m['avatarSource'].update(commit='0'*40))
add('missing-model',lambda m:m['models'].pop(token))
add('invented-facings',lambda m:model(m).update(facings={'front':copy.deepcopy(model(m))}))
add('wrong-skeleton-id',lambda m:model(m)['originalPathIds'].update(textAssetPathId='1'))
add('invented-alpha-texture',lambda m:model(m)['originalPathIds'].update(alphaTexturePathId='1'))
add('wrong-main-texture',lambda m:model(m)['originalPathIds'].update(rgbTexturePathId='1'))
add('wrong-material-id',lambda m:model(m)['originalPathIds'].update(materialPathId='1'))
add('wrong-texture-size',lambda m:model(m).update(textureDimensions=[256,256]))
add('wrong-alpha-mode',lambda m:model(m)['materialFloats'].update(_UseAlphaTex=1))
add('wrong-straight-alpha',lambda m:model(m)['materialFloats'].update(_StraightAlphaInput=1))
add('wrong-directory',lambda m:model(m).update(directory='elsewhere'))
add('invented-idle',lambda m:model(m)['animationRoles'].update(idle='Idle'))
add('wrong-death',lambda m:model(m)['animationRoles'].update(die='End'))
add('wrong-skill',lambda m:model(m)['animationRoles'].update(skill='Skill_2_Loop'))
add('changed-attack-event',lambda m:model(m)['eventPayloads']['Attack'][0].update(time=0))
add('invented-waste-duration',lambda m:model(m)['durations'].update(Waste=1))
add('invented-rest-duration',lambda m:model(m)['durations'].update(Idle_2=1))
add('changed-idle-alias',lambda m:model(m)['nativeAnimationAliases'].update(Idle='Idle'))
add('changed-native-binding',lambda m:model(m)['nativeAnimationBindings'][1].update(animKey='Born'))
add('changed-file-sha',lambda m:model(m)['files']['avatar.png'].update(sha256='0'*64))
add('missing-avatar',lambda m:model(m)['files'].pop('avatar.png'))
add('wrong-spine-version',lambda m:model(m).update(spineVersion='4.0.0'))
for name,change in checks:
 altered=copy.deepcopy(metadata);change(altered);p=cases/(name+'.json');p.write_text(json.dumps(altered))
 proc=subprocess.run([str(root/'.cache/map-env/bin/python'),str(root/'tools/arkpedia/verify-mitm-models.py'),'--metadata',str(p)],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 assert proc.returncode!=0,name
 assert 'AssertionError' in proc.stdout,name+': unexpected execution failure'
 print('Rejected',name,flush=True)
print('Rejected',len(checks),'altered native-art fixtures',flush=True)
