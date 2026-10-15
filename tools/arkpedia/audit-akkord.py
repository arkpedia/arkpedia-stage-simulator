#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the complete Akkord receipt and reject source/approval mutations."""
from pathlib import Path
import copy
import hashlib
import json
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/akkord-source'
SOURCE = ROOT / 'data/arkpedia-akkord-prefabs.json'
ID = 'char_4051_akkord'
def checked(args):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
def hashes():
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in
            [SOURCE, OUT / 'models.json', *OUT.glob('*.skel'), *OUT.glob('*.atlas')]}
checked([sys.executable, 'tools/arkpedia/verify-akkord.py'])
before = hashes()
checked([sys.executable, 'tools/arkpedia/extract-akkord.py'])
assert hashes() == before, 'Non-reproducible Akkord original source'
original = json.loads(SOURCE.read_bytes())
def change(path, value):
    def apply(e):
        row = e
        for key in path[:-1]:
            row = row[key]
        row[path[-1]] = value
    return apply
def delete(path):
    def apply(e):
        row = e
        for key in path[:-1]:
            row = row[key]
        del row[path[-1]]
    return apply
cases = [
    ('moving source', change(['source', 'commit'], 'main')),
    ('wrong client', change(['source', 'nativeClient'], 'latest')),
    ('wrong table', change(['source', 'tableGitBlobs', 'buff_table.json', 'gitBlob'], '0' * 40)),
    ('wrong bundle', change(['source', 'bundles', 0, 'sha256'], '0' * 64)),
    ('missing bundle', delete(['source', 'bundles', 0])),
    ('missing owner', delete(['characters', ID])),
    ('missing native ability', delete(['skills', 'skchr_akkord_2'])),
    ('missing rank', delete(['tables', 'skills', 'skchr_akkord_1', 'levels', 9])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('duplicate object', lambda e: e['characters'][ID].append(copy.deepcopy(e['characters'][ID][0]))),
    ('changed object', change(['characters', ID, 0, 'gameObjectData', 'm_IsActive'], 0)),
    ('missing template', delete(['templates', 'akkord_s_2[aoe_damage]'])),
    ('missing native template', delete(['originalTemplates', 'akkord_t_1'])),
    ('invented projectile', change(['projectiles'], {'projectile_akkord': []})),
    ('missing range', delete(['tables', 'ranges', '4-1'])),
    ('changed art', change(['officialSkeletonBindings', ID, 'Back', 'sha256'], '0' * 64)),
    ('invented Back death', change(['models', ID, 'Back', 'durations', 'Die'], 1)),
    ('changed attack event', change(['models', ID, 'Front', 'eventPayloads', 'Attack', 0, 'time'], .1)),
    ('premature approval', change(['enabledOperators'], [ID])),
    ('frame parity', change(['frameParity'], True)),
    ('native particles', change(['nativeParticleSupport'], True)),
    ('modules', change(['moduleSupport'], True)),
]
negative = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        e = copy.deepcopy(original); mutate(e)
        assert e != original
        negative.write_text(json.dumps(e))
        r = subprocess.run([sys.executable, 'tools/arkpedia/verify-akkord.py', str(negative)], cwd=ROOT, capture_output=True)
        assert r.returncode != 0, 'Accepted ' + name
        print('Rejected ' + name, flush=True)
finally:
    negative.unlink(missing_ok=True)
assert hashes() == before
print(f'Reproduced {len(before)} original outputs; rejected {len(cases)} altered claims', flush=True)
