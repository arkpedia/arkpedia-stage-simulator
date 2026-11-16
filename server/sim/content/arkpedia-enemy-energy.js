// SPDX-License-Identifier: GPL-3.0-or-later
import {ADD_KEYS,MUL_KEYS} from '../buffs.js';
const stores=new WeakMap(),allowedMods=new Set([...ADD_KEYS,...MUL_KEYS]);
const live=s=>s&&s.unit.alive&&s.unit.deployed&&s.unit.deploySeq===s.life;
const store=b=>{if(!stores.has(b))stores.set(b,new Map());return stores.get(b);};
/** Shared native energy boundary for enemies, projectiles and stage devices.
 * Registration and lifecycle belong to one admitted actor component. */
export function enemyEnergy(b,unit){
 const s=stores.get(b)?.get(unit);return live(s)?{count:s.count,capacity:s.capacity,overloaded:!!s.overload&&unit.buffs.includes(s.overload)}:null;
}
export function changeEnemyEnergy(b,unit,delta){
 if(!Number.isSafeInteger(delta))throw Error('Invalid native energy delta');
 const s=stores.get(b)?.get(unit);if(!live(s)||s.busy)return 0;
 return s.change(delta);
}
export function nativeEnergyMeter(params){
 validate(params);const{capacity,initial,perStack,overload,decay}=params;
 const clear=(b,e,s)=>{
  s.clearing=true;s.count=0;s.retryOverload=false;
  if(s.energy)b.removeBuff(e,s.energy);s.energy=null;
  s.clearing=false;
 };
 const startOverload=(b,e,s)=>{
  if(!live(s)||s.overload||s.count<capacity)return;
  const finish=()=>{s.overload=null;s.retryOverload=false;if(e.findBuff('blacksteel_energy[mark]'))clear(b,e,s);};
  const attached=b.addBuff(e,{key:'act28side_over_energy_buff',source:e,duration:overload.duration,mods:overload.mods,
   onRemove:finish,onExpire:finish});
  if(attached&&live(s)&&e.buffs.includes(attached)){s.overload=attached;s.retryOverload=false;}else{if(attached)b.removeBuff(e,attached);s.retryOverload=live(s)&&s.count>=capacity;}
 };
 return{
  spawn(b,e,a){
   const s=a.energy={unit:e,life:e.deploySeq,capacity,count:0,energy:null,overload:null,marker:null,busy:false,clearing:false,retryOverload:false,elapsed:0};
   s.change=delta=>{
    if(!live(s)||s.busy||s.overload)return 0;
    const next=Math.max(0,Math.min(capacity,s.count+delta)),prior=s.count;
    s.busy=true;
    try{
     if(next===prior){if(next>=capacity)startOverload(b,e,s);return 0;}
     if(next===0){clear(b,e,s);return -prior;}
     if(s.energy&&e.buffs.includes(s.energy)){s.energy.stacks=next;e.markDirty();}
     else{
      const attached=b.addBuff(e,{key:'act28side_energy_buff',source:e,stacks:next,maxStacks:capacity,mods:perStack,
       onRemove:()=>{s.energy=null;if(!s.clearing){s.count=0;s.retryOverload=false;}}});
      if(!attached||!live(s)||!e.buffs.includes(attached)){if(attached)b.removeBuff(e,attached);return 0;}s.energy=attached;
     }
     s.count=next;startOverload(b,e,s);return next-prior;
    }finally{s.busy=false;}
   };
   store(b).set(e,s);s.marker=b.addBuff(e,{key:'blacksteel_energy[mark]',source:e});if(!live(s)&&s.marker)b.removeBuff(e,s.marker);s.change(initial);
  },
  tick(b,e,a,dt){
   const s=a.energy;if(!live(s))return;
   if(decay){s.elapsed+=dt;while(s.elapsed+1e-9>=decay.interval){s.elapsed-=decay.interval;if(!s.overload&&e.findBuff('blacksteel_energy[mark]'))s.change(-decay.amount);}}
   if(!s.busy&&s.retryOverload)startOverload(b,e,s);
  },
  death(_c,b,e,a){
   const s=a.energy;if(!s)return;stores.get(b)?.delete(e);
   clear(b,e,s);if(s.overload)b.removeBuff(e,s.overload);if(s.marker)b.removeBuff(e,s.marker);
  },
 };
}
function validate({capacity,initial,perStack,overload,decay}){
 const mods=v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length&&Object.entries(v).every(([k,n])=>allowedMods.has(k)&&Number.isFinite(n));
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>1024||!Number.isSafeInteger(initial)||initial<0||initial>capacity||!mods(perStack)
  ||!overload||!Number.isFinite(overload.duration)||overload.duration<=0||!mods(overload.mods)
  ||decay!==undefined&&(!Number.isFinite(decay.interval)||decay.interval<=0||!Number.isSafeInteger(decay.amount)||decay.amount<1))throw Error('Invalid native energy meter');
}
nativeEnergyMeter.validate=validate;
