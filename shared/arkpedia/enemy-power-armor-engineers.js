// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-power-armor-engineer-animations.json' with {type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const isEngineer=r=>['enemy_1250_lyengs','enemy_1250_lyengs_2'].includes(r.prefabKey);
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function powerArmorEngineerNative(r,n){
  if(!isEngineer(r)||r.key!==r.prefabKey||r.skills.length!==1||r.applyWay!=='RANGED'||r.stats.dmgType!=='arts'
    ||r.stats.motion!=='WALK'||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}}))return false;
  const s=r.skills[0],root=n[r.prefabKey]?.[0],mode=n.$ref(root?._modes?.[0]),attack=n.$ref(mode?._attack);
  const cast=n.Charge?.find(c=>'_projectileKey'in c),wrapper=n.Charge?.find(c=>'_familyMask'in c),selector=n.$ref(cast?._selector);
  const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root?._animator);
  if(s.prefabKey!=='Charge'||s.cooldown!==30||s.initCooldown!==5||s.spCost!==0||!same(s.bb,{hit_duration:10,hp_ratio:.05})||Object.keys(s.bbStr).length
    ||root?._modes.length!==1||root._commonAbilities.length||mode?._generalAbilities.length
    ||wrapper?._familyMask!==3||wrapper._ignoreSilence!==0||wrapper._maxTriggerTime!==-1||wrapper._resetCdWaitFirstPeriod!==1
    ||attack?._projectileKey!=='projectile_enemy_lyengs'||attack._damageType!==2||attack._atkScale!==1||attack._activeBuffs.length
    ||attack._waitForAttackEvent!==1||attack._timeMode!==0||attack._animKey!=='Attack'||attack._extraProjectileKeys.length
    ||n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID!==clock.source.skeletonDataPathId
    ||clock.events.Attack?.length!==1||clock.events.Attack[0].name!=='OnAttack')return false;
  if(cast?._projectileKey!=='projectile_enemy_lyengs_charge'||cast._waitForAttackEvent!==0||cast._selectTargetSource!==1||cast._selectTargetTiming!==1
    ||cast._waitForProjectileInvalid!==1||cast._notClearProjectileWhenCastEnd!==0||cast._affectedBySlowDown!==0||cast._atkScale!==0
    ||cast._minPostDelayWhenProjectileInvalid!==Math.fround(.667)||cast._preDelay!==0||cast._activeBuffs.length!==1
    ||selector?._targetSide!==1||selector._targetCategory!==1||selector._targetMotion!==1||selector._postFilter!==11
    ||selector._buffKey!=='lypa[car_mark]'||selector._buffKeyExcluded!==0||selector._ignoreTargetFree!==1||selector._maxNum!==1
    ||selector._limitTargetNum!==1||selector._filerMaxHp!==1||selector._maxHpRatio!==1||selector._maxHpExcludeEqual!==1)return false;
  const buff=cast._activeBuffs[0],actions=n.$template('enemy_lyengs[modify_hp]')?.eventToActions.ON_BUFF_START;
  if(buff.templateKey!=='enemy_lyengs[modify_hp]'||buff.lifeTimeType!==0||buff.disableOverride!==1
    ||!same(buff.blackboard,[{key:'hp',value:1,valueStr:''},{key:'effect_duration',value:2,valueStr:''},{key:'effect_duration_2',value:1,valueStr:''}])
    ||actions?.length!==4||!same(actions[0],{$type:type('HealViaMaxHpRatio'),_healTarget:'TARGET',_getMaxHpFromTarget:false,_ignoreHealFree:false,_skipModifierEvent:false})
    ||actions[1]._buff?.templateKey!=='enemy_lyengs[interrupt_if_hp_full]'||actions[1]._buff.triggerInterval!==Math.fround(.2))return false;
  const full=n.$template('enemy_lyengs[interrupt_if_hp_full]')?.eventToActions.ON_BUFF_TRIGGER;
  if(full?.length!==3||full[0].$type!==type('FilterByTargetHpRatio')||full[0]._condType!=='GE'||full[0]._targetType!=='TARGET'
    ||full[1].$type!==type('InterruptEnemyAbility')||full[1]._enemyFrom!=='BUFF_SOURCE'||full[1]._resetCooldown!==false)return false;
  const beam=n.$projectile('projectile_enemy_lyengs_charge'),link=beam.find(c=>'_linkDuration'in c),move=beam.find(c=>'_speed'in c);
  const shot=n.$projectile('projectile_enemy_lyengs'),life=shot.find(c=>'_lifeTime'in c),motion=shot.find(c=>'_speed'in c);
  return link?._isSilenceable===1&&link._keepAlreadyHitTime===1&&link._keepHitTarget===1&&link._lifeTimeType===2
    &&link._maxHitTimes===-1&&link._actionController._detachAllBuffsWhenStopped===1&&link._actionController._dontAddBuffs===0
    &&move?._speed===10&&move._extendLenth===15&&motion?._speed===10&&motion._moveType===1
    &&life?._lifeTime===10&&life._stopWhenSourceInvalid===0&&life._maxHitNum===1;
}
export const POWER_ARMOR_ENGINEER_FEATURES={
  'skill:Charge':{matchesRecord:isEngineer,covers:powerArmorEngineerNative,nativeClaim:()=>({wrappers:1}),
    explains:/^Recovers the HP of inactive <R-Series Power Armors>$/,
    ability:{kind:'powerArmorEngineer',params:r=>({initial:r.skills[0].initCooldown,cooldown:r.skills[0].cooldown,
      duration:r.skills[0].bb.hit_duration,ratio:r.skills[0].bb.hp_ratio,recovery:Math.fround(.667),
      attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})},
    note:'Nearest damaged marked armour receives a travelling bounded repair link; common projectile transport handles normal attacks.'},
};
