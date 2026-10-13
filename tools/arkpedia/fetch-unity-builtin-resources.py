#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Read one pinned official APK ZIP entry using bounded HTTP byte ranges.

Never downloads/installs the full package. TLS verification stays enabled.
The ZIP entry's CRC and all retrieved fragments are recorded, not a claim of
whole-APK signature/hash verification.
"""
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import zlib
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'.cache/arkpedia/unity-builtin-source'
URL = 'https://ak.hycdn.cn/GzD1CpaWgmSq1wew/78.0/package/1/1/Android/78.0.0_JUx7W5FdXjUAfFDx/arknights-hg-2781.apk'
SIZE = 1861585573
ETAG = '"2350854EA43B876EFAA31C2DC1A22FF6-400"'
ENTRY = 'assets/bin/Data/unity default resources'
ENGINE_ENTRY = 'assets/bin/Data/globalgamemanagers'
fragments = []


def sha(data): return hashlib.sha256(data).hexdigest()


def byte_range(start, end):
    if not 0 <= start <= end < SIZE or end-start+1 > 16*1024*1024: raise ValueError('Unbounded APK byte range')
    with tempfile.TemporaryDirectory() as d:
        headers, body = Path(d)/'headers', Path(d)/'body'
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '45', '--max-filesize', str(end-start+1),
                        '--range', f'{start}-{end}', '--header', 'If-Match: '+ETAG, '--dump-header', str(headers), '--output', str(body), URL], check=True)
        raw, h = body.read_bytes(), headers.read_text()
    if not re.search(r'^HTTP/\S+ 206\b', h, re.M) or len(raw) != end-start+1: raise ValueError('APK range response mismatch')
    if not re.search(r'^content-range: bytes '+str(start)+'-'+str(end)+'/'+str(SIZE)+r'\s*$', h, re.I | re.M): raise ValueError('Changed APK range/size')
    if not re.search(r'^etag: '+re.escape(ETAG)+r'\s*$', h, re.I | re.M): raise ValueError('Changed official APK ETag')
    fragments.append({'start': start, 'end': end, 'bytes': len(raw), 'sha256': sha(raw)})
    return raw


def fetch(entry=ENTRY):
    if entry not in [ENTRY, ENGINE_ENTRY]: raise ValueError('Unapproved APK resource entry')
    fragments.clear()
    tail = byte_range(SIZE-65557, SIZE-1);at = tail.rfind(b'PK\x05\x06')
    if at < 0: raise ValueError('Missing official APK ZIP directory')
    sig, disk, directory_disk, disk_count, count, directory_size, directory_start, comment = struct.unpack_from('<4s4H2IH', tail, at)
    if disk or directory_disk or disk_count != count or count == 65535 or directory_size == 0xffffffff or directory_start == 0xffffffff:
        raise ValueError('APK ZIP64/multidisk directory needs review')
    if at+22+comment != len(tail): raise ValueError('Invalid APK ZIP end record')
    directory = byte_range(directory_start, directory_start+directory_size-1)
    position = 0;wanted = None
    for index in range(count):
        row = struct.unpack_from('<4s6H3I5H2I', directory, position)
        if row[0] != b'PK\x01\x02': raise ValueError('Invalid APK central directory')
        length, extra, comment = row[10:13];name = directory[position+46:position+46+length].decode('utf-8')
        if name == entry:
            if wanted is not None: raise ValueError('Duplicate APK built-in resource')
            wanted = {'flags': row[3], 'compression': row[4], 'crc32': row[7], 'compressedBytes': row[8], 'bytes': row[9], 'localOffset': row[16]}
        position += 46+length+extra+comment
    if position != len(directory) or wanted is None: raise ValueError('Missing/incomplete APK built-in resource directory')
    if wanted['flags'] & 1 or wanted['compression'] not in [0, 8] or not 0 < wanted['bytes'] <= 16*1024*1024: raise ValueError('Unsupported APK built-in entry')
    offset = wanted['localOffset'];header = byte_range(offset, offset+29)
    local = struct.unpack('<4s5H3I2H', header)
    if local[0] != b'PK\x03\x04' or local[2] != wanted['flags'] or local[3] != wanted['compression']: raise ValueError('APK local header differs')
    name_extra = byte_range(offset+30, offset+30+local[9]+local[10]-1)
    if name_extra[:local[9]].decode('utf-8') != entry: raise ValueError('APK local entry name differs')
    start = offset+30+local[9]+local[10]
    compressed = byte_range(start, start+wanted['compressedBytes']-1)
    if wanted['compression'] == 0: raw = compressed
    else:
        decoder = zlib.decompressobj(-15);raw = decoder.decompress(compressed, wanted['bytes']+1)
        if not decoder.eof or decoder.unconsumed_tail or decoder.unused_data: raise ValueError('Incomplete/oversized APK resource compression')
    if len(raw) != wanted['bytes'] or zlib.crc32(raw) != wanted['crc32']: raise ValueError('APK built-in resource CRC/size differs')
    OUT.mkdir(parents=True, exist_ok=True)
    name = entry.rsplit('/', 1)[1]
    (OUT/name).write_bytes(raw)
    metadata = {'schemaVersion': 1, 'url': URL, 'packageBytes': SIZE, 'etag': ETAG, 'entry': entry, **wanted,
                'sha256': sha(raw), 'fragments': fragments, 'wholePackageVerified': False}
    (OUT/(name.replace(' ', '-')+'-source.json')).write_text(json.dumps(metadata, indent=2)+'\n')
    print(json.dumps({'entry': entry, 'bytes': len(raw), 'sha256': sha(raw), 'retrievedBytes': sum(r['bytes'] for r in fragments)}))


if __name__ == '__main__':
    fetch();fetch(ENGINE_ENTRY)
