#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain complete default selector code and explicit CN layout differences."""
from pathlib import Path
import json
import runpy
import base64
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v = c['v']
advanced = c['type_row']('AdvancedSelector', 'Torappu.Battle')
options = c['type_row']('TargetOptions', 'Torappu.Battle')
selected = []
for name, names in [
    ('AdvancedSelector', ['get_targetSide', 'get_targetMotion', 'get_targetCategory',
                         'get_onlyIgnoreSomeOfTargetFreeCase', 'get_abnormalFlag', 'get_abnormalCombo',
                         'get_excludeSomeAbnormalFlags', 'get_excludeAbnormalFlag',
                         'ValidateTarget', '_CheckAbilityInputTargetValid', 'OnPostFilter']),
    ('RangeSelector', ['Reset', 'VerifyTarget', 'DoFindTargets_DISPOSE']),
    ('TargetOptions', ['AdvancedOptions', 'Init', 'VerifyTarget', '_VerifyAdvanced']),
    ('BattleUtil', ['VerifyTarget', 'ConvertSideType']),
    ('FilterUtil', ['_Filter_HatredDes']),
    ('Enemy', ['get_hatred']),
]:
    t = c['type_row'](name, 'Torappu.Battle')
    for method_name in names:
        rows = [r for r in t['methods'] if r['name'] == method_name]
        assert rows, (name, method_name)
        selected.extend(c['method'](t, row) for row in rows)

# This one range contains a compiler-generated table after its code. Bind the
# exact dispatcher and table size instead of pretending the data is executable,
# truncating at a failed decode, or relaxing the shared complete-code reader.
filter_type = c['type_row']('FilterUtil', 'Torappu.Battle')
filter_row = c['unique'](lambda r: r['name'] == 'Filter' and v['pointer'](r) != 0, filter_type['methods'])
entry_rva = v['pointer'](filter_row) - v['image_base']
assert entry_rva == 0x769490
runtime = c['unique'](lambda r: r[0] == entry_rva, v['runtime'])
ranges = v['families'][v['parent'](runtime)]
assert len(ranges) == 1
begin, end, unwind = ranges[0]
assert end == 0x76b784
table_rva, count = 0x76b648, 79
assert table_rva + count * 4 == end
p = v['offset'](v['image_base'] + begin)
raw = v['b'][p:p + end - begin]
code_bytes, table_bytes = raw[:table_rva - begin], raw[table_rva - begin:]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(code_bytes, v['image_base'] + begin))
assert sum(i.size for i in decoded) == len(code_bytes)
instructions = [{'rva': i.address - v['image_base'], 'size': i.size,
                 'mnemonic': i.mnemonic, 'operands': i.op_str} for i in decoded]
at = {i['rva']: i for i in instructions}
for rva, mnemonic, operands in [
    (0x76990e, 'cmp', 'ebp, 0x4e'), (0x769911, 'ja', '0x18076b605'),
    (0x769917, 'lea', 'rdx, [rip - 0x76991e]'),
    (0x76991e, 'mov', 'ecx, dword ptr [rdx + rbp*4 + 0x76b648]'),
    (0x769925, 'add', 'rcx, rdx'), (0x769928, 'jmp', 'rcx')]:
    assert at[rva]['mnemonic'] == mnemonic and at[rva]['operands'] == operands
targets = list(struct.unpack('<79I', table_bytes))
assert all(target in at for target in targets)
assert at[table_rva - 2]['mnemonic'] == 'nop'
assert at[0x76b645]['mnemonic'] == 'int3'
dispatcher = {'type': 'FilterUtil', **filter_row, 'entryRva': begin,
              'chunks': [{'beginRva': begin, 'endRva': end, 'unwindRva': unwind,
                          'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
                          'instructions': instructions,
                          'codeRange': {'beginRva': begin, 'endRva': table_rva, 'sha256': v['sha'](code_bytes)},
                          'jumpTable': {'beginRva': table_rva, 'endRva': end, 'entryBytes': 4,
                                        'count': count, 'sha256': v['sha'](table_bytes), 'targetRvas': targets}}]}

# Case4 loads a specific original method-definition usage into its delegate.
delegate_rva = 0x769af3
pos = v['offset'](v['image_base'] + delegate_rva)
assert v['b'][pos:pos + 3] == bytes.fromhex('4c8b05')
delegate_slot = delegate_rva + 7 + struct.unpack_from('<i', v['b'], pos + 3)[0]
delegate_usage = v['quad'](v['b'], v['offset'](v['image_base'] + delegate_slot))
assert delegate_usage >> 29 == 3 and delegate_usage & 1
delegate_index = (delegate_usage & 0x1ffffffe) >> 1
delegate = c['unique'](lambda r: r['index'] == delegate_index, filter_type['methods'])
assert delegate['name'] == '_Filter_HatredDes' and targets[4] == 0x769adb
dispatcher['selectedCase'] = {'value': 4, 'targetRva': targets[4], 'delegateLoadRva': delegate_rva,
                              'delegateSlotRva': delegate_slot, 'encodedUsage': delegate_usage,
                              'method': delegate,
                              'hatredSlot': c['resolved_slot'](c['type_row']('Enemy', 'Torappu.Battle'), 46)}

graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
binding_path = 'data/candidates/arkpedia-ch16-script-bindings-source.json'
graph = json.loads((ROOT / graph_path).read_bytes())
bindings = json.loads((ROOT / binding_path).read_bytes())
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
path_id = '-8465859776667602654'
row = c['unique'](lambda r: r['pathId'] == path_id, graph['prefabs'][prefab])
binding = c['unique'](lambda r: r['prefab'] == prefab and r['componentPathId'] == path_id, bindings['bindings'])
assert binding['componentSha256'] == row['sha256'] == v['sha'](row['originalJson'].encode())
script = json.loads(bindings['scripts'][binding['scriptPathId']]['originalJson'])
assert (script['m_ClassName'], script['m_Namespace'], script['m_AssemblyName']) == (
    'AdvancedSelector', 'Torappu.Battle', 'Assembly-CSharp.dll')
native = json.loads(row['originalJson'])
available = {f['name']: {**f, 'declaringType': t['name']} for t in c['lineage'](advanced)
             if t['namespace'] == 'Torappu.Battle' for f in c['fields'](t)}
unmatched = {k: val for k, val in native.items()
             if k not in available and k not in ['m_Script', 'm_Enabled', 'm_GameObject', 'm_Name']}
assert unmatched == {'_ignoreMotionMode': 0}
assert native['_onlyIgnoreSomeOfTargetFreeCase'] == native['_excludeSomeAbnormalFlags'] == 0
enum_fields = ['_targetSide', '_targetMotion', '_targetCategory', '_postFilter', '_abnormalFlag', '_abnormalCombo']
enums = {}
for key in enum_fields:
    t = v['types'][available[key]['typeData']]
    if key == '_postFilter':
        # Only the selected value is needed; do not claim a complete later
        # FilterType table from the reader's one-byte integer decoder.
        t = {**t, 'fields': [f for f in t['fields'] if f['name'] in ['value__', 'HATRED_DES']]}
    enums[key] = {**c['enum'](t), 'partial': key == '_postFilter'}
fields = {t['name']: {'typeIndex': t['index'], 'fields': c['fields'](t)} for t in [advanced, options]}
# Il2Cpp field offsets for boxed value types include the object header. All
# TargetOptions instance code here receives an unboxed struct pointer.
assert fields['TargetOptions']['fields'][0]['offset'] == 16
for field in fields['TargetOptions']['fields']:
    field['unboxedOffset'] = field['offset'] - 16

result = {
    'schemaVersion': 1,
    'scope': 'Static Global Windows selector defaults with exact CN script binding; no runtime/frame/cross-version parity or admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'metadataVersion': 29, 'imageBase': v['image_base'],
    'sources': {p: {'path': p, 'sha256': v['sha']((ROOT / p).read_bytes())} for p in [
        'data/arkpedia-global-windows-client-source.json', graph_path, binding_path]},
    'selector': {**binding, 'scriptIdentity': script, 'originalJson': row['originalJson'],
                 'matchedFields': {key: available[key] for key in native if key in available},
                 'unmatchedSerializedFields': unmatched, 'serializedFieldParity': False},
    'fields': fields, 'enums': enums,
    'resolvedSlots': [c['resolved_slot'](advanced, slot) for slot in range(25, 39)],
    'methods': selected,
    'filterDispatcher': dispatcher,
    'review': [
        'Exact original CN MonoScript reference identifies AdvancedSelector. Its _ignoreMotionMode=0 field is unmatched in this Windows hierarchy and is not assumed inert. Numeric enum names are Windows evidence, not proof that the earlier CN enum table was identical.',
        'RangeSelector.Reset dispatches actual selector slots into TargetOptions.AdvancedOptions. TargetOptions value-type metadata offsets include a 16-byte boxed header; explicit unboxed offsets match the struct pointers used by its compiled methods.',
        'TargetOptions._VerifyAdvanced reads abnormalFlag/abnormalCombo only in the branch requiring ignoreTargetFree and onlyIgnoreSomeOfTargetFreeCase. The CN selector has both switches zero. Its serialized abnormalFlag=42 does not establish a requirement to select feared targets in this default path.',
        'Explicit abnormal exclusion is separately gated by excludeSomeAbnormalFlags, which is also zero in the CN selector. The numeric excludeAbnormalFlag=46 is not interpreted as an active filter merely because it is serialized. Other inherited and implicit target-free checks remain in the complete bodies.',
        'FilterUtil.Filter retains its entire PE range as completely decoded code plus a bounded 79-entry RVA jump table. The actual cmp/unsigned bound, image-base LEA and indirect jump bind the table; every destination is a decoded instruction boundary. No undecoded bytes are omitted or relabeled by a generic fallback.',
        'Selected case4 resolves the original delegate metadata usage to _Filter_HatredDes. That key producer reads virtual hatred slot46; Enemy resolves this to its own get_hatred implementation, retained independently. Generic sorting/comparison and tie behavior still require review; no full sort/frame parity is claimed from dispatch/key evidence alone. The fear projectile, self-death and mode-switch lifetime require independent integration tests before stage16-9 admission.',
    ],
}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-selector-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows fear-selector evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(selected)} complete native selector methods and exact CN selector binding')
