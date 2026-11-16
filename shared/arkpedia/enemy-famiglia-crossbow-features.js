// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-famiglia-crossbows-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff,nativeKillLog} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
const ids=['enemy_1278_sgbow','enemy_1278_sgbow_2'],key='enemy_common_check_vg',parent='enemy_sgbow_vg_check';
const matchesRecord=r=>ids.includes(r.prefabKey),fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
export const FAMIGLIA_CROSSBOW_DESCRIPTION='While under the Asset Liquidation status, attacks are converted into Arts damage';
const when=(index,to)=>({op:'when',condition:{op:'all',terms:[{op:'mode',who:'owner',index}]},yes:[{op:'switchMode',who:'target',index:to}],no:[]});
const expected={schemaVersion:1,entry:key,templates:{[key]:{events:{ON_BUFF_TRIGGER:[{op:'when',condition:{op:'buff',who:'owner',keys:['vgctrl_s[aura]'],all:true},yes:[when(0,1)],no:[when(1,0)]}]}}}};
export function famigliaCrossbowNative(r,n){
 if(!matchesRecord(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal
  ||r.stats.rangeRadius!==(r.prefabKey.endsWith('_2')?2.5:2)||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})
  ||!same(r.abilities,[{text:FAMIGLIA_CROSSBOW_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),check=n.VGCheck?.find(v=>v._buffs),passive=n.Passive?.find(v=>v._buffs);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[]})||root._modes.length!==2
  ||!check||check._buffs.length!==2||!passive||passive._buffs.length!==1)return false;
 for(const p of [check,passive])if(!fields(p,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})||p._buffs.some(b=>!passiveOutcomeBuff(b)||!same(b.blackboard,[])||b.overrideType!==0))return false;
 if(!fields(check._buffs[0],{buffKey:parent,templateKey:key,triggerLifeType:2,triggerInterval:.5,waitFirstTriggerInterval:1,firstTriggerInterval:-1})
  ||!fields(check._buffs[1],{buffKey:'enemy_sgbow_dead_log',templateKey:'log_killed',triggerLifeType:0,triggerInterval:-1})
  ||!fields(passive._buffs[0],{buffKey:'sgbow_vg_passive',templateKey:'empty',triggerLifeType:0,triggerInterval:-1})||!nativeKillLog(n)
  ||!same(n.$template('empty')?.eventToActions,{}))return false;
 const wrapper=n.$siblings(check).find(v=>v.m_Script?.m_PathID==='-2726233351382997147');
 if(!fields(wrapper,{_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_overrideDefaultRangeId:0,_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyTalentRange:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_writeRangeIdToProjectileBlackboard:0,_affectWhenNotRootTalent:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleCertainMode:0,_scaleModeIndices:[]}))return false;
 try{if(!same(compileNativeBuffProgram(key,k=>n.$template(k)),expected))return false;}catch{return false;}
 for(const [i,ref]of root._modes.entries()){
  const m=n.$ref(ref);if(!m||!same(m._combat,m._attack)||m._generalAbilities.length!==i||i&&n.$ref(m._generalAbilities[0])!==passive
   ||[ref,m._combat,m._attack,m._attackTrigger,...m._generalAbilities].some(v=>v.m_FileID!==0)
   ||!ordinaryProjectilePacketNative(n.$ref(m._attack),{projectileKey:`projectile_enemy_sgbow${i?'_vg':''}`,type:i?2:1})
   ||!ordinaryRangedSelectorNative(n,n.$ref(m._attackTrigger),{radius:2,abnormalFlag:23})
   ||!linearSingleProjectileNative(n,`projectile_enemy_sgbow${i?'_vg':''}`,{speed:10,lifetime:5}))return false;
 }
 const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
 return root._animator.m_FileID===0&&n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(v=>v.animKey==='Attack'&&v.animName==='Attack'&&v.speed===1&&!v.loop)
  &&clock.durations.Attack===Math.fround(49/30)&&same(clock.events.Attack,[{time:Math.fround(.6),name:'OnAttack',int:0,float:0,string:''}]);
}
export const FAMIGLIA_CROSSBOW_FEATURES={
 [`ability:${FAMIGLIA_CROSSBOW_DESCRIPTION}`]:{matchesRecord,covers:famigliaCrossbowNative,nativeClaim:()=>({active:1}),ability:{kind:'programmedProjectileModes',params:r=>({program:nativeBuffProgram(key),initialMode:0,buffKey:parent,disabledBy:[],triggerInterval:.5,groundOnly:true,
  modes:['phys','arts'].map((type,i)=>({type,speed:10,lifetime:5,noAir:false,interruptOnDetach:false,...(i?{markerKey:'sgbow_vg_passive'}:{}),animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(v=>v.time),maxScale:1}}))})}},
 'native:famigliaCrossbowLog':{matchesRecord,covers:famigliaCrossbowNative,ability:{kind:'stageOutcomeCounter',params:()=>({killedKey:'killed',buffKey:'enemy_sgbow_dead_log'})}},
};
