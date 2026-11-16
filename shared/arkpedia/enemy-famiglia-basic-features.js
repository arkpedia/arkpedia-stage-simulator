import {nativeTaggedDeviceSpSelector,nativeSelectedSpRewardBuff as rewardBuff} from './enemy-device-sp-selector-contract.js';
// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty,nativeKillLog,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
import {ordinaryMeleePacketNative} from './enemy-ordinary-body-contract.js';
import {nativeBuffProgram,nativeBuffProgramSupported} from './native-buff-programs.js';
import clocks from '../../data/arkpedia-famiglia-basics-animations.json' with{type:'json'};
const config={enemy_1277_sgman:{sp:20,log:true},enemy_1277_sgman_2:{sp:35,log:true},enemy_1279_sgbdg:{sp:80,taunt:1},enemy_1279_sgbdg_2:{sp:80,taunt:1}};
export const isFamigliaBasic=r=>!!r&&Object.hasOwn(config,r.prefabKey);
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const zero=v=>v?.m_FileID===0&&v.m_PathID==='0';
const type=name=>`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;

const names=r=>r.prefabKey.includes('sgman')?{parent:'enemy_sgman_death',template:'enemy_sgman_death_rattle',reward:'sgman_modify_vg'}:{parent:'enemy_sgbdg_death',template:'enemy_sgbdg_death_rattle',reward:'sgbdg_modify_vg'};
const text=r=>config[r.prefabKey].log?'Increases Blood Debt by a miniscule amount when defeated':'Increases Blood Debt when defeated';
export function famigliaBasicNative(r,n){
 const c=config[r.prefabKey];if(!c||r.level!==0||r.applyWay!=='MELEE'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,[...(c.taunt?[{text:'More likely to be attacked by allied units',format:'NORMAL'}]:[]),{text:text(r),format:'NORMAL'}])
  ||!same(r.talents,{bb:{'DeathRattle.sp':c.sp,...(c.taunt?{'DeathRattle.taunt_level':c.taunt}:{})},bbStr:{},groups:{DeathRattle:c.taunt?['sp','taunt_level']:['sp']}}))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),graphic=n.$ref(root?._animator),clock=clocks.enemies[r.prefabKey],parent=n.DeathRattle?.find(v=>v._buffs),buff=parent?._buffs?.[0],keys=names(r);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1})
  ||root._modes.length!==1||root._commonAbilities.length!==1||!mode||mode._generalAbilities.length||!zero(mode._attack)||!zero(mode._attackTrigger)
  ||[root._animator,...root._modes,...root._commonAbilities,mode._combat,mode._attack,mode._attackTrigger].some(ref=>ref.m_FileID!==0)
  ||!ordinaryMeleePacketNative(n.$ref(mode._combat))||!clock||n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID!==clock.source.skeletonDataPathId
  ||!graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  ||clock.durations.Attack!==(c.taunt?Math.fround(39/30):1)||!same(clock.events.Attack,[{time:Math.fround(c.taunt?13/30:17/30),name:'OnAttack',int:0,float:0,string:''}])
  ||!fields(parent,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})||parent._buffs.length!==(c.log?2:1)
  ||!n.$siblings(parent).some(v=>fields(v,{m_Script:{m_FileID:1,m_PathID:'-2726233351382997147'},_overwriteTalentKey:'',_attachInDummy:0,_applyTalentScale:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[]}))
  ||!fields(buff,{buffKey:keys.parent,templateKey:keys.template,loadFromDB:0,isDurableBuff:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,maxStackCnt:1,overrideType:0,blackboard:[]})
  ||!same(buff.attributes,{abnormalFlags:[],abnormalImmunes:[],abnormalAntis:[],abnormalCombos:[],abnormalComboImmunes:[],attributeModifiers:c.taunt?[{attributeType:20,formulaItem:0,value:0,loadFromBlackboard:1,fetchBaseValueFromSourceEntity:0}]:[]})
  ||c.log&&(!passiveOutcomeBuff(parent._buffs[1])||!fields(parent._buffs[1],{buffKey:'enemy_sgman_dead_log',templateKey:'log_killed',blackboard:[]})||!nativeKillLog(n)))return false;
 const template={templateKey:keys.template,effectKey:'',onEventPriority:'DEFAULT',eventToActions:{ON_OWNER_KILLED:[{$type:type('CreateBuffUseAbilitySelector'),_sourceType:'BUFF_OWNER',_targetType:'BUFF_OWNER',_abilityName:'SelectVg',_excludeTarget:false,_excludeTargetType:'SOURCE',_buff:rewardBuff(keys.reward),_isDerivedBuff:false,_finishDerivedBuffIfParentFinish:false}]}};
 if(!same(n.$template(keys.template),template)||!nativeBuffProgramSupported('modify_sp[start]',n))return false;
 return nativeTaggedDeviceSpSelector(n,root._commonAbilities[0]);
}
export const FAMIGLIA_BASIC_FEATURES={
 'talent:DeathRattle':{matchesRecord:isFamigliaBasic,covers:famigliaBasicNative,nativeClaim:(_p,n)=>Object.keys(config).some(key=>n[key])?{active:1}:{},explains:(value,r)=>isFamigliaBasic(r)&&value===text(r),ability:{kind:'selectedDeathSp',params:r=>{const c=config[r.prefabKey];return{parentKey:names(r).parent,mods:c.taunt?{taunt:c.taunt}:{},selector:{tag:'vgctrl',side:'both',maxTargets:1},blackboard:{sp:c.sp},program:nativeBuffProgram('modify_sp[start]'),...(c.log?{log:{key:'killed',buffKey:'enemy_sgman_dead_log'}}:{})};}}},
 'native:famigliaBasicMelee':{matchesRecord:isFamigliaBasic,covers:famigliaBasicNative,ability:{kind:'animatedMeleeAttack',params:r=>({type:'phys',animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time),maxScale:1}})}},
};
