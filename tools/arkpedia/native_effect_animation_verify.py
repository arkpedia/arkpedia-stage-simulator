#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Independently check decoded channels/bindings and samples against native data.

This checks source recovery and scalar polynomial evaluation, not Unity FSM,
shader execution, geometry conversion or compiled floating-point/frame parity.
"""
from collections import Counter
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zlib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy


def legacy_euler(native):
    """Read unweighted source tangents independently of the JS stream decoder."""
    assert native['m_Legacy'] is True and native['m_Compressed'] is False
    assert native['m_MuscleClipSize'] == 0 and native['m_WrapMode'] == 2
    assert all(native[k] == [] for k in ['m_RotationCurves', 'm_CompressedRotationCurves',
        'm_PositionCurves', 'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves'])
    data = native['m_MuscleClip']['m_Clip']['data']
    assert data['m_StreamedClip'] == {'curveCount': 0, 'data': []}
    assert data['m_DenseClip']['m_CurveCount'] == 0 and data['m_DenseClip']['m_SampleArray'] == []
    assert data['m_ConstantClip']['data'] == []
    assert native['m_ClipBindingConstant'] == {'genericBindings': [], 'pptrCurveMapping': []}
    bindings, channels, paths, stops = [], [], set(), set()
    for index, entry in enumerate(native['m_EulerCurves']):
        curve = entry['curve']
        assert entry['path'] not in paths
        paths.add(entry['path'])
        assert (curve['m_RotationOrder'], curve['m_PreInfinity'], curve['m_PostInfinity']) == (4, 2, 2)
        points = curve['m_Curve']
        assert len(points) >= 2 and points[0]['time'] == 0
        assert all(p['weightedMode'] == 0 for p in points)
        assert all(a['time'] < b['time'] for a, b in zip(points, points[1:]))
        stops.add(points[-1]['time'])
        bindings.append({'path': entry['path'], 'typeID': 4, 'attribute': 4, 'rotationOrder': 'ZXY',
                         'offset': len(channels), 'size': 3})
        for component, axis in enumerate('xyz'):
            keys = []
            for i, point in enumerate(points):
                v, tangent = point['value'][axis], point['outSlope'][axis]
                coefficients = [0, 0, 0, v]
                if i + 1 < len(points):
                    following = points[i + 1]
                    dt = following['time'] - point['time']
                    dv, incoming = following['value'][axis] - v, following['inSlope'][axis]
                    coefficients = [((tangent + incoming) * dt - 2 * dv) / (dt * dt * dt),
                        (3 * dv - (2 * tangent + incoming) * dt) / (dt * dt), tangent, v]
                keys.append({'time': point['time'], 'coefficients': coefficients})
            channels.append({'bindingIndex': index, 'component': component, 'kind': 'legacy-euler', 'keys': keys})
    assert len(stops) == 1 and next(iter(stops)) > 0
    return bindings, channels, next(iter(stops))


def sample_legacy(native, time):
    values = []
    for entry in native['m_EulerCurves']:
        keys = entry['curve']['m_Curve']
        i = max(i for i, key in enumerate(keys) if key['time'] <= time)
        a = keys[i]
        for axis in 'xyz':
            value = a['value'][axis]
            if i + 1 < len(keys):
                b = keys[i + 1]
                dt = b['time'] - a['time']
                t = (time - a['time']) / dt
                # Hermite basis, rather than evaluating exported coefficients.
                value = ((2*t**3 - 3*t**2 + 1) * value
                    + (t**3 - 2*t**2 + t) * dt * a['outSlope'][axis]
                    + (-2*t**3 + 3*t**2) * b['value'][axis]
                    + (t**3 - t**2) * dt * b['inSlope'][axis])
            values.append(value)
    return values


def native_clips(spec):
    # Independent effect hierarchy/pixel/mesh audit precedes path resolution.
    from native_effect_verify import verify
    directory = ROOT / '.cache/arkpedia' / spec['source_directory'] / 'effects'
    verify(ROOT / '.cache/arkpedia', directory, ROOT / spec['source_manifest'], spec['effects'])
    env = UnityPy.Environment()
    env.load_file(str(ROOT / '.cache/arkpedia' / spec['local_bundle']))
    return {spec['source_bundle'] + ':' + str(o.path_id): o
            for o in env.objects if o.type.name == 'AnimationClip' and o.path_id in
            {int(k.rsplit(':', 1)[1]) for k, r in json.load(gzip.open(directory / 'native-effects.bin'))['records'].items()
             if r['type'] == 'AnimationClip'}}


def verify(originals, directory, manifest, spec):
    source_directory = ROOT / '.cache/arkpedia' / spec['source_directory'] / 'effects'
    pack_bytes = (source_directory / 'native-effects.bin').read_bytes()
    pack = json.loads(gzip.decompress(pack_bytes))
    records = pack['records']
    raw = (directory / 'native-animations.json').read_bytes()
    decoded, meta = json.loads(raw), json.loads(manifest.read_text())
    assert meta['artifact'] == {'path': 'native-animations.json', 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    assert meta['sourcePackSha256'] == decoded['sourcePackSha256'] == hashlib.sha256(pack_bytes).hexdigest()
    assert meta['operator'] == decoded['operator'] == spec['operator']
    assert meta['version'] == decoded['version'] == pack['version']
    assert meta['schemaVersion'] == decoded['schemaVersion'] == 1
    assert decoded['coordinates'] == 'original-unity'
    assert meta['scope']['sourceChannelsOnly'] is True
    assert meta['scope']['rendererVerified'] is False and meta['scope']['compiledFrameParity'] is False
    assert meta['scope']['enabledOperators'] == [] and len(meta['scope']['pending']) == 2
    assert set(decoded['clips']) == set(meta['clips']) == set(originals) and len(originals) == spec['counts']['clips']
    samples = json.loads((directory / 'native-animation-samples.json').read_text())
    assert set(samples) == set(originals)
    fixture_bytes = (ROOT / spec['fixture_path']).read_bytes()
    fixtures = json.loads(fixture_bytes)
    assert meta['fixture'] == {'path': spec['fixture_path'],
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
        legacy = native.get('m_Legacy') is True
        if legacy:
            projected.update({k: native[k] for k in ['m_Legacy', 'm_Compressed', 'm_MuscleClipSize', 'm_WrapMode']})
            bindings, channels, stop = legacy_euler(native)
            assert clip['format'] == 'legacy-euler'
            start, loop = 0, True
        else:
            assert 'format' not in clip
            start, stop, loop = muscle['m_StartTime'], muscle['m_StopTime'], muscle['m_LoopTime']
        assert (clip['name'], clip['start'], clip['stop'], clip['loop'], clip['events']) == (
            native['m_Name'], start, stop, loop, native['m_Events'])
        assert data['m_DenseClip']['m_CurveCount'] == 0 and data['m_DenseClip']['m_SampleArray'] == []
        if not legacy:
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
        cursor, frames, initial = 0, 0, {}
        while cursor < len(binary):
            time, size = struct.unpack_from('<fi', binary, cursor)
            cursor += 8
            for _ in range(size):
                index, a, b, c, d = struct.unpack_from('<i4f', binary, cursor)
                cursor += 20
                if frames == 0:
                    initial[index] = [a,b,c,d]
                if time >= clip['start'] and math.isfinite(time):
                    channels[index]['keys'].append({'time': time, 'coefficients': [a,b,c,d]})
            frames += 1
        for i, channel in enumerate(channels):
            if channel['kind'] == 'streamed' and (not channel['keys'] or channel['keys'][0]['time'] > start):
                assert initial[i][:3] == [0,0,0] and initial[i][3] == muscle['m_ValueArrayDelta'][i]['m_Start']
                channel['initialValue'] = initial[i][3]
                projected['m_MuscleClip']['m_ValueArrayDelta'] = muscle['m_ValueArrayDelta']
        assert fixtures[key] == {'sourceSha256': clip['sourceSha256'], 'data': projected}
        assert clip['bindings'] == bindings and clip['channels'] == channels
        assert clip['sourceFrames'] == frames and clip['streamedWords'] == len(stream['data'])
        expected_times = {clip['start'] - 1, clip['start'], clip['stop'], clip['stop'] + .125}
        for channel in channels:
            keys = channel.get('keys', [])
            if keys and keys[0]['time'] > start:
                expected_times.add((keys[0]['time'] + start) / 2)
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
            expected = sample_legacy(native, time) if legacy else []
            for channel in [] if legacy else channels:
                if channel['kind'] == 'constant':
                    expected.append(channel['value'])
                else:
                    keys = channel['keys']
                    if not keys or time < keys[0]['time']:
                        expected.append(channel['initialValue'])
                        continue
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

    expected_instances, properties, unresolved, material_slots, ambiguous = [], set(), [], [], []
    classes = {1: 'GameObject', 4: 'Transform', 23: 'MeshRenderer', 96: 'TrailRenderer', 120: 'LineRenderer', 199: 'ParticleSystemRenderer'}
    for animator, record in records.items():
        legacy = record['type'] == 'Animation'
        if record['type'] not in ['Animator', 'Animation'] or (not legacy and not refs(animator, 'm_Controller')):
            continue
        controller, root = None if legacy else one(animator, 'm_Controller'), one(animator, 'm_GameObject')
        tree = {}

        def traverse(go, relative):
            hash_value = relative if legacy else zlib.crc32(relative.encode())
            tree.setdefault(hash_value, []).append((go, relative))
            tr = next(k for k in refs(go, 'component') if records[k]['type'] == 'Transform')
            for child in refs(tr, 'm_Children'):
                child_go = one(child, 'm_GameObject')
                child_name = records[child_go]['data']['m_Name']
                traverse(child_go, relative + '/' + child_name if relative else child_name)

        traverse(root, '')
        for path, nodes in tree.items():
            if len(nodes) > 1:
                ambiguous.append({'driver': animator, 'path': path,
                    'nodes': [{'path': relative, 'gameObject': go} for go, relative in nodes]})
        keys = refs(animator, 'm_Animations') if legacy else refs(controller, 'm_AnimationClips')
        if legacy:
            assert record['data']['m_WrapMode'] == 0 and one(animator, 'm_Animation') in keys
            assert len(keys) == len(set(keys))
        for key in keys:
            assert legacy == (decoded['clips'][key].get('format') == 'legacy-euler')
            resolved = []
            for binding_index, b in enumerate(decoded['clips'][key]['bindings']):
                if b['path'] not in tree:
                    entry = {'reason':'missing-original-path', 'pathHash':b['path'], 'typeID':b['typeID'], 'attribute':b['attribute']}
                    resolved.append({'unresolved':entry})
                    unresolved.append({'animator':animator, 'controller':controller, 'clip':key, 'bindingIndex':binding_index, **entry})
                    continue
                assert len(tree[b['path']]) == 1, 'Ambiguous bound native path'
                go, relative = tree[b['path']][0]
                targets = [go] if b['typeID'] == 1 else [k for k in refs(go, 'component') if records[k]['type'] == classes[b['typeID']]]
                assert len(targets) == 1
                target = targets[0]
                if b['typeID'] == 4:
                    prop = {1: 'm_LocalPosition', 2: 'm_LocalRotation', 3: 'm_LocalScale', 4: 'localEulerAnglesRaw'}[b['attribute']]
                elif b['typeID'] == 1:
                    assert b['attribute'] == zlib.crc32(b'm_IsActive') and b['customType'] == 0
                    prop = 'm_IsActive'
                elif b['typeID'] == 120 and b['customType'] == 29:
                    assert b['attribute'] == zlib.crc32(b'm_Parameters.widthMultiplier')
                    assert math.isfinite(records[target]['data']['m_Parameters']['widthMultiplier'])
                    prop = 'm_Parameters.widthMultiplier'
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
                entry = {'path': relative, 'gameObject': go, 'component': target, 'property': prop}
                if prop.startswith('material.'):
                    name, seen, slots = prop.split('.')[1], set(), []
                    for index, material in enumerate(refs(target, 'm_Materials')):
                        saved = records[material]['data']['m_SavedProperties']
                        if material in seen:
                            continue
                        seen.add(material)
                        if (any(n == name for table in ['m_Floats', 'm_Colors'] for n,_ in saved[table])
                                or any(n + '_ST' == name for n,_ in saved['m_TexEnvs'])):
                            slots.append(index)
                    assert slots
                    if slots != [0]:
                        entry['sourceMaterialSlots'] = slots
                        material_slots.append({'animator':animator, 'controller':controller, 'clip':key,
                            'bindingIndex':binding_index, 'component':target, 'property':prop, 'slots':slots})
                resolved.append(entry)
            expected_instances.append({'animation': animator, 'defaultClip': one(animator, 'm_Animation'),
                'playAutomatically': record['data']['m_PlayAutomatically'], 'enabled': record['data']['m_Enabled'],
                'wrapMode': record['data']['m_WrapMode'], 'clip': key, 'bindings': resolved} if legacy else
                {'animator': animator, 'controller': controller, 'clip': key, 'bindings': resolved})
    assert decoded['instances'] == expected_instances
    assert meta['properties'] == sorted(properties)
    assert meta['counts'] == {'clips':len(originals), 'instances':len(expected_instances), 'bindings':total_bindings,
                              'channels':total_channels, 'keys':total_keys}
    assert meta['counts'] == spec['counts']
    assert len(unresolved) == spec.get('unresolved_bindings', 0)
    assert len(material_slots) == spec.get('material_slot_bindings', 0)
    assert len(ambiguous) == spec.get('unbound_ambiguous_paths', 0)
    if ambiguous:
        assert meta['unboundAmbiguousPaths'] == ambiguous
    else:
        assert 'unboundAmbiguousPaths' not in meta
    if material_slots:
        assert meta['materialSlotBindings'] == material_slots
    else:
        assert 'materialSlotBindings' not in meta
    if unresolved:
        assert meta['unresolvedBindings'] == unresolved
    else:
        assert 'unresolvedBindings' not in meta
    return {'clips':len(originals), 'instances':len(expected_instances), 'channels':total_channels,
            'keys':total_keys, 'sampleValues':sample_values, **({'unresolvedBindings':len(unresolved)} if unresolved else {}),
            **({'materialSlotBindings':len(material_slots)} if material_slots else {})}
