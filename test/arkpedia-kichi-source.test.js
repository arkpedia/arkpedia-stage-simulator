// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4203_kichi.json' with {type:'json'};
import {KICHI_ID as ID,KICHI_SKILLS as SKILLS,selectedKichiBuild as select,selectedKichiTrait,kichiSourceComponent,kichiNativeInputs}
 from '../server/sim/content/arkpedia-kichi-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Kichisei original receipt is immutable and grants no runtime, module or rendering approval',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-native-operators/char_4203_kichi.json',import.meta.url));
 assert.equal(bytes.length,296251);assert.equal(createHash('sha256').update(bytes).digest('hex'),'171761adf7b8bc65b03ea6f0d95f2a8bf9c3d0c16bcf836d99e2a1088448b025');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);assert.equal(e.nativeParticleSupport,false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.deepEqual(e.projectiles,{});assert.equal(e.tokens,undefined);
 assert.equal(Object.keys(e.templates).length,9);assert.throws(()=>kichiSourceComponent('characters',ID,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Kichisei E${elite}/P${potential} preserves original stats, trait and unique-enemy talent inputs`,()=>{
 const b=build(elite,0,[4,7,10][elite],potential,200),r=select(b),t=selectedKichiTrait(b);
 near(r.stats.maxHp,[1368,1732,2310][elite]);near(r.stats.atk,[472,610,727][elite]+65+(potential===6?31:0));
 near(r.stats.def,[135,171,190][elite]);near(r.stats.cost,[28,31,31][elite]-(potential===6?2:0));near(r.stats.baseAttackTime,2.3);near(r.stats.respawnTime,potential===6?66:70);
 near(t.bb.atk_scale,1.5);assert.equal(t.rangeId,'1-3');assert.ok(t.rangeGrid.length>0);
 if(elite===0)assert.deepEqual(r.talentBb,[]);else{near(r.talentBb[0].damage_scale,potential===6?.07:.06);near(r.talentBb[0].max_stack_cnt,elite===1?2:3);}
});
for(let rank=1;rank<=10;rank++)test(`Kichisei rank ${rank} keeps distinct timed S1 stacks and S2 status-cycle inputs`,()=>{
 const a=select(build(2,0,rank)),b=select(build(2,1,rank));
 for(const r of[a,b]){assert.equal(r.source.skillType,'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');near(r.source.spData.maxChargeTime,1);}
 near(a.bb.base_attack_time,.5);near(a.bb.atk,[.1,.12,.14,.15,.17,.18,.2,.22,.23,.25][rank-1]);near(a.bb.max_stack_cnt,4);
 near(a.source.spData.spCost,[60,58,56,55,53,51,50,49,47,45][rank-1]);near(a.source.spData.initSp,30);near(a.source.duration,[30,30,30,33,33,33,36,38,40,42][rank-1]);
 near(b.bb.base_attack_time,.7);near(b.bb.atk,[.3,.35,.4,.45,.5,.55,.6,.65,.7,.8][rank-1]);
 for(const k of['attack@unmoveable','attack@sluggish','attack@stun'])near(b.bb[k],rank<7?1:rank<10?1.3:1.5);
 near(b.source.spData.spCost,[50,49,48,47,46,45,44,43,42,40][rank-1]);near(b.source.spData.initSp,rank+15);near(b.source.duration,[24,25,26,27,28,29,30,31,33,36][rank-1]);
});
test('native literal direct-attack clocks and non-damage-missable S2 attachment remain held source inputs',()=>{
 const n=kichiNativeInputs();for(const a of[n.ordinary,n.s1Attack,n.s2Attack]){assert.equal(a._selectTargetTiming,1);assert.equal(a._timeMode,0);assert.equal(a._maxAnimScale,-1);assert.equal(a._damageType,1);}
 assert.equal(n.ordinary._animKey,'Attack');assert.equal(n.s1Attack._animKey,'Skill_1_Loop');assert.equal(n.s2Attack._animKey,'Skill_2_Loop');
 assert.equal(n.s2Attack._activeBuffs[0].isDamageMissable,0);assert.equal(n.s2Attack._activeBuffs[0].templateKey,'kichi_skchr_02[debuff]');
 for(const s of[n.s1,n.s2]){assert.equal(s._allowSpRecoveryWhenAffecting,0);assert.equal(s._allowNoTarget,1);assert.equal(s._canCastDuringBorn,1);assert.equal(s._resetAbilityCooldownWhenCastEnd,0);}
 for(const face of['Front','Back'])for(const clip of['Attack','Skill_1_Loop','Skill_2_Loop']){
  const p=e.models[ID][face].eventPayloads[clip];near(p.find(p=>p.name==='OnAttack').time,.5);assert.equal(p.filter(p=>p.name==='OnAttack').length,1);assert.ok(p.some(p=>p.name==='OnPlayAudio'));
 }
 assert.equal(e.models[ID].Back.durations.Die,undefined);assert.ok(e.models[ID].Front.durations.Skill_Down_2_Loop);
});
test('locked, malformed or module-bearing Kichisei builds fail before combat installation',()=>{
 for(const patch of[{elite:3},{level:81},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]}])assert.throws(()=>select({...build(),...patch}));
});
