// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{existsSync,mkdtempSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';import{spawnSync}from'node:child_process';
import proof from '../data/arkpedia-yukari-selection.json' with{type:'json'};import foundation from '../data/arkpedia-native-operators/char_4219_yukari.json' with{type:'json'};
import{yukariSourceComponent as read}from'../server/sim/content/arkpedia-yukari-source.js';
test('Selection proof binds the original named priority groups and same-bundle highest-ATK corroboration',()=>{
 assert.equal(proof.operator,'char_4219_yukari');assert.deepEqual(proof.enabledOperators,[]);assert.equal(proof.frameParity,false);assert.equal(proof.compiledEnumParity,false);assert.equal(proof.foundationSha256,'eb4b2640253141e8a0cae32a5712348258cba08da239c16eae53bf7726a710f9');
 assert.deepEqual(proof.bundle,foundation.source.bundles.find(b=>b.path==='battle/prefabs/[uc]skills.ab'));assert.equal(proof.table.commit,foundation.source.commit);assert.equal(proof.table.sha256,foundation.source.tableGitBlobs['skill_table.json'].sha256);
 assert.deepEqual(proof.groups.map(g=>g.hierarchy),['Makoto','Caster','Other','Yukari'].map(n=>['skchr_yukari_2','Skill_2','Selector',n]));
 for(const g of proof.groups){assert.equal(g.postFilter,17);assert.deepEqual(g.selector,read('skills','skchr_yukari_2',g.pathId));}
 assert.deepEqual(proof.corroboration.map(g=>g.hierarchy),[['skchr_cello_2','S2Selector','Selector'],['skchr_cello_3','S3AtkSelector','Selector']]);for(const g of proof.corroboration){assert.equal(g.postFilter,17);assert.equal(g.selector._postFilter,17);}for(const text of Object.values(proof.descriptions))assert.ok(text.includes('攻击力最高'));
 const walk=v=>{if(Array.isArray(v))return v.forEach(walk);if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(k==='m_PathID')assert.equal(typeof x,'string');else walk(x);}};walk(proof);
});
const cached=existsSync(new URL('../.cache/arkpedia/cn-native-source/bundles/battle/prefabs/[uc]skills.ab',import.meta.url)),python=process.env.ARKPEDIA_SOURCE_PYTHON;
test('Original Unity hierarchy and pinned skill descriptions independently reproduce the proof and reject altered claims',{skip:!cached||!python},()=>{
 const run=path=>spawnSync(python,['tools/arkpedia/yukari-selection.py',...(path?['--metadata',path]:[])],{encoding:'utf8',timeout:120000});const good=run();assert.equal(good.status,0,good.stderr);const dir=mkdtempSync(join(tmpdir(),'yukari-selection-'));
 try{for(const change of[p=>p.groups.reverse(),p=>p.groups[0].selector._postFilter=1,p=>p.groups[1].hierarchy.pop(),p=>p.corroboration[0].postFilter=0,p=>p.table.commit='0'.repeat(40),p=>p.bundle.sha256='0'.repeat(64),p=>p.enabledOperators.push(p.operator),p=>p.compiledEnumParity=true,p=>p.descriptions.skchr_cello_2='invented']){const changed=structuredClone(proof);change(changed);const path=join(dir,createHash('sha256').update(JSON.stringify(changed)).digest('hex')+'.json');writeFileSync(path,JSON.stringify(changed));const bad=run(path);assert.notEqual(bad.status,0);assert.ok(!bad.error,String(bad.error));}}
 finally{rmSync(dir,{recursive:true,force:true});}
});
