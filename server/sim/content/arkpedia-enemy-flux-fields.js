// SPDX-License-Identifier: GPL-3.0-or-later
import { spawnChildren } from './arkpedia-enemy-spawn.js';
import { auraSelectable, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { FLUX_CUTOFF_RANGE as cross } from '../../../shared/arkpedia/enemy-flux-ranges.js';
const sealKey='enemy_1245_ltseal';
export function fluxFieldCaster({child,attackAnim}) {
 return {spawn(b,e){
   e.def={...e.def,attackAnim};e.profile.deferHit=true;e.profile.allowZeroAtkAttack=true;e.profile.shot='none';
   e.profile.targetPriority='withBuff';e.profile.priorityBuff='character_in_magiccircuit[normal]';
   e.profile.canTarget=u=>!b.enemies.some(other=>other.alive&&other.defId===child&&Math.round(other.x)===Math.round(u.x)&&Math.round(other.y)===Math.round(u.y));
  },attack(c,b,e){
   for(const target of c.targets)if(target.alive&&target.deployed&&e.profile.canTarget(target))
    spawnChildren(b,e,child,1,{pos:[Math.round(target.y),Math.round(target.x)],countInTotal:false});
  }};
}
export function crimsonFormation({duration,first,interval}) {
 const clear=(b,e,a)=>{
  for(const [u,s]of a.targets??[])b.removeBuff(u,s.key);
  a.targets?.clear();b.stageMagicCircuit?.exclude(e,null);
 };
 const update=(b,e,a)=>{
  if(b.time+1e-9>=a.expires){b.kill(e);return;}
  const selected=new Set(b.allies(null,{includeTargetableDevices:true}).filter(u=>!u.isFlying&&!u.s.flags.liftoff
    &&auraSelectable(e,u)&&b.allySelectable(u)&&bodyInKeys(u,a.keys)));
  for(const [u,s]of a.targets)if(!selected.has(u)||u.deploySeq!==s.life){b.removeBuff(u,s.key);a.targets.delete(u);}
  for(const u of selected){
   if(!a.targets.has(u)){
    const key=`${sealKey}:stun:${e.id}`;
    b.applyStatus(u,'stun',{key,source:e,duration});
    a.targets.set(u,{key,life:u.deploySeq,next:b.time+first});
   }
   const state=a.targets.get(u);
   if(b.time+1e-9>=state.next){
    state.next+=interval;
    b.dealDamage(e,u,{amount:e.s.atk,type:'arts',applyWay:'none',isAttack:false,noSp:true,canDodge:false,tags:['dot','fluxFormation']});
   }
  }
 };
 return {spawn(b,e,a){
   e.profile.noAttack=true;e.profile.cannotExit=true;if(!e.counted)e.profile.holdsBattle=false;e.mem.noLeak=true;
   e.def={...e.def,immune:new Set([...e.def.immune,'stun','frozen','cold','silence','levitate','sleep'])};
   b.addBuff(e,{key:'enemy_ltseal_t',persist:true,flags:{noMove:true,noDisplace:true,unblockable:true,hitCount:true}});
   a.targets=new Map();a.expires=b.time+duration;a.keys=new Set(absoluteRangeKeys([[0,0]],Math.round(e.y),Math.round(e.x),'RIGHT'));
   b.stageMagicCircuit?.exclude(e,cross.map(([r,c])=>[Math.round(e.y)+r,Math.round(e.x)+c]));
   update(b,e,a);
  },tick:update,death(_c,b,e,a){clear(b,e,a);}};
}
