// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
const ids=['enemy_1364_spnaxe','enemy_1364_spnaxe_2'];
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const node=(v,name)=>v?.$type===`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export const isFlayer=r=>ids.includes(r.prefabKey);
export function flayerNative(r,n){
 if(!isFlayer(r)||r.level!==0||r.applyWay!=='ALL'||r.stats.dmgType!=='phys'||r.skills.length||r.sp
  ||!same(r.talents.groups.Attack,['atk','attack@ranged_atk_scale','hp_ratio','max_stack_cnt','range_radius'])
  ||!fields(r.talents.bb,{'Attack.atk':.1,'Attack.attack@ranged_atk_scale':.5,'Attack.hp_ratio':.15,'Attack.max_stack_cnt':15,'Attack.range_radius':1}))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes[0]);
 if(root?._modes.length!==1||root._commonAbilities.length||root._delayToBorn!==0||mode?._generalAbilities.length)return false;
 const melee=n.$ref(mode._combat),ranged=n.$ref(mode._attack),aura=n.Attack?.find(c=>'_targetValidator'in c),buff=aura?._buffs[0];
 const template=r.prefabKey==='enemy_1364_spnaxe_2'?'enemy_spnaxe_buffs2[mark]':'enemy_spnaxe_buffs[mark]';
 if([...root._modes,root._animator,mode._combat,mode._attack,mode._attackTrigger,aura?._targetValidator].some(ref=>ref?.m_FileID!==0))return false;
 const clips=n.$ref(root._animator)?._animations;
 if(!['Attack','Attack_2'].every(name=>clips?.some(a=>a.animKey===name&&a.animName===name&&a.speed===1&&!a.loop)))return false;
 const binding=n.$siblings(aura).find(c=>'_attackBlackboardModeIndex'in c);
 if(!fields(binding,{m_Script:{m_FileID:1,m_PathID:'-1398656344548769790'},_overwriteTalentKey:'',_defaultModeIndex:-1,
  _attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_checkValidBySkillIndex:[],_applyTalentScale:0,
  _influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0}))return false;
 const ordinary={m_Script:{m_FileID:1,m_PathID:'4381884627089348317'},_atkScale:1,_damageType:1,_elementDamageType:0,
  _epDamageRatio:0,_activeBuffs:[],_waitForAttackEvent:1,_preDelay:0,_timeMode:0,_useDynamicAttackType:0};
 if(!fields(melee,{...ordinary,_animKey:'Attack',_atkScaleKey:'atk_scale'})
  ||!fields(ranged,{...ordinary,_animKey:'Attack_2',_atkScaleKey:'ranged_atk_scale'})
  ||!fields(n.$ref(mode._attackTrigger),{m_Script:{m_FileID:1,m_PathID:'8607874384982393801'},_minTargetNum:1,_keepTarget:0})
  ||!fields(aura,{m_Script:{m_FileID:1,m_PathID:'9073738633337710967'},_passiveBuffs:[],_selfOption:0,
   _removeBuffWhenTargetLeave:1,_removeBuffWhenAbilityDetached:1,_onlyAddBuffOnceForEachTarget:0,_ignoreOwnerFakeDeath:0})
  ||!fields(n.$ref(aura._targetValidator)?._targetOptions,{targetSide:3,targetMotion:3,targetCategory:1,enableAdvancedOptions:1,
   ignoreTargetFree:1,ignoreAllyTargetFree:1,professionMask:639,ignoreTargetSide:0})
  ||aura._buffs.length!==1||!fields(buff,{buffKey:'enemy_spnaxe_buffs[mark]',templateKey:template,lifeTimeType:2,
   isSilenceable:0,isStunnable:0,isFreezable:0})||!empty(buff.attributes))return false;
 const events=n.$template(buff.templateKey)?.eventToActions,a=events?.ON_OWNER_FINISH;
 if(!same(Object.keys(events??{}),['ON_OWNER_FINISH'])||a?.length!==5
  ||!node(a[0],'CheckContainsBuff')||!fields(a[0],{_targetType:'BUFF_OWNER',_buffKeys:['enemy_bmbcar2_passive'],isAND:true})
  ||!node(a[1],'IfNot')||!node(a[2],'HealViaMaxHpRatio')||!fields(a[2],{_healTarget:'BUFF_SOURCE',_getMaxHpFromTarget:false,_ignoreHealFree:false,_skipModifierEvent:false})
  ||!node(a[3],'CreateEffect')||a[3]._targetType!=='BUFF_SOURCE'||a[3]._sourceType!=='BUFF_SOURCE'
  ||!node(a[4],'CreateBuff')||!fields(a[4],{_buffOwner:'BUFF_SOURCE',_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false}))return false;
 const stack=a[4]._buff;
 return fields(stack,{buffKey:'enemy_spnaxe_atk[stack]',templateKey:'empty',lifeTimeType:'INFINITY',overrideType:'STACK',
  isSilenceable:false,isStunnable:false,isFreezable:false,maxStackCnt:1,blackboard:[]})
  &&same(stack.attributes,{abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],
   attributeModifiers:[{attributeType:'ATK',formulaItem:'MULTIPLIER',value:0,loadFromBlackboard:true,fetchBaseValueFromSourceEntity:false}]});
}
export const FLAYER_DEPARTURE_ABILITY={kind:'nearbyDepartureGains',params:r=>({radius:r.talents.bb['Attack.range_radius'],
 healRatio:r.talents.bb['Attack.hp_ratio'],atkPerStack:r.talents.bb['Attack.atk'],maxStacks:r.talents.bb['Attack.max_stack_cnt'],
 key:'enemy_spnaxe_atk[stack]',excludedBuffs:['enemy_bmbcar2_passive'],reasons:null})};
export const FLAYER_FEATURES={
 'native:flayerAttackMode':{matchesRecord:isFlayer,covers:flayerNative,
  ability:{kind:'blockedAttackMode',params:r=>({unblockedScale:r.talents.bb['Attack.attack@ranged_atk_scale'],blockedScale:1,
   unblockedClip:'Attack_2',blockedClip:'Attack'})},note:'Original unblocked half-ATK versus blocked full-ATK Physical attack modes'},
};
