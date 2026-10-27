#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain default ability/entity family-group attachment lookup."""
from pathlib import Path
import base64
import json
import runpy
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
p = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-filter-priority.py'))
paths = ['data/candidates/arkpedia-windows-cast-lifecycle-source.json', 'data/candidates/arkpedia-windows-fear-projectile-action-init-source.json']
raws = {path: (ROOT / path).read_bytes() for path in paths}
assert raws[paths[0]].decode() == c['serialized']
methods = []
for ti, index, entry in [(8742, 54622, 0x390f1a0), (9044, 58028, 0x3a1b6f0)]:
    row = c['unique'](lambda r: r['index'] == index, v['types'][ti]['methods'])
    method = c['method'](v['types'][ti], row)
    assert method['entryRva'] == entry
    methods.append(method)
slot = c['resolved_slot'](v['types'][11695], 46)
assert slot['index'] == 54622
fields = []
for ti, name, offset in [(8742, '<options>k__BackingField', 0x90), (8736, 'familyGroup', 0x2c), (9044, 'm_abilityAttachments', 0x100)]:
    f = c['unique'](lambda f: f['name'] == name, c['fields'](v['types'][ti]))
    assert f['offset'] == offset
    fields.append({'declaringTypeIndex': ti, **f})
assert fields[0]['typeData'] == 8736 and fields[1]['typeData'] == 8738
enum_values = []
for value, name in enumerate(['ATTACK', 'COMBAT', 'SKILL', 'TALENT', 'GENERAL', 'E_NUM']):
    f = c['unique'](lambda f: f['name'] == name, v['types'][8738]['fields'])
    ti, di = v['defaults'][f['index']]
    pos = v['uint'](v['m'], 72) + di
    encoded = v['m'][pos]
    assert encoded == value * 2  # Bounded selected nonnegative Int32 zigzag defaults.
    enum_values.append({'name': name, 'value': value, 'fieldIndex': f['index'], 'defaultTypeIndex': ti,
                        'defaultFileOffset': pos, 'encodedHex': bytes([encoded]).hex()})
load = 0x3a1b759
pos = v['offset'](v['image_base'] + load)
assert v['b'][pos:pos + 3] == bytes.fromhex('488b15')
address = load + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
usage = v['quad'](v['b'], v['offset'](v['image_base'] + address))
assert usage >> 29 == 6 and (usage & 0x1ffffffe) >> 1 == 264121
spec = p['specification'](264121)
assert spec['definition']['name'] == 'Convert' and spec['declaringType'] == 'EnumInt32ToInt'
assert spec['instantiations']['method']['arguments'][0]['typeIndex'] == 8738
entry = 0x28a66d0
pos = v['offset'](v['image_base'] + entry)
raw = v['b'][pos:pos + 3]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, v['image_base'] + entry))
assert raw.hex() == '8bc1c3'
assert [(i.mnemonic, i.op_str) for i in decoded] == [('mov', 'eax, ecx'), ('ret', '')]
leaf = {'beginRva': entry, 'endRva': entry + 3, 'unwindRva': None,
        'boundary': 'Individually reviewed complete mov/ret identity leaf at the direct caller target; no shared-reader relaxation',
        'base64': base64.b64encode(raw).decode(), 'sha256': v['sha'](raw),
        'instructions': [{'rva': i.address - v['image_base'], 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]}
result = {'schemaVersion': 1, 'scope': 'Default ability options familyGroup and entity attachment array lookup; hotfixes and live runtime effects remain held.',
          'testOnly': True, 'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'nativeFiles': v['pin']['files'], 'sources': {path: {'path': path, 'sha256': v['sha'](raw)} for path, raw in raws.items()},
          'methods': methods, 'fields': fields, 'abilitySlot': slot, 'familyGroup': {'typeIndex': 8738, 'values': enum_values},
          'conversion': {'loadRva': load, 'encodedUsage': usage, 'specification': spec, 'directCallRva': 0x3a1b769, 'leaf': leaf},
          'ability': {'firstOwnerCall': 0x390f1f9, 'nullCall': 0x390f21e, 'secondOwnerCall': 0x390f230,
                      'optionsTailRead': 0x390f2a0, 'groupExtract': 0x390f2b1, 'ownerNullCheck': 0x390f2e6, 'entityCall': 0x390f2fd},
          'entity': {'arrayCapture': 0x3a1b762, 'boundsCheck': 0x3a1b775, 'elementRead': 0x3a1b77a},
          'nativeArrayEffectsVerified': False, 'nativeOptionsCopyEffectsVerified': False,
          'hotfixDispatchVerified': False, 'liveAttachmentLookupVerified': False}
out = ROOT / 'data/candidates/arkpedia-windows-fear-projectile-attachments-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static projectile attachment evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified family-group attachment lookup, separate owner reads and exact enum identity leaf')
