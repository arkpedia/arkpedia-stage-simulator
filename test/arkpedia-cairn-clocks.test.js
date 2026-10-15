// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-cairn-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/cairn-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4214_cairn/front.skel',import.meta.url));original=true;}catch{}
test('Cairn exact clocks preserve native short S1 transitions and one-shot S2 without frame approval',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const m of Object.values(clocks.models)){assert.equal(m.exactDurations.Skill_1_Begin,.3333333432674408);assert.equal(m.exactDurations.Skill_1_End,.3333333432674408);assert.equal(m.exactDurations.Skill_2,1.6666666269302368);}
});
test('Cairn original clocks reproduce from verified bytes and reject modified skeletons/receipt',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4214_cairn.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;
 }}));
});
