#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce original Closure art and reject changed provenance/pixel claims."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/cn-operators/char_4228_closur/device-art'
TOKEN = 'token_10066_closur_ourbase'
META = OUT / 'sources.json'
baseline = json.loads(META.read_text())
paths = [META, ROOT / 'data/arkpedia-closur-device-art.json']
for r in baseline['models'][TOKEN]['facings'].values(): paths.extend(OUT / r['directory'] / name for name in r['files'])
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {p: digest(p) for p in paths}


def run(script, *args):
    return subprocess.run([sys.executable, 'tools/arkpedia/' + script + '.py', *args], cwd=ROOT, capture_output=True, text=True)


for script, args in [('extract-closur-models', []), ('verify-closur-models', ['--delivered'])]:
    r = run(script, *args); assert r.returncode == 0, r.stdout + r.stderr
assert {p: digest(p) for p in paths} == before


def change(path, value):
    def apply(m):
        row = m
        for key in path[:-1]: row = row[key]
        row[path[-1]] = value
    return apply


f = ['models', TOKEN, 'facings', 'front']; back = ['models', TOKEN, 'facings', 'back']
cases = [
    ('wrong client', change(['sourceBundle', 'client'], 'global')),
    ('wrong original URL', change(['sourceBundle', 'url'], 'https://example.com/original.dat')),
    ('wrong original bundle hash', change(['sourceBundle', 'sha256'], '0' * 64)),
    ('wrong original bundle size', change(['sourceBundle', 'bytes'], 1)),
    ('moving native resource version', change(['sourceBundle', 'resourceVersion'], 'latest')),
    ('moving foundation', change(['foundation', 'sha256'], '0' * 64)),
    ('moving avatar revision', change(['avatarSource', 'commit'], 'main')),
    ('undeclared transformation', change(['sourceBundle', 'transforms'], [])),
    ('invented facing', change(['models', TOKEN, 'facings', 'down'], {})),
    ('rounded root pointer', change(f + ['originalPathIds', 'rootPathId'], float(-5788352084631041927))),
    ('rebound animator', change(f + ['originalPathIds', 'animatorPathId'], '1')),
    ('rebound skeleton', change(f + ['originalPathIds', 'textAssetPathId'], '1')),
    ('rebound material', change(f + ['originalPathIds', 'materialPathId'], '1')),
    ('rebound texture', change(f + ['originalPathIds', 'rgbTexturePathId'], '1')),
    ('wrong texture dimensions', change(f + ['textureDimensions'], [512, 512])),
    ('wrong alpha mode', change(f + ['materialFloats', '_StraightAlphaInput'], 1)),
    ('wrong Spine version', change(f + ['spineVersion'], '4.1')),
    ('invented attack', change(f + ['durations', 'Attack'], 1)),
    ('invented Back death', change(back + ['animationRoles', 'die'], 'Die')),
    ('invented stun', change(f + ['durations', 'Stun'], 1)),
    ('wrong literal event', change(f + ['eventPayloads', 'Start', 0, 'time'], .2)),
    ('wrong idle duration', change(f + ['durations', 'Idle'], 99)),
    ('invented Back alias', change(back + ['missingOptionalAliases'], [])),
    ('changed native face switcher', change(f + ['nativeFaceSwitcher'], {})),
    ('invented default bounds', change(f + ['bounds'], {'width': 999})),
    ('wrong skeleton file hash', change(f + ['files', TOKEN + '.skel', 'sha256'], '0' * 64)),
    ('changed owner pixel binding', change(['ownerModels', 'front', 'decodedPixelSha256'], '0' * 64)),
    ('wrong owner alpha mode', change(['ownerModels', 'front', 'metadata', 'premultipliedAlpha'], False)),
    ('invented owner End request', change(['ownerModels', 'front', 'metadata', 'animationRoles', 'attack', 'end'], 'Attack_End')),
    ('invented owner Back death', change(['ownerModels', 'back', 'metadata', 'animationRoles', 'die'], 'Die')),
    ('premature public approval', change(['enabledOperators'], ['char_4228_closur'])),
    ('invented frame parity', change(['frameParity'], True)),
]
negative = OUT / 'altered-metadata.json'
try:
    for name, mutate in cases:
        m = copy.deepcopy(baseline); mutate(m); negative.write_text(json.dumps(m))
        result = run('verify-closur-models', '--metadata', str(negative))
        assert result.returncode != 0 and 'AssertionError' in result.stderr, name + ': ' + result.stdout + result.stderr
        print('Rejected', name, flush=True)
    # A forged file hash cannot certify changed source pixels or atlas regions.
    record = baseline['models'][TOKEN]['facings']['front']
    for name in [TOKEN + '.png', TOKEN + '.atlas']:
        path = OUT / record['directory'] / name; original = path.read_bytes()
        try:
            if name.endswith('.png'):
                image = Image.open(path).copy(); image.putpixel((0, 0), (255, 255, 255, 255)); image.save(path)
            else: path.write_text(path.read_text().replace('rotate: 180', 'rotate: false'))
            assert path.read_bytes() != original
            m = copy.deepcopy(baseline)
            m['models'][TOKEN]['facings']['front']['files'][name] = {'bytes': path.stat().st_size, 'sha256': digest(path)}
            negative.write_text(json.dumps(m))
            r = run('verify-closur-models', '--metadata', str(negative))
            assert r.returncode != 0 and 'AssertionError' in r.stderr, r.stdout + r.stderr
            print('Rejected altered bytes with updated metadata hash:', name, flush=True)
        finally: path.write_bytes(original)
finally: negative.unlink(missing_ok=True)
assert {p: digest(p) for p in paths} == before
print(f'Reproduced {len(paths)} files; rejected {len(cases) + 2} altered claims; original files unchanged', flush=True)
