#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Recover native GLES programs linked by all twelve original effect shaders.

Unity 2021 player-program links point past separate parameter entries. The
installed UnityPy whole-shader exporter reads only legacy links and misses these.
We follow the native player links and preserve original program bytes, keywords,
pass states and trailing metadata. No shader equations are recreated here.
"""
import gzip
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/lappland-alter-source/effects'
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
import UnityPy
from UnityPy.helpers import CompressionHelper


def sha(value):
    return hashlib.sha256(value).hexdigest()


def read_program(blob, index):
    count = struct.unpack_from('<i', blob)[0]
    if not 0 <= index < count or 4 + count * 12 > len(blob):
        raise ValueError('Invalid native shader table index')
    offset, length, segment = struct.unpack_from('<3i', blob, 4 + index * 12)
    if segment != 0 or offset < 4 + count * 12 or length < 32 or offset + length > len(blob):
        raise ValueError('Unsupported shader segment or invalid entry bounds')
    entry = blob[offset:offset + length]
    version, kind = struct.unpack_from('<2i', entry)
    if version != 202012090 or kind != 4:
        raise ValueError('Not the pinned GLES3 player program')
    cursor = 24

    def integer():
        nonlocal cursor
        if cursor + 4 > len(entry):
            raise ValueError('Truncated native shader integer')
        value = struct.unpack_from('<i', entry, cursor)[0]
        cursor += 4
        return value

    def string_bytes():
        nonlocal cursor
        size = integer()
        if size < 0 or cursor + size > len(entry):
            raise ValueError('Invalid native shader string bounds')
        raw = entry[cursor:cursor + size]
        cursor = (cursor + size + 3) & ~3
        return raw

    keywords_count = integer()
    if not 0 <= keywords_count <= 32:
        raise ValueError('Unexpected native keyword count')
    keywords = [string_bytes().decode('utf8') for _ in range(keywords_count)]
    code = string_bytes()
    text = code.decode('utf8')
    if (not text.startswith('#ifdef VERTEX\n#version 300 es\n')
            or text.count('#ifdef VERTEX') != 1 or text.count('#ifdef FRAGMENT') != 1
            or text.count('#version 300 es') != 2 or '\x00' in text):
        raise ValueError('Unexpected combined native GLES source')
    # Preserve the native trailing requirement/metadata words without assigning
    # invented semantics. They are not GLSL shader source.
    if cursor + 8 != len(entry):
        raise ValueError('Unexpected native program trailer')
    return {'blobIndex': index, 'entryOffset': offset, 'entryBytes': length,
            'entrySha256': sha(entry), 'gpuProgramType': kind, 'keywords': keywords,
            'sourceBytes': len(code), 'sourceSha256': sha(code), 'source': text,
            'trailer': list(struct.unpack_from('<2I', entry, cursor))}


def extract():
    original = json.load(gzip.open(OUT / 'native-effects.bin'))
    manifest = json.loads((ROOT / 'data/arkpedia-lappland-effects.json').read_text())
    entry = next(r for r in manifest['sources'] if r['path'] == '[uc]shaders.ab')
    raw = (ROOT / '.cache/arkpedia/map-source/ab/[uc]shaders.ab').read_bytes()
    if len(raw) != entry['bytes'] or sha(raw) != entry['sha256']:
        raise ValueError('Wrong pinned original shader bundle')
    env = UnityPy.Environment()
    env.load_file(raw)
    originals = {o.path_id: o for o in env.objects if o.type.name == 'Shader'}
    shaders = {}
    for key, record in original['records'].items():
        if record['type'] != 'Shader':
            continue
        obj = originals[int(record['pathId'])]
        if sha(obj.get_raw_data()) != record['serializedSha256']:
            raise ValueError('Changed original shader object')
        tree = obj.read_typetree()
        if tree['platforms'].count(9) != 1:
            raise ValueError('Missing/ambiguous native GLES platform')
        platform = tree['platforms'].index(9)
        if any(len(tree[k][platform]) != 1 for k in ['offsets', 'compressedLengths', 'decompressedLengths']):
            raise ValueError('Additional shader segments need review')
        offset, length, size = [tree[k][platform][0] for k in ['offsets', 'compressedLengths', 'decompressedLengths']]
        compressed = bytes(tree['compressedBlob'])[offset:offset + length]
        blob = CompressionHelper.decompress_lz4(compressed, size)
        if len(blob) != size:
            raise ValueError('Invalid native shader decompression')
        parsed = tree['m_ParsedForm']
        programs, passes = {}, []
        for si, sub in enumerate(parsed['m_SubShaders']):
            for pi, render_pass in enumerate(sub['m_Passes']):
                if render_pass['m_Type'] != 0 or render_pass['progFragment']['m_PlayerSubPrograms']:
                    raise ValueError('Unsupported split/indirect native pass')
                groups = render_pass['progVertex']['m_PlayerSubPrograms']
                linked = [(gi, r) for gi, group in enumerate(groups) for r in group if r['m_GpuProgramType'] == 4]
                if not linked:
                    raise ValueError('Native pass has no GLES player program')
                variants = []
                for group, link in linked:
                    index = link['m_BlobIndex']
                    program = programs.setdefault(str(index), read_program(blob, index))
                    keywords = [parsed['m_KeywordNames'][i] for i in link['m_KeywordIndices']]
                    if sorted(keywords) != sorted(program['keywords']):
                        raise ValueError('Native keyword link mismatch')
                    variants.append({'hardwareGroup':group, 'blobIndex':index, 'keywords':keywords,
                                     'requirements':link['m_ShaderRequirements']})
                passes.append({'subShader':si, 'pass':pi, 'state':render_pass['m_State'], 'variants':variants})
        shaders[key] = {'name': parsed['m_Name'], 'sourceObjectSha256':record['serializedSha256'],
                        'glesBlobSha256':sha(blob), 'properties':parsed['m_PropInfo'],
                        'passes':passes, 'programs':programs}
    if len(shaders) != 12 or sum(len(s['programs']) for s in shaders.values()) != 23:
        raise ValueError('Incomplete original effect shader inventory')
    pack = {'schemaVersion':1, 'operator':original['operator'], 'version':original['version'],
            'sourceBundle':entry, 'shaders':shaders}
    raw_pack = (json.dumps(pack, separators=(',', ':'), sort_keys=True) + '\n').encode()
    (OUT / 'native-shaders.json').write_bytes(raw_pack)
    metadata = {'schemaVersion':1, 'operator':original['operator'], 'version':original['version'],
        'scope':{'nativeSourceOnly':True, 'rendererVerified':False, 'compiledFrameParity':False, 'enabledOperators':[]},
        'sourceBundle':entry, 'artifact':{'path':'native-shaders.json', 'bytes':len(raw_pack), 'sha256':sha(raw_pack)},
        'counts':{'shaders':12, 'programs':23},
        'shaders':{k:{'name':s['name'], 'sourceObjectSha256':s['sourceObjectSha256'],
            'glesBlobSha256':s['glesBlobSha256'], 'programs':{i:{x:p[x] for x in
            ['blobIndex','entryOffset','entryBytes','entrySha256','gpuProgramType','keywords','sourceBytes','sourceSha256','trailer']}
            for i,p in s['programs'].items()}} for k,s in shaders.items()}}
    (ROOT / 'data/arkpedia-lappland-effect-shaders.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps({'shaders':12,'programs':23,'bytes':len(raw_pack)}))


if __name__ == '__main__':
    extract()
