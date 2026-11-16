// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-hui-ming-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {nativeUnscaledTalentBinding} from './enemy-talent-binding-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
// Plain single-mode melee bodies whose only native talent is the shared Hui-Ming account.
const attack={enemy_1122_sphond:[30,10],enemy_1122_sphond_2:[30,10],enemy_1123_spsbr:[30,12],enemy_1123_spsbr_2:[30,12],enemy_1125_spshld:[34,19],enemy_1125_spshld_2:[34,19],enemy_1129_spklr:[49,17],enemy_1129_spklr_2:[49,17]};
const special={enemy_1124_spbow:[30,14],enemy_1124_spbow_2:[30,14],enemy_1127_sptrkg:[24,12],enemy_1127_sptrkg_2:[24,12]};
export const HUI_MING_ARCHER_DESCRIPTION='Prioritize attacking opposite attribute enemies';
export const HUI_MING_BLOCK_DESCRIPTION="Can only be blocked by player's units of the same attribute.";
export const isHuiMingArcher=r=>!!r&&r.prefabKey.startsWith('enemy_1124_');
export const isHuiMingBlockee=r=>!!r&&r.prefabKey.startsWith('enemy_1127_');
export const isHuiMingRecord=r=>isPlainHuiMing(r)||isHuiMingArcher(r)||isHuiMingBlockee(r);
export const HUI_MING_FURY_DESCRIPTION='Greatly increases ATK when attacking opposite attribute targets';
export const isHuiMingFury=r=>!!r&&r.prefabKey.startsWith('enemy_1129_');
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
 const guard=r.prefabKey.startsWith('enemy_1125_'),fury=isHuiMingFury(r);
 if(!same(Object.keys(r.talents.groups).sort(),guard?['taunt','yinyang']:fury?['atkup','yinyang']:['yinyang'])||!same(r.talents.bbStr,{})||Object.keys(r.talents.bb).length!==(guard||fury?4:3)||fury&&(!same(r.talents.groups.atkup,['atk_scale'])||!(r.talents.bb['atkup.atk_scale']>=0))
  ||!same(r.abilities,guard?[{text:'More likely to be targeted by attacks.',format:'NORMAL'}]:fury?[{text:HUI_MING_FURY_DESCRIPTION,format:'NORMAL'}]:[]))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey];
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[]})
  ||root._modes.length!==1||root._modes[0].m_FileID!==0||!mode||!zero(mode._attack)||!zero(mode._attackTrigger)||!(fury?mode._generalAbilities.length===1&&zero(mode._generalAbilities[0]):mode._generalAbilities.length===0)||mode._combat.m_FileID!==0
  ||!ordinaryMeleePacketNative(n.$ref(mode._combat))||!huiMingAccountNative(n))return false;
 // The guard pair's separate taunt talent: one permanent blackboard taunt-level addition and nothing else.
 const taunt=n.Taunt?.find(v=>v._buffs),tb=taunt?._buffs?.[0];
 if(guard?!(taunt&&taunt._buffs.length===1&&fields(taunt,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'}})&&nativeUnscaledTalentBinding(n,taunt)
   &&fields(tb,{buffKey:'spshld_t',templateKey:'empty',lifeTimeType:2,blackboard:[],overrideType:0,isSilenceable:0})
   &&same(tb.attributes,{...noAttributes,attributeModifiers:[{attributeType:20,fetchBaseValueFromSourceEntity:0,formulaItem:0,loadFromBlackboard:1,value:0}]})):!!n.Taunt)return false;
 // The Fury pair's separate talent (its one general-ability slot is an empty reference): one permanent buff scaling output against the opposite attribute.
 const up=n.AtkUp?.find(v=>v._buffs),ub=up?._buffs?.[0];
 if(fury?!(up&&up._buffs.length===1&&fields(up,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})
   &&nativeUnscaledTalentBinding(n,up)&&passiveOutcomeBuff(ub)&&fields(ub,{buffKey:'spklr_t',templateKey:'enemy_spklr_t',blackboard:[],overrideType:0,stripBlackboardParamsWithBuffKey:0,triggerLifeType:0,triggerInterval:-1})
   &&same(n.$template('enemy_spklr_t'),template('enemy_spklr_t',{ON_CALCULATE_DAMAGE:[{$type:type('IfElse'),_conditionNode:has('BUFF_OWNER','buff_yang'),_succeedNodes:[has('TARGET','buff_yin'),scale],_failNodes:[has('BUFF_OWNER','buff_yin'),has('TARGET','buff_yang'),scale]}]}))):!!n.AtkUp)return false;
 const [duration,release]=attack[r.prefabKey];
 return !!clock&&root._animator.m_FileID===0&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(v=>v.animKey==='Attack'&&v.animName==='Attack'&&v.speed===1&&!v.loop)
  &&clock.durations.Attack===Math.fround(duration/30)&&same(clock.events.Attack,[{time:Math.fround(release/30),name:'OnAttack',int:0,float:0,string:''}]);
}
const rootFields={m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1};
const onlyYinYang=(r,text)=>!!huiMingBlackboard(r)&&same(Object.keys(r.talents.groups),['yinyang'])&&same(r.talents.bbStr,{})&&Object.keys(r.talents.bb).length===3&&same(r.abilities,[{text,format:'NORMAL'}])&&r.level===0&&!r.skills.length&&!r.sp&&!r.notCountInTotal&&r.stats.dmgType==='phys'&&r.stats.motion==='WALK';
const clocked=(r,n,root)=>{const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey],[duration,release]=special[r.prefabKey];
 return !!clock&&root._animator.m_FileID===0&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(v=>v.animKey==='Attack'&&v.animName==='Attack'&&v.speed===1&&!v.loop)
  &&clock.durations.Attack===Math.fround(duration/30)&&same(clock.events.Attack,[{time:Math.fround(release/30),name:'OnAttack',int:0,float:0,string:''}]);};
const pairs=[{blockeeBuffKey:'buff_yin',blockerBuffKey:'buff_yin'},{blockeeBuffKey:'buff_yang',blockerBuffKey:'buff_yang'}];
/** 'Stabby': an ordinary direct ranged hit whose selector sorts opposite-attribute candidates first, ahead of taunt. */
export function huiMingArcherNative(r,n){
 if(!isHuiMingArcher(r)||r.applyWay!=='RANGED'||r.stats.rangeRadius!==2.5||!onlyYinYang(r,HUI_MING_ARCHER_DESCRIPTION))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),attack=n.$ref(mode?._attack),trigger=n.$ref(mode?._attackTrigger);
 if(!fields(root,{...rootFields,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[]})||root._modes.length!==1||root._modes[0].m_FileID!==0||!mode||mode._generalAbilities.length
  ||!same(mode._combat,mode._attack)||mode._attack.m_FileID!==0||mode._attackTrigger.m_FileID!==0||n.AtkUp||n.Taunt||!huiMingAccountNative(n)
  ||!ordinaryMeleePacketNative(attack)||!fields(attack,{_upAnimKey:'Attack_Up',_downAnimKey:'Attack_Down',_upEndAnimKey:'',_downEndAnimKey:''})
  ||!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1}))return false;
 const siblings=n.$siblings(trigger);
 return siblings.filter(c=>c.m_Script).length===3&&siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6185056810787956083'},_useBlackboardRangeId:0,_extendable:0,_scaleble:0}))
  &&siblings.some(c=>fields(c,{m_Radius:2,m_Enabled:1,m_Offset:{x:0,y:0}}))&&siblings.some(c=>fields(c,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1}}))
  &&siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'8052272509195254976'},_targetSide:2,_targetMotion:3,_targetCategory:1,_postFilter:4,_ignoreTargetFree:0,_onlyIgnoreSomeOfTargetFreeCase:0,_abnormalFlag:20,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreHealFree:0,_ignoreMotionMode:0,_forceIgnoreCamouflage:0,_needProfessionMask:0,_professionMask:0,_excludeSomeAbnormalFlags:0,_excludeAbnormalFlag:46,_limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:1,_ignoreHitRange:0,_checkUnitType:0,_unitTypeMask:0,_abilityInputTargetAsSortSource:0,_secondaryFilter:4,_filterTag:'',_buffKey:'',_withoutThisBuff:0,_filterBuffSource:0,
   _buffKeyPairs:[{ownerBuffKey:'buff_yin',targetBuffKey:'buff_yang'},{ownerBuffKey:'buff_yang',targetBuffKey:'buff_yin'}],_excludeEnemyInRootTileAtFirst:''}))
  &&clocked(r,n,root);
}
const releaseProgram={schemaVersion:1,entry:'enemy_sptrkg_t',templates:{enemy_sptrkg_t:{events:{ON_BUFF_TRIGGER:[(()=>{const unless=key=>[{op:'when',condition:{op:'all',terms:[{op:'not',value:{op:'buff',who:'source',keys:[key],all:true}}]},yes:[{op:'release',who:'source'}],no:[]}];
 return{op:'when',condition:{op:'buff',who:'owner',keys:['buff_yang'],all:true},yes:unless('buff_yang'),no:[{op:'when',condition:{op:'buff',who:'owner',keys:['buff_yin'],all:true},yes:unless('buff_yin'),no:[{op:'release',who:'source'}]}]};})()]}}}};
/** 'Blindey': admitted to a block only by a blocker of its own attribute, and released by a tenth-second
 * blocker-side check once the two attributes differ or the blocker has none. */
export function huiMingBlockeeNative(r,n){
 if(!isHuiMingBlockee(r)||r.applyWay!=='MELEE'||!onlyYinYang(r,HUI_MING_BLOCK_DESCRIPTION))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),toggle=n.$ref(mode?._generalAbilities?.[0]),check=n.$ref(toggle?._checker),buff=check?._buffsToBlockee?.[0],marker=n.$ref(root?._commonAbilities?.[0]),mb=marker?._buffs?.[0];
 if(!fields(root,{...rootFields,_specialBlockCondition:{_type:1,_buffKeyPairs:pairs,_filterTags:[]}})||root._modes.length!==1||root._modes[0].m_FileID!==0||root._commonAbilities.length!==1||root._commonAbilities[0].m_FileID!==0
  ||!mode||!zero(mode._attack)||!zero(mode._attackTrigger)||mode._generalAbilities.length!==1||mode._generalAbilities[0].m_FileID!==0||mode._combat.m_FileID!==0||n.AtkUp||n.Taunt
  ||!ordinaryMeleePacketNative(n.$ref(mode._combat))||!huiMingAccountNative(n))return false;
 if(!fields(toggle,{m_Script:{m_FileID:1,m_PathID:'5578302910068743633'},_selector:{m_FileID:0,m_PathID:'0'},_buffs:[],_isInverseToggle:0,_unmanagedBuffsWhenToggleOn:[],_setToggleFalseOnDetached:0,_buffsWhenToggleOff:[]})||toggle._checker.m_FileID!==0
  ||!fields(check,{m_Script:{m_FileID:1,m_PathID:'-4412927117579039591'},m_Enabled:1,_blockMinCnt:1,_blockMaxCnt:-1,_useBlockAsMin:1})||check._buffsToBlockee.length!==1
  ||!passiveOutcomeBuff(buff)||!fields(buff,{buffKey:'enemy_sptrkg_t',templateKey:'enemy_sptrkg_t',disableOverride:1,overrideType:0,triggerLifeType:2,triggerInterval:-1,waitFirstTriggerInterval:1,firstTriggerInterval:-1,stripBlackboardParamsWithBuffKey:0,blackboard:[{key:'interval',value:Math.fround(.1),valueStr:''}]})
  ||!fields(marker,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'}})||marker._buffs.length!==1||!passiveOutcomeBuff(mb)||!fields(mb,{buffKey:'sptrkg_passive[effect]',templateKey:'empty',blackboard:[],overrideType:0,triggerLifeType:0,triggerInterval:-1}))return false;
 try{if(!same(compileNativeBuffProgram('enemy_sptrkg_t',k=>n.$template(k)),releaseProgram))return false;}catch{return false;}
 return clocked(r,n,root);
}
export const huiMingNative=(r,n)=>isHuiMingArcher(r)?huiMingArcherNative(r,n):isHuiMingBlockee(r)?huiMingBlockeeNative(r,n):plainHuiMingNative(r,n);
export const HUI_MING_ABILITY={kind:'huiMingAttribute',params:r=>({...huiMingBlackboard(r),...(isHuiMingFury(r)?{bonus:{key:'spklr_t',scale:r.talents.bb['atkup.atk_scale']}}:{}),...(isHuiMingArcher(r)?{preferOpposite:true}:{})})};
export const HUI_MING_BLOCK_ABILITY={kind:'pairedBlockerBuffs',params:()=>({pairs,checkBuffKey:'enemy_sptrkg_t',interval:Math.fround(.1),immediate:false,program:nativeBuffProgram('enemy_sptrkg_t')})};
