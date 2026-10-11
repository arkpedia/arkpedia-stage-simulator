#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce complete native Blaze evidence and reject altered/incomplete records.
This audits source bytes and dependency membership, not combat or game-frame fidelity.
Run with .cache/map-env/bin/python tools/arkpedia/audit-blaze-igniting.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/arkpedia/blaze-igniting-source'
SOURCE=ROOT/'data/arkpedia-blaze-igniting-prefabs.json'
ID='char_1040_blaze2'
def run(args):return subprocess.run(args,cwd=ROOT,text=True,capture_output=True)
def checked(args):
    r=run(args)
    if r.returncode:raise RuntimeError(r.stdout+r.stderr)
    return r.stdout.strip()
def hashes():return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE,OUT/'models.json']}
baseline=checked([sys.executable,'tools/arkpedia/verify-blaze-igniting.py'])
print(baseline,flush=True)
before=hashes()
checked(['node','tools/arkpedia/inspect-blaze-igniting.mjs'])
checked([sys.executable,'tools/arkpedia/extract-blaze-igniting.py'])
assert hashes()==before,'Native source outputs are not reproducible'
original=json.loads(SOURCE.read_text())
def changed(name):
    e=json.loads(json.dumps(original))
    def component(pathid):
        return next(c['data'] for group in ['characters','skills','projectiles'] for rows in e[group].values() for row in rows for c in row['components'] if c['pathId']==pathid)
    if name=='enabled-before-runtime':e['enabledOperators']=[ID];e['heldOperators']=[]
    elif name=='changed-object-activation':e['characters'][ID][0]['gameObjectData']['m_IsActive']=1-e['characters'][ID][0]['gameObjectData']['m_IsActive']
    elif name=='omitted-component':e['characters'][ID][0]['components'].pop()
    elif name=='missing-projectile-dependency':del e['projectiles']['projectile_chr_blaze2_s3']
    elif name=='changed-skill-rank':e['tables']['skills']['skchr_blaze2_3']['levels'][9]['blackboard'][0]['value']=99
    elif name=='changed-original-event':e['models'][ID]['Front']['eventPayloads']['Attack'][0]['time']=.5
    elif name=='changed-native-movement':component('3811374675922069068')['_speed']=10
    elif name=='changed-cached-attack':e['templates']['blaze2_s_1']['eventToActions']['ON_BUFF_START'][0]['_blackboardKey']='current_atk'
    elif name=='changed-skeleton-binding':e['officialSkeletonBindings'][ID]['Front']['textAssetPathId']='0'
    elif name=='missing-template-dependency':del e['templates']['blaze2_s_2[leave_tile]'];del e['originalTemplates']['blaze2_s_2[leave_tile]']
    elif name=='changed-splash-radius':component('-5100262976928956288')['m_Radius']=.7
    elif name=='changed-region-delay':component('-4200255773684481920')['_delayToStart']=0
    else:raise ValueError(name)
    return e
rejections=[]
for name in ['enabled-before-runtime','changed-object-activation','omitted-component','missing-projectile-dependency','changed-skill-rank','changed-original-event','changed-native-movement','changed-cached-attack','changed-skeleton-binding','missing-template-dependency','changed-splash-radius','changed-region-delay']:
    path=OUT/('negative-'+name+'.json');path.write_text(json.dumps(changed(name))+'\n')
    result=run([sys.executable,'tools/arkpedia/verify-blaze-igniting.py',str(path)])
    assert result.returncode!=0 and 'AssertionError' in result.stderr,(name,result.stdout,result.stderr)
    rejections.append({'fixture':name,'rejected':True,'error':result.stderr.strip().splitlines()[-1]})
    print('Rejected '+name,flush=True)
(OUT/'review-audit.json').write_text(json.dumps({'baseline':baseline,'reproducibleOutputs':before,'negativeFixtures':rejections,'heldOperator':ID,'frameParity':False},indent=2)+'\n')
print('Native audit passed; two outputs reproduce exactly and twelve altered records are rejected',flush=True)
