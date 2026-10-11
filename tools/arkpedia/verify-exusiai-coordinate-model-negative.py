#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Ensure self-consistent altered art cannot pass the independent native audit."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/exusiai-covenant-source/coordinates-art'
NEG = OUT.parent / 'coordinates-art-negative'
ID = 'token_10056_angel2_target'
VERIFY = ROOT / 'tools/arkpedia/verify-exusiai-coordinate-model.py'
subprocess.check_call([sys.executable, str(VERIFY)], cwd=ROOT)
for case in ['pixel', 'atlas-region', 'native-facing', 'skeleton', 'avatar', 'invented-attack']:
    directory = NEG / case
    directory.mkdir(parents=True, exist_ok=True)
    shutil.copytree(OUT / 'original', directory / 'original', dirs_exist_ok=True)
    metadata = json.loads((OUT / 'sources.json').read_text())
    record = metadata['models'][ID]
    path = None
    if case == 'pixel':
        path = directory / 'original' / (ID + '.png')
        image = Image.open(path).convert('RGBA')
        pixel = image.getpixel((0, 0))
        image.putpixel((0, 0), ((pixel[0] + 1) % 256, *pixel[1:]))
        image.save(path)
    elif case == 'atlas-region':
        path = directory / 'original' / (ID + '.atlas')
        original = path.read_text()
        changed = original.replace('rotate: false', 'rotate: true', 1)
        assert changed != original
        path.write_text(changed)
    elif case == 'native-facing':
        record['originalPathIds']['faceSwitcherPathId'] = '0'
    elif case in ['skeleton', 'avatar']:
        path = directory / 'original' / (ID + '.skel' if case == 'skeleton' else 'avatar.png')
        data = path.read_bytes()
        path.write_bytes(data[:-1] + bytes([data[-1] ^ 1]))
    else:
        record['animationRoles']['attack'] = 'Idle'
    # Updating hashes must not hide edits from the native source comparison.
    if path:
        data = path.read_bytes()
        record['files'][path.name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    file = directory / 'sources.json'
    file.write_text(json.dumps(metadata, indent=2) + '\n')
    result = subprocess.run([sys.executable, str(VERIFY), '--metadata', str(file)],
        cwd=ROOT, capture_output=True, text=True)
    assert result.returncode != 0 and 'AssertionError' in result.stderr, case
    print('Rejected altered', case)
print('All six altered coordinate-art fixtures rejected')
