#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Original trail/force typetrees, independent curve impulses and ribbon attributes.

The numerical trail probe is explicitly synthetic motion, not native physics.
Actual original physics/material/GPU playback is checked separately in-browser.
"""
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
META=ROOT/'data/arkpedia-particle-trails.json';FIXTURE=ROOT/'test/fixtures/arkpedia-particle-trails.json'
SAMPLES=ROOT/'.cache/arkpedia/lappland-alter-source/particle-trail-samples.json'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def normalize(t):
    if isinstance(t,dict): return {k:str(v) if k=='m_PathID' else normalize(v) for k,v in t.items()}
    if isinstance(t,list): return [normalize(v) for v in t]
    if isinstance(t,float) and not math.isfinite(t): return 'Infinity' if t>0 else '-Infinity' if t<0 else 'NaN'
    return t


def random(identity,salt):
    h=(((identity+1)^1)*0x45d9f3b&0xffffffff)^((salt+1)*0x27d4eb2d&0xffffffff)
    h=((h^(h>>16))*0x45d9f3b)&0xffffffff
    return (h^(h>>16))/0x100000000


def polynomial(curve):
    keys=curve['m_Curve'];assert len(keys)==2 and keys[0]['time']==0 and keys[1]['time']==1 and all(k['weightedMode']==0 for k in keys)
    a,b=keys;y0,y1=a['value'],b['value'];m0,m1=a['outSlope'],b['inSlope']
    return [2*y0-2*y1+m0+m1,-3*y0+3*y1-2*m0-m1,m0,y0]


def evaluate(curve,t,f=.5):
    mode=curve['minMaxState']
    if mode==0: return curve['scalar']
    if mode==3: return curve['minScalar']+(curve['scalar']-curve['minScalar'])*f
    assert mode==1
    a,b,c,d=polynomial(curve['maxCurve']);return ((a*t+b)*t+c)*t+d if curve['scalar']==1 else (((a*t+b)*t+c)*t+d)*curve['scalar']


def integral(curve,lo,hi,f):
    if curve['minMaxState'] in [0,3]: return evaluate(curve,0,f)*(hi-lo)
    a,b,c,d=polynomial(curve['maxCurve']);return curve['scalar']*(a*(hi**4-lo**4)/4+b*(hi**3-lo**3)/3+c*(hi**2-lo**2)/2+d*(hi-lo))


def gradient(curve,t):
    if curve['minMaxState']==0:return [curve['maxColor'][k] for k in ['r','g','b','a']]
    assert curve['minMaxState']==1;g=curve['maxGradient'];out=[]
    for channel in ['r','g','b','a']:
        alpha=channel=='a';kind='a' if alpha else 'c';count=g['m_NumAlphaKeys' if alpha else 'm_NumColorKeys']
        rows=[(g[f'{kind}time{i}']/65535,g[f'key{i}'][channel]) for i in range(count)]
        if t<=rows[0][0]:out.append(rows[0][1]);continue
        if t>=rows[-1][0]:out.append(rows[-1][1]);continue
        left,right=next((rows[i],rows[i+1]) for i in range(len(rows)-1) if rows[i][0]<=t<rows[i+1][0])
        u=0 if g['m_Mode']==1 else (t-left[0])/(right[0]-left[0]);out.append(left[1]+(right[1]-left[1])*u)
    return out


def near(a,b): assert math.isclose(a,b,rel_tol=1e-9,abs_tol=1e-9),(a,b)


def build(): subprocess.run(['node','tools/arkpedia/export-particle-trails.mjs'],cwd=ROOT,check=True,capture_output=True)


build();expected,sources={},{}
for name,bundle in [('tragodia','phatm2'),('lappland-alter','whitw2')]:
    directory=ROOT/('.cache/arkpedia/'+name+'-source');raw=(directory/'effects/native-effects.bin').read_bytes();pack=json.loads(gzip.decompress(raw))
    meta=json.loads((ROOT/('data/arkpedia-'+('lappland' if name=='lappland-alter' else name)+'-effects.json')).read_bytes());assert sha(raw)==meta['pack']['sha256']
    originals={o.path_id:o for o in UnityPy.load(str(directory/(bundle+'-effects.ab'))).objects}
    sources[name]={'operator':pack['operator'],'version':pack['version'],'sourcePackSha256':sha(raw)}
    for key,r in pack['records'].items():
        if r['type']!='ParticleSystem' or not(r['data']['TrailModule']['enabled'] or r['data']['ForceModule']['enabled']):continue
        obj=originals[int(key.rsplit(':',1)[1])];s=normalize(obj.read_typetree());assert s==r['data']
        go=next(ref['target'] for ref in r['references'] if ref['field']=='m_GameObject')
        expected[key]={'source':name,'name':pack['records'][go]['data']['m_Name'],'data':s,'serializedSha256':sha(obj.get_raw_data())}


def verify(rows,meta,samples):
    assert rows==expected and meta['sources']==sources and len(rows)==29 and set(samples)==set(rows)
    assert meta['scope']=={'localParticleTrails':True,'localForceBeforeDamping':True,'syntheticAuditMotion':True,'nativeRngVerified':False,'compiledFrameParity':False,'enabledOperators':[]}
    force_values=trail_values=vertices=0
    for key,row in rows.items():
        s=row['data'];r=samples[key]
        if s['ForceModule']['enabled']:
            assert len(r['forces'])==3
            for case in r['forces']:
                p=case['particle'];assert p=={'id':3,'lifetime':2} and case['from']==0
                for i,axis in enumerate(['x','y','z']):
                    want=p['lifetime']*integral(s['ForceModule'][axis],case['from']/p['lifetime'],case['to']/p['lifetime'],random(p['id'],40+i))
                    near(case['impulse'][i],want);force_values+=1
        if not s['TrailModule']['enabled']:continue
        m=s['TrailModule'];assert len(r['trails'])==3
        for case in r['trails']:
            time=case['time'];data=case['data'];births={b['id']:b for b in case['births']};offset=0
            for trail in data['trails']:
                birth=births[trail['id']];near(birth['lifetime'],evaluate(s['InitialModule']['startLifetime'],(birth['born']%s['lengthInSec'])/s['lengthInSec'],random(birth['id'],0)))
                near(trail['death'],birth['birthTime']+birth['lifetime']/s['simulationSpeed']);assert trail['alive']==(time<trail['death'])
                assert trail['alive'] or not m['dieWithParticles']
                for point,world in zip(trail['points'],trail['world']):
                    near(point['expires']-point['time'],evaluate(m['lifetime'],0,random(birth['id'],71))*birth['lifetime']/s['simulationSpeed']);assert point['expires']>time
                    near(world[0],(point['time']-birth['birthTime'])*s['simulationSpeed']*5);near(world[1],birth['id']*.01);near(world[2],0);trail_values+=4
                lengths=[0]
                for i in range(1,len(trail['world'])):lengths.append(lengths[-1]+math.dist(trail['world'][i-1],trail['world'][i]))
                total=lengths[-1]
                if len(trail['widths'])==0:continue
                for i,(point,width,color) in enumerate(zip(trail['world'],trail['widths'],trail['colors'])):
                    u=lengths[i]/total;near(width,evaluate(m['widthOverTrail'],u,random(birth['id'],73))*(.75 if m['sizeAffectsWidth'] else 1))
                    age=min(1,(time-birth['birthTime'])*s['simulationSpeed']/birth['lifetime']);a=gradient(m['colorOverLifetime'],age);b=gradient(m['colorOverTrail'],u)
                    for c in range(4):near(color[c],a[c]*b[c]*([1,.5,.25,.8][c] if m['inheritParticleColor'] else 1));trail_values+=1
                    base=offset+i*6
                    for c in range(3):near((data['positions'][base+c]+data['positions'][base+3+c])/2,point[c]);trail_values+=1
                    near(math.dist(data['positions'][base:base+3],data['positions'][base+3:base+6]),width)
                    uv=base//3*2;assert data['uvs'][uv:uv+4]==[u,0,u,1]
                    for c in range(4):near(data['colors'][base//3*4+c],color[c]);trail_values+=1
                    vertices+=2
                offset+=len(trail['widths'])*6
            assert offset==len(data['positions'])
    assert meta['counts']=={'sourceParticles':29,'trails':16,'forces':21,'forceImpulses':63,'trailSamples':48}
    return force_values,trail_values,vertices


rows,meta,samples=[json.loads(p.read_bytes()) for p in [FIXTURE,META,SAMPLES]];values=verify(rows,meta,samples)
for p,field in [(FIXTURE,'fixture'),(SAMPLES,'samples')]:
    raw=p.read_bytes();assert meta[field]=={'path':str(p.relative_to(ROOT)),'bytes':len(raw),'sha256':sha(raw)}
before=[sha(p.read_bytes()) for p in [META,FIXTURE,SAMPLES]];build();assert [sha(p.read_bytes()) for p in [META,FIXTURE,SAMPLES]]==before
mutations=[];force=next(k for k,v in samples.items() if 'forces' in v);trail=next(k for k,v in samples.items() if 'trails' in v and v['trails'][1]['data']['positions'])
for field in ['nativeRngVerified','compiledFrameParity']:
    a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);b['scope'][field]=True;mutations.append((a,b,c))
for field in ['ratio','dieWithParticles','minVertexDistance']:
    a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);a[trail]['data']['TrailModule'][field]=999;mutations.append((a,b,c))
a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);c[force]['forces'][0]['impulse'][0]+=.1;mutations.append((a,b,c))
for field in ['positions','colors','uvs']:
    a,b,c=copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples);c[trail]['trails'][1]['data'][field][0]+=.1;mutations.append((a,b,c))
for candidate in mutations:
    try:verify(*candidate)
    except AssertionError:pass
    else:raise AssertionError('Altered trail/force evidence accepted')
print(json.dumps({**meta['counts'],'forceValues':values[0],'trailValues':values[1],'vertices':values[2],'reproducibleOutputs':3,'rejectedAlteredEvidence':len(mutations),'syntheticAuditMotion':True}))
