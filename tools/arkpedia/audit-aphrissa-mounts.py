#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently read default-skin muzzle pointers/followers from original Unity objects."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
from native_effect_verify import UnityPy, normalized

ROOT=Path(__file__).resolve().parents[2];ID='char_4229_aphris';PATH=ROOT/'data/arkpedia-aphrissa-mounts.json'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
original=PATH.read_bytes();foundation=(ROOT/f'data/arkpedia-native-operators/{ID}.json').read_bytes();source=json.loads(foundation)
assert sha(foundation)=='77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254'
model_raw=(ROOT/'data/arkpedia-aphrissa-review-models.json').read_bytes();models=json.loads(model_raw)
entry=next(e for e in source['source']['bundles'] if e['path']==f'chararts/{ID}.ab')
raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/entry['path']).read_bytes()
assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256'];env=UnityPy.load(raw);objects={o.path_id:o for o in env.objects}
controllers=[o for o in objects.values() if o.type.name=='MonoBehaviour' and '_front' in o.read_typetree() and '_back' in o.read_typetree()]
assert len(controllers)==1;controller=controllers[0];art=controller.read_typetree();expected={}
for face in ['Front','Back']:
    selected=art['_'+face.lower()];pointer=selected['muzzlaTransform'];assert pointer['m_FileID']==0
    transform=objects[pointer['m_PathID']];assert transform.type.name=='Transform';tree=transform.read_typetree()
    go=objects[tree['m_GameObject']['m_PathID']].read_typetree()
    followers=[objects[c['component']['m_PathID']] for c in go['m_Component']
               if objects[c['component']['m_PathID']].type.name=='MonoBehaviour' and 'boneName' in objects[c['component']['m_PathID']].read_typetree()]
    assert len(followers)==1;follower=followers[0];fields=follower.read_typetree()
    assert fields['skeletonRenderer']==selected['skeleton'];skeleton=objects[selected['skeleton']['m_PathID']].read_typetree()
    asset=objects[skeleton['skeletonDataAsset']['m_PathID']].read_typetree();text=objects[asset['skeletonJSON']['m_PathID']].read().m_Script
    text=text.encode('utf-8','surrogateescape') if isinstance(text,str) else bytes(text)
    key=f'operator/{ID}/default/{face.lower()}';assert models['models'][key]['skeleton']['sha256']==sha(text)
    ancestors=[];node=transform
    while True:
        data=node.read_typetree();name=objects[data['m_GameObject']['m_PathID']].read_typetree()['m_Name']
        ancestors.append({'pathId':str(node.path_id),'object':name,'data':normalized(data)})
        parent=data['m_Father'];assert parent['m_FileID']==0
        if not parent['m_PathID']:break
        node=objects[parent['m_PathID']];assert len(ancestors)<32
    expected[key]={'face':face,'bone':fields['boneName'],'controller':str(controller.path_id),'controllerField':'_'+face.lower()+'.muzzlaTransform',
                   'skeletonAnimation':str(selected['skeleton']['m_PathID']),'skeleton':{'bytes':len(text),'sha256':sha(text)},
                   'transform':str(transform.path_id),'follower':{'pathId':str(follower.path_id),'data':normalized(fields)},'ancestors':ancestors}

def verify(value):
    assert value['schemaVersion']==1 and value['operator']==ID
    assert value['foundation']=={'path':f'data/arkpedia-native-operators/{ID}.json','sha256':sha(foundation)}
    assert value['models']=={'path':'data/arkpedia-aphrissa-review-models.json','sha256':sha(model_raw),'commit':models['commit']}
    assert value['bindings']==expected
    assert value['scope']=={'sourceInputsOnly':True,'originalMuzzleBones':True,'nativeMountTypeMappingVerified':False,
                           'nativeDepthVerified':False,'nativeRotationVerified':False,'compiledFrameParity':False,'enabledOperators':[]}

meta=json.loads(original);verify(meta)
front=f'operator/{ID}/default/front';back=f'operator/{ID}/default/back'
cases=[(['operator'],'char_0_foreign'),(['foundation','sha256'],'0'*64),(['models','commit'],'main'),
       (['bindings',front,'bone'],'B_Muzzle'),(['bindings',back,'transform'],meta['bindings'][front]['transform']),
       (['bindings',front,'follower','data','followSkeletonFlip'],0),(['bindings',back,'follower','data','followBoneRotation'],0),
       (['bindings',front,'skeleton','sha256'],'0'*64),(['bindings',back,'skeletonAnimation'],0),
       (['bindings',front,'ancestors'],meta['bindings'][front]['ancestors'][:-1]),
       (['scope','nativeDepthVerified'],True),(['scope','nativeMountTypeMappingVerified'],True),
       (['scope','nativeRotationVerified'],True),(['scope','enabledOperators'],[ID])]
for path,value in cases:
    altered=copy.deepcopy(meta);target=altered
    for key in path[:-1]:target=target[key]
    target[path[-1]]=value
    try:verify(altered)
    except (AssertionError,KeyError,TypeError):pass
    else:raise AssertionError('Accepted altered muzzle evidence: '+'.'.join(path))
for _ in range(2):
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE','node'),'tools/arkpedia/aphrissa-mount-source.mjs','--write'],cwd=ROOT,check=True,capture_output=True)
    assert PATH.read_bytes()==original
print(json.dumps({'originalMuzzleBindings':len(expected),'originalTransforms':sum(len(b['ancestors']) for b in expected.values()),
                  'reproducedOutputs':2,'rejectedAlteredEvidence':len(cases),'nativeMountMappingVerified':False}))
