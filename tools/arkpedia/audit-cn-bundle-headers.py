#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Compare bounded header discovery with checksum-verified full native bundles."""
import importlib.util
import io
import hashlib
import json
from pathlib import Path
import struct
import zipfile
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('header_probe',Path(__file__).with_name('probe-cn-bundle-headers.py'))
module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
import UnityPy
raw_manifest = (module.CACHE / 'hot_update_list.json').read_bytes()
assert hashlib.sha256(raw_manifest).hexdigest() == module.MANIFEST_SHA
hot = json.loads(raw_manifest);entries = {r['name']:r for r in hot['abInfos']}
count = 0
for path in sorted((module.CACHE / 'bundles').rglob('*.ab')):
    name = path.relative_to(module.CACHE / 'bundles').as_posix();row = entries[name];raw = path.read_bytes()
    assert len(raw) == row['abSize'] and hashlib.md5(raw).hexdigest() == row['md5']
    native = UnityPy.load(raw)
    expected = sorted(f.name for f in native.assets)
    found = module.directory_names(raw[:65536],row['abSize'])
    assert found['serializedFiles'] == expected and len(native.assets) == 1
    assert found['unityVersion'] == native.assets[0].unity_version
    count += 1
# Original header plus independently generated ZIP packaging exercises both layers.
name = 'battle/prefabs/effects/aphris.ab';raw = (module.CACHE / 'bundles' / name).read_bytes();size = len(raw)
expected = module.directory_names(raw[:65536],size)
for compression in [zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED]:
    stream = io.BytesIO()
    with zipfile.ZipFile(stream,'w',compression=compression) as z:z.writestr(name,raw)
    prefix = module.zip_prefix(stream.getvalue()[:module.LIMIT],name)
    assert module.directory_names(prefix,size) == expected
rejected = 0
def refuses(operation):
    global rejected
    try:operation()
    except module.HeaderUnavailable:rejected += 1
    else:raise AssertionError('Invalid native discovery header accepted')
for n in [0,7,12,24,49,63,64,100,200,316]:refuses(lambda n=n:module.directory_names(raw[:n],size))
refuses(lambda:module.directory_names(raw[:65536],size+1))
changed = bytearray(raw[:65536]);changed[46:50] = struct.pack('>I',struct.unpack_from('>I',changed,46)[0] | 128)
refuses(lambda:module.directory_names(bytes(changed),size))
stream = io.BytesIO()
with zipfile.ZipFile(stream,'w') as z:z.writestr('foreign.ab',raw)
refuses(lambda:module.zip_prefix(stream.getvalue()[:module.LIMIT],name))
refuses(lambda:module.zip_prefix(b'PK',name))
report = {'fullNativeBundlesCompared':count,'originalCABDirectoriesMatched':count,'zipModesCompared':2,'invalidHeadersRejected':rejected,'discoveryOnly':True,'discoveryGrantsFullBundleApproval':False}
(module.CACHE / 'cab-header-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
