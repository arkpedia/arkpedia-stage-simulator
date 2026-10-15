#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce a selected original CN receipt and reject changed source claims."""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--operator', required=True)
args = parser.parse_args()
ID = args.operator
source = ROOT / 'data/arkpedia-native-operators' / (ID + '.json')
out = ROOT / '.cache/arkpedia/cn-operators' / ID
def run(tool, *extra):
    return subprocess.run([sys.executable, 'tools/arkpedia/' + tool + '.py', '--operator', ID, *extra],
                          cwd=ROOT, capture_output=True, text=True)
def checked(tool):
    r = run(tool)
    assert r.returncode == 0, r.stdout + r.stderr
def hashes():
    outputs = [source, out / 'models.json', out / 'bindings.json', *out.glob('*.skel'), *out.glob('*.atlas')]
    if (out / 'tokens').exists():
        outputs.extend(p for p in (out / 'tokens').rglob('*') if p.is_file()
                       and (p.suffix in ['.skel', '.atlas'] or p.name in ['models.json', 'bindings.json']))
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in outputs}
checked('verify-cn-operator')
before = hashes()
checked('extract-cn-operator')
assert hashes() == before, 'Non-reproducible original CN source'
original = json.loads(source.read_bytes())
skill = next(iter(original['tables']['skills']))
prefab = next(iter(original['skills']))
template = next(iter(original['templates']))
face = next(iter(original['models'][ID]))
range_id = next(iter(original['tables']['ranges']))
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
    ('wrong owner', change(['operatorId'], 'char_0_other')),
    ('moving source', change(['source', 'commit'], 'main')),
    ('wrong native client', change(['source', 'nativeClient'], 'latest')),
    ('wrong inventory', change(['source', 'nativeInventorySha256'], '0' * 64)),
    ('wrong table', change(['source', 'tableGitBlobs', 'buff_table.json', 'gitBlob'], '0' * 40)),
    ('missing source bundle', delete(['source', 'bundles', 0])),
    ('wrong source bundle', change(['source', 'bundles', 0, 'sha256'], '0' * 64)),
    ('missing owner', delete(['characters', ID])),
    ('missing child object', delete(['characters', ID, -1])),
    ('missing component', delete(['characters', ID, 0, 'components', 0])),
    ('changed source object', change(['characters', ID, 0, 'gameObjectData', 'm_Name'], 'invented')),
    ('changed native component type', change(['characters', ID, 0, 'components', 0, 'type'], 'Unknown')),
    ('missing artwork hierarchy', delete(['artworkHierarchy', ID])),
    ('duplicate owner object', lambda e: e['characters'][ID].append(copy.deepcopy(e['characters'][ID][0]))),
    ('missing source skill', delete(['skills', prefab])),
    ('missing source rank', delete(['tables', 'skills', skill, 'levels', 9])),
    ('changed literal skill-prefab binding', change(['skillBindings', skill], ['invented'])),
    ('invented owner mode', change(['ownerModeSkills'], ['invented'])),
    ('missing JSON template', delete(['templates', template])),
    ('missing native template', delete(['originalTemplates', template])),
    ('missing source range', delete(['tables', 'ranges', range_id])),
    ('missing native facing', delete(['models', ID, face])),
    ('wrong skeleton', change(['officialSkeletonBindings', ID, face, 'sha256'], '0' * 64)),
    ('changed original duration', change(['models', ID, face, 'durations', 'Attack'], 123)),
    ('premature public kit approval', change(['enabledOperators'], [ID])),
    ('unsupported frame parity', change(['frameParity'], True)),
    ('unsupported native particles', change(['nativeParticleSupport'], True)),
    ('unsupported modules', change(['moduleSupport'], True)),
]
if original['projectiles']:
    cases.append(('missing native projectile', delete(['projectiles', next(iter(original['projectiles']))])))
if original['buffDatabase']:
    cases.append(('missing buff database input', delete(['buffDatabase', next(iter(original['buffDatabase']))])))
if original.get('skillPrefabOverrides'):
    overridden = next(iter(original['skillPrefabOverrides']))
    cases.extend([
        ('missing explicit skill override', delete(['skillPrefabOverrides', overridden])),
        ('changed explicit skill override', change(['skillPrefabOverrides', overridden], 'invented')),
        ('missing explicit override prefab', delete(['skills', original['skillPrefabOverrides'][overridden]])),
    ])
if original.get('tokens'):
    token = next(iter(original['tokens']))
    token_face = next(iter(original['models'][token]))
    cases.extend([
        ('missing token graph', delete(['tokens', token])),
        ('missing token child', delete(['tokens', token, -1])),
        ('missing token component', delete(['tokens', token, 0, 'components', 0])),
        ('changed token component', change(['tokens', token, 0, 'components', 0, 'type'], 'Unknown')),
        ('missing token table', delete(['tables', 'tokens', token])),
        ('invented token mode skill', change(['tokenModeSkills', token], ['invented'])),
        ('missing token source', delete(['tokenSources', token])),
        ('wrong token bundle', change(['tokenSources', token, 'bundle'], 'invented')),
        ('wrong token container', change(['tokenSources', token, 'container'], 'invented')),
        ('wrong token root', change(['tokenSources', token, 'rootPathId'], '0')),
        ('wrong token animator', change(['tokenSources', token, 'animatorPathId'], '0')),
        ('missing embedded token artwork controller', delete(['tokenArtworkControllers', token])),
        ('changed token artwork controller', change(['tokenArtworkControllers', token, 0, 'pathId'], '0')),
        ('missing token skeleton binding', delete(['officialSkeletonBindings', token])),
        ('wrong token skeleton bytes', change(['officialSkeletonBindings', token, token_face, 'sha256'], '0' * 64)),
        ('missing token model', delete(['models', token])),
        ('invented token attack animation', change(['models', token, token_face, 'durations', 'Attack'], 1)),
    ])
    token_skill = next(iter(original['tokenSkillBindings'][token]), None)
    if token_skill:
        cases.extend([
            ('missing token-owned skill table', delete(['tables', 'tokenSkills', token_skill])),
            ('changed token skill binding', change(['tokenSkillBindings', token, token_skill], ['invented'])),
            ('invented token skill override', change(['tokenSkillPrefabOverrides', token, token_skill], 'invented')),
        ])
        token_prefab = original['tokenSkillPrefabOverrides'][token].get(token_skill)
        if token_prefab is None:
            token_prefab = next((p for p in original['tokenSkillBindings'][token][token_skill] if p is not None), None)
        if token_prefab:
            cases.append(('missing token skill prefab', delete(['skills', token_prefab])))
    payloads = original['models'][token][token_face]['eventPayloads']
    track = next((name for name, events in payloads.items() if events), None)
    if track:
        cases.append(('changed token literal event', change(['models', token, token_face, 'eventPayloads', track, 0, 'time'],
                                                           payloads[track][0]['time'] + 1)))
negative = out / 'negative-evidence.json'
try:
    for name, apply in cases:
        e = copy.deepcopy(original); apply(e)
        assert e != original
        negative.write_text(json.dumps(e))
        r = run('verify-cn-operator', '--evidence', str(negative))
        assert r.returncode != 0, 'Accepted ' + name
        print('Rejected ' + name, flush=True)
finally:
    negative.unlink(missing_ok=True)
assert hashes() == before
print(f'Reproduced {len(before)} original outputs; rejected {len(cases)} altered source/approval claims', flush=True)
