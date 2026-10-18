// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_4219_yukari.json' with{type:'json'};import clocks from '../data/arkpedia-yukari-clocks.json' with{type:'json'};import {recoverClocks} from '../tools/arkpedia/yukari-clocks.mjs';
const ID='char_4219_yukari',cached=existsSync(new URL('../.cache/arkpedia/cn-operators/'+ID+'/front.skel',import.meta.url));
test('Yukari keeps original four S1 markers, distinct Front/Back S2 markers and missing Back/down/death tracks',()=>{
 assert.equal(clocks.operator,ID);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const[face,m]of Object.entries(clocks.models)){
  assert.equal(m.sha256,e.officialSkeletonBindings[ID][face].sha256);assert.equal(m.exactDurations.Attack_Loop,2.0999999046325684);assert.equal(m.exactDurations.Attack_Begin,.1666666716337204);assert.equal(m.exactDurations.Skill_1,4.066666603088379);assert.equal(m.exactDurations.Skill_2,3.3333332538604736);
  assert.deepEqual(e.models[ID][face].eventPayloads.Skill_1.filter(p=>p.name==='OnAttack').map(p=>p.time),[1.5333333015441895,1.8333333730697632,2.133333444595337,3.366666555404663]);
  assert.equal(e.models[ID][face].eventPayloads.Skill_2[0].time,face==='Front'?2.4000000953674316:2.299999952316284);assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Attack_Down_Loop,face==='Front'?2.0999999046325684:undefined);
 }
});
test('Original Yukari facing bytes independently reproduce exact clocks',{skip:!cached},async()=>assert.deepEqual(await recoverClocks(),clocks));
test('Changed receipt or original facing bytes cannot certify clocks',{skip:!cached},async()=>{
 for(const suffix of['front.skel','back.skel',ID+'.json'])await assert.rejects(()=>recoverClocks({read:async path=>{const b=await readFile(path);if(!path.pathname.endsWith(suffix))return b;const changed=Buffer.from(b);changed[changed.length-1]^=1;return changed;}}));
});
