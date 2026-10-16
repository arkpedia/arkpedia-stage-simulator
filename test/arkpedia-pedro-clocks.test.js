// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-pedro-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/pedro-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4234_pedro/front.skel',import.meta.url));original=true;}catch{}
test('Pedro clocks preserve one-shot attacks/skills and Front-only downward/death tracks without parity approval',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){
  for(const clip of['Attack','Skill_1','Skill_2'])assert.equal(m.exactDurations[clip],2.0999999046325684);
  for(const clip of['Attack_Down','Skill_Down_1','Skill_Down_2'])assert.equal(m.exactDurations[clip],face==='Front'?2.0999999046325684:undefined);
  assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Skill_2_Begin,undefined);
 }
});
test('Pedro original clocks reproduce and reject changed skeleton/receipt bytes',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4234_pedro.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;
 }}));
});
