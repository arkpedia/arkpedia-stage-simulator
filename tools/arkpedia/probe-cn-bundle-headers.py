#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Discover original CAB identities from bounded CDN ZIP/UnityFS prefixes.

Header discovery is a hint only. A matched full bundle still needs the pinned
manifest's complete length/MD5/SHA verification before source export or use.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
from urllib.parse import quote
import zlib
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/local-extract'))
import aklz4  # noqa: F401
from UnityPy.helpers import CompressionHelper
CACHE = ROOT / '.cache/arkpedia/cn-native-source'
VERSION = '26-09-22-07-47-20_6c71fa'
MANIFEST_SHA = 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35'
LIMIT = 16384
class HeaderUnavailable(ValueError): pass
def directory_names(raw, expected_size):
    at = 0
    def take(n):
        nonlocal at
        if n < 0 or at + n > len(raw): raise HeaderUnavailable('Incomplete native bundle header')
        result = raw[at:at+n];at += n;return result
    def string():
        nonlocal at
        end = raw.find(b'\0',at)
        if end < at or end-at > 256: raise HeaderUnavailable('Invalid native header string')
        result = take(end-at+1)[:-1].decode('ascii');return result
    if string() != 'UnityFS': raise HeaderUnavailable('Unsupported original bundle signature')
    version = struct.unpack('>I',take(4))[0]
    if version not in [7,8]: raise HeaderUnavailable('Unreviewed original bundle format')
    player, engine = string(), string()
    size, compressed, uncompressed, flags = struct.unpack('>QIII',take(20))
    if size != expected_size or compressed > 65536 or not 0 < uncompressed <= 2*1024*1024 or flags & 128:
        raise HeaderUnavailable('Unbounded or non-prefix original directory')
    at = (at+15)//16*16
    encoded = take(compressed)
    codec = flags & 63
    if codec not in [0,2,3,4]: raise HeaderUnavailable('Unsupported original directory codec')
    info = encoded if codec == 0 else CompressionHelper.DECOMPRESSION_MAP[codec](encoded,uncompressed)
    if len(info) != uncompressed: raise HeaderUnavailable('Invalid original directory size')
    i = 16
    def read(fmt):
        nonlocal i
        n = struct.calcsize(fmt)
        if i+n > len(info): raise HeaderUnavailable('Incomplete original directory')
        values = struct.unpack_from(fmt,info,i);i += n;return values
    blocks, = read('>I')
    if not 0 < blocks <= 65536: raise HeaderUnavailable('Invalid original block count')
    decoded_size = 0
    for _ in range(blocks):
        plain, packed, block_flags = read('>IIH');decoded_size += plain
        if packed > size or plain > 256*1024*1024: raise HeaderUnavailable('Unbounded original block')
    nodes, = read('>I')
    if not 0 < nodes <= 128: raise HeaderUnavailable('Invalid original directory count')
    names = []
    for _ in range(nodes):
        offset,length,node_flags = read('>QQI')
        if offset+length > decoded_size: raise HeaderUnavailable('Original node exceeds block data')
        end = info.find(b'\0',i)
        if end < i or end-i > 256: raise HeaderUnavailable('Invalid original node name')
        name = info[i:end].decode('ascii');i = end+1
        if re.fullmatch(r'CAB-[0-9a-f]{24,32}',name): names.append(name)
    if i != len(info) or len(names) != 1: raise HeaderUnavailable('Ambiguous native CAB directory')
    return {'serializedFiles':names,'unityVersion':engine,'format':version}
def zip_prefix(raw, name):
    if len(raw) < 30: raise HeaderUnavailable('Incomplete ZIP local header')
    h = struct.unpack_from('<4s5H3I2H',raw)
    if h[0] != b'PK\x03\x04' or h[2] & 1 or h[3] not in [0,8]: raise HeaderUnavailable('Unsupported original ZIP prefix')
    start = 30+h[9]+h[10]
    if start > len(raw) or raw[30:30+h[9]].decode('utf8') != name: raise HeaderUnavailable('Wrong original ZIP entry')
    data = raw[start:]
    if h[3] == 0:return data[:65536]
    return zlib.decompressobj(-15).decompress(data,65536)
def probe(row):
    name = row['name'];local = CACHE / 'bundles' / name
    if local.exists():
        with local.open('rb') as f:raw = f.read(65536)
        return {'bundle':name,'headerOnly':True,'fullBundleVerified':False,'transport':'local-prefix',**directory_names(raw,row['abSize'])}
    archive = name.replace('/','_').replace('#','__')
    if archive.endswith('.ab'):archive = archive[:-3]+'.dat'
    url = 'https://ak.hycdn.cn/assetbundle/official/Android/assets/'+VERSION+'/'+quote(archive,safe='')
    with tempfile.TemporaryDirectory() as d:
        header,body = Path(d)/'headers',Path(d)/'body'
        subprocess.run(['curl','--fail','--silent','--show-error','--max-time','30','--max-filesize',str(LIMIT),'--range',f'0-{LIMIT-1}','--dump-header',str(header),'--output',str(body),url],check=True,capture_output=True)
        raw,h = body.read_bytes(),header.read_text()
    match = re.search(r'^content-range: bytes 0-(\d+)/(\d+)\s*$',h,re.M|re.I)
    if not re.search(r'^HTTP/\S+ 206\b',h,re.M) or not match or len(raw) != int(match[1])+1 or not 0 < len(raw) <= LIMIT:
        raise HeaderUnavailable('Original CDN did not honor bounded range')
    return {'bundle':name,'url':url,'headerOnly':True,'fullBundleVerified':False,'transport':'http-range','rangeBytes':len(raw),'rangeSha256':hashlib.sha256(raw).hexdigest(),**directory_names(zip_prefix(raw,name),row['abSize'])}
def main():
    p = argparse.ArgumentParser();p.add_argument('--prefix',action='append',required=True);p.add_argument('--target',required=True);p.add_argument('--max-bundles',type=int,default=128)
    p.add_argument('--stop-on-match',action='store_true');p.add_argument('--refresh',action='store_true');args = p.parse_args()
    if not re.fullmatch(r'CAB-[0-9a-f]{24,32}',args.target) or not 1 <= args.max_bundles <= 16384:raise ValueError('Invalid bounded discovery request')
    raw = (CACHE / 'hot_update_list.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST_SHA:raise ValueError('Changed pinned CN manifest')
    hot = json.loads(raw);assert hot['versionId'] == VERSION
    rows = [r for r in hot['abInfos'] if any(r['name'].startswith(prefix) for prefix in args.prefix)]
    if len(rows) > args.max_bundles:raise ValueError('Native prefix exceeds explicit discovery limit')
    hints = {}
    if not args.refresh:
        for path in sorted(CACHE.glob('cab-probe-*.json')):
            if path.name.endswith('.partial.json'):continue
            saved = json.loads(path.read_text())
            if saved.get('sourceManifestSha256') != MANIFEST_SHA:continue
            for row in saved.get('results',[]):
                if row.get('headerOnly') is True and row.get('fullBundleVerified') is False:hints[row['bundle']] = row
    results,errors,remaining = [],[],[]
    matched = False
    for row in rows:
        hint = hints.get(row['name'])
        if hint:
            result = {**hint,'cachedDiscoveryHint':True};results.append(result)
            if args.target in result['serializedFiles']:
                print('MATCH '+json.dumps(result),flush=True);matched = True
        else:remaining.append(row)
    remaining.sort(key=lambda r:(0 if 'material' in r['name'] else 1 if 'common' in r['name'] else 2 if r['name'].startswith('arts/') else 3 if r['name'].startswith('chararts/') else 4,r['name']))
    cursor = iter(remaining)
    out = CACHE / ('cab-probe-'+hashlib.sha256('|'.join(args.prefix).encode()).hexdigest()[:12]+'.json')
    def save():
        data = {'sourceManifestSha256':MANIFEST_SHA,'target':args.target,'headerOnly':True,'fullBundleVerified':False,'requested':len(rows),'stoppedAfterMatch':matched and args.stop_on_match,'results':sorted(results,key=lambda r:r['bundle']),'errors':errors}
        temporary = out.with_suffix('.partial.json');temporary.write_text(json.dumps(data,indent=2)+'\n');temporary.replace(out)
    with ThreadPoolExecutor(max_workers=4) as pool:
        work = {}
        def refill():
            while len(work) < 4:
                row = next(cursor,None)
                if row is None:break
                work[pool.submit(probe,row)] = row
        if not (matched and args.stop_on_match):refill()
        while work:
            done,_ = wait(work,return_when=FIRST_COMPLETED)
            for future in done:
                row = work.pop(future)
                try:
                    result = future.result();results.append(result)
                    if args.target in result['serializedFiles']:
                        print('MATCH '+json.dumps(result),flush=True);matched = True
                except Exception as error:errors.append({'bundle':row['name'],'error':str(error)})
                if (len(results)+len(errors)) % 64 == 0:
                    save();print(f'Discovery {len(results)+len(errors)}/{len(rows)}; full-bundle approval remains false',flush=True)
            if not (matched and args.stop_on_match):refill()
    save()
    print(json.dumps({'matched':[r['bundle']for r in results if args.target in r['serializedFiles']],'probed':len(results),'errors':len(errors),'report':str(out)}))
if __name__ == '__main__':main()
