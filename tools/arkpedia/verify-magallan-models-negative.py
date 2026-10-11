#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reject rehashed mutations of every default drone against native source bytes."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/magallan-source/drone-art'
NEG = OUT.parent / 'drone-art-negative'
VERIFY = ROOT / 'tools/arkpedia/verify-magallan-models.py'
subprocess.check_call([sys.executable, str(VERIFY)], cwd=ROOT)
cases = ['pixel', 'alpha', 'atlas-region', 'native-facing', 'skeleton', 'avatar', 'death-alias', 'event', 'material']
count = 0
for n in range(1, 4):
    token = 'token_10005_mgllan_drone' + str(n)
    for case in cases + (['invented-attack'] if n == 1 else []):
        directory = NEG / (token + '-' + case)
        directory.mkdir(parents=True, exist_ok=True)
        metadata = json.loads((OUT / 'sources.json').read_text())
        for id in metadata['models']:
            shutil.copytree(OUT / id, directory / id, dirs_exist_ok=True)
        record = metadata['models'][token]
        path = None
        if case in ['pixel', 'alpha']:
            path = directory / token / (token + '.png')
            image = Image.open(path).convert('RGBA')
            pixel = list(image.getpixel((0, 0)))
            channel = 0 if case == 'pixel' else 3
            pixel[channel] = (pixel[channel] + 1) % 256
            image.putpixel((0, 0), tuple(pixel))
            image.save(path)
        elif case == 'atlas-region':
            path = directory / token / (token + '.atlas')
            original = path.read_text()
            changed = original.replace('rotate: false', 'rotate: true', 1)
            assert changed != original
            path.write_text(changed)
        elif case == 'native-facing':
            record['originalPathIds']['faceSwitcherPathId'] = '0'
        elif case in ['skeleton', 'avatar']:
            path = directory / token / (token + '.skel' if case == 'skeleton' else 'avatar.png')
            data = path.read_bytes()
            path.write_bytes(data[:-1] + bytes([data[-1] ^ 1]))
        elif case == 'death-alias':
            record['animationRoles']['die'] = 'Die'
        elif case == 'event':
            record['eventPayloads']['Attack'] = [{'time': 0, 'name': 'OnAttack'}]
        elif case == 'material':
            record['materialFloats']['_UseAlphaTex'] = 0
        else:
            record['animationRoles']['attack'] = 'Idle'
        if path:
            data = path.read_bytes()
            record['files'][path.name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        file = directory / 'sources.json'
        file.write_text(json.dumps(metadata, indent=2) + '\n')
        result = subprocess.run([sys.executable, str(VERIFY), '--metadata', str(file)],
            cwd=ROOT, capture_output=True, text=True)
        assert result.returncode != 0 and 'AssertionError' in result.stderr, (token, case, result.stderr)
        count += 1
        print('Rejected altered', token, case)
print('All', count, 'altered default-drone artwork fixtures rejected')
