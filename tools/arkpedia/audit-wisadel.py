#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify Wisadel against native bytes, reproducibility and damaged evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-wisadel.py after
fetch-wisadel.mjs, extract-wisadel-models.py, inspect-wisadel.mjs and
extract-wisadel.py. This does not enable combat or claim Unity frame parity.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/wisadel-source'
SOURCE = ROOT / 'data/arkpedia-wisadel-prefabs.json'
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

baseline = checked([PYTHON, 'tools/arkpedia/verify-wisadel.py'])
print(baseline, flush=True)
before = output_hashes()
for args in [[PYTHON, 'tools/arkpedia/extract-wisadel-models.py'],
             ['node', 'tools/arkpedia/inspect-wisadel.mjs'],
             [PYTHON, 'tools/arkpedia/extract-wisadel.py']]:
    checked(args)
assert before == output_hashes(), 'Re-extraction changed source evidence or original artwork'
original = json.loads(SOURCE.read_text())

def altered(name):
    # Every fixture starts from the independently verified, unmodified record.
    e = json.loads(json.dumps(original))
    if name == 'missing-runtime-gate':
        e['enabledOperators'] = ['char_1035_wisdel']; e['heldOperators'] = []
    elif name == 'omitted-component':
        e['characters']['char_1035_wisdel'][0]['components'].pop()
    elif name == 'missing-projectile':
        del e['projectiles']['projectile_chr_wisdel_s1_shock2']
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_wisdel_1']['levels'][9]['blackboard'][0]['value'] = 2
    elif name == 'changed-original-event':
        e['models']['char_1035_wisdel']['Front']['eventPayloads']['Attack_A'][0]['time'] = .1
    elif name == 'changed-alpha-pointer':
        e['tokenArtwork']['models']['token_10035_wisdel_wward']['facings']['front']['originalPathIds']['alphaTexturePathId'] = '900126499714364929'
    elif name == 'changed-buff-action':
        e['templates']['wisdel_t_1[projectile_shock]']['eventToActions']['ON_BUFF_START'][2]['_damageType'] = 'MAGICAL'
    elif name == 'changed-skeleton-binding':
        e['officialSkeletonBindings']['char_1035_wisdel']['Front']['textAssetPathId'] = '0'
    else:
        raise ValueError(name)
    return e

rejections = []
for name in ['missing-runtime-gate','omitted-component','missing-projectile','changed-skill-rank',
             'changed-original-event','changed-alpha-pointer','changed-buff-action','changed-skeleton-binding']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(altered(name)) + '\n')
    result = run([PYTHON, 'tools/arkpedia/verify-wisadel.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True, 'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

report = {'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
          'publicRuntimeMapping': None, 'heldOperator': 'char_1035_wisdel', 'frameParity': False}
(OUT/'review-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'Native audit passed; {len(before)} outputs reproduce exactly and {len(rejections)} modified records are rejected', flush=True)
