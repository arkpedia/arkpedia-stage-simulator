#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify original cone-volume controls and independent integrated volume law."""
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
META=ROOT/'data/arkpedia-cone-volumes.json';FIXTURE=ROOT/'test/fixtures/arkpedia-cone-volumes.json'
SAMPLES=ROOT/'.cache/arkpedia/lappland-alter-source/cone-volume-samples.json'


def sha(raw):return hashlib.sha256(raw).hexdigest()


def pointers(t):
    if isinstance(t,dict):return {k:str(v) if k=='m_PathID' else pointers(v) for k,v in t.items()}
    if isinstance(t,list):return [pointers(v) for v in t]
    return t


def build():subprocess.run(['node','tools/arkpedia/export-cone-volumes.mjs'],cwd=ROOT,check=True,capture_output=True)


build();expected,sources={},{}
for name,bundle in [('tragodia','phatm2'),('lappland-alter','whitw2')]:
    directory=ROOT/('.cache/arkpedia/'+name+'-source');raw=(directory/'effects/native-effects.bin').read_bytes();pack=json.loads(gzip.decompress(raw))
    meta=json.loads((ROOT/('data/arkpedia-'+('lappland' if name=='lappland-alter' else name)+'-effects.json')).read_bytes());assert sha(raw)==meta['pack']['sha256']
    originals={o.path_id:o for o in UnityPy.load(str(directory/(bundle+'-effects.ab'))).objects};sources[name]={'operator':pack['operator'],'version':pack['version'],'sourcePackSha256':sha(raw)}
    for key,r in pack['records'].items():
        if r['type']!='ParticleSystem' or not r['data']['ShapeModule']['enabled'] or r['data']['ShapeModule']['type']!=8:continue
        obj=originals[int(key.rsplit(':',1)[1])];shape=pointers(obj.read_typetree()['ShapeModule']);assert shape==r['data']['ShapeModule']
        go=next(ref['target'] for ref in r['references'] if ref['field']=='m_GameObject');expected[key]={'source':name,'name':pack['records'][go]['data']['m_Name'],'particleSha256':sha(obj.get_raw_data()),'shape':shape}


def near(a,b):assert math.isclose(a,b,rel_tol=1e-9,abs_tol=1e-9),(a,b)


def verify(rows,meta,samples):
    assert rows==expected and meta['sources']==sources and len(rows)==7
    assert meta['scope']=={'uniformFrustumVolume':True,'nativeEmissionParity':False,'compiledFrameParity':False,'enabledOperators':[]}
    held={k:'Native cone volume angle/length/arc needs review' for k,r in rows.items() if r['shape']['arc']['mode']!=0 or r['shape']['arc']['spread']!=0}
    assert meta['held']==held and set(samples)==set(rows)-set(held);values=0
    for key,cases in samples.items():
        s=rows[key]['shape'];radius,length=s['radius']['value'],s['length'];angle=math.radians(s['angle']);tangent=math.tan(angle);assert len(cases)==27
        for case in cases:
            x,y,z=[case['origin'][i]/s['m_Scale'][axis] for i,axis in enumerate(['x','y','z'])]
            volume=lambda h:radius**2*h+radius*tangent*h*h+tangent*tangent*h**3/3
            near(volume(z)/volume(length),case['depth']);outer=radius+z*tangent;inner=1-s['radiusThickness'];rho=math.sqrt(inner*inner+case['radial']*(1-inner*inner));phi=case['azimuth']*math.pi*2
            near(x,outer*rho*math.cos(phi));near(y,outer*rho*math.sin(phi));norm=math.hypot(rho*math.sin(angle),math.cos(angle))
            wanted=[rho*math.sin(angle)*math.cos(phi)/norm,rho*math.sin(angle)*math.sin(phi)/norm,math.cos(angle)/norm]
            for a,b in zip(case['direction'],wanted):near(a,b)
            near(math.hypot(*case['direction']),1);values+=7
    assert meta['counts']=={'profiles':7,'sampled':4,'held':3,'points':108};return values


rows,meta,samples=[json.loads(p.read_bytes()) for p in [FIXTURE,META,SAMPLES]];values=verify(rows,meta,samples)
for p,field in [(FIXTURE,'fixture'),(SAMPLES,'samples')]:
    raw=p.read_bytes();assert meta[field]=={'path':str(p.relative_to(ROOT)),'bytes':len(raw),'sha256':sha(raw)}
before=[sha(p.read_bytes()) for p in [META,FIXTURE,SAMPLES]];build();assert [sha(p.read_bytes()) for p in [META,FIXTURE,SAMPLES]]==before
mutations=[];key=next(iter(samples))
for field in ['nativeEmissionParity','compiledFrameParity']:
    a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);b['scope'][field]=True;mutations.append((a,b,c))
for field in ['angle','length','radiusThickness']:
    a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);a[key]['shape'][field]=999;mutations.append((a,b,c))
for index in [0,1,2]:
    a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);c[key][10]['origin'][index]+=.1;mutations.append((a,b,c))
for candidate in mutations:
    try:verify(*candidate)
    except AssertionError:pass
    else:raise AssertionError('Altered cone-volume evidence accepted')
print(json.dumps({**meta['counts'],'verifiedValues':values,'reproducibleOutputs':3,'rejectedAlteredEvidence':len(mutations),'nativeEmissionParity':False}))
