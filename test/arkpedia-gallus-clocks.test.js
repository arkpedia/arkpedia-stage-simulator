// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import clocks from '../data/arkpedia-gallus-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/gallus-clocks.mjs';
let original=false;try{await access(new URL('../.cache/arkpedia/cn-operators/char_4227_gallus/front.skel',import.meta.url));original=true;}catch{}
test('GALLUS² clocks retain original passive-only Attack/Start and absent Back death without invented skills',()=>{
 assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){assert.equal(m.exactDurations.Attack,1.600000023841858);assert.equal(m.exactDurations.Start,1);assert.equal(m.exactDurations.Idle,1.3333333730697632);assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Skill,undefined);assert.equal(m.exactDurations.Skill_1,undefined);}
});
test('GALLUS² exact clocks reproduce and reject changed source/skeleton bytes',{skip:!original&&'Optional original-source cache not installed'},async()=>{
 assert.deepEqual(await recoverClocks(),clocks);
 for(const suffix of['front.skel','back.skel','char_4227_gallus.json'])await assert.rejects(()=>recoverClocks({read:async path=>{const b=await readFile(path);if(path.pathname.endsWith(suffix)){const v=Buffer.from(b);v[v.length-1]^=1;return v;}return b;}}));
});
