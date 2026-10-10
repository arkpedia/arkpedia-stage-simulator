// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-pozemka-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID='char_4055_bgsnow', TOKEN='token_10026_bgsnow_subbow';
const rows=Object.values({...e.characters,...e.skills,...e.tokens,...e.projectiles}).flatMap(rs=>rs.flatMap(r=>r.components));
const comp=id=>rows.find(c=>c.pathId===id).data;
const bb=values=>Object.fromEntries(values.map(v=>[v.key,v.valueStr||v.value]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const actions=(key,event)=>e.templates[key].eventToActions[event];

test('Pozëmka source foundation retains complete owner/token graphs without claiming playable coverage',()=>{
  assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);assert.equal(data.tokens[TOKEN],undefined);
  assert.equal(rows.length,215);assert.equal(e.source.bundles.length,6);
  assert.equal(Object.keys(e.templates).length,17);assert.equal(Object.keys(e.projectiles).length,6);
  assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(Object.keys(e.originalTemplates),Object.keys(e.templates));
  assert.equal(e.recoveredFacts.length,8);assert.equal(e.verificationLimits.length,3);assert.equal(e.holdReasons.length,1);
  for(const key of ['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
});
test('all sixty owner/token rank records retain separate skill identities and wrappers',()=>{
  for(const [prefix,source] of [['skchr',e.tables.skills],['sktok',e.tables.tokenSkills]])for(let i=1;i<=3;i++){
    const id=`${prefix}_bgsnow_${i}`,levels=source[id].levels;
    assert.equal(levels.length,10);assert.ok(e.skills[id]);assert.ok(levels.every(l=>l.prefabId===id));
  }
  const [one,two,three]=[1,2,3].map(i=>e.tables.skills[`skchr_bgsnow_${i}`].levels);
  assert.ok(one.every(l=>l.skillType==='AUTO' && l.spData.spType==='INCREASE_WHEN_ATTACK' && l.duration===-1));
  assert.deepEqual(two.map(l=>l.spData.maxChargeTime),[1,1,1,2,2,2,2,2,2,2]);
  assert.ok(two.every(l=>l.rangeId==='3-1' && l.duration===-1));
  assert.ok(three.every(l=>l.skillType==='MANUAL' && l.spData.spType==='INCREASE_WITH_TIME'));
  assert.deepEqual(three.map(l=>l.duration),[25,25,25,26,26,26,27,28,29,30]);
  near(bb(one.at(-1).blackboard).atk,.6);near(bb(one.at(-1).blackboard).prob,.4);near(bb(one.at(-1).blackboard).atk_scale,2.25);
  near(bb(two.at(-1).blackboard).atk_scale,2.3);near(bb(two.at(-1).blackboard).respawn_time,.5);
  near(bb(three.at(-1).blackboard).atk_scale,2);near(bb(three.at(-1).blackboard)['bgsnow_s_3[atk_up].atk_scale'],2.55);
});
test('four original facing chains preserve asymmetric S1 release and distinct Typewriter events',()=>{
  for(const id of [ID,TOKEN]){
    assert.notEqual(e.models[id].Front.sha256,e.models[id].Back.sha256);
    assert.notEqual(e.officialSkeletonBindings[id].Front.textAssetPathId,e.officialSkeletonBindings[id].Back.textAssetPathId);
    assert.equal(e.officialSkeletonBindings[id].Front.faceSwitcherPathId,e.officialSkeletonBindings[id].Back.faceSwitcherPathId);
  }
  const f=e.models[ID].Front,b=e.models[ID].Back;
  assert.deepEqual(f.hits.Skill_1_Loop,[.133]);assert.deepEqual(b.hits.Skill_1_Loop,[.3]);
  for(const m of [f,b]){assert.deepEqual(m.hits.Attack_Loop,[.133]);assert.deepEqual(m.hits.Skill_2,[.533]);assert.deepEqual(m.hits.Skill_3_Loop,[.133]);}
  for(const m of [e.models[TOKEN].Front,e.models[TOKEN].Back]){assert.deepEqual(m.hits.Attack,[.067]);near(m.durations.Attack,1.6);}
  assert.deepEqual(e.models[TOKEN].Front.hits.Attack_Down,[.067]);
});
test('ordinary first-only Begin and skill animation caps remain distinct native fields',()=>{
  const ordinary=comp('8710995461793676091');
  assert.equal(ordinary._beginAnim,'Attack_Begin');assert.equal(ordinary._oneshotAnim,'Attack_Loop');
  assert.equal(ordinary._onlyPlayBeginAnimWhenFirstAttack,1);assert.equal(ordinary._maxAnimScale,-1);
  assert.equal(comp('-633843096484611269')._maxAnimScale,1);
  assert.equal(comp('-6938983787148479984')._maxAnimScale,1);
  assert.equal(comp('-5833594960451165855')._maxAnimScale,1);
});
test('S1 Dice and owner/token activation retain calculated damage and separate source triggers',()=>{
  const a=actions('bgsnow_s_1[random_atk]','ON_CALCULATE_DAMAGE');
  assert.ok(a[0].$type.includes('+Dice,'));assert.equal(a[0]._probKey,'prob');
  assert.ok(a[1].$type.includes('+AtkScaleUp,'));assert.equal(a[1]._atkScaleKey,'atk_scale');
  assert.ok(actions('bgsnow_s_1[token_trigger]','ON_BUFF_START')[0].$type.includes('+TriggerSkill,'));
  assert.equal(comp('5713771100046861632')._waitForAttackEvent,0);
  assert.equal(comp('-5363252293590784643')._waitForAttackEvent,1);
});
test('S2 preserves one original attack event plus two referenced extra damage actions rather than invented emission offsets',()=>{
  for(const id of ['-6938983787148479984','9103584576704194494']){
    const d=comp(id),a=JSON.parse(d._actions.SerializedState);
    assert.equal(d._waitForAttackEvent,1);assert.equal(d._additionalTimes,undefined);
    assert.equal(d._triggerDelta,undefined);assert.equal(a.length,4);
    assert.ok(a[1].$type.includes('+AdvancedApplyDamage'));assert.equal(a[1]._attackType,'BUFF');
    assert.equal(a[1]._baseOnHostAtk,false);assert.equal(a[3].$ref,a[1].$id);
  }
  assert.ok(actions('trigger_token_skill','ON_BUFF_START')[0].$type.includes('+TriggerTokenSkill,'));
  assert.equal(comp('-9215113630744710640')._hidden,0);assert.equal(comp('31780004975257534')._hidden,1);
});
test('S2 equipped-skill respawn modifier retains finish lifecycle instead of immediate stock recovery',()=>{
  const copy=comp('-6084413491372121759')._config[0];
  assert.deepEqual(copy._skillIndices,[1]);assert.equal(copy._validateSkillIndices,1);
  assert.equal(copy._sourceKey,'respawn_time');assert.equal(copy._targetKey,'respawn_time');
  const a=actions('bgsnow_subbow_s_2[respawn]','ON_BUFF_FINISH')[0];
  assert.equal(a._lifeType,'UNTIL_NEXT_SPAWN');assert.equal(a._isRatio,true);
  assert.ok(actions('charge_token[finish]','ON_OWNER_FINISH')[0].$type.includes('+RechargeToken,'));
});
test('S3 focus coefficient uses source-specific mark and separate fail branch',()=>{
  const front=actions('bgsnow_s_3[atk_up]','ON_CALCULATE_DAMAGE')[0];
  assert.deepEqual(front._buffKeys,['bgsnow_focus[mark]']);assert.equal(front._checkBuffSource,true);
  assert.equal(front._buffSourceType,'BUFF_OWNER');assert.equal(comp('-7316421413190337733')._rangeId,'5-1');
  const other=actions('bgsnow_s_3[base_atk_up]','ON_CALCULATE_DAMAGE')[0];
  assert.equal(other._succeedNodes,null);assert.ok(other._failNodes[0].$type.includes('+AtkScaleUp,'));
  assert.equal(actions('bgsnow_s_3[atk_up]','ON_BUFF_FINISH')[0]._buffKey,'subbow_s_3[switch_mode]');
  const token=e.tables.tokenSkills.sktok_bgsnow_3.levels.at(-1);
  near(bb(token.blackboard)['attack@atk_scale'],2.55);near(bb(token.blackboard).base_attack_time,-.6);
});
test('Typewriter selected lifetime, adjacency and FINAL_SCALER DEF debuffs preserve talent ordering',()=>{
  const t=e.tables.tokens[TOKEN];assert.deepEqual(t.talents[0].candidates.map(c=>bb(c.blackboard).interval),[15,20,25]);
  assert.equal(comp('831397842328985953')._occupiedRemainingCharacterCnt,0);
  assert.equal(comp('831397842328985953')._buildCondition.needSpecifyDirection,1);
  assert.equal(comp('6787254480125983547')._rangeId,'x-5');
  const a=actions('bgsnow_subbow_token[debuff]','ON_CALCULATE_DAMAGE')[0];
  assert.deepEqual(a._conditionNode._buffKeys,['bgsnow_t[def_down]']);
  for(const branch of ['_succeedNodes','_failNodes']){
    const buff=a[branch][0]._buff;assert.equal(buff.attributes.attributeModifiers[0].formulaItem,'FINAL_SCALER');
    assert.deepEqual(buff.priorityBBKeys,['def']);assert.equal(buff.durationKey,'duration');
  }
  const p5=bb(t.talents[1].candidates.at(-1).blackboard);
  assert.equal(p5.duration,5);near(p5['bgsnow_token[def_down]_1.def'],-.2);near(p5['bgsnow_token[def_down]_2.def'],-.25);
});
test('all six owner/token projectiles preserve homing speed, lifetime and one-victim caps',()=>{
  for(const rs of Object.values(e.projectiles)){
    const ds=rs.flatMap(r=>r.components).map(c=>c.data),p=ds.find(d=>d._maxHitNum!==undefined);
    assert.equal(p._maxHitNum,1);assert.equal(p._stopAfterMaxHit,1);assert.equal(p._lifeTime,10);
    assert.equal(p._stopWhenSourceInvalid,0);assert.equal(p._alwaysHitTraceTargetInTheEnd,1);
    assert.equal(ds.find(d=>d._speed!==undefined)._speed,10);
  }
});
