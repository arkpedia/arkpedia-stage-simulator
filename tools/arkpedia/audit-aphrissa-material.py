#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check the recovered material identity, all native users and archive rejection."""
import copy
import gzip
import hashlib
import json
from pathlib import Path
import tempfile
from native_anonymous_source import read_anonymous_source
from native_effect_verify import UnityPy, normalized

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia'
RECIPE = 'data/arkpedia-aphrissa-material-source.json'
sha = lambda b: hashlib.sha256(b).hexdigest()


def audit():
    recipe = json.loads((ROOT / RECIPE).read_bytes())
    hot = (CACHE / 'cn-native-source/hot_update_list.json').read_bytes()
    entry = read_anonymous_source(CACHE, RECIPE, hot, recipe['version'])
    name, identity = entry['path'], recipe['identity']
    raw = (CACHE / 'cn-native-source/bundles' / name).read_bytes()
    env = UnityPy.load(raw)
    assert len(env.assets) == 1
    f = env.assets[0]
    assert f.name == identity['serializedFile'] and not f.externals
    assert f.unity_version == identity['unityVersion'] and int(f.target_platform) == identity['platform']
    m = f.objects[int(identity['materialPathId'])]
    assert m.type.name == 'Material' and m.read_typetree()['m_Name'] == 'Default-Particle'
    assert len(m.get_raw_data()) == identity['materialBytes'] == 216
    assert sha(m.get_raw_data()) == identity['materialSha256']
    meta = json.loads((ROOT / 'data/arkpedia-aphrissa-effects.json').read_bytes())
    blob = (CACHE / 'aphrissa-source/effects/native-effects.bin').read_bytes()
    assert sha(blob) == meta['pack']['sha256'] and entry in meta['sources']
    pack = json.loads(gzip.decompress(blob))
    key = name + ':' + identity['materialPathId']
    material = pack['records'][key]
    assert sorted(r['type'] for r in pack['records'].values() if r['bundle'] == name) == ['Material', 'Shader', 'Texture2D']
    assert material['data'] == normalized(m.read_typetree()) and material['serializedSha256'] == sha(m.get_raw_data())
    expected = {'m_Shader': name + ':' + identity['shaderPathId'],
                'm_Texture': name + ':' + identity['texturePathId']}
    assert {r['field']: r['target'] for r in material['references']} == expected
    assert pack['records'][expected['m_Shader']]['type'] == 'Shader'
    assert pack['records'][expected['m_Texture']]['type'] == 'Texture2D'
    users = [(k, r, ref) for k, r in pack['records'].items() for ref in r.get('references', []) if ref.get('target') == key]
    assert len(users) == 56 and all(ref['field'] == 'm_Materials' for _, _, ref in users)
    assert all(r['type'] in ['ParticleSystemRenderer', 'MeshRenderer'] for _, r, _ in users)
    assert sum(bool(r['data']['m_Enabled']) for _, r, _ in users) == 6
    assert set(pack['unresolvedReferences']) == {'Library/unity default resources:10202', 'Library/unity default resources:10210'}
    assert recipe['scope']['nativeManifestShortTagVerified'] is False
    archive = (CACHE / 'cn-native-source/archives' / recipe['archive']['name']).read_bytes()
    rejected = []
    mutations = ['manifest', 'version', 'native-row', 'archive-size', 'archive-sha', 'archive-md5',
                 'archive-name', 'bundle-size', 'bundle-sha', 'bundle-md5', 'zip-crc',
                 'false-approval', 'false-short-tag-verification', 'archive-bytes', 'cached-bundle-bytes', 'missing-bundle']
    with tempfile.TemporaryDirectory() as temp:
        cache = Path(temp)
        ab = cache / 'cn-native-source/archives' / recipe['archive']['name']
        bundle = cache / 'cn-native-source/bundles' / name
        ab.parent.mkdir(parents=True);bundle.parent.mkdir(parents=True)
        fixture = cache / 'recipe.json'
        for mutation in mutations:
            r, h, version = copy.deepcopy(recipe), hot, recipe['version']
            ab.write_bytes(archive);bundle.write_bytes(raw)
            if mutation == 'manifest': h = hot + b' '
            elif mutation == 'version': version = 'wrong-client'
            elif mutation == 'native-row': r['nativeRow']['cid'] += 1
            elif mutation == 'archive-size': r['archive']['bytes'] -= 1
            elif mutation == 'archive-sha': r['archive']['sha256'] = '0' * 64
            elif mutation == 'archive-md5': r['archive']['md5'] = '0' * 32
            elif mutation == 'archive-name': r['archive']['name'] = 'wrong.dat'
            elif mutation == 'bundle-size': r['bundle']['bytes'] -= 1
            elif mutation == 'bundle-sha': r['bundle']['sha256'] = '0' * 64
            elif mutation == 'bundle-md5': r['bundle']['md5'] = '0' * 32
            elif mutation == 'zip-crc': r['bundle']['zipCrc32'] ^= 1
            elif mutation == 'false-approval': r['scope']['rendererVerified'] = True
            elif mutation == 'false-short-tag-verification': r['scope']['nativeManifestShortTagVerified'] = True
            elif mutation == 'archive-bytes': ab.write_bytes(archive[:-1] + bytes([archive[-1] ^ 1]))
            elif mutation == 'cached-bundle-bytes': bundle.write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
            elif mutation == 'missing-bundle': bundle.unlink()
            fixture.write_text(json.dumps(r))
            try:
                read_anonymous_source(cache, fixture, h, version)
            except ValueError:
                rejected.append(mutation)
            else:
                raise AssertionError('Accepted changed anonymous source: ' + mutation)
    report = {'materialUsers': len(users), 'enabledRendererSlots': 6, 'sourceObjectsAdded': 3,
              'rejectedSourceFixtures': len(rejected), 'nativeManifestShortTagVerified': False,
              'rendererVerified': False, 'compiledFrameParity': False}
    (CACHE / 'aphrissa-source/effects/material-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    audit()
