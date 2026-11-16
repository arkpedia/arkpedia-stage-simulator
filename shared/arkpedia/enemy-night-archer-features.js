// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-night-archers-animations.json' with{type:'json'};
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty,nativeKillLog,passiveOutcomeBuff} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearSingleProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {cosmeticMarkerHolder} from './enemy-cosmetic-marker-contract.js';
import {compileNativeBuffProgram} from './behavior-native-compiler.js';
import {nativeBuffProgram} from './native-buff-programs.js';
const ids=['enemy_1179_aruarw','enemy_1179_aruarw_2'],key='enemy_aruarw_check';
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const isNightArcher=r=>ids.includes(r.prefabKey);
export const NIGHT_ARCHER_DESCRIPTION='When in areas with no visibility, attacks deal Arts damage';
const mode=index=>({op:'mode',who:'owner',index}),switchTo=index=>({op:'switchMode',who:'target',index});
const when=(terms,yes)=>({op:'when',condition:{op:'all',terms},yes,no:[]});
const expectedProgram={schemaVersion:1,entry:key,templates:{[key]:{events:{
 ON_BEFORE_ATTACK:[{op:'when',condition:{op:'environmentMask',who:'owner',mask:8},
  yes:[when([{op:'silenced',who:'owner',unset:true},mode(1)],[switchTo(0)])],no:[when([mode(0)],[switchTo(1)])]}],
 ON_BUFF_DISABLE:[when([mode(0)],[switchTo(1)])],
}}}};
function modeProgram(n){try{return same(compileNativeBuffProgram(key,k=>n.$template(k)),expectedProgram);}catch{return false;}}
export function nightArcherNative(r,n){
 if(!isNightArcher(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'||r.notCountInTotal||r.stats.rangeRadius!==2
  ||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}})||!same(r.abilities,[{text:NIGHT_ARCHER_DESCRIPTION,format:'NORMAL'}]))return false;
 const root=n[r.prefabKey]?.find(c=>'_modes'in c),passive=n.$ref(root?._commonAbilities?.[0]),buff=passive?._buffs?.[0],elite=r.prefabKey.endsWith('_2');
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_onlyDelayToBornOnTileStart:0,
  _blockVolume:1,_specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})
  ||root._modes.length!==2||root._commonAbilities.length!==1||!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},
   _selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})||passive._buffs.length!==(elite?1:2)
  ||!empty(buff?.attributes)||!fields(buff,{buffKey:key,templateKey:key,blackboard:[],loadFromDB:0,isSilenceable:1,isStunnable:0,isFreezable:0,
   isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,triggerCnt:0,triggerInterval:-1,maxStackCnt:1,overrideType:0})||!modeProgram(n))return false;
 for(const [i,ref] of root._modes.entries()){
  const m=n.$ref(ref),a=n.$ref(m?._attack);
  if(!m||!same(m._combat,m._attack)||!same(m._generalAbilities,i?[]:[{m_FileID:0,m_PathID:'0'}])
   ||!ordinaryProjectilePacketNative(a,{projectileKey:`projectile_enemy_aruarw_${i?'bright':'night'}`,type:i?1:2})
   ||!ordinaryRangedSelectorNative(n,n.$ref(m._attackTrigger),{radius:2,abnormalFlag:23}))return false;
 }
 const visual=n.NightBuff?.find(c=>'_checker'in c),checker=n.$ref(visual?._checker),fx=visual?._buffs?.[0];
 if(!fields(visual,{m_Script:{m_FileID:1,m_PathID:'5578302910068743633'},_selector:{m_FileID:0,m_PathID:'0'},_interruptAbilityOnDetach:0,
  _ignoreIfOwnerDead:0,_unmanagedBuffsWhenToggleOn:[],_setToggleFalseOnDetached:0,_isInverseToggle:0,_buffsWhenToggleOff:[]})
  ||visual._buffs.length!==1||!fields(checker,{m_Script:{m_FileID:1,m_PathID:'1349972819923973658'},_condition:{_toggleOnMask:8}})
  ||!empty(fx?.attributes)||!fields(fx,{buffKey:'aurarw_night_effect',templateKey:elite?'empty':'aruarw_night_buff_effect_holder',
   blackboard:[],loadFromDB:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,lifeTimeType:2,lifeTime:0,maxStackCnt:1})
  ||!elite&&!cosmeticMarkerHolder(n,'aruarw_night_buff_effect_holder',{key:'aruarw_night_buff_effect',effect:'enemy_aruarw_buff_01'}))return false;
 if(!elite){const log=passive._buffs[1];if(!passiveOutcomeBuff(log)||log.buffKey!=='enemy_aruarw_log'||log.templateKey!=='log_killed'||!same(log.blackboard,[])||!nativeKillLog(n))return false;}
 const graphic=n.$ref(root._animator),clock=clocks.enemies[r.prefabKey];
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  &&clock.durations.Attack===1.5&&same(clock.events.Attack,[{time:Math.fround(21/30),name:'OnAttack',int:0,float:0,string:''}])
  &&['night','bright'].every(mode=>linearSingleProjectileNative(n,`projectile_enemy_aruarw_${mode}`,{speed:10,lifetime:5}));
}
const feature={matchesRecord:isNightArcher,covers:nightArcherNative};
export const NIGHT_ARCHER_FEATURES={
 [`ability:${NIGHT_ARCHER_DESCRIPTION}`]:{...feature,nativeClaim:()=>({active:1}),ability:{kind:'programmedProjectileModes',params:r=>({
  program:nativeBuffProgram(key),initialMode:0,buffKey:key,disabledBy:['silence'],groundOnly:true,
  modes:['arts','phys'].map(type=>({type,speed:10,lifetime:5,noAir:true,interruptOnDetach:false,
   animation:{clip:'Attack',duration:clocks.enemies[r.prefabKey].durations.Attack,releases:clocks.enemies[r.prefabKey].events.Attack.map(e=>e.time)}}))})}},
 'native:nightArcherLog':{...feature,ability:{kind:'stageOutcomeCounter',params:()=>({killedKey:'killed'})}},
};
