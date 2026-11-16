// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-famiglia-silencers-animations.json' with{type:'json'};
import {sameOutcomeValue as same,passiveOutcomeBuff,nativeKillLog} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
const ids=['enemy_1283_sgkill','enemy_1283_sgkill_2'],key='enemy_sgkill_passive';
export const isFamigliaSilencer=r=>!!r&&ids.includes(r.prefabKey);
export const FAMIGLIA_SILENCER_DESCRIPTION='Gains additional buffs while under Asset Liquidation';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const expected={schemaVersion:1,entry:key,templates:{[key]:{events:{ON_BUFF_TRIGGER:[{op:'when',condition:{op:'buff',who:'owner',keys:['vgctrl_s[aura]'],all:true},yes:[{op:'ensureStatBuff',who:'owner',key:'enemy_sgskill_up',mods:{aspd:'attack_speed',atkPct:'atk',defPct:'def'}}],no:[{op:'finishBuffs',who:'owner',key:'enemy_sgskill_up'}]}]}}}};
export function famigliaSilencerNative(r,n){
 if(!isFamigliaSilencer(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.stats.rangeRadius!==1.8||r.skills.length||r.sp||r.notCountInTotal
  ||!same(r.abilities,[{text:FAMIGLIA_SILENCER_DESCRIPTION,format:'NORMAL'},{text:'<$ba.invisible>Invisible</>',format:'NORMAL'}])
  ||!same(r.talents,{bb:{'Passive.attack_speed':50,'Passive.atk':.15,'Passive.def':.15,'Passive.max_stack_cnt':5},bbStr:{},groups:{Passive:['atk','attack_speed','def','max_stack_cnt']}}))return false;
 const root=n[r.prefabKey]?.find(v=>v._modes),mode=n.$ref(root?._modes?.[0]),passive=n.Passive?.find(v=>v._buffs),invisible=n.Invisible?.find(v=>v._buffs),check=n.$ref(invisible?._checker);
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_idleWhenBorn:0,_canNotExit:0,_blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_commonAbilities:[{m_FileID:0,m_PathID:'0'}]})||root._modes.length!==1
  ||!mode||mode._generalAbilities.length||!same(mode._attack,mode._combat)||[root._animator,...root._modes,mode._combat,mode._attack,mode._attackTrigger].some(v=>v.m_FileID!==0)
  ||!ordinaryProjectilePacketNative(n.$ref(mode._attack),{projectileKey:'projectile_enemy_sgkill',type:1})
  ||!ordinaryRangedSelectorNative(n,n.$ref(mode._attackTrigger),{radius:1.5,abnormalFlag:23})||!linearSingleProjectileNative(n,'projectile_enemy_sgkill',{speed:10,lifetime:5}))return false;
 if(!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0,_interruptAbilityOnDetach:0})||passive._buffs.length!==2
  ||passive._buffs.some(b=>!passiveOutcomeBuff(b)||!same(b.blackboard,[])||b.overrideType!==0)
  ||!fields(passive._buffs[0],{buffKey:'enemy_sgkill_vg_check',templateKey:key,triggerInterval:.5,triggerLifeType:2,waitFirstTriggerInterval:1,firstTriggerInterval:-1})
  ||!fields(passive._buffs[1],{buffKey:'enemy_sgkill_dead_log',templateKey:'log_killed',triggerInterval:-1,triggerLifeType:0})||!nativeKillLog(n))return false;
 const wrapper=n.$siblings(passive).find(v=>v.m_Script?.m_PathID==='-2726233351382997147');
 if(!fields(wrapper,{_overwriteTalentKey:'',_overwriteParentRangeId:0,_checkValidBySkillIndex:[],_attachInDummy:0,_defaultModeIndex:-1,_attackBlackboardModeIndex:-1,_extraAttackBlackboardModeIndices:[],_overrideDefaultRangeId:0,_applyTalentScale:0,_influenceSkillBlackboard:0,_fromRawDataToSkill:0,_applyTalentRange:0,_applyBlackboardBySkill:0,_applyStrBlackboardBySkill:0,_writeRangeIdToProjectileBlackboard:0,_affectWhenNotRootTalent:0,_scaleCertainKeyFlag:0,_scaleCertainKeyList:[],_scaleCertainMode:0,_scaleModeIndices:[]}))return false;
 if(!fields(invisible,{m_Script:{m_FileID:1,m_PathID:'5578302910068743633'},_selector:{m_FileID:0,m_PathID:'0'},_interruptAbilityOnDetach:0,_ignoreIfOwnerDead:0,_unmanagedBuffsWhenToggleOn:[],_setToggleFalseOnDetached:0,_isInverseToggle:0,_buffsWhenToggleOff:[]})||invisible._checker.m_FileID!==0||invisible._buffs.length!==1
  ||!fields(check,{m_Script:{m_FileID:1,m_PathID:'-6339019266161532961'},_isInitToggled:1,_disableWhenAttack:0,_disableWhenBlocked:1,_disableWhenInAttackState:0,_disableWhenInCombatState:0,_disableWhenOutputHeal:0,_disableWhenTakeDamage:0,_disableWhenAppliedModifier:0,_disableWhenAppliedDamageModifier:0,_disableWhenMoving:0,_restoreDelay:1,_disableDuringReborn:0}))return false;
 const stealth=invisible._buffs[0];if(!passiveOutcomeBuff({...stealth,attributes:{...stealth.attributes,abnormalFlags:[]}})||!same(stealth.attributes.abnormalFlags,[9])||!same(stealth.blackboard,[])||!fields(stealth,{buffKey:'enemy_sgkill_passive',templateKey:'empty',overrideType:0})||!same(n.$template('empty')?.eventToActions,{}))return false;
 try{if(!same(compileNativeBuffProgram(key,k=>n.$template(k)),expected))return false;}catch{return false;}
 const clock=clocks.enemies[r.prefabKey],graphic=n.$ref(root._animator);
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId&&graphic._animations.some(v=>v.animKey==='Attack'&&v.animName==='Attack'&&v.speed===1&&!v.loop)
  &&clock.durations.Attack===Math.fround(32/30)&&same(clock.events.Attack,[{time:Math.fround(.4),name:'OnAttack',int:0,float:0,string:''}]);
}
export const FAMIGLIA_SILENCER_STEALTH={kind:'nativeStealth',params:()=>({key:'enemy_sgkill_passive',restoreDelay:1})};
export const FAMIGLIA_SILENCER_FEATURES={
 [`ability:${FAMIGLIA_SILENCER_DESCRIPTION}`]:{matchesRecord:isFamigliaSilencer,covers:famigliaSilencerNative,ability:{kind:'programmedProjectileModes',params:r=>({program:nativeBuffProgram(key),blackboard:Object.fromEntries(Object.entries(r.talents.bb).map(([k,v])=>[k.slice(8),v])),initialMode:0,buffKey:'enemy_sgkill_vg_check',disabledBy:[],triggerInterval:.5,groundOnly:true,
  modes:[{type:'phys',speed:10,lifetime:5,noAir:false,interruptOnDetach:false,animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(v=>v.time),maxScale:1}}]})}},
 'native:famigliaSilencerLog':{matchesRecord:isFamigliaSilencer,covers:famigliaSilencerNative,ability:{kind:'stageOutcomeCounter',params:()=>({killedKey:'killed',buffKey:'enemy_sgkill_dead_log'})}},
};
