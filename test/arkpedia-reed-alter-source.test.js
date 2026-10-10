// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-reed-alter-prefabs.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
const ID='char_1020_reed2';
const rows=Object.values({...e.characters,...e.skills,...e.projectiles}).flatMap(rs=>rs.flatMap(r=>r.components));
const comp=id=>rows.find(c=>c.pathId===id).data;
const bb=values=>Object.fromEntries(values.map(v=>[v.key,v.valueStr||v.value]));
const actions=(key,event)=>e.templates[key].eventToActions[event];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const nodes=value=>{
  if(Array.isArray(value))return value.flatMap(nodes);
  if(value&&typeof value==='object')return [...(value.$type?[value]:[]),...Object.values(value).flatMap(nodes)];
  return [];
};
const type=(v,kind)=>nodes(v).filter(n=>n.$type.includes('+'+kind+','));

test('Reed full three-skill adapter retains all original source graphs and explicit native fidelity limits',()=>{
  assert.deepEqual(e.enabledOperators,[ID]);assert.deepEqual(e.heldOperators,[]);
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'reed-alter');assert.equal(data.operators[ID].skills.length,3);
  assert.equal(rows.length,97);assert.equal(e.source.bundles.length,5);
  assert.equal(Object.keys(e.templates).length,16);assert.equal(Object.keys(e.projectiles).length,4);
  assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(Object.keys(e.originalTemplates),Object.keys(e.templates));
  assert.equal(e.recoveredFacts.length,8);assert.equal(e.runtimeContracts.length,8);assert.equal(e.fidelityLimits.length,3);
  assert.equal(e.holdReasons,undefined);
  for(const key of ['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
});
test('all thirty ranks retain generic S1 identity, manual recharge and separate selected S2/S3 coefficients',()=>{
  const [one,two,three]=['skcom_quickattack[3]','skchr_reed2_2','skchr_reed2_3'].map(k=>e.tables.skills[k].levels);
  for(const levels of [one,two,three]){
    assert.equal(levels.length,10);
    for(const l of levels){assert.equal(l.skillType,'MANUAL');assert.equal(l.spData.spType,'INCREASE_WITH_TIME');}
  }
  assert.ok(one.every(l=>l.prefabId==='skcom_quickattack'));
  assert.ok(e.skills.skcom_quickattack);near(bb(one.at(-1).blackboard).atk,.45);assert.equal(bb(one.at(-1).blackboard).attack_speed,45);
  for(const l of two){assert.equal(bb(l.blackboard).cooldown,1.5);assert.equal(bb(l.blackboard).projectile_life_time,l.duration);}
  assert.deepEqual(two.map(l=>bb(l.blackboard).max_target),[1,1,1,1,1,1,2,2,2,2]);
  near(bb(two.at(-1).blackboard).atk_scale,2.4);
  for(const l of three){assert.equal(l.duration,30);assert.equal(bb(l.blackboard)['talent@prob'],1);assert.equal(bb(l.blackboard).max_target,2);}
  const m3=bb(three.at(-1).blackboard);near(m3['talent@s3_atk_scale'],.6);near(m3['talent@aoe_scale'],1.4);near(m3['talent@range_radius'],1.7);
});
test('two original skeleton chains preserve attack events, absent back-facing S2 event and native mix transitions',()=>{
  const [f,b]=['Front','Back'].map(face=>e.models[ID][face]);
  assert.notEqual(f.sha256,b.sha256);
  for(const m of [f,b]){assert.deepEqual(m.hits.Attack,[.433]);assert.deepEqual(m.hits.Skill_3_Attack,[.467]);near(m.durations.Skill_2,.5);}
  assert.deepEqual(f.hits.Skill_2,[.167]);assert.equal(b.hits.Skill_2,undefined);
  assert.equal(f.eventPayloads.Skill_2.length,1);assert.equal(b.eventPayloads.Skill_2,undefined);
  const a=e.chararts[ID].find(r=>r.data._animations).data;
  assert.equal(a._mixSettings.length,8);
  assert.ok(a._mixSettings.slice(0,4).every(m=>m.mixAnimName==='Skill_3_Begin'));
  assert.ok(a._mixSettings.slice(4).every(m=>m.mixAnimName==='Skill_3_End'));
  const chain=e.officialSkeletonBindings[ID];assert.notEqual(chain.Front.textAssetPathId,chain.Back.textAssetPathId);
  assert.equal(chain.Front.faceSwitcherPathId,chain.Back.faceSwitcherPathId);
  near(e.chararts[ID].find(r=>r.pathId===chain.Front.faceSwitcherPathId).data._switchTime,.15);
});
test('ordinary and S3 attacks preserve source cap, separate single-victim projectile instances and two-target selector',()=>{
  const ordinary=comp('3819160339491811662'),three=comp('-1341300902164663986');
  for(const a of [ordinary,three]){assert.equal(a._damageType,2);assert.equal(a._waitForAttackEvent,1);assert.equal(a._maxAnimScale,1);assert.equal(a._allowNoTarget,0);}
  assert.equal(comp('939627336554082638')._maxNum,2);
  for(const name of ['projectile_chr_reed2','projectile_chr_reed2_s3']){
    const cs=e.projectiles[name].flatMap(r=>r.components).map(c=>c.data);
    assert.equal(cs.find(d=>d._speed!=null)._speed,10);
    const p=cs.find(d=>d._maxHitNum!=null);assert.equal(p._maxHitNum,1);assert.equal(p._stopAfterMaxHit,1);assert.equal(p._alwaysHitTraceTargetInTheEnd,1);
  }
});
test('trait distinguishes calculated damage from HP loss and confines fireball healing to its trace host',()=>{
  const a=actions('reed2_tr','ON_AFTER_OUTPUT_DAMAGE');
  const assign=type(a,'AssignDamageValueToBlackboard')[0];assert.equal(assign._assignRealDelta,false);assert.equal(assign._assignValueWithoutCalculate,false);assert.equal(assign._scaleKey,'scale');
  const conditional=type(a,'IfElse')[0];assert.equal(conditional._conditionNode._targetType,'PROJECTILE_TRACETARGET');
  assert.equal(type(conditional._succeedNodes,'CheckAbnormalFlag')[0]._abnormalFlag,'HEAL_FREE');
  assert.equal(type(conditional._succeedNodes,'CreateBuff')[0]._buffOwner,'PROJECTILE_TRACETARGET');
  assert.equal(type(conditional._failNodes,'CreateBuffUseAbilitySelector')[0]._abilityName,'TraitHealRange');
  const selector=comp('8727888005738099022');assert.equal(selector._postFilter,3);assert.equal(selector._maxNum,1);assert.equal(selector._ignoreHealFree,0);
  assert.equal(type(actions('reed2_tr_heal[effect]','ON_BUFF_START'),'FixedValueHeal')[0]._ignoreHealFree,false);
});
test('Reflected Shine excludes self healing and uses calculated healing before overheal rather than real HP gain',()=>{
  const a=actions('reed2_t_2','ON_OUTPUT_MODIFIER');
  const conditional=type(a,'IfElse')[0];assert.equal(conditional._conditionNode._target1,'MODIFIER_TARGET');assert.equal(conditional._conditionNode._target2,'MODIFIER_SOURCE');assert.equal(conditional._succeedNodes,null);
  assert.equal(type(a,'AssignDamageValueToBlackboard')[0]._assignRealDelta,false);
  assert.equal(type(a,'FixedValueHeal')[0]._targetType,'BUFF_OWNER');
  assert.deepEqual(e.tables.character.talents[1].candidates.map(t=>bb(t.blackboard).scale),[.5,.55]);
});
test('Cinder keeps ordinary shared strength comparison and database nonstacking ArtsFragility separate from S3 ownership',()=>{
  const a=actions('reed2_t_1','ON_OUTPUT_DAMAGE');assert.equal(type(a,'Dice')[0]._probKey,'prob');
  const comparator=type(a,'FilterByBlackboardValue')[0];assert.equal(comparator._blackboardKey,'damage_scale');assert.equal(comparator._condType,'GT');
  const create=type(a,'CreateBuff')[0]._buff;assert.equal(create.overrideType,'EXTEND');assert.equal(create.independentCharacterSource,false);assert.equal(create.templateKey,'reed2_t_1[debuff]');
  assert.equal(type(actions('reed2_t_1[debuff]','ON_BUFF_START'),'CreateBuffById')[0]._buffKey,'weak[magic][inf]');
  const weak=e.buffDatabase['weak[magic][inf]'];assert.equal(weak.priorityBBKeys[0],'damage_scale');
  const scale=actions('damage_scale[mag]','ON_TAKE_DAMAGE')[0];assert.equal(scale._damageMask,'MAGICAL');assert.equal(scale._isStackable,false);
  assert.deepEqual(e.tables.character.talents[0].candidates.map(t=>bb(t.blackboard).damage_scale),[1.15,1.17,1.3,1.32]);
});
test('S2 keeps selected-host emission, source selector masks and independent counterclockwise collision geometry',()=>{
  const cast=comp('-7602740050555161889'),selector=comp('-441595459227274529');
  assert.equal(cast._projectileCnt,3);near(cast._projectileAroundRadius,.5);assert.equal(cast._projectileKey,'projectile_chr_reed2_fire');assert.equal(cast._waitForAttackEvent,1);
  assert.equal(selector._professionMask,639);assert.equal(selector._postFilter,47);assert.equal(selector._ignoreHealFree,0);
  assert.equal(comp('-4622237965716606241')._allowNoTarget,0);assert.equal(comp('-4622237965716606241')._useTriggerInManualMode,1);
  const move=comp('1215918508367423093');assert.equal(move._aroundSpeed,150);assert.equal(move._clockwise,0);assert.equal(move._stopIfTargetDead,1);
  near(comp('-5673238097190836619').m_Radius,.6);
  const hit=comp('5175477760551429749');assert.equal(hit._coolDown._serializedValue,8589934592);assert.equal(hit._targetOptions.targetMotion,1);assert.equal(hit._ignoreCamouflage,1);
  assert.equal(comp('-1660160905485736331')._stopWhenSourceInvalid,1);
});
test('S3 copies selected talent stats and retains independent DOT clock plus shared diffuse coefficient priority',()=>{
  const copy=comp('-1591457459098848946')._config;
  assert.deepEqual(copy.map(c=>c._sourceKey),['talent@atk','talent@damage_scale']);assert.ok(copy.every(c=>c._sourceTalentKey==='1'&&c._validateSkillIndices===1));
  const buffs=comp('6385536735437680974')._additiveActiveBuffs;
  const dot=buffs.find(b=>b.templateKey==='reed2_t_1[skill_3_dot]');assert.equal(dot.independentCharacterSource,1);near(dot.firstTriggerInterval,.2);assert.equal(dot.triggerInterval,1);
  const holder=actions('reed2_t_1[skill_3_holder]','ON_BUFF_START');const compare=type(holder,'FilterByBlackboardValue')[0];assert.equal(compare._blackboardKey,'aoe_scale');assert.equal(compare._condType,'GT');
  const skillBuff=comp('278859977400331337')._buffs[0];assert.equal(skillBuff.templateKey,'switch_mode_restart_fsm');assert.equal(bb(skillBuff.blackboard).mode,1);
});
test('S3 chain installs holder/DOT before delayed Arts splash and source-specific finish clears its own effects',()=>{
  const a=actions('reed2_t_1[skill_3_diffuse]','ON_OWNER_KILLED');assert.equal(type(a,'IfTarget')[0]._checkTargetAlive,true);
  const apply=type(a,'CreateBuffInRange')[0];near(apply._radius,1.1);assert.equal(apply._targetOptions.targetMotion,'ALL');
  assert.deepEqual(apply._buffs.map(b=>b.templateKey),['reed2_t_1[skill_3_holder]','reed2_t_1[skill_3_dot]','reed2_t_1[skill_3_aoe]']);
  const blast=apply._buffs[2];near(blast.lifeTime,.15);near(blast.firstTriggerInterval,.1);assert.equal(blast.triggerCnt,1);assert.equal(blast.waitFirstTriggerInterval,true);
  const damage=type(actions('reed2_t_1[skill_3_aoe]','ON_BUFF_TRIGGER'),'AdvancedApplyDamage')[0];assert.equal(damage._damageType,'MAGICAL');assert.equal(damage._atkScaleVar,'aoe_scale');
  const finish=actions('reed2_t_1[skill_3_finish_buff]','ON_BUFF_START');assert.ok(finish.every(a=>a._checkBuffSource===true));assert.deepEqual(finish.map(a=>a._buffKey),['reed2_talent_1[skill_3_diffuse]','reed2_talent_1[skill_3_dot]']);
  assert.equal(type(actions('reed2_t_1[ctrl]','ON_BUFF_FINISH'),'CreateBuffToCertainSideUnits')[0]._buff.templateKey,'reed2_t_1[finish_buff]');
});
