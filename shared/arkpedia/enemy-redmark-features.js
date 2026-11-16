// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-redmark-animations.json' with{type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {markedGroundSelectorNative} from './enemy-marked-target-contract.js';
const ids=['enemy_1135_redman','enemy_1135_redman_2'];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const isRedmark=r=>ids.includes(r.prefabKey);
export const REDMARK_DESCRIPTION='Only performs ranged attacks against allied units caught inside the <Sandstorm>';
const event=time=>[{time,name:'OnAttack',int:0,float:0,string:''}];
export function redmarkNative(r,n){
 if(!isRedmark(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal
  ||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})||!same(r.abilities,[
   {text:'<$ba.invisible>Invisible</>',format:'NORMAL'},{text:REDMARK_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]),combat=n.$ref(mode?._combat),attack=n.$ref(mode?._attack),trigger=n.$ref(mode?._attackTrigger);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_commonAbilities:[],_sideTypeIndex:1,_delayToBorn:0,
  _onlyDelayToBornOnTileStart:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})
  ||root._modes.length!==1||!same(mode?._generalAbilities,[])||!ordinaryMeleePacketNative(combat,{clip:'Combat',atkScale:Math.fround(.3)})
  ||!markedGroundSelectorNative(n,trigger,{markerKey:'storm_ally_mark',abnormalFlag:21,excludedTag:'redman_exclude',globalRange:true}))return false;
 const selector=n.$ref(attack?._selector);
 if(selector?.m_GameObject.m_PathID!==trigger.m_GameObject.m_PathID||selector?._buffKey!=='storm_ally_mark'
  ||!fields(attack,{m_Script:{m_FileID:1,m_PathID:'4156651312234227407'},m_Enabled:1,_interruptAbilityOnDetach:0,
   _ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,_selectTargetSource:2,_selectTargetTiming:0,
   _timeMode:0,_alwaysIncludeTarget:1,_allowNoTarget:0,_animKey:'Attack',_endAnimKey:'Idle',_preDelay:0,_activeBuffs:[],_maxAnimScale:1,
   _affectedBySlowDown:1,_atkScale:1,_atkScaleKey:'atk_scale',_attackType:1,_elementDamageType:0,_epDamageRatio:0,_useDynamicAttackType:0,
   _projectileKey:'projectile_enemy_redman',_damageType:1,_waitForProjectileInvalid:0,_notClearProjectileWhenCastEnd:0,
   _fireAttackFinishWhenProjectileInvalid:0,_minPostDelayWhenProjectileInvalid:0,_waitForAnimEndWhenProjectileInvalid:0,
   _projectileDestination:0,_extraDamageType:0,_emitToInputPosWhenTargetIsInvalid:0,_emitToInputRootTileWhenTargetIsInvalid:0,
   _useCachedAtkOnly:0,_transferSource:0,_extraProjectileKeys:[],_fireCreateProjectileEvent:0}))return false;
 const invisible=n.Invi?.find(c=>'_checker'in c),checker=n.$ref(invisible?._checker),buff=invisible?._buffs?.[0];
 if(!fields(invisible,{m_Script:{m_FileID:1,m_PathID:'5578302910068743633'},_selector:{m_FileID:0,m_PathID:'0'},
   _interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_unmanagedBuffsWhenToggleOn:[],_setToggleFalseOnDetached:0,_isInverseToggle:0,_buffsWhenToggleOff:[]})
  ||invisible._buffs.length!==1||!fields(checker,{_isInitToggled:1,_disableWhenAttack:0,_disableWhenBlocked:1,_disableWhenInAttackState:0,
   _disableWhenInCombatState:0,_disableWhenOutputHeal:0,_disableWhenTakeDamage:0,_disableWhenAppliedModifier:0,_disableWhenAppliedDamageModifier:0,
   _disableWhenMoving:0,_restoreDelay:3,_disableDuringReborn:0})
  ||!fields(buff,{buffKey:'talent_invisible',templateKey:'empty',loadFromDB:0,isSilenceable:0,isStunnable:0,isFreezable:0,
   isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,maxStackCnt:1,overrideType:0,blackboard:[]})
  ||!same(buff.attributes,{abnormalFlags:[9],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]})
  ||!same(n.$template('empty')?.eventToActions,{}))return false;
 const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root._animator),projectile=n.$projectile('projectile_enemy_redman'),life=projectile.find(c=>'_lifeTime'in c),motion=projectile.find(c=>'_speed'in c);
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Combat'].every(key=>graphic._animations.some(a=>a.animKey===key&&a.animName===`C_${key}`&&a.speed===1&&!a.loop))
  &&clock.durations.C_Attack===Math.fround(70/30)&&clock.durations.C_Combat===2
  &&same(clock.events.C_Attack,event(Math.fround(43/30)))&&same(clock.events.C_Combat,event(Math.fround(24/30)))
  &&projectile.length===3&&projectile.every(c=>['-8797129986015012478','6834194400804168919','5247176549481151122'].includes(c.m_Script?.m_PathID))
  &&fields(life,{_randomDelayToBorn:0,_lifeTimeType:1,_lifeTime:10,_canHitSameTargetMultipleTimes:0,_maxHitNum:1,
   _stopAfterMaxHit:1,_stopWhenSourceInvalid:0,_alwaysHitTraceTargetInTheEnd:1,_managedBySource:0,_eliminatableStatus:0,_movementAdjustableStatus:0})
  &&fields(life._actionController,{_detachBuffsWhenTargetLeave:0,_detachAllBuffsWhenStopped:0,_onlyAddBuffsToTraceTarget:0,
   _onlyAddBuffsToTargetOnce:0,_dontAddBuffs:0,_excludeAttachments:0,_useSelfBlackboard:0,_extraBuffsInTheEnd:[],_useExtraBuffsWhenStopHit:0,
   _addExtraBuffsWhenReached:0,_detachAllExtraBuffsWhenStopped:0})
  &&fields(motion,{_speed:16,_flyToTargetLocationOnly:0,_forceReachedWhenTimeup:1,_delayTime:0,_delayAfterReached:0,
   _onlyReachedInTime:0,_useRandomHeight:0,_randomInverseParacurve:0,_comeBack:0});
}
const animation=(r,clip)=>({clip,duration:clocks.enemies[r.prefabKey].durations[clip],releases:clocks.enemies[r.prefabKey].events[clip].map(e=>e.time)});
export const REDMARK_FEATURE={matchesRecord:isRedmark,covers:redmarkNative,
 ability:{kind:'markedMeleeProjectileAttack',params:r=>({targeting:{globalRange:true,markerKey:'storm_ally_mark',excludedTag:'redman_exclude',groundOnly:true},
  meleeScale:Math.fround(.3),meleeAnimation:animation(r,'C_Combat'),rangedAnimation:animation(r,'C_Attack'),type:'phys',speed:16,lifetime:10})},
 note:'Native global sandstorm-marker selection and ordinary blocker melee share the captured cast clock and released projectile lifecycle. Invisibility uses the existing three-second block restoration.'};
