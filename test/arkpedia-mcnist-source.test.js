// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import {MCNIST_ID as ID,MCGRAF_ID as TOKEN,MCNIST_SKILLS as SKILLS,selectedMechanistBuild as select,mechanistSourceComponent as component,mechanistNativeInputs as inputs}
 from '../server/sim/content/arkpedia-mcnist-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Mechanist held foundation pins original owner/McGraf, three source skills, twenty-two templates and ten projectiles',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-native-operators/char_4230_mcnist.json',import.meta.url));
 assert.equal(bytes.length,944721);assert.equal(createHash('sha256').update(bytes).digest('hex'),'951f971e410a0ddea6b08424363a07627bb398d1efbe2d8971b90cdd3dd88317');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,6);assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
 for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);
 assert.deepEqual(Object.keys(e.tokens),[TOKEN]);assert.equal(Object.keys(e.templates).length,22);assert.equal(Object.keys(e.projectiles).length,10);assert.deepEqual(e.ownerModeSkills,[]);
 assert.deepEqual(e.tables.character.skills.map(s=>s.skillId),SKILLS);assert.deepEqual(Object.keys(e.tables.tokenSkills),[1,2,3].map(i=>`sktok_mcgraf_${i}`));assert.throws(()=>component('tokens',TOKEN,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Mechanist E${elite}/P${potential} keeps raw stats and native talent operands separate`,()=>{
 const r=select(build(elite,0,[4,7,10][elite],potential,200));near(r.stats.maxHp,[1960,2614,3631][elite]);near(r.stats.atk,[340,425,513][elite]+60);near(r.stats.def,[380,514,705][elite]+60+(potential===6?28:0));
 near(r.stats.cost,[19,21,23][elite]-(potential===6?2:0));near(r.stats.respawnTime,potential===6?66:70);near(r.stats.baseAttackTime,1.2);near(r.stats.blockCnt,3);near(r.stats.magicResistance,0);
 if(elite===0)assert.deepEqual(r.talentBb,[]);else{assert.deepEqual(r.talentBb[0],{});if(elite===2)near(r.talentBb[1].hp_ratio,potential===6?.4:.3);}
});
for(let rank=1;rank<=10;rank++)test(`Mechanist rank ${rank} preserves three distinct source skills without inventing duration modes`,()=>{
 const [a,b,c]=[0,1,2].map(skill=>select(build(2,skill,rank)));assert.equal(a.source.skillType,'AUTO');assert.equal(a.source.spData.spType,'INCREASE_WHEN_ATTACK');near(a.source.duration,-1);
 near(a.source.spData.spCost,[12,12,11,11,10,10,9,9,8,7][rank-1]);near(a.bb['attack@atk_scale'],[.8,.85,.9,.95,1,1.05,1.1,1.25,1.4,1.55][rank-1]);near(a.bb['attack@trigger_time'],3);near(a.bb['attack@times'],5);near(a.bb.base_attack_time,1.3);near(a.bb['attack@projectile_delay_time'],1.3);near(a.bb['attack@interval'],.2);
 assert.equal(b.source.skillType,'MANUAL');assert.equal(b.source.spData.spType,'INCREASE_WITH_TIME');near(b.source.duration,-1);near(b.bb.atk,.5+.1*rank);near(b.bb.hp_ratio,.1);near(b.bb.atk_scale,2);near(b.bb.trigger_time,[5,5,5,6,6,6,7,7,7,8][rank-1]);near(b.source.spData.spCost,[65,65,65,60,60,60,55,53,52,50][rank-1]);near(b.source.spData.initSp,[27,27,27,30,30,30,33,34,34,35][rank-1]);
 assert.equal(c.source.skillType,'MANUAL');assert.equal(c.source.spData.spType,'INCREASE_WITH_TIME');near(c.source.duration,40);near(c.bb.atk,.8+.2*rank);near(c.bb.base_attack_time,2.3);near(c.bb.atk_scale,3);assert.equal(c.bb['attack@projectile_range'],'x-6');assert.equal(c.source.blackboard.find(x=>x.key==='attack@projectile_range').valueStr,'x-6');near(c.source.spData.spCost,[45,45,45,43,43,43,41,39,37,35][rank-1]);near(c.source.spData.initSp,[18,18,18,20,20,20,22,23,24,25][rank-1]);
});
test('Mechanist original owner attack/Combat abilities retain separate native pointers and capped attack-time clocks',()=>{
 const n=inputs();for(const a of[n.ordinary,n.combat,n.s1Attack,n.s2Attack,n.s2Combat,n.s2DownAttack,n.s2DownCombat,n.s3Attack,n.s3Combat]){assert.equal(a._timeMode,0);assert.equal(a._maxAnimScale,1);assert.equal(a._affectedBySlowDown,1);assert.equal(a._waitForAttackEvent,1);}
 assert.equal(n.ordinary._animKey,'Attack_A');assert.equal(n.combat._animKey,'Attack_A');assert.equal(n.s1Attack._animKey,'Skill_1');assert.equal(n.s1Attack._downAnimKey,'Skill_Down_1');assert.equal(n.s2DownAttack._animKey,'Skill_Down_2_Loop');assert.equal(n.s3Attack._animKey,'Skill_3_Loop');
 assert.equal(n.s1Attack._projectileKey,'projectile_chr_mcnist_s1');assert.equal(n.s3Combat._projectileKey,'projectile_chr_mcnist_s3');
});
test('Mechanist keeps native missing S1 begin name distinct from actual S2/S3 clips and six exit mixes',()=>{
 const n=inputs();assert.equal(n.s1._playSkillBeginAnim,1);assert.equal(n.s1._beginAnim,'mcnist_skill_01_start_01');assert.equal(n.s2._beginAnim,'Skill_2_Begin');assert.equal(n.s3._beginAnim,'Skill_3_Begin');
 for(const face of['Front','Back']){const m=e.models[ID][face];assert.equal(m.durations[n.s1._beginAnim],undefined);near(m.eventPayloads.Skill_1[0].time,1);near(m.eventPayloads.Attack_A[0].time,.4333333373069763);near(m.eventPayloads.Attack_B[0].time,.4333333373069763);}
 assert.deepEqual(n.mixes.map(x=>[x.sourceAnimName,x.targetAnimName,x.mixAnimName]),[
  ['Skill_2_Idle','Idle','Skill_2_End'],['Skill_2_Loop','Idle','Skill_2_End'],['Skill_Down_2_Idle','Idle','Skill_Down_2_End'],['Skill_Down_2_Loop','Idle','Skill_Down_2_End'],['Skill_3_Idle','Idle','Skill_3_End'],['Skill_3_Loop','Idle','Skill_3_End']]);
});
test('McGraf retains its own original skills, attacks and skeletons without becoming an ordinary operator or public summon',()=>{
 const n=inputs();for(const a of n.tokenAttacks){assert.equal(a._animKey,'Attack');assert.equal(a._timeMode,0);assert.equal(a._maxAnimScale,1);}
 assert.equal(n.tokenSkill._playSkillBeginAnim,0);assert.equal(n.tokenSkill._beginAnim,'');
 for(const face of['Front','Back']){assert.notEqual(e.officialSkeletonBindings[ID][face].sha256,e.officialSkeletonBindings[TOKEN][face].sha256);assert.equal(e.models[TOKEN][face].durations.Skill_Loop,0);near(e.models[TOKEN][face].eventPayloads.Attack[0].time,.6666666865348816);}
 assert.equal(e.models[TOKEN].Back.durations.Die,undefined);
});
test('Mechanist source refuses locked skills/ranks, invalid input and unreviewed modules',()=>{
 for(const p of[{elite:3},{level:91},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'sktok_mcgraf_1'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:80,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]},{elite:1,level:80,skillRank:7,skillId:SKILLS[2]}])assert.throws(()=>select({...build(),...p}));
});
