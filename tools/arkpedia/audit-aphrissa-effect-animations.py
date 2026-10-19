#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce and independently challenge original legacy/streamed bindings."""
import copy
import hashlib
import importlib.util
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
module = importlib.util.spec_from_file_location('aphrissa_animation_verify', ROOT / 'tools/arkpedia/verify-aphrissa-effect-animations.py')
v = importlib.util.module_from_spec(module)
module.loader.exec_module(v)


def build():
    subprocess.run([os.environ.get('ARKPEDIA_REVIEW_NODE', 'node'), 'tools/arkpedia/decode-aphrissa-effect-animations.mjs'],
                   cwd=ROOT, check=True, capture_output=True)


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [v.MANIFEST,
        ROOT / v.SPEC['fixture_path'], v.DIRECTORY / 'native-animations.json', v.DIRECTORY / 'native-animation-samples.json']}


build()
originals = v.native_clips()
result = v.verify(originals)
before = hashes()
build()
assert before == hashes()
decoded = json.loads((v.DIRECTORY / 'native-animations.json').read_bytes())
samples = json.loads((v.DIRECTORY / 'native-animation-samples.json').read_bytes())
manifest = json.loads(v.MANIFEST.read_bytes())
legacy = next(k for k, c in decoded['clips'].items() if c.get('format') == 'legacy-euler')
names = ['false-admission', 'false-frame-parity', 'missing-clip', 'legacy-stub-clock', 'legacy-loop',
         'legacy-wing-path', 'legacy-rotation-order', 'legacy-tangent', 'legacy-angle', 'legacy-key-time',
         'changed-authored-initial', 'changed-line-width-binding', 'changed-width-target', 'changed-material-property',
         'legacy-default-clip', 'legacy-autoplay', 'legacy-wrap-override', 'legacy-driver-type',
         'ambiguous-node-omission', 'changed-sample', 'omitted-sample']
for name in names:
    d, s, m = copy.deepcopy(decoded), copy.deepcopy(samples), copy.deepcopy(manifest)
    c = d['clips'][legacy]
    driver = next(i for i in d['instances'] if 'animation' in i)
    width = next(b for i in d['instances'] for b in i['bindings'] if b.get('property') == 'm_Parameters.widthMultiplier')
    if name == 'false-admission':
        m['scope']['enabledOperators'] = ['char_4229_aphris']
    elif name == 'false-frame-parity':
        m['scope']['compiledFrameParity'] = True
    elif name == 'missing-clip':
        del d['clips'][legacy]
        del m['clips'][legacy]
        del s[legacy]
    elif name == 'legacy-stub-clock':
        c['stop'] = m['clips'][legacy]['stop'] = 1
    elif name == 'legacy-loop':
        c['loop'] = m['clips'][legacy]['loop'] = False
    elif name == 'legacy-wing-path':
        c['bindings'][0]['path'] = 'invented-wing'
    elif name == 'legacy-rotation-order':
        c['bindings'][0]['rotationOrder'] = 'XYZ'
    elif name == 'legacy-tangent':
        c['channels'][2]['keys'][0]['coefficients'][2] += .1
    elif name == 'legacy-angle':
        c['channels'][4]['keys'][0]['coefficients'][3] = 0
    elif name == 'legacy-key-time':
        c['channels'][2]['keys'][1]['time'] += .01
    elif name == 'changed-authored-initial':
        next(ch for cl in d['clips'].values() for ch in cl['channels'] if 'initialValue' in ch)['initialValue'] += .1
    elif name == 'changed-line-width-binding':
        next(b for cl in d['clips'].values() for b in cl['bindings'] if b.get('customType') == 29)['attribute'] += 1
    elif name == 'changed-width-target':
        width['component'] = driver['animation']
    elif name == 'changed-material-property':
        next(b for i in d['instances'] for b in i['bindings'] if b['property'].startswith('material.'))['property'] = 'material._Invented'
    elif name == 'legacy-default-clip':
        driver['defaultClip'] = next(k for k in d['clips'] if k != legacy)
    elif name == 'legacy-autoplay':
        driver['playAutomatically'] = False
    elif name == 'legacy-wrap-override':
        driver['wrapMode'] = 4
    elif name == 'legacy-driver-type':
        driver['animator'] = driver.pop('animation')
    elif name == 'ambiguous-node-omission':
        m['unboundAmbiguousPaths'][0]['nodes'].pop()
    elif name == 'changed-sample':
        s[legacy][0]['values'][4] = 0
    elif name == 'omitted-sample':
        s[legacy].pop()
    directory = v.DIRECTORY / ('negative-animation-' + name)
    directory.mkdir(exist_ok=True)
    raw = (json.dumps(d, separators=(',', ':')) + '\n').encode()
    m['artifact'].update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    (directory / 'native-animations.json').write_bytes(raw)
    (directory / 'native-animation-samples.json').write_text(json.dumps(s) + '\n')
    target = directory / 'manifest.json'
    target.write_text(json.dumps(m) + '\n')
    try:
        v.verify(originals, directory, target)
    except (AssertionError, KeyError, ValueError, StopIteration):
        pass
    else:
        raise AssertionError('Accepted altered native animation evidence: ' + name)
assert v.verify(originals) == result
report = dict(result, reproducibleOutputs=len(before), rejectedAlteredEvidence=len(names), files=before,
              rendererVerified=False, compiledFrameParity=False)
(v.DIRECTORY / 'animation-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
