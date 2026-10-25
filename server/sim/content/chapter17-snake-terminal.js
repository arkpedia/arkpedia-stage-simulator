// SPDX-License-Identifier: GPL-3.0-or-later
// Terminal phase only. The complete boss remains behind its support gate.
import contract from '../../../data/candidates/arkpedia-ch17-snake-terminal-contract.json' with {type:'json'};
import {currentHpZeroAttemptReceipt} from '../damage.js';
import {startChapter17SnakeCounter} from './chapter17-boss-counter.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function installChapter17SnakeTerminal(b,e,{finishWave}={}){
 const r=e?.def?.raw,p=contract.record;
 if(e?.defId!==contract.enemy||r?.key!==contract.enemy||r.prefabKey!==contract.enemy||!same(r.talents?.groups,p.groups)
  ||!same(r.talents?.bb,p.bb)||!same(r.skills,p.skills)||!same(r.abilities,p.abilities)||typeof finishWave!=='function')
  throw Error('Unreviewed snake terminal contract or missing canonical wave receiver');
 const life=e.deploySeq,handles=[],attempts=new WeakSet(),childSpec=contract.admission[0]._buff;
 const valid=()=>phase.active&&!b.finished&&e.alive&&e.deployed&&e.deploySeq===life;
 const old=e.mem.ch17SnakeTerminal;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one snake terminal controller');
 if(old?.active)old.stop();
 const phase={active:true,mode:'idle',ownerLife:life,pending:null,floor:null,committed:false,
  cancelPending(q){
   if(!q||!q.active)return;q.active=false;q.task?.cancel();q.counter?.cancel();
   if(phase.pending===q){phase.pending=null;if(phase.mode!=='committing')phase.mode='idle';}
   b.removeBuff(e,q.child);
  },
  stop(){
   if(!phase.active)return;phase.active=false;phase.mode='retired';phase.cancelPending(phase.pending);phase.mode='retired';
   b.removeBuff(e,phase.floor);for(const handle of handles)b.off(handle);
   if(e.mem.ch17SnakeTerminal===phase)delete e.mem.ch17SnakeTerminal;
  },
  begin(){
   if(!valid()||phase.pending||phase.committed||!e.buffs.includes(phase.floor))return;
   const q={active:true,child:null,task:null,counter:null};phase.pending=q;phase.mode='waiting';
   q.child=b.addBuff(e,{key:childSpec.buffKey,source:e,persist:true,
    onRemove:()=>{if(q.active)phase.cancelPending(q);}});
   if(!q.child||!valid()||phase.pending!==q){phase.cancelPending(q);b.removeBuff(e,q.child);if(!valid())phase.stop();return;}
   q.task=b.after(childSpec.triggerInterval,()=>{
    if(!valid()){phase.stop();return;}
    if(!q.active||phase.pending!==q||!e.buffs.includes(phase.floor)||!e.buffs.includes(q.child)){phase.cancelPending(q);return;}
    phase.mode='button';
    q.counter=startChapter17SnakeCounter(b,e,{kind:'final',applyBuff:receipt=>{
     if(!valid()||phase.pending!==q||!q.active||receipt.owner!==e||receipt.ownerLife!==life
      ||receipt.kind!=='final'||receipt.buffKey!=='enemy_musnake_kill_self_buff'||phase.committed)return;
     phase.committed=true;phase.mode='committing';phase.cancelPending(q);
     // Preserve the literal retained (misspelled) finish key. Do not alias it
     // to the actual floor; scripted InstantKill bypasses HP-set guards.
     b.removeBuff(e,contract.finish.find(n=>n.$type.endsWith('+FinishBuffsById'))._buffKey);
     const action=Object.freeze({...contract.finish.find(n=>n.$type.endsWith('+FinishCurrentWave'))});
     const waveReceipt=Object.freeze({source:e,sourceLife:life,action});
     try{b.kill(e,e);}finally{
      // Native AlwaysNext continues the wave handoff after InstantKill, even
      // if its removal handlers retire this controller or revive the body.
      try{finishWave(waveReceipt);}finally{phase.stop();}
     }
    }});
    if(!valid()){q.counter?.cancel();phase.stop();}
   },{owner:e});
  },
 };
 e.mem.ch17SnakeTerminal=phase;
 handles.push(b.on('hpZeroAttempt',ctx=>{
  const receipt=currentHpZeroAttemptReceipt(ctx,b);
  if(receipt?.unit===e&&receipt.unitLife===life&&!attempts.has(receipt)){attempts.add(receipt);phase.begin();}
 },{owner:phase}),b.on('tick',()=>{
  if(!valid()||!e.buffs.includes(phase.floor)){phase.stop();return;}
  if(phase.pending&&!e.buffs.includes(phase.pending.child))phase.cancelPending(phase.pending);
 },{owner:phase}),b.on('death',({unit})=>{if(unit===e)phase.stop();},{owner:phase}),
 b.on('removed',({unit})=>{if(unit===e)phase.stop();},{owner:phase}),b.on('battleEnd',()=>phase.stop(),{owner:phase}));
 phase.floor=b.addBuff(e,{key:contract.beforeDead.buffKey,source:e,persist:true,flags:{undeadable:true},onRemove:()=>phase.stop()});
 if(!phase.floor||!valid()){phase.stop();b.removeBuff(e,phase.floor);throw Error('Snake terminal floor admission failed');}
 return phase;
}
