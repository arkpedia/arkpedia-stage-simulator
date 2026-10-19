#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check every authored lifetime/simulation-speed bound against original Unity fields."""
import gzip
import hashlib
import json
from pathlib import Path
from native_effect_verify import UnityPy, normalized
ROOT=Path(__file__).resolve().parents[2];sha=lambda b:hashlib.sha256(b).hexdigest()
meta=json.loads((ROOT/'data/arkpedia-aphrissa-effects.json').read_bytes())
retirement=json.loads((ROOT/'data/arkpedia-aphrissa-retirement.json').read_bytes())
raw=(ROOT/'.cache/arkpedia/aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(raw)==meta['pack']['sha256']==retirement['sourcePackSha256'];pack=json.loads(gzip.decompress(raw));loaded={};checked=set()
def original(record):
    path=record['bundle']
    if path not in loaded:
        entry=next(e for e in meta['sources'] if e['path']==path);raw=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/path).read_bytes()
        assert len(raw)==entry['bytes'] and sha(raw)==entry['sha256'];loaded[path]={o.path_id:o for o in UnityPy.load(raw).objects}
    obj=loaded[path][int(record['pathId'])];assert obj.type.name==record['type'];return obj.read_typetree()
assert retirement['schemaVersion']==1 and retirement['operator']==pack['operator']=='char_4229_aphris'
assert set(retirement['roots'])==set(pack['roots'])
for root,root_id in pack['roots'].items():
    todo=[root_id];seen=set();systems=[];nonparticle=[];effects=[]
    while todo:
        key=todo.pop()
        if key in seen:continue
        seen.add(key);record=pack['records'][key]
        if record['type']=='ParticleSystem':
            d=original(record);assert normalized(d['InitialModule']['startLifetime'])==record['data']['InitialModule']['startLifetime']
            assert d['simulationSpeed']==record['data']['simulationSpeed'];systems.append((key,d));checked.add(key)
        if record['type'] in ['MeshRenderer','LineRenderer','TrailRenderer']:nonparticle.append(key)
        if record['type']=='MonoBehaviour' and '_delayToFinish' in record['data'] and record['data']['m_GameObject']['m_PathID']==pack['records'][root_id]['pathId']:
            d=original(record);assert d['_delayToFinish']==record['data']['_delayToFinish'];effects.append(d)
        for ref in record.get('references',[]):
            if ref['field'] in ['component','m_Children','m_GameObject']:todo.append(ref['target'])
    assert len(effects)==1;bound=0;witnesses=[]
    for key,d in systems:
        c=d['InitialModule']['startLifetime'];assert c['minMaxState'] in [0,3] and d['simulationSpeed']>0
        upper=(max(c['scalar'],c['minScalar']) if c['minMaxState']==3 else c['scalar'])/d['simulationSpeed']
        if upper>bound:bound=upper;witnesses=[]
        if upper==bound:witnesses.append({'particle':key,'simulationSpeed':d['simulationSpeed'],'startLifetime':normalized(c)})
    expected=retirement['roots'][root];derived=any(d.get('SubModule',{}).get('enabled') or d.get('TrailModule',{}).get('enabled') for _,d in systems)
    assert expected['particleSystems']==len(systems) and expected['nonParticleRenderers']==len(nonparticle)
    assert expected['derivedEmission']==derived and expected['lifetimeBound']==bound
    assert expected['finishDelay']==effects[0]['_delayToFinish'] and expected['drainBound']==bound+effects[0]['_delayToFinish']
    assert expected['particleDrainSupported']==bool(systems and not nonparticle and not derived)
    assert sorted(expected['witnesses'],key=lambda r:r['particle'])==sorted(witnesses,key=lambda r:r['particle'])
assert retirement['scope']=={'originalLifetimeBounds':True,'includesInactiveHelpers':True,'emissionHalfOpen':True,
    'nativeFinishDispatchVerified':False,'nativeGeometryRetirementVerified':False,'enabledOperators':[]}
print(json.dumps({'roots':len(pack['roots']),'originalParticleSystems':len(checked),'originalBundleHashes':len(loaded),'nativeFinishDispatchVerified':False}))
