#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Native source controls plus independent Fixed-key and scalar Euler oracles."""
from bisect import bisect_right
import copy
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2];CACHE = ROOT / '.cache/arkpedia'
FILES = [ROOT / 'data/arkpedia-aphrissa-birth-controls.json',ROOT / 'test/fixtures/arkpedia-aphrissa-birth-controls.json',
         CACHE / 'aphrissa-source/effects/birth-control-samples.json']
sha = lambda raw: hashlib.sha256(raw).hexdigest()
spec = importlib.util.spec_from_file_location('birth_curve_reference',Path(__file__).with_name('audit-lappland-particle-curves.py'))
curves = importlib.util.module_from_spec(spec);spec.loader.exec_module(curves)


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE','node'),'tools/arkpedia/export-aphrissa-birth-controls.mjs'],cwd=ROOT,check=True,capture_output=True)


build();before = [sha(p.read_bytes()) for p in FILES];meta,rows,probes = [json.loads(p.read_bytes()) for p in FILES]
source = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
raw = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes();assert sha(raw) == source['pack']['sha256']
pack = json.loads(gzip.decompress(raw))
reference = {'repository':'Unity-Technologies/UnityCsReference','commit':'b052b1fe38b45d5aefa609a115c626ed2e74f3a6','files':[
    {'path':'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs','bytes':14635,'sha256':'cc34dc3bfc5e8abcf7f2654ac37bbdec2709728bcd604918cf55919b980cdb93'},
    {'path':'Runtime/Export/Math/Gradient.bindings.cs','bytes':4453,'sha256':'55e3b0c9cf2f4553e9431be11f2668240bb0c3e6d1bb8047afed2172efee5c35'}],'documents':[
    {'url':'https://docs.unity3d.com/2021.3/Documentation/ScriptReference/GradientMode.html','bytes':15314,'sha256':'badabec9579bcf404617538e5887bf30c67785ae9ca8e652e257fee0e3d025b4'},
    {'url':'https://docs.unity3d.com/2021.3/Documentation/Manual/PartSysRendererModule.html','bytes':43111,'sha256':'3ad64ef6a821ac523a83e415021d9417f33c7733e0d7a4e43752891ef6ca4e2a'}]}
ref_dir = CACHE / 'unity-builtin-source/particle-birth-reference';texts = {}
for entry in reference['files']+reference['documents']:
    name = Path(entry.get('path',entry.get('url'))).name;b = (ref_dir / name).read_bytes()
    assert len(b) == entry['bytes'] and sha(b) == entry['sha256'];texts[name] = b.decode()
for enum,member,value,file in [('ParticleSystemGradientMode','RandomColor',4,'ParticleSystemEnums.cs'),
    ('ParticleSystemRenderMode','Billboard',0,'ParticleSystemEnums.cs'),('ParticleSystemRenderSpace','Local',2,'ParticleSystemEnums.cs'),
    ('GradientMode','Fixed',1,'Gradient.bindings.cs')]:
    body = re.search(r'enum\s+'+enum+r'\s*\{([^}]+)\}',texts[file]).group(1)
    assert re.search(r'\b'+member+r'\s*=\s*'+str(value)+r'\b',body)
assert 'first key whose time value is greater than the requested evaluation time' in texts['GradientMode.html']
assert 'Particles face the Camera plane.' in texts['PartSysRendererModule.html']
assert 'of their GameObject.' in texts['PartSysRendererModule.html']
expected = {}
for entry in source['sources']:
    name = entry['path'];candidates = {}
    for key,r in pack['records'].items():
        if r['type'] != 'ParticleSystem' or r['bundle'] != name: continue
        s = r['data']
        if s['InitialModule']['startColor']['minMaxState'] == 4 or s['InitialModule']['rotation3D']: candidates[key] = r
    if not candidates: continue
    bundle = (CACHE / 'cn-native-source/bundles' / name).read_bytes()
    assert len(bundle) == entry['bytes'] and sha(bundle) == entry['sha256']
    env = UnityPy.load(bundle);assert len(env.assets) == 1;native = env.assets[0].objects
    for key,r in candidates.items():
        obj = native[int(r['pathId'])];s = obj.read_typetree();go = native[s['m_GameObject']['m_PathID']];g = go.read_typetree()
        components = [native[c['component']['m_PathID']] for c in g['m_Component']]
        renderer = next((o for o in components if o.type.name == 'ParticleSystemRenderer'),None)
        if renderer is None: continue
        rd = renderer.read_typetree()
        if not rd['m_Enabled']: continue
        color = s['InitialModule']['startColor']['minMaxState'] == 4
        rotation = s['InitialModule']['rotation3D'] and rd['m_RenderMode'] == 0
        if not color and not rotation: continue
        assert not (color and rotation) and normalized(s) == r['data'] and sha(obj.get_raw_data()) == r['serializedSha256']
        tr = next(o for o in components if o.type.name == 'Transform')
        while tr.read_typetree()['m_Father']['m_PathID']: tr = native[tr.read_typetree()['m_Father']['m_PathID']]
        root = name+':'+str(tr.read_typetree()['m_GameObject']['m_PathID'])
        expected[key] = {'root':next(k for k,v in pack['roots'].items() if v == root),'kind':'randomFixedColor' if color else 'billboard3D',
            'name':g['m_Name'],'serializedSha256':sha(obj.get_raw_data()),'data':normalized(s),'gameObjectActive':g['m_IsActive'],
            'gameObjectSha256':sha(go.get_raw_data()),'renderer':name+':'+str(renderer.path_id),
            'rendererSha256':sha(renderer.get_raw_data()),'rendererData':normalized(rd)}


def fixed(g,factor):
    values = []
    for component in 'rgba':
        prefix,count = ('a',g['m_NumAlphaKeys']) if component == 'a' else ('c',g['m_NumColorKeys'])
        clocks = [g[prefix+'time'+str(i)]/65535 for i in range(count)]
        index = min(bisect_right(clocks,factor),count-1);values.append(g['key'+str(index)][component])
    return values


def rotated(vector,angles):
    x,y,z = angles;u,v,w = vector
    a,b = u*math.cos(z)-v*math.sin(z),u*math.sin(z)+v*math.cos(z)
    c,d = b*math.cos(x)-w*math.sin(x),b*math.sin(x)+w*math.cos(x)
    return [a*math.cos(y)+d*math.sin(y),c,-a*math.sin(y)+d*math.cos(y)]


inputs = []
for key,row in expected.items():
    i = row['data']['InitialModule']
    if row['kind'] == 'randomFixedColor':
        g = i['startColor']['maxGradient'];factors = {0,.25,.5,.75,1}
        for prefix,count in [('c',g['m_NumColorKeys']),('a',g['m_NumAlphaKeys'])]:
            for index in range(count):
                for delta in [-1e-10,0,1e-10]: factors.add(max(0,min(1,g[prefix+'time'+str(index)]/65535+delta)))
        inputs += [{'record':key,'time':time,'factor':factor} for time in [0,.5,1] for factor in sorted(factors)]
    else: inputs += [{'record':key,'phase':phase,'factors':factors} for phase in [0,.25,1] for factors in [[0,0,0],[.25,.75,.5],[1,1,1]]]


def close(a,b):
    if isinstance(b,dict):
        assert a.keys() == b.keys();return sum(close(a[k],v) for k,v in b.items())
    if isinstance(b,list):
        assert len(a) == len(b);return sum(close(x,y) for x,y in zip(a,b))
    assert math.isfinite(a) and math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-10),(a,b);return 1


def verify(r,m,p):
    assert r == expected and len(r) == 8
    assert m['schemaVersion'] == 1 and m['operator'] == pack['operator'] and m['version'] == pack['version']
    assert m['sourcePackSha256'] == source['pack']['sha256'] and m['reference'] == reference
    assert m['scope'] == {'originalProfiles':True,'fixedFirstStrictlyLaterKey':True,'stableRandomBirthColor':True,'ordinaryBillboard3D':True,
        'stretchedBillboard3D':False,'nativeRngParity':False,'compiledFrameParity':False,'enabledOperators':[]}
    assert m['counts'] == {'profiles':8,'randomFixedColors':4,'billboards3D':4,'roots':3,'sourceInactive':4,'probes':192}
    assert m['effectRoots'] == sorted(pack['roots']) and len(m['effectRoots']) == 22
    assert [{k:v for k,v in x.items() if k in ['record','time','factor','phase','factors']} for x in p] == inputs
    values = 0
    for probe in p:
        row = r[probe['record']];i = row['data']['InitialModule']
        if row['kind'] == 'randomFixedColor':
            assert i['startColor']['maxGradient']['m_Mode'] == 1
            values += close(probe['color'],fixed(i['startColor']['maxGradient'],probe['factor']))
        else:
            angles = [curves.scalar(i[key],probe['phase'],factor) for key,factor in zip(['startRotationX','startRotationY','startRotation'],probe['factors'])]
            values += close(probe['rotation3D'],angles)+close(probe['rotation'],angles[2])
            values += close(probe['basis'],[rotated(v,angles) for v in [[1,0,0],[0,1,0],[0,0,1]]])
    return values


values = verify(rows,meta,probes)
for path,field in [(FILES[1],'fixture'),(FILES[2],'samples')]:
    assert meta[field] == {'path':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':sha(path.read_bytes())}
mutations = ['source-color','source-angle','source-activation','source-hash','renderer-alignment','omitted-profile','missing-root',
             'fixed-boundary','interpolated-color','flattened-angle','wrong-basis','reference-hash','false-stretch','false-rng','false-frame','false-admission']
for name in mutations:
    r,m,p = copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(probes)
    color_key = next(k for k,v in r.items() if v['kind'] == 'randomFixedColor');rot_key = next(k for k,v in r.items() if v['kind'] == 'billboard3D')
    color_probe = next(x for x in p if r[x['record']]['kind'] == 'randomFixedColor');rot_probe = next(x for x in p if r[x['record']]['kind'] == 'billboard3D')
    if name == 'source-color': r[color_key]['data']['InitialModule']['startColor']['minMaxState'] = 0
    elif name == 'source-angle': r[rot_key]['data']['InitialModule']['startRotationY']['scalar'] += .1
    elif name == 'source-activation': r[color_key]['gameObjectActive'] = True
    elif name == 'source-hash': r[color_key]['serializedSha256'] = '0'*64
    elif name == 'renderer-alignment': r[rot_key]['rendererData']['m_RenderAlignment'] = 0
    elif name == 'omitted-profile': del r[color_key]
    elif name == 'missing-root': m['effectRoots'].pop()
    elif name == 'fixed-boundary': color_probe['factor'] += .001
    elif name == 'interpolated-color': color_probe['color'][0] += .01
    elif name == 'flattened-angle': rot_probe['rotation3D'] = [0,0,rot_probe['rotation']]
    elif name == 'wrong-basis': rot_probe['basis'][0][0] += .1
    elif name == 'reference-hash': m['reference']['files'][1]['sha256'] = '0'*64
    elif name == 'false-stretch': m['scope']['stretchedBillboard3D'] = True
    elif name == 'false-rng': m['scope']['nativeRngParity'] = True
    elif name == 'false-frame': m['scope']['compiledFrameParity'] = True
    elif name == 'false-admission': m['scope']['enabledOperators'] = [pack['operator']]
    try: verify(r,m,p)
    except AssertionError: continue
    raise AssertionError('Accepted changed birth-control evidence: '+name)
with tempfile.TemporaryDirectory() as directory:
    temp = Path(directory);target = temp / 'unity-builtin-source/particle-birth-reference';shutil.copytree(ref_dir,target)
    (target / 'GradientMode.html').write_bytes(b'changed reference')
    result = subprocess.run([sys.executable,'tools/arkpedia/fetch-particle-birth-reference.py','--cache',str(temp)],cwd=ROOT,capture_output=True)
    assert result.returncode != 0 and b'Changed particle birth reference' in result.stderr
build();assert before == [sha(p.read_bytes()) for p in FILES]
print(json.dumps({'nativeProfiles':8,'probes':192,'scalarValues':values,'reproducibleOutputs':3,
                  'rejectedAlteredEvidence':len(mutations)+1,'nativeFrameParity':False}))
