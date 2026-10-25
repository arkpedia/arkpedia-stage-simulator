// SPDX-License-Identifier: GPL-3.0-or-later
// Source-bound subsystem; installing this does not approve the full enemy.
import contract from '../../../data/candidates/arkpedia-ch17-snake-health-contract.json' with {type:'json'};
import {hpLossStages} from './hp-loss-stages.js';
import {attachSnakeInteractionWait,snakeInteractionWaiting} from './chapter17-snake-wait.js';
import {startChapter17SnakeCounter} from './chapter17-boss-counter.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function installChapter17SnakeHealth(b,e,{interruptCurrent}={}){
 const r=e?.def?.raw,p=contract.record;
 if(e?.defId!==contract.enemy||r?.key!==contract.enemy||r.prefabKey!==contract.enemy||!same(r.talents?.groups,p.groups)
  ||!same(r.talents?.bb,p.bb)||!same(r.skills,p.skills)||!same(r.abilities,p.abilities)||typeof interruptCurrent!=='function'
  ||b.finished||!e.alive||!e.deployed||!(e.hp>0&&e.hp<=e.s.maxHp))throw Error('Unreviewed snake health contract or missing cast interrupt receiver');
 const life=e.deploySeq,handles=[],tracker=hpLossStages(e.hp/e.s.maxHp,contract.defaults.step);
 const old=e.mem.ch17SnakeHealth;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one snake health controller');
 if(old?.active)old.stop();
 const valid=()=>phase.active&&!b.finished&&e.alive&&e.deployed&&e.deploySeq===life;
 const terminal=()=>{const t=e.mem.ch17SnakeTerminal;return t?.active&&t.ownerLife===life&&['waiting','button','committing'].includes(t.mode);};
 const phase={active:true,ownerLife:life,parent:null,window:null,injured:null,tracker,nextPoll:b.time+contract.defaults.interval,
  cancelWindow(q=phase.window){
   if(!q?.active)return;q.active=false;q.counter?.cancel();if(phase.window===q)phase.window=null;b.removeBuff(e,q.buff);
  },
  cancelInjury(q=phase.injured){
   if(!q?.active)return;q.active=false;q.task?.cancel();if(phase.injured===q)phase.injured=null;b.removeBuff(e,q.buff);
  },
  stop(){
   if(!phase.active)return;phase.active=false;phase.cancelWindow();phase.cancelInjury();b.removeBuff(e,phase.parent);
   for(const h of handles)b.off(h);if(e.mem.ch17SnakeHealth===phase)delete e.mem.ch17SnakeHealth;
  },
  injure(){
   if(!valid()||terminal()||snakeInteractionWaiting(e)||phase.injured)return;
   const flags=e.s.flags;if(flags.stun||flags.freeze||flags.levitate||flags.sleep)return;
   // The actor owns active cast/projectile cleanup and palsying interruption;
   // it must consume the retained forced-skill intent, not just reset a timer.
   interruptCurrent(Object.freeze({source:e,sourceLife:life,action:contract.success[1]}));
   if(!valid()||terminal())return;
   const q={active:true,buff:null,task:null};phase.injured=q;
   q.buff=b.addBuff(e,{key:'enemy_jmusnake_injury_action',source:e,persist:true,flags:{noMove:true,disarm:true},
    onRemove:()=>phase.cancelInjury(q)});
   if(!q.buff||!valid()||terminal()||phase.injured!==q){phase.cancelInjury(q);b.removeBuff(e,q.buff);return;}
   q.task=b.after(contract.defaults.duration,()=>phase.cancelInjury(q),{owner:e});
   b.dealDamage(e,e,{amount:e.s.maxHp*contract.defaults.injury,type:'true',applyWay:'none',canDodge:false,isAttack:false,isSkill:true});
   if(!valid())phase.stop();else if(terminal())phase.cancelInjury(q);
  },
  begin(crossing){
   const q={active:true,buff:null,counter:null,crossing};phase.window=q;
   q.buff=attachSnakeInteractionWait(b,e,{onRemove:()=>phase.cancelWindow(q)});
   if(!q.buff||!valid()||terminal()||phase.window!==q){phase.cancelWindow(q);b.removeBuff(e,q.buff);return;}
   q.counter=startChapter17SnakeCounter(b,e,{kind:'step',applyBuff:receipt=>{
    if(!valid()||terminal()||!q.active||phase.window!==q||receipt.owner!==e||receipt.ownerLife!==life||receipt.kind!=='step')return;
    phase.cancelWindow(q);
    if(receipt.buffKey==='enemy_musnake_stun_buff')phase.injure();
    else if(receipt.buffKey==='enemy_musnake_heal_buff'){
     try{b.heal(e,e,e.s.maxHp*contract.defaults.heal);}finally{
      b.emit('ch17SnakeRecovery',{source:e,sourceLife:life,key:'musnake_heal_self',addition:1});
     }
    }
   }});
   if(!valid()||terminal()||phase.window!==q){phase.cancelWindow(q);q.counter?.cancel();}
  },
 };
 e.mem.ch17SnakeHealth=phase;
 handles.push(b.on('tick',()=>{
  if(!valid()||!e.buffs.includes(phase.parent)){phase.stop();return;}
  if(terminal()){phase.cancelWindow();phase.cancelInjury();return;}
  if(phase.window&&!e.buffs.includes(phase.window.buff))phase.cancelWindow();
  if(b.time+1e-9<phase.nextPoll)return;phase.nextPoll=b.time+contract.defaults.interval;
  if(phase.window||snakeInteractionWaiting(e))return;
  const crossing=tracker.consume(e.hp/e.s.maxHp);if(crossing)phase.begin(crossing);
 },{owner:phase}),b.on('ch17SnakeTerminalStarted',()=>{
  if(terminal()){phase.cancelWindow();phase.cancelInjury();}
 },{owner:phase}),b.on('death',({unit})=>{if(unit===e)phase.stop();},{owner:phase}),
 b.on('removed',({unit})=>{if(unit===e)phase.stop();},{owner:phase}),b.on('battleEnd',()=>phase.stop(),{owner:phase}));
 phase.parent=b.addBuff(e,{key:contract.parent.buffKey,source:e,persist:true,flags:{noMove:true},onRemove:()=>phase.stop()});
 if(!phase.parent||!valid()){phase.stop();b.removeBuff(e,phase.parent);throw Error('Snake HP parent admission failed');}
 return phase;
}
