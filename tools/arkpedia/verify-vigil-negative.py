#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Ensure incomplete or altered Vigil records fail the independent source audit.

Run with the same Python environment/cache as verify-vigil.py. All mutants stay
under .cache; this never edits published evidence or source bundles.
"""
import copy
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
E = json.loads((ROOT / 'data/arkpedia-vigil-prefabs.json').read_text())
OUT = ROOT / '.cache/arkpedia/vigil-source/negative-audits'
OUT.mkdir(parents=True, exist_ok=True)
checks = []

def add(name, change): checks.append((name, change))
def first(e, group): return next(r for rs in e[group].values() for r in rs if r['components'])
def component(e, group, path):
    return next(c['data'] for rs in e[group].values() for r in rs for c in r['components'] if c['pathId'] == path)

for group in ['characters','tokens','skills','projectiles']:
    add('omitted-' + group + '-component', lambda e, g=group: first(e,g)['components'].pop())
add('omitted-fatal-template', lambda e: e['templates'].pop('vigil_wolf_t_1[listener]'))
add('omitted-original-head-damage-graph', lambda e: e['originalTemplates'].pop('vigil_wolf_t_1_enhance[damage]'))
add('omitted-owner-S3-rank', lambda e: e['tables']['skills']['skchr_vigil_3']['levels'].pop())
add('invented-token-S1-ranks', lambda e: e['tables']['tokenSkills']['sktok_vigil_wolf_1']['levels'].append(
    copy.deepcopy(e['tables']['tokenSkills']['sktok_vigil_wolf_1']['levels'][0])))
add('omitted-owner-facing-controller', lambda e: e['chararts']['char_427_vigil'].pop())
add('changed-token-rebirth-delay', lambda e: component(e,'tokens','6906676463158511439').update(_preDelay=0))
add('changed-token-retained-buffs', lambda e: component(e,'tokens','-3264388375348295857')['_retainedBuffsWhenDead'].remove('vigil_wolf_s_2'))
add('changed-skill-buff-callback', lambda e: component(e,'skills','-4982643209364968251').update(_runActionOnEvent=3))
add('changed-S3-projectile-dispatch', lambda e: component(e,'characters','-253462326774432967').update(_waitAttackEventForAllAttacks=1))
add('changed-promotion-head-recovery', lambda e: e['tables']['tokens']['token_10028_vigil_wolf']['talents'][0]['candidates'][2]['blackboard'][1].update(value=20))
add('changed-original-fire-event', lambda e: e['models']['char_427_vigil']['Back']['eventPayloads']['Skill3_Attack_C'][1].update(time=.25))
add('changed-original-token-atlas', lambda e: e['models']['token_10028_vigil_wolf']['Original'].update(atlasSha256='0'*64))
add('duplicate-native-component', lambda e: first(e,'tokens')['components'].append(copy.deepcopy(first(e,'tokens')['components'][0])))
add('wrong-token-skeleton-pointer', lambda e: e['officialSkeletonBindings']['token_10028_vigil_wolf']['Original'].update(skeletonAnimationPathId='0'))

for name, change in checks:
    mutant = copy.deepcopy(E); change(mutant)
    path = OUT / (name + '.json')
    path.write_text(json.dumps(mutant))
    result = subprocess.run([sys.executable, str(ROOT / 'tools/arkpedia/verify-vigil.py'), str(path)],
        cwd=ROOT, capture_output=True, text=True)
    if result.returncode == 0: raise AssertionError('Verifier accepted ' + name)
    if 'AssertionError' not in result.stderr: raise AssertionError('Unexpected audit failure ' + name + ': ' + result.stderr)
    print('Rejected ' + name, flush=True)
print(f'Rejected all {len(checks)} altered source records', flush=True)
