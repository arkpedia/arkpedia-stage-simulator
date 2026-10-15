#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the enemy timing inventory and reject altered native claims."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
target = ROOT / 'data/arkpedia-enemy-clock-source.json'

def producer_audit(fetch_missing=False):
    inventory = ROOT / 'data/arkpedia-cn-enemy-native-source.json'
    preserved = {p: p.read_bytes() for p in [target, inventory]}
    row = next(r for r in json.loads(preserved[inventory])['bundles'] if r['path'] == 'battle/enm_pfb_0.ab')
    bundle = ROOT / '.cache/arkpedia/cn-native-source/bundles' / row['path']
    raw = bundle.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    command = [os.environ.get('ARKPEDIA_SOURCE_NODE', 'node'), str(ROOT / 'tools/arkpedia/cn-enemy-native-source.mjs')]
    try:
        changed = bytearray(raw); changed[100] ^= 1; bundle.write_bytes(changed)
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        assert result.returncode != 0 and 'Original CN bundle checksum/header mismatch: battle/enm_pfb_0.ab' in result.stderr, result.stdout + result.stderr
        assert all(p.read_bytes() == v for p, v in preserved.items())
    finally:
        bundle.write_bytes(raw)
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert all(p.read_bytes() == v for p, v in preserved.items())
    print('Rejected a same-size corrupt bundle without publishing partial inputs; restored all bytes and reproduced the complete inventory')
    manifest = ROOT / '.cache/arkpedia/cn-native-source/hot_update_list.json'
    manifest_raw = manifest.read_bytes()
    try:
        changed = bytearray(manifest_raw); changed[-2] ^= 1; manifest.write_bytes(changed)
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        assert result.returncode != 0 and 'CN native manifest differs from its immutable byte pin' in result.stderr, result.stdout + result.stderr
        assert all(p.read_bytes() == v for p, v in preserved.items())
    finally:
        manifest.write_bytes(manifest_raw)
    print('Rejected a same-size corrupt publisher manifest without replacing the reviewed receipts')
    if fetch_missing:
        backup = bundle.with_name(bundle.name + '.audit-backup-' + str(uuid.uuid4()))
        manifest_backup = manifest.with_name(manifest.name + '.audit-backup-' + str(uuid.uuid4()))
        os.replace(bundle, backup)
        os.replace(manifest, manifest_backup)
        try:
            result = subprocess.run([*command, '--fetch'], cwd=ROOT, capture_output=True, text=True)
            assert result.returncode == 0, result.stdout + result.stderr
            assert bundle.read_bytes() == raw and manifest.read_bytes() == manifest_raw
            assert all(p.read_bytes() == v for p, v in preserved.items())
            assert not list(bundle.parent.glob(bundle.name + '.partial-*'))
        finally:
            os.replace(backup, bundle)
            os.replace(manifest_backup, manifest)
        print('Fetched a missing original manifest/bundle through isolated temporary files and reproduced their exact bytes')

if '--producer-only' in sys.argv:
    producer_audit('--fetch-missing' in sys.argv)
    raise SystemExit(0)

original = target.read_bytes()
baseline = json.loads(original)
def run(script, *args):
    return subprocess.run([sys.executable, str(ROOT / 'tools/arkpedia' / (script + '.py')), *args],
                          cwd=ROOT, capture_output=True, text=True)
for name in ['extract-enemy-clocks', 'verify-enemy-clocks']:
    result = run(name); assert result.returncode == 0, result.stdout + result.stderr
assert target.read_bytes() == original

def change(path, value):
    def apply(r):
        node = r
        for k in path[:-1]: node = node[k]
        node[path[-1]] = value
    return apply

prefab = 'dyn/battle/prefabs/enemies/enemy_10001_trslim.prefab'
base = ['prefabs', prefab]
index = next(i for i, c in enumerate(baseline['prefabs'][prefab]['clockComponents'])
             if c['pathId'] == '-7147745292939599887')
component = [*base, 'clockComponents', index]
cases = [
    ('wrong inventory binding', change(['source', 'sha256'], '0' * 64)),
    ('omitted selection field', lambda r: r['selectedFields'].remove('_affectedBySlowDown')),
    ('omitted native prefab', lambda r: r['prefabs'].pop(prefab)),
    ('rebound root', change([*base, 'rootPathId'], '1')),
    ('false root name', change([*base, 'rootName'], 'foreign')),
    ('omitted hierarchy objects', change([*base, 'hierarchyObjects'], 1)),
    ('forged hierarchy fingerprint', change([*base, 'hierarchySha256'], '0' * 64)),
    ('omitted timing component', lambda r: r['prefabs'][prefab]['clockComponents'].pop(index)),
    ('rounded native pointer', change([*component, 'pathId'], float(-7147745292939599887))),
    ('rebound ancestry', change([*component, 'ancestors'], ['1'])),
    ('changed class pointer', change([*component, 'script', 'm_PathID'], '1')),
    ('changed original component hash', change([*component, 'originalDataSha256'], '0' * 64)),
    ('flipped explicit timing eligibility', change([*component, 'fields', '_affectedBySlowDown'], 0)),
    ('boolean substituted for native integer', change([*component, 'fields', '_affectedBySlowDown'], True)),
    ('integer substituted for native float', change([*component, 'fields', '_cooldown'], 0)),
    ('changed native cooldown binding', change([*component, 'fields', '_cooldownKey'], 'global-fallback')),
    ('invented alias', change([*component, 'fields', '_metadata', 'namedAsAlias'], 'different-enemy')),
    ('invented runtime approval', change(['runtimeBindingsVerified'], True)),
    ('invented compiled dispatch proof', change(['compiledDispatchVerified'], True)),
    ('premature playable Closure', change(['enabledOperators'], ['char_4228_closur'])),
]
with tempfile.TemporaryDirectory(prefix='arkpedia-enemy-clock-audit-') as temp:
    altered = Path(temp) / 'source.json'
    for label, mutate in cases:
        record = copy.deepcopy(baseline); mutate(record)
        altered.write_text(json.dumps(record, ensure_ascii=False))
        result = run('verify-enemy-clocks', str(altered))
        assert result.returncode != 0 and 'AssertionError' in result.stderr, label + ': ' + result.stdout + result.stderr
        print('Rejected', label, flush=True)
assert hashlib.sha256(target.read_bytes()).digest() == hashlib.sha256(original).digest()
print(f'Reproduced one complete timing inventory; rejected {len(cases)} altered claims; original unchanged')
producer_audit()
