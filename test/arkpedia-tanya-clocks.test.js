// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-tanya-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/tanya-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4225_tanya/front.skel',import.meta.url));original=true;}catch{}
test('Crackborne exact clocks preserve both ordinary clips, S1 mode tracks and one-shot S2 without frame approval',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const m of Object.values(clocks.models)){assert.equal(m.exactDurations.Skill_1_Begin,.4000000059604645);assert.equal(m.exactDurations.Skill_1_End,.2666666805744171);assert.equal(m.exactDurations.Skill_2,1.600000023841858);assert.equal(m.exactDurations.Attack,undefined);}
});
test('Crackborne original clocks reproduce from verified bytes and reject modified skeletons/receipt',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4225_tanya.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;
 }}));
});
