#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compare every mesh/view profile with native objects and pinned enum/UI evidence."""
import copy
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia'
META = ROOT / 'data/arkpedia-aphrissa-mesh-alignment.json'
FIXTURE = ROOT / 'test/fixtures/arkpedia-aphrissa-mesh-alignment.json'
sha = lambda b: hashlib.sha256(b).hexdigest()


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE', 'node'), 'tools/arkpedia/export-aphrissa-mesh-alignment.mjs'],
                   cwd=ROOT, check=True, capture_output=True)


build()
before = [sha(p.read_bytes()) for p in [META, FIXTURE]]
meta, rows = [json.loads(p.read_bytes()) for p in [META, FIXTURE]]
source = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
raw = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes()
assert sha(raw) == source['pack']['sha256']
pack = json.loads(gzip.decompress(raw))
reference = meta['reference']
assert reference['repository'] == 'Unity-Technologies/UnityCsReference'
assert reference['commit'] == 'b052b1fe38b45d5aefa609a115c626ed2e74f3a6'
files = {}
for entry in reference['files']:
    raw_ref = (CACHE / 'unity-builtin-source/mesh-alignment-reference' / Path(entry['path']).name).read_bytes()
    assert len(raw_ref) == entry['bytes'] and sha(raw_ref) == entry['sha256']
    files[Path(entry['path']).name] = raw_ref.decode()
enums = files['ParticleSystemEnums.cs']
for name, members in [('ParticleSystemRenderMode', {'Mesh': 4}), ('ParticleSystemRenderSpace', {'View': 0, 'Local': 2})]:
    body = re.search(r'enum\s+' + name + r'\s*\{([^}]+)\}', enums).group(1)
    for member, value in members.items():
        assert re.search(r'\b' + member + r'\s*=\s*' + str(value) + r'\b', body)
editor = files['RendererModuleUI.cs']
assert 'renderMode == RenderMode.Billboard || renderMode == RenderMode.Mesh' in editor
assert 'GUIPopup(s_Texts.space, m_RenderAlignment, s_Texts.spaces)' in editor
assert 'shape.enabled && o.shape.alignToDirection' in editor
assert 'force to "Local"' in editor
expected, native = {}, {}
for entry in source['sources']:
    name = entry['path']
    if not any(row['particle'].startswith(name + ':') for row in rows.values()):
        continue
    raw_bundle = (CACHE / 'cn-native-source/bundles' / name).read_bytes()
    assert len(raw_bundle) == entry['bytes'] and sha(raw_bundle) == entry['sha256']
    env = UnityPy.load(raw_bundle)
    assert len(env.assets) == 1
    native[name] = env.assets[0]
for key, record in pack['records'].items():
    if record['type'] != 'ParticleSystemRenderer':
        continue
    name, path = key.rsplit(':', 1)
    if name not in native:
        continue
    f = native[name]
    obj = f.objects[int(path)]
    tree = obj.read_typetree()
    if not tree['m_Enabled'] or tree['m_RenderMode'] != 4 or tree['m_RenderAlignment'] != 0:
        continue
    go = f.objects[tree['m_GameObject']['m_PathID']].read_typetree()
    objects = [f.objects[c['component']['m_PathID']] for c in go['m_Component']]
    particle = next(o for o in objects if o.type.name == 'ParticleSystem')
    transform = next(o for o in objects if o.type.name == 'Transform')
    root = transform
    while root.read_typetree()['m_Father']['m_PathID']:
        root = f.objects[root.read_typetree()['m_Father']['m_PathID']]
    root_go = name + ':' + str(root.read_typetree()['m_GameObject']['m_PathID'])
    root_name = next(k for k, v in pack['roots'].items() if v == root_go)
    assert normalized(tree) == record['data'] and sha(obj.get_raw_data()) == record['serializedSha256']
    mesh_ref = next(r for r in record['references'] if r['field'] == 'm_Mesh')
    pointer = tree['m_Mesh']
    assert mesh_ref['pointer'] == normalized(pointer)
    mesh_record = pack['records'][mesh_ref['target']]
    mesh_file = native[mesh_record['bundle']]
    if pointer['m_FileID']:
        assert f.externals[pointer['m_FileID'] - 1].path.rsplit('/', 1)[-1] == mesh_file.name
    else:
        assert mesh_file is f
    mesh = mesh_file.objects[pointer['m_PathID']]
    assert mesh.type.name == 'Mesh' and sha(mesh.get_raw_data()) == mesh_record['serializedSha256']
    shape = particle.read_typetree()['ShapeModule']
    assert not shape['enabled'] or not shape['alignToDirection']
    expected[key] = {'root': root_name, 'name': go['m_Name'], 'serializedSha256': sha(obj.get_raw_data()),
                     'data': normalized(tree), 'references': record['references'],
                     'particle': name + ':' + str(particle.path_id), 'particleSha256': sha(particle.get_raw_data())}


def verify(candidate, manifest):
    assert candidate == expected and len(candidate) == 82
    assert manifest['operator'] == pack['operator'] and manifest['version'] == pack['version']
    assert manifest['sourcePackSha256'] == source['pack']['sha256']
    assert manifest['reference'] == reference
    assert manifest['counts'] == {'renderers': 82, 'roots': 16}
    assert manifest['scope'] == {'originalProfiles': True, 'meshViewMapping': True,
        'nativeFrameParity': False, 'fullEffectDispatchVerified': False, 'enabledOperators': []}


verify(rows, meta)
assert meta['fixture'] == {'path': str(FIXTURE.relative_to(ROOT)), 'bytes': FIXTURE.stat().st_size, 'sha256': sha(FIXTURE.read_bytes())}
mutations = ['missing-renderer', 'alignment', 'render-mode', 'mesh', 'source-object', 'particle-object', 'root',
             'false-parity', 'false-full-dispatch', 'false-admission', 'reference', 'source-pack']
for mutation in mutations:
    r, m = copy.deepcopy(rows), copy.deepcopy(meta)
    k = next(iter(r))
    if mutation == 'missing-renderer': del r[k]
    elif mutation == 'alignment': r[k]['data']['m_RenderAlignment'] = 2
    elif mutation == 'render-mode': r[k]['data']['m_RenderMode'] = 0
    elif mutation == 'mesh': next(x for x in r[k]['references'] if x['field'] == 'm_Mesh')['target'] = 'invented-mesh'
    elif mutation == 'source-object': r[k]['serializedSha256'] = '0' * 64
    elif mutation == 'particle-object': r[k]['particleSha256'] = '0' * 64
    elif mutation == 'root': r[k]['root'] = 'invented-root'
    elif mutation == 'false-parity': m['scope']['nativeFrameParity'] = True
    elif mutation == 'false-full-dispatch': m['scope']['fullEffectDispatchVerified'] = True
    elif mutation == 'false-admission': m['scope']['enabledOperators'] = [pack['operator']]
    elif mutation == 'reference': m['reference']['commit'] = 'wrong-reference'
    elif mutation == 'source-pack': m['sourcePackSha256'] = '0' * 64
    try:
        verify(r, m)
    except AssertionError:
        continue
    raise AssertionError('Accepted changed mesh alignment evidence: ' + mutation)
build()
assert before == [sha(p.read_bytes()) for p in [META, FIXTURE]]
print(json.dumps({'originalMeshViewRenderers': len(rows), 'originalRoots': 16, 'reproducibleOutputs': 2,
                  'rejectedAlteredEvidence': len(mutations), 'nativeFrameParity': False}))
