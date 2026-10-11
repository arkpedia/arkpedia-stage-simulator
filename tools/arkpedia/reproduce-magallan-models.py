#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Require byte-identical Magallan drone receipt and files on repeat extraction."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/magallan-source/drone-art'


def snapshot():
    metadata = json.loads((OUT / 'sources.json').read_text())
    files = [ROOT / 'data/arkpedia-magallan-drone-art.json', OUT / 'sources.json']
    files += [OUT / record['directory'] / name for record in metadata['models'].values() for name in record['files']]
    return {str(file.relative_to(ROOT)): hashlib.sha256(file.read_bytes()).hexdigest() for file in files}


before = snapshot()
subprocess.check_call([sys.executable, 'tools/arkpedia/extract-magallan-models.py'], cwd=ROOT)
assert snapshot() == before, 'Repeat extraction changed original drone export bytes'
print('Receipt, metadata and twelve original files reproduced byte-for-byte')
