import copy,json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'.cache/arkpedia/stainless-source/device-art'
metadata=json.loads((out/'sources.json').read_text());cases=out/'negative-fixtures';cases.mkdir(exist_ok=True)
for token in metadata['models']:
 link=cases/token
 if not link.exists():link.symlink_to(out/token,target_is_directory=True)
checks=[]
def add(name,change):checks.append((name,change))
def single(m):return m['models']['token_10027_ironmn_pile1']
def turret(m):return m['models']['token_10027_ironmn_pile3']['facings']
add('bundle-sha',lambda m:m['sourceBundle'].update(sha256='0'*64))
add('bundle-bytes',lambda m:m['sourceBundle'].update(bytes=1))
add('bundle-md5',lambda m:m['sourceBundle'].update(md5='0'*32))
add('resource-version',lambda m:m['sourceBundle'].update(resourceVersion='different'))
add('source-path',lambda m:m['sourceBundle'].update(path='different.ab'))
add('foundation-sha',lambda m:m['foundation'].update(sha256='0'*64))
add('avatar-pin',lambda m:m['avatarSource'].update(commit='0'*40))
add('missing-platform',lambda m:m['models'].pop('token_10027_ironmn_pile2'))
add('missing-down',lambda m:turret(m).pop('down'))
add('invented-up',lambda m:turret(m).update(up=copy.deepcopy(turret(m)['front'])))
add('wrong-skeleton-id',lambda m:single(m)['originalPathIds'].update(textAssetPathId='1'))
add('wrong-alpha-id',lambda m:single(m)['originalPathIds'].update(alphaTexturePathId='1'))
add('wrong-material-id',lambda m:single(m)['originalPathIds'].update(materialPathId='1'))
add('wrong-texture-size',lambda m:single(m).update(textureDimensions=[1,1]))
add('missing-material-alpha',lambda m:single(m)['materialFloats'].update(_UseAlphaTex=0))
add('wrong-single-directory',lambda m:single(m).update(directory='elsewhere'))
add('swapped-down',lambda m:turret(m).update(down=copy.deepcopy(turret(m)['front'])))
add('invented-platform-attack',lambda m:single(m)['animationRoles'].update(attack='Attack'))
add('wrong-platform-death',lambda m:single(m)['animationRoles'].update(die='Die'))
add('invented-turret-skill',lambda m:turret(m)['down']['animationRoles'].update(skill='Skill'))
add('changed-turret-event',lambda m:turret(m)['back']['eventPayloads']['Attack'][0].update(time=0))
add('changed-platform-duration',lambda m:single(m)['durations'].update(Start=0))
add('changed-platform-alias',lambda m:single(m)['nativeAnimationAliases'].update(Die='Die'))
add('changed-native-binding',lambda m:single(m)['nativeAnimationBindings'][1].update(animName='Idle'))
add('changed-file-sha',lambda m:single(m)['files']['avatar.png'].update(sha256='0'*64))
add('missing-avatar',lambda m:single(m)['files'].pop('avatar.png'))
add('wrong-spine-version',lambda m:single(m).update(spineVersion='4.0.0'))
for name,change in checks:
 altered=copy.deepcopy(metadata);change(altered);p=cases/(name+'.json');p.write_text(json.dumps(altered))
 proc=subprocess.run([str(root/'.cache/map-env/bin/python'),str(root/'tools/arkpedia/verify-stainless-models.py'),'--metadata',str(p)],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 assert proc.returncode!=0,name
 print('Rejected',name,flush=True)
print('Rejected',len(checks),'altered device-art fixtures',flush=True)
