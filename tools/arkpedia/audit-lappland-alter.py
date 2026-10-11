#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Check source reproducibility and reject incomplete/altered Lappland evidence.

Run with .cache/map-env/bin/python tools/arkpedia/audit-lappland-alter.py.
This verifies native source data, not regular-stage combat or Unity frame parity.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/lappland-alter-source'
SOURCE = ROOT / 'data/arkpedia-lappland-alter-prefabs.json'

def run(args):
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True)

def checked(args):
    result = run(args)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout.strip()

def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [SOURCE, OUT / 'models.json']}

baseline = checked([sys.executable, 'tools/arkpedia/verify-lappland-alter.py'])
print(baseline, flush=True)
before = hashes()
checked(['node', 'tools/arkpedia/inspect-lappland-alter.mjs'])
checked([sys.executable, 'tools/arkpedia/extract-lappland-alter.py'])
assert hashes() == before, 'Native source extraction is not reproducible'
original = json.loads(SOURCE.read_text())

def altered(name):
    e = json.loads(json.dumps(original))
    if name == 'enabled-before-runtime':
        e['enabledOperators'] = ['char_1038_whitw2']; e['heldOperators'] = []
    elif name == 'omitted-component':
        e['characters']['char_1038_whitw2'][0]['components'].pop()
    elif name == 'missing-drone-pair':
        del e['projectiles']['projectile_chr_whitw2_funnel_s3_4_attach']
    elif name == 'changed-skill-rank':
        e['tables']['skills']['skchr_whitw2_3']['levels'][9]['blackboard'][0]['value'] = 2
    elif name == 'changed-original-event':
        e['models']['char_1038_whitw2']['Front']['eventPayloads']['Skill_1_Loop'][0]['time'] = .4
    elif name == 'changed-native-orbit':
        for row in e['projectiles']['projectile_chr_whitw2_funnel_s3_1']:
            for component in row['components']:
                if component['pathId'] == '-8483330843134676009':
                    component['data']['_radius'] = .9
    elif name == 'changed-talent-node':
        e['templates']['whitw2_t[extra_ability]']['eventToActions']['ON_BUFF_TRIGGER'][0]['_conditionNode']['_stackCount'] = 3
    elif name == 'changed-skeleton-binding':
        e['officialSkeletonBindings']['char_1038_whitw2']['Front']['textAssetPathId'] = '0'
    elif name == 'missing-template-dependency':
        del e['templates']['fear_buff']; del e['originalTemplates']['fear_buff']
    else:
        raise ValueError(name)
    return e

rejections = []
for name in ['enabled-before-runtime', 'omitted-component', 'missing-drone-pair', 'changed-skill-rank',
             'changed-original-event', 'changed-native-orbit', 'changed-talent-node',
             'changed-skeleton-binding', 'missing-template-dependency']:
    path = OUT / ('negative-' + name + '.json')
    path.write_text(json.dumps(altered(name)) + '\n')
    result = run([sys.executable, 'tools/arkpedia/verify-lappland-alter.py', str(path)])
    assert result.returncode != 0 and 'AssertionError' in result.stderr, (name, result.stdout, result.stderr)
    rejections.append({'fixture': name, 'rejected': True, 'error': result.stderr.strip().splitlines()[-1]})
    print('Rejected ' + name, flush=True)

(OUT / 'review-audit.json').write_text(json.dumps({
    'baseline': baseline, 'reproducibleOutputs': before, 'negativeFixtures': rejections,
    'heldOperator': 'char_1038_whitw2', 'frameParity': False,
}, indent=2) + '\n')
print('Native audit passed; two outputs reproduce exactly and nine altered records are rejected', flush=True)
