#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Read the six attack-to-hit bindings and three hit roots from original Unity objects."""
import gzip
import hashlib
import json
from pathlib import Path
from native_effect_verify import UnityPy, normalized

ROOT=Path(__file__).resolve().parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(ROOT/'data/arkpedia-native-operators/char_4229_aphris.json').read_bytes()
assert sha(raw)=='77207d3d44737940e6bc4aee4a4a57abea27a1490d3870168e9f1615527ca254'
foundation=json.loads(raw);meta=json.loads((ROOT/'data/arkpedia-aphrissa-effects.json').read_bytes())
packed=(ROOT/'.cache/arkpedia/aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(packed)==meta['pack']['sha256'];pack=json.loads(gzip.decompress(packed));loaded={}

def objects(entry):
    path=entry['path']
    if path not in loaded:
        raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/path).read_bytes()
        assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256']
        loaded[path]={o.path_id:o for o in UnityPy.load(raw).objects}
    return loaded[path]

character=next(e for e in foundation['source']['bundles'] if e['path']=='charpack/char_4229_aphris.ab')
skills=next(e for e in foundation['source']['bundles'] if e['path']=='battle/prefabs/[uc]skills.ab')
bindings=[('normal',character,'characters','char_4229_aphris','-4640825836822405026','6903743400835014750','aphris_attack_01_hit_01'),
 ('s1',character,'characters','char_4229_aphris','9032629320545853534','4019066212480311390','aphris_attack_01_hit_01'),
 ('s1Down',character,'characters','char_4229_aphris','-4883224602541891490','4334789313534025822','aphris_attack_01_hit_01'),
 ('s2',skills,'skills','skchr_aphris_2','-79185909474764066','7066443537034861278','aphris_skill_02_hit_01'),
 ('s3',character,'characters','char_4229_aphris','-2884652594386771874','-6379143078755770274','aphris_skill_03_hit_01'),
 ('s3Down',character,'characters','char_4229_aphris','2121442231411531870','-8304899188782800802','aphris_skill_03_hit_01')]
for mode,entry,group,key,attack_id,fx_id,root in bindings:
    original=objects(entry);exported={c['pathId']:c['data'] for row in foundation[group][key] for c in row['components']}
    attack=normalized(original[int(attack_id)].read_typetree());fx=normalized(original[int(fx_id)].read_typetree())
    assert attack==exported[attack_id] and fx==exported[fx_id]
    assert fx['m_GameObject']==attack['m_GameObject'] and fx['m_Enabled']==1
    assert fx['_hitEffects']==[{'_directionType':0,'_effects':[root],'_oneshot':1,'_endEvent':3,'_onlyOnce':0,
        '_useFourDirectionalFace':0,'_useOwnerToTargetDirection':0,'_playIfNotInputTarget':0,'_playOnlyIfInputTarget':0}]
    assert all(not fx[k] for k in ['_castEffects','_attachEffects','_inputTargetEffects','_castTargetEffects'])
    assert fx['_convertCastEndToAttachFinish']==fx['_recalculatePlaybackSpeed']==fx['_preDelayFactor']==0

for root in sorted({b[-1] for b in bindings}):
    root_id=pack['roots'][root];record=pack['records'][root_id]
    entry=next(e for e in meta['sources'] if e['path']==record['bundle']);original=objects(entry)
    assert normalized(original[int(record['pathId'])].read_typetree())==record['data']
    fx=[pack['records'][r['target']] for r in record['references'] if r['field']=='component'
        and pack['records'][r['target']]['type']=='MonoBehaviour']
    assert len(fx)==1
    assert normalized(original[int(fx[0]['pathId'])].read_typetree())==fx[0]['data']
    d=fx[0]['data'];assert d['_isLoop']==d['_holdByOwner']==d['_rotateType']==0
    assert d['_spawnLocation']==2 and d['_delayToFinish']==.5 and d['_maxLifetime']==-1
print(json.dumps({'bindings':len(bindings),'roots':3,'originalBundleHashes':len(loaded),'nativeDispatchVerified':False}))
