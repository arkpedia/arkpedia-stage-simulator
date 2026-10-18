// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-koromaru-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/koromaru-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4220_kormr/front.skel',import.meta.url));original=true;}catch{}
test('Koromaru clocks retain original passive-only Attack/Start and absent Back death without invented skills',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){assert.equal(m.exactDurations.Attack,1.2999999523162842);assert.equal(m.exactDurations.Start_1,1);assert.equal(m.exactDurations.Idle,2.4000000953674316);assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Skill,undefined);assert.equal(m.exactDurations.Skill_1,undefined);assert.equal(m.exactDurations.Skill_Loop,2.200000047683716);assert.equal(m.exactDurations.Skill_End,0.36666667461395264);assert.equal(m.exactDurations.Start_2,1);}
});
test('Koromaru exact clocks reproduce and reject changed source/skeleton bytes',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4220_kormr.json'])await assert.rejects(()=>recoverClocks({read:async path=>{const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;}}));
});
