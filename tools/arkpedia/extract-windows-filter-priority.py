#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain exact generic priority queue code and its reference-sharing context."""
from pathlib import Path
import json
import runpy
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v, b = c['v'], c['b']
reg = v['registration']
spec_count = v['quad'](b, reg + 64)
spec_start = v['offset'](v['quad'](b, reg + 72))
map_start = v['offset'](v['quad'](b, reg + 40))
mapping = {}
for n in range(v['quad'](b, reg + 32)):
    row = struct.unpack_from('<iiii', b, map_start + n * 16)
    assert row[0] not in mapping
    mapping[row[0]] = {'methodPointerIndex': row[1], 'invokerIndex': row[2], 'adjustorThunkIndex': row[3]}


def specification(index):
    assert 0 <= index < spec_count
    definition, class_inst, method_inst = struct.unpack_from('<iii', b, spec_start + index * 12)
    owner, method = c['unique'](lambda pair: pair[1]['index'] == definition,
                              [(t, m) for t in v['types'] for m in t['methods']])
    instances = {}
    for label, instance_index in [('class', class_inst), ('method', method_inst)]:
        if instance_index < 0:
            continue
        assert instance_index < v['quad'](b, reg + 16)
        table = v['offset'](v['quad'](b, reg + 24))
        inst = v['offset'](v['quad'](b, table + instance_index * 8))
        count = v['quad'](b, inst)
        args = v['offset'](v['quad'](b, inst + 8))
        types = []
        for n in range(count):
            tp = v['offset'](v['quad'](b, args + n * 8))
            data, bits = v['quad'](b, tp), v['uint'](b, tp + 8)
            assert data < len(v['types'])
            t = v['types'][data]
            types.append({'namespace': t['namespace'], 'name': t['name'], 'typeIndex': data, 'typeBits': bits})
        instances[label] = {'index': instance_index, 'arguments': types}
    return {'index': index, 'definition': method, 'declaringType': owner['name'],
            'declaringTypeIndex': owner['index'], 'instantiations': instances,
            'nativeMapping': mapping.get(index)}


# Locate one table using two independent mapped native pointer anchors. The
# concrete Entity specialization shares reference code; do not invent a direct
# metadata mapping for it when only the Object canonical entry is present.
filter_spec, math_spec = specification(211142), specification(212151)
assert filter_spec['declaringType'] == 'FilterUtil' and filter_spec['definition']['name'] == 'Filter'
assert filter_spec['instantiations']['method']['arguments'][0]['name'] == 'Object'
assert math_spec['declaringType'] == 'MathUtil' and math_spec['definition']['name'] == 'Max'
needle = struct.pack('<Q', v['image_base'] + 0x3fc6ca0)
matches, pos = [], 0
while (pos := b.find(needle, pos)) >= 0:
    start = pos - filter_spec['nativeMapping']['methodPointerIndex'] * 8
    check = start + math_spec['nativeMapping']['methodPointerIndex'] * 8
    if start >= 0 and check + 8 <= len(b) and v['quad'](b, check) == v['image_base'] + 0x400deb0:
        matches.append(start)
    pos += 8
assert len(matches) == 1
pointer_table = matches[0]
generic_methods = []
for index in [211142, 184749, 184753]:
    spec = specification(index)
    pointer = v['quad'](b, pointer_table + spec['nativeMapping']['methodPointerIndex'] * 8)
    generic_methods.append({**spec, 'entryRva': pointer - v['image_base'], 'chunks': c['code'](pointer - v['image_base'])})
assert [r['entryRva'] for r in generic_methods] == [0x3fc6ca0, 0x4a5f460, 0x4a5eaa0]
concrete = specification(264779)
assert concrete['definition'] == filter_spec['definition'] and concrete['nativeMapping'] is None
assert concrete['instantiations']['method']['arguments'][0]['name'] == 'Entity'

methods = []
for name, names in [('FilterUtil', ['.cctor', '_SecondFilterInExtraMode']), ('Entity', ['CompareTo'])]:
    t = c['type_row'](name, 'Torappu.Battle')
    for method_name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == method_name, t['methods'])))
for image, wanted in [('Torappu.Common.dll', [0x5a3d680, 0x5a5c600, 0x5a40d30])]:
    module = c['module'](image)
    rows = v['types'][module['typeStart']:module['typeStart'] + module['typeCount']]
    table = v['offset'](v['image_base'] + module['methodPointerTableRva'])
    for rva in wanted:
        candidates = [(t, m) for t in rows for m in t['methods']
                      if v['quad'](b, table + ((m['token'] & 0xffffff) - 1) * 8) == v['image_base'] + rva]
        t, method = c['unique'](lambda pair: True, candidates)
        methods.append(c['method'](t, method, image))
assert [(r['type'], r['name']) for r in methods[-3:]] == [
    ('FP', 'op_Division'), ('TSMath', 'Floor'), ('MathUtil', 'Equals')]
bobject = c['type_row']('BObject', 'Torappu.Battle')
uid = c['unique'](lambda f: f['name'] == '<instanceUid>k__BackingField', c['fields'](bobject))
assert uid['offset'] == 0x18
filter_type = c['type_row']('FilterUtil', 'Torappu.Battle')
gap_field = c['unique'](lambda f: f['name'] == 'HATRED_WEIGHT_SMALL_ENOUGH_GAP', c['fields'](filter_type))
assert gap_field['offset'] == 8
gap_instruction = 0x7734c1
p = v['offset'](v['image_base'] + gap_instruction)
assert b[p:p + 4] == bytes.fromhex('f30f1005')
gap_rva = gap_instruction + 8 + struct.unpack_from('<i', b, p + 4)[0]
gap_raw = b[v['offset'](v['image_base'] + gap_rva):v['offset'](v['image_base'] + gap_rva) + 4]
assert gap_raw.hex() == 'cdcccc3d'

result = {
    'schemaVersion': 1,
    'scope': 'Static default reference-shared priority filtering; concrete RGCTX execution, CN/frame parity and enemy/stage admission unverified.',
    'runtimeDispatchVerified': False, 'concreteContextVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'metadataVersion': 29, 'imageBase': v['image_base'],
    'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())} for p in [
        'data/arkpedia-global-windows-client-source.json', 'data/candidates/arkpedia-windows-fear-selector-source.json']},
    'genericPointerTableRva': v['address'](pointer_table) - v['image_base'],
    'pointerAnchors': [filter_spec, math_spec], 'concreteFilterSpecification': concrete,
    'genericMethods': generic_methods, 'methods': methods,
    'unresolvedWeightComparison': {'entryRva': 0x546a3e0, 'metadataIdentityVerified': False,
                                   'bodyRetained': False,
                                   'reason': 'No PE unwind entry or separately reviewed leaf boundary; only caller references are retained.'},
    'instanceUidField': uid,
    'hatredGap': {'field': gap_field, 'instructionRva': gap_instruction, 'valueRva': gap_rva,
                  'hex': gap_raw.hex(), 'float32': struct.unpack('<f', gap_raw)[0]},
    'review': [
        'Case4 passes HATRED_WEIGHT_SMALL_ENOUGH_GAP (float32 0.1 converted to FP) into the concrete Entity Filter specification. The native call reaches a reference-shared generic body; the independently mapped Object canonical specialization is retained, without inventing a direct concrete mapping.',
        'The generic body filters eligible targets, computes weighted entries and maintains a bounded PriorityQueue, removing its last entry when over the requested maximum. It does not perform a plain stable list sort.',
        'WeightedTarget.CompareTo first compares priorWeight. It divides each primary weight by the current gap and floors the result before comparison; equal bins reach the target comparison interface. Concrete interface/RGCTX execution remains separate from this shared-body evidence.',
        'Entity.CompareTo reads BObject.instanceUid at offset0x18 and calls the integer comparison implementation. That is distinct from the string Entity.id backing field; source instance UID ordering must not be replaced by an assumed string/spawn-order tie.',
        '_SecondFilterInExtraMode is a separate sandbox-mode hook, not evidence of a distance tie-break. No projectile controller, stage support or full scheduler/frame parity follows from these static methods.'
    ]}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-filter-priority-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows priority-filter evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified generic priority filter, quantized weight comparator and instance UID tie source')
