// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-tmslot-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/tmslot-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4236_tmslot/front.skel',import.meta.url));original=true;}catch{}
test('Timeslot exact clocks keep asymmetric Front/Back overload transitions without inventing a skill cast Begin',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){
  assert.equal(m.exactDurations.Attack,1.2999999523162842);assert.equal(m.exactDurations.Skill_2,1.2999999523162842);assert.equal(m.exactDurations.Skill_2_Overload_Begin,face==='Front'?1:.8333333134651184);
  assert.equal(m.exactDurations.Skill_2_Overload_End,.5666666626930237);assert.equal(m.exactDurations.Skill_2_Overload_Loop,1);assert.equal(m.exactDurations.Skill_2_Begin,undefined);
 }
});
test('Timeslot original clocks reproduce and reject changed skeleton/receipt bytes',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4236_tmslot.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;
 }}));
});
