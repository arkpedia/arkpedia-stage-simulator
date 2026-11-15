// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-jesselton-animations.json' with { type: 'json' };
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const action = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
export const isJesselton = r => r.prefabKey === 'enemy_1516_jakill';
// Pinned base-level parameters; level one supplies only enhance.atk=800.
// This reviewed prefab uses the base parameters with that selected override.
const defaults = { 'reborn.sp': -1, 'reborn.duration': 4, 'enhance.magic_resistance': 50, 'enhance.atk': 700,
  'enhance.def': 1000, 'enhance.base_attack_time': -1.5, 'enhance.move_speed': .3 };
const component = (n, key, field) => n[key]?.find(x => field in x);
const attributes = types => types.map(attributeType => ({ attributeType, formulaItem: 0, value: 0,
  loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 }));
export function jesseltonNative(r,n) {
  const c=clocks.enemies[r.prefabKey],root=n[r.prefabKey]?.[0];
  if(!isJesselton(r)||!c||![0,1].includes(r.level)||r.applyWay!=='ALL'||r.stats.dmgType!=='phys'
    ||!same(r.talents.bb,r.level?{'enhance.atk':800}:defaults)||r.skills.length!==2
    ||!same(r.sp,{type:'INCREASE_WHEN_ATTACK',maxSp:3,initSp:0,increment:1})
    ||root?._modes.length!==2||root._commonAbilities.length) return false;
  const modes=root._modes.map(n.$ref),shot=n.$ref(modes[0]._attack),melee=n.$ref(modes[1]._combat);
  if(!fields(shot,{_projectileKey:'projectile_enemy_jakill',_animKey:'Attack',_damageType:2,_atkScale:1,_useCachedAtkOnly:0,
    _timeMode:0,_waitForAttackEvent:1,_interruptAbilityOnDetach:0,_selectTargetSource:2,_activeBuffs:[]})
    ||!fields(melee,{_animKey:'Attack',_damageType:1,_atkScale:1,_timeMode:0,_waitForAttackEvent:1,_activeBuffs:[]})
    ||modes[0]._generalAbilities.length||modes[1]._generalAbilities.length!==1)return false;
  const selector=n.$siblings(n.$ref(modes[0]._attackTrigger)).find(x=>'_targetSide'in x);
  if(!fields(selector,{_targetSide:2,_targetMotion:1,_targetCategory:1,_filterTag:'prison',_tagExcluded:1,
    _ignoreTargetFree:0,_forceIgnoreCamouflage:0,_maxNum:1}))return false;
  for(const[i,name]of['IronSandStorm','ArmorPiercing'].entries()){
    const sk=r.skills[i],cast=component(n,name,'_animKey'),wrapper=component(n,name,'_familyMask');
    if(!fields(sk,{prefabKey:i?'armorpiercing':'ironsandstorm',priority:0,cooldown:0,initCooldown:0,spCost:3})
      ||!same(sk.bb,i?{times:2,def_penetrate:.6}:{stun:3,max_target:2})
      ||!fields(wrapper,{_familyMask:3,_ignoreSilence:0,_castLikeAttack:0,_maxTriggerTime:-1})
      ||!fields(cast,{_animKey:i?'C2_Skill':'C1_Skill',_waitForAttackEvent:1,_timeMode:0,_atkScale:1,
        _damageType:i?1:2,_affectedBySlowDown:1,_interruptAbilityOnDetach:0}))return false;
    if(i){
      const buff=n.$siblings(cast).find(x=>x._buffs?.[0]?.buffKey==='jakill_s_2')?._buffs[0];
      if(!fields(cast,{_additionalTimes:1,_triggerDelta:Math.fround(.2),_waitAttackEventForAllAttacks:0,
        _refreshInputTargetOnCheckSpell:0,_onlyFeedActiveBuffToLastOne:1})
        ||!same(buff?.attributes.attributeModifiers,attributes([17]))||buff.templateKey!=='empty'
        ||cast._activeBuffs.length!==1||cast._activeBuffs[0].templateKey!=='jakill_skill_1_reborn_hit')return false;
    }else{
      const s=n.$siblings(n.$ref(cast._selector)).find(x=>'_targetSide'in x);
      if(cast._projectileKey!=='projectile_enemy_jakill_s1'||cast._activeBuffs.length!==1
        ||!fields(cast._activeBuffs[0],{buffKey:'stun',loadFromDB:1,isDamageMissable:0})
        ||!fields(s,{_targetSide:2,_targetMotion:1,_filterTag:'prison',_tagExcluded:1,_maxTargetKey:'max_target',_limitTargetNum:1}))return false;
    }
  }
  const buffs=n.Enhance?.filter(x=>x._buffs).map(x=>x._buffs).sort((a,b)=>a.length-b.length);
  if(buffs?.length!==2||buffs[0].length!==1||buffs[1].length!==3
    ||!same(buffs[0][0].attributes.attributeModifiers,attributes([3]))
    ||!same(buffs[1][0].attributes.attributeModifiers,attributes([1,2,8,6])))return false;
  const reborn=n.$siblings(n.Reborn?.[0]).find(x=>'_maxRespawnCnt'in x);
  if(!fields(reborn,{_maxRespawnCnt:1,_modeIndex:1,_hpRechargeRatio:1,_keepAlive:0,_rebornAfterWave:0,
    _buffsRetainedWhenReborn:[],_useAbilityToHandle:0})||reborn._buffs[0]?.templateKey!=='jakill_reborn')return false;
  const reset=n.$template('jakill_reborn')?.eventToActions.ON_BUFF_START;
  if(reset?.length!==2||!action(reset[0],'ModifySp')||reset[0]._spString!=='sp'
    ||!action(reset[1],'SwitchMode')||!fields(reset[1],{_modeIndex:1,_loadModeFromBlackboard:true,_restartFSM:true}))return false;
  const hitEffect=n.$template('jakill_skill_1_reborn_hit')?.eventToActions.ON_BUFF_START;
  if(hitEffect?.length!==1||!action(hitEffect[0],'CreateEffect'))return false;
  const animator=n.$ref(root._animator);
  if(!['Move','Idle','Attack','Default'].every(key=>animator?._animations.some(x=>x.animKey===key&&x.animName===`C1_${key}`))
    ||!animator._animations.some(x=>x.animKey==='Reborn'&&x.animName==='C1_Die'))return false;
  const hook=n.$siblings(n.$ref(modes[1]._animatorHooker)).find(x=>'_replaceAnimPairs'in x);
  if(!same(hook?._replaceAnimPairs,['Default','Idle','Attack','Move'].map(fromAnimKey=>({fromAnimKey,toAnimKey:`C2_${fromAnimKey}`}))))return false;
  const release=n.$ref(modes[1]._generalAbilities[0]),s=n.$siblings(n.$ref(release?._selector));
  if(!fields(release,{_metadata:{blackboardPrefix:'',namedAsAlias:'libertyothers'},_allowNoTarget:1,_timeMode:2,
    _waitForAttackEvent:0,_affectedBySlowDown:0})||release._activeBuffs[0]?.templateKey!=='enemy_liberty_force'
    ||!s.some(x=>fields(x,{_targetSide:1,_targetMotion:3,_excludeOwner:1,_limitTargetNum:0,_ignoreTargetFree:0,_ignoreAllyTargetFree:0}))
    ||!s.some(x=>x.m_Script.m_PathID==='6275044311115013764'))return false;
  const trigger=n.Liberty?.find(x=>x._buffs)?._buffs[0],triggerActions=n.$template('jakill_trigger_ability')?.eventToActions.ON_BUFF_START;
  const force=n.$template('enemy_liberty_force')?.eventToActions.ON_BUFF_START;
  if(trigger?.templateKey!=='jakill_trigger_ability'||!same(trigger.blackboard,[{key:'ability_name',value:0,valueStr:'libertyothers'}])
    ||triggerActions?.length!==1||!action(triggerActions[0],'TriggerAbility')||triggerActions[0]._checkCanUseAblityFlag!==false
    ||force?.length!==3||!action(force[2],'SwitchMode')||!fields(force[2],{_modeIndex:2,_restartFSM:true}))return false;
  for(const key of ['projectile_enemy_jakill','projectile_enemy_jakill_s1']){
    const parts=n.$projectile(key);
    if(!parts.some(x=>x._speed===10&&x._useSourceDirection===0)
      ||!parts.some(x=>x._lifeTime===10&&x._stopWhenSourceInvalid===0&&x._stopAfterMaxHit===1))return false;
  }
  return n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID===c.source.skeletonDataPathId
    &&['C1_Attack','C1_Skill','C2_Attack','C2_Skill'].every((clip,i)=>same(c.events[clip],
      [{time:Math.fround([28/30,44/30,17/30,11/30][i]),name:'OnAttack',int:0,float:0,string:''}]));
}
export const JESSELTON_ABILITY={kind:'jesselton',params:r=>{
  const t={...defaults,...r.talents.bb},c=clocks.enemies[r.prefabKey];
  return {rebirth:t['reborn.duration'],res:t['enhance.magic_resistance'],atk:t['enhance.atk'],def:t['enhance.def'],
    bat:t['enhance.base_attack_time'],move:t['enhance.move_speed'],cost:r.sp.maxSp,initialSp:r.sp.initSp,increment:r.sp.increment,
    speed:10,lifetime:10,stun:r.skills[0].bb.stun,maxTargets:r.skills[0].bb.max_target,penetration:r.skills[1].bb.def_penetrate,
    animations:['C1_Attack','C1_Skill','C2_Attack','C2_Skill'].map((clip,i)=>({clip,duration:c.durations[clip],melee:i>1,skill:i%2===1,
      releases:[c.events[clip][0].time,...(i===3?[c.events[clip][0].time+Math.fround(.2)]:[])]}))};
}};

export const jesseltonExplains = text => [
  'Jailer Form', 'RES is greatly increased',
  'Attacks become ranged and deal Arts damage, and no longer attacks Imprisonment Devices',
  'Can <$ba.stun>Stun</> multiple targets', 'The first time HP drops to 0, enters Killer Form',
  'Killer Form', 'Frees all imprisoned enemies when entering Killer Form', 'Gains significantly increased DEF',
  "Uses melee Physical attacks that ignore a certain amount of the target's DEF",
].includes(text);
