#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Pinned anonymous native ZIP content; opaque manifest tags are not full MD5s."""
import base64
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[2]
def digest(raw, algorithm='sha256'): return hashlib.new(algorithm, raw).hexdigest()


def read_anonymous_source(cache, recipe_path, hot_bytes, version, *, fetch=False):
    recipe_bytes = (ROOT / recipe_path).read_bytes()
    recipe = json.loads(recipe_bytes)
    if recipe['schemaVersion'] != 1 or recipe['version'] != version or digest(hot_bytes) != recipe['manifestSha256']:
        raise ValueError('Changed anonymous source manifest/version')
    if recipe['scope'] != {'sourceInputsOnly': True, 'officialArchiveContentMd5Recorded': True,
            'nativeManifestShortTagVerified': False, 'rendererVerified': False,
            'compiledFrameParity': False, 'enabledOperators': []}:
        raise ValueError('Unreviewed anonymous source approval claim')
    hot = json.loads(hot_bytes)
    row, archive, bundle = recipe['nativeRow'], recipe['archive'], recipe['bundle']
    if hot['versionId'] != version or next(r for r in hot['abInfos'] if r['name'] == row['name']) != row:
        raise ValueError('Changed original anonymous manifest row')
    if not re.fullmatch(r'anon/[a-f0-9]{32}\.bin', row['name']) or archive['name'] != row['name'].replace('/', '_')[:-4] + '.dat':
        raise ValueError('Unreviewed anonymous archive name')
    if archive['bytes'] != row['totalSize'] or bundle['bytes'] != row['abSize'] or not 0 < max(archive['bytes'], bundle['bytes']) <= 32*1024*1024:
        raise ValueError('Unbounded anonymous source size')
    for entry in [archive, bundle]:
        if not re.fullmatch('[a-f0-9]{64}', entry['sha256']) or not re.fullmatch('[a-f0-9]{32}', entry['md5']):
            raise ValueError('Missing complete anonymous source digest')
    directory = cache / 'cn-native-source'
    source_archive, source_bundle = directory / 'archives' / archive['name'], directory / 'bundles' / row['name']
    if not source_archive.exists():
        if not fetch: raise ValueError('Missing pinned anonymous source archive')
        url = 'https://ak.hycdn.cn/assetbundle/official/Android/assets/' + version + '/' + archive['name']
        source_archive.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            header, body = Path(tmp)/'headers', Path(tmp)/'body'
            subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '60',
                '--max-filesize', str(archive['bytes']), '--dump-header', str(header), '--output', str(body), url], check=True)
            raw, headers = body.read_bytes(), header.read_text()
            md5 = re.search(r'^content-md5:\s*(\S+)', headers, re.I | re.M)
            if not re.search(r'^HTTP/\S+ 200\b', headers, re.M) or not md5 or base64.b64decode(md5[1]).hex() != archive['md5']:
                raise ValueError('Official anonymous archive Content-MD5 differs')
            if len(raw) != archive['bytes'] or digest(raw) != archive['sha256'] or digest(raw, 'md5') != archive['md5']:
                raise ValueError('Changed original anonymous archive bytes')
            source_archive.write_bytes(raw)
    raw = source_archive.read_bytes()
    if len(raw) != archive['bytes'] or digest(raw) != archive['sha256'] or digest(raw, 'md5') != archive['md5']:
        raise ValueError('Changed cached anonymous archive')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if z.namelist() != [row['name']]: raise ValueError('Ambiguous original anonymous ZIP entry')
        entry = z.getinfo(row['name'])
        if entry.file_size != bundle['bytes'] or entry.CRC != bundle['zipCrc32'] or entry.flag_bits & 1 or entry.compress_type not in [0, 8]:
            raise ValueError('Changed original anonymous ZIP entry metadata')
        decoded = z.read(entry)
    if len(decoded) != bundle['bytes'] or digest(decoded) != bundle['sha256'] or digest(decoded, 'md5') != bundle['md5'] or zlib.crc32(decoded) != bundle['zipCrc32']:
        raise ValueError('Changed complete anonymous native bundle')
    if source_bundle.exists():
        if source_bundle.read_bytes() != decoded: raise ValueError('Changed cached anonymous native bundle')
    elif fetch:
        source_bundle.parent.mkdir(parents=True, exist_ok=True);source_bundle.write_bytes(decoded)
    else: raise ValueError('Missing anonymous native bundle')
    return {'path': row['name'], 'bytes': len(decoded), 'md5': bundle['md5'], 'sha256': bundle['sha256'],
        'checksumProof': {'kind': 'pinned-official-archive', 'recipe': recipe_path, 'sha256': digest(recipe_bytes),
                          'nativeManifestTag': row['md5'], 'nativeManifestShortTagVerified': False}}
