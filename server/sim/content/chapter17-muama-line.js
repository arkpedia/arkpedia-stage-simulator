// SPDX-License-Identifier: GPL-3.0-or-later
// Internal source-bound actor; full boss/stage admission remains separate.
import contract from '../../../data/candidates/arkpedia-ch17-muama-line-contract.json' with {type:'json'};
import {canTargetAlly,sortAllyTargets} from '../targeting.js';
import {beamIntersection} from './chapter17.js';
import {captureEnemySource} from './enemy-source-view.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),outputs=new WeakMap();
const live=u=>u?.alive&&u.deployed&&!u.hidden,ground=u=>live(u)&&u.kind!=='device'&&!u.isFlying;
const intrinsic=e=>['stun','freeze','sleep','levitate','fear'].some(k=>e.s.flags[k]);
const original=p=>live(p.owner)&&p.owner.deploySeq===p.ownerLife&&p.actor.valid();
const sourceFor=p=>original(p)?p.owner:p.source;
function outputFor(b){
 let output=outputs.get(b);if(output)return output;
 output={active:true,nextId:0,beams:new Set(),impacts:new Map(),actors:new Set(),handles:[],
  prune(){if(output.actors.size||output.beams.size||[...output.impacts.values()].some(m=>m.size))return;
   output.active=false;for(const h of output.handles)b.off(h);if(outputs.get(b)===output)outputs.delete(b);
  },
  impact(p,target){
   const life=target.deploySeq,source=sourceFor(p),d=p.defaults;
   b.dealDamage(source,target,{amount:source.s.atk,type:'phys',applyWay:'ranged',isAttack:false,isSkill:true,canDodge:true,ignoreSelect:true,tags:['chapter17','muama-line','initial']});
   if(b.finished||!live(target)||target.deploySeq!==life)return;
   let group=output.impacts.get(d.buffKey);if(!group)output.impacts.set(d.buffKey,group=new Map());
   group.get(target)?.stop();
   const q={active:true,parent:null,child:null,hits:0,owner:p.owner,ownerLife:p.ownerLife,actor:p.actor,source:original(p)?captureEnemySource(p.owner):p.source,
    valid:()=>q.active&&!b.finished&&target.alive&&target.deployed&&target.deploySeq===life&&group.get(target)===q,
    stop(){if(!q.active)return;q.active=false;if(group.get(target)===q)group.delete(target);b.removeBuff(target,q.parent);b.removeBuff(target,q.child);},
   };group.set(target,q);
   q.parent=b.addBuff(target,{key:d.buffKey,source:sourceFor(q),duration:d.dotDuration,sourceStatusResistable:false,
    interval:d.interval,onRemove:()=>q.stop(),onExpire:()=>q.stop(),onTick(){
     if(!q.valid()){q.stop();return;}if(q.hits++>=Math.round(d.dotDuration/d.interval))return;
     b.dealDamage(sourceFor(q),target,{amount:d.damage,type:'true',applyWay:'none',isAttack:false,isSkill:true,canDodge:false,ignoreSelect:true,tags:['chapter17','muama-line','dot','periodic']});
     if(!q.valid())q.stop();
    }});
   if(!q.parent||!q.valid()){q.stop();b.removeBuff(target,q.parent);return;}
   const key='ch17:muama-line-stun:'+ ++output.nextId;
   b.applyStatus(target,'stun',{key,source:sourceFor(q),duration:d.dotDuration,ignoreSelect:true,refresh:'replace',admit:()=>q.valid()});
   q.child=target.findBuff(key)??null;if(!q.valid()){q.stop();b.removeBuff(target,q.child);}
  },
 };
 outputs.set(b,output);
 output.handles.push(b.on('tick',()=>{
  for(const p of [...output.beams]){
   if(b.finished)break;
   const d=p.defaults,dt=Math.min(Math.max(0,b.time-p.lastAt),d.maxAge-p.age);p.lastAt=b.time;if(dt<=0)continue;
   const nx=p.x+p.dx*d.speed*dt,ny=p.y+p.dy*d.speed*dt,hits=b.allies().filter(ground)
    .map(t=>({target:t,at:beamIntersection(p.x,p.y,nx,ny,t,d.radius)})).filter(h=>h.at!==null).sort((a,z)=>a.at-z.at||a.target.id-z.target.id);
   p.x=nx;p.y=ny;p.age+=dt;
   if(hits.length){output.beams.delete(p);output.impact(p,hits[0].target);}else if(p.age>=d.maxAge-1e-9)output.beams.delete(p);
  }
  for(const group of output.impacts.values())for(const q of [...group.values()])if(!q.valid())q.stop();output.prune();
 },{owner:output,priority:-100}),b.on('battleEnd',()=>{
  output.active=false;output.beams.clear();for(const group of output.impacts.values())for(const q of [...group.values()])q.stop();
  for(const h of output.handles)b.off(h);outputs.delete(b);
 },{owner:output}));
 return output;
}

export function installChapter17MuamaLine(b,e,{combat}={}){
 const proof=contract.enemies[e?.defId],r=e?.def?.raw;
 if(!proof||r?.key!==e.defId||r.prefabKey!==e.defId||!same(r.talents,proof.record.talents)||!same(r.skills,proof.record.skills)||!same(r.abilities,proof.record.abilities))throw Error('Unreviewed Muama line contract');
 if(!combat?.valid()||e.mem.ch17MuamaCombat!==combat||combat.ownerLife!==e.deploySeq||Math.abs(e.deployedAt-b.time)>1e-9)throw Error('Muama lines require the fresh deployment combat actor');
 const life=e.deploySeq,old=e.mem.ch17MuamaLine;if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one Muama line controller');if(old?.active)old.stop();
 const output=outputFor(b),handles=[],skills=proof.skills;
 const state={active:true,ownerLife:life,pending:null,output,extraActions:new Map(),cooldowns:Object.fromEntries(Object.entries(skills).map(([k,s])=>[k,s.defaults.initialCooldown])),
  valid:()=>state.active&&combat.valid()&&e.mem.ch17MuamaCombat===combat&&e.deploySeq===life,
  interrupt(){const q=state.pending;if(!q)return;state.pending=null;state.cooldowns[q.name]=q.defaults.cooldown;if(combat.actionBusy===q)combat.actionBusy=null;},
  stop(){if(!state.active)return;state.active=false;state.interrupt();for(const h of handles)b.off(h);if(combat.readyAction===state.tryReady)combat.readyAction=null;if(e.mem.ch17MuamaLine===state)delete e.mem.ch17MuamaLine;output.actors.delete(state);output.prune();},
  choices(name){
   const d=skills[name]?.defaults;if(!d)return[];
   const selector=Object.create(e);selector.blockedBy=null;
   return sortAllyTargets(e,b.allies().filter(t=>ground(t)&&canTargetAlly(selector,t,true)
    &&Math.abs(Math.round(d.horizontal?t.y:t.x)-Math.round(d.horizontal?e.y:e.x))<=1));
  },
  canAct({ignoreSilence=false}={}){return state.valid()&&!state.pending&&!combat.suspended&&!combat.pending&&!combat.actionBusy&&combat.cooldown<=1e-9
   &&!intrinsic(e)&&!e.s.flags.disarm&&(ignoreSilence||!e.s.flags.silence)&&!(e.s.flags.tremble&&e.blockedBy);},
  tryReady(){
   if(!state.canAct({ignoreSilence:true}))return false;
   const ready=Object.keys(skills).filter(name=>!e.s.flags.silence&&state.cooldowns[name]<=1e-9&&state.choices(name).length).map(name=>()=>state.cast(name));
   for(const action of state.extraActions.values())if(action.ready())ready.push(action.cast);
   return ready.length?(ready.length===1?ready[0]:b.rng.pick(ready))():false;
  },
  cast(name){
   const d=skills[name]?.defaults;if(!d||!state.canAct()||state.cooldowns[name]>1e-9)return false;
   const target=state.choices(name)[0];if(!target)return false;
   const direction=Math.sign(d.horizontal?target.x-e.x:target.y-e.y)|| (d.horizontal&&e.dir==='LEFT'?-1:1),
    q={name,defaults:d,target,targetLife:target.deploySeq,age:0,lastAt:b.time,epoch:e.actionControlEpoch,released:false,direction};
   state.pending=q;combat.actionBusy=q;combat.cooldown=Math.max(e.s.interval,d.duration);
   b.emit('ch17MuamaLineCast',{source:e,sourceLife:life,name,target});return true;
  },
  release(q){
   if(!state.valid()||state.pending!==q||!live(q.target)||q.target.deploySeq!==q.targetLife)return;
   const source=captureEnemySource(e),d=q.defaults,x=Math.round(e.x),y=Math.round(e.y);
   for(const offset of [-1,0,1])output.beams.add({owner:e,ownerLife:life,actor:state,source,defaults:d,x:d.horizontal?x:x+offset,y:d.horizontal?y+offset:y,
    dx:d.horizontal?q.direction:0,dy:d.horizontal?0:q.direction,age:0,lastAt:b.time});
   b.emit('ch17MuamaLineReleased',{source:e,sourceLife:life,name:q.name,target:q.target,count:3});
  },
 };
 e.mem.ch17MuamaLine=state;combat.readyAction=state.tryReady;output.actors.add(state);
 handles.push(b.on('tick',({dt})=>{
  if(!state.valid()){state.stop();return;}if(combat.suspended){state.interrupt();return;}
  for(const name of Object.keys(skills))if(state.pending?.name!==name&&!e.s.flags.stun)state.cooldowns[name]=Math.max(0,state.cooldowns[name]-dt);
  const q=state.pending;
  if(q){
   if(intrinsic(e)||q.epoch!==e.actionControlEpoch||combat.actionBusy!==q){state.interrupt();return;}
   q.age+=Math.max(0,b.time-q.lastAt);q.lastAt=b.time;
   if(!q.released&&q.age+1e-7>=q.defaults.hit){q.released=true;state.release(q);if(!state.valid()||state.pending!==q)return;}
   if(q.age+1e-7>=q.defaults.duration)state.interrupt();
  }
 },{owner:state,priority:50}),b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),
 b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}));
 return state;
}
