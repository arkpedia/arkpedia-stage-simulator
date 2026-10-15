// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-kichi-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/kichi-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4203_kichi/front.skel',import.meta.url));original=true;}catch{}
test('Kichisei exact clocks retain short source Begin/End and skill-loop tracks without native frame approval',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const m of Object.values(clocks.models)){assert.equal(m.exactDurations.Skill_1_Begin,.10000000149011612);assert.equal(m.exactDurations.Skill_2_Begin,.10000000149011612);assert.equal(m.exactDurations.Skill_2_Loop,3);}
});
test('Kichisei original clocks reproduce from verified bytes and reject modified skeletons/receipt',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4203_kichi.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;
 }}));
});
