#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Reproduce the complete Mon3tr source receipt and reject altered evidence."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.cache/arkpedia/mon3tr-source'
SOURCE=ROOT/'data/arkpedia-mon3tr-prefabs.json'
ID='char_4179_monstr'
TOKEN='token_10050_monstr_prosts'
def run(args):return subprocess.run(args,cwd=ROOT,capture_output=True,text=True)
def checked(args):
    r=run(args)
    assert r.returncode==0,r.stdout+r.stderr
    return r.stdout.strip()
def hashes():
    paths=[SOURCE,OUT/'models.json',OUT/'token-models.json',OUT/'token-bindings.json',*OUT.glob('token_*.skel'),*OUT.glob('token_*.atlas')]
    return {str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in paths}
def change(path,value):
    def apply(e):
        row=e
        for key in path[:-1]:row=row[key]
        row[path[-1]]=value
    return apply
def delete(path):
    def apply(e):
        row=e
        for key in path[:-1]:row=row[key]
        del row[path[-1]]
    return apply
checked([sys.executable,'tools/arkpedia/verify-mon3tr.py'])
before=hashes()
checked(['node','tools/arkpedia/inspect-mon3tr.mjs'])
checked([sys.executable,'tools/arkpedia/extract-mon3tr.py'])
assert hashes()==before,'Non-reproducible source extraction'
original=json.loads(SOURCE.read_text())
cases=[
 ('wrong source commit',change(['source','commit'],'main')),
 ('wrong model commit',change(['source','modelCommit'],'main')),
 ('wrong table Git blob',change(['source','tableGitBlobs','character_table','sha'],'0'*40)),
 ('changed bundle checksum',change(['source','bundles',0,'sha256'],'0'*64)),
 ('missing source bundle',delete(['source','bundles',0])),
 ('missing Reconstruction',delete(['tokens',TOKEN])),
 ('missing token skill',delete(['tables','tokenSkills','sktok_monstr_prosts3'])),
 ('missing owner skill rank',delete(['tables','skills','skchr_monstr_3','levels',9])),
 ('missing owner ability',delete(['skills','skchr_monstr_3'])),
 ('missing dependency template',delete(['templates','monstr_s_3_buff[respawn]'])),
 ('missing native template',delete(['originalTemplates','monstr_t_2[atk_spd]'])),
 ('missing projectile',delete(['projectiles','projectile_chr_monstr_s2_extra'])),
 ('missing expanded range',delete(['tables','ranges','x-4'])),
 ('missing component',delete(['characters',ID,0,'components',0])),
 ('duplicate object',lambda e:e['tokens'][TOKEN].append(copy.deepcopy(e['tokens'][TOKEN][0]))),
 ('invented native gap',change(['nativeSkillPrefabGaps'],['sktok_monstr_prosts3'])),
 ('changed token skeleton identity',change(['officialTokenSkeletonBindings',TOKEN,'facings','Single','sha256'],'0'*64)),
 ('invented owner Back skill clip',change(['models',ID,'Back','durations','Skill_3_Loop'],1.5)),
 ('changed owner release event',change(['models',ID,'Front','eventPayloads','Attack',0,'time'],.1)),
 ('changed token release event',change(['tokenModels',TOKEN,'Single','eventPayloads','Attack',0,'time'],.5)),
 ('missing owner facing',delete(['officialSkeletonBindings',ID,'Back'])),
 ('premature enablement',change(['enabledOperators'],[ID])),
 ('unsupported frame claim',change(['frameParity'],True)),
 ('unsupported particle claim',change(['nativeParticleSupport'],True)),
]
negative=OUT/'negative-evidence.json'
try:
    for name,apply in cases:
        e=copy.deepcopy(original);apply(e)
        assert e!=original
        negative.write_text(json.dumps(e))
        r=run([sys.executable,'tools/arkpedia/verify-mon3tr.py',str(negative)])
        assert r.returncode!=0,'Accepted '+name
        print('Rejected',name,flush=True)
finally:negative.unlink(missing_ok=True)
checked([sys.executable,'tools/arkpedia/verify-mon3tr.py'])
assert hashes()==before
print(f'Reproduced {len(before)} source outputs; rejected {len(cases)} altered claims',flush=True)
