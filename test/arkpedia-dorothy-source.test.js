// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-dorothy-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID='char_4048_doroth', TOKEN='token_10025_doroth_recttp';
const components=g=>Object.values(g).flatMap(rows=>rows.flatMap(r=>r.components.map(c=>c.data)));
const skill=id=>components({[id]:e.skills[id]});
const bb=values=>Object.fromEntries(values.map(v=>[v.key,v.value]));
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-6,`${x} != ${y}`);
const all=components({...e.characters,...e.tokens,...e.skills,...e.projectiles});

test('Dorothy evidence contains whole owner, Resonator and six skill graphs with bounded runtime contracts',()=>{
 assert.equal(all.length,164);assert.equal(e.source.bundles.length,6);
 assert.deepEqual(Object.keys(e.skills),[...Object.keys(e.tables.skills),...Object.keys(e.tables.tokenSkills)]);
 assert.equal(Object.keys(e.templates).length,8);assert.deepEqual(e.nativeTemplateGaps,[]);
 assert.deepEqual(Object.keys(e.originalTemplates),Object.keys(e.templates));
 assert.deepEqual(e.enabledOperators,[ID]);assert.deepEqual(e.heldOperators,[]);
 assert.equal(e.runtimeContract.length,5);
 assert.equal(REGULAR_OPERATORS[ID].skillIds.length,3);assert.equal(data.operators[ID].skills.length,3);
 assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);assert.equal(e.nativeParticleSupport,false);
});
test('all 30 owner and 30 token ranks preserve their selected effects and separate SP contracts',()=>{
 for(let n=1;n<=3;n++){
  const a=e.tables.skills[`skchr_doroth_${n}`].levels,t=e.tables.tokenSkills[`sktok_doroth_${n}`].levels;
  assert.equal(a.length,10);assert.equal(t.length,10);
  for(let rank=0;rank<10;rank++){
   assert.deepEqual(bb(a[rank].blackboard),bb(t[rank].blackboard));
   assert.equal(a[rank].skillType,'AUTO');assert.equal(t[rank].spData.spCost,0);
   assert.equal(t[rank].spData.spType,8);assert.equal(a[rank].spData.spType,'INCREASE_WITH_TIME');
  }
  assert.equal(a[9].spData.spCost,12);assert.equal(a[9].spData.initSp,0);
 }
});
test('stock refresh, recharge and field limits remain distinct from free initial-placement talent',()=>{
 assert.equal(e.templates['charge_token[refresh]'].eventToActions.ON_OWNER_BORN[0]._refreshRemainingCnt,true);
 assert.equal(e.templates.trigger_charge_token.eventToActions.ON_BUFF_START[0]._refreshRemainingCnt,false);
 assert.deepEqual(e.tables.token.phases.map(p=>p.attributesKeyFrames[0].data.maxDeckStackCnt),[5,7,9]);
 assert.deepEqual(e.tables.token.phases.map(p=>p.attributesKeyFrames[0].data.maxDeployCount),[6,8,10]);
 const talent=e.tables.character.talents[0].candidates;
 assert.deepEqual(talent.map(t=>bb(t.blackboard).cnt),[4,6,6,8,8,10]);
 assert.deepEqual(talent.map(t=>bb(t.blackboard)['attack@max_cnt']),[0,0,1,1,2,2]);
 const selector=components(e.characters).find(d=>d._alwaysRandomInTheEnd!=null);
 assert.equal(selector._alwaysRandomInTheEnd,1);assert.equal(selector._options.buildableType,1);
 assert.equal(selector._targetMotion,1);assert.equal(selector._ignoreHitRange,0);
 for(let n=1;n<=3;n++)assert.equal(skill(`skchr_doroth_${n}`).find(d=>d._stopSpWhenTokenIsFull!=null)._stopSpWhenTokenIsFull,1);
});
test('Resonator uses fixed ground placement, rejects occupied walking-enemy tiles and consumes no operator slot',()=>{
 const root=components(e.tokens).find(d=>d._buildCondition);
 assert.equal(root._isFixedRotation,1);assert.equal(root._useRealBornTimeFromAnim,1);
 assert.equal(root._occupiedRemainingCharacterCnt,0);assert.equal(root._buildCondition.buildableType,1);
 assert.equal(root._buildCondition.needSpecifyDirection,0);assert.equal(root._buildCondition._excludeOccupiedByWalkEnemy,1);
 assert.equal(root._withdrawCostRecoverRatio,0);
 assert.ok(e.tables.token.phases.every(p=>p.attributesKeyFrames.every(k=>k.data.cost===3&&k.data.respawnTime===5)));
});
test('Dreamer triggers at withdraw-buff start and stacks native ATK modifiers independently of trap impact',()=>{
 const a=e.templates['doroth_token[withdraw]'].eventToActions;
 assert.equal(a.ON_BUFF_START[0]._buffKeys[0],'doroth_t_2');assert.match(a.ON_BUFF_START[0].$type,/TriggerHostsBuffsByKeys/);
 assert.match(a.ON_BUFF_FINISH[0].$type,/Withdraw/);assert.equal(a.ON_BUFF_FINISH[0]._withdrawSource,true);
 const actions=e.templates.doroth_t_2.eventToActions.ON_BUFF_TRIGGER;
 assert.equal(actions[0]._buff.overrideType,'STACK');assert.equal(actions[0]._buff.attributes.attributeModifiers[0].formulaItem,'MULTIPLIER');
 assert.equal(actions[1]._conditionNode._stackCountKey,'max_stack_cnt');
 assert.deepEqual(e.tables.character.talents[1].candidates.map(t=>bb(t.blackboard).max_stack_cnt),[10,12]);
 assert.ok(e.tables.character.talents[1].candidates.every(t=>bb(t.blackboard).atk===.02));
});
test('S1 retains one selected target and timed DEF reduction, with no area explosion',()=>{
 const a=skill('sktok_doroth_1').find(d=>d._atkScaleKey);
 assert.equal(a._selectTargetSource,2);assert.equal(a._damageType,1);assert.equal(a._waitForAttackEvent,1);
 assert.equal(a._activeBuffs[0].buffKey,'doroth_s_1[def_down]');assert.equal(a._activeBuffs[0].durationKey,'duration');
 assert.equal(a._activeBuffs[0].attributes.attributeModifiers[0].attributeType,2);
 const s=bb(e.tables.skills.skchr_doroth_1.levels[9].blackboard);near(s.atk_scale,4.5);near(s.def,-.35);near(s.duration,5);
});
test('S2 retains radius 1.2 and the higher-priority one-target Bind override',()=>{
 const nodes=skill('sktok_doroth_2');near(nodes.find(d=>d.m_Radius!=null).m_Radius,1.2);
 const a=nodes.find(d=>d._atkScaleKey),single=nodes.find(d=>d._extraCondition!=null);
 assert.equal(a._selectTargetSource,1);assert.equal(a._selectTargetTiming,1);assert.equal(a._damageType,1);
 assert.deepEqual(a._activeBuffs[0].attributes.abnormalFlags,[13]);assert.equal(single._extraCondition,1);
 assert.equal(single._buffs[0].overrideKey,'doroth_s_2[unmovable]');assert.equal(single._buffs[0].durationKey,'duration_2');
 assert.equal(single._buffs[0].priority,100);
 const s=bb(e.tables.skills.skchr_doroth_2.levels[9].blackboard);near(s.atk_scale,3);near(s.duration,3.5);near(s.duration_2,6);
});
test('S3 retains separate sequential Boom and TriggerNearby actions and host-filtered marked traps',()=>{
 const nodes=skill('sktok_doroth_3'),composite=nodes.find(d=>d._metadata?.namedAsAlias==='TriggerSkill');
 assert.equal(composite._abilities.length,2);assert.equal(composite._alwaysNext,1);
 const boom=nodes.find(d=>d._atkScaleKey),trigger=nodes.find(d=>d._activeBuffs?.some(b=>b.buffKey==='doroth_token_s3[trigger]'));
 assert.equal(boom._damageType,2);assert.equal(boom._animKey,'Attack');
 assert.equal(trigger._waitForAttackEvent,1);assert.equal(trigger._animKey,'');
 assert.equal(trigger._activeBuffs[0].triggerInterval,1);assert.equal(trigger._activeBuffs[0].triggerCnt,1);
 assert.equal(bb(e.tables.skills.skchr_doroth_3.levels[9].blackboard).interval,2);
 const selector=nodes.find(d=>d._filterTokenHost!=null);
 assert.equal(selector._filterTokenHost,1);assert.equal(selector._buffKey,'doroth_token[mark]');assert.equal(selector._excludeOwner,1);
 assert.equal(e.tables.tokenSkills.sktok_doroth_3.levels[9].rangeId,'x-6');assert.equal(e.tables.ranges['x-6'].grids.length,9);
});
test('original Resonator has two literal attack events and one shared skeleton for both facing aliases',()=>{
 const art=e.tokenArtwork.models[TOKEN].facings,models=e.tokenModels[TOKEN];
 assert.deepEqual(art.front.files,art.back.files);assert.deepEqual(models.front,models.back);
 near(models.front.durations.Start,.433);near(models.front.durations.Attack,.333);
 const events=models.front.eventPayloads.Attack;assert.equal(events.length,2);
 assert.ok(events.every(x=>x.name==='OnAttack'));near(events[0].time,4/15);near(events[1].time,1/3);
 assert.ok(e.runtimeContract.some(s=>/two Resonator OnAttack events/.test(s)));
 for(const face of ['Front','Back'])near(e.models[ID][face].hits.Attack[0],.333);
});
test('original owner projectiles remain tracked single-hit speed10 through source removal',()=>{
 for(const nodes of Object.values(e.projectiles)){
  const rows=nodes.flatMap(n=>n.components.map(c=>c.data));near(rows.find(d=>d._speed!=null)._speed,10);
  const main=rows.find(d=>d._maxHitNum!=null);assert.equal(main._maxHitNum,1);assert.equal(main._stopWhenSourceInvalid,0);
  assert.equal(main._canHitSameTargetMultipleTimes,0);
 }
});
