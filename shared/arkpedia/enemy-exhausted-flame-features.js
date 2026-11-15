// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const zero=r=>r?.m_FileID===0&&r.m_PathID==='0';
const node=(a,k)=>a?.$type===`Torappu.Battle.Action.Nodes+${k}, Assembly-CSharp`;
export const isExhaustedFlame=r=>['enemy_1294_duchns','enemy_1294_duchns_2'].includes(r.key)&&r.prefabKey==='enemy_1294_duchns';
const buff=b=>b&&!b.loadFromDB&&!b.isSilenceable&&!b.isStunnable&&!b.isFreezable&&!b.isLevitatable&&!b.isGroundBoundable&&!b.isDamageMissable&&b.lifeTimeType===2&&b.maxStackCnt===1&&!b.blackboard.length;
export function exhaustedFlameNative(r,n){
 if(!isExhaustedFlame(r)||r.applyWay!=='NONE'||r.stats.dmgType!=='none'||r.stats.motion!=='WALK'||r.skills.length||r.sp
   ||!same(r.talents,{bb:{'Bleed.hp_ratio':.05,'Boom.ep_damage_ratio':1.25},bbStr:{'Boom.range_id':'x-5'},groups:{Bleed:['hp_ratio'],Boom:['ep_damage_ratio','range_id']}}))return false;
 const root=n[r.prefabKey]?.[0],mode=n.$ref(root?._modes?.[0]),aura=n.Aura?.[0],mark=n.Mark?.[0];
 const bleed=n.Bleed?.[0]?._buffs?.[0],boom=n.Boom?.[0]?._buffs?.[0],binding=aura?._buffs?.[0],validator=n.$ref(aura?._targetValidator);
 if(root?._modes.length!==1||root._commonAbilities.length!==2||!zero(root._animator)||mode?._generalAbilities.length||!zero(mode._attack)||!zero(mode._combat)
  ||!same(root._commonAbilities.map(n.$ref),[aura,mark])||mark?._buffs.length!==1||mark._buffs[0].buffKey!=='enemy_duchns_mark'||mark._buffs[0].templateKey!=='empty'
  ||!buff(bleed)||bleed.templateKey!=='enemy_duchns_pericdic_damage'||bleed.triggerInterval!==1||bleed.triggerLifeType!==2||bleed.waitFirstTriggerInterval!==1
  ||!buff(boom)||boom.templateKey!=='enemy_duchns_boom'||!same(bleed.attributes.abnormalFlags,[8,13])||!same(boom.attributes.abnormalFlags,[8,13])
  ||!same(bleed.attributes.abnormalAntis,[25,0,12,23,16])||!same(boom.attributes.abnormalAntis,[25,0,12,23,16])
  ||aura._buffs.length!==1||!buff(binding)||binding.templateKey!=='enemy_duchns_kill_source'||!same(binding.attributes.abnormalFlags,[11,24])
  ||aura._removeBuffWhenAbilityDetached!==1||aura._removeBuffWhenTargetLeave!==1||aura._selfOption!==0||aura._passiveBuffs.length
  ||validator?._targetOptions.ignoreTargetFree!==1||validator._targetOptions.targetSide!==2||validator._targetOptions.targetCategory!==1||validator._targetOptions.targetMotion!==3
  ||validator._targetOptions.professionMask!==767||!n.$siblings(aura).some(c=>c._rangeId==='0-1'&&c._extendable===0&&c._useBlackboardRangeId===0))return false;
 const hp=n.$template(bleed.templateKey)?.eventToActions,death=n.$template(boom.templateKey)?.eventToActions,link=n.$template(binding.templateKey)?.eventToActions;
 const drain=hp?.ON_BUFF_TRIGGER?.[0],kill=link?.ON_BUFF_FINISH?.[0],start=hp?.ON_BUFF_START,bindStart=link?.ON_BUFF_START;
 const check=a=>node(a,'CheckTargetRootTile')&&a._targetType==='BUFF_OWNER'&&a._hasCharacter&&!a._hasCertainEnemy&&!a._checkTileKey;
 if(hp?.ON_BUFF_TRIGGER?.length!==1||!node(drain,'DamageViaMaxHpRatio')||drain._targetType!=='TARGET'||drain._getMaxHpFromTarget||drain._damageType!=='PURE'
  ||drain._applyWay!=='NONE'||!drain._ignoreForSp||!drain._skipModifierEvent||drain._isUndeadable||drain._multiplyByKey
  ||start?.length!==3||!check(start[0])||!node(start[1],'IfNot')||!node(start[2],'InstantKill')||start[2]._killSource
  ||link?.ON_BUFF_FINISH?.length!==1||!node(kill,'InstantKill')||!kill._killSource||kill._noReason||kill._markReachExit
  ||bindStart?.length!==3||!check(bindStart[0])||!node(bindStart[1],'IfNot')||!node(bindStart[2],'FinishBuff'))return false;
 const actions=death?.ON_OWNER_KILLED;
 if(!same(Object.keys(death??{}),['ON_OWNER_KILLED'])||actions?.length!==2||!node(actions[0],'AOEDamage')||!node(actions[1],'AOEElementDamage'))return false;
 for(const a of actions)if(a._sourceType!=='BUFF_OWNER'||a._targetType!=='BUFF_OWNER'||a._useRadius||a._rangeId!==null||a._excludeTarget
  ||a._targetOptions.targetSide!=='ENEMY'||a._targetOptions.targetMotion!=='ALL'||a._targetOptions.targetCategory!=='DEFAULT'||a._targetOptions.ignoreTargetFree)return false;
 return actions[0]._damageType==='MAGICAL'&&actions[0]._sourceApplyWay==='MELEE'&&actions[0]._attackType==='SPLASH'&&!actions[0]._isNoSourceDamage
  &&!actions[0]._useDamageFromBB&&actions[0]._damageScale===null&&actions[1]._elementDamageType==='FIRE'&&!actions[1]._isFixedEpDamage
  &&same(n.$range('x-5')?.grids,[{row:1,col:0},{row:0,col:-1},{row:0,col:0},{row:0,col:1},{row:-1,col:0}]);
}
export const EXHAUSTED_FLAME_ABILITY={kind:'exhaustedFlame',params:r=>({hpRatio:r.talents.bb['Bleed.hp_ratio'],elementRatio:r.talents.bb['Boom.ep_damage_ratio']})};
