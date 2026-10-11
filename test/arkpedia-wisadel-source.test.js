// SPDX-License-Identifier: GPL-3.0-or-later
// Original source contracts remain separate from public combat enablement.
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-wisadel-prefabs.json' with {type:'json'};
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID='char_1035_wisdel', TOKEN='token_10035_wisdel_wward';
const components=Object.values({...e.characters,...e.tokens,...e.skills,...e.projectiles})
  .flatMap(rows=>rows.flatMap(r=>r.components));
const c=id=>components.find(v=>v.pathId===id).data;
const bb=rows=>Object.fromEntries(rows.map(v=>[v.key,v.value]));
const ranks=n=>e.tables.skills[`skchr_wisdel_${n}`].levels;
const type=n=>n.$type.split('+').at(-1).split(',')[0];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('Wisadel evidence preserves a held full kit without increasing playable coverage',()=>{
  assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);assert.equal(e.nativeParticleSupport,false);
  assert.equal(e.source.commit,'57010cb5b2afea112cae57daa756b58676ba6850');
  assert.equal(e.source.nativeClient,'26-09-23-17-49-43_b9cc4a');
  assert.equal(components.length,224);assert.equal(e.source.bundles.length,6);
  assert.equal(Object.keys(e.templates).length,13);assert.equal(Object.keys(e.projectiles).length,8);
  assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(Object.keys(e.originalTemplates),Object.keys(e.templates));
  assert.deepEqual(Object.keys(e.buffDatabase),['sluggish','stun']);
  assert.equal(e.recoveredFacts.length,10);assert.equal(e.holdReasons.length,3);
});
test('ordinary selector prevents immediate repeats without inventing a strict three-animation cycle',()=>{
  const a=c('-3919129585840132641');
  assert.deepEqual(a._abilities.map(v=>v.m_PathID),['-1978783587831353889','-4191133412231909921','3082456590823550431']);
  assert.equal(a._diffFromLastOneIfNotFirst,1);assert.equal(a._selectAllAtLeastOnce,0);
  const trait=bb(e.tables.character.trait.candidates[0].blackboard);
  assert.equal(trait['attack@append_atk_scale'],.5);assert.equal(trait['attack@enable_third_attack'],0);
  for(const face of ['Front','Back']){
    const m=e.models[ID][face];
    for(const key of ['Attack_A','Attack_B','Attack_C','Skill_1']) near(m.hits[key][0],.6);
    near(m.hits.Skill_2_Loop[0],.267);near(m.hits.Skill_3_Loop[0],.533);
  }
});
test('projectile sizes and aftershock delays distinguish S1 and S3 from ordinary attacks',()=>{
  for(const [key,radius] of [['default',.9],['s1',1.1],['s2',.9],['s3',2.5]]){
    const rows=e.projectiles[`projectile_chr_wisdel_${key}`].flatMap(r=>r.components.map(c=>c.data));
    near(rows.find(d=>d.m_Radius!=null).m_Radius,radius);
    const mover=rows.find(d=>d._delayAfterReached!=null);
    near(key==='s2'?mover._delayTime:mover._delayAfterReached,.15);
    if(key==='s2')near(mover._delayToStart,.1);
    assert.ok(rows.some(d=>d._applyAtkScaleTraceTgt===1&&d._atkScaleKeyTraceTgt==='main_atk_scale'));
  }
});
test('afterimage explosion checks both probability and the mark before physical area damage',()=>{
  const nodes=e.templates['wisdel_t_1[projectile_shock]'].eventToActions.ON_BUFF_START;
  assert.deepEqual(nodes.slice(0,3).map(type),['Dice','CheckContainsBuff','AOEDamage']);
  assert.equal(nodes[0]._probKey,'prob');assert.deepEqual(nodes[1]._buffKeys,['wisdel_t_1[bomb]']);
  assert.equal(nodes[2]._damageType,'PHYSICAL');assert.equal(nodes[2]._damageScale,'bomb_atk_scale');near(nodes[2]._radius,1.1);
  assert.equal(nodes[2]._targetOptions.targetMotion,'ALL');assert.equal(nodes[2]._checkTargetAlive,false);
  assert.equal(nodes[1]._checkBuffSource,false);
  assert.ok(nodes.at(-1).$type.includes('FinishBuffsById'));
  assert.equal(nodes.at(-1)._buffKey,'wisdel_t_1[bomb]');assert.equal(nodes.at(-1)._checkBuffSource,false);
  const derived=e.templates['wisdel_t_1[bomb]'].eventToActions.ON_BUFF_START[0]._succeedNodes[0];
  assert.equal(type(derived),'AttachAsDerivedBuffById');assert.equal(derived._finishDerivedBuffIfParentFinish,true);
});
test('all ten S1 ranks preserve offensive SP, aftershock coefficients and terminal stun',()=>{
  assert.deepEqual(ranks(1).map(s=>s.spData.spCost),[4,4,4,4,4,4,3,3,3,2]);
  assert.deepEqual(ranks(1).map(s=>bb(s.blackboard).append_atk_scale),[.6,.65,.7,.75,.8,.85,.9,1,1.1,1.2]);
  assert.deepEqual(ranks(1).map(s=>bb(s.blackboard).stun_duration),[.5,.5,.5,.5,.5,.5,1,1,1,1.5]);
  for(const s of ranks(1)){assert.equal(s.spData.spType,'INCREASE_WHEN_ATTACK');assert.equal(s.skillType,'AUTO');assert.equal(s.spData.initSp,0);}
  const stun=c('-796439927896124525');assert.equal(stun._atkScale,0);assert.equal(stun._atkScaleKey,'last_atk_scale');
  assert.equal(stun._activeBuffs[0].buffKey,'stun');assert.equal(stun._activeBuffs[0].durationKey,'stun_duration');
});
test('S2 overload uses additive BAT and three additional emissions with no single-target restriction',()=>{
  assert.equal(c('4210114535125638072')._isOverloadSkill,1);
  const modifier=c('4787167229120109496')._buffs[0].attributes.attributeModifiers;
  assert.ok(modifier.some(v=>v.attributeType===8&&v.formulaItem===0&&v.loadFromBlackboard===1));
  assert.deepEqual(ranks(2).map(s=>s.spData.spCost),[35,34,33,32,31,30,29,28,27,25]);
  assert.deepEqual(ranks(2).map(s=>bb(s.blackboard).base_attack_time),[-.5,-.5,-.5,-.5,-.5,-.5,-.7,-.7,-.7,-.7]);
  assert.deepEqual(ranks(2).map(s=>bb(s.blackboard)['attack@atk_scale_ol']),[.6,.6,.6,.65,.65,.65,.7,.75,.75,.8]);
  const a=c('2275143083200507359');assert.equal(a._additionalTimes,3);near(a._triggerDelta,.1);
  assert.equal(a._limitToOneTargetAfterFirstRound,0);
  assert.equal(e.templates['wisdel_s_2[overload_start]'].eventToActions.ON_BUFF_START[0]._modeIndex,2);
  const movement=c('5684319367411220528');assert.equal(movement._immediatelyReach,1);
  assert.equal(movement._attachToMountPoint,1);assert.equal(movement._followTarget,0);assert.equal(movement._keepUpdate,0);
  near(movement._delayToStart,.1);near(movement._delayTime,.15);
  assert.equal(c('-1616557734077108769')._maxNum,3);assert.equal(c('-2173305061285597729')._maxNum,1);
  assert.equal(c('-2173305061285597729')._postFilter,14);
  for(const s of ranks(2)){assert.equal(s.duration,25);assert.equal(s.skillType,'MANUAL');assert.equal(s.spData.initSp,15);}
});
test('S3 preserves six ammunition rounds and rank-dependent Shadow counts, costs and ATK',()=>{
  assert.deepEqual(ranks(3).map(s=>s.spData.spCost),[70,68,66,64,62,60,58,55,53,50]);
  assert.deepEqual(ranks(3).map(s=>bb(s.blackboard).max_cnt),[1,1,1,1,1,1,2,2,2,2]);
  assert.deepEqual(ranks(3).map(s=>bb(s.blackboard).atk),[.95,1,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8]);
  for(const s of ranks(3)){const b=bb(s.blackboard);assert.equal(s.durationType,'AMMO');assert.equal(s.duration,-1);
    assert.equal(b['attack@trigger_time'],6);assert.equal(b['attack@prob'],1);assert.equal(b.base_attack_time,2.9);assert.equal(b.sp,3);}
  const nodes=e.templates['wisdel_s_3_token[add_sp]'].eventToActions.ON_BUFF_START;
  assert.deepEqual(nodes.map(type),['CheckContainsBuff','ModifySp','FinishBuffsById']);
  assert.deepEqual(nodes[0]._buffKeys,['wisdel_s_3[token_mark]']);assert.equal(nodes[1]._spString,'sp');
  assert.equal(nodes[2]._buffKey,'wisdel_s_3[token_mark]');
});
test('Shadow ownership, Camouflage and deck flags retain the original distinctions',()=>{
  const root=c('7531983340995195566');assert.equal(root._occupiedRemainingCharacterCnt,0);assert.equal(root._notShowInDeck,0);
  for(const phase of e.tables.token.phases) for(const frame of phase.attributesKeyFrames)
    assert.equal(frame.data.maxDeployCount,3);
  const aura=e.templates['token_wisdel_passive[to_host]'].eventToActions.ON_BUFF_START[0];assert.equal(aura._rangeId,'x-5');
  const host=e.templates['token_wisdel_host[Camouflage]'].eventToActions.ON_BUFF_START;
  assert.deepEqual(host.map(type),['CheckTargetTokenOrHost','IfNot','FinishBuff']);
  assert.equal(type(e.templates.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0]),'KillTokens');
  const tokenRanks=e.tables.tokenSkills.sktok_wisdel_wward.levels;assert.equal(tokenRanks.length,10);
  for(const s of tokenRanks){assert.equal(s.spData.spCost,5);assert.equal(bb(s.blackboard).sp_min,0);assert.equal(bb(s.blackboard).sp_max,3);}
  const end=JSON.parse(e.originalTemplates.token_wisdel_skill_end.eventToActions._items[0].value.SerializedState);
  assert.equal(end[0]._convertToInt,false);assert.equal(end[1]._forceFlag,true);
  assert.deepEqual(c('6826492958112658094')._buffs[0].attributes.abnormalFlags,[7]);
  assert.equal(root._clearProjectileWhenDead,0);assert.equal(root._isFixedRotation,1);
  const mover=c('-4142004031650792695');assert.equal(mover._speed,15);assert.equal(mover._keepUpdateTargetpos,0);
  assert.equal(c('8036233635240344329')._lifeTime,2);
});
test('Shadow art aliases preserve the native facing switcher and embedded RGBA texture',()=>{
  const faces=e.tokenArtwork.models[TOKEN].facings;
  for(const face of Object.values(faces)){
    assert.deepEqual(face.textureDimensions,[216,216]);assert.equal(face.originalPathIds.alphaTexturePathId,'0');
    assert.equal(face.originalPathIds.faceSwitcherPathId,'40550321937560238');
  }
  assert.deepEqual(faces.front.files,faces.back.files);
  near(e.tokenModels[TOKEN].front.hits.Attack[0],.033);
  near(e.tokenModels[TOKEN].front.durations.Attack,2.033);
});
