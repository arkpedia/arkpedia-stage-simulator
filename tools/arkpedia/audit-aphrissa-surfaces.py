#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Native Circle/BoxShell controls plus an independent source geometry oracle."""
import cmath
import copy
import gzip
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia'
FILES = [ROOT / 'data/arkpedia-aphrissa-surfaces.json', ROOT / 'test/fixtures/arkpedia-aphrissa-surfaces.json',
         CACHE / 'aphrissa-source/effects/surface-samples.json']
sha = lambda raw: hashlib.sha256(raw).hexdigest()


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE', 'node'), 'tools/arkpedia/export-aphrissa-surfaces.mjs'],
                   cwd=ROOT, check=True, capture_output=True)


build();before = [sha(p.read_bytes()) for p in FILES]
meta, rows, samples = [json.loads(p.read_bytes()) for p in FILES]
source = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
raw = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(raw) == source['pack']['sha256'];pack = json.loads(gzip.decompress(raw))
ref = {'repository': 'Unity-Technologies/UnityCsReference', 'commit': 'b052b1fe38b45d5aefa609a115c626ed2e74f3a6',
       'files': [{'path': 'Modules/ParticleSystem/Managed/ParticleSystemEnums.cs', 'bytes': 14635,
                  'sha256': 'cc34dc3bfc5e8abcf7f2654ac37bbdec2709728bcd604918cf55919b980cdb93'}]}
enum = (CACHE / 'unity-builtin-source/mesh-alignment-reference/ParticleSystemEnums.cs').read_bytes()
assert len(enum) == ref['files'][0]['bytes'] and sha(enum) == ref['files'][0]['sha256']
enum_body = re.search(r'enum\s+ParticleSystemShapeType\s*\{([^}]+)\}', enum.decode()).group(1)
for name, value in [('Circle',10), ('BoxShell',15), ('Rectangle',18)]:
    assert re.search(r'\b'+name+r'\s*=\s*'+str(value)+r'\b', enum_body)

expected = {}
for entry in source['sources']:
    name = entry['path']
    # Inventory comes from the canonical pack, not the proposed recipe.
    candidates = {key:r for key,r in pack['records'].items() if r['bundle'] == name and r['type'] == 'ParticleSystem'
                  and r['data']['ShapeModule']['enabled'] and r['data']['ShapeModule']['type'] in [10,15]}
    if not candidates:
        continue
    bundle = (CACHE / 'cn-native-source/bundles' / name).read_bytes()
    assert len(bundle) == entry['bytes'] and sha(bundle) == entry['sha256']
    env = UnityPy.load(bundle);assert len(env.assets) == 1;native = env.assets[0].objects
    for key, record in candidates.items():
        obj = native[int(record['pathId'])];s = obj.read_typetree()
        assert normalized(s) == record['data'] and sha(obj.get_raw_data()) == record['serializedSha256']
        go = native[s['m_GameObject']['m_PathID']];g = go.read_typetree()
        components = [native[c['component']['m_PathID']] for c in g['m_Component']]
        renderer = next(o for o in components if o.type.name == 'ParticleSystemRenderer')
        tr = next(o for o in components if o.type.name == 'Transform')
        while tr.read_typetree()['m_Father']['m_PathID']:
            tr = native[tr.read_typetree()['m_Father']['m_PathID']]
        root = name + ':' + str(tr.read_typetree()['m_GameObject']['m_PathID'])
        expected[key] = {'root': next(k for k,v in pack['roots'].items() if v == root), 'name': g['m_Name'],
            'serializedSha256': sha(obj.get_raw_data()), 'data': normalized(s), 'gameObjectActive': g['m_IsActive'],
            'gameObjectSha256': sha(go.get_raw_data()), 'renderer': name+':'+str(renderer.path_id),
            'rendererSha256': sha(renderer.get_raw_data()), 'rendererEnabled': renderer.read_typetree()['m_Enabled']}


def geometry(s, factors):
    a,b,_face = factors
    assert s['enabled'] and not s['alignToDirection']
    assert [s[k] for k in ['randomDirectionAmount','sphericalDirectionAmount','randomPositionAmount']] == [0,0,0]
    assert all(s[k]['m_PathID'] == '0' for k in ['m_Texture','m_Mesh','m_MeshRenderer','m_SkinnedMeshRenderer','m_Sprite','m_SpriteRenderer'])
    x,y,z = [s['m_Scale'][k] for k in ['x','y','z']]
    if s['type'] == 15:
        # All 24 original shells collapse only in Z. Their two finite-area
        # faces coincide, independent of which face the local sampler chooses.
        assert z == 0 and x > 0 and y > 0
        return [(a-.5)*x,(b-.5)*y,0], [0,0,1]
    assert s['type'] == 10
    assert (s['arc']['mode'],s['arc']['value'],s['arc']['spread']) == (0,360,0)
    assert (s['radius']['mode'],s['radius']['spread']) == (0,0)
    radius,thickness = s['radius']['value'],s['radiusThickness']
    low = radius*(1-thickness)
    distance = math.sqrt(low**2 + a*(radius**2-low**2))
    direction = cmath.rect(1, b*math.tau)
    return [distance*direction.real*x,distance*direction.imag*y,0], [direction.real,direction.imag,0]


inputs = [(key,[a,b,face]) for key in expected for a in [0,.25,1] for b in [0,.25,.75] for face in [0,.5,1]]


def verify(candidate, manifest, probes):
    assert candidate == expected and len(candidate) == 28
    assert manifest['schemaVersion'] == 1 and manifest['operator'] == pack['operator'] and manifest['version'] == pack['version']
    assert manifest['sourcePackSha256'] == source['pack']['sha256'] and manifest['reference'] == ref
    assert manifest['scope'] == {'originalProfiles':True,'uniformArea':True,'nativeEmissionParity':False,
        'compiledFrameParity':False,'fullEffectDispatchVerified':False,'enabledOperators':[]}
    assert manifest['counts'] == {'profiles':28,'circles':4,'boxShells':24,'roots':16,'rendererEnabled':26,'sourceInactive':8,'probes':756}
    assert [(p['record'],p['factors']) for p in probes] == inputs
    count = 0
    for p in probes:
        point,direction = geometry(candidate[p['record']]['data']['ShapeModule'],p['factors'])
        for field, target in [('origin',point),('direction',direction)]:
            assert len(p[field]) == 3
            for actual,value in zip(p[field],target):
                assert math.isfinite(actual) and math.isclose(actual,value,rel_tol=1e-10,abs_tol=1e-10)
                count += 1
    return count


values = verify(rows,meta,samples)
for file,field in [(FILES[1],'fixture'),(FILES[2],'samples')]:
    assert meta[field] == {'path':str(file.relative_to(ROOT)),'bytes':file.stat().st_size,'sha256':sha(file.read_bytes())}
mutations = ['shape-enum','source-radius','source-object','source-activation','source-renderer','missing-profile',
             'reference-enum','missing-probe','changed-factor','wrong-position','wrong-direction',
             'native-rng','native-frames','full-effect','admission']
for name in mutations:
    r,m,p = copy.deepcopy(rows),copy.deepcopy(meta),copy.deepcopy(samples)
    key = next(k for k,v in r.items() if v['data']['ShapeModule']['type'] == 15)
    if name == 'shape-enum': r[key]['data']['ShapeModule']['type'] = 18
    elif name == 'source-radius': r[key]['data']['ShapeModule']['radius']['value'] += 1
    elif name == 'source-object': r[key]['serializedSha256'] = '0'*64
    elif name == 'source-activation': r[key]['gameObjectActive'] = not r[key]['gameObjectActive']
    elif name == 'source-renderer': r[key]['rendererEnabled'] = not r[key]['rendererEnabled']
    elif name == 'missing-profile': del r[key]
    elif name == 'reference-enum': m['reference']['files'][0]['sha256'] = '0'*64
    elif name == 'missing-probe': p.pop()
    elif name == 'changed-factor': p[0]['factors'][0] = .5
    elif name == 'wrong-position': p[0]['origin'][0] += 1
    elif name == 'wrong-direction': p[0]['direction'] = [1,0,0]
    elif name == 'native-rng': m['scope']['nativeEmissionParity'] = True
    elif name == 'native-frames': m['scope']['compiledFrameParity'] = True
    elif name == 'full-effect': m['scope']['fullEffectDispatchVerified'] = True
    elif name == 'admission': m['scope']['enabledOperators'] = [pack['operator']]
    try:
        verify(r,m,p)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed surface evidence: '+name)
build();assert before == [sha(p.read_bytes()) for p in FILES]
print(json.dumps({'nativeProfiles':28,'probes':756,'scalarValues':values,'reproducibleOutputs':3,
                  'rejectedAlteredEvidence':len(mutations),'nativeEmissionParity':False}))
