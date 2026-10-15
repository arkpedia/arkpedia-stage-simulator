#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Mon3tr artwork and reject altered source/model claims."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/mon3tr-source/device-art'
TOKEN = 'token_10050_monstr_prosts'
META = OUT / 'sources.json'


def run(args): return subprocess.run(args, cwd=ROOT, capture_output=True, text=True)


baseline = json.loads(META.read_text())
paths = [META, ROOT / 'data/arkpedia-mon3tr-device-art.json']
r = baseline['models'][TOKEN]
paths.extend(OUT / r['directory'] / name for name in r['files'])
before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
rebuild = run([sys.executable, 'tools/arkpedia/extract-mon3tr-models.py'])
assert rebuild.returncode == 0, rebuild.stdout + rebuild.stderr
assert before == {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
positive = run([sys.executable, 'tools/arkpedia/verify-mon3tr-models.py', '--delivered'])
assert positive.returncode == 0, positive.stdout + positive.stderr


def change(path, value):
    def apply(m):
        target = m
        for part in path[:-1]: target = target[part]
        target[path[-1]] = value
    return apply


model = ['models', TOKEN]
mutations = [
    ('wrong bundle hash', change(['sourceBundle','sha256'],'0'*64)),
    ('wrong bundle length', change(['sourceBundle','bytes'],1)),
    ('moving native version', change(['sourceBundle','resourceVersion'],'latest')),
    ('wrong source URL', change(['sourceBundle','url'],'https://example.org/model')),
    ('undeclared pixel transformation', change(['sourceBundle','transforms'],[])),
    ('wrong foundation', change(['foundation','sha256'],'0'*64)),
    ('moving avatar source', change(['avatarSource','commit'],'main')),
    ('invented facing', change(model+['facings'],{'front':{}})),
    ('rebound skeleton', change(model+['originalPathIds','textAssetPathId'],'1')),
    ('rebound texture', change(model+['originalPathIds','rgbTexturePathId'],'1')),
    ('rebound material', change(model+['originalPathIds','materialPathId'],'1')),
    ('invented texture size', change(model+['textureDimensions'],[512,512])),
    ('wrong alpha mode', change(model+['materialFloats','_StraightAlphaInput'],1)),
    ('wrong spine version', change(model+['spineVersion'],'4.1')),
    ('invented attack timing', change(model+['eventPayloads','Attack',0,'time'],.1)),
    ('invented duration', change(model+['durations','Idle'],12)),
    ('invented hit count', change(model+['hits','End'],2)),
    ('invented bounds', change(model+['bounds'],{'width':999})),
    ('wrong idle role', change(model+['animationRoles','idle'],'Loop')),
    ('invented death role', change(model+['animationRoles','die'],'End')),
    ('wrong native alias', change(model+['nativeAnimationAliases','Born'],'Idle')),
    ('wrong skeleton hash', change(model+['files',TOKEN+'.skel','sha256'],'0'*64)),
]
negative = OUT / 'altered-metadata.json'
try:
    for name, mutation in mutations:
        m = copy.deepcopy(baseline)
        mutation(m)
        negative.write_text(json.dumps(m))
        result = run([sys.executable, 'tools/arkpedia/verify-mon3tr-models.py', '--metadata', str(negative)])
        assert result.returncode != 0, f'Accepted altered claim: {name}'
        assert 'AssertionError' in result.stderr, f'Unexpected verifier failure for {name}: {result.stderr}'
        print('Rejected', name, flush=True)
finally:
    negative.unlink(missing_ok=True)
assert before == {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
print(f'Reproduced {len(paths)} files; rejected {len(mutations)} altered claims; original files unchanged', flush=True)
