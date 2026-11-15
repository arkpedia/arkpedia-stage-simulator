// SPDX-License-Identifier: GPL-3.0-or-later
import { areaSelectable } from '../targeting.js';
/** A tile-bound enemy aura. The bound buff owns suppression; removing one
 * cannot clear another source, and its finish kills only its original flame. */
export function exhaustedFlame({hpRatio,elementRatio},ab){
 const occupants=(b,e)=>b.allies().filter(u=>Math.round(u.x)===Math.round(e.x)&&Math.round(u.y)===Math.round(e.y));
 const clean=(b,e,a)=>{a.cleaning=true;for(const[u,key]of a.bound)b.removeBuff(u,key);a.bound.clear();};
 const bind=(b,e,a)=>{
  const current=new Set(occupants(b,e));
  for(const[u,key]of a.bound)if(!current.has(u)||!u.findBuff(key)){b.kill(e);return;}
  if(!current.size){b.kill(e);return;}
  for(const u of current)if(!a.bound.has(u)){
   const key=`ab:exhaustedFlame:${e.id}:${e.deploySeq}`;a.bound.set(u,key);
   b.addBuff(u,{key,source:e,flags:{disarm:true,skillNotActivatable:true},onRemove:()=>{if(!a.cleaning&&e.alive)b.kill(e);}});
  }
 };
 return{
  spawn(b,e,a){
   a.bound=new Map();a.elapsed=0;a.cleaning=false;(ab.immune??=new Set()).add('cold');
   b.addBuff(e,{key:'ab:exhaustedFlameBody',persist:true,flags:{noMove:true,noDisplace:true}});e.profile.noAttack=true;
   // All handlers are attached before the no-host start action can kill it.
   b.after(0,()=>{if(e.alive)bind(b,e,a);},{owner:e});
  },
  tick(b,e,a,dt){
   bind(b,e,a);if(!e.alive)return;a.elapsed+=dt;
   while(a.elapsed+1e-9>=1&&e.alive){a.elapsed-=1;b.dealDamage(null,e,{amount:e.s.maxHp*hpRatio,type:'true',sourceless:true,unmodified:true,noSp:true,canDodge:false,tags:['exhaustedFlameDecay']});}
  },
  death(c,b,e,a){
   clean(b,e,a);if(c.reason!=='killed')return;
   const x=Math.round(e.x),y=Math.round(e.y);b.fx('explode',{x,y,r:1,kind:'exhaustedFlame'});
   for(const u of b.allies()){
    if(!areaSelectable(e,u)||Math.abs(Math.round(u.x)-x)+Math.abs(Math.round(u.y)-y)>1)continue;
    b.dealDamage(e,u,{amount:e.s.atk,type:'arts',isSplash:true,applyWay:'melee',canDodge:false,tags:['exhaustedFlameExplosion']});
    if(u.alive)b.dealDamage(e,u,{amount:e.s.atk*elementRatio,type:'element',element:'burn',tags:['exhaustedFlameExplosion']});
   }
  },
 };
}
