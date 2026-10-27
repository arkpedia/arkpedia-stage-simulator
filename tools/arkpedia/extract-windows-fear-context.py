#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain buff activation context and complete action-target code/table bytes."""
from pathlib import Path
import base64
import bisect
import json
import runpy
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
c = runpy.run_path(str(ROOT / 'tools/arkpedia/extract-windows-cast-lifecycle.py'))
v, b = c['v'], c['b']
base = v['image_base']
buff = c['type_row']('Buff', 'Torappu.Battle')
context = c['type_row']('Context', 'Torappu.Battle')
guard = c['unique'](lambda t: t['name'] == 'ChangeGuard', [v['types'][i] for i in context['nested']])
methods = []
for t, names in [(buff, ['OnStart', '_RunActions', 'get_owner', 'get_source', 'get_context']),
                 (guard, ['set_buff', 'set_source', 'set_target', 'Dispose'])]:
    for name in names:
        methods.append(c['method'](t, c['unique'](lambda r: r['name'] == name, t['methods'])))
nodes = c['type_row']('Nodes', 'Torappu.Battle.Action')
row = c['unique'](lambda r: r['name'] == 'GetActionTarget', nodes['methods'])
assert v['pointer'](row) == base + 0xced380
root = v['runtime'][bisect.bisect_right(v['starts'], 0xced380) - 1]
ranges = v['families'][v['parent'](root)]
assert len(ranges) == 1 and root[0] == 0xced380 and root[1] == 0xced5c0
begin, table, end = 0xced380, 0xced594, 0xced5c0
p = v['offset'](base + begin)
raw = b[p:p + end - begin]
code_bytes, table_bytes = raw[:table - begin], raw[table - begin:]
decoded = list(Cs(CS_ARCH_X86, CS_MODE_64).disasm(code_bytes, base + begin))
assert sum(i.size for i in decoded) == len(code_bytes)
targets = list(struct.unpack('<11I', table_bytes))
instructions = [{'rva': i.address - base, 'size': i.size, 'mnemonic': i.mnemonic,
                 'operands': i.op_str} for i in decoded]
lookup = {i['rva']: i for i in instructions}
assert all(target in lookup for target in targets)
for rva, mnemonic, operands in [(0xced3b8, 'cmp', 'edi, 0xa'),
    (0xced3bb, 'ja', '0x180ced57f'), (0xced3c8, 'mov', 'ecx, dword ptr [rdx + rdi*4 + 0xced594]'),
    (0xced3d2, 'jmp', 'rcx')]:
    assert (lookup[rva]['mnemonic'], lookup[rva]['operands']) == (mnemonic, operands)
dispatcher = {'type': nodes['name'], **row, 'entryRva': begin,
    'chunks': [{'beginRva': begin, 'endRva': end, 'unwindRva': root[2],
        'sha256': v['sha'](raw), 'base64': base64.b64encode(raw).decode(),
        'codeEndRva': table, 'codeSha256': v['sha'](code_bytes), 'codeBase64': base64.b64encode(code_bytes).decode(),
        'instructions': instructions, 'jumpTable': {'beginRva': table, 'endRva': end,
            'encoding': 'uint32-image-relative-rva', 'count': 11, 'indexBias': 0, 'targetRvas': targets,
            'sha256': v['sha'](table_bytes), 'base64': base64.b64encode(table_bytes).decode()}}]}
target_field = c['unique'](lambda f: f['name'] == '_targetType', c['fields'](c['type_row']('InstantKill', '')))
assert target_field['typeData'] < len(v['types'])
target_enum = c['enum'](v['types'][target_field['typeData']])
values = {row['name']: row['value'] for row in target_enum['fields']}
assert values['TARGET'] == 0 and values['BUFF_OWNER'] == 3
assert targets[values['TARGET']] == 0xced3d4 and targets[values['BUFF_OWNER']] == 0xced40f
graph_path = 'data/candidates/arkpedia-ch16-fear-projectile-source.json'
result = {'schemaVersion': 1, 'scope': 'Static default buff activation context and action-target routing; no runtime/frame/cross-version parity or stage admission.',
    'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
    'nativeFiles': v['pin']['files'], 'imageBase': base,
    'sources': {path: {'path': path, 'sha256': v['sha']((ROOT / path).read_bytes())} for path in [
        'data/arkpedia-global-windows-client-source.json', graph_path]},
    'methods': methods, 'targetDispatcher': dispatcher, 'targetType': target_enum,
    'buffStartedField': c['unique'](lambda f: f['name'] == 'm_started', c['fields'](buff))}
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
out = ROOT / 'data/candidates/arkpedia-windows-fear-context-source.json'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static buff context evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print(f'Verified {len(methods)} complete buff/context methods and the complete eleven-entry target dispatch table')
