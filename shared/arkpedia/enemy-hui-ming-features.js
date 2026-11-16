// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-hui-ming-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {nativeUnscaledTalentBinding} from './enemy-talent-binding-contract.js';
// Plain single-mode melee bodies whose only native talent is the shared Hui-Ming account.
const attack={enemy_1122_sphond:[30,10],enemy_1122_sphond_2:[30,10],enemy_1123_spsbr:[30,12],enemy_1123_spsbr_2:[30,12],enemy_1125_spshld:[34,19],enemy_1125_spshld_2:[34,19]};
export const isPlainHuiMing=r=>!!r&&Object.hasOwn(attack,r.prefabKey);
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x)),type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0',noAttributes={abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:[]};
const has=(who,key)=>({$type:type('CheckContainsBuff'),_targetType:who,_buffKeys:[key],isAND:true,_loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false});
const scale={$type:type('AtkScaleUp'),_filterApplyWay:false,_filterProjectileKey:'',_applyWay:'NONE',_defaultValue:1,_filterNoneApplyWay:false,_cancelIfAtkScaleZero:false,_atkScaleKey:'atk_scale'};
const pair=(mine,theirs)=>({$type:type('IfElse'),_conditionNode:has('SOURCE',mine),_succeedNodes:[has('TARGET',theirs),scale],_failNodes:[]});
const template=(key,events)=>({templateKey:key,effectKey:'',onEventPriority:'DEFAULT',eventToActions:events});
const choose=(value,key)=>({$type:type('IfElse'),_conditionNode:{$type:type('FilterByBlackboardValue'),_targetType:'BUFF_OWNER',_anotherBuff:false,_buffKey:null,_blackboardKey:'dynamic',_valueToCompare:value,_anotherKeyToCompare:null,_condType:'EQUALS'},
 _succeedNodes:[{$type:type('CreateBuffById'),_buffKey:key,_buffOwner:'BUFF_OWNER',_isDerivedBuff:false,_loadFromBlackboard:false,_finishDerivedBuffIfParentFinish:false}],_failNodes:[]});
const marker=(key,effect)=>({$type:type('CreateBuff'),_buff:{attributes:noAttributes,buffKey:key,loadFromDB:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',templateKey:'empty',disableOverride:false,overrideKey:null,overrideType:'DEFAULT',maxStackCnt:1,refreshRemainingTimeWhenStackMax:false,clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,overrideEffectKey:effect,overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:null,lifeTimeType:'INFINITY',takeSnapshotWhenExtend:false,durationKey:null,lifeTime:0,triggerLifeType:'IMMEDIATELY',triggerCnt:0,triggerInterval:-1,waitFirstTriggerInterval:true,firstTriggerInterval:-1,priority:-1,priorityBBKeys:[],stripBlackboardParamsWithBuffKey:false,blackboard:[]},_buffOwner:'BUFF_OWNER',_isDerivedBuff:true,_finishDerivedBuffIfParentFinish:false});
const finish=key=>({$type:type('FinishBuffsById'),_buffKey:key,_loadFromBlackboard:false,_decCntIfStack:false,_updateOverrideMap:true,_targetType:'BUFF_OWNER',_checkBuffSource:false,_sourceType:'BUFF_SOURCE',_alsoClearNullSource:false,_finishHostBuff:false});
// Starting one attribute finishes the other; only the presentation marker differs between a switch and a first start.
const attribute=(self,opposite,switched,plain)=>template(`buff_${self}`,{ON_BUFF_START:[{$type:type('IfElse'),_conditionNode:has('BUFF_OWNER',`buff_${opposite}`),
 _succeedNodes:[finish(`buff_${opposite}`),marker(`buff_${opposite}_to_${self}[effect]`,switched)],_failNodes:[finish(`buff_${opposite}`),marker(`buff_${self}[effect]`,plain)]}]});
const expected={
 'buff_yinyang[init]':template('buff_yinyang[init]',{ON_BUFF_START:[choose(0,'buff_yin'),choose(1,'buff_yang')]}),
 'buff_yinyang[same]':template('buff_yinyang[same]',{ON_CALCULATE_DAMAGE:[pair('buff_yang','buff_yang'),pair('buff_yin','buff_yin')]}),
 'buff_yinyang[diff]':template('buff_yinyang[diff]',{ON_CALCULATE_DAMAGE:[pair('buff_yang','buff_yin'),pair('buff_yin','buff_yang')]}),
 buff_yin:attribute('yin','yang','common_V016_buff_sun_to_moon','common_V016_buff_moon'),
 buff_yang:attribute('yang','yin','common_V016_buff_moon_to_sun','common_V016_buff_sun'),
};
const databaseBuff=key=>({attributes:{abnormalFlags:null,abnormalImmunes:null,abnormalAntis:null,abnormalCombos:null,abnormalComboImmunes:null,attributeModifiers:null},buffKey:key,loadFromDB:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,isGroundBoundable:false,statusResistable:'AUTOMATIC',templateKey:key,disableOverride:false,overrideKey:null,overrideType:'DEFAULT',maxStackCnt:1,refreshRemainingTimeWhenStackMax:false,clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,overrideEffectKey:null,overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:null,lifeTimeType:'INFINITY',takeSnapshotWhenExtend:false,durationKey:null,remainingTimeKey:null,lifeTime:0,triggerLifeType:'IMMEDIATELY',triggerCnt:0,triggerInterval:-1,waitFirstTriggerInterval:true,firstTriggerInterval:-1,priority:-1,priorityBBKeys:null,stripBlackboardParamsWithBuffKey:false,blackboard:null,enableInitDirectionFromSource:false});
/** The shared account itself: the three talent buffs, their templates and the two database attribute buffs. */
export function huiMingAccountNative(n){
 const passive=n.YinYang?.find(v=>v._buffs);
 if(!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_metadata:{namedAsAlias:'',blackboardPrefix:''},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})
  ||passive._buffs.length!==3||!nativeUnscaledTalentBinding(n,passive)||passive._buffs.some(b=>!same(b.blackboard,[])||b.overrideType!==0||b.isSilenceable!==0||b.triggerInterval!==-1||b.triggerLifeType!==0||b.loadFromDB!==0))return false;
 const [init,sameBuff,diffBuff]=passive._buffs;
 return fields(init,{buffKey:'buff_yinyang[init]',templateKey:'buff_yinyang[init]',lifeTimeType:0,lifeTime:0,maxStackCnt:1,stripBlackboardParamsWithBuffKey:0,attributes:noAttributes})
  &&[[sameBuff,'buff_yinyang[same]'],[diffBuff,'buff_yinyang[diff]']].every(([b,key])=>passiveOutcomeBuff(b)&&fields(b,{buffKey:key,templateKey:key,stripBlackboardParamsWithBuffKey:1}))
  &&Object.entries(expected).every(([key,value])=>same(n.$template(key),value))&&same(n.$template('empty')?.eventToActions,{})
  &&['buff_yin','buff_yang'].every(key=>same(n.$buff(key),databaseBuff(key)));
}
export function huiMingBlackboard(r){
 const bb=r.talents.bb,dynamic=bb['yinyang.dynamic'],sameScale=bb['yinyang.buff_yinyang[same].atk_scale'],diffScale=bb['yinyang.buff_yinyang[diff].atk_scale'];
 return same(r.talents.groups.yinyang,['buff_yinyang[diff].atk_scale','buff_yinyang[same].atk_scale','dynamic'])&&[-1,0,1].includes(dynamic)&&[sameScale,diffScale].every(v=>Number.isFinite(v)&&v>=0)
  ?{dynamic,same:sameScale,diff:diffScale,sameKey:'buff_yinyang[same]',diffKey:'buff_yinyang[diff]'}:null;
}
export function plainHuiMingNative(r,n){
 if(!isPlainHuiMing(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal||!huiMingBlackboard(r))return false;
 const guard=r.prefabKey.startsWith('enemy_1125_');
 if(!same(Object.keys(r.talents.groups).sort(),guard?['taunt','yinyang']:['yinyang'])||!same(r.talents.bbStr,{})||Object.keys(r.talents.bb).length!==(guard?4:3)
  ||!same(r.abilities,guard?[{text:'More likely to be targeted by attacks.',format:'NORMAL'}]:[]))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey];
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[]})
  ||root._modes.length!==1||root._modes[0].m_FileID!==0||!mode||!zero(mode._attack)||!zero(mode._attackTrigger)||mode._generalAbilities.length||mode._combat.m_FileID!==0
  ||!ordinaryMeleePacketNative(n.$ref(mode._combat))||!huiMingAccountNative(n))return false;
 const [duration,release]=attack[r.prefabKey];
 return !!clock&&root._animator.m_FileID===0&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(v=>v.animKey==='Attack'&&v.animName==='Attack'&&v.speed===1&&!v.loop)
  &&clock.durations.Attack===Math.fround(duration/30)&&same(clock.events.Attack,[{time:Math.fround(release/30),name:'OnAttack',int:0,float:0,string:''}]);
}
export const HUI_MING_ABILITY={kind:'huiMingAttribute',params:r=>huiMingBlackboard(r)};
