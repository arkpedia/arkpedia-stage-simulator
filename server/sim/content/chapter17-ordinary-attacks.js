// SPDX-License-Identifier: GPL-3.0-or-later
// Selected native Attack events; generic AI still supplies target/body sorting.
// Clip-rate, movement hold and fixed-tick dispatch are explicit local mappings,
// not compiled native FSM/frame proof. Born projectiles keep their own lifetime.
import {chapter17AttackEvents} from './chapter17-attack-clocks.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
const live=u=>u?.alive&&u.deployed&&!u.hidden;
const controlled=e=>['stun','freeze','sleep','levitate','fear','disarm'].some(k=>e.s.flags[k])
 ||e.s.flags.noCombat&&(e.blockedBy||e.def.applyWay==='MELEE');

export function chapter17OrdinaryAttack(record){
 const timing=chapter17AttackEvents(record);if(!timing)return null;
 return ordinaryAttackFromClock(timing);
}

// Shared cast ownership; callers must independently bind their native clock.
export function ordinaryAttackFromClock(timing,{tag='chapter17',key='ch17:ordinary-cast',memory='ch17OrdinaryAttack'}={}){
 return{
  spawn(b,e,a){
   const life=e.deploySeq;
   const deferred=timing.damageType==='arts';
   if(deferred!==!!e.profile.deferHit)throw Error('Missing selected Chapter 17 Attack projectile owner');
   a.active=true;a.pending=null;a.handles=[];
   a.attached=()=>a.active&&!b.finished&&!b._endReq&&e.alive&&e.deployed&&e.deploySeq===life&&e.profile.sourceAttack===a;
   const valid=()=>a.attached()&&!e.hidden;
   a.finish=p=>{if(a.pending!==p)return;a.pending=null;b.removeBuff(e,p.hold);};
   a.begin=targets=>{
    if(!valid()||controlled(e)||a.pending||!targets.length||targets.some(t=>!live(t)))return false;
    const p={targets:targets.map(unit=>({unit,life:unit.deploySeq})),epoch:e.attackControlEpoch,age:0,startedAt:b.time,lastAt:b.time,
     rate:e.s.interval>0?Math.min(1,e.base.bat/e.s.interval):1,released:false,attackId:++b._attackSeq,deferred};
    a.pending=p;e.lastAttackAt=b.time;e.stats.attacks++;e.atkCd=e.s.interval;
    p.hold=b.addBuff(e,{key:`${key}:${life}`,persist:true,flags:{noMove:true}});
    // beforeBuff may retire this life or replace the cast before addBuff returns.
    if(!p.hold||a.pending!==p||!valid()||controlled(e)||p.epoch!==e.attackControlEpoch){
     b.removeBuff(e,p.hold);a.finish(p);return false;
    }
    return true;
   };
   a.advance=p=>{
    const current=()=>valid()&&a.pending===p&&!controlled(e)&&p.epoch===e.attackControlEpoch;
    if(!current()){a.finish(p);return;}
    p.age+=sourceAbilityDelta(e,Math.max(0,b.time-p.lastAt),true)*p.rate;p.lastAt=b.time;
    if(!p.released&&p.age+1e-7>=timing.hit){
     p.released=true;
     const targets=p.targets.filter(t=>live(t.unit)&&t.unit.deploySeq===t.life).map(t=>t.unit);
     for(const target of targets){
      if(!current())return;
      b._ev(['atk',e.id,target.id,'none']);
      if(!p.deferred)b.dealDamage(e,target,{amount:e.s.atk*(e.profile?.atkScale??1),type:timing.damageType,isAttack:true,
       attackId:p.attackId,canDodge:true,applyWay:'melee',tags:[tag,'ordinary-native-event']});
     }
     // Channel-caster Attack handlers launch their source-bound speed-ten shot
     // here, at OnAttack, rather than when AI first accepts the input target.
     if(current())b.emit('attack',{attacker:e,targets,isSkill:false,profile:e.profile,attackId:p.attackId});
    }
    if(!current()||p.age+1e-7>=timing.duration)a.finish(p);
   };
   a.detach=()=>{if(!a.active)return;a.active=false;if(a.pending)a.finish(a.pending);for(const h of a.handles)b.off(h);a.handles=[];};
   e.profile.sourceAttack=a;e.mem[memory]=a;
   a.handles.push(b.on('removed',({unit})=>{if(unit===e)a.detach();},{owner:e}),b.on('battleEnd',a.detach,{owner:e}));
  },
  tick(b,e,a){if(!a.active)return;if(!a.attached())a.detach();else if(a.pending)a.advance(a.pending);},
  death(c,b,e,a){a.detach();},
 };
}
