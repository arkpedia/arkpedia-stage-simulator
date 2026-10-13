#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check recovered programs against native bytes without the exporter parser.

The verifier checks actual player links, byte table bounds, keyword/string
payloads, properties and pass states. It does not certify WebGL/game parity.
"""
import copy
import gzip
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from UnityPy.helpers import CompressionHelper


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(pack):
    return (json.dumps(pack, separators=(',', ':'), sort_keys=True) + '\n').encode()


def verify(pack, meta, native, blob_by_id, spec):
    directory = ROOT / '.cache/arkpedia' / spec['source_directory'] / 'effects'
    raw = encoded(pack)
    assert meta['artifact'] == {'path': 'native-shaders.json', 'bytes': len(raw), 'sha256': digest(raw)}
    assert meta['scope'] == {'nativeSourceOnly': True, 'rendererVerified': False,
                             'compiledFrameParity': False, 'enabledOperators': []}
    assert pack['schemaVersion'] == meta['schemaVersion'] == 1
    assert pack['operator'] == meta['operator'] == spec['operator']
    source = json.loads((ROOT / spec['source_manifest']).read_text())
    assert pack['version'] == meta['version'] == source['version']
    source_bytes = (directory / 'native-effects.bin').read_bytes()
    assert digest(source_bytes) == source['pack']['sha256']
    records = json.loads(gzip.decompress(source_bytes))['records']
    expected_keys = {k for k,r in records.items() if r['type'] == 'Shader'}
    assert set(pack['shaders']) == set(meta['shaders']) == expected_keys
    assert pack['sourceBundle'] == meta['sourceBundle'] == next(s for s in source['sources'] if s['path'] == '[uc]shaders.ab')
    count = 0
    for key, shader in pack['shaders'].items():
        obj = native[int(key.rsplit(':', 1)[1])]
        tree = obj.read_typetree()
        form = tree['m_ParsedForm']
        blob = blob_by_id[obj.path_id]
        assert shader['sourceObjectSha256'] == digest(obj.get_raw_data()) == records[key]['serializedSha256']
        assert shader['glesBlobSha256'] == digest(blob)
        assert shader['name'] == form['m_Name']
        assert shader['properties'] == json.loads(json.dumps(form['m_PropInfo']))
        expected_passes, indices = [], set()
        for si, sub in enumerate(form['m_SubShaders']):
            for pi, render_pass in enumerate(sub['m_Passes']):
                assert render_pass['m_Type'] == 0 and not render_pass['progFragment']['m_PlayerSubPrograms']
                variants = []
                for gi, group in enumerate(render_pass['progVertex']['m_PlayerSubPrograms']):
                    for link in group:
                        if link['m_GpuProgramType'] != 4:
                            continue
                        i = link['m_BlobIndex']
                        indices.add(str(i))
                        variants.append({'hardwareGroup': gi, 'blobIndex': i,
                                         'keywords': [form['m_KeywordNames'][k] for k in link['m_KeywordIndices']],
                                         'requirements': link['m_ShaderRequirements']})
                assert variants
                expected_passes.append({'subShader': si, 'pass': pi, 'state': render_pass['m_State'], 'variants': variants})
        assert shader['passes'] == json.loads(json.dumps(expected_passes))
        assert set(shader['programs']) == indices
        for index, program in shader['programs'].items():
            i = int(index)
            table_count = struct.unpack_from('<I', blob)[0]
            assert i < table_count
            offset, size, segment = struct.unpack_from('<III', blob, 4 + i * 12)
            assert segment == 0 and offset >= 4 + table_count * 12 and offset + size <= len(blob)
            entry = blob[offset:offset + size]
            assert struct.unpack_from('<II', entry) == (202012090, 4)
            keywords_count = struct.unpack_from('<I', entry, 24)[0]
            pos, keywords = 28, []
            for _ in range(keywords_count):
                length = struct.unpack_from('<I', entry, pos)[0]
                pos += 4
                keywords.append(entry[pos:pos + length].decode('utf8'))
                pos = (pos + length + 3) // 4 * 4
            length = struct.unpack_from('<I', entry, pos)[0]
            pos += 4
            code = entry[pos:pos + length]
            pos = (pos + length + 3) // 4 * 4
            assert pos + 8 == size
            expected = {'blobIndex': i, 'entryOffset': offset, 'entryBytes': size,
                        'entrySha256': digest(entry), 'gpuProgramType': 4, 'keywords': keywords,
                        'sourceBytes': len(code), 'sourceSha256': digest(code), 'source': code.decode('utf8'),
                        'trailer': list(struct.unpack_from('<II', entry, pos))}
            assert program == expected
            for render_pass in expected_passes:
                for variant in render_pass['variants']:
                    if variant['blobIndex'] == i:
                        assert sorted(variant['keywords']) == sorted(keywords)
            count += 1
        expected_meta = {k: shader[k] for k in ['name', 'sourceObjectSha256', 'glesBlobSha256']}
        expected_meta['programs'] = {i: {k: p[k] for k in p if k != 'source'} for i, p in shader['programs'].items()}
        assert meta['shaders'][key] == expected_meta
    assert count == spec['counts']['programs'] and len(expected_keys) == spec['counts']['shaders']
    assert meta['counts'] == spec['counts']


def audit(spec):
    directory = ROOT / '.cache/arkpedia' / spec['source_directory'] / 'effects'
    manifest = ROOT / spec['manifest']
    source = json.loads((ROOT / spec['source_manifest']).read_text())
    bundle = next(s for s in source['sources'] if s['path'] == '[uc]shaders.ab')
    raw = (ROOT / '.cache/arkpedia/map-source/ab/[uc]shaders.ab').read_bytes()
    assert len(raw) == bundle['bytes'] and digest(raw) == bundle['sha256']
    env = UnityPy.Environment()
    env.load_file(raw)
    native = {o.path_id: o for o in env.objects if o.type.name == 'Shader'}
    blobs = {}
    for key in json.loads(manifest.read_text())['shaders']:
        obj = native[int(key.rsplit(':', 1)[1])]
        t = obj.read_typetree()
        p = t['platforms'].index(9)
        assert t['platforms'].count(9) == 1
        off, length, size = [t[k][p][0] for k in ['offsets', 'compressedLengths', 'decompressedLengths']]
        assert all(len(t[k][p]) == 1 for k in ['offsets', 'compressedLengths', 'decompressedLengths'])
        blobs[obj.path_id] = CompressionHelper.decompress_lz4(bytes(t['compressedBlob'])[off:off + length], size)
        assert len(blobs[obj.path_id]) == size
    before = {p: digest(p.read_bytes()) for p in [manifest, directory / 'native-shaders.json']}
    subprocess.run([sys.executable, spec['exporter']], cwd=ROOT, check=True, capture_output=True)
    assert all(digest(p.read_bytes()) == value for p, value in before.items()), 'Shader export is not reproducible'
    pack = json.loads((directory / 'native-shaders.json').read_text())
    meta = json.loads(manifest.read_text())
    verify(pack, meta, native, blobs, spec)
    mutations = ['source-equation', 'keyword', 'player-link', 'pass-state', 'property-default',
                 'trailer', 'missing-program', 'premature-enable', 'false-renderer-parity',
                 'wrong-source-object', 'missing-shader', 'gpu-program-type']
    for mutation in mutations:
        p, m = copy.deepcopy(pack), copy.deepcopy(meta)
        s = next(iter(p['shaders'].values()))
        program = next(iter(s['programs'].values()))
        if mutation == 'source-equation': program['source'] += '\n// altered equation\n'
        elif mutation == 'keyword': program['keywords'].append('UNAUTHORED')
        elif mutation == 'player-link': s['passes'][0]['variants'][0]['blobIndex'] += 1
        elif mutation == 'pass-state': s['passes'][0]['state']['zWrite']['val'] += 1
        elif mutation == 'property-default': s['properties']['m_Props'][0]['m_DefValue[0]'] += 1
        elif mutation == 'trailer': program['trailer'][0] += 1
        elif mutation == 'missing-program': del s['programs'][next(iter(s['programs']))]
        elif mutation == 'premature-enable': m['scope']['enabledOperators'] = [spec['operator']]
        elif mutation == 'false-renderer-parity': m['scope']['rendererVerified'] = True
        elif mutation == 'wrong-source-object': s['sourceObjectSha256'] = '0' * 64
        elif mutation == 'missing-shader':
            key = next(iter(p['shaders']))
            del p['shaders'][key]
            del m['shaders'][key]
        elif mutation == 'gpu-program-type': program['gpuProgramType'] = 0
        altered = encoded(p)
        m['artifact'].update(bytes=len(altered), sha256=digest(altered))
        try:
            verify(p, m, native, blobs, spec)
        except AssertionError:
            continue
        raise AssertionError('Accepted altered native shader: ' + mutation)
    report = dict(spec['counts'], reproducedFiles=2, rejectedSemanticFixtures=len(mutations))
    (directory / 'shader-audit.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    return report
