// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-mon3tr-prefabs.json'with{type:'json'};
import data from '../data/arkpedia-mvp.json'with{type:'json'};
import {MON3TR_ID as ID,MON3TR_TOKENS,selectedMon3trBuild as select,mon3trSourceComponent as component} from '../server/sim/content/arkpedia-mon3tr-source.js';
const TOKEN='token_10050_monstr_prosts';
const build=(skill=1,rank=10,elite=2)=>({elite,level:1,potential:1,trust:0,skillId:`skchr_monstr_${skill}`,skillRank:rank,module:'none'});
const type=n=>n.$type.split(',')[0].split('+').at(-1);
function walk(v,out=[]){if(Array.isArray(v))v.forEach(x=>walk(x,out));else if(v&&typeof v==='object'){if(v.$type)out.push(v);Object.values(v).forEach(x=>walk(x,out));}return out;}
test('complete native foundation remains held independently of the public roster and unchanged source pins',()=>{
 assert.equal(data.operators[ID],undefined);assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
 assert.equal(e.source.commit,'57010cb5b2afea112cae57daa756b58676ba6850');assert.equal(e.source.commit,data.sources[e.source.repository]);
 assert.equal(e.source.nativeClient,'26-09-23-17-49-43_b9cc4a');assert.equal(e.source.modelCommit,'d0b5af0b004b044d322397ce5ae79632b6d9fcdd');
 assert.equal(e.source.bundles.length,6);assert.equal(Object.keys(e.templates).length,28);assert.equal(Object.keys(e.originalTemplates).length,28);
 assert.equal(Object.keys(e.projectiles).length,5);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.deepEqual(e.nativeSkillPrefabGaps,[]);
 assert.equal(['characters','tokens','skills','projectiles'].flatMap(g=>Object.values(e[g]).flat()).reduce((n,r)=>n+r.components.length,0),309);
 for(const key of ['frameParity','nativeParticleSupport','moduleSupport'])assert.equal(e[key],false);
});
for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++)test(`S${skill} rank ${rank} selects exact owner/token source rows without enabling a fallback kit`,()=>{
 const r=select(build(skill,rank));assert.equal(r.index,skill-1);assert.equal(r.source,e.tables.skills[`skchr_monstr_${skill}`].levels[rank-1]);
 assert.equal(r.source.spData.spType,'INCREASE_WHEN_ATTACK');assert.equal(r.source.skillType,skill===1?'AUTO':'MANUAL');
 assert.deepEqual(MON3TR_TOKENS,[TOKEN]);assert.equal(r.tokenRecords[TOKEN].skill,e.tables.tokenSkills[`sktok_monstr_prosts${skill}`].levels[rank-1]);
 assert.equal(r.tokenRecords[TOKEN].skill.spData.spCost,0);assert.deepEqual(r.tokenRecords[TOKEN].bb,{});
 assert.equal(r.tokenRecords[TOKEN].binding,e.officialTokenSkeletonBindings[TOKEN]);
});
for(const elite of [0,1,2])for(const potential of [1,6])test(`E${elite}/P${potential} selects independent source talents/stats and preserves Reconstruction's phase`,()=>{
 const b={...build(1,[4,7,10][elite],elite),level:e.tables.character.phases[elite].maxLevel,potential,trust:200},r=select(b);
 assert.equal(r.stats.maxHp,[1253,1492,1735][elite]+500);assert.equal(r.stats.atk,[303,422,528][elite]+30+(potential===6?25:0));
 assert.equal(r.stats.cost,[16,18,18][elite]-(potential===6?2:0));assert.equal(r.stats.def,[140,176,221][elite]);
 assert.equal(r.talentBb[0].atk,[.03,.05,.15][elite]+(potential===6?.05:0));assert.equal(r.talents.length,elite===0?1:2);
 if(elite>0){assert.equal(r.talentBb[1].attack_speed,[0,10,20][elite]+(potential===6?2:0));assert.equal(r.talentBb[1].buff_duration,10);}
 const token=r.tokenRecords[TOKEN].phase.attributesKeyFrames.at(-1).data;
 assert.equal(token.maxHp,[3347,4292,5433][elite]);assert.equal(token.atk,0);assert.equal(token.cost,3);assert.equal(token.respawnTime,15);
});
test('invalid or unavailable builds fail rather than selecting a nearby skill, rank or module',()=>{
 for(const patch of [{elite:-1},{elite:3},{level:0},{level:91},{trust:201},{potential:0},{potential:7},{skillId:'other'},{skillRank:11},{module:'module-x'}])
  assert.throws(()=>select({...build(),...patch}));
 assert.throws(()=>select(build(2,1,0)));assert.throws(()=>select(build(3,1,1)));assert.throws(()=>select(build(1,5,0)));assert.throws(()=>select(build(2,8,1)));
});
test('owner and Reconstruction retain literal animation events, missing Back clips and one original token facing',()=>{
 assert.equal(e.models[ID].Front.eventPayloads.Attack[0].time,.5666666626930237);
 assert.equal(e.models[ID].Front.eventPayloads.Skill_3_Loop[0].time,.6666666865348816);
 for(const clip of ['Skill_3_Loop','Skill_3_End','Skill_3_ReStart','Die'])assert.equal(e.models[ID].Back.durations[clip],undefined);
 const binding=e.officialTokenSkeletonBindings[TOKEN];assert.deepEqual(Object.keys(binding.facings),['Single']);
 const t=e.tokenModels[TOKEN].Single;assert.equal(t.durations.Skill_3,0);assert.equal(t.eventPayloads.Attack[0].time,.03333333507180214);
 assert.deepEqual(t.missingRequiredAliases,[]);assert.equal(binding.faceSwitcher._defaultLOrR,3);
});
test('source chain projectiles retain three targets, free-jump markers, original range and 25 percent decay',()=>{
 for(const [id,rows]of Object.entries(e.projectiles)){
  const all=rows.flatMap(r=>r.components),by=new Map(all.map(c=>[c.pathId,c.data]));
  const chain=all.find(c=>'_atkScale'in c.data&&'_useChainPrefix'in c.data).data;
  assert.equal(chain._atkScale,.75);assert.equal(chain._onlyCheckHitWhenReachTarget,1);assert.equal(chain._useChainPrefix,1);
  assert.equal(by.get(chain._selector.m_PathID)._maxTarget,3);assert.equal(by.get(chain._selector.m_PathID)._useAdditionalTargetCount,1);
  assert.deepEqual(by.get(chain._freeJumpValidator.m_PathID)._buffs,['monstr[free_jump]']);
  assert.ok(all.some(c=>c.data._rangeId==='x-4'));
  if(id!=='projectile_chr_monstr_s3')assert.equal(all.find(c=>'_speed'in c.data).data._speed,10);
 }
});
test('native token deployment and five owner modes retain their separate source bindings',()=>{
 const token=component('3549317659382103584');assert.equal(token._occupiedRemainingCharacterCnt,0);assert.equal(token._buildCondition.buildableType,1);
 assert.equal(token._buildCondition.limitByHostAttackRange,1);assert.equal(token._buildCondition.needSpecifyDirection,0);assert.equal(token._withdrawCostRecoverRatio,.5);
 const owner=component('1480001912937277416');assert.equal(owner._modes.length,5);assert.equal(token._modes.length,3);
 assert.equal(component('-8786417442084198424')._projectileKey,'projectile_chr_monstr');assert.equal(component('-6176855876930541592')._projectileKey,'projectile_chr_monstr_s2');
 assert.equal(component('4026630867019524072')._projectileKey,'projectile_chr_monstr_s3');
 assert.equal(component('3674771140734576616')._damageType,3);assert.equal(component('3674771140734576616')._waitForAttackEvent,1);
});
test('S3 preserves native respawn/rollback, HP synchronization, Front reborn and protected origin token actions',()=>{
 const respawn=walk(e.templates['monstr_s_3_buff[respawn]']),move=respawn.find(n=>type(n)==='RespawnCharacter');
 assert.equal(move._colKey,'monstr_col');assert.equal(move._rowKey,'monstr_row');assert.equal(move._recordRespawnToSharedData,true);
 assert.ok(move._respawnBlackboardKeys.includes('monstr_hp_ratio'));
 const token=respawn.find(n=>type(n)==='SpawnTokenOnTargetTile');assert.equal(token._spawnTokenFromCards,true);assert.equal(token._checkBuildableType,false);
 assert.deepEqual(token._buffs[0].attributes.abnormalFlags,['INVINCIBLE','NOT_WITHDRAWABLE']);
 assert.ok(respawn.some(n=>type(n)==='ModifySp'&&n._modifyByRatio&&n._modifyRatio===1));
 assert.ok(walk(e.templates['monstr_s_3[route]']).some(n=>type(n)==='SwitchMode'&&n._modeIndex===4));
 assert.ok(walk(e.templates['monstr_s_3[route]']).some(n=>type(n)==='ForceCharacterAnimatorFaceFront'&&n._FroceFaceFront));
 assert.ok(walk(e.templates['monstr_s_3[sync_hp]']).some(n=>type(n)==='FetchHpToBlackboard'&&n._isHpRatio&&n._skipModifierEvent));
 assert.ok(walk(e.templates['monstr_s_3[undead]']).some(n=>type(n)==='InterruptCharacterSkill'));
});
