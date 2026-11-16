// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-funlive-caster-animations.json' with{type:'json'};
import {sameOutcomeValue as same,emptyOutcomeAttributes as empty} from './enemy-outcome-contracts.js';
import {ordinaryProjectilePacketNative,ordinaryRangedSelectorNative,linearTileProjectileNative} from './enemy-ordinary-projectile-contract.js';
import {nativeBuffProgram} from './native-buff-programs.js';
const id='enemy_5021_tmagfd',key='tmagfd_npc_effect',clock=clocks.enemies.enemy_1161_tidmag;
const fields=(v,w)=>!!v&&Object.entries(w).every(([k,x])=>same(v[k],x));
const matchesRecord=r=>r.prefabKey===id;
const tiles=[{row:1,col:0},{row:0,col:-1},{row:0,col:0},{row:0,col:1},{row:-1,col:0}];
export function funliveCasterNative(r,n){
 if(!matchesRecord(r)||r.level!==0||r.applyWay!=='RANGED'||r.stats.atk!==0||r.stats.rangeRadius!==0||r.stats.dmgType!=='phys'||r.stats.motion!=='WALK'
  ||r.abilities.length||r.skills.length||r.sp||!same(r.talents,{bb:{},bbStr:{},groups:{}}))return false;
 const root=n[id]?.find(c=>'_modes'in c),mode=n.$ref(root?._modes?.[0]),passive=n.$ref(mode?._generalAbilities?.[0]),buff=passive?._buffs?.[0];
 if(!fields(root,{m_Script:{m_FileID:1,m_PathID:'-6629209555389654693'},_sideTypeIndex:1,_delayToBorn:0,_commonAbilities:[],_blockVolume:1,
  _specialBlockCondition:{_type:0,_buffKeyPairs:[],_filterTags:[]},_idleWhenBorn:0,_canNotExit:0})||root._modes.length!==1
  ||!mode||!same(mode._combat,mode._attack)||mode._generalAbilities.length!==1
  ||!fields(passive,{m_Script:{m_FileID:1,m_PathID:'3800760148018415462'},_selector:{m_FileID:0,m_PathID:'0'},_ignoreIfOwnerDead:0})||passive._buffs.length!==1
  ||!empty(buff?.attributes)||!fields(buff,{buffKey:key,templateKey:'empty',blackboard:[],loadFromDB:0,lifeTimeType:1,lifeTime:5,durationKey:'',
   maxStackCnt:1,overrideType:0,isSilenceable:0,isStunnable:0,isFreezable:0,isLevitatable:0,isGroundBoundable:0,triggerCnt:0,triggerInterval:-1})
  ||!same(n.$template('empty'),{templateKey:'empty',effectKey:'',onEventPriority:'DEFAULT',eventToActions:{}})
  ||!ordinaryProjectilePacketNative(n.$ref(mode._attack),{projectileKey:'projectile_enemy_tidmag',type:2,elementDamageType:2})
  ||!ordinaryRangedSelectorNative(n,n.$ref(mode._attackTrigger),{radius:Math.fround(2.2),motion:3,abnormalFlag:21})
  ||!linearTileProjectileNative(n,'projectile_enemy_tidmag',{speed:10,lifetime:5,rangeId:'x-5'})
  ||!same(n.$range('x-5')?.grids,tiles))return false;
 const graphic=n.$ref(root._animator);
 return n.$ref(graphic?._skeleton)?.skeletonDataAsset?.m_PathID===clock.source.skeletonDataPathId
  &&graphic._animations.some(a=>a.animKey==='Attack'&&a.animName==='Attack'&&a.speed===1&&!a.loop)
  &&clock.durations.Attack===Math.fround(40/30)&&same(clock.events.Attack,[{time:Math.fround(17/30),name:'OnAttack',int:0,float:0,string:''}]);
}
export const FUNLIVE_CASTER_FEATURES={
 'native:funliveCaster':{matchesRecord,covers:funliveCasterNative,nativeClaim:()=>({active:1}),ability:{kind:'programmedProjectileModes',params:()=>({
  program:nativeBuffProgram('empty'),initialMode:0,buffKey:key,disabledBy:[],parentDuration:5,groundOnly:false,
  modes:[{type:'arts',speed:10,lifetime:5,interruptOnDetach:false,tileOffsets:tiles,
   animation:{clip:'Attack',duration:clock.durations.Attack,releases:clock.events.Attack.map(e=>e.time)}}]})}},
};
