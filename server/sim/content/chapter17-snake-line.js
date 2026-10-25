// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-snake-line-contract.json' with {type:'json'};
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {captureEnemySource} from './enemy-source-view.js';
import {beamIntersection} from './chapter17.js';
import {snakeInteractionWaiting} from './chapter17-snake-wait.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),d=contract.defaults,outputs=new WeakMap();
const live=u=>u?.alive&&u.deployed&&!u.hidden;
const sourceFor=p=>p.owner.deploySeq===p.ownerLife?p.owner:p.source;
const intrinsic=e=>['stun','freeze','sleep','levitate'].some(k=>e.s.flags[k]);
function outputFor(b){
 let output=outputs.get(b);if(output)return output;
 output={active:true,nextId:0,beams:new Set(),impacts:new Map(),actors:new Set(),handles:[],
  prune(){if(output.actors.size||output.beams.size||output.impacts.size)return;output.active=false;for(const h of output.handles)b.off(h);if(outputs.get(b)===output)outputs.delete(b);},
 };outputs.set(b,output);
 const impact=(p,target)=>{
  const old=output.impacts.get(target);if(old)old.stop();
  const life=target.deploySeq,q={active:true,parent:null,child:null,owner:p.owner,ownerLife:p.ownerLife,
   fallback:p.owner.deploySeq===p.ownerLife?captureEnemySource(p.owner):p.source,hits:0,
   get source(){return q.owner.deploySeq===q.ownerLife?q.owner:q.fallback;},
   valid:()=>q.active&&!b.finished&&target.alive&&target.deployed&&target.deploySeq===life&&output.impacts.get(target)===q,
   stop(){if(!q.active)return;q.active=false;if(output.impacts.get(target)===q)output.impacts.delete(target);b.removeBuff(target,q.parent);b.removeBuff(target,q.child);},
  };output.impacts.set(target,q);
  q.parent=b.addBuff(target,{key:'enemy_musnake_line_buff',source:q.source,duration:d.dotDuration,sourceStatusResistable:false,
   interval:d.interval,onRemove:()=>q.stop(),onExpire:()=>q.stop(),onTick(){
    if(!q.valid()){q.stop();return;}if(q.hits++>=Math.round(d.dotDuration/d.interval))return;
    b.dealDamage(q.source,target,{amount:d.damage,type:'true',applyWay:'none',isAttack:false,isSkill:true,canDodge:false,
     ignoreSelect:true,tags:['chapter17','snake-line','dot','periodic']});
    if(!q.valid())q.stop();
   }});
  if(!q.parent||!q.valid()){q.stop();b.removeBuff(target,q.parent);return;}
  const key='ch17:snake-line-stun:'+ ++output.nextId;
  b.applyStatus(target,'stun',{key,source:q.source,duration:d.dotDuration,ignoreSelect:true,refresh:'replace',admit:()=>q.valid()});
  q.child=target.findBuff(key)??null;
  if(!q.valid()){q.stop();b.removeBuff(target,q.child);}
 };
 output.handles.push(b.on('tick',()=>{
  for(const p of [...output.beams]){
   if(b.finished)break;
   const dt=Math.min(Math.max(0,b.time-p.lastAt),d.maxAge-p.age);p.lastAt=b.time;
   if(dt<=0)continue;const ny=p.y-d.speed*dt;
   const hits=b.allies().filter(t=>live(t)&&!t.isFlying)
    .map(t=>({target:t,at:beamIntersection(p.x,p.y,p.x,ny,t,d.radius)})).filter(h=>h.at!==null)
    .sort((a,z)=>a.at-z.at||a.target.id-z.target.id);
   p.y=ny;p.age+=dt;
   if(hits.length){output.beams.delete(p);impact(p,hits[0].target);}
   else if(p.age>=d.maxAge-1e-9)output.beams.delete(p);
  }
  for(const q of [...output.impacts.values()])if(!q.valid())q.stop();
  output.prune();
 },{owner:output,priority:-100}),b.on('battleEnd',()=>{
  output.active=false;output.beams.clear();for(const q of [...output.impacts.values()])q.stop();
  for(const h of output.handles)b.off(h);outputs.delete(b);
 },{owner:output}));
 return output;
}

export function installChapter17SnakeLine(b,e){
 const r=e?.def?.raw,p=contract.record;
 if(e?.defId!==contract.enemy||r?.key!==contract.enemy||r.prefabKey!==contract.enemy||!same(r.talents?.groups,p.groups)
  ||!same(r.talents?.bb,p.bb)||!same(r.skills,p.skills)||!same(r.abilities,p.abilities)||!live(e)||b.finished)
  throw Error('Unreviewed snake global line contract');
 const rect=b.rect,peel=d.borderToPeel;
 if(!['r0','r1','c0','c1'].every(k=>Number.isSafeInteger(rect?.[k]))||rect.r1-rect.r0<2*peel||rect.c1-rect.c0<2*peel)
  throw Error('Snake line requires a full canonical grid rectangle');
 const life=e.deploySeq,old=e.mem.ch17SnakeLine;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one snake line controller');
 if(old?.active)old.stop();
 const output=outputFor(b),handles=[],valid=()=>state.active&&!b.finished&&live(e)&&e.deploySeq===life,originalNoAttack=e.profile.noAttack;
 const waiting=()=>snakeInteractionWaiting(e)||!!e.mem.ch17SnakeHealth?.injured;
 const state={active:true,ownerLife:life,pending:null,cooldown:d.initialCooldown,output,
  interrupt(){const q=state.pending;if(!q)return;state.pending=null;state.cooldown=d.cooldown;b.removeBuff(e,q.hold);},
  stop(){
   if(!state.active)return;state.active=false;state.interrupt();for(const h of handles)b.off(h);
   if(e.mem.ch17SnakeLine===state)delete e.mem.ch17SnakeLine;
   if(e.deploySeq===life)e.profile.noAttack=originalNoAttack;
   output.actors.delete(state);output.prune();
  },
  cast(){
   if(!valid()||state.pending||state.cooldown>1e-9||waiting()||intrinsic(e)||e.s.flags.disarm)return false;
   const q={age:0,lastAt:b.time,epoch:e.actionControlEpoch,released:false,hold:null};state.pending=q;
   q.hold=b.addBuff(e,{key:'ch17:snake-line-cast',source:e,persist:true,flags:{noMove:true}});
   if(!q.hold||!valid()||state.pending!==q){state.interrupt();b.removeBuff(e,q.hold);return false;}
   q.epoch=e.actionControlEpoch;b.emit('ch17SnakeLineCast',{source:e,sourceLife:life});return true;
  },
 };
 e.mem.ch17SnakeLine=state;e.profile.noAttack=true;
 output.actors.add(state);
 handles.push(b.on('tick',({dt})=>{
  if(!valid()){state.stop();return;}
  const q=state.pending;
  if(q){
   if(intrinsic(e)||q.epoch!==e.actionControlEpoch||!e.buffs.includes(q.hold)){state.interrupt();return;}
   q.age+=sourceAbilityDelta(e,Math.max(0,b.time-q.lastAt),true);q.lastAt=b.time;
   if(!q.released&&q.age+1e-7>=d.hit){
    q.released=true;const source=captureEnemySource(e);
    for(let col=rect.c0+peel;col<=rect.c1-peel;col++)output.beams.add({owner:e,ownerLife:life,source,x:col,y:rect.r1-peel,age:0,lastAt:b.time});
    b.emit('ch17SnakeLineReleased',{source:e,sourceLife:life,count:rect.c1-rect.c0+1-2*peel});
    if(!valid()||state.pending!==q)return;
   }
   if(q.age+1e-7>=d.duration)state.interrupt();
  }else{
   if(!intrinsic(e))state.cooldown=Math.max(0,state.cooldown-dt);
   state.cast();
  }
 },{owner:state}),b.on('beforeStatus',c=>{
  if(c.target===e&&valid()&&state.pending&&c.status==='stun')c.cancel=true;
 },{owner:state,priority:1000}),b.on('beforeBuff',c=>{
  const f=c.buff.flags;if(c.unit===e&&valid()&&state.pending&&(c.buff.status==='stun'||f?.stun&&!f.freeze&&!f.sleep&&!f.levitate))c.cancel=true;
 },{owner:state,priority:1000}),b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),
 b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}));
 return state;
}
