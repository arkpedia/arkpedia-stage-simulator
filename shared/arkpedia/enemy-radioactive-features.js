import {ENERGY_REWARD_TEMPLATE as reward,sourceEnergyGrantBuff} from './enemy-energy-grant-contract.js';
import {nativeBuffProgram} from './native-buff-programs.js';
// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import clocks from '../../data/arkpedia-radioactive-slugs-animations.json' with{type:'json'};
const ids=['enemy_1352_eslime','enemy_1352_eslime_2'];
export const isRadioactiveSlug=r=>ids.includes(r.prefabKey);
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`,node=(name,fields={})=>({$type:type(name),...fields});
const buff=sourceEnergyGrantBuff();
const parent={templateKey:'enemy_eslime_add_energy_global',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_OWNER_KILLED:[
 node('CheckAbnormalFlag',{_abnormalFlag:'SILENCED',_targetType:'SOURCE',_isUnset:true}),node('EmitProjectile',{_mountPoint:'MUZZLE',_emitOnRootTile:false,_ev:'ON_REACHED_TARGET',_actions:[
  node('CreateBuffToCertainSideUnits',{_sideMask:'ENEMY',_buff:buff,_isDerivedBuff:false,_noSource:true,_finishDerivedBuffIfParentFinish:false})],_overwriteActions:true,_buffDataList:[],_overwriteBuffs:false,_sourceType:'BUFF_OWNER',_targetType:'TARGET',_targetPosFromBB:false,_projectileKey:'',_useProjectileAsTarget:false,_extraBlackboard:false,_overwriteBlackboard:false,_useTileAsTarget:false,_cacheAtkToActions:false,_useTargetRootTile:false,_useAbilityTileSelector:false,_abilityName:''})]}};
const packet={_sourceType:'SOURCE',_targetType:'TARGET',_damageType:'MAGICAL',_atkScaleVar:'atk_scale',_defaultAtkScale:1,_applyWay:'NONE',_baseOnHostAtk:false,_emitSourceOnCalculateDamage:false,_attackType:'SPLASH',_forceUseProjectileCachedAtk:false,_ignoreForSp:false,_ignoreMissFlag:'NONE',_ignoreCancelReasonMask:'NONE',_modifierKey:'',_assignRealDamageToBB:false,_assignFinalDamageToBB:false,_skipModifierEvent:false,_noSource:false,_onlyUseSourceOnCalculateDamage:false,_getCachedAtkFromBlackboard:false,_cachedAtkKey:'atk',_useSourceWhenUseCachedAtk:false,_setSharedFlag:false,_sharedFlagIndex:'IS_CONTINUOUS',$type:'Torappu.Battle.Action.Nodes+AdvancedApplyDamage'};
export function radioactiveNative(r,n){
 if(!isRadioactiveSlug(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,[{text:'When defeated, deals heavy Arts damage in an area and causes all enemies on the field to gain 1 Energy.',format:'SILENCE'}])
  ||!same(r.talents,{bb:{'Boom.atk_scale':4,'Boom.add_count':1},bbStr:{},groups:{Boom:['add_count','atk_scale']}}))return false;
 const root=n[r.prefabKey]?.find(v=>'_modes'in v),mode=n.$ref(root?._modes?.[0]),a=n.Boom?.find(v=>'_projectileActions'in v),b=a?._buffs?.[0],graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey];
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1})
  ||root._modes.length!==1||root._commonAbilities.length||!mode||mode._generalAbilities.length||!zero(mode._attack)||!zero(mode._attackTrigger)
  ||!ordinaryMeleePacketNative(n.$ref(mode._combat),{damageType:2,maxAnimScale:-1})
  ||!clock||n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID!==clock.source.skeletonDataPathId
  ||!graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  ||clock.durations.Attack!==Math.fround(38/30)||!same(clock.events.Attack,[{time:Math.fround(.4),name:'OnAttack',int:0,float:0,string:''}])
  ||!fields(a,{m_Script:{m_FileID:1,m_PathID:'2574888870568471093'},_selector:{m_FileID:0,m_PathID:'0'},_interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_projectileBuffs:[],_ignoredProjectileEvents:[]})
  ||a._buffs.length!==1||!empty(b.attributes)||!fields(b,{buffKey:'enemy_eslime_add_energy_global',templateKey:'enemy_eslime_add_energy_global',loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,disableOverride:1,overrideType:0,maxStackCnt:1,lifeTimeType:2,lifeTime:0,blackboard:[{key:'projectile',value:0,valueStr:'projectile_enemy_eslime'}]})
  ||!same(JSON.parse(a._projectileActions.SerializedState),[packet])||!same(a._projectileActions.SerializedObjectReferences,[])
  ||!n.$siblings(a).some(v=>fields(v,{m_Script:{m_FileID:1,m_PathID:'-2726233351382997147'},_overwriteTalentKey:'',_attachInDummy:0,_applyTalentScale:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[]}))
  ||!same(n.$template(parent.templateKey),parent)||!same(n.$template(reward.templateKey),reward))return false;
 const p=n.$projectile('projectile_enemy_eslime'),controller=p.find(v=>'_lifeTime'in v),hit=p.find(v=>'_targetOptions'in v),circle=p.find(v=>'m_Radius'in v);
 // This prefab has no movement behavior. Lifetime termination forces Reached;
 // its reached action precedes the hit behavior in the shared native lifecycle.
 return p.length===5&&fields(controller,{m_Script:{m_FileID:1,m_PathID:'-8797129986015012478'},_randomDelayToBorn:0,_lifeTimeType:1,_lifeTime:.5,_getLifeTimeFromBB:0,_hitNumType:2,_maxHitNum:0,_getMaxHitNumFromBB:0,_stopAfterMaxHit:0,_stopAfterFirstHit:0,_stopWhenSourceInvalid:0,_alwaysHitTraceTargetInTheEnd:0,_alwaysHitTraceTargetWhenReached:0,_alwaysReachInTheEnd:1,_canHitSameTargetMultipleTimes:0,_containsChildrenBehaviours:0,_eliminatableStatus:0,_movementAdjustableStatus:0})
  &&same(controller._actionController,{_detachBuffsWhenTargetLeave:0,_detachAllBuffsWhenStopped:0,_onlyAddBuffsToTraceTarget:0,_onlyAddBuffsToTargetOnce:0,_dontAddBuffs:0,_excludeAttachments:0,_useSelfBlackboard:0,_extraBuffsInTheEnd:[],_useExtraBuffsWhenStopHit:0,_addExtraBuffsWhenReached:0,_detachAllExtraBuffsWhenStopped:0})
  &&p.some(v=>fields(v,{m_Script:{m_FileID:1,m_PathID:'6834194400804168919'}}))
  &&fields(hit,{m_Script:{m_FileID:1,m_PathID:'-3494225671239136090'},_goThroughWall:1,_onlyCheckHitWhenReachTarget:1,_onlyCheckHitWhenStop:0,_rangeToLoad:{m_FileID:0,m_PathID:'0'},_onlyTraceTarget:0,_ignoreCamouflage:1,_ignoreRangeScale:0,_exceptSource:0,_mergeTraceTargetMotion:0,_markReachedOnlyWhenTargetEnter:0,_exceptFlyCharacter:0})
  &&same(hit._targetOptions,{targetSide:2,targetMotion:1,targetCategory:1,enableAdvancedOptions:1,ignoreTargetFree:0,ignoreAllyTargetFree:0,ignoreHealFree:0,ignoreMotionMode:0,ignoreTargetSide:0,excludeSomeAbnormalFlags:0,containSomeAbnormalFlags:0,excludeAbnormalFlag:0,containAbnormalFlag:0,purposeMask:0,professionMask:0,checkUnitType:0,unitTypeMask:0,onlyIgnoreSomeOfTargetFreeCase:0,abnormalFlag:0,abnormalCombo:0})
  &&fields(circle,{m_IsTrigger:false,m_Radius:1.25,m_Offset:{x:0,y:0}});
}
export const RADIOACTIVE_FEATURES={
 'talent:Boom':{matchesRecord:isRadioactiveSlug,covers:radioactiveNative,explains:text=>text==='When defeated, deals heavy Arts damage in an area and causes all enemies on the field to gain 1 Energy.',
  ability:{kind:'deathEnergyPulse',params:()=>({delay:.5,radius:1.25,scale:4,type:'arts',program:nativeBuffProgram('enemy_esabr_add_energy'),blackboard:{add_count:1},parentKey:'enemy_eslime_add_energy_global',silenceable:true})}},
 'native:radioactiveMelee':{matchesRecord:isRadioactiveSlug,covers:radioactiveNative,ability:{kind:'animatedMeleeAttack',params:r=>({type:'arts',animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time),maxScale:-1}})}},
};
