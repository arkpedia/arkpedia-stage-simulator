// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4213_skybx.json' with {type:'json'};
import {selectedSkyboxBuild as select,selectedSkyboxInputs,skyboxNativeInputs,skyboxSourceComponent,
  SKYBOX_ID as ID} from '../server/sim/content/arkpedia-skybox-source.js';
import {normalizeChess} from '../server/sim/simdata.js';
const build=more=>({elite:2,level:80,potential:1,trust:0,skillId:'skchr_skybx_1',skillRank:10,module:'none',...more});
test('Skybox retains complete held original source bytes, pointer roots and dependency closure',async()=>{
 const raw=await readFile(new URL('../data/arkpedia-native-operators/'+ID+'.json',import.meta.url));
 assert.equal(raw.length,356363);assert.equal(createHash('sha256').update(raw).digest('hex'),'0aec7d8b76cb41f690498414047b829c29662703a1244abc57ea018496387100');
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);
 assert.equal(e.source.bundles.length,5);assert.equal(Object.keys(e.templates).length,12);assert.equal(Object.keys(e.projectiles).length,3);
 for(const key of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
 for(const group of['characters','artworkHierarchy','skills','projectiles'])for(const rows of Object.values(e[group]))
  for(const row of rows)for(const part of row.components)assert.equal(typeof part.pathId,'string');
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`Skybox S${skill} rank${rank} retains its exact source row, SP account and selected blackboard`,()=>{
 for(const potential of[1,6])for(const trust of[0,200]){
  const r=select(build({skillId:`skchr_skybx_${skill}`,skillRank:rank,potential,trust}));
  assert.deepEqual(r.source,e.tables.skills[`skchr_skybx_${skill}`].levels[rank-1]);assert.equal(r.index,skill-1);
  assert.equal(r.source.skillType,skill===1?'AUTO':'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');
  assert.equal(r.stats.baseAttackTime,2.1);assert.deepEqual(Object.keys(r.bb).sort(),r.source.blackboard.map(b=>b.key).sort());
 }
});
test('Skybox source stats preserve promotion, trust and potential without silently granting talent ASPD',()=>{
 const lo=select(build({elite:0,level:50,skillRank:4})),hi=select(build({potential:6,trust:200}));
 assert.deepEqual([lo.stats.maxHp,lo.stats.atk,lo.stats.def,lo.stats.cost,lo.stats.magicResistance],[922,585,139,22,0]);
 assert.deepEqual([hi.stats.maxHp,hi.stats.atk,hi.stats.def,hi.stats.cost,hi.stats.magicResistance],[1558,1019,197,21,0]);
 assert.deepEqual(lo.talentBb,[{}]);assert.deepEqual(hi.talentBb,[{silence:7},{}]);
 assert.equal(hi.stats.attackSpeed,100);assert.equal(hi.stats.respawnTime,70);
 assert.deepEqual(select(build({elite:1,level:70,skillRank:7})).talentBb,[{silence:4},{}]);
});
test('Skybox rejects locked source skills, unsupported modules, invalid ranks and invented components',()=>{
 for(const change of[{elite:0,level:50,skillRank:4,skillId:'skchr_skybx_2'},{elite:0,level:50,skillRank:5},
  {elite:3},{level:81},{potential:0},{potential:7},{trust:201},{skillRank:11},{skillId:'made-up'},{module:'skybox-x'}])assert.throws(()=>select(build(change)));
 assert.throws(()=>skyboxSourceComponent('characters',ID,'0'),/Missing original/);
});
test('Skybox normalized inputs reject altered stats, selected identity, blackboards, account and range',()=>{
 const b=build(),r=select(b);
 const fresh=()=>({rangeGrid:r.rangeGrid,def:normalizeChess({chessId:ID,charId:ID,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
  skill:{...r.source,...r.source.spData,skillId:b.skillId,rangeGrid:r.skillRangeGrid},arkpedia:b})});
 assert.equal(selectedSkyboxInputs(fresh()).index,0);
 for(const mutate of[u=>u.def.stats.atk++,u=>u.def.skill.bb.fake=1,u=>u.def.raw.arkpedia.skillId='skchr_skybx_2',
  u=>u.def.skill.spCost++,u=>u.rangeGrid=[]]){
  const u=fresh();mutate(u);assert.throws(()=>selectedSkyboxInputs(u),/Incomplete original/);
 }
});
test('Skybox retains four original modes, literal S1 input and overloaded S2 ammunition source',()=>{
 const n=skyboxNativeInputs();assert.equal(n.modes.length,4);
 assert.deepEqual(n.modes.map(m=>m.pathId),['-7516933545960407793','-342347088429056753','-3675257765320721137','5852307962246200591']);
 assert.equal(n.modes[0].attack._projectileKey,'projectile_chr_skybx');assert.equal(n.modes[0].attack._useCachedAtkOnly,0);
 assert.equal(n.s1Attack._animKey,'Skill_1_Begin');assert.equal(n.s1Attack._projectileKey,'projectile_chr_skybx_s1');
 assert.equal(n.s1Attack._useCachedAtkOnly,1);assert.equal(n.s1Attack._emitToInputPosWhenTargetIsInvalid,1);
 assert.equal(n.s1._recoverSpIfTargetDead,1);assert.equal(n.s1._earlySkillFinishAtAttackFinished,0);
 assert.equal(n.s2._attackBlackboardModeIndex,2);assert.equal(n.s2._rangeIdModeIndex,2);assert.equal(n.s2._modeIndex,2);
 assert.equal(n.s2._fetchFromMainAttack,1);assert.equal(n.s2._isOverloadSkill,1);assert.equal(n.s2._burstOnOverload,1);
 assert.equal(n.s2._canDiscardRemainingCount,1);assert.equal(n.s2._allowSpRecoveryWhenAffecting,0);
 const a=select(build()),b=select(build({skillId:'skchr_skybx_2'}));assert.equal(a.source.spData.maxChargeTime,2);
 assert.equal(a.source.spData.spCost,8);assert.equal(b.source.spData.spCost,25);assert.equal(b.source.spData.initSp,20);
 assert.equal(b.bb['attack@trigger_time'],10);assert.equal(b.bb['attack@atk_scale'],2.4);
});
test('Skybox first-target silence remains source-marked and its projectile families retain distinct native movers',()=>{
 const n=skyboxNativeInputs(),nodes=n.templates.skybx_t_1.eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER;
 assert.equal(nodes[0]._unitType,'ENEMY');assert.equal(nodes[1]._buffKeys[0],'skybx_t_1[mark]');assert.equal(nodes[1]._checkBuffSource,true);
 assert.equal(nodes[3]._buffKey,'silence');assert.equal(nodes[3]._isDerivedBuff,false);assert.equal(nodes[5]._buff.buffKey,'skybx_t_1[mark]');
 assert.equal(nodes[5]._isDerivedBuff,true);assert.equal(nodes[5]._finishDerivedBuffIfParentFinish,true);
 for(const[key,rows]of Object.entries(n.projectiles)){
  const parts=rows.flatMap(r=>r.components).map(p=>p.data),body=parts.find(p=>p._lifeTime!=null),motion=parts.find(p=>p._speed!=null);
  assert.equal(body._lifeTime,10);assert.equal(body._stopWhenSourceInvalid,0);assert.equal(body._alwaysHitTraceTargetInTheEnd,1);
  assert.equal(body._hitNumType,key==='projectile_chr_skybx'?1:2);assert.equal(motion._speed,key==='projectile_chr_skybx_s1'?8:10);
  if(key==='projectile_chr_skybx_s1')assert.equal(motion._raiseHeight,.30000001192092896);
 }
});
