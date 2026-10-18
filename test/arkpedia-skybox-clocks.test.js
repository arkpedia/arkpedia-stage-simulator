// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_4213_skybx.json' with {type:'json'};
import clocks from '../data/arkpedia-skybox-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/skybox-clocks.mjs';
const cached=existsSync(new URL('../.cache/arkpedia/cn-operators/char_4213_skybx/front.skel',import.meta.url));
test('Skybox preserves exact airborne/ground clocks, the distinct S1/S2 markers and literal Back track absences',()=>{
 assert.equal(clocks.operator,e.operatorId);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){
  assert.equal(m.sha256,e.officialSkeletonBindings[e.operatorId][face].sha256);
  for(const clip of['Attack','Skill_2_Loop'])assert.equal(m.exactDurations[clip],2.0999999046325684);
  for(const clip of['Skill_1_Begin','Skill_1_End','Skill_2_Begin','Skill_2_Close','Skill_2_End','Start'])assert.equal(m.exactDurations[clip],1);
  const events=e.models[e.operatorId][face].eventPayloads;assert.equal(events.Attack[0].time,.3333333432674408);
  assert.equal(events.Skill_1_Begin[0].time,.5333333611488342);assert.equal(events.Skill_2_Loop[0].time,.2666666805744171);
  assert.equal(events.Skill_2_Close[0].time,.2666666805744171);assert.equal(events.Start[0].time,.6666666865348816);
  assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Die_2,face==='Front'?1:undefined);
  assert.equal(m.exactDurations.Attack_Down,face==='Front'?2.0999999046325684:undefined);
  assert.equal(m.exactDurations.Skill_Down_2_Loop,face==='Front'?2.0999999046325684:undefined);
 }
});
test('Original Skybox skeleton bytes independently reproduce exact clocks while rounded metadata stays unchanged',{skip:!cached},async()=>assert.deepEqual(await recoverClocks(),clocks));
test('Changed original Skybox source or either skeleton cannot declare valid clocks',{skip:!cached},async()=>{
 for(const suffix of['front.skel','back.skel','char_4213_skybx.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const raw=await readFile(path);if(!path.pathname.endsWith(suffix))return raw;
  const changed=Buffer.from(raw);changed[changed.length-1]^=1;return changed;
 }}));
});
