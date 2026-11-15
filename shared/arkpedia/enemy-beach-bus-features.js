// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same,emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
export const isBeachBus=r=>['enemy_1263_durbus','enemy_1263_durbus_2'].includes(r.prefabKey);
export function beachBusNative(r,n){
  const root=n[r.prefabKey]?.[0],bus=n.Bus?.find(x=>'_randomOffsetBound'in x);
  if(!isBeachBus(r)||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.skills.length
    ||!same(r.talents.bb,{'Bus.max_cnt':3})||root?._modes.length!==1||root._commonAbilities.length||root._blockVolume!==3
    ||!fields(bus,{_randomOffsetBound:Math.fround(.2),_useHostRoute:1,_appearOnTileCenter:0,_passengerToNearestEndPoint:0,
      _passengerUseBranchRoute:0,_delayToReleasePassengers:0,_onlySearchPassengerInSpecifiedMode:0,_ignoreHost:0,
      _setToHostPosBeforeReassignRoute:0,_assignPassengerCountToBb:0,_buffsWhenCarryPassenger:[],_buffsToReleasedPassenger:[]})
    ||bus._passiveBuffs.length!==1||!fields(bus._passiveBuffs[0],{buffKey:'enemy_durbus_t[mark]',templateKey:'empty',
      lifeTimeType:2,isSilenceable:0})||!empty(bus._passiveBuffs[0].attributes))return false;
  const selector=n.$ref(bus._selector),geometry=n.$siblings(selector),validator=n.$ref(bus._targetValidator);
  if(!fields(selector,{_targetSide:1,_targetMotion:3,_targetCategory:1,_limitTargetNum:0,_excludeOwner:1,
    _tagExcluded:1,_filterTag:'machine',_buffKeyExcluded:1,_buffKey:'enemy_durbus_t[mark]',_ignoreTargetFree:0,_ignoreAllyTargetFree:0})
    ||!geometry.some(x=>x.m_Radius===.5&&same(x.m_Offset,{x:0,y:0}))
    ||!geometry.some(x=>same(x.m_LocalPosition,{x:0,y:0,z:0})&&same(x.m_LocalScale,{x:1,y:1,z:1}))
    ||!fields(validator,{_enemyLevelMask:3,_motionMask:1,_allowNoneApplyWay:1,_applyWay:3,_checkIsBlockedByOwner:0})
    ||!fields(validator._targetOptions,{targetSide:1,targetMotion:1,targetCategory:1,enableAdvancedOptions:1,
      ignoreTargetFree:0,ignoreAllyTargetFree:0,ignoreTargetSide:0}))return false;
  const mode=n.$ref(root._modes[0]),combat=n.$ref(mode?._combat);
  return mode?._generalAbilities.length===0&&fields(combat,{_animKey:'Attack',_damageType:1,_atkScale:1,
    _activeBuffs:[],_timeMode:0,_waitForAttackEvent:1});
}
export const BEACH_BUS_FEATURE={matchesRecord:isBeachBus,covers:beachBusNative,
  ability:{kind:'beachBus',params:r=>({capacity:r.talents.bb['Bus.max_cnt'],radius:.5,offset:Math.fround(.2)})},
  explains:/^When next to enemies that are both non-Machine and non-Leader, they will be loaded inside as passengers \(up to 3 max\), and will be unloaded when this unit is defeated$/};
