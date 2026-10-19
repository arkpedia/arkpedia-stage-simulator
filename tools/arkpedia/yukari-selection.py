#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Original Yukari priority groups and same-bundle highest-ATK corroboration."""
import argparse,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/local-extract'))
import aklz4,UnityPy
parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');parser.add_argument('--metadata');args=parser.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=(ROOT/'data/arkpedia-native-operators/char_4219_yukari.json').read_bytes()
assert sha(raw)=='eb4b2640253141e8a0cae32a5712348258cba08da239c16eae53bf7726a710f9'
e=json.loads(raw);bundle=next(b for b in e['source']['bundles'] if b['path']=='battle/prefabs/[uc]skills.ab')
binary=(ROOT/'.cache/arkpedia/cn-native-source/bundles'/bundle['path']).read_bytes()
assert len(binary)==bundle['bytes'] and sha(binary)==bundle['sha256'] and hashlib.md5(binary).hexdigest()==bundle['md5']
table=(ROOT/'.cache/arkpedia/cn-coverage/skill_table.json').read_bytes();binding=e['source']['tableGitBlobs']['skill_table.json']
assert len(table)==binding['bytes'] and sha(table)==binding['sha256']
assert hashlib.sha1(f'blob {len(table)}\0'.encode()+table).hexdigest()==binding['gitBlob']
skills=json.loads(table);objects={o.path_id:o for o in UnityPy.load(binary).objects}
def normalize(v):
 if isinstance(v,list):return [normalize(x) for x in v]
 if isinstance(v,dict):return {k:str(x) if k=='m_PathID' else normalize(x) for k,x in v.items()}
 return v
def row(path_id):
 d=objects[int(path_id)].read_typetree();go=objects[d['m_GameObject']['m_PathID']].read_typetree()
 tr=next(objects[c['component']['m_PathID']] for c in go['m_Component'] if objects[c['component']['m_PathID']].type.name=='Transform');names=[go['m_Name']]
 while tr.read_typetree()['m_Father']['m_PathID']:
  tr=objects[tr.read_typetree()['m_Father']['m_PathID']];names.append(objects[tr.read_typetree()['m_GameObject']['m_PathID']].read_typetree()['m_Name'])
 return {'pathId':str(path_id),'hierarchy':list(reversed(names)),'postFilter':d['_postFilter'],'selector':normalize(d)}
groups=[row(i) for i in ['-4877054061279433162','-7771582958315885002','-4898207796721603018','-7696040682394866122']]
assert [r['hierarchy'] for r in groups]==[['skchr_yukari_2','Skill_2','Selector',n] for n in ['Makoto','Caster','Other','Yukari']]
corroboration=[row(i) for i in ['21625057519026118','6635311785527173792']]
assert [r['hierarchy'] for r in corroboration]==[['skchr_cello_2','S2Selector','Selector'],['skchr_cello_3','S3AtkSelector','Selector']]
assert all(r['postFilter']==17 for r in groups+corroboration)
descriptions={k:skills[k]['levels'][-1]['description'] for k in ['skchr_cello_2','skchr_cello_3']}
assert all('攻击力最高' in v for v in descriptions.values())
proof={'operator':'char_4219_yukari','foundationSha256':sha(raw),'bundle':bundle,'table':{'repository':e['source']['repository'],'commit':e['source']['commit'],**binding},
 'groups':groups,'corroboration':corroboration,'descriptions':descriptions,'mapping':'Original named groups retain Makoto, Caster, Other, Yukari order. Same-bundle Cello S2/S3 ATK selectors plus pinned source descriptions corroborate postFilter17 as highest current ATK. Compiled tie, enum aliases and dispatch are not certified.',
 'enabledOperators':[],'frameParity':False,'compiledEnumParity':False}
out=ROOT/'data/arkpedia-yukari-selection.json'
if args.write:out.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
else:assert json.loads((Path(args.metadata) if args.metadata else out).read_bytes())==proof
print('Verified original priority hierarchy, same-bundle selectors and pinned highest-ATK descriptions; no compiled/public approval')
