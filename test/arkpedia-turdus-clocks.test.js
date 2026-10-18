// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_4224_turdus.json' with {type:'json'};
import clocks from '../data/arkpedia-turdus-clocks.json' with {type:'json'};
import {recoverClocks} from '../tools/arkpedia/turdus-clocks.mjs';
test('Original Ukusik Front/Back exact clocks retain .6 heal markers, Begin/End families and no Back death',()=>{assert.equal(clocks.operator,e.operatorId);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);for(const[face,m]of Object.entries(clocks.models)){assert.equal(m.sha256,e.officialSkeletonBindings[e.operatorId][face].sha256);assert.equal(m.exactDurations.Attack,2.8333332538604736);assert.equal(m.exactDurations.Skill_1_Begin,0.5333333611488342);assert.equal(m.exactDurations.Skill_1_End,0.5333333611488342);assert.equal(m.exactDurations.Skill_2,1.5);assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);for(const clip of['Attack','Skill_1_Loop','Skill_2'])assert.equal(e.models[e.operatorId][face].eventPayloads[clip][0].time,0.6000000238418579);}});
test('Original raw Ukusik skeletons independently reproduce exact clocks without changing rounded default metadata',{skip:!existsSync(new URL('../.cache/arkpedia/cn-operators/char_4224_turdus/front.skel',import.meta.url))},async()=>assert.deepEqual(await recoverClocks(),clocks));
test('A changed original skeleton or foundation cannot be accepted as a declared clock',{skip:!existsSync(new URL('../.cache/arkpedia/cn-operators/char_4224_turdus/front.skel',import.meta.url))},async()=>{for(const suffix of['front.skel','back.skel','char_4224_turdus.json'])await assert.rejects(()=>recoverClocks({read:async path=>{const bytes=await readFile(path);if(path.pathname.endsWith(suffix)){const b=Buffer.from(bytes);b[b.length-1]^=1;return b;}return bytes;}}));});
