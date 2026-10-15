#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the merchant source receipt and reject altered borrowing claims."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
receipt = ROOT / 'data/arkpedia-closur-dp-consumers.json'
original = receipt.read_bytes()
run = lambda name, *args: subprocess.run([sys.executable, str(ROOT / 'tools/arkpedia' / (name + '.py')), *args],
    cwd=ROOT, capture_output=True, text=True)
result = run('extract-closur-dp-consumers')
assert result.returncode == 0, result.stdout + result.stderr
assert receipt.read_bytes() == original
result = run('verify-closur-dp-consumers')
assert result.returncode == 0, result.stdout + result.stderr
baseline = json.loads(original)

def change(path, value):
    def apply(r):
        node = r
        for part in path[:-1]:
            node = node[part]
        node[path[-1]] = value
    return apply

cases = [
    ('wrong client', change(['source', 'client'], 'global')),
    ('wrong bundle hash', change(['source', 'bundle', 'sha256'], '0' * 64)),
    ('wrong bundle bytes', change(['source', 'bundle', 'bytes'], 1)),
    ('wrong source URL', change(['source', 'bundle', 'url'], 'https://example.com/data')),
    ('rounded holder pointer', change(['source', 'pathId'], float(6070581171229484677))),
    ('omitted inventory entry', lambda r: r['checkCostInventory'].pop('strong_tr')),
    ('omitted original graph', lambda r: r['selectedOriginalTemplates'].pop('swire2_t_2')),
    ('invented Lee shield borrowing', change(['checkCostInventory', 'lmlee_tr', 0, 'node', '_considerNegativeCost'], True)),
    ('disabled upkeep borrowing', change(['checkCostInventory', 'strong_tr', 0, 'node', '_considerNegativeCost'], False)),
    ('altered native graph', change(['selectedOriginalTemplates', 'swire2_tr', 'effectKey'], 'fake')),
    ('premature public approval', change(['enabledOperators'], ['char_4228_closur'])),
    ('invented frame parity', change(['frameParity'], True)),
]
with tempfile.TemporaryDirectory(prefix='arkpedia-dp-audit-') as temp:
    altered = Path(temp) / 'source.json'
    for label, mutate in cases:
        value = copy.deepcopy(baseline); mutate(value)
        altered.write_text(json.dumps(value))
        result = run('verify-closur-dp-consumers', str(altered))
        assert result.returncode != 0 and 'AssertionError' in result.stderr, label + ': ' + result.stdout + result.stderr
        print('Rejected', label, flush=True)
assert hashlib.sha256(receipt.read_bytes()).digest() == hashlib.sha256(original).digest()
print(f'Reproduced one source receipt; rejected {len(cases)} altered claims; original unchanged')
