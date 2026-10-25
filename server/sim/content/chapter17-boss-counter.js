// SPDX-License-Identifier: GPL-3.0-or-later
// Counter transport only. The complete snake controller remains unregistered.
import contract from '../../../data/candidates/arkpedia-ch17-snake-counter-contract.json' with {type:'json'};
const states=new WeakMap(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const current=(b,owner,life)=>!b.finished&&owner.alive&&owner.deployed&&owner.deploySeq===life;
const stateFor=b=>{
 let state=states.get(b);if(!state){state={nextId:0,owners:new Map()};states.set(b,state);}return state;
};

/** Start the exact native button action; applyBuff must implement its result. */
export function startChapter17SnakeCounter(b,owner,{kind,applyBuff}={}){
 const source=Object.hasOwn(contract.cases,kind)?contract.cases[kind]:null,r=owner?.def?.raw,p=contract.record;
 if(!source||owner?.defId!==contract.enemy||r?.key!==contract.enemy||r.prefabKey!==contract.enemy
  ||!same(r.talents?.groups,p.groups)||!same(r.talents?.bb,p.bb)||!same(r.skills,p.skills)||!same(r.abilities,p.abilities)
  ||typeof applyBuff!=='function')throw Error('Unreviewed snake click-counter contract or missing result dispatcher');
 const life=owner.deploySeq;
 if(!current(b,owner,life)){states.get(b)?.owners.get(owner)?.cancel();return null;}
 const state=stateFor(b),action=source.action,handles=[];
 state.owners.get(owner)?.cancel();
 const counter={id:++state.nextId,owner,ownerLife:life,kind,clicks:0,required:action._requiredClickCount,
  deadline:b.time+action._duration,active:true,
  input:Object.freeze({ownerId:owner.id,ownerLife:life,counterId:state.nextId}),
  cancel(){
   if(!counter.active)return;counter.active=false;
   if(state.owners.get(owner)===counter)state.owners.delete(owner);
   for(const handle of handles)b.off(handle);
  },
  resolve(success){
   if(!counter.active)return false;
   if(!current(b,owner,life)){counter.cancel();return false;}
   const receipt=Object.freeze({owner,ownerLife:life,counterId:counter.id,kind,
    outcome:success?'success':'expired',buffKey:success?action._successBuffKey:action._failedBuffKey});
   // Detach before dispatch: a resulting buff can remove the owner or install
   // another counter synchronously without the old completion erasing it.
   counter.cancel();
   try{applyBuff(receipt);}finally{b.emit('ch17BossCounterResolved',{...counter.input,kind,outcome:receipt.outcome,buffKey:receipt.buffKey});}
   return true;
  },
  click(input){
   if(!counter.active)return false;
   if(!current(b,owner,life)){counter.cancel();return false;}
   if(!input||input.counterId!==counter.id||input.ownerId!==owner.id||input.ownerLife!==life)return false;
   if(b.time>=counter.deadline){counter.resolve(false);return false;}
   counter.clicks++;
   if(counter.clicks>=counter.required)counter.resolve(true);
   return true;
  },
 };
 state.owners.set(owner,counter);
 handles.push(b.on('tick',()=>{
  if(!current(b,owner,life)){counter.cancel();return;}
  if(b.time>=counter.deadline)counter.resolve(false);
 },{owner:counter}),b.on('death',({unit})=>{if(unit===owner)counter.cancel();},{owner:counter}),
 b.on('removed',({unit})=>{if(unit===owner)counter.cancel();},{owner:counter}),
 b.on('battleEnd',()=>counter.cancel(),{owner:counter}));
 b.emit('ch17BossCounterStarted',{...counter.input,kind,required:counter.required,deadline:counter.deadline});
 if(!current(b,owner,life))counter.cancel();
 return counter;
}

/** Inputs carry the deployment and button identity, never only a pooled unit ID. */
export function clickChapter17BossCounter(b,input){
 if(!input||!Number.isSafeInteger(input.ownerId)||!Number.isSafeInteger(input.ownerLife)||!Number.isSafeInteger(input.counterId))return false;
 const state=states.get(b);if(!state)return false;
 for(const counter of state.owners.values())if(counter.owner.id===input.ownerId)return counter.click(input);
 return false;
}

/** A plain snapshot for future mechanical controls; no visual effects are added. */
export function chapter17BossCounterSnapshot(b){
 const out=[];
 for(const counter of states.get(b)?.owners.values()??[]){
  if(!current(b,counter.owner,counter.ownerLife)){counter.cancel();continue;}
  out.push({...counter.input,kind:counter.kind,clicks:counter.clicks,required:counter.required,remaining:Math.max(0,counter.deadline-b.time)});
 }
 return out;
}
