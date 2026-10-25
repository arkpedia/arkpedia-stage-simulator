// SPDX-License-Identifier: GPL-3.0-or-later
// Exact timeout subsystem; the complete snake remains unregistered.
import contract from '../../../data/candidates/arkpedia-ch17-snake-timeout-contract.json' with {type:'json'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function installChapter17SnakeTimeout(b,e){
 const r=e?.def?.raw,p=contract.record;
 if(e?.defId!==contract.enemy||r?.key!==contract.enemy||r.prefabKey!==contract.enemy||!same(r.talents?.groups,p.groups)
  ||!same(r.talents?.bb,p.bb)||!same(r.skills,p.skills)||!same(r.abilities,p.abilities))throw Error('Unreviewed snake timeout contract');
 if(!Number.isFinite(b.life))throw Error('Snake timeout requires the ordinary-stage life ledger');
 if(b.finished||!e.alive||!e.deployed||!Number.isFinite(e.deployedAt)||Math.abs(e.deployedAt-b.time)>1e-9)
  throw Error('Snake timeout must attach to a fresh live deployment');
 const life=e.deploySeq,old=e.mem.ch17SnakeTimeout;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one snake timeout');
 if(old?.active)old.stop();
 const d=contract.defaults,handles=[],valid=()=>state.active&&!b.finished&&e.alive&&e.deployed&&e.deploySeq===life;
 const state={active:true,fired:false,ownerLife:life,deadline:b.time+d.interval,buff:null,task:null,
  stop(){
   if(!state.active)return;state.active=false;state.task?.cancel();b.removeBuff(e,state.buff);
   for(const handle of handles)b.off(handle);if(e.mem.ch17SnakeTimeout===state)delete e.mem.ch17SnakeTimeout;
  },
  snapshot(){
   if(!valid()){state.stop();return null;}
   return{ownerId:e.id,ownerLife:life,remaining:Math.max(0,state.deadline-b.time)};
  },
 };
 const fire=()=>{
  if(!valid()){state.stop();return;}
  if(state.fired||!e.buffs.includes(state.buff)){state.stop();return;}
  if(!Number.isFinite(b.life)){state.stop();throw Error('Snake timeout life ledger became invalid');}
  state.fired=true;state.stop();
  // Retain the native literal finish key. noReason retires without a kill or
  // route-exit receipt; the canonical LP action is a separate AlwaysNext step.
  b.removeBuff(e,contract.trigger.find(n=>n.$type.endsWith('+FinishBuffsById'))._buffKey);
  try{e.hp=0;b._remove(e,'ch17-snake-timeout',e,true);}finally{
   if(!Number.isFinite(b.life))throw Error('Snake timeout life ledger became invalid during retirement');
   const before=b.life;b.life+=d.lifePointDelta;
   if(b.life<=0&&!b.finished)b._finish('defeated');
   b.emit('ch17SnakeTimeout',{source:e,sourceLife:life,lifePointDelta:d.lifePointDelta,before,after:b.life});
  }
 };
 e.mem.ch17SnakeTimeout=state;
 handles.push(b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),
  b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}),
  b.on('tick',()=>{if(!valid()||!e.buffs.includes(state.buff))state.stop();},{owner:state}));
 state.buff=b.addBuff(e,{key:contract.buff.buffKey,source:e,duration:d.duration,
  onRemove:()=>state.stop(),onExpire:()=>state.stop()});
 if(!state.buff||!valid()){state.stop();b.removeBuff(e,state.buff);throw Error('Snake timeout buff admission failed');}
 state.task=b.after(d.interval,fire,{owner:state});
 return state;
}
