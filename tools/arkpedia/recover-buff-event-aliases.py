#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Corroborate numeric native buff events with unchanged named source actions.

This recovers serialized aliases only; no compiled dispatcher or support grant.
Only the assembly suffix of $type is normalized. Every other action field must
match at the same template key, with exactly one named event, and all matching
templates must agree on the alias. Retain three independent witnesses per event.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401,E402
import UnityPy  # noqa: E402
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true')
mode=parser.add_mutually_exclusive_group()
mode.add_argument('--war-caster',action='store_true',help='Retain the separate War Caster modifier aliases')
mode.add_argument('--firewall-boss',action='store_true',help='Retain the separate fatal-attempt and root-tile aliases')
args=parser.parse_args()
cache=ROOT/'.cache/arkpedia/cn-native-source'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
inventory_raw=(ROOT/'data/arkpedia-cn-native-source.json').read_bytes()
inventory=json.loads(inventory_raw)
manifest_raw=(cache/'hot_update_list.json').read_bytes()
assert sha(manifest_raw)==inventory['source']['manifestSha256']
bundle='config/buff_template_holder.ab'
pin=next(b for b in json.loads(manifest_raw)['abInfos'] if b['name']==bundle)
native_raw=(cache/'bundles'/bundle).read_bytes()
assert len(native_raw)==pin['abSize'] and hashlib.md5(native_raw).hexdigest()==pin['md5']
retained=next((b for b in inventory['bundles'] if b['path']==bundle),None)
if retained is not None:assert sha(native_raw)==retained['sha256']
named_pin=json.loads((ROOT/'data/arkpedia-mvp.json').read_bytes())['behaviors']['source']
named_raw=(ROOT/'.cache/arkpedia/buff_template_data.json').read_bytes()
assert sha(named_raw)==named_pin['sha256']
named=json.loads(named_raw)
def normalize(value):
    # Python equates True with1; JSON action fields must retain that distinction.
    if isinstance(value,bool):return ('boolean',value)
    if isinstance(value,dict):
        return {k:(v.split(',')[0] if k=='$type' else normalize(v)) for k,v in value.items()}
    if isinstance(value,list):return [normalize(v) for v in value]
    return value

wanted={0:'ON_BUFF_START',1:'ON_BUFF_FINISH',2:'ON_BUFF_TRIGGER',3:'ON_OWNER_KILLED',25:'ON_BUFF_DISABLE'}
if args.war_caster:wanted={10:'ON_TAKE_DAMAGE',61:'ON_BEFORE_TARGET_APPLY_MODIFIER'}
if args.firewall_boss:wanted={27:'ON_BEFORE_TRY_SET_HP_ZERO',44:'ON_OWNER_ROOT_TILE_CHANGED'}
matches={key:[] for key in wanted}
for obj in UnityPy.load(native_raw).objects:
    if obj.type.name!='MonoBehaviour':continue
    for template in obj.read_typetree().get('_templates',[]):
        key=template['templateKey']
        other=named.get(key,{}).get('eventToActions',{})
        for event in template['eventToActions']['_items']:
            number=event['key']
            if number not in wanted:continue
            state=event['value']['SerializedState']
            actions=normalize(json.loads(state))
            names=[name for name,nodes in other.items() if normalize(nodes)==actions]
            if len(names)!=1:continue
            assert names[0]==wanted[number],(number,key,names)
            matches[number].append({'template':key,'numeric':number,'name':names[0],
                'nativeActionsJson':state,'namedActions':other[names[0]]})

events={}
for number,name in wanted.items():
    witnesses=sorted(matches[number],key=lambda r:r['template'])
    assert len({r['template'] for r in witnesses})>=3,(number,len(witnesses))
    selected=[]
    for witness in witnesses:
        if witness['template'] not in {s['template'] for s in selected}:selected.append(witness)
        if len(selected)==3:break
    events[str(number)]={'name':name,'matchingTemplates':len(witnesses),'witnesses':selected}
out={'schemaVersion':1,'scope':'Serialized numeric buff-event alias facts only; no compiled dispatch, frame parity or enemy/operator support.',
    'source':{'nativeInventory':{'path':'data/arkpedia-cn-native-source.json','sha256':sha(inventory_raw)},
        'manifestSha256':sha(manifest_raw),'nativeBundle':{'path':bundle,'bytes':len(native_raw),'md5':pin['md5'],'sha256':sha(native_raw)},
        'namedTemplates':named_pin},
    'normalization':'Only the assembly suffix after the first comma in $type is removed. All other action fields and list order match exactly at the same template key.',
    'events':events}
text=json.dumps(out,ensure_ascii=False,indent=2)+'\n'
target=ROOT/'data/candidates/arkpedia-buff-event-alias-source.json'
if args.war_caster:target=ROOT/'data/candidates/arkpedia-war-caster-event-alias-source.json'
if args.firewall_boss:target=ROOT/'data/candidates/arkpedia-firewall-boss-event-alias-source.json'
if args.check:assert target.read_text(encoding='utf8')==text,'Native/named alias evidence changed'
else:target.write_text(text,encoding='utf8',newline='\n')
print('Verified',len(events),'numeric buff-event aliases with',sum(len(e['witnesses']) for e in events.values()),'independent witnesses')
