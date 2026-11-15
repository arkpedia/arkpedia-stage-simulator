// SPDX-License-Identifier: GPL-3.0-or-later
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {projectileSingleAttack} from './arkpedia-enemy-projectiles.js';
import {spawnChildren} from './arkpedia-enemy-spawn.js';

export function gertrude(p){
 const shot=projectileSingleAttack({speed:p.speed,lifetime:p.lifetime,type:'arts'});
 const cast=timedEnemyCasts([{initial:p.initial,cooldown:p.cooldown,release:p.release,duration:p.duration,clip:'Skill',slowDown:true,
  select:(_b,e)=>[e],fire(b,e){
   // Native summons follow the parent's remaining route and are unharmful.
   // One living image (including its birth phase) can occupy each source tile.
   if(b.enemies.some(u=>u.alive&&u.defId===p.child&&Math.round(u.x)===Math.round(e.x)&&Math.round(u.y)===Math.round(e.y)))return;
   spawnChildren(b,e,p.child,1,{countInTotal:false});
  }}],{silenceable:false});
 return {...cast,spawn(b,e,a){
  e.def={...e.def,attackAnim:p.attackAnim};shot.spawn(b,e);cast.spawn(b,e,a);
 },attack:shot.attack};
}
export function gertrudeImage({damage,birthDelay,birthAnimation}){
 const update=(b,e,a)=>{
  if(b.time+1e-9<a.activeAt)return;
  if(b.time+1e-9>=a.animationEnd&&e.mem.regularFormVisual?.playId===a.visual)e.mem.regularFormVisual=null;
  const enabled=!e.s.flags.silence;
  if(enabled&&!e.findBuff('ab:virtualImageRoot'))b.addBuff(e,{key:'ab:virtualImageRoot',flags:{noMove:true}});
  if(!enabled)b.removeBuff(e,'ab:virtualImageRoot');
  const connected=enabled&&!!b.stageMagicCircuit?.coversPosition(e.y,e.x);
  if(!connected){a.next=null;return;}
  if(a.next==null)a.next=b.time;
  if(b.time+1e-9>=a.next){
   a.next+=1;
   b.dealDamage(e,e,{amount:damage,type:'true',isAttack:false,noSp:true,canDodge:false,ignoreSelect:true,tags:['dot','virtualImageFlux']});
  }
 };
 return {spawn(b,e,a){
  e.profile.noAttack=true;e.profile.minimumMoveSpeed=.1;
  if(!e.counted)e.profile.holdsBattle=false;e.mem.noLeak=true;e.markDirty();
  a.activeAt=b.time+birthDelay;a.animationEnd=b.time+birthAnimation;a.visual=`imageBorn:${e.deploySeq}`;a.next=null;
  e.mem.regularFormVisual={clip:'Start',loop:false,speed:1,playId:a.visual};
  b.addBuff(e,{key:'ab:virtualImageBirth',duration:birthDelay,flags:{noMove:true,untargetable:true,invulnerable:true}});
  if(!e.s.flags.silence)b.addBuff(e,{key:'ab:virtualImageRoot',flags:{noMove:true}});
 },tick:update,status(_c,b,e,a){update(b,e,a);}};
}
