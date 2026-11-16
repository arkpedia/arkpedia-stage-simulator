// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-famiglia-limos-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff,emptyOutcomeAttributes as empty,nativeKillLog} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {nativeUnscaledTalentBinding} from './enemy-talent-binding-contract.js';
import {nativeRouteSummonAction} from './enemy-route-summon-contract.js';
import {nativeSelectedSpRewardBuff} from './enemy-device-sp-selector-contract.js';
const config={enemy_1281_sgcar:'enemy_1277_sgman',enemy_1281_sgcar_2:'enemy_1277_sgman_2'};
export const isFamigliaLimo=r=>!!r&&Object.hasOwn(config,r.prefabKey);
export const famigliaLimoChild=r=>config[r.prefabKey];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x)),type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const text=r=>`Unloads 3 <${r.prefabKey.endsWith('_2')?'Elite ':''}Famiglia Soldiers> if this is unit is defeated while blocked`;
const fx=key=>({$type:type('CreateEffect'),_targetType:'BUFF_OWNER',_sourceType:'BUFF_OWNER',_effectKey:key,_useSourceFaceVactor:false,_useSourceToTargetDirection:false,_useAttackPlaybackSpeed:false});
const log=key=>({$type:type('LogExtraBattleInfo'),_logType:'SIMPLE',_key:key,_loadKeyFromBlackBoard:true,_countInHostIfToken:false,_additionValue:1,_attributeType:'NONE',_target:'BUFF_OWNER'});
const deathTemplate={templateKey:'enemy_sgcar_death',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BEFORE_TRY_SET_HP_ZERO:[{$type:type('IfElse'),_conditionNode:{$type:type('FilterDeathReason'),_source:'BUFF_OWNER',_finishReason:'FALLDOWN'},_succeedNodes:null,_failNodes:[{$type:type('IfElse'),_conditionNode:{$type:type('CheckBlocked'),_targetType:'BUFF_OWNER',_checkBlockedBySource:false,_checkBlockedBySourceToken:false,_sourceType:'BUFF_SOURCE',_checkBlockedCount:false},_succeedNodes:[{$type:type('SwitchMode'),_modeIndex:1,_loadModeFromBlackboard:false,_restoreDefault:false,_restartFSM:true,_targetType:'TARGET'},fx('enemy_sgcar_die_2')],_failNodes:[fx('enemy_sgcar_die_1'),{$type:type('CreateBuff'),_buff:{...nativeSelectedSpRewardBuff('enemy_sgcar_death_audio'),templateKey:'empty',disableOverride:false,maxStackCnt:1,audioSignal:'enemy_sgcar_death_audio_1'},_buffOwner:'BUFF_OWNER',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false},log('sgcar_boom_direct')]}]}]}};
const sumTemplate={templateKey:'enemy_sgcar_death_sum',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_START:[{$type:type('CheckAbnormalFlag'),_abnormalFlag:'SILENCED',_targetType:'BUFF_OWNER',_isUnset:true},nativeRouteSummonAction({tryOutside:true,offsetBound:Math.fround(.1)})]}};
export function famigliaLimoNative(r,n){
 if(!isFamigliaLimo(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,[{text:text(r),format:'NORMAL'}])||!same(r.talents,{bb:{'DeathRattle.attack@cnt':3},bbStr:{},groups:{DeathRattle:['attack@cnt']}}))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),normal=n.$ref(root?._modes?.[0]),special=n.$ref(root?._modes?.[1]),parent=n.DeathRattle?.find(v=>v._buffs),summon=n.Passive?.find(v=>v._buffs),clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root?._animator);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[]})||root._modes.length!==2
  ||!normal||!special||normal._generalAbilities.length||special._generalAbilities.length!==1||n.$ref(special._generalAbilities[0])!==summon
  ||[normal,special].some(m=>!fields(m,{_attack:{m_FileID:0,m_PathID:'0'},_attackTrigger:{m_FileID:0,m_PathID:'0'}}))||special._combat.m_PathID!=='0'
  ||[root._animator,...root._modes,normal._combat,special._combat,special._animatorHooker,...special._generalAbilities].some(v=>v.m_FileID!==0)
  ||!ordinaryMeleePacketNative(n.$ref(normal._combat)))return false;
 if(!fields(n.$ref(special._animatorHooker),{m_Script:{m_FileID:1,m_PathID:'-2632969505105631840'},_excludeAnimKeys:[],_replaceAnimPairs:[{fromAnimKey:'Die',toAnimKey:'Die_2'}],_disableSwitchSettings:[]}))return false;
 for(const p of [parent,summon])if(!fields(p,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_metadata:{namedAsAlias:'',blackboardPrefix:''},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0}))return false;
 if(parent._buffs.length!==2||!nativeUnscaledTalentBinding(n,parent)||parent._buffs.some(b=>!passiveOutcomeBuff(b)||!same(b.blackboard,[])||b.overrideType!==0)
  ||!fields(parent._buffs[0],{buffKey:'enemy_sgcar_death',templateKey:'enemy_sgcar_death'})||!fields(parent._buffs[1],{buffKey:'enemy_sgcar_dead_log',templateKey:'log_killed'})||!nativeKillLog(n))return false;
 const buff=summon._buffs?.[0];if(summon._buffs.length!==1||!buff||!empty(buff.attributes)||!fields(buff,{buffKey:'enemy_sgcar_death_sum',templateKey:'enemy_sgcar_death_sum',loadFromDB:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,lifeTimeType:0,lifeTime:0,maxStackCnt:1,overrideType:0,blackboard:[{key:'enemy_key',value:0,valueStr:config[r.prefabKey]}]}))return false;
 return same(n.$template('enemy_sgcar_death'),deathTemplate)&&same(n.$template('enemy_sgcar_death_sum'),sumTemplate)&&same(n.$template('empty')?.eventToActions,{})
  &&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&[['Attack','Attack'],['Die','Die_1'],['Die_2','Die_2']].every(([key,name])=>graphic._animations.some(v=>v.animKey===key&&v.animName===name&&v.speed===1&&!v.loop))
  &&clock.durations.Attack===Math.fround(36/30)&&same(clock.events.Attack,[{time:Math.fround(19/30),name:'OnAttack',int:0,float:0,string:''}])&&clock.durations.Die_1===1&&clock.durations.Die_2===1;
}
export const FAMIGLIA_LIMO_DEATH={kind:'blockedDeathSummons',params:r=>({key:config[r.prefabKey],cnt:3,parentKey:'enemy_sgcar_death',logKey:'enemy_sgcar_dead_log',unblockedLogKey:'sgcar_boom_direct',blockedDieClip:'Die_2',defaultDieClip:'Die_1',delay:0,radius:Math.fround(.1)})};
export const FAMIGLIA_LIMO_FEATURES={
 'native:famigliaLimoMelee':{matchesRecord:isFamigliaLimo,covers:famigliaLimoNative,ability:{kind:'animatedMeleeAttack',params:r=>({type:'phys',animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(v=>v.time),maxScale:1}})}},
};
export const famigliaLimoExplains=(value,r)=>isFamigliaLimo(r)&&value===text(r);
