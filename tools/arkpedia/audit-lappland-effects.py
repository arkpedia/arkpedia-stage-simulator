#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the native artwork export and reject semantic corruption fixtures.

Fixtures recompute manifest/pack digests, so successful rejection proves native
source comparisons rather than only checksum validation. Assets remain private
source-cache preparation and never become a claimed reviewed battle renderer.
"""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/lappland-alter-source'
DIRECTORY = OUT / 'effects'
MANIFEST = ROOT / 'data/arkpedia-lappland-effects.json'


def run(args):
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)


def checked(args):
    r = run(args)
    if r.returncode:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout.strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hashes():
    return {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in
            [MANIFEST, DIRECTORY / 'native-effects.json', DIRECTORY / 'native-effects.bin',
             *sorted((DIRECTORY / 'textures').glob('*.webp'))]}


def encode(pack):
    raw = (json.dumps(pack, sort_keys=True, ensure_ascii=True,
                      separators=(',', ':'), allow_nan=False) + '\n').encode()
    blob = gzip.compress(raw, mtime=0)
    return raw, blob


checked([sys.executable, 'tools/arkpedia/extract-lappland-effects.py',
         '--manifest-out', str(MANIFEST)])
baseline = checked([sys.executable, 'tools/arkpedia/verify-lappland-effects.py'])
print(baseline, flush=True)
before = hashes()
checked([sys.executable, 'tools/arkpedia/extract-lappland-effects.py',
         '--manifest-out', str(MANIFEST)])
assert hashes() == before, 'Native artwork outputs are not reproducible'
original_meta = MANIFEST.read_text()
original_pack = gzip.decompress((DIRECTORY / 'native-effects.bin').read_bytes()).decode()
names = ['enabled-before-rendering', 'false-renderer-verification', 'omitted-prefab',
         'omitted-child', 'changed-transform', 'changed-material', 'changed-animation',
         'changed-mesh', 'changed-texture-pixels', 'omitted-unresolved-reference',
         'changed-shader', 'changed-script-binding', 'changed-source-bundle']
results = []
for name in names:
    meta, pack = json.loads(original_meta), json.loads(original_pack)
    directory = OUT / ('effects-negative-' + name)
    directory.mkdir(exist_ok=True)
    if not (directory / 'textures').exists():
        (directory / 'textures').symlink_to(DIRECTORY / 'textures', target_is_directory=True)
    records = pack['records']
    if name == 'enabled-before-rendering':
        meta['scope']['enabledOperators'] = ['char_1038_whitw2']
    elif name == 'false-renderer-verification':
        meta['scope']['rendererVerified'] = True
    elif name == 'omitted-prefab':
        del pack['roots']['whitw2_token_02']
        del meta['roots']['whitw2_token_02']
    elif name == 'omitted-child':
        key = next(k for k, r in records.items() if r['type'] == 'ParticleSystem')
        del records[key]
        meta['counts']['ParticleSystem'] -= 1
    elif name == 'changed-transform':
        r = next(r for r in records.values() if r['type'] == 'Transform')
        r['data']['m_LocalPosition']['x'] += .5
    elif name == 'changed-material':
        r = next(r for r in records.values() if r['type'] == 'Material')
        r['data']['m_Name'] += '_changed'
    elif name == 'changed-animation':
        r = next(r for r in records.values() if r['type'] == 'AnimationClip')
        r['data']['m_SampleRate'] += 1
    elif name == 'changed-mesh':
        next(iter(pack['meshes'].values()))['positions'][0][0] += .1
    elif name == 'changed-texture-pixels':
        key, entry = next(iter(pack['textures'].items()))
        image = Image.open(DIRECTORY / entry['path']).convert('RGBA')
        pixel = image.getpixel((0, 0))
        image.putpixel((0, 0), ((pixel[0] + 1) % 256, *pixel[1:]))
        file = directory / 'changed.webp'
        image.save(file, lossless=True, exact=True)
        data = file.read_bytes()
        entry.update(path=file.name, bytes=len(data), sha256=sha(data), pixelSha256=sha(image.tobytes()))
        meta['textures'][key] = dict(entry)
    elif name == 'omitted-unresolved-reference':
        key = next(iter(pack['unresolvedReferences']))
        del pack['unresolvedReferences'][key]
        del meta['unresolvedReferences'][key]
    elif name == 'changed-shader':
        next(r for r in records.values() if r['type'] == 'Shader')['data']['name'] = 'InventedBrowserShader'
    elif name == 'changed-script-binding':
        next(iter(pack['scriptBindings'].values()))['pointer']['m_PathID'] = '1'
    elif name == 'changed-source-bundle':
        meta['sources'][0]['sha256'] = '0' * 64
    raw, blob = encode(pack)
    (directory / 'native-effects.bin').write_bytes(blob)
    meta['pack'].update(bytes=len(blob), sha256=sha(blob), decodedBytes=len(raw), decodedSha256=sha(raw))
    manifest = directory / 'native-effects.json'
    manifest.write_text(json.dumps(meta) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-lappland-effects.py',
                  '--directory', str(directory), '--manifest', str(manifest)])
    assert result.returncode and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    results.append({'fixture': name, 'rejected': True})
    print('Rejected ' + name, flush=True)
assert hashes() == before, 'Negative audit altered original output files'
(OUT / 'effects-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleFiles': len(before), 'negativeFixtures': results,
    'sourceInputsOnly': True, 'rendererVerified': False, 'compiledFrameParity': False,
}, indent=2) + '\n')
print(f'Native effect audit passed: {len(before)} identical files and {len(results)} semantic corruption fixtures rejected', flush=True)
