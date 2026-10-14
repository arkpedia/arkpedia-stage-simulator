#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce Necrass's source receipt and reject changed or incomplete facts."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.cache/arkpedia/necrass-source'
SOURCE = ROOT / 'data/arkpedia-necrass-prefabs.json'
ID = 'char_450_necras'
TOKEN = 'token_10043_necras_skeltn'


def run(args):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stdout + r.stderr)
    return r.stdout.strip()


def hashes():
    paths = [SOURCE, OUT / 'models.json', OUT / 'token-models.json', OUT / 'token-bindings.json',
             *sorted(OUT.glob('token_*.skel')), *sorted(OUT.glob('token_*.atlas'))]
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}


def replace(path, value):
    def mutate(e):
        v = e
        for k in path[:-1]: v = v[k]
        v[path[-1]] = value
    return mutate


def drop(path):
    def mutate(e):
        v = e
        for k in path[:-1]: v = v[k]
        del v[path[-1]]
    return mutate


def component(e, group, key, path_id):
    return next(c['data'] for r in e[group][key] for c in r['components'] if c['pathId'] == path_id)


def hide_native_only(e):
    e['originalTemplates'].pop('necras_dragon[one_shot_fx]')
    e['jsonTemplateGaps'] = []


def hide_missing_stun(e):
    e['modelAliasGaps'] = {}
    e['tokenModels'][TOKEN]['Back']['missingRequiredAliases'] = []


print(run([sys.executable, 'tools/arkpedia/verify-necrass.py']), flush=True)
before = hashes()
run(['node', 'tools/arkpedia/inspect-necrass.mjs'])
run([sys.executable, 'tools/arkpedia/extract-necrass.py'])
assert hashes() == before, 'Source receipt/model outputs are not reproducible'
print(f'Reproduced {len(before)} outputs from original pinned bytes', flush=True)
original = json.loads(SOURCE.read_text())
cases = [
    ('changed Global snapshot', replace(['source', 'commit'], 'unreviewed')),
    ('wrong bundle hash', replace(['source', 'bundles', 0, 'sha256'], '0' * 64)),
    ('premature enablement', replace(['enabledOperators'], [ID])),
    ('premature frame parity', replace(['frameParity'], True)),
    ('missing servant tree', drop(['tokens', TOKEN])),
    ('missing S2 owner rank', drop(['tables', 'skills', 'skchr_necras_2', 'levels', 5])),
    ('invented servant ranks', lambda e: e['tables']['tokenSkills']['sktok_necras_skeltn_3']['levels'].append(
        copy.deepcopy(e['tables']['tokenSkills']['sktok_necras_skeltn_3']['levels'][0]))),
    ('missing owner component', drop(['characters', ID, 0, 'components', 0])),
    ('servant consumes slot', lambda e: component(e, 'tokens', TOKEN, '-8493436737972975817').update(_occupiedRemainingCharacterCnt=1)),
    ('missing native-only dragon template', drop(['originalTemplates', 'necras_dragon[one_shot_fx]'])),
    ('hidden native-only dragon and gap', hide_native_only),
    ('missing S3 projectile', drop(['projectiles', 'projectile_chr_necras_s3'])),
    ('missing token range', drop(['tables', 'ranges', 'x-5'])),
    ('hidden required animation gap', replace(['modelAliasGaps'], {})),
    ('hidden gap and token alias report', hide_missing_stun),
    ('changed owner release', replace(['models', ID, 'Front', 'eventPayloads', 'Skill_2_Begin', 0, 'time'], .5)),
    ('changed upgraded servant release', replace(['tokenModels', TOKEN, 'Front', 'eventPayloads', 'Attack_2', 0, 'time'], .1)),
    ('changed S3 attack controller', lambda e: component(e, 'characters', ID, '8469424609932752988').update(_waitForAttackEvent=0)),
]
path = OUT / 'negative-evidence.json'
try:
    for name, mutate in cases:
        e = copy.deepcopy(original); mutate(e)
        assert e != original, name
        path.write_text(json.dumps(e))
        r = subprocess.run([sys.executable, 'tools/arkpedia/verify-necrass.py', str(path)],
                           cwd=ROOT, capture_output=True, text=True)
        assert r.returncode != 0, 'Accepted changed evidence: ' + name
        print('Rejected: ' + name, flush=True)
finally:
    path.unlink(missing_ok=True)
assert hashes() == before, 'Audit changed durable outputs'
print(run([sys.executable, 'tools/arkpedia/verify-necrass.py']), flush=True)
print(f'Necrass receipt reproduced; {len(cases)} changed-source fixtures rejected', flush=True)
