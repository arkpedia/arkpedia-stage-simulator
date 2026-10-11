#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the animation export and reject altered channels/bindings/samples."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/lappland-alter-source'
spec = importlib.util.spec_from_file_location('animation_verifier', ROOT / 'tools/arkpedia/verify-lappland-effect-animations.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


def build():
    subprocess.run(['node', 'tools/arkpedia/decode-lappland-effect-animations.mjs'], cwd=ROOT, check=True, capture_output=True)


def hashes():
    return {str(f.relative_to(ROOT)): hashlib.sha256(f.read_bytes()).hexdigest() for f in [
        v.MANIFEST, ROOT / 'test/fixtures/arkpedia-lappland-effect-clips.json',
        v.DIRECTORY / 'native-animations.json', v.DIRECTORY / 'native-animation-samples.json']}


build()
originals = v.native_clips()
result = v.verify(originals)
before = hashes()
build()
assert hashes() == before, 'Animation export is not reproducible'
decoded = json.loads((v.DIRECTORY / 'native-animations.json').read_text())
samples = json.loads((v.DIRECTORY / 'native-animation-samples.json').read_text())
manifest = json.loads(v.MANIFEST.read_text())
names = ['premature-enable', 'false-renderer-parity', 'missing-clip', 'changed-coefficient',
         'changed-key-clock', 'changed-constant', 'changed-loop', 'changed-binding',
         'changed-hierarchy-node', 'changed-material-property', 'changed-controller',
         'changed-sample', 'omitted-sample']
rejected = []
for name in names:
    d, s, m = copy.deepcopy(decoded), copy.deepcopy(samples), copy.deepcopy(manifest)
    first = next(iter(d['clips']))
    clip = d['clips'][first]
    streamed = next(c for c in clip['channels'] if c['kind'] == 'streamed')
    if name == 'premature-enable':
        m['scope']['enabledOperators'] = ['char_1038_whitw2']
    elif name == 'false-renderer-parity':
        m['scope']['compiledFrameParity'] = True
    elif name == 'missing-clip':
        del d['clips'][first]
        del m['clips'][first]
        del s[first]
    elif name == 'changed-coefficient':
        streamed['keys'][0]['coefficients'][0] += .5
    elif name == 'changed-key-clock':
        streamed['keys'][1]['time'] += .001
    elif name == 'changed-constant':
        next(c for c in clip['channels'] if c['kind'] == 'constant')['value'] += .01
    elif name == 'changed-loop':
        clip['loop'] = not clip['loop']
        m['clips'][first]['loop'] = clip['loop']
    elif name == 'changed-binding':
        clip['bindings'][0]['attribute'] += 1
    elif name == 'changed-hierarchy-node':
        d['instances'][0]['bindings'][0]['path'] += '/invented'
    elif name == 'changed-material-property':
        entry = next(b for i in d['instances'] for b in i['bindings'] if b['property'].startswith('material.'))
        entry['property'] = 'material._Invented.a'
    elif name == 'changed-controller':
        d['instances'][0]['controller'] = d['instances'][0]['animator']
    elif name == 'changed-sample':
        s[first][0]['values'][0] += .01
    elif name == 'omitted-sample':
        s[first].pop()
    directory = OUT / ('animation-negative-' + name)
    directory.mkdir(exist_ok=True)
    raw = (json.dumps(d, separators=(',', ':')) + '\n').encode()
    m['artifact']['bytes'] = len(raw)
    m['artifact']['sha256'] = hashlib.sha256(raw).hexdigest()
    (directory / 'native-animations.json').write_bytes(raw)
    (directory / 'native-animation-samples.json').write_text(json.dumps(s) + '\n')
    meta_file = directory / 'manifest.json'
    meta_file.write_text(json.dumps(m) + '\n')
    try:
        v.verify(originals, directory, meta_file)
    except (AssertionError, KeyError, ValueError, StopIteration):
        rejected.append(name)
    else:
        raise AssertionError('Accepted altered native animation fixture: ' + name)
assert v.verify(originals) == result
report = dict(result, reproducibleFiles=len(before), rejectedFixtures=rejected, files=before)
(OUT / 'animation-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(dict(result, reproducibleFiles=len(before), rejectedFixtures=len(rejected))))
