#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Static v29 metadata/PE evidence. Never execute the client or its launcher.

Layout reference: Perfare/Il2CppDumper@4741d46ba9cd6159c5d853eb9d6fc48b4bfa2b1a,
Il2CppDumper/Il2Cpp/MetadataClass.cs. The reader below is intentionally limited
to the reviewed v29/x64 inputs; unknown layouts fail rather than being guessed.
"""
from pathlib import Path
import base64
import bisect
import hashlib
import json
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache/arkpedia/global-windows-client'
sources = {}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    raw = (ROOT / path).read_bytes()
    sources[path] = {'path': path, 'bytes': len(raw), 'sha256': sha(raw)}
    return raw


pin_raw = read('data/arkpedia-global-windows-client-source.json')
pin = json.loads(pin_raw)
loaded = {}
for name in ['GameAssembly.dll', 'global-metadata.dat']:
    raw = (CACHE / name).read_bytes()
    expected = next(f for f in pin['files'] if f['path'].endswith('/' + name))
    assert len(raw) == expected['bytes'] and sha(raw) == expected['sha256']
    loaded[name] = raw
b, m = loaded['GameAssembly.dll'], loaded['global-metadata.dat']


def uint(buf, offset):
    return struct.unpack_from('<I', buf, offset)[0]


def sint(buf, offset):
    return struct.unpack_from('<i', buf, offset)[0]


def quad(buf, offset):
    return struct.unpack_from('<Q', buf, offset)[0]


assert uint(m, 0) == 0xFAB11BAF and uint(m, 4) == 29
string_start = uint(m, 24)


def text(index):
    pos = string_start + index
    assert string_start <= pos < string_start + uint(m, 28)
    return m[pos:m.index(b'\0', pos)].decode('utf8')


type_start, type_size = uint(m, 160), uint(m, 164)
method_start, method_size = uint(m, 48), uint(m, 52)
field_start, field_size = uint(m, 96), uint(m, 100)
assert type_size % 88 == method_size % 32 == field_size % 12 == 0
types = []
for index in range(type_size // 88):
    p = type_start + index * 88
    method_count, _, field_count, _, nested_count = struct.unpack_from('<HHHHH', m, p + 64)
    fs, ms, ns = sint(m, p + 32), sint(m, p + 36), sint(m, p + 48)
    fields = []
    for n in range(field_count):
        fp = field_start + (fs + n) * 12
        fields.append({'index': fs + n, 'name': text(uint(m, fp)), 'typeIndex': sint(m, fp + 4)})
    methods = []
    for n in range(method_count):
        mp = method_start + (ms + n) * 32
        methods.append({'index': ms + n, 'name': text(uint(m, mp)), 'token': uint(m, mp + 20)})
    nested = [sint(m, uint(m, 128) + (ns + n) * 4) for n in range(nested_count)]
    types.append({'index': index, 'name': text(uint(m, p)), 'namespace': text(uint(m, p + 4)),
                  'fields': fields, 'methods': methods, 'nested': nested})


def unique(predicate, rows):
    matches = [r for r in rows if predicate(r)]
    assert len(matches) == 1, f'Expected unique source binding, got {len(matches)}'
    return matches[0]


owner = unique(lambda t: t['name'] == 'AbilityStandard' and t['namespace'] == 'Torappu.Battle', types)
wrapper = unique(lambda t: t['name'] == 'BuffToOwner' and t['namespace'] == 'Torappu.Battle.Abilities', types)
event = unique(lambda t: t['name'] == 'Event', [types[n] for n in owner['nested']])
coroutine = unique(lambda t: t['name'].startswith('<_DoCast>'), [types[n] for n in owner['nested']])
defaults = {sint(m, p): (sint(m, p + 4), sint(m, p + 8))
            for p in range(uint(m, 64), uint(m, 64) + uint(m, 68), 12)}
enum_fields = []
for field in event['fields']:
    if field['name'] == 'value__':
        continue
    data_type, data_index = defaults[field['index']]
    offset = uint(m, 72) + data_index
    encoded = m[offset]
    # This reviewed enum contains only single-byte compressed signed integers.
    assert encoded < 128
    value = ~(encoded >> 1) if encoded & 1 else encoded >> 1
    enum_fields.append({**field, 'defaultTypeIndex': data_type, 'defaultFileOffset': offset,
                        'encodedHex': bytes([encoded]).hex(), 'value': value})
assert {f['name']: f['value'] for f in enum_fields} == {
    'ON_ATTACHED': 0, 'ON_DETACHED': 1, 'ON_CAST_START': 2, 'ON_CAST_END': 3,
    'ON_SPELL_ON': 4, 'ON_SPELL_END': 5, 'ON_ATTACK_FINISH': 6,
    'ON_ATTACK_CHECK_POINT': 7, 'ON_OVERLOAD': 8}

pe = uint(b, 0x3c)
assert b[:2] == b'MZ' and b[pe:pe + 4] == b'PE\0\0'
assert struct.unpack_from('<H', b, pe + 4)[0] == 0x8664
optional = pe + 24
assert struct.unpack_from('<H', b, optional)[0] == 0x20b
image_base = quad(b, optional + 24)
sections = []
for n in range(struct.unpack_from('<H', b, pe + 6)[0]):
    p = optional + struct.unpack_from('<H', b, pe + 20)[0] + n * 40
    vs, va, rs, rp = struct.unpack_from('<IIII', b, p + 8)
    sections.append((va, vs, rp, rs))


def offset(va):
    for v, _, r, size in sections:
        if image_base + v <= va < image_base + v + size:
            return r + va - image_base - v
    raise AssertionError(f'Address not backed by file bytes: {va:x}')


def address(raw_offset):
    for v, _, r, size in sections:
        if r <= raw_offset < r + size:
            return image_base + v + raw_offset - r
    raise AssertionError('Unmapped file offset')


name = b.index(b'Assembly-CSharp.dll\0')
module_matches = []
pos, needle = 0, struct.pack('<Q', address(name))
while (pos := b.find(needle, pos)) >= 0:
    if 0 < quad(b, pos + 8) <= method_size // 32:
        module_matches.append(pos)
    pos += 8
assert len(module_matches) == 1
module = module_matches[0]
method_count, method_pointer_va = quad(b, module + 8), quad(b, module + 16)
method_table = offset(method_pointer_va)
# Resolve a metadata token only after binding its type to this exact image.
image_rows = [struct.unpack_from('<10I', m, p) for p in range(uint(m, 168), uint(m, 168) + uint(m, 172), 40)]
image = unique(lambda row: text(row[0]) == 'Assembly-CSharp.dll', image_rows)
assert all(image[2] <= t['index'] < image[2] + image[3] for t in [owner, wrapper, event, coroutine])
image_types = types[image[2]:image[2] + image[3]]
assert max(method['token'] & 0xffffff for t in image_types for method in t['methods']) == method_count

# Locate the registration through both independent type-definition count pairs.
registrations, pos = [], 0
needle = struct.pack('<Q', len(types))
while (pos := b.find(needle, pos)) >= 0:
    if pos >= 80 and quad(b, pos + 16) == len(types):
        candidate = pos - 80
        if quad(b, candidate + 48) > len(types) and quad(b, candidate + 112) == 0:
            try:
                offset(quad(b, candidate + 56))
                offset(quad(b, candidate + 88))
                offset(quad(b, candidate + 104))
                registrations.append(candidate)
            except AssertionError:
                pass
    pos += 8
assert len(registrations) == 1
registration = registrations[0]
type_table = offset(quad(b, registration + 56))
field_table = offset(quad(b, registration + 88))
wrapper_field_data = offset(quad(b, field_table + wrapper['index'] * 8))
fields = []
for n, field in enumerate(wrapper['fields'][:10]):
    ptr = quad(b, type_table + field['typeIndex'] * 8)
    type_bytes = b[offset(ptr):offset(ptr) + 12]
    fields.append({**field, 'offset': sint(b, wrapper_field_data + n * 4),
                   'typeData': quad(type_bytes, 0), 'typeBits': uint(type_bytes, 8)})
run_field = unique(lambda f: f['name'] == '_runActionOnEvent', fields)
assert run_field['typeData'] == event['index'] and (run_field['typeBits'] >> 16) & 255 == 0x11
assert run_field['offset'] == 0x30
hotfix_field = unique(lambda f: f['name'] == '__Hotfix0_OnEvent', wrapper['fields'])
hotfix_field = {**hotfix_field, 'offset': sint(b, wrapper_field_data + wrapper['fields'].index(hotfix_field) * 4)}
assert hotfix_field['offset'] == 0x18

exception_rva, exception_size = struct.unpack_from('<II', b, optional + 112 + 3 * 8)
exception_offset = offset(image_base + exception_rva)
runtime = [struct.unpack_from('<III', b, p) for p in range(exception_offset, exception_offset + exception_size, 12)]
starts = [r[0] for r in runtime]
assert starts == sorted(starts)
parents = {}


def parent(entry, seen=()):
    assert entry not in seen
    if entry in parents:
        return parents[entry]
    p = offset(image_base + entry[2])
    if b[p] >> 3 & 4:
        tail = p + 4 + ((b[p + 2] + 1) // 2) * 4
        root = parent(struct.unpack_from('<III', b, tail), seen + (entry,))
    else:
        root = entry
    parents[entry] = root
    return root


families = {}
for entry in runtime:
    families.setdefault(parent(entry), []).append(entry)


def pointer(method):
    rid = method['token'] & 0xffffff
    assert 0 < rid <= method_count
    return quad(b, method_table + (rid - 1) * 8)


selected = []
for type_row, names in [(wrapper, ['OnEvent', '_AddBuffs', 'OnCastStart', 'SetData']),
                         (owner, ['OnSpellStart', 'OnCastEnd', 'OnCastOnTarget']), (coroutine, ['MoveNext'])]:
    for method_name in names:
        method = unique(lambda r: r['name'] == method_name, type_row['methods'])
        va = pointer(method)
        root = runtime[bisect.bisect_right(starts, va - image_base) - 1]
        assert root[0] == va - image_base
        chunks = []
        for entry in families[parent(root)]:
            raw = b[offset(image_base + entry[0]):offset(image_base + entry[0]) + entry[1] - entry[0]]
            instructions = [{'rva': ins.address - image_base, 'mnemonic': ins.mnemonic, 'operands': ins.op_str}
                            for ins in Cs(CS_ARCH_X86, CS_MODE_64).disasm(raw, image_base + entry[0])]
            chunks.append({'beginRva': entry[0], 'endRva': entry[1], 'unwindRva': entry[2],
                           'sha256': sha(raw), 'base64': base64.b64encode(raw).decode(), 'instructions': instructions})
        selected.append({'typeIndex': type_row['index'], 'type': type_row['name'], **method,
                         'entryRva': va - image_base, 'chunks': chunks})
on_event = unique(lambda r: r['type'] == wrapper['name'] and r['name'] == 'OnEvent', selected)
add_buffs = unique(lambda r: r['type'] == wrapper['name'] and r['name'] == '_AddBuffs', selected)
instructions = [ins for chunk in on_event['chunks'] for ins in chunk['instructions']]
assert any(ins['mnemonic'] == 'cmp' and ins['operands'] == 'ebp, dword ptr [rbx + 0x30]' for ins in instructions)
assert any(ins['mnemonic'] == 'call' and ins['operands'] == hex(image_base + add_buffs['entryRva']) for ins in instructions)

graph = json.loads(read('data/candidates/arkpedia-ch16-fear-projectile-source.json'))
prefab = 'dyn/battle/prefabs/enemies/enemy_10128_fearpj.prefab'
cast_wrapper = unique(lambda row: json.loads(row['originalJson']).get('_runActionOnEvent') == 5, graph['prefabs'][prefab])
native = json.loads(cast_wrapper['originalJson'])
assert native['_extraCondition'] == 0 and native['_onlyRunOnce'] == 0
assert native['_buffs'][0]['buffKey'] == 'fearpj_m0_t[switch_to_die]'
assert all(k in {f['name'] for f in wrapper['fields']} for k in native if not k.startswith('m_'))
result = {'schemaVersion': 1, 'scope': 'Static default compiled handler and metadata evidence only; no runtime hotfix, frame parity, cross-version admission or stage support.',
          'runtimeDispatchVerified': False, 'frameParity': False, 'crossVersionParity': False,
          'sources': sources, 'nativeFiles': pin['files'],
          'formatReference': {'repository': 'Perfare/Il2CppDumper', 'commit': '4741d46ba9cd6159c5d853eb9d6fc48b4bfa2b1a',
                              'path': 'Il2CppDumper/Il2Cpp/MetadataClass.cs'},
          'metadataVersion': 29, 'imageBase': image_base,
          'codeGenModule': {'name': 'Assembly-CSharp.dll', 'rva': address(module) - image_base,
                            'methodCount': method_count, 'methodPointerTableRva': method_pointer_va - image_base},
          'metadataRegistrationRva': address(registration) - image_base,
          'event': {'ownerTypeIndex': owner['index'], 'owner': 'Torappu.Battle.AbilityStandard',
                    'typeIndex': event['index'], 'name': event['name'], 'fields': enum_fields},
          'wrapper': {'type': 'Torappu.Battle.Abilities.BuffToOwner', 'typeIndex': wrapper['index'], 'fields': fields,
                      'hotfixEventField': hotfix_field,
                      'prefab': prefab, 'pathId': cast_wrapper['pathId'], 'nativeOriginalJson': cast_wrapper['originalJson']},
          'methods': selected,
          'limits': ['Event5 is ON_SPELL_END in the metadata type resolved from the actual compiled wrapper field. The ordinary handler compares that field and calls _AddBuffs; the xLua override branch remains retained, not assumed absent at runtime.',
                     'PE chained-unwind ranges bind complete hot/cold chunks. Token resolution is restricted to the exact Assembly-CSharp metadata image. Coroutine bytes are retained for further dispatch/ordering review, not automatically interpreted as proof of launch timing.',
                     'This Global Windows version is separate from retained CN prefab/skeleton inputs. Matching field layout and explicit wrapper values bind the selected evidence; no blanket cross-version/runtime/frame parity or new support follows.']}
out = ROOT / 'data/candidates/arkpedia-windows-ability-events-source.json'
serialized = json.dumps(result, ensure_ascii=False, indent=1) + '\n'
if __name__ == '__main__':
    if '--check' in sys.argv:
        assert out.read_text(encoding='utf8') == serialized, 'Static Windows ability-event evidence differs'
    else:
        out.write_text(serialized, encoding='utf8', newline='\n')
    print('Verified static event5=ON_SPELL_END, native wrapper field type/offset, compiled default handler and chained method chunks')
