// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-blight-archers-animations.json' with{type:'json'};
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {ownerEnvironmentModeEvents} from './enemy-mode-program-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
const ids=['enemy_1391_dhbow','enemy_1391_dhbow_2'],key='enemy_dhbow_passive_check',marker=`${key}[buff]`;
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const matchesRecord=r=>ids.includes(r.prefabKey);
export const BLIGHT_ARCHER_DESCRIPTION='When on Blighted tiles, attacks deal Arts damage';
const condition={op:'environmentCondition',who:'owner',condition:'act31SidePollute'};
const events={...ownerEnvironmentModeEvents(condition),ON_BUFF_TRIGGER:[{op:'when',condition,
 yes:[{op:'when',condition:{op:'all',terms:[{op:'not',value:{op:'buff',who:'owner',keys:[marker],all:true}}]},
  yes:[{op:'deriveMarker',key:marker}],no:[]}],no:[{op:'clearDerivedMarkers'}]}]};
const expected={schemaVersion:1,entry:key,templates:{[key]:{events}}};
export function blightArcherNative(r,n){
 if(!matchesRecord(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal||r.stats.rangeRadius!==1.9
  ||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})||!same(r.abilities,[{text:BLIGHT_ARCHER_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),passive=n.Passive?.find(c=>'_buffs'in c),buff=passive?._buffs?.[0];
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,
  _blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0,_commonAbilities:[]})
  ||root._modes.length!==2||!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})
  ||passive._buffs.length!==1||!empty(buff?.attributes)||!fields(buff,{buffKey:key,templateKey:key,blackboard:[],loadFromDB:0,
   isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,triggerLifeType:2,
   triggerCnt:0,triggerInterval:Math.fround(.1),waitFirstTriggerInterval:1,firstTriggerInterval:-1,maxStackCnt:1,overrideType:0}))return false;
 const wrapper=n.$siblings(passive).find(c=>c.m_Script?.m_PathID==='-2726233351382997147');
 if(!fields(wrapper,{_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,
  _attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_overrideDefaultRangeId:0,_applyTalentScale:0,_influenceSkillBlackboard:0,
  _fromRawDataToSkill:0,_applyTalentRange:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_writeRangeIdToProjectileBlackboard:0,
  _affectWhenNotRootTalent:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleCertainMode:0,_scaleModeIndices:[]}))return false;
 try{if(!same(compileNativeBuffProgram(key,k=>n.$template(k)),expected))return false;}catch{return false;}
 for(const[i,ref]of root._modes.entries()){
  const m=n.$ref(ref),a=n.$ref(m?._attack);
  if(!m||!same(m._combat,m._attack)||!same(m._generalAbilities,[])
   ||!ordinaryProjectilePacketNative(a,{projectileKey:`projectile_enemy_dhbow_${i?'phy':'magic'}`,type:i?1:2,interruptOnDetach:1})
   ||!ordinaryRangedSelectorNative(n,n.$ref(m._attackTrigger),{radius:2,abnormalFlag:32,motion:3}))return false;
 }
 const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  &&clock.durations.Attack===1&&same(clock.events.Attack,[{time:Math.fround(.4),name:'OnAttack',int:0,float:0,string:''}])
  &&['magic','phy'].every(mode=>linearSingleProjectileNative(n,`projectile_enemy_dhbow_${mode}`,{speed:8,lifetime:10}));
}
export const BLIGHT_ARCHER_FEATURES={
 [`ability:${BLIGHT_ARCHER_DESCRIPTION}`]:{matchesRecord,covers:blightArcherNative,ability:{kind:'programmedProjectileModes',params:r=>({
  program:nativeBuffProgram(key),initialMode:0,buffKey:key,disabledBy:[],triggerInterval:Math.fround(.1),groundOnly:false,
  modes:['arts','phys'].map(type=>({type,speed:8,lifetime:10,interruptOnDetach:true,
   animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}}))})}},
};
