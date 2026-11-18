// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes} from './enemy-outcome-contracts.js';
const id='enemy_1531_bbrain',node=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const fields=(value,expected)=>!!value&&Object.entries(expected).every(([k,v])=>same(value[k],v));
export function awakenDamageShareNative(r,n){
  if(r.key!==id||r.prefabKey!==id||!same(r.talents.groups.DamageSplit,['damage_resistance'])
    ||r.talents.bb['DamageSplit.damage_resistance']!==.5)return false;
  const root=n[id]?.[0],aura=n.Aura?.[0],binding=aura?._buffs?.[0],selector=n.$ref(aura?._selector),validator=n.$ref(aura?._targetValidator);
  if(!root?._commonAbilities.some(ref=>n.$ref(ref)===aura)||n.DamageSplit?.length!==2
    ||!fields(aura,{_selfOption:2,_removeBuffWhenAbilityDetached:1,_interval:0,_forceTick:0,_onlyDetactTargetWhenStarted:0,
      _excludeReborningEntity:0,_clearBuffsWhenDisappear:0,_passiveBuffs:[]})||aura._buffs.length!==1
    ||!fields(binding,{buffKey:'bbrain[buff_mark]',templateKey:'enemy_bbrain[buff_mark]',loadFromDB:0,isSilenceable:0,lifeTimeType:2})
    ||!fields(selector,{_targetSide:1,_targetCategory:1,_targetMotion:1,_limitTargetNum:0,_ignoreTargetFree:0,_postFilter:4})
    ||!fields(validator,{_buffs:['lypa[driver_mark]'],_excludeKey:0,_filterBuffSource:0,_hostAsTarget:0}))return false;
  for(const component of n.DamageSplit){
    const buff=component._buffs?.[0];
    if(component._buffs?.length!==1||!fields(buff,{buffKey:'bbrain[damage_split]',templateKey:'enemy_bbrain[damage_split]',
      lifeTimeType:2,isSilenceable:0,blackboard:[]})||!emptyOutcomeAttributes(buff.attributes))return false;
  }
  const share=n.$template('enemy_bbrain[damage_split]'),actions=share?.eventToActions?.ON_TAKE_DAMAGE;
  if(share?.onEventPriority!=='LOWER_PRIORITY'||actions?.length!==4
    ||!fields(actions[0],{$type:node('CheckIfDamageHasSharedFlags'),_sharedFlags:'INSTANT_KILL_LIKE_DAMAGE',_isUnset:true})
    ||!fields(actions[1],{$type:node('DamageSplitToBuffKeySources'),_targetType:'BUFF_OWNER',_attackType:'NORMAL',_buffKey:'mark_bbrain[damage_split_target]'})
    ||!fields(actions[2],{$type:node('DamageScale'),_isOneMinus:true,_filterDamageType:false,_filterApplyWay:false,_isStackable:false,_customKey:''}))return false;
  const events=n.$template(binding.templateKey)?.eventToActions,create=events?.ON_BUFF_START?.[0],cleanup=events?.ON_BUFF_FINISH?.[0];
  return events?.ON_BUFF_START?.length===2&&events?.ON_BUFF_FINISH?.length===2
    &&fields(create,{$type:node('CreateBuffUseTargetAsSource'),_buffOwner:'BUFF_SOURCE',_target:'TARGET',_isDerivedBuff:false})
    &&fields(create._buff,{buffKey:'mark_bbrain[damage_split_target]',templateKey:'empty',disableOverride:true,lifeTimeType:'INFINITY',blackboard:[]})
    &&fields(cleanup,{$type:node('FinishBuffsByIdByBuffSource'),_buffKey:'mark_bbrain[damage_split_target]',_targetType:'BUFF_SOURCE',_sourceType:'BUFF_OWNER',_alsoClearNullSource:true});
}
export const AWAKEN_DAMAGE_SHARE_FEATURE={
  matchesRecord:r=>r.key===id,covers:awakenDamageShareNative,
  explains:/^When 'Awaken' takes damage, transfers 50% of the damage received to Dorothy's other experiments on the field$/,
  ability:{kind:'markedEnemyDamageShare',params:r=>({ratio:r.talents.bb['DamageSplit.damage_resistance'],mark:'lypa[driver_mark]'})},
  note:'Independent global damage-sharing component; her phases and attacks are in enemy-awaken-boss-features.js.',
};
