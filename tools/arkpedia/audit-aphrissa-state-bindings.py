#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently read state buff actions, special points and source FX controllers."""
import gzip
import hashlib
import json
from pathlib import Path
from native_effect_verify import UnityPy, normalized
ROOT=Path(__file__).resolve().parents[2];ID='char_4229_aphris';sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(ROOT/f'data/arkpedia-native-operators/{ID}.json').read_bytes()
assert sha(raw)=='77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254'
foundation=json.loads(raw);meta=json.loads((ROOT/'data/arkpedia-aphrissa-effects.json').read_bytes())
packed=(ROOT/'.cache/arkpedia/aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(packed)==meta['pack']['sha256'];pack=json.loads(gzip.decompress(packed));loaded={}
def objects(path):
    if path not in loaded:
        entry=next(e for e in foundation['source']['bundles']+meta['sources'] if e['path']==path)
        raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/path).read_bytes()
        assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256']
        loaded[path]={o.path_id:o for o in UnityPy.load(raw).objects}
    return loaded[path]

skills=objects('battle/prefabs/[uc]skills.ab')
for key,id in [('skchr_aphris_1','8448894366941586557'),('skchr_aphris_3','875698991745679599'),
               ('skchr_aphris_3','-2229608371374374673'),('skchr_aphris_3','-5427451279434235665')]:
    exported=next(c['data'] for row in foundation['skills'][key] for c in row['components'] if c['pathId']==id)
    assert normalized(skills[int(id)].read_typetree())==exported

# The serialized DB uses numeric event keys. Retain them in this audit;
# matching exported labels does not execute those native events.
templates=objects('config/buff_template_holder.ab');db=next(o.read_typetree()['_templates'] for o in templates.values()
    if o.type.name=='MonoBehaviour' and '_templates' in o.read_typetree())
event_keys={0:'ON_BUFF_START',1:'ON_BUFF_FINISH'}
for key in ['aphris_sk3[charge-vfx]','aphris_sk3[wing-vfx]','aphris_sk3_finishvfx']:
    original=next(row for row in db if row['templateKey']==key);exported=foundation['templates'][key]
    assert original['effectKey']==exported['effectKey']=='' and original['onEventPriority']==0
    assert len(original['eventToActions']['_items'])==1
    for event in original['eventToActions']['_items']:
        source_actions=json.loads(event['value']['SerializedState']);assert not event['value']['SerializedObjectReferences']
        actions=exported['eventToActions'][event_keys[event['key']]]
        assert len(source_actions)==len(actions)
        for source,action in zip(source_actions,actions):
            action=dict(action);action['$type']=action['$type'].split(',')[0];assert source==action

art=objects(f'chararts/{ID}.ab');controller=foundation['chararts'][ID][0]
assert normalized(art[int(controller['pathId'])].read_typetree())==controller['data'];mounts=0
for face in ['front','back']:
    selected=controller['data']['_'+face]
    for field in ['specialPoint0','specialPoint1']:
        pointer=selected[field];assert pointer['m_FileID']==0
        transform=art[int(pointer['m_PathID'])].read_typetree();go=art[transform['m_GameObject']['m_PathID']].read_typetree()
        follower=next(art[c['component']['m_PathID']] for c in go['m_Component']
            if art[c['component']['m_PathID']].type.name=='MonoBehaviour' and 'boneName' in art[c['component']['m_PathID']].read_typetree())
        expected=next(c['data'] for row in foundation['artworkHierarchy'][ID] for c in row['components'] if c['pathId']==str(follower.path_id))
        data=normalized(follower.read_typetree());assert data==expected
        assert data['skeletonRenderer']==selected['skeleton'] and data['followBoneRotation']==0
        assert data['boneName']==('C_Drone_B2' if field=='specialPoint1' else 'F_Chest' if face=='front' else 'B_Chest3')
        mounts+=1

roots=['aphris_skill_01_buff_01','aphris_skill_03_charge_01','aphris_skill_03_charge_01_end',
       'aphris_skill_03_buff_01','aphris_skill_03_buff_02_front','aphris_skill_03_buff_02_back']
checked=set()
for root in roots:
    todo=[pack['roots'][root]];seen=set()
    while todo:
        key=todo.pop()
        if key in seen:continue
        seen.add(key);record=pack['records'][key]
        if record['type'] in ['GameObject','Transform','MonoBehaviour','Animator','Animation','AnimatorController']:
            native=objects(record['bundle'])[int(record['pathId'])]
            assert native.type.name==record['type'] and normalized(native.read_typetree())==record['data'],key
            checked.add(key)
        for ref in record.get('references',[]):
            if ref['field'] in ['component','m_Children','m_GameObject','m_Controller']:todo.append(ref['target'])
print(json.dumps({'sourceBuffComponents':4,'serializedTemplates':3,'specialPointFollowers':mounts,'effectRoots':len(roots),
    'originalHierarchyAndControllerObjects':len(checked),'originalBundleHashes':len(loaded),'compiledDispatchVerified':False}))
