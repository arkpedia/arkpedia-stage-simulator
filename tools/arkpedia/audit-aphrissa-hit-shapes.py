#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Native hit-source inventory and independent burst/hemisphere birth geometry."""
import copy
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia'
FILES = [ROOT / 'data/arkpedia-aphrissa-hit-shapes.json', ROOT / 'test/fixtures/arkpedia-aphrissa-hit-shapes.json',
         CACHE / 'aphrissa-source/effects/hit-shape-samples.json']
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def module(name,file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    m = importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m


curves = module('hit_curve_reference','audit-lappland-particle-curves.py')
random_factor = module('hit_rng_reference','audit-lappland-moving-particles.py').random_factor


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE','node'),'tools/arkpedia/export-aphrissa-hit-shapes.mjs'],cwd=ROOT,check=True,capture_output=True)


build();before = [sha(p.read_bytes()) for p in FILES]
meta,rows,probes = [json.loads(p.read_bytes()) for p in FILES]
source = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
raw = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(raw) == source['pack']['sha256'];pack = json.loads(gzip.decompress(raw))
reference = {'repository':'Unity-Technologies/UnityCsReference','commit':'b052b1fe38b45d5aefa609a115c626ed2e74f3a6',
    'files':[{'path':'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs','bytes':14635,
              'sha256':'cc34dc3bfc5e8abcf7f2654ac37bbdec2709728bcd604918cf55919b980cdb93'}]}
enum = (CACHE / 'unity-builtin-source/mesh-alignment-reference/ParticleSystemEnums.cs').read_bytes()
assert len(enum) == 14635 and sha(enum) == reference['files'][0]['sha256']
for name,members in [('ParticleSystemShapeType',{'Hemisphere':2,'Cone':4}),('ParticleSystemShapeMultiModeValue',{'BurstSpread':3})]:
    body = re.search(r'enum\s+'+name+r'\s*\{([^}]+)\}',enum.decode()).group(1)
    for member,value in members.items(): assert re.search(r'\b'+member+r'\s*=\s*'+str(value)+r'\b',body)
entry = next(e for e in source['sources'] if e['path'] == 'battle/prefabs/effects/aphris.ab')
bundle = (CACHE / 'cn-native-source/bundles' / entry['path']).read_bytes()
assert len(bundle) == entry['bytes'] and sha(bundle) == entry['sha256']
env = UnityPy.load(bundle);assert len(env.assets) == 1;native = env.assets[0].objects;expected = {}
for key,r in pack['records'].items():
    if r['type'] != 'ParticleSystem' or r['bundle'] != entry['path']: continue
    obj = native[int(r['pathId'])];s = obj.read_typetree();h = s['ShapeModule']
    hemisphere = h['enabled'] and h['type'] == 2
    burst = h['enabled'] and h['type'] == 4 and h['arc']['mode'] == 3
    point = not h['enabled'] and not s['EmissionModule']['enabled'] and s['InitialModule']['startSpeed']['minMaxState'] == 0 and s['InitialModule']['startSpeed']['scalar'] == 5 and not any(s[k]['enabled'] for k in ['VelocityModule','UVModule','ClampVelocityModule','NoiseModule','InheritVelocityModule','ForceModule'])
    if not (hemisphere or burst or point): continue
    go = native[s['m_GameObject']['m_PathID']];g = go.read_typetree()
    components = [native[c['component']['m_PathID']] for c in g['m_Component']]
    renderer = next((o for o in components if o.type.name == 'ParticleSystemRenderer'),None)
    if renderer is None or not renderer.read_typetree()['m_Enabled']: continue
    tr = next(o for o in components if o.type.name == 'Transform')
    while tr.read_typetree()['m_Father']['m_PathID']: tr = native[tr.read_typetree()['m_Father']['m_PathID']]
    root = entry['path']+':'+str(tr.read_typetree()['m_GameObject']['m_PathID'])
    assert normalized(s) == r['data'] and sha(obj.get_raw_data()) == r['serializedSha256']
    expected[key] = {'root':next(k for k,v in pack['roots'].items() if v == root),
        'kind':'hemisphere' if hemisphere else 'burstSpread' if burst else 'dormantPoint','name':g['m_Name'],
        'serializedSha256':sha(obj.get_raw_data()),'data':normalized(s),'gameObjectActive':g['m_IsActive'],
        'gameObjectSha256':sha(go.get_raw_data()),'renderer':entry['path']+':'+str(renderer.path_id),
        'rendererSha256':sha(renderer.get_raw_data())}


def samples(row,seed,time):
    s = row['data'];e = s['EmissionModule'];i = s['InitialModule'];shape = s['ShapeModule']
    if row['kind'] == 'dormantPoint':
        assert not e['enabled'];return []
    assert s['simulationSpeed'] == 1 and s['startDelay']['minMaxState'] == 0 and not s['prewarm'] and not s['looping']
    delay = s['startDelay']['scalar'];age = time-delay
    assert delay == (0.10000000149011612 if row['kind'] == 'hemisphere' else 0)
    if age < 0: return []
    assert e['enabled'] and e['rateOverTime']['scalar'] == e['rateOverDistance']['scalar'] == 0
    assert e['m_BurstCount'] == len(e['m_Bursts']) == 1
    burst = e['m_Bursts'][0]
    assert burst['time'] == 0 and burst['probability'] == 1 and burst['cycleCount'] == 1
    count = int(burst['countCurve']['scalar']);assert burst['countCurve']['minMaxState'] == 0 and i['maxNumParticles'] >= count
    assert shape['m_Position'] == shape['m_Rotation'] == {'x':0,'y':0,'z':0} and shape['m_Scale'] == {'x':1,'y':1,'z':1}
    result = []
    for index in range(count):
        rand = lambda salt: random_factor(index,salt,seed)
        lifetime = curves.scalar(i['startLifetime'],0,rand(0))
        if lifetime <= age+1e-10: continue
        radius = shape['radius']['value'];inner = radius*(1-shape['radiusThickness'])
        if row['kind'] == 'hemisphere':
            z = rand(10);phi = math.tau*rand(11);xy = math.sqrt(1-z*z)
            direction = [xy*math.cos(phi),xy*math.sin(phi),z]
            distance = (inner**3+rand(12)*(radius**3-inner**3))**(1/3)
            origin = [distance*v for v in direction]
        else:
            assert shape['radiusThickness'] == 0 and count == 12
            phi = math.tau*index/count;angle = math.radians(shape['angle'])
            origin = [radius*math.cos(phi),radius*math.sin(phi),0]
            direction = [math.sin(angle)*math.cos(phi),math.sin(angle)*math.sin(phi),math.cos(angle)]
        speed = curves.scalar(i['startSpeed'],0,rand(18))
        result.append({'id':index,'born':0,'birthTime':delay,'age':age,'lifetime':lifetime,'origin':origin,
            'direction':direction,'initialVelocity':[v*speed for v in direction],
            **({'cohort':{'born':0,'index':index,'count':count}} if row['kind'] == 'burstSpread' else {})})
    return result


def close(a,b):
    if isinstance(b,dict):
        assert a.keys() == b.keys();return sum(close(a[k],v) for k,v in b.items())
    if isinstance(b,list):
        assert len(a) == len(b);return sum(close(x,y) for x,y in zip(a,b))
    assert math.isfinite(a) and math.isclose(a,b,rel_tol=1e-9,abs_tol=1e-9),(a,b);return 1


contract = {'mapping':'Original emission-attempt cohort; equal full-circle bins starting at positive X; no duplicated endpoint',
            'nativeEmissionParity':False,'compiledFrameParity':False}


def verify(r,m,p):
    assert r == expected and len(r) == 12
    assert m['schemaVersion'] == 1 and m['operator'] == pack['operator'] and m['version'] == pack['version']
    assert m['sourcePackSha256'] == source['pack']['sha256'] and m['reference'] == reference
    assert m['scope'] == {'originalProfiles':True,'positiveZHemisphere':True,'explicitIdentityBirthFrames':True,
        'originalBurstCohorts':True,'burstSpreadContract':contract,'dormantEmissionPreserved':True,
        'nativeEmissionParity':False,'compiledFrameParity':False,'enabledOperators':[]}
    assert m['counts'] == {'profiles':12,'hemispheres':3,'burstSpread':3,'dormantPoints':6,'roots':6,'sourceInactive':0,'snapshots':120}
    assert [(x['record'],x['seed'],x['time']) for x in p] == [(key,seed,time) for key in expected for seed in [1,17] for time in [0,.15,.4,.8,1.4]]
    return sum(close(x['particles'],samples(r[x['record']],x['seed'],x['time'])) for x in p)


values = verify(rows,meta,probes)
for path,field in [(FILES[1],'fixture'),(FILES[2],'samples')]:
    assert meta[field] == {'path':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':sha(path.read_bytes())}
mutations = ['enum','activation','emission','source-hash','missing-profile','missing-particle','changed-clock','hemisphere-side',
             'burst-random','compact-cohort','invented-emission','false-rng','false-frame','false-admission']
for name in mutations:
    r,m,p = copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(probes);key = next(iter(r))
    burst = next(x for x in p if r[x['record']]['kind'] == 'burstSpread' and x['particles'])
    hemi = next(x for x in p if r[x['record']]['kind'] == 'hemisphere' and x['particles'])
    if name == 'enum': r[key]['data']['ShapeModule']['type'] = 99
    elif name == 'activation': r[key]['gameObjectActive'] = False
    elif name == 'emission': r[key]['data']['EmissionModule']['enabled'] = not r[key]['data']['EmissionModule']['enabled']
    elif name == 'source-hash': r[key]['serializedSha256'] = '0'*64
    elif name == 'missing-profile': del r[key]
    elif name == 'missing-particle': burst['particles'].pop()
    elif name == 'changed-clock': p[0]['time'] += .1
    elif name == 'hemisphere-side': hemi['particles'][0]['direction'][2] *= -1
    elif name == 'burst-random': burst['particles'][0]['origin'][0] += .001
    elif name == 'compact-cohort': burst['particles'][0]['cohort']['count'] = 1
    elif name == 'invented-emission': next(x for x in p if r[x['record']]['kind'] == 'dormantPoint')['particles'] = [burst['particles'][0]]
    elif name == 'false-rng': m['scope']['nativeEmissionParity'] = True
    elif name == 'false-frame': m['scope']['compiledFrameParity'] = True
    elif name == 'false-admission': m['scope']['enabledOperators'] = [pack['operator']]
    try: verify(r,m,p)
    except AssertionError: continue
    raise AssertionError('Accepted changed hit-shape evidence: '+name)
build();assert before == [sha(p.read_bytes()) for p in FILES]
print(json.dumps({'nativeProfiles':12,'snapshots':120,'scalarValues':values,'reproducibleOutputs':3,
                  'rejectedAlteredEvidence':len(mutations),'nativeEmissionParity':False}))
