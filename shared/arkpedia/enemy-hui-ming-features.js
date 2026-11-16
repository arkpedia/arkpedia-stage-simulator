// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-hui-ming-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {nativeUnscaledTalentBinding} from './enemy-talent-binding-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
// Plain single-mode melee bodies whose only native talent is the shared Hui-Ming account.
const attack={enemy_1122_sphond:[30,10],enemy_1122_sphond_2:[30,10],enemy_1123_spsbr:[30,12],enemy_1123_spsbr_2:[30,12],enemy_1125_spshld:[34,19],enemy_1125_spshld_2:[34,19],enemy_1129_spklr:[49,17],enemy_1129_spklr_2:[49,17]};
const special={enemy_1128_spmage:[60,24],enemy_1128_spmage_2:[60,24],enemy_1126_spslme:[40,12],enemy_1126_spslme_2:[40,12],enemy_1124_spbow:[30,14],enemy_1124_spbow_2:[30,14],enemy_1127_sptrkg:[24,12],enemy_1127_sptrkg_2:[24,12]};
export const HUI_MING_ARCHER_DESCRIPTION='Prioritize attacking opposite attribute enemies';
export const HUI_MING_BLOCK_DESCRIPTION="Can only be blocked by player's units of the same attribute.";
export const isHuiMingArcher=r=>!!r&&r.prefabKey.startsWith('enemy_1124_');
export const isHuiMingBlockee=r=>!!r&&r.prefabKey.startsWith('enemy_1127_');
export const isHuiMingBlaster=r=>!!r&&r.prefabKey.startsWith('enemy_1126_');
export const HUI_MING_BLAST_DESCRIPTION='Explodes upon death, dealing Arts damage to friendly units. Causes even greater damage if similar units of the opposite attribute are in its vicinity';
export const isHuiMingCharger=r=>!!r&&r.prefabKey.startsWith('enemy_1128_');
export const HUI_MING_CHARGE_DESCRIPTION="Can charge its attacks. If not interrupted, causes Arts damage and shifts target's Ming and Hui attribute.";
export const isHuiMingRecord=r=>isPlainHuiMing(r)||isHuiMingArcher(r)||isHuiMingBlockee(r)||isHuiMingBlaster(r)||isHuiMingCharger(r);
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
// 'Smarty': attribute-dependent blasts on death and on meeting an opposite-attribute Smarty.
// The elite variant must come closer before it sets a neighbour off.
const blastTriggerRadius=r=>r.prefabKey.endsWith('_2')?Math.fround(.8):1;
const blastGroups={yinyang:['buff_yinyang[diff].atk_scale','buff_yinyang[same].atk_scale','dynamic'],boom:['atk_scale','atk_scale_2'],boomtosame:['atk_scale','atk_scale_2'],boomtodiff:['atk_scale','atk_scale_2']};
const blastDamage=scaleVar=>({_sourceType:'SOURCE',_targetType:'TARGET',_damageType:'MAGICAL',_atkScaleVar:scaleVar,_defaultAtkScale:1,_applyWay:'NONE',_baseOnHostAtk:false,_emitSourceOnCalculateDamage:false,_attackType:'SPLASH',_forceUseProjectileCachedAtk:false,_ignoreForSp:false,_ignoreMissFlag:'NONE',_ignoreCancelReasonMask:'NONE',_modifierKey:'',_assignRealDamageToBB:false,_assignFinalDamageToBB:false,_skipModifierEvent:false,_noSource:false,_onlyUseSourceOnCalculateDamage:false,_getCachedAtkFromBlackboard:false,_cachedAtkKey:'atk',_useSourceWhenUseCachedAtk:false,_setSharedFlag:false,_sharedFlagIndex:'IS_CONTINUOUS',$type:'Torappu.Battle.Action.Nodes+AdvancedApplyDamage'});
const holds=keys=>({_targetType:'TARGET',_buffKeys:keys,isAND:false,_loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false,$type:'Torappu.Battle.Action.Nodes+CheckContainsBuff'});
const blastAbility=(c,{buffKey,projectile,actions})=>{let parsed;try{parsed=JSON.parse(c?._projectileActions?.SerializedState);}catch{return false;}
 return fields(c,{m_Script:{m_FileID:1,m_PathID:'2574888870568471093'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0,_projectileBuffs:[],_ignoredProjectileEvents:[]})&&same(c._projectileActions.SerializedObjectReferences??[],[])
  &&c._buffs.length===1&&same(c._buffs[0].attributes,noAttributes)&&fields(c._buffs[0],{buffKey,templateKey:'projectile_on_buff_start',lifeTimeType:2,loadFromDB:0,isSilenceable:0,overrideType:0,maxStackCnt:1,triggerLifeType:0,triggerInterval:-1,stripBlackboardParamsWithBuffKey:0,blackboard:[{key:'projectile',value:0,valueStr:projectile}]})&&same(parsed,actions);};
const blastProjectile=(n,key,radius,effects)=>{const parts=n.$projectile(key),life=parts.find(c=>'_lifeTime'in c),area=parts.find(c=>'_targetOptions'in c);
 return parts.length===(effects?4:3)&&!parts.some(c=>'_speed'in c||'_moveType'in c)&&parts.some(c=>fields(c,{m_Radius:radius,m_Enabled:1,m_Offset:{x:0,y:0}}))
  &&fields(life,{m_Script:{m_FileID:1,m_PathID:'-8797129986015012478'},_lifeTimeType:1,_lifeTime:Math.fround(.2),_hitNumType:2,_alwaysReachInTheEnd:1,_randomDelayToBorn:0})&&same(life._actionController?._extraBuffsInTheEnd,[])
  &&fields(area,{_onlyCheckHitWhenReachTarget:1,_goThroughWall:1,_ignoreCamouflage:1,_rangeToLoad:{m_FileID:0,m_PathID:'0'}})&&fields(area._targetOptions,{targetSide:2,targetMotion:1,targetCategory:1,enableAdvancedOptions:1,ignoreTargetFree:0,ignoreAllyTargetFree:0,professionMask:0,abnormalFlag:0,excludeAbnormalFlag:0});};
const neighbourAura=(n,c,{buffKey,templateKey,radius,passive})=>{const siblings=n.$siblings(c),validator=n.$ref(c?._targetValidator);
 return fields(c,{m_Script:{m_FileID:1,m_PathID:'9073738633337710967'},_selector:{m_FileID:0,m_PathID:'0'},_selfOption:2,_removeBuffWhenTargetLeave:1,_removeBuffWhenAbilityDetached:1,_onlyAddBuffOnceForEachTarget:0,_ignoreOwnerFakeDeath:0,_ignoreIfOwnerDead:0})&&c._targetValidator.m_FileID===0&&nativeUnscaledTalentBinding(n,c)
  &&c._buffs.length===1&&passiveOutcomeBuff(c._buffs[0])&&fields(c._buffs[0],{buffKey,templateKey,blackboard:[],disableOverride:1,overrideType:0,triggerLifeType:2,triggerInterval:Math.fround(.09),waitFirstTriggerInterval:1,firstTriggerInterval:-1})
  &&(passive?c._passiveBuffs.length===1&&passiveOutcomeBuff(c._passiveBuffs[0])&&fields(c._passiveBuffs[0],{buffKey:'spslme_t',templateKey:'empty',blackboard:[],overrideType:0,triggerLifeType:0}):c._passiveBuffs.length===0)
  &&siblings.some(v=>fields(v,{m_Radius:radius,m_Enabled:1,m_IsTrigger:true,m_Offset:{x:0,y:0}}))&&siblings.some(v=>fields(v,{m_LocalPosition:{x:0,y:0,z:0},m_LocalScale:{x:1,y:1,z:1}}))
  &&fields(validator,{m_Script:{m_FileID:1,m_PathID:'-5482140055134904783'},_excludeKey:0,_buffs:['spslme_t'],_filterBuffSource:0})
  &&fields(validator._targetOptions,{targetSide:1,targetMotion:3,targetCategory:1,enableAdvancedOptions:1,ignoreTargetFree:1,ignoreAllyTargetFree:1,ignoreHealFree:0,ignoreMotionMode:0,ignoreTargetSide:0,excludeSomeAbnormalFlags:0,containSomeAbnormalFlags:0,excludeAbnormalFlag:0,containAbnormalFlag:0,purposeMask:0,professionMask:0,checkUnitType:0,unitTypeMask:0,onlyIgnoreSomeOfTargetFreeCase:0,abnormalFlag:0,abnormalCombo:0});};
const modeSwitch=index=>({$type:type('SwitchMode'),_modeIndex:index,_loadModeFromBlackboard:false,_restoreDefault:false,_restartFSM:false,_targetType:'TARGET'});
const byAttribute=(yin,yang)=>({$type:type('IfElse'),_conditionNode:has('BUFF_OWNER','buff_yin'),_succeedNodes:[modeSwitch(yin)],_failNodes:[has('BUFF_OWNER','buff_yang'),modeSwitch(yang)]});
const finishDerived={$type:type('FinishDerivedBuff'),_updateOverrideMap:true};
const neighbourBuff=(key,extra)=>({attributes:noAttributes,buffKey:key,loadFromDB:false,isDurableBuff:false,isDamageMissable:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,statusResistable:'AUTOMATIC',disableOverride:false,overrideKey:'',overrideType:'DEFAULT',maxStackCnt:1,refreshRemainingTimeWhenStackMax:false,clearAllStackCntWhenTimeUp:false,maxValidStackCnt:-1,independentCharacterSource:false,overrideOnEventPriority:false,onEventPriority:'DEFAULT',audioSignal:'',lifeTimeType:'INFINITY',takeSnapshotWhenExtend:false,durationKey:'',lifeTime:0,waitFirstTriggerInterval:true,firstTriggerInterval:-1,priority:-1,priorityBBKeys:[],stripBlackboardParamsWithBuffKey:false,blackboard:[],...extra});
// One polled neighbour template: act only when the aura source and the neighbour hold opposite attributes.
const neighbourTemplate=(templateKey,key,buff,derived)=>{const create=[{$type:type('CheckContainsDerviedBuff'),_derviedBuffKey:key},{$type:type('IfNot')},{$type:type('CreateBuff'),_buff:buff,_buffOwner:'BUFF_OWNER',_isDerivedBuff:derived,_finishDerivedBuffIfParentFinish:false}];
 const branch=(mine,theirs,otherwise)=>({$type:type('IfElse'),_conditionNode:has('BUFF_SOURCE',mine),_succeedNodes:[{$type:type('IfElse'),_conditionNode:has('BUFF_OWNER',theirs),_succeedNodes:create,_failNodes:[finishDerived]}],_failNodes:otherwise});
 return template(templateKey,{ON_BUFF_TRIGGER:[branch('buff_yin','buff_yang',[branch('buff_yang','buff_yin',[finishDerived])])]});};
const blastTemplates={
 'enemy_spslme_t[default_boom]':template('enemy_spslme_t[default_boom]',{ON_OWNER_KILLED:[byAttribute(1,2)]}),
 'enemy_spslme_t[boom]':template('enemy_spslme_t[boom]',{ON_BUFF_START:[byAttribute(3,4)],ON_BUFF_TRIGGER:[{$type:type('InstantKill'),_targetType:'TARGET',_killSource:false,_noSource:false,_withdrawIfRallyPoint:false,_resultIfInRallyPointMode:false,_skipReborn:false,_noReason:false,_markReachExit:false,_switchState:false}]}),
 'enemy_spslme_t[detect]':neighbourTemplate('enemy_spslme_t[detect]','spslme_t[mark]',neighbourBuff('spslme_t[mark]',{templateKey:'empty',overrideEffectKey:'enemy_spslme_warning_buff',triggerLifeType:'IMMEDIATELY',triggerCnt:0,triggerInterval:-1}),true),
 'enemy_spslme_t[to_boom]':neighbourTemplate('enemy_spslme_t[to_boom]','spslme_t[boom]',neighbourBuff('spslme_t[boom]',{templateKey:'enemy_spslme_t[boom]',overrideEffectKey:'',triggerLifeType:'LIMITED',triggerCnt:1,triggerInterval:Math.fround(.1)}),false),
 projectile_on_buff_start:template('projectile_on_buff_start',{ON_BUFF_START:[{$type:type('CheckAbnormalFlag'),_abnormalFlag:'SILENCED',_targetType:'SOURCE',_isUnset:true},{$type:type('EmitProjectile'),_mountPoint:'MUZZLE',_emitOnRootTile:false,_ev:'ON_HIT_OBJECT',_actions:[],_overwriteActions:false,_buffDataList:[],_overwriteBuffs:false,_sourceType:'BUFF_OWNER',_targetType:'TARGET',_targetPosFromBB:false,_projectileKey:'',_useProjectileAsTarget:false,_extraBlackboard:false,_overwriteBlackboard:false,_useTileAsTarget:false,_cacheAtkToActions:false,_useTargetRootTile:false,_useAbilityTileSelector:false,_abilityName:''}]}),
};
export function huiMingBlasterNative(r,n){
 const bb=r.talents?.bb??{},scales=['boom.atk_scale','boom.atk_scale_2','boomtosame.atk_scale','boomtosame.atk_scale_2','boomtodiff.atk_scale','boomtodiff.atk_scale_2'];
 if(!isHuiMingBlaster(r)||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal||!huiMingBlackboard(r)||!same(r.talents.groups,blastGroups)||!same(r.talents.bbStr,{})
  ||Object.keys(bb).length!==9||scales.some(k=>!(bb[k]>=0))||!same(r.abilities,[{text:HUI_MING_BLOCK_DESCRIPTION,format:'NORMAL'},{text:HUI_MING_BLAST_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes);
 if(!fields(root,{...rootFields,_specialBlockCondition:{_type:1,_buffKeyPairs:pairs,_filterTags:[]},_commonAbilities:[]})||root._modes.length!==5||n.AtkUp||n.Taunt||!huiMingAccountNative(n))return false;
 // The templates switch by index, so the five modes must sit in this order.
 if(!['Default','DefaultBoomFromYin','DefaultBoomFromYang','BoomFromYin','BoomFromYang'].every((name,i)=>n[name]?.length===1&&n[name][0]===n.$ref(root._modes[i])))return false;
 // Every mode keeps the same ordinary Arts melee packet and no general ability; the blasts are mode-scoped talents.
 for(const ref of root._modes){const mode=n.$ref(ref);if(ref.m_FileID!==0||!mode||!zero(mode._attack)||!zero(mode._attackTrigger)||mode._generalAbilities.length||mode._combat.m_FileID!==0||!zero(mode._animatorHooker)||!ordinaryMeleePacketNative(n.$ref(mode._combat),{damageType:2}))return false;}
 const death=(n.Boom??[]).filter(v=>v.m_Script?.m_PathID==='3800760148018415462'),emitters=name=>(n[name]??[]).filter(v=>'_projectileActions'in v);
 if(death.length!==1||!nativeUnscaledTalentBinding(n,death[0])||death[0]._buffs.length!==1||!same(death[0]._buffs[0].attributes,noAttributes)
  // The retained descriptor carries an unused trigger count of 2 with no trigger clock.
  ||!fields(death[0]._buffs[0],{buffKey:'spslme_t[default_boom]',templateKey:'enemy_spslme_t[default_boom]',blackboard:[],overrideType:0,overrideKey:'',loadFromDB:0,lifeTimeType:2,lifeTime:0,maxStackCnt:1,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isDurableBuff:0,triggerLifeType:0,triggerInterval:-1,triggerCnt:2})
  ||(n.Boom??[]).length!==5||(n.BoomToSame??[]).length!==4||(n.BoomToDiff??[]).length!==4)return false;
 // Four blast modes: small or large, entered holding yin or yang. Each owns one emitter per recipient class.
 for(const [suffix,scaleVar]of [['','atk_scale'],['_s','atk_scale_2']]){
  const expect=(name,buffKey,projectile,actions)=>emitters(name).filter(c=>blastAbility(c,{buffKey,projectile,actions})&&nativeUnscaledTalentBinding(n,c)).length;
  if(expect('Boom','spslme_t[boom_to_normal]',`projectile_enemy_spslme${suffix}_1`,[holds(['buff_yin','buff_yang']),{$type:'Torappu.Battle.Action.Nodes+IfNot'},blastDamage(scaleVar)])!==2)return false;
  for(const name of ['BoomToSame','BoomToDiff'])for(const attribute of ['yin','yang'])
   if(expect(name,`spslme_t[boom_to_${attribute}]`,`projectile_enemy_spslme${suffix}`,[holds([`buff_${attribute}`]),blastDamage(scaleVar)])!==1)return false;
 }
 if(!Object.entries(blastTemplates).every(([key,value])=>same(n.$template(key),value))
  ||!blastProjectile(n,'projectile_enemy_spslme',1.25,false)||!blastProjectile(n,'projectile_enemy_spslme_1',1.25,true)||!blastProjectile(n,'projectile_enemy_spslme_s',2,false)||!blastProjectile(n,'projectile_enemy_spslme_s_1',2,true)
  ||!neighbourAura(n,n.BoomHint?.find(v=>v._buffs),{buffKey:'spslme_t[detect]',templateKey:'enemy_spslme_t[detect]',radius:1.5,passive:true})
  ||!neighbourAura(n,n.BoomTrigger?.find(v=>v._buffs),{buffKey:'spslme_t[to_boom]',templateKey:'enemy_spslme_t[to_boom]',radius:blastTriggerRadius(r),passive:false}))return false;
 return clocked(r,n,root);
}
// 'Envy': ordinary Arts projectiles plus a charged cast that flips the Hui-Ming mark tile under its target.
const chargeSkill={prefabKey:'ChargeAttack',priority:0,cooldown:60,initCooldown:10,spCost:0,bb:{atk_scale:2,duration:5},bbStr:{}};
const flipTile=[{_operation:'FLIP_BOOL',_modeIndex:0,_decBbKey:'',_useSwitchResult:false,_specifyTileType:false,_tileType:'REED_TILE',_useOwnerRootTile:false,$type:'Torappu.Battle.Action.Nodes+SwitchDynamicBuffTileMode'}];
export function huiMingChargerNative(r,n){
 if(!isHuiMingCharger(r)||r.applyWay!=='RANGED'||r.stats.rangeRadius!==2.5||r.stats.dmgType!=='arts'||r.stats.motion!=='WALK'||r.level!==0||r.sp||r.notCountInTotal||!huiMingBlackboard(r)
  ||!same(Object.keys(r.talents.groups),['yinyang'])||!same(r.talents.bbStr,{})||Object.keys(r.talents.bb).length!==3||!same(r.abilities,[{text:HUI_MING_CHARGE_DESCRIPTION,format:'NORMAL'}])||!same(r.skills,[chargeSkill]))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),attack=n.$ref(mode?._attack);
 if(!fields(root,{...rootFields,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[]})||root._modes.length!==1||root._modes[0].m_FileID!==0||!mode||mode._generalAbilities.length
  ||!same(mode._combat,mode._attack)||mode._attack.m_FileID!==0||mode._attackTrigger.m_FileID!==0||n.AtkUp||n.Taunt||!huiMingAccountNative(n)
  ||!ordinaryProjectilePacketNative(attack,{projectileKey:'projectile_enemy_spmage',type:2})||!ordinaryRangedSelectorNative(n,n.$ref(mode._attackTrigger),{radius:2,abnormalFlag:20})
  ||!linearSingleProjectileNative(n,'projectile_enemy_spmage',{speed:10,lifetime:10}))return false;
 const wrapper=n.ChargeAttack?.find(v=>'_familyMask'in v),cast=n.$siblings(wrapper).find(v=>v.m_Script?.m_PathID==='551713621458524560'),trigger=n.$ref(wrapper?._trigger),siblings=n.$siblings(trigger);let actions;
 try{actions=JSON.parse(cast?._actions?.SerializedState);}catch{return false;}
 if(!fields(wrapper,{m_Script:{m_FileID:1,m_PathID:'-5087399121287503180'},_familyMask:3,_checkParentActive:0,_maxTriggerTime:-1,_resetMainAbilityCdWhenCastEnd:1,_resetCdWaitFirstPeriod:1,_overwriteInitCooldown:-1,_ignoreSilence:0,_immuneStunWhenAffecting:0,_addEnemyIdToSignalId:1,_castLikeAttack:0})||wrapper._trigger.m_FileID!==0
  ||!fields(cast,{_selector:{m_FileID:0,m_PathID:'0'},_actionEvent:2,_overwriteAbilityActions:0,_activeBuffs:[],_affectedBySlowDown:0,_allowNoTarget:0,_alwaysIncludeTarget:1,_animKey:'Skill',_endAnimKey:'Idle',_atkScale:1,_atkScaleKey:'atk_scale',_attackType:1,_cooldown:0,_cooldownKey:'duration',_damageType:2,_elementDamageType:0,_epDamageRatio:0,_extraDamageType:0,_extraProjectileKeys:[],_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0,_interuptIfTargetDead:0,_maxAnimScale:-1,_preDelay:0,_escapeTime:0,_projectileKey:'projectile_enemy_spmage_s',_resetCdStrategy:1,_selectTargetSource:2,_selectTargetTiming:0,_timeMode:3,_useDynamicAttackType:0,_waitForAttackEvent:1,_waitForProjectileInvalid:0})
  ||!same(cast._actions.SerializedObjectReferences??[],[])||!same(actions,flipTile)
  ||!fields(trigger,{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_keepTarget:0,_minTargetNum:1,_overrideSearchTargetTick:-1})||siblings.filter(c=>c.m_Script).length!==3
  ||!siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6185056810787956083'},_useBlackboardRangeId:0,_extendable:0,_scaleble:0}))||!siblings.some(c=>fields(c,{m_Radius:2,m_Enabled:1,m_Offset:{x:0,y:0}}))
  // The skill only selects a ground ally holding the tile's same-attribute scale buff, that is, one standing on a mark tile.
  ||!siblings.some(c=>fields(c,{m_Script:{m_FileID:1,m_PathID:'6959540303033999559'},_targetSide:2,_targetMotion:1,_targetCategory:1,_postFilter:4,_ignoreTargetFree:0,_abnormalFlag:20,_abnormalCombo:2,_ignoreAllyTargetFree:0,_ignoreMotionMode:0,_forceIgnoreCamouflage:0,_excludeAbnormalFlag:46,_limitTargetNum:1,_maxTargetKey:'max_target',_maxNum:1,_excludeOwner:0,_sortByTauntAtLast:0,_ignoreHitRange:0,_checkUnitType:0,_unitTypeMask:0,_tagExcluded:0,_filterTag:'',_filterTagList:[],_buffKeyExcluded:0,_buffKey:'buff_yinyang[same]',_buffs:[],_checkOrInsteadOfAnd:0,_filterBuffSource:0,_filterTokenHost:0})))return false;
 const parts=n.$projectile('projectile_enemy_spmage_s'),life=parts.find(c=>'_lifeTime'in c),move=parts.find(c=>'_moveType'in c),box=parts.find(c=>'m_Size'in c),select=parts.find(c=>'_onlyCheckHitWhenStop'in c);
 if(parts.length!==8||!same(parts.map(c=>c.m_Script?.m_PathID??'geometry').sort(),['-1429203677512073985','-7891991905135157257','-8600852259007838266','-8797129986015012478','4158870186494526771','6834194400804168919','geometry','geometry'])||!fields(life,{_lifeTimeType:1,_lifeTime:10,_hitNumType:1,_maxHitNum:1,_randomDelayToBorn:0})||!same(life._actionController?._extraBuffsInTheEnd,[])||!fields(move,{_moveType:1,_speed:10,_delayToStart:0})
  ||!fields(box,{m_Size:{x:1,y:1},m_Offset:{x:0,y:0},m_Enabled:1})||!fields(select,{_onlyCheckHitWhenStop:1,_onlyCheckHitWhenReachTarget:0,_hitPasserby:0,_exceptSource:0,_exceptTraceTarget:0,_limitedHitTimes:0}))return false;
 const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
 return clocked(r,n,root)&&graphic._animations.some(v=>v.animKey==='Skill'&&v.animName==='Skill'&&v.speed===1&&!v.loop)
  &&clock.durations.Skill===Math.fround(95/30)&&same(clock.events.Skill,[{time:Math.fround(64/30),name:'OnAttack',int:0,float:0,string:''}]);
}
export const huiMingNative=(r,n)=>isHuiMingArcher(r)?huiMingArcherNative(r,n):isHuiMingBlockee(r)?huiMingBlockeeNative(r,n):isHuiMingBlaster(r)?huiMingBlasterNative(r,n):isHuiMingCharger(r)?huiMingChargerNative(r,n):plainHuiMingNative(r,n);
// The charge lasts the skill's blackboard duration; the 95-frame Skill clip and its frame-64 release are stretched to it.
export const HUI_MING_CHARGE_ABILITY={kind:'huiMingChargedShift',params:r=>{const c=clocks.enemies[r.prefabKey],skill=r.skills[0],stretch=skill.bb.duration/c.durations.Skill;
 return{attack:{type:'arts',speed:10,lifetime:10,noAir:true,animation:{clip:'Attack',duration:c.durations.Attack,releases:c.events.Attack.map(v=>v.time),maxScale:1}},
  charge:{type:'arts',initial:skill.initCooldown,cooldown:skill.cooldown,duration:skill.bb.duration,release:c.events.Skill[0].time*stretch,clip:'Skill',clipDuration:c.durations.Skill,scale:skill.bb.atk_scale,speed:10,lifetime:10,requiredBuff:'buff_yinyang[same]'}};}};
export const HUI_MING_BLAST_ABILITY={kind:'huiMingBlast',params:r=>{const bb=r.talents.bb;return{markerKey:'spslme_t',deathKey:'spslme_t[default_boom]',boomKey:'spslme_t[boom]',warnKey:'spslme_t[mark]',interval:Math.fround(.09),hintRadius:1.5,triggerRadius:blastTriggerRadius(r),killDelay:Math.fround(.1),blastDelay:Math.fround(.2),blockPairs:pairs,
 small:{radius:1.25,none:bb['boom.atk_scale'],same:bb['boomtosame.atk_scale'],diff:bb['boomtodiff.atk_scale']},large:{radius:2,none:bb['boom.atk_scale_2'],same:bb['boomtosame.atk_scale_2'],diff:bb['boomtodiff.atk_scale_2']}};}};
export const HUI_MING_ABILITY={kind:'huiMingAttribute',params:r=>({...huiMingBlackboard(r),...(isHuiMingFury(r)?{bonus:{key:'spklr_t',scale:r.talents.bb['atkup.atk_scale']}}:{}),...(isHuiMingArcher(r)?{preferOpposite:true}:{})})};
export const HUI_MING_BLOCK_ABILITY={kind:'pairedBlockerBuffs',params:()=>({pairs,checkBuffKey:'enemy_sptrkg_t',interval:Math.fround(.1),immediate:false,program:nativeBuffProgram('enemy_sptrkg_t')})};
