#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify Rosmontis against native bytes, reproducibility and damaged evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-rosmontis.py after
fetch-rosmontis.mjs, extract-rosmontis-models.py, inspect-rosmontis.mjs and
extract-rosmontis.py. This does not enable combat or claim Unity frame parity.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/rosmontis-source'
SOURCE = ROOT / 'data/arkpedia-rosmontis-prefabs.json'
PYTHON = sys.executable

def run(args):
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)

def checked(args):
    result = run(args)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()

def output_hashes():
    paths = [SOURCE, OUT/'models.json', OUT/'equipment/models.json', OUT/'equipment/sources.json']
    paths += sorted((OUT/'equipment/front').glob('*'))
    paths += sorted((OUT/'equipment/back').glob('*'))
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}

baseline = checked([PYTHON, 'tools/arkpedia/verify-rosmontis.py'])
print(baseline, flush=True)
before = output_hashes()
for args in [[PYTHON, 'tools/arkpedia/extract-rosmontis-models.py'],
             ['node', 'tools/arkpedia/inspect-rosmontis.mjs'],
             [PYTHON, 'tools/arkpedia/extract-rosmontis.py']]:
    checked(args)
assert before == output_hashes(), 'Re-extraction changed source evidence or original artwork'
original = json.loads(SOURCE.read_text())

def altered(name):
    # Every fixture starts from the independently verified, unmodified record.
    e = json.loads(json.dumps(original))
    if name == 'missing-runtime-gate':
        e['enabledOperators'] = []; e['heldOperators'] = ['char_391_rosmon']
    elif name == 'omitted-component':
        e['characters']['char_391_rosmon'][0]['components'].pop()
    elif name == 'missing-projectile':
        del e['projectiles']['projectile_chr_rosmon_after_shock']
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_rosmon_1']['levels'][9]['blackboard'][0]['value'] = 2
    elif name == 'changed-original-event':
        e['models']['char_391_rosmon']['Front']['eventPayloads']['Attack_A'][0]['time'] = .1
    elif name == 'changed-alpha-pointer':
        e['tokenArtwork']['models']['token_10012_rosmon_shield']['facings']['front']['originalPathIds']['alphaTexturePathId'] = '0'
    elif name == 'changed-buff-action':
        e['templates']['rosmon_s_1']['eventToActions']['ON_BUFF_START'][0]['_damageType'] = 'PHYSICAL'
    elif name == 'changed-skeleton-binding':
        e['officialSkeletonBindings']['char_391_rosmon']['Front']['textAssetPathId'] = '0'
    else:
        raise ValueError(name)
    return e

rejections = []
for name in ['missing-runtime-gate','omitted-component','missing-projectile','changed-skill-rank',
             'changed-original-event','changed-alpha-pointer','changed-buff-action','changed-skeleton-binding']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(altered(name)) + '\n')
    result = run([PYTHON, 'tools/arkpedia/verify-rosmontis.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True, 'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

report = {'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
          'publicRuntimeMapping': 'rosmontis', 'frameParity': False}
(OUT/'review-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'Native audit passed; {len(before)} outputs reproduce exactly and {len(rejections)} modified records are rejected', flush=True)
