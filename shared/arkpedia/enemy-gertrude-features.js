// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-gertrude-animations.json' with {type:'json'};
const parent='enemy_1247_ltgtld',child='enemy_1248_ltholo',type=n=>`Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
const empty=o=>o&&Object.keys(o).length===0;
function clockMatches(n,id,keys){
 const root=n[id]?.find(c=>'_modes'in c),graphic=n.$ref(root?._animator),clock=clocks.enemies[id];
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
  &&keys.every(key=>graphic._animations.some(a=>a.animKey===key&&a.animName===key&&a.speed===1&&a.loop===0));
}
export function gertrudeNative(r,n){
 if(r.prefabKey!==parent||r.applyWay!=='RANGED'||r.stats.dmgType!=='arts'||r.skills.length!==1||r.sp||!empty(r.talents.bb)||!empty(r.talents.bbStr))return false;
 const s=r.skills[0],root=n[parent]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),attack=n.$ref(mode?._attack),target=n.$ref(attack?._selector);
 const wrapper=n.SummonShadow?.find(c=>'_familyMask'in c),cast=n.SummonShadow?.find(c=>'_actions'in c);
 const actions=JSON.parse(cast?._actions.SerializedState??'[]'),a=actions[0];
 const p=n.$projectile('projectile_enemy_ltgtld'),life=p.find(c=>'_lifeTime'in c),motion=p.find(c=>'_speed'in c);
 return s.prefabKey==='SummonShadow'&&s.initCooldown===10&&s.cooldown===10&&s.spCost===0
  &&JSON.stringify(s.bb)==='{"cnt":1}'&&JSON.stringify(s.bbStr)===`{"enemy_key":"${child}"}`
  &&root?._modes.length===1&&!root._commonAbilities.length&&root._delayToBorn===0&&!mode._generalAbilities.length&&mode._combat.m_PathID==='0'
  &&attack?._projectileKey==='projectile_enemy_ltgtld'&&attack._damageType===2&&attack._attackType===1&&attack._atkScale===1
  &&attack._waitForAttackEvent===1&&attack._timeMode===0&&attack._preDelay===0&&!attack._activeBuffs.length&&!attack._extraProjectileKeys.length
  &&target?._maxNum===2&&target._targetSide===2&&target._targetMotion===3&&target._targetCategory===1&&target._forceIgnoreCamouflage===0&&target._ignoreTargetFree===0
  &&wrapper?._familyMask===1&&wrapper._ignoreSilence===1&&wrapper._maxTriggerTime===-1&&wrapper._resetMainAbilityCdWhenCastEnd===0
  &&wrapper._immuneStunWhenAffecting===0&&wrapper._castLikeAttack===0&&wrapper._resetCdWaitFirstPeriod===1
  &&n.$ref(wrapper._trigger)?.m_Script.m_PathID==='-2995189732062982133'
  &&cast?._allowNoTarget===1&&cast._selector.m_PathID==='0'&&cast._timeMode===1&&cast._waitForAttackEvent===1
  &&cast._animKey==='Skill'&&cast._endAnimKey==='Idle'&&cast._preDelay===0&&cast._escapeTime===0&&cast._affectedBySlowDown===1&&!cast._activeBuffs.length
  &&actions.length===1&&a.$type==='Torappu.Battle.Action.Nodes+SummonEnemiesFollowMyRoute'&&a._source==='TARGET'
  &&a._enemyKey===null&&a._summonCount===0&&a._delayTime===0&&!a._managedByScheduler&&a._dontBlockWave
  &&!a._trySummonOutsideWhenInObstacle&&a._randomOffsetBound===0&&a._passableMask==='WALK_ONLY'&&a._onlySummonOneInTheSamePlace
  &&!a._useOffsetInBB&&a._offset.x===0&&a._offset.y===0&&a._useLocalUnharmfulFlag&&a._unharmful&&!a._useMapPosition
  &&!a._spawnOnHostRootTile&&!a._useTargetPosition&&!a._spawnOnMyRouteWithDistance&&!a._useRandomDelay&&!a._stopSummonIfHostDead&&!a._useOffsetForEach&&!a._addBuffToEnemy&&!a._skipCheckPoint
  &&life?._lifeTime===10&&life._maxHitNum===1&&life._stopWhenSourceInvalid===0&&!life._actionController._extraBuffsInTheEnd.length
  &&motion?._moveType===1&&motion._speed===10&&motion._delayToStart===0&&motion._forceReachedWhenTimeup===1
  &&clockMatches(n,parent,['Attack','Skill'])&&clocks.enemies[parent].events.Skill[0].name==='OnAttack';
}
export function gertrudeImageNative(r,n){
 if(r.prefabKey!==child||r.applyWay!=='NONE'||r.skills.length||r.sp||JSON.stringify(r.talents.bb)!=='{"Weak.value":500}'||!empty(r.talents.bbStr)
  ||r.stats.maxHp!==5000||r.stats.moveSpeed!==0||r.stats.tauntLevel!==1||r.stats.lpr!==0)return false;
 const root=n[child]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),weak=n.Weak?.find(c=>'_buffs'in c),buff=weak?._buffs[0];
 const events=n.$template('enemy_ltholo_t')?.eventToActions,enter=events?.ON_ENTER_MAGICCIRCUIT,leave=events?.ON_LEAVE_MAGICCIRCUIT;
 const dot=enter?.[0]?._buff,damage=n.$template('fixed_value_damage_ontrigger[pure]')?.eventToActions.ON_BUFF_TRIGGER;
 return root?._modes.length===1&&!root._commonAbilities.length&&root._delayToBorn===.5&&!mode._generalAbilities.length
  &&mode._attack.m_PathID==='0'&&mode._attackTrigger.m_PathID==='0'&&n.$ref(mode._combat)?.m_Script.m_PathID==='4865767822664548221'
  &&weak?._buffs.length===1&&buff.templateKey==='enemy_ltholo_t'&&buff.lifeTimeType===2&&buff.isSilenceable===1&&!buff.isStunnable&&!buff.isFreezable
  &&JSON.stringify(buff.attributes.abnormalFlags)==='[22]'&&!buff.attributes.attributeModifiers.length
  &&enter?.length===1&&enter[0].$type===type('CreateBuff')&&enter[0]._buffOwner==='BUFF_OWNER'&&enter[0]._isDerivedBuff
  &&dot?.templateKey==='fixed_value_damage_ontrigger[pure]'&&dot.triggerInterval===1&&dot.waitFirstTriggerInterval===false&&!dot.isSilenceable
  &&leave?.length===1&&leave[0].$type===type('FinishDerivedBuff')
  &&damage?.length===1&&damage[0].$type===type('FixedValueDamage')&&damage[0]._damageKey==='value'&&damage[0]._damageType==='PURE'
  &&damage[0]._ignoreForSp&&!damage[0]._isEnvDamage&&!damage[0]._noSourceDamage&&!damage[0]._multiplierByKey
  &&clockMatches(n,child,[])&&n.$ref(root._animator)._animations.some(a=>a.animKey==='Born'&&a.animName==='Start'&&a.speed===1&&!a.loop);
}
export const GERTRUDE_FEATURES={
 'skill:SummonShadow':{covers:gertrudeNative,nativeClaim:()=>({wrappers:1}),dependsOn:()=>[child],
  explains:/^Can create a <Virtual Image> at the current location$/,
  ability:{kind:'gertrude',params:r=>{const c=clocks.enemies[parent];return{child,initial:r.skills[0].initCooldown,cooldown:r.skills[0].cooldown,
   release:c.events.Skill[0].time,duration:c.durations.Skill,attackAnim:{dur:c.durations.Attack,hit:c.events.Attack[0].time},speed:10,lifetime:10};}}},
 'talent:Weak':{covers:gertrudeImageNative,ability:{kind:'gertrudeImage',params:r=>({damage:r.talents.bb['Weak.value'],birthDelay:.5,birthAnimation:clocks.enemies[child].durations.Start})}},
};
