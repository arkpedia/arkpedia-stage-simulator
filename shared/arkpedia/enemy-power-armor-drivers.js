// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-power-armor-driver-animations.json' with {type:'json'};
import { sameOutcomeValue as same, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
export const isPowerArmorDriver = r => /^enemy_(?:1251_lysyta|1252_lysytb|1253_lysytc)(?:_2)?$/.test(r.prefabKey);
const zero = r => r?.m_FileID===0 && r.m_PathID==='0';
const type = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export function powerArmorDriverNative(r,n) {
  if(!isPowerArmorDriver(r)||r.key!==r.prefabKey||r.stats.motion!=='WALK'||r.sp||r.skills.length)return false;
  const bionic=r.prefabKey.includes('lysytc'), family=bionic?'lysytc':r.prefabKey.includes('lysytb')?'lysytb':'lysyta';
  const ranged=family==='lysytb';
  if(r.applyWay!==(ranged?'RANGED':'MELEE')||r.stats.dmgType!==(bionic?'arts':'phys'))return false;
  const expected={bb:{'Driver.sp':bionic?100:50,...(bionic?{'DamageReduce.damage_resistance':.5}:{})},bbStr:{},groups:{Driver:['sp'],...(bionic?{DamageReduce:['damage_resistance']}:{})}};
  if(!same(r.talents,expected))return false;
  const root=n[r.prefabKey]?.[0],mode=n.$ref(root?._modes?.[0]),combat=n.$ref(mode?._combat),driver=n.Driver?.[0];
  if(root?._modes.length!==1||root._commonAbilities.length||mode?._generalAbilities.length||!ranged&&(!zero(mode._attack)||!zero(mode._attackTrigger))
    ||combat?._damageType!==(bionic?2:1)||combat._attackType!==1||combat._atkScale!==1||combat._activeBuffs.length||!zero(combat._selector)
    ||combat._epDamageRatio!==0||combat._selectTargetSource!==2||combat._selectTargetTiming!==0||combat._animKey!=='Attack'
    ||driver?.m_Script.m_PathID!=='3800760148018415462'||!zero(driver._selector)||driver._buffs.length!==2)return false;
  if(ranged){
    const a=n.$ref(mode._attack),trigger=n.$ref(mode._attackTrigger);
    if(a?.m_Script.m_PathID!=='4156651312234227407'||a._damageType!==1||a._attackType!==1||a._atkScale!==1
      ||a._projectileKey!=='projectile_enemy_magic_ball'||a._activeBuffs.length||a._extraProjectileKeys.length
      ||!zero(a._selector)||a._selectTargetSource!==2||a._selectTargetTiming!==0||a._epDamageRatio!==0
      ||a._animKey!=='Attack'||a._preDelay!==0||a._useCachedAtkOnly!==0||trigger?._minTargetNum!==1)return false;
  }
  const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root._animator);
  if(n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID!==clock?.source.skeletonDataPathId)return false;
  const attacking=ranged?n.$ref(mode._attack):combat;
  if(attacking._waitForAttackEvent!==1||attacking._timeMode!==0||attacking._affectedBySlowDown!==1
    ||attacking._preDelay!==0||clock.events.Attack.length!==1||clock.events.Attack[0].name!=='OnAttack')return false;
  if(ranged){
    const parts=n.$projectile('projectile_enemy_magic_ball'),motion=parts.find(c=>'_speed'in c),life=parts.find(c=>'_lifeTime'in c);
    if(motion?.m_Script.m_PathID!=='-1429203677512073985'||motion._speed!==10||motion._moveType!==1
      ||motion._flyToTargetLocationOnly!==0||motion._forceReachedWhenTimeup!==1||motion._delayToStart!==0||motion._deltaSpeedPerSec!==0
      ||life?._lifeTime!==10||life._stopWhenSourceInvalid!==0||life._maxHitNum!==1||life._hitNumType!==1
      ||life._alwaysHitTraceTargetInTheEnd!==1||life._canHitSameTargetMultipleTimes!==0
      ||life._actionController._dontAddBuffs!==0||life._actionController._extraBuffsInTheEnd.length)return false;
  }
  const [mark,charge]=driver._buffs;
  if(!passiveOutcomeBuff(mark)||mark.buffKey!=='lypa[driver_mark]'||mark.templateKey!=='empty'||mark.blackboard.length
    ||!passiveOutcomeBuff(charge)||charge.templateKey!==`enemy_${family}[sp_to_car]`||charge.blackboard.length
    ||!same(n.$template('empty')?.eventToActions,{}))return false;
  return same(n.$template(charge.templateKey)?.eventToActions,{ON_OWNER_KILLED_BY_MAIN_TARGET:[
    {$type:type('CheckContainsBuff'),_targetType:'MAIN_TARGET',_buffKeys:['lypa[car_mark]'],isAND:true,
      _loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false},
    {$type:type('ModifySp'),_targetType:'MAIN_TARGET',_modifyByRatio:false,_modifyRatio:0,_modifyByRatioBasedOnCurSP:false,
      _dontCheckSpType:false,_spMask:'ALL',_forceFlag:false,_dontShowSpUI:false,_modifyValue:0,_spString:'sp',_isMinis:false},
    {$type:type('CreateEffect'),_targetType:'BUFF_OWNER',_sourceType:'BUFF_SOURCE',_effectKey:`enemy_${family}_die`,
      _useSourceFaceVactor:false,_useSourceToTargetDirection:false,_useAttackPlaybackSpeed:false},
  ]});
}
export function bionicProtectionNative(r,n) {
  if(!r.prefabKey.includes('lysytc')||!powerArmorDriverNative(r,n))return false;
  const ability=n.DamageReduce?.[0],buff=ability?._buffs?.[0],events=n.$template('enemy_lysytc[toggle_damage_resistance]')?.eventToActions;
  const check=events?.ON_OWNER_BLOCKEE_CHANGED?.[0],unblocked=check?._failNodes?.[0],create=events?.ON_BUFF_START?.[0];
  const child=create?._buff;
  if(ability?.m_Script.m_PathID!=='3800760148018415462'||!zero(ability._selector)||ability._buffs.length!==1
    ||!passiveOutcomeBuff(buff)||buff.templateKey!=='enemy_lysytc[toggle_damage_resistance]'||buff.blackboard.length
    ||Object.keys(events??{}).sort().join()!=='ON_BUFF_START,ON_OWNER_BLOCKEE_CHANGED'
    ||events.ON_OWNER_BLOCKEE_CHANGED.length!==1||events.ON_BUFF_START.length!==1
    ||check.$type!==type('IfElse')||check._conditionNode?.$type!==type('CheckBlocked')||check._conditionNode._targetType!=='BUFF_OWNER'
    ||check._conditionNode._checkBlockedBySource||check._conditionNode._checkBlockedBySourceToken||check._conditionNode._checkBlockedCount
    ||check._succeedNodes?.length!==1||check._succeedNodes[0].$type!==type('FinishBuffsById')
    ||check._succeedNodes[0]._buffKey!=='lysytc[damage_resistance]'||check._succeedNodes[0]._targetType!=='BUFF_OWNER'
    ||check._failNodes?.length!==1||unblocked.$type!==type('IfElse')||unblocked._conditionNode?.$type!==type('CheckContainsBuff')
    ||unblocked._conditionNode._targetType!=='BUFF_OWNER'||!same(unblocked._conditionNode._buffKeys,['lysytc[damage_reduce]'])
    ||unblocked._succeedNodes!==null||unblocked._failNodes?.length!==1||!same(unblocked._failNodes[0],create)
    ||create.$type!==type('CreateBuff')||create._buffOwner!=='BUFF_OWNER'||create._isDerivedBuff
    ||child?.templateKey!=='damage_resistance'||child.buffKey!=='lysytc[damage_resistance]'
    ||child.lifeTimeType!=='INFINITY'||child.isSilenceable||child.isStunnable||child.isFreezable
    ||child.blackboard.length||Object.values(child.attributes).some(a=>a.length))return false;
  return same(n.$template('damage_resistance')?.eventToActions,{ON_TAKE_DAMAGE:[{$type:type('DamageScale'),
    _filterDamageType:true,_damageMask:'PHYSICAL_AND_MAGICAL',_filterApplyWay:false,_applyWayFilter:'NONE',_isOneMinus:true,
    _isStackable:false,_isValidStackCnt:false,_cachedDeltaValueToBBKey:'',_customKey:''}]});
}
export const POWER_ARMOR_DRIVER_FEATURES = {
  'talent:Driver': {matchesRecord:isPowerArmorDriver,covers:powerArmorDriverNative,
    ability:{kind:'powerArmorDriver',params:r=>({sp:r.talents.bb['Driver.sp'],ranged:r.applyWay==='RANGED',attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})},
    explains:/^When touching an inactive <R-Series Power Armor>, the Power Armor recovers (some|a lot of) SP$/,
    note:'A marked dormant Power Armor killer receives the source SP amount; other deaths do not charge a device.'},
  'talent:DamageReduce': {matchesRecord:r=>isPowerArmorDriver(r)&&r.prefabKey.includes('lysytc'),covers:bionicProtectionNative,
    ability:{kind:'unblockedSanctuary',params:r=>({reduction:r.talents.bb['DamageReduce.damage_resistance']})},
    explains:/^When not blocked, Physical and Arts damage taken is significantly reduced$/,
    note:'Bionic drivers use the common strongest Sanctuary channel until blocked.'},
};
