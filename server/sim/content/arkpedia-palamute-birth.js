// SPDX-License-Identifier: GPL-3.0-or-later
// Original selected companion deployment attack and finite capture links.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import clocks from '../../../data/arkpedia-recon-clocks.json' with {type:'json'};
import {PALAMUTE_ID as TOKEN,reconSourceComponent} from './arkpedia-recon-source.js';
import {PalamuteAttacks,preparePalamuteAttacks,PALAMUTE_ATTACK_CONTRACT} from './arkpedia-palamute-attacks.js';
import {absoluteRangeKeys,sortEnemyTargets} from '../targeting.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const PALAMUTE_BIRTH_CONTRACT=Object.freeze({
 scope:'Selected original Palamute deployment strike, finite fixed-destination projectiles and weight-aware one-second pull, with ordinary attacks and tactical-point lifecycle; no public admission',
 mapping:'Placement captures up to three eligible original x-4 recipients. Born resolves to Start at speed one, unaffected by ASPD; live native slow_down scales its opted-in clock. At the original .2-second marker a single shared attack receipt emits speed-ten fixed-destination links. Each retained enemy life receives 200% live same-life ATK Physical damage, or launch ATK after source retirement, then an eligible unblocked target is pulled with force zero towards the saved source anchor over at most one second, stopping half a tile away. Source-independent born links survive retirement and fake defeat; no stale recipient life is adopted. Control cancels an unfired birth phase; recovery uses Idle and does not repeat the initial Born attack. Battle end drains all transport and pull work.',
 limits:'Native TimeMode/selector/ability aliases, attach-time target capture, fixed-point receiver dispatch, attack accounting, retirement ATK fallback, projectile silence dispatch, linear timed pulling/control flags and collision/order are explicit local mappings. Native one-second link duration bounds the local pull rather than certifying compiled LinkProjectile velocity. No original particles/audio or muzzle/bone projection is delivered. Owner attacks, bombs and trait resources, public art/data admission, modules, physical devices and game-frame/pixel parity remain unverified.',
 frameParity:false,
});
const due=(a,z)=>a+1e-7>=z,present=u=>u?.alive&&u.deployed&&!u._removing;
function verify(){const a=reconSourceComponent('tokens',TOKEN,'1533476659973157372'),selector=reconSourceComponent('tokens',TOKEN,a._selector.m_PathID),talent=reconSourceComponent('tokens',TOKEN,'-4945779190920613380');
 const parts=e.projectiles.projectile_token_buddy_bddg_born.flatMap(r=>r.components.map(c=>c.data)),link=parts.find(c=>'_pullSourceOffset'in c),mover=parts.find(c=>'_speed'in c);
 if(a._animKey!=='Born'||a._timeMode!==1||a._waitForAttackEvent!==1||a._affectedBySlowDown!==1||a._projectileKey!=='projectile_token_buddy_bddg_born'||a._damageType!==1||a._attackType!==1||a._useCachedAtkOnly!==0||a._alwaysIncludeTarget!==0||a._allowNoTarget!==1||talent._castOnLocate!==0
  ||selector._targetMotion!==3||selector._postFilter!==4||selector._maxNum!==3||selector._maxTargetKey!=='max_target'||selector._ignoreTargetFree!==0
  ||link._linkDuration!==1||link._lifeTime!==5||link._managedBySource!==0||link._pullForceLevel!==0||link._pullSourceOffset!==.5||link._notInfluencedByBlock!==0||link._stopAfterPulledBack!==1||link._isSilenceable!==1
  ||mover._speed!==10||mover._keepUpdateTargetpos!==0||mover._keepUpdateDirection!==0)throw Error('Changed original Palamute Born/LinkProjectile inputs');
 return{link,mover};
}
export function preparePalamuteBirth(b,u,{contract}={}){
 if(contract!==PALAMUTE_BIRTH_CONTRACT)throw Error('Exact selected Palamute birth contract required');verify();
 // Run the ordinary source guards as well as the lifecycle's input validation.
 const prepared=preparePalamuteAttacks(b,u,{contract:PALAMUTE_ATTACK_CONTRACT}),attacks=new PalamuteBirth(prepared.controller);prepared.controller.combat=attacks;return{...prepared,attacks};
}
export class PalamuteBirth extends PalamuteAttacks{
 constructor(point){super(point);Object.assign(this,{birth:null,flights:new Set(),pulls:new Set(),watchers:[],linkSeq:0});this.native=verify();}
 placed(p){const u=p.unit,bb=this.point.record.talentBb[2],grid=e.tables.ranges[this.point.record.talents[2].rangeId].grids.map(g=>[g.row,g.col]);
  if(bb.atk_scale!==2||bb.max_target!==3||bb.force!==0)throw Error('Changed selected Palamute birth blackboard');
  const ts=this.b.enemiesInKeys(absoluteRangeKeys(grid,u.tileR,u.tileC,'RIGHT'),u,{canHitFly:true}).filter(t=>this.legal(u,t));sortEnemyTargets(this.b,u,ts);
  this.birth={point:p,seq:p.seq,inputs:ts.slice(0,bb.max_target).map(t=>({target:t,life:t.deploySeq})),epoch:u.attackControlEpoch,age:0,lastAt:this.b.time,released:false,accepted:false,bb};
 }
 bornComplete(p){const q=this.birth,u=p.unit;if(!q||q.point!==p||q.seq!==p.seq)return true;
  if(!this.point.current(p)||u.hidden||!u.canAct||u.s.flags.disarm||q.epoch!==u.attackControlEpoch){this.birth=null;return true;}
  q.age+=sourceAbilityDelta(u,Math.max(0,this.b.time-q.lastAt),true);q.lastAt=this.b.time;u.mem.regularFormVisual.speed=u.s.slowDownRate;
  if(!q.released&&due(q.age,e.models[TOKEN].Single.eventPayloads.Start[0].time)){
   q.released=true;const ts=q.inputs.filter(c=>c.target.deploySeq===c.life&&this.legal(u,c.target)).map(c=>c.target);
   if(ts.length){this.accepting=true;try{this.b.forceAttack(u,ts);}finally{this.accepting=false;}}
  }
  if(this.birth!==q||!this.point.current(p))return false;
  if(!due(q.age,clocks.tokens[TOKEN].models.Single.exactDurations.Start))return false;this.birth=null;return true;
 }
 admit(ts){const q=this.birth;if(!q)return super.admit(ts);const p=q.point,u=p.unit;
  return this.accepting&&!this.stopped&&this.point.current(p)&&p.mode==='born'&&!q.accepted&&q.released&&q.seq===p.seq&&!u.hidden&&u.canAct&&!u.s.flags.disarm&&u.attackControlEpoch===q.epoch
   &&ts.length>0&&ts.length<=q.bb.max_target&&new Set(ts).size===ts.length&&ts.every(t=>this.legal(u,t)&&q.inputs.some(c=>c.target===t&&c.life===t.deploySeq));
 }
 release(ts,info){const q=this.birth;if(!q)return super.release(ts,info);if(!this.admit(ts))return false;q.accepted=true;
  const u=q.point.unit,sourceSeq=q.seq,anchor={x:u.x,y:u.y},atk=u.s.atk*u.s.atkScaleMul,source=u;
  // Capture every birth before callbacks; one victim's retirement must not
  // silently change the source stats or life of a sibling projectile.
  for(const t of ts){const life=t.deploySeq,to={x:t.x,y:t.y};let projectile;
   projectile=this.b.addProjectile({from:anchor,to,source,speed:this.native.mover._speed,maxAge:this.native.link._lifeTime,visual:'none',data:{arkpediaInvisible:true,palamuteBorn:true},onHit:()=>{
    this.flights.delete(projectile);if(this.b.finished||t.deploySeq!==life||!this.legal(source,t)){this.unwatch();return;}
    const liveAtk=present(source)&&source.deploySeq===sourceSeq?source.s.atk*source.s.atkScaleMul:atk;
    this.b.dealDamage(source,t,{amount:liveAtk*q.bb.atk_scale,type:'phys',isAttack:true,isSkill:false,attackId:info.attackId,applyWay:'ranged',tags:['palamute:birth']});
    if(!this.b.finished&&t.deploySeq===life&&this.legal(source,t))this.pull(source,t,life,anchor,q.bb.force);
    this.unwatch();
   }});this.flights.add(projectile);
  }this.watch();return true;
 }
 pull(source,t,life,anchor,force){if(t.blockedBy||t.blocking?.length)return;
  const plan=this.b.planPull(t,force,{to:anchor,center:anchor,stop:this.native.link._pullSourceOffset});if(!plan)return;
  const key=`palamute:link:${source.id}:${++this.linkSeq}:${t.id}`,buff=this.b.addBuff(t,{key,source,flags:{noMove:true,disarm:true}});
  if(!buff)return;if(this.b.finished||!present(t)||t.deploySeq!==life||t.findBuff(key)!==buff){this.b.removeBuff(t,buff);return;}
  this.pulls.add({target:t,life,anchor,force,plan,buff,elapsed:0,moved:0,lastAt:this.b.time});this.watch();
 }
 finishPull(c){this.pulls.delete(c);this.b.removeBuff(c.target,c.buff);}
 tickTransport(){for(const p of this.flights)if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p))this.flights.delete(p);
  for(const c of[...this.pulls]){const t=c.target;
   if(!present(t)||t.deploySeq!==c.life||t.findBuff(c.buff.key)!==c.buff||t.hidden||t.blockedBy||t.blocking?.length){this.finishPull(c);continue;}
   const duration=this.native.link._linkDuration,spent=Math.min(duration-c.elapsed,Math.max(0,this.b.time-c.lastAt));c.lastAt=this.b.time;c.elapsed+=spent;
   const remain=this.b.planPull(t,c.force,{to:c.anchor,center:c.anchor,stop:this.native.link._pullSourceOffset});if(!remain){this.finishPull(c);continue;}
   const requested=Math.min(remain.distance,c.plan.distance-c.moved,c.plan.distance*spent/duration),moved=this.b.displace(t,remain.direction,requested);c.moved+=moved;
   if(!this.pulls.has(c))continue;if(!present(t)||t.deploySeq!==c.life||t.findBuff(c.buff.key)!==c.buff){this.finishPull(c);continue;}
   if(due(c.elapsed,duration)||due(c.moved,c.plan.distance)||moved<requested-1e-7)this.finishPull(c);
  }this.unwatch();
 }
 watch(){if(this.watchers.length)return;this.watchers=[this.b.on('tick',()=>this.tickTransport()),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size||this.pulls.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 drain(){this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();for(const c of[...this.pulls])this.finishPull(c);this.unwatch();}
 clear(p){super.clear(p);if(this.birth?.point===p)this.birth=null;}
 stop(){super.stop();this.birth=null;if(this.b.finished)this.drain();}
}
