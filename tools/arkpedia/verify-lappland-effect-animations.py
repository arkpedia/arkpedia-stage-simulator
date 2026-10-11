#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently check decoded channels/bindings and samples against native data.

This checks source recovery and scalar polynomial evaluation, not Unity FSM,
shader execution, geometry conversion or compiled floating-point/frame parity.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / '.cache/arkpedia/lappland-alter-source/effects'
MANIFEST = ROOT / 'data/arkpedia-lappland-effect-animations.json'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def native_clips():
    # The source pack, textures and hierarchy must pass their existing independent
    # native audit before this verifier trusts any path/material resolution.
    spec = importlib.util.spec_from_file_location('effects_verifier', ROOT / 'tools/arkpedia/verify-lappland-effects.py')
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    verifier.verify(ROOT / '.cache/arkpedia', DIRECTORY, ROOT / 'data/arkpedia-lappland-effects.json')
    env = UnityPy.Environment()
    env.load_file(str(ROOT / '.cache/arkpedia/lappland-alter-source/whitw2-effects.ab'))
    return {f'battle/prefabs/effects/whitw2.ab:{o.path_id}': o
            for o in env.objects if o.type.name == 'AnimationClip' and o.path_id in
            {int(k.rsplit(':', 1)[1]) for k, r in json.load(gzip.open(DIRECTORY / 'native-effects.bin'))['records'].items()
             if r['type'] == 'AnimationClip'}}


def verify(originals, directory=DIRECTORY, manifest=MANIFEST):
    pack_bytes = (DIRECTORY / 'native-effects.bin').read_bytes()
    pack = json.loads(gzip.decompress(pack_bytes))
    records = pack['records']
    raw = (directory / 'native-animations.json').read_bytes()
    decoded, meta = json.loads(raw), json.loads(manifest.read_text())
    assert meta['artifact'] == {'path': 'native-animations.json', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    assert meta['sourcePackSha256'] == decoded['sourcePackSha256'] == hashlib.sha256(pack_bytes).hexdigest()
    assert meta['operator'] == decoded['operator'] == 'char_1038_whitw2'
    assert meta['version'] == decoded['version'] == pack['version']
    assert meta['schemaVersion'] == decoded['schemaVersion'] == 1
    assert decoded['coordinates'] == 'original-unity'
    assert meta['scope']['sourceChannelsOnly'] is True
    assert meta['scope']['rendererVerified'] is False and meta['scope']['compiledFrameParity'] is False
    assert meta['scope']['enabledOperators'] == [] and len(meta['scope']['pending']) == 2
    assert set(decoded['clips']) == set(meta['clips']) == set(originals) and len(originals) == 10
    samples = json.loads((directory / 'native-animation-samples.json').read_text())
    assert set(samples) == set(originals)
    fixture_bytes = (ROOT / 'test/fixtures/arkpedia-lappland-effect-clips.json').read_bytes()
    fixtures = json.loads(fixture_bytes)
    assert meta['fixture'] == {'path': 'test/fixtures/arkpedia-lappland-effect-clips.json',
        'bytes': len(fixture_bytes), 'sha256': hashlib.sha256(fixture_bytes).hexdigest()}
    assert set(fixtures) == set(originals)
    total_bindings = total_channels = total_keys = sample_values = 0
    for key, obj in originals.items():
        native = obj.read_typetree()
        muscle = native['m_MuscleClip']
        data = muscle['m_Clip']['data']
        stream, constants = data['m_StreamedClip'], data['m_ConstantClip']['data']
        clip = decoded['clips'][key]
        assert clip['sourceSha256'] == hashlib.sha256(obj.get_raw_data()).hexdigest()
        projected = {k: native[k] for k in ['m_Name', 'm_RotationCurves', 'm_CompressedRotationCurves',
            'm_EulerCurves', 'm_PositionCurves', 'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves', 'm_ClipBindingConstant']}
        projected = json.loads(json.dumps(projected))
        for b in projected['m_ClipBindingConstant']['genericBindings']:
            b['script']['m_PathID'] = str(b['script']['m_PathID'])
        projected['m_MuscleClip'] = {k: muscle[k] for k in ['m_StartTime', 'm_StopTime', 'm_LoopTime', 'm_Clip']}
        assert fixtures[key] == {'sourceSha256': clip['sourceSha256'], 'data': projected}
        assert (clip['name'], clip['start'], clip['stop'], clip['loop'], clip['events']) == (
            native['m_Name'], muscle['m_StartTime'], muscle['m_StopTime'], muscle['m_LoopTime'], native['m_Events'])
        assert data['m_DenseClip']['m_CurveCount'] == 0 and data['m_DenseClip']['m_SampleArray'] == []
        bindings, channels = [], []
        for i, binding in enumerate(native['m_ClipBindingConstant']['genericBindings']):
            dimension = {1: 3, 2: 4, 3: 3, 4: 3}[binding['attribute']] if binding['typeID'] == 4 else 1
            normalized = dict(binding)
            normalized['script'] = dict(binding['script'], m_PathID=str(binding['script']['m_PathID']))
            bindings.append(dict(normalized, offset=len(channels), size=dimension))
            for component in range(dimension):
                index = len(channels)
                channels.append({'bindingIndex': i, 'component': component,
                    **({'kind': 'streamed', 'keys': []} if index < stream['curveCount'] else
                       {'kind': 'constant', 'value': constants[index - stream['curveCount']]})})
        binary = struct.pack('<' + 'I' * len(stream['data']), *stream['data'])
        cursor, frames = 0, 0
        while cursor < len(binary):
            time, size = struct.unpack_from('<fi', binary, cursor)
            cursor += 8
            for _ in range(size):
                index, a, b, c, d = struct.unpack_from('<i4f', binary, cursor)
                cursor += 20
                if time >= clip['start'] and math.isfinite(time):
                    channels[index]['keys'].append({'time': time, 'coefficients': [a,b,c,d]})
            frames += 1
        assert clip['bindings'] == bindings and clip['channels'] == channels
        assert clip['sourceFrames'] == frames and clip['streamedWords'] == len(stream['data'])
        expected_times = {clip['start'] - 1, clip['start'], clip['stop'], clip['stop'] + .125}
        for channel in channels:
            keys = channel.get('keys', [])
            for i, point in enumerate(keys):
                expected_times.add(point['time'])
                if i + 1 < len(keys):
                    for fraction in [.25, .5, .75]:
                        expected_times.add(point['time'] + (keys[i + 1]['time'] - point['time']) * fraction)
        assert Counter((s['time'], s['loop']) for s in samples[key]) == Counter(
            (time, loop) for time in expected_times for loop in [False, True])
        for sample in samples[key]:
            time = max(clip['start'], sample['time'])
            if sample['loop'] and time >= clip['stop']:
                time = clip['start'] + (time - clip['start']) % (clip['stop'] - clip['start'])
            else:
                time = min(time, clip['stop'])
            expected = []
            for channel in channels:
                if channel['kind'] == 'constant':
                    expected.append(channel['value'])
                else:
                    keys = channel['keys']
                    index = max(i for i, v in enumerate(keys) if v['time'] <= time)
                    a,b,c,d = keys[index]['coefficients']
                    dt = time - keys[index]['time']
                    expected.append(d if index == len(keys) - 1 else a * dt**3 + b * dt**2 + c * dt + d)
            assert len(sample['values']) == len(expected)
            assert all(math.isfinite(v) and math.isclose(v, e, rel_tol=1e-11, abs_tol=1e-10)
                       for v,e in zip(sample['values'], expected)), ('Changed native sample', key, sample['time'])
            sample_values += len(expected)
        keys_count = sum(len(c.get('keys', [])) for c in channels)
        assert meta['clips'][key] == {k: clip[k] for k in ['name', 'sourceSha256', 'start', 'stop', 'loop']} | {
            'bindings': len(bindings), 'channels': len(channels), 'keys': keys_count}
        total_bindings += len(bindings)
        total_channels += len(channels)
        total_keys += keys_count

    def refs(key, field):
        return [r.get('target') for r in records[key].get('references', []) if r['field'] == field]

    def one(key, field):
        result = refs(key, field)
        assert len(result) == 1 and result[0]
        return result[0]

    expected_instances, properties = [], set()
    classes = {1: 'GameObject', 4: 'Transform', 23: 'MeshRenderer', 96: 'TrailRenderer', 199: 'ParticleSystemRenderer'}
    for animator, record in records.items():
        if record['type'] != 'Animator' or not refs(animator, 'm_Controller'):
            continue
        controller, root = one(animator, 'm_Controller'), one(animator, 'm_GameObject')
        tree = {}

        def traverse(go, relative):
            hash_value = zlib.crc32(relative.encode())
            assert hash_value not in tree
            tree[hash_value] = (go, relative)
            tr = next(k for k in refs(go, 'component') if records[k]['type'] == 'Transform')
            for child in refs(tr, 'm_Children'):
                child_go = one(child, 'm_GameObject')
                child_name = records[child_go]['data']['m_Name']
                traverse(child_go, relative + '/' + child_name if relative else child_name)

        traverse(root, '')
        for key in refs(controller, 'm_AnimationClips'):
            resolved = []
            for b in decoded['clips'][key]['bindings']:
                go, relative = tree[b['path']]
                target = go if b['typeID'] == 1 else next(k for k in refs(go, 'component') if records[k]['type'] == classes[b['typeID']])
                if b['typeID'] == 4:
                    prop = {1: 'm_LocalPosition', 2: 'm_LocalRotation', 3: 'm_LocalScale', 4: 'localEulerAnglesRaw'}[b['attribute']]
                elif b['typeID'] == 1:
                    assert b['attribute'] == zlib.crc32(b'm_IsActive') and b['customType'] == 0
                    prop = 'm_IsActive'
                else:
                    assert b['customType'] == 22
                    candidates = set()
                    for material in refs(target, 'm_Materials'):
                        saved = records[material]['data']['m_SavedProperties']
                        candidates.update(n for table in ['m_Floats', 'm_Colors'] for n,_ in saved[table])
                        candidates.update(n + '_ST' for n,_ in saved['m_TexEnvs'])
                    matches = [n for n in candidates if zlib.crc32(n.encode()) & 0xfffffff == b['attribute'] & 0xfffffff]
                    assert len(matches) == 1
                    suffix = '' if b['attribute'] & 0x80000000 else '.' + (
                        'rgba' if b['attribute'] & 0x40000000 else 'xyzw')[(b['attribute'] // 0x10000000) % 4]
                    prop = 'material.' + matches[0] + suffix
                properties.add(prop)
                resolved.append({'path': relative, 'gameObject': go, 'component': target, 'property': prop})
            expected_instances.append({'animator': animator, 'controller': controller, 'clip': key, 'bindings': resolved})
    assert decoded['instances'] == expected_instances
    assert meta['properties'] == sorted(properties)
    assert meta['counts'] == {'clips':10, 'instances':len(expected_instances), 'bindings':total_bindings,
                              'channels':total_channels, 'keys':total_keys}
    assert meta['counts'] == {'clips':10, 'instances':17, 'bindings':337, 'channels':375, 'keys':342}
    return {'clips':10, 'instances':17, 'channels':375, 'keys':342, 'sampleValues':sample_values}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--manifest', type=Path, default=MANIFEST)
    args = parser.parse_args()
    print(json.dumps(verify(native_clips(), args.directory, args.manifest)))
