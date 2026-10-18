// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_4223_botany.json' with {type:'json'};
import clocks from '../data/arkpedia-botany-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/botany-clocks.mjs';
const cached=existsSync(new URL('../.cache/arkpedia/cn-operators/char_4223_botany/front.skel',import.meta.url));
test('Botany keeps ordinary and S1 attack markers distinct, exact S2 transitions and missing Back death',()=>{
 assert.equal(clocks.operator,e.operatorId);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){
  assert.equal(m.sha256,e.officialSkeletonBindings[e.operatorId][face].sha256);
  for(const clip of['Attack','Skill_1','Skill_2_Loop'])assert.equal(m.exactDurations[clip],1.600000023841858);
  assert.equal(m.exactDurations.Skill_2_Begin,.3333333432674408);assert.equal(m.exactDurations.Skill_2_End,.5);
  const events=e.models[e.operatorId][face].eventPayloads;assert.equal(events.Attack[0].time,.5);
  assert.equal(events.Skill_1[0].time,.800000011920929);assert.equal(events.Skill_2_Loop[0].time,.5);
  assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);
 }
});
test('Original Botany skeleton bytes independently reproduce exact clocks while rounded metadata stays unchanged',{skip:!cached},async()=>assert.deepEqual(await recoverClocks(),clocks));
test('Changed original Botany source or either skeleton cannot declare valid clocks',{skip:!cached},async()=>{
 for(const suffix of['front.skel','back.skel','char_4223_botany.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const raw=await readFile(path);if(!path.pathname.endsWith(suffix))return raw;
  const changed=Buffer.from(raw);changed[changed.length-1]^=1;return changed;
 }}));
});
