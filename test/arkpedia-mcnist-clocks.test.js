// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-mcnist-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/mcnist-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4230_mcnist/front.skel',import.meta.url));original=true;}catch{}
test('Mechanist exact owner/McGraf clocks keep source durations and missing clips without public/frame approval',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);assert.deepEqual(Object.keys(clocks.tokens),['token_10069_mcnist_mcgraf']);
 for(const face of['Front','Back']){const owner=clocks.models[face].exactDurations,token=clocks.tokens.token_10069_mcnist_mcgraf.models[face].exactDurations;
  assert.ok(owner.Skill_1>0);assert.ok(owner.Skill_2_Begin>0);assert.ok(owner.Skill_3_Loop>0);assert.ok(token.Skill_Begin>0);assert.equal(owner.mcnist_skill_01_start_01,undefined);assert.equal(token.Skill_3_Loop,undefined);assert.equal(owner.Die,face==='Front'?1:undefined);
 }
});
test('Mechanist clocks reproduce owner/token bytes and reject changed receipt and all four skeletons',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['/char_4230_mcnist/front.skel','/char_4230_mcnist/back.skel','/token_10069_mcnist_mcgraf/front.skel','/token_10069_mcnist_mcgraf/back.skel','/char_4230_mcnist.json'])await assert.rejects(()=>recoverClocks({read:async path=>{const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;}}));
});
