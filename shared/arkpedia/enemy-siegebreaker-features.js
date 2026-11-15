// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-siegebreaker-animations.json' with{type:'json'};
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
import {inspirationNative} from './enemy-inspiration-features.js';
const ids=['enemy_1083_sotiab','enemy_1083_sotiab_2'];
export const isSiegebreaker=r=>ids.includes(r.prefabKey);
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
export function siegebreakerNative(r,n){
 if(!isSiegebreaker(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal
  ||!inspirationNative(r,n)||!same(r.abilities,[{text:'Able to land directly onto the battlefield.',format:'NORMAL'},
   {text:r.prefabKey.endsWith('_2')?'When Inspired, gains massively increased ATK.':'When Inspired, gains greatly increased ATK.',format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]),combat=n.$ref(mode?._combat),graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey];
 if(!root||root._modes.length!==1||!fields(root,{_commonAbilities:[],_sideTypeIndex:1,_delayToBorn:1.5,_onlyDelayToBornOnTileStart:0,
   _blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})
  ||!mode||!zero(mode._attack)||!zero(mode._attackTrigger)||mode._generalAbilities.length!==0
  ||!fields(combat,{m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},m_Enabled:1,_selector:{m_FileID:0,m_PathID:'0'},
   _interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_forceAsDmgOrHealAbility:0,_waitForAttackEvent:1,_interuptIfTargetDead:0,
   _selectTargetSource:2,_selectTargetTiming:0,_timeMode:0,_alwaysIncludeTarget:1,_allowNoTarget:0,_animKey:'Attack',_endAnimKey:'Idle',
   _preDelay:0,_activeBuffs:[],_maxAnimScale:1,_affectedBySlowDown:1,_atkScale:1,_atkScaleKey:'atk_scale',_attackType:1,
   _damageType:1,_extraDamageType:0,_elementDamageType:0,_epDamageRatio:0,_useDynamicAttackType:0}))return false;
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  &&graphic._animations.some(a=>a.animKey==='Born'&&a.animName==='Start'&&a.speed===1&&!a.loop)
  &&clock.durations.Attack===1&&clock.durations.Start===1.5
  &&same(clock.events.Attack,[{time:Math.fround(13/30),name:'OnAttack',int:0,float:0,string:''}])
  &&same(clock.events.Start,[{time:1,name:'OnStart',int:0,float:0,string:''}]);
}
const feature={matchesRecord:isSiegebreaker,covers:siegebreakerNative};
export const SIEGEBREAKER_FEATURES={
 'native:siegebreakerLanding':{...feature,ability:{kind:'passiveEnemyBody',params:r=>({birthDelay:1.5,birthDuration:clocks.enemies[r.prefabKey].durations.Start,
  birthClip:'Start',attackAnim:{dur:clocks.enemies[r.prefabKey].durations.Attack,hit:clocks.enemies[r.prefabKey].events.Attack[0].time}})}},
 'native:siegebreakerMelee':{...feature,ability:{kind:'animatedMeleeAttack',params:r=>({animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,
  releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}})}},
};
