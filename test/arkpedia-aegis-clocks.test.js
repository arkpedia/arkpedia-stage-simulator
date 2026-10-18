// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {readFile} from 'node:fs/promises';
import e from '../data/arkpedia-native-operators/char_4218_aigis.json' with {type:'json'};
import clocks from '../data/arkpedia-aegis-clocks.json' with {type:'json'};import {recoverClocks} from '../tools/arkpedia/aegis-clocks.mjs';
const ID='char_4218_aigis',cached=existsSync(new URL('../.cache/arkpedia/cn-operators/'+ID+'/front.skel',import.meta.url));
test('Aegis preserves unrounded missile, zero-length kick and literal original stun/death/down clocks',()=>{
 assert.equal(clocks.operator,ID);assert.deepEqual(clocks.enabledOperators,[]);assert.equal(clocks.frameParity,false);
 for(const [face,m]of Object.entries(clocks.models)){
  assert.equal(m.sha256,e.officialSkeletonBindings[ID][face].sha256);assert.equal(m.exactDurations.Attack,2.0999999046325684);
  assert.equal(m.exactDurations.Skill_2_Begin,2.4000000953674316);assert.equal(m.exactDurations.Skill_2_Loop,0);assert.equal(m.exactDurations.Skill_2_End,1);
  const events=e.models[ID][face].eventPayloads.Skill_2_Begin.filter(p=>p.name==='OnAttack');
  assert.deepEqual(events.map(p=>p.time),[.6666666865348816,.800000011920929,.9333333373069763,1.0666667222976685,1.2000000476837158,1.3333333730697632]);
  assert.equal(m.exactDurations.Die,face==='Front'?1:undefined);assert.equal(m.exactDurations.Skill_Down_1_Loop,face==='Front'?2.0999999046325684:undefined);
  assert.equal(m.exactDurations.nSkill_1_Stun_Begin,face==='Front'?1:undefined);assert.equal(m.exactDurations.Skill_1_Stun_Begin,undefined);
 }
});
test('Original Aegis skeleton bytes independently reproduce exact clocks',{skip:!cached},async()=>assert.deepEqual(await recoverClocks(),clocks));
test('Changed original Aegis receipt or facing bytes cannot declare valid clocks',{skip:!cached},async()=>{
 for(const suffix of['front.skel','back.skel',ID+'.json'])await assert.rejects(()=>recoverClocks({read:async path=>{
  const b=await readFile(path);if(!path.pathname.endsWith(suffix))return b;const changed=Buffer.from(b);changed[changed.length-1]^=1;return changed;
 }}));
});
