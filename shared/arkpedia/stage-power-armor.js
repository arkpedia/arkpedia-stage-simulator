// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with {type:'json'};
import tables from '../../data/arkpedia-device-source.json' with {type:'json'};
import clocks from '../../data/arkpedia-dormant-power-armor-animations.json' with {type:'json'};
import {sameOutcomeValue as same,nativeKillLog,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
export const POWER_ARMOR_DEVICE_KEYS=Object.freeze(['trap_075_bgarmn','trap_076_bgarms','trap_077_rmtarmn','trap_078_rmtarms']);
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const zero=r=>r?.m_PathID==='0';
export function powerArmorDeviceNativeReviewed(id,n=native){
  if(!POWER_ARMOR_DEVICE_KEYS.includes(id))return false;
  const parts=n.prefabs[id]?.components??[],by=new Map(parts.map(c=>[c.pathId,c.data])),get=r=>r?.m_FileID===0?by.get(r.m_PathID):null;
  const root=parts.find(c=>c.object===id)?.data,mode=get(root?._modes?.[0]);
  const aura=parts.find(c=>c.data.m_Script.m_PathID==='9073738633337710967')?.data;
  const selector=get(aura?._selector),validator=get(aura?._targetValidator),contact=aura?._buffs?.[0];
  const graphic=parts.find(c=>c.object==='Graphic')?.data,spine=get(graphic?._skeleton),clock=clocks.enemies[id];
  if(root?._sideType!==2||root._category!==1||root._blockMode!==0||root._occupiedRemainingCharacterCnt!==0
    ||root._withdrawable!==0||root._modes.length!==1||root._commonAbilities.length||!zero(root._traitAbility)
    ||root._customInitHpRatio!==0||root._isInfinity!==0||root._filterTag.length||root._rewriteTileOptions!==1
    ||mode?._generalAbilities.length||!zero(mode._combat)||mode._tileOptions.buildableType!==0||mode._keepCurrentPassableMask!==1
    ||spine?.skeletonDataAsset.m_PathID!==clock.source.skeletonDataPathId
    ||!graphic._animations.some(a=>a.animKey==='Start'&&a.animName==='Start'&&a.speed===1&&a.loop===0)
    ||clock.durations.Start!==(id.includes('rmtarm')?Math.fround(5/3):1)
    ||!same(clock.events.Start,[{time:id.includes('rmtarm')?0:Math.fround(1/6),name:'OnStart',int:0,float:0,string:''}]))return false;
  if(!aura||aura._buffs.length!==1||aura._passiveBuffs.length!==2||aura._removeBuffWhenTargetLeave!==1
    ||aura._removeBuffWhenAbilityDetached!==1||aura._onlyAddBuffOnceForEachTarget!==0
    ||selector?._targetSide!==1||selector._targetMotion!==3||selector._targetCategory!==1||selector._postFilter!==4
    ||selector._limitTargetNum!==0||selector._excludeOwner!==1||selector._ignoreTargetFree!==0||selector._ignoreHitRange!==0
    ||validator?._excludeKey!==0||validator._filterBuffSource!==0||!same(validator._buffs,['lypa[driver_mark]'])
    ||validator._targetOptions.targetSide!==1||validator._targetOptions.targetMotion!==3||validator._targetOptions.targetCategory!==1
    ||!passiveOutcomeBuff({...contact,blackboard:[]})||contact.templateKey!=='trap_bgarmn[instant_kill_driver]'
    ||!same(contact.blackboard,[{key:'effect_duration',value:3,valueStr:''},{key:'sp_ratio',value:1,valueStr:''}]))return false;
  const [mark,log]=aura._passiveBuffs;
  if(!same(mark.attributes.abnormalImmunes,id==='trap_076_bgarms'?[0,16,25,12]:[])
    ||!same(mark.attributes.abnormalComboImmunes,id==='trap_076_bgarms'?[0]:[])
    ||!passiveOutcomeBuff({...mark,attributes:{...mark.attributes,abnormalImmunes:[],abnormalComboImmunes:[]}})||mark.buffKey!=='lypa[car_mark]'||mark.templateKey!=='immune_common'||mark.blackboard.length
    ||!passiveOutcomeBuff(log)||log.templateKey!=='log_killed'||log.blackboard.length||!nativeKillLog({$template:k=>n.templates[k]}))return false;
  const consume=n.templates['trap_bgarmn[instant_kill_driver]']?.eventToActions.ON_BUFF_START;
  const charge=consume?.[0],marked=charge?._succeedNodes?.[0],kill=marked?._succeedNodes?.[0];
  if(consume?.length!==1||charge.$type!==type('IfElse')||charge._failNodes!==null
    ||!same(charge._conditionNode,{$type:type('FilterByTargetSpRatio'),_targetType:'BUFF_SOURCE',_condType:'LT',_spRatio:0})
    ||charge._succeedNodes.length!==1||marked.$type!==type('IfElse')||marked._failNodes!==null
    ||marked._conditionNode?.$type!==type('CheckContainsBuff')||marked._conditionNode._targetType!=='BUFF_SOURCE'
    ||!same(marked._conditionNode._buffKeys,['lypa[car_mark]'])||marked._succeedNodes.length!==3
    ||!same(kill,{$type:type('InstantKill'),_targetType:'TARGET',_killSource:false,_noSource:false,_withdrawIfRallyPoint:false,
      _resultIfInRallyPointMode:false,_skipReborn:false,_noReason:false,_markReachExit:false,_switchState:false}))return false;
  const skillKey=tables.devices[id].skills[0].skillId,skill=tables.skills[skillKey].levels[0];
  const skills=n.prefabs[skill.prefabId]?.components.map(c=>c.data)??[],cast=skills.find(c=>c.m_Script.m_PathID==='2165892974539515790');
  const wrapper=skills.find(c=>c.m_Script.m_PathID==='6851783972288338031'),passive=skills.find(c=>c.m_Script.m_PathID==='1339719624887862345');
  if(skill.skillType!=='AUTO'||skill.spData.spCost!==100||skill.spData.initSp!==0||skill.spData.increment!==0
    ||skill.spData.spType!=='INCREASE_WITH_TIME'||skill.blackboard.length||skill.duration!==0
    ||wrapper?._allowNoTarget!==1||wrapper._canSilenced!==0||wrapper._extraAbilities.length
    ||cast?._animKey!=='Start'||cast._timeMode!==1||cast._preDelay!==0||cast._affectedBySlowDown!==0
    ||cast._actions.SerializedState!=='[]'||cast._activeBuffs.length||passive?._buffs.length!==2
    ||passive._buffs.some((b,i)=>!passiveOutcomeBuff({...b,blackboard:[]})||b.templateKey!==['trap_bgarmn[summon_enemy]','trap_bgarmn[finish_find_driver]'][i]))return false;
  const finish=n.templates['trap_bgarmn[summon_enemy]']?.eventToActions.ON_BUFF_FINISH,[alive,summon,logActivation,withdraw]=finish??[];
  if(finish?.length!==4||alive.$type!==type('IfTarget')||alive._targetType!=='BUFF_OWNER'||!alive._checkTargetAlive
    ||summon.$type!==type('SummonEnemiesFollowBranchRoute')||summon._unharmful||!summon._managedByScheduler||!summon._alwaysCountAsKilled
    ||summon._overrideEnemyKey||summon._setHostUid||summon._summonAllRoute||summon._defaultBranchId
    ||summon._buffToEnemy?.templateKey!=='trap_bgarmn[sync_hp_from_trap]'
    ||logActivation.$type!==type('LogExtraBattleInfo')||logActivation._key!=='actived_bell'||logActivation._additionValue!==1
    ||withdraw.$type!==type('Withdraw')||!withdraw._withdrawSource||!withdraw._force||withdraw._switchToDeadState||withdraw._needLog)return false;
  const stop=n.templates['trap_bgarmn[finish_find_driver]']?.eventToActions.ON_BUFF_START;
  const immunity=n.templates.immune_common?.eventToActions,derived=immunity?.ON_BUFF_START?.[0]?._buff;
  return stop?.length===1&&stop[0].$type===type('FinishBuffsById')&&stop[0]._buffKey==='lypa[car_mark]'
    &&stop[0]._targetType==='BUFF_OWNER'&&!stop[0]._loadFromBlackboard
    &&same(derived?.attributes.abnormalImmunes,['STUNNED','FROZEN','SILENCED','LEVITATE'])
    &&same(derived?.attributes.abnormalComboImmunes,['SLEEPING'])&&immunity.ON_BUFF_FINISH?.[0]?._buffKey===derived.buffKey
    &&same(n.templates['trap_bgarmn[sync_hp_from_trap]']?.eventToActions,{ON_BUFF_START:[{$type:type('EqualizeTargetHpRatio'),
      _source:'SOURCE',_target:'TARGET',_useSourceHpRatio:true,_hpRatio:.5,_skipModifierEvent:true}]});
}
export function powerArmorDeviceDefinition(id,instance){
  if(!powerArmorDeviceNativeReviewed(id)||!Number.isSafeInteger(instance?.level)||instance.level<1||instance.level>30
    ||instance.skillLevel!==1||typeof instance.branchId!=='string'||!instance.branchId||!Number.isSafeInteger(instance.actionIndex)||instance.actionIndex<0)
    throw Error(`Unsupported dormant Power Armor: ${id}`);
  const record=tables.devices[id],frames=record.phases[0].attributesKeyFrames,a=frames[0],z=frames.at(-1);
  const t=(instance.level-a.level)/(z.level-a.level),value=k=>Math.round(a.data[k]+(z.data[k]-a.data[k])*t);
  const talent=record.talents[0]?.candidates;
  if(talent?.length!==1||talent[0].prefabKey!=='1'||!same(talent[0].blackboard,[{key:'range_radius',value:1,valueStr:null}]))throw Error('Unsupported driver contact range');
  return {hp:value('maxHp'),atk:value('atk'),def:value('def'),res:value('magicResistance'),block:value('blockCnt'),taunt:value('tauntLevel'),
    branchId:instance.branchId,actionIndex:instance.actionIndex,radius:1,spCost:100,duration:clocks.enemies[id].durations.Start};
}
