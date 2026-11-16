// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import grenadeClocks from '../../data/arkpedia-energy-grenadiers-animations.json' with{type:'json'};
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,arcBoxProjectileNative} from './enemy-ordinary-projectile-contract.js';
import clocks from '../../data/arkpedia-energy-basics-animations.json' with{type:'json'};
const configs={
 enemy_1359_ekulsr:{capacity:30,duration:20,initial:25,decay:5,grenade:true},enemy_1359_ekulsr_2:{capacity:30,duration:20,initial:25,decay:5,grenade:true},
 enemy_1353_esabr:{capacity:10,duration:10},enemy_1353_esabr_2:{capacity:10,duration:10},
 enemy_1354_eghost:{capacity:5,duration:10,ghost:true},enemy_1354_eghost_2:{capacity:5,duration:10,ghost:true},
 enemy_1358_esheld:{capacity:20,duration:20,initial:15,decay:10},enemy_1358_esheld_2:{capacity:20,duration:20,initial:15,decay:10},
};
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const matchesRecord=r=>!!configs[r.prefabKey];
const shortOverload='[Overload] Greatly increases ASPD, DEF, and RES for a period of time.';
const longOverload='[Overload] Greatly increases ASPD, DEF, and RES for a longer period of time.';
const descriptions=c=>c.ghost?['Unblockable. Energy Capacity: 5; gains [Overload] upon reaching max Energy',shortOverload]
 :[`Energy Capacity: ${c.capacity}; Gains [Overload] upon reaching max Energy.`,...(c.decay?[`Starts with an additional ${c.initial} Energy, but loses 1 Energy per ${c.decay} seconds.`]:[]),...(c.grenade?['While not blocked, launches grenades that deal damage to the target and surrounding units.']:[]),c.duration===10?shortOverload:longOverload];
const talent=c=>({'over_energy.duration':c.duration,'over_energy.attack_speed':120,'over_energy.def':2,'over_energy.magic_resistance':30,
 'blacksteel_energy.max_stack_cnt':c.capacity,...(c.initial?{'blacksteel_energy.init_stack_cnt':c.initial}:{}),...(c.decay?{'dec_energy.dec_count':-1,'dec_energy.interval':c.decay}:{})});
const groups=c=>({over_energy:['attack_speed','def','duration','magic_resistance'],blacksteel_energy:[...(c.initial?['init_stack_cnt']:[]),'max_stack_cnt'],...(c.decay?{dec_energy:['dec_count','interval']}:{})});
const prefabBuff=b=>empty(b?.attributes)&&fields(b,{blackboard:[],loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,maxStackCnt:1,overrideType:0});
const passive=(v,n)=>fields(v,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})
 &&n.$siblings(v).filter(c=>c.m_Script).every(c=>['3800760148018415462','-2726233351382997147'].includes(c.m_Script.m_PathID));
const attr=(attributeType,formulaItem,value,loadFromBlackboard=false)=>({attributeType,formulaItem,value,loadFromBlackboard,fetchBaseValueFromSourceEntity:false});
function database(n){
 const energy=n.$buff('act28side_energy_buff'),over=n.$buff('act28side_over_energy_buff');
 const common={loadFromDB:false,isDurableBuff:false,isSilenceable:false,isStunnable:false,isFreezable:false,isLevitatable:false,isGroundBoundable:false,
  templateKey:'empty',disableOverride:false,maxStackCnt:1,lifeTime:0,triggerCnt:0,triggerInterval:-1};
 return fields(energy,{...common,buffKey:'act28side_energy_buff',lifeTimeType:'INFINITY',overrideType:'STACK'})
  &&same(energy.attributes,{abnormalFlags:null,abnormalImmunes:null,abnormalAntis:null,abnormalCombos:null,abnormalComboImmunes:null,
   attributeModifiers:[attr('ATK','MULTIPLIER',.1),attr('DEF','MULTIPLIER',.2)]})
  &&fields(over,{...common,buffKey:'act28side_over_energy_buff',lifeTimeType:'LIMITED',durationKey:'duration',overrideType:'DEFAULT'})
  &&same(over.attributes,{abnormalFlags:null,abnormalImmunes:null,abnormalAntis:null,abnormalCombos:null,abnormalComboImmunes:null,
   attributeModifiers:[attr('ATTACK_SPEED','ADDITION',0,true),attr('DEF','FINAL_SCALER',0,true),attr('MAGIC_RESISTANCE','ADDITION',0,true)]});
}
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const contains=target=>({$type:type('CheckContainsBuff'),_targetType:target,_buffKeys:['blacksteel_energy[mark]'],isAND:true,
 _loadFromBlackboard:false,_checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false});
const trigger={ $type:type('TriggerSpecifiedAbility'),_ownerType:'BUFF_OWNER',_targetType:'TARGET',_abilityName:'blacksteel_energy',
 _checkCanUseAblityFlag:false,_triggerStealAttrAbility:false,_triggerEnergyBuffAbility:true,_triggerProjectileToTileOnceAbilityBySubSelector:false};
const clearTemplate={templateKey:'enemy_esabr_clear_energy',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_START:[contains('TARGET'),
 {$type:type('ModifyAbilityBlackboard'),_blackboardKeys:'blacksteel_energy',_fromBlackboardKeys:null,fromAbilityBlackBoard:false,_fromBuffBlackboard:false,
  _buffKey:null,_value:0,_useOtherAbility:true,_abilityName:'blacksteel_energy',_abilityOwnerType:'TARGET',_isUpdateSelector:false,_assignString:false,_stringValue:null},trigger]}};
const decayTemplate={templateKey:'enemy_esheld_dec_energy[trigger]',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_BUFF_TRIGGER:[contains('TARGET'),
 {$type:type('CheckContainsBuff'),_targetType:'BUFF_OWNER',_buffKeys:['act28side_over_energy_buff'],isAND:true,_loadFromBlackboard:false,
  _checkBuffSource:false,_buffSourceType:'BUFF_SOURCE',_checkSourceHost:false},{$type:type('IfNot')},
 {$type:type('AddAbilityBlackboard'),_blackboardKeys:'blacksteel_energy',_addBlackboardKey:'dec_count',_fromOwnerBlackBoard:true,_isMinus:false,
  _isLimitValue:false,_limitValueKey:null,_limitValue:0,_abilityName:'blacksteel_energy',_abilityOwnerType:'BUFF_OWNER',_isUpdateSelector:false},
 {...trigger,_targetType:'BUFF_OWNER'}]}};
function energyNative(r,n){
 const c=configs[r.prefabKey];if(!c||r.level!==0||r.applyWay!==(c.grenade?'ALL':c.ghost?'NONE':'MELEE')||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,descriptions(c).map(text=>({text,format:'NORMAL'})))||!same(r.talents,{bb:talent(c),bbStr:{},groups:groups(c)}))return false;
 const root=n[r.prefabKey]?.find(v=>'_modes'in v),mode=n.$ref(root?._modes?.[0]),marker=n.$ref(root?._commonAbilities?.[0]);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_blockVolume:1,
  _specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})||root._modes.length!==1||root._commonAbilities.length!==1
  ||!mode||!same(mode._generalAbilities,[])||!c.grenade&&(!zero(mode._attack)||!zero(mode._attackTrigger))||!passive(marker,n)||marker._buffs.length!==1
  ||!prefabBuff(marker._buffs[0])||!fields(marker._buffs[0],{buffKey:'blacksteel_energy[mark]',templateKey:'empty',lifeTimeType:2,lifeTime:0})
  ||!database(n)||!same(n.$template('empty'),{templateKey:'empty',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{}})
  ||!same(n.$template('enemy_esabr_clear_energy'),clearTemplate))return false;
 const energy=n.blacksteel_energy?.find(v=>'_buff'in v),hud=n.$siblings(energy).find(v=>v.m_Script?.m_PathID==='4554755220141895060');
 if(!fields(energy,{m_Script:{m_FileID:1,m_PathID:'6961394047985478546'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_overEnergied:1,_castAbility:'over_energy'})
  ||!empty(energy._buff?.attributes)||!fields(energy._buff,{buffKey:'act28side_energy_buff',templateKey:'empty',loadFromDB:1,blackboard:[]})
  ||!fields(hud,{_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_pluginName:'blacksteel_energy_hud_plugin'}))return false;
 const active=n.over_energy?.find(v=>v.m_Script?.m_PathID==='-4234909118878081699'),finish=n.$siblings(active).find(v=>v.m_Script?.m_PathID==='7085803614365642631');
 if(!fields(active,{_selector:{m_FileID:0,m_PathID:'0'},_waitForAttackEvent:0,_ignoreIfOwnerDead:0,_preDelay:0,_escapeTime:0,_checkBuffEarlyFinish:0,_passiveBuffs:[],_waitForCasting:0,_updateLifetimeWhenSpellStart:0,_enableUpdateCooldown:0,_ignoreInfiniteBuffCooldown:0})
  ||active._buffs.length!==(c.grenade?2:3)||active._buffs.filter(b=>b.buffKey==='act28side_over_energy_buff').length!==1
  ||!active._buffs.every(b=>empty(b.attributes)&&same(b.blackboard,[])&&b.lifeTimeType===1&&b.lifeTime===0&&b.maxStackCnt===1
   &&b.isSilenceable===0&&b.isStunnable===0&&b.isFreezable===0&&b.isLevitatable===0&&b.isGroundBoundable===0
   &&(b.buffKey==='act28side_over_energy_buff'?b.loadFromDB===1:b.loadFromDB===0&&b.templateKey==='empty'&&b.durationKey==='duration'))
  ||!fields(finish,{_onlyCheckOnStopAffect:0})||finish._buffs?.length!==1||!prefabBuff(finish._buffs[0])
  ||!fields(finish._buffs[0],{buffKey:'enemy_esabr_clear_energy',templateKey:'enemy_esabr_clear_energy',lifeTimeType:0,lifeTime:0}))return false;
 if(c.decay){const d=n.dec_energy?.find(v=>'_buffs'in v);
  if(!passive(d,n)||d._buffs.length!==2||!d._buffs.every(prefabBuff)
   ||!fields(d._buffs[0],{buffKey:'enemy_esheld_dec_energy[trigger]',templateKey:'enemy_esheld_dec_energy[trigger]',lifeTimeType:2,triggerLifeType:2,triggerInterval:-1})
   ||!fields(d._buffs[1],{buffKey:'dec_energy[effect]',templateKey:'empty',lifeTimeType:2})||!same(n.$template('enemy_esheld_dec_energy[trigger]'),decayTemplate))return false;
 }
 if(c.ghost)return zero(mode._combat);
 const clock=(c.grenade?grenadeClocks:clocks).enemies[r.prefabKey],graphic=n.$ref(root._animator),combat=n.$ref(mode._combat);
 if(c.grenade)return r.stats.rangeRadius===2.6
  &&ordinaryMeleePacketNative(combat,{clip:'Combat'})
  &&ordinaryProjectilePacketNative(n.$ref(mode._attack),{projectileKey:'projectile_enemy_ekulsr',type:1,selectTargetSource:1,atkScale:.5})
  &&ordinaryRangedSelectorNative(n,n.$ref(mode._attackTrigger),{radius:Math.fround(.0001),motion:1,abnormalFlag:29})
  &&arcBoxProjectileNative(n,'projectile_enemy_ekulsr',{speed:5,lifetime:10,width:3,height:3})
  &&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&['Attack','Combat'].every(clip=>graphic._animations.some(a=>a.animKey===clip&&a.animName===clip&&a.speed===1&&!a.loop)&&clock.durations[clip]===2
   &&same(clock.events[clip],[{time:Math.fround(clip==='Attack'?31/30:25/30),name:'OnAttack',int:0,float:0,string:''}]));
 return ordinaryMeleePacketNative(combat)&&!!clock&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  &&clock.durations.Attack===(c.decay?Math.fround(50/30):1)
  &&same(clock.events.Attack,[{time:Math.fround(c.decay?.8:.4),name:'OnAttack',int:0,float:0,string:''}]);
}
export {energyNative};
const feature={matchesRecord,covers:energyNative};
export const ENERGY_FEATURES={
 'talent:blacksteel_energy':{...feature,explains:(text,r)=>descriptions(configs[r.prefabKey]??{}).includes(text),nativeClaim:()=>({active:1}),
  ability:{kind:'nativeEnergyMeter',params:r=>{const c=configs[r.prefabKey];return{capacity:c.capacity,initial:c.initial??0,perStack:{atkPct:.1,defPct:.2},
   overload:{duration:c.duration,mods:{aspd:120,defMul:2,resFlat:30}},...(c.decay?{decay:{interval:c.decay,amount:1}}:{})};}}},
 'talent:over_energy':feature,'talent:dec_energy':feature,
 'native:energyMeleeAttack':{...feature,ability:{kind:'animatedMeleeAttack',params:r=>({type:'phys',animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}})}},
 'native:energyGrenadeAttack':{...feature,ability:{kind:'blockedMeleeProjectileModes',params:r=>{const clock=grenadeClocks.enemies[r.prefabKey],animation=clip=>({clip,duration:clock.durations[clip],releases:clock.events[clip].map(e=>e.time)});
  return{type:'phys',speed:5,lifetime:10,width:3,height:3,damageScale:.5,noAir:false,groundOnly:true,meleeAnimation:animation('Combat'),rangedAnimation:animation('Attack')};}}},
 'native:energyGhostBody':{...feature,trait:{flags:{unblockable:true}}},
};
