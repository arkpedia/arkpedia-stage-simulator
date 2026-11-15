// SPDX-License-Identifier: GPL-3.0-or-later
// Build-only source contract shared by single-mode ordinary melee bodies.
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
export function ordinaryMeleeBodyNative(r,n,{clock,birthDelay,idleWhenBorn=0,interruptOnDetach=0,selectTargetSource=2,
 attackDuration,startDuration,attackEvents,startEvents}){
 if(r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal)return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]),combat=n.$ref(mode?._combat),graphic=n.$ref(root?._animator);
 if(!root||!Array.isArray(root._modes)||root._modes.length!==1||!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_commonAbilities:[],
  _sideTypeIndex:1,_delayToBorn:birthDelay,_onlyDelayToBornOnTileStart:0,_blockVolume:1,
  _specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:idleWhenBorn,_canNotExit:0})
  ||!mode||!zero(mode._attack)||!zero(mode._attackTrigger)||!Array.isArray(mode._generalAbilities)||mode._generalAbilities.length!==0
  ||!ordinaryMeleePacketNative(combat,{interruptOnDetach,selectTargetSource}))return false;
 return !!clock&&Array.isArray(graphic?._animations)&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  &&graphic._animations.some(a=>a.animKey==='Born'&&a.animName==='Start'&&a.speed===1&&!a.loop)
  &&(!idleWhenBorn||graphic._animations.some(a=>a.animKey==='Idle'&&a.animName==='Idle'&&a.speed===1&&a.loop===1))
  &&clock.durations.Attack===attackDuration&&clock.durations.Start===startDuration
  &&same(clock.events.Attack??[],attackEvents)&&same(clock.events.Start??[],startEvents);
}

/** Shared native simple-melee packet, including ranged-triggered direct hits. */
export function ordinaryMeleePacketNative(combat,{interruptOnDetach=0,selectTargetSource=2,clip='Attack'}={}){
 return fields(combat,{m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},m_Enabled:1,_selector:{m_FileID:0,m_PathID:'0'},
  _interruptAbilityOnDetach:interruptOnDetach,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,
  _selectTargetSource:selectTargetSource,_selectTargetTiming:0,_timeMode:0,_alwaysIncludeTarget:1,_allowNoTarget:0,_animKey:clip,_endAnimKey:'Idle',
  _preDelay:0,_activeBuffs:[],_maxAnimScale:1,_affectedBySlowDown:1,_atkScale:1,_atkScaleKey:'atk_scale',_attackType:1,
  _damageType:1,_extraDamageType:0,_elementDamageType:0,_epDamageRatio:0,_useDynamicAttackType:0});
}
