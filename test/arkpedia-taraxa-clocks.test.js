// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import clocks from '../data/arkpedia-taraxa-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/taraxa-clocks.mjs';
const cached=existsSync(new URL('../.cache/arkpedia/cn-operators/char_4222_taraxa/front.skel',import.meta.url));
test('Taraxacum retains separate grounded, flight-loop, takeoff, landing and missing Back death clocks',()=>{
 assert.equal(clocks.operator,e.operatorId);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const [face,m]of Object.entries(clocks.models)){
  assert.equal(m.sha256,e.officialSkeletonBindings[e.operatorId][face].sha256);
  assert.equal(m.exactDurations.Attack,2.8333332538604736);assert.equal(m.exactDurations.Skill_1_Loop,.5333333611488342);
  assert.equal(m.exactDurations.Skill_2_Loop,1.5);
  for(const skill of[1,2]){
   assert.equal(m.exactDurations[`Skill_${skill}_Begin`],1);assert.equal(m.exactDurations[`Skill_${skill}_End`],1);
   assert.equal(e.models[e.operatorId][face].eventPayloads[`Skill_${skill}_Begin`][0].time,.3333333432674408);
   assert.equal(e.models[e.operatorId][face].eventPayloads[`Skill_${skill}_End`][0].time,.1666666716337204);
  }
  assert.equal(e.models[e.operatorId][face].eventPayloads.Skill_1_Loop[0].time,0);
  assert.equal(e.models[e.operatorId][face].eventPayloads.Skill_2_Loop[0].time,.6000000238418579);
  assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Skill_Die,face==='Front'?1:undefined);
 }
});
test('Original Taraxacum Front/Back bytes reproduce exact clocks independently of rounded metadata',{skip:!cached},async()=>assert.deepEqual(await recoverClocks(),clocks));
test('Changed original Taraxacum skeleton or source bytes cannot declare a valid clock',{skip:!cached},async()=>{
 for(const suffix of['front.skel','back.skel','char_4222_taraxa.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const raw=await readFile(path);if(!path.pathname.endsWith(suffix))return raw;
  const changed=Buffer.from(raw);changed[changed.length-1]^=1;return changed;
 }}));
});
