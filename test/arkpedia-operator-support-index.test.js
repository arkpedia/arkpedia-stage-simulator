// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {REGULAR_OPERATORS as source,assertRegularOperator as sourceAssert} from '../shared/arkpedia/operators.js';
import {REGULAR_OPERATORS as compiled,assertRegularOperator as runtimeAssert} from '../shared/arkpedia/operator-support.js';
import {buildOperatorSupportIndex,checkOperatorSupportIndex,publishOperatorSupportIndex} from '../tools/arkpedia/operator-support-index.mjs';
import {buildOperatorLibrary} from '../tools/arkpedia/operator-library.mjs';
const snapshot=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
test('every compiled support field matches its source registration, including forms and fixed actors',()=>{
  assert.deepEqual(compiled,source);
  for(const op of Object.values(snapshot.operators))assert.deepEqual(runtimeAssert(op),sourceAssert(op),op.id);
});
test('source and runtime gates reject the same unsupported skill, talent and identity',()=>{
  const op=Object.values(snapshot.operators).find(op=>op.skills.length);
  const badSkill=structuredClone(op);badSkill.skills[0].id='unregistered';
  const badTalent=structuredClone(op);badTalent.talents=[{candidates:[{blackboard:[{key:'unregistered'}]}]}];
  for(const altered of[{...op,id:'char_unknown'},badSkill,badTalent]){
    let expected;try{sourceAssert(altered);}catch(e){expected=e.message;}
    assert.ok(expected);assert.throws(()=>runtimeAssert(altered),{message:expected});
  }
});
test('a newly edited source skill can compile before the published runtime index is refreshed',()=>{
  const id='char_123_fang',previous=source[id].skillId,op=structuredClone(snapshot.operators[id]);
  const next='sk_source_refresh_fixture';
  try{
    source[id].skillId=next;op.skills[0].id=next;
    assert.throws(()=>runtimeAssert(op),/Unsupported regular-stage operator or skill/);
    const built=buildOperatorLibrary({...snapshot,operators:{[id]:op}});
    assert.equal(built.bootstrap.roster[id].skills[0].id,next);
  }finally{source[id].skillId=previous;}
});
test('the compiler refuses executable, omitted and nonfinite support fields',()=>{
  for(const value of[()=>{},undefined,NaN,Infinity,new Date()])
    assert.throws(()=>buildOperatorSupportIndex({char_test:{talentKeys:[],skillId:null,extra:value}}),/Non-data operator support/);
});
test('publication is isolated, complete and stale detection covers all metadata fields',async()=>{
  const root=await mkdtemp(join(tmpdir(),'operator-support-index-')),target=pathToFileURL(join(root,'shared','index.js'));
  try{
    await publishOperatorSupportIndex(target);await checkOperatorSupportIndex(target);
    assert.equal(await readFile(target,'utf8'),buildOperatorSupportIndex());
    const changed=structuredClone(source),id=Object.keys(changed)[0];changed[id].talentCostStat=false;
    await writeFile(target,buildOperatorSupportIndex(changed));
    await assert.rejects(checkOperatorSupportIndex(target),/Operator support index is stale/);
    await publishOperatorSupportIndex(target);await checkOperatorSupportIndex(target);
  }finally{await rm(root,{recursive:true,force:true});}
});
