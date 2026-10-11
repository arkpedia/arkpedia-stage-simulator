#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce complete native Thorns evidence and reject altered/incomplete records.
This audits source bytes and dependency membership, not combat or game-frame fidelity.
Run with .cache/map-env/bin/python tools/arkpedia/audit-thorns-lodestar.py.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/arkpedia/thorns-lodestar-source'
SOURCE=ROOT/'data/arkpedia-thorns-lodestar-prefabs.json'
ID='char_1039_thorn2'
def run(args):return subprocess.run(args,cwd=ROOT,text=True,capture_output=True)
def checked(args):
    r=run(args)
    if r.returncode:raise RuntimeError(r.stdout+r.stderr)
    return r.stdout.strip()
def hashes():return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE,OUT/'models.json']}
baseline=checked([sys.executable,'tools/arkpedia/verify-thorns-lodestar.py'])
print(baseline,flush=True)
before=hashes()
checked(['node','tools/arkpedia/inspect-thorns-lodestar.mjs'])
checked([sys.executable,'tools/arkpedia/extract-thorns-lodestar.py'])
assert hashes()==before,'Native source outputs are not reproducible'
original=json.loads(SOURCE.read_text())
def changed(name):
    e=json.loads(json.dumps(original))
    def component(pathid):
        return next(c['data'] for group in ['characters','skills','projectiles'] for rows in e[group].values() for row in rows for c in row['components'] if c['pathId']==pathid)
    if name=='enabled-before-runtime':e['enabledOperators']=[ID];e['heldOperators']=[]
    elif name=='changed-object-activation':e['characters'][ID][0]['gameObjectData']['m_IsActive']=1-e['characters'][ID][0]['gameObjectData']['m_IsActive']
    elif name=='omitted-component':e['characters'][ID][0]['components'].pop()
    elif name=='missing-polygon-dependency':del e['projectiles']['projectile_chr_thorn2_s3_polygon']
    elif name=='changed-skill-rank':e['tables']['skills']['skchr_thorn2_3']['levels'][9]['blackboard'][0]['value']=99
    elif name=='changed-original-event':e['models'][ID]['Front']['eventPayloads']['Skill'][0]['time']=.5
    elif name=='changed-native-movement':component('-4919525718460828233')['_extraMoveSpeed']=.1
    elif name=='changed-talent-memo':e['templates']['thorn2_t_1']['eventToActions']['ON_BUFF_START'][0]['_value']=1
    elif name=='changed-skeleton-binding':e['officialSkeletonBindings'][ID]['Front']['textAssetPathId']='0'
    elif name=='missing-template-dependency':del e['templates']['heal_scale'];del e['originalTemplates']['heal_scale']
    elif name=='changed-polygon-width':component('-6779247284765065877')['_polygonLineColliderWide']=.5
    elif name=='changed-first-period':component('-1321748048543089301')['_waitFirstPeriod']=1
    else:raise ValueError(name)
    return e
rejections=[]
for name in ['enabled-before-runtime','changed-object-activation','omitted-component','missing-polygon-dependency','changed-skill-rank','changed-original-event','changed-native-movement','changed-talent-memo','changed-skeleton-binding','missing-template-dependency','changed-polygon-width','changed-first-period']:
    path=OUT/('negative-'+name+'.json');path.write_text(json.dumps(changed(name))+'\n')
    result=run([sys.executable,'tools/arkpedia/verify-thorns-lodestar.py',str(path)])
    assert result.returncode!=0 and 'AssertionError' in result.stderr,(name,result.stdout,result.stderr)
    rejections.append({'fixture':name,'rejected':True,'error':result.stderr.strip().splitlines()[-1]})
    print('Rejected '+name,flush=True)
(OUT/'review-audit.json').write_text(json.dumps({'baseline':baseline,'reproducibleOutputs':before,'negativeFixtures':rejections,'heldOperator':ID,'frameParity':False},indent=2)+'\n')
print('Native audit passed; two outputs reproduce exactly and twelve altered records are rejected',flush=True)
