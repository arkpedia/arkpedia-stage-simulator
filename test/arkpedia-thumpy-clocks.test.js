// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-thumpy-clocks.json' with {type:'json'};
import source from '../data/arkpedia-native-operators/char_4235_thumpy.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/thumpy-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4235_thumpy/front.skel',import.meta.url));original=true;}catch{}
test('Thumpy exact clocks retain three mode families, original Begin releases and no parity approval',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const [face,m] of Object.entries(clocks.models)){
  const events=source.models.char_4235_thumpy[face].eventPayloads;
  for(const[i,d]of[[1,.1666666716337204],[2,.6666666865348816],[3,1]])assert.equal(m.exactDurations[`Skill_${i}_Begin`],d);
  for(const i of[1,2,3])assert.equal(m.exactDurations[`Skill_${i}_End`],.1666666716337204);
  assert.equal(m.exactDurations.Attack,1.600000023841858);assert.equal(events.Attack[0].time,.30000001192092896);
  assert.equal(events.Skill_2_Begin[0].time,.23333333432674408);assert.equal(events.Skill_3_Begin[0].time,.36666667461395264);
 }
});
test('Thumpy original clocks reproduce from verified bytes and reject modified skeletons/receipt',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4235_thumpy.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;
 }}));
});
