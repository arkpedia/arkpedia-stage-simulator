// SPDX-License-Identifier: GPL-3.0-or-later
// Selected controller; public admission remains a separate gate.
import evidence from '../../../data/arkpedia-native-operators/char_4234_pedro.json' with {type:'json'};
import clocks from '../../../data/arkpedia-pedro-clocks.json' with {type:'json'};
import {PEDRO_ID as ID,pedroNativeInputs} from './arkpedia-pedro-source.js';
import {preparePedroResources,PEDRO_RESOURCE_CONTRACT} from './arkpedia-pedro-resources.js';
import {sortEnemyTargets,canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const PEDRO_CONTRACT=Object.freeze({
 scope:'Selected Pedro single-target ordinary Arts shots, offensive-auto two-target S1 and fixed-clock two-charge S2 ally protection; no public admission',
 mapping:'Capture inputs at windup. Ordinary/S1 use the original input-time BAT/interval playback capped at one and preserve positive ordinary cooldown through casts/control. S1 spends one charge at its next attack attempt, gives one accepted multi-target attack receipt, does not earn attack SP, and refunds only when every captured life is lost before release. S1 prefers unmarked enemies. Direct shots use speed fifteen and current same-deployment ATK at impact, falling back to birth ATK after source departure. S1 attaches its captured one-use mark after that projectile damage, so the same direct hit does not consume its own newly attached mark. S2 captures up to three legal allies, preferring unprotected then lowest HP ratio, and plays its original fixed-time clip with live native slow-down, independently of ASPD. It creates protection at the original marker without an ordinary attack/heal receipt. S2 may replace birth or an ordinary windup; a prior positive attack cooldown remains. Any accepted action-stop epoch, including disarm, conservatively interrupts a pending cast, even if the control expires between ticks. Lost inputs are omitted, never replaced. Born flights/recipient resources survive legal source departure; pending work and all flights stop at battle end.',
 limits:'The resource contract retains cached/trigger lifetime and attribution limits. Windup selection, S1 damage-before-mark order, current-versus-cached ordinary damage, interruption/refund order and native disarm-versus-heal-cast behavior, capped-clock/interval interaction, S2 lowest-HP priority and fixed-time/slow_down mapping, birth/cast FSM priority and callback serialization are explicit local interpretations. Compiled C# order, modules, native effects/audio, original game-frame/pixel parity and public admission remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const air={canHitFly:true};
const due=(b,t)=>b.time+1e-7>=t;
export class PedroController{
 constructor(b,u,resources){this.b=b;this.u=u;this.resources=resources;this.record=resources.record;this.seq=null;this.phase=null;this.stopped=false;this.handles=[];this.accepting=false;this.finishing=false;this.facing=u.dir;this.visualSeq=0;this.flights=new Set();this.flightHandles=[];}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return {...evidence.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Pedro clip: '+clip);this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`pedro:${this.seq}:${++this.visualSeq}`}:{})};}
 idle(){this.facing=this.u.dir;this.visual('Idle',1,true);}
 face(t){if(!t)return;const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 clip(skill=0){return skill?`Skill_${this.facing==='DOWN'?'Down_':''}${skill}`:this.facing==='DOWN'?'Attack_Down':'Attack';}
 refresh(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);}
 enemies(s1=false){this.refresh();const ts=this.b.enemiesInKeys(this.u.rangeKeys,this.u,air);sortEnemyTargets(this.b,this.u,ts);
  if(s1)ts.sort((a,z)=>Number(!!a.findBuff('pedro:s1:trigger'))-Number(!!z.findBuff('pedro:s1:trigger')));return ts.slice(0,s1?this.record.bb.max_target:1);}
 allies(){this.refresh();const keys=new Set(this.u.rangeKeys);return this.b.allyUnits.filter(t=>present(t)&&t.side==='ally'&&t.kind==='op'&&!t.s.flags.healFree&&bodyInKeys(t,keys))
  .sort((a,z)=>Number(!!a.findBuff('pedro:s2:protection'))-Number(!!z.findBuff('pedro:s2:protection'))||a.hp/a.s.maxHp-z.hp/z.s.maxHp||z.deploySeq-a.deploySeq).slice(0,this.record.bb.max_target);}
 canCast(){return this.valid()&&live(this.u)&&this.u.canAct&&!this.u.skill.active
  &&(this.record.index===0?!this.u.s.flags.disarm&&this.phase?.kind!=='born'&&this.u.atkCd<=1e-9&&this.enemies(true).length>0:this.phase?.kind!=='s2'&&this.allies().length>0);}
 start(){if(this.record.index===0){this.beginAttack(this.enemies(true),true);return;}
  const inputs=this.allies().map(target=>({target,life:target.deploySeq}));this.face(inputs[0]?.target);const clip=this.clip(2),m=this.model();
  this.phase={kind:'s2',inputs,epoch:this.u.attackControlEpoch,age:0,lastAt:this.b.time,releaseAge:m.eventPayloads[clip][0].time,untilAge:m.exactDurations[clip],released:false};this.visual(clip,this.u.s.slowDownRate);
 }
 beginAttack(targets,s1=false){this.face(targets[0]);const clip=this.clip(s1?1:0),m=this.model(),speed=Math.min(1,this.u.base.bat/this.u.s.interval);
  const releaseAt=this.b.time+m.eventPayloads[clip][0].time/speed,period=Math.max(this.u.s.interval,releaseAt-this.b.time);
  this.phase={kind:'attack',s1,inputs:targets.map(target=>({target,life:target.deploySeq})),epoch:this.u.attackControlEpoch,releaseAt,until:this.b.time+period,released:false,accepted:false,pending:null,allLost:false};this.u.atkCd=period;this.visual(clip,speed);
 }
 finishSkill(reason,refund=false){this.finishing=true;try{if(this.u.skill.active)this.u.skill.end(reason);if(refund&&this.valid())this.u.skill.addCharge(1);}finally{this.finishing=false;}}
 ended(){if(this.finishing||!this.valid())return;this.phase=null;this.idle();}
 admissible(ts){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm&&p?.kind==='attack'&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&due(this.b,p.releaseAt)
  &&ts.length>0&&ts.length===p.pending?.length&&ts.every((t,i)=>t===p.pending[i]&&p.inputs.some(x=>x.target===t&&x.life===t.deploySeq)&&canTargetEnemy(this.u,t,air));}
 watchFlights(){if(this.flightHandles.length)return;const b=this.b;
  this.flightHandles.push(b.on('tick',()=>{for(const f of this.flights)if(!b.projectiles.list.includes(f))this.flights.delete(f);if(!this.flights.size)this.unwatchFlights();}),
   b.on('battleEnd',()=>{b.projectiles.remove(p=>this.flights.has(p));this.flights.clear();this.unwatchFlights();}));
 }
 unwatchFlights(){for(const h of this.flightHandles)this.b.off(h);this.flightHandles=[];}
 flight(t,info,s1){const b=this.b,u=this.u,life=t.deploySeq,sourceLife=u.deploySeq,birthAtk=u.s.atk*u.s.atkScaleMul,scale=s1?this.record.bb.atk_scale:1,ticket=s1?this.resources.captureS1(t):null;
  const p=b.addProjectile({from:u,target:t,source:u,speed:15,maxAge:10,visual:'bolt',data:{arkpediaTrackedVisual:true,pedroOwner:u.id,pedroS1:s1},onHit:({target})=>{
   this.flights.delete(p);if(!this.flights.size)this.unwatchFlights();if(b.finished||!target||target.deploySeq!==life||!canTargetEnemy(u,target,air))return;
   const atk=present(u)&&u.deploySeq===sourceLife?u.s.atk*u.s.atkScaleMul:birthAtk;
   b.dealDamage(u,target,{amount:atk*scale,type:'arts',isAttack:true,isSkill:info.isSkill,attackId:info.attackId,applyWay:'ranged',tags:[s1?'pedro:s1-shot':'pedro:ordinary']});
   if(ticket&&!b.finished&&present(target)&&target.deploySeq===life)this.resources.applyS1(ticket);
  }});this.flights.add(p);this.watchFlights();
 }
 release(ts,info){if(!this.admissible(ts))return false;const p=this.phase;p.accepted=true;
  for(const t of ts){if(!this.valid())break;this.flight(t,info,p.s1);}return true;
 }
 tick(){if(!this.valid())return;const {b,u}=this;for(const f of this.flights)if(!b.projectiles.list.includes(f))this.flights.delete(f);let p=this.phase;
  if(p?.kind==='born'){if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(!live(u)||!u.canAct||(p?.kind!=='s2'&&u.s.flags.disarm)||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){if(p?.kind==='s2'||p?.s1)this.finishSkill('interrupted');this.phase=null;this.idle();return;}
  if(p?.kind==='s2'){
   if(!u.skill.active){this.phase=null;this.idle();return;}p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true);p.lastAt=b.time;u.mem.regularFormVisual.speed=u.s.slowDownRate;
   if(!p.released&&p.age+1e-7>=p.releaseAge){p.released=true;for(const x of p.inputs){if(!this.valid()||this.phase!==p)break;if(present(x.target)&&x.life===x.target.deploySeq)this.resources.protect(x.target);}}
   if(!this.valid()||this.phase!==p)return;if(p.age+1e-7>=p.untilAge){this.finishSkill('cast-finished');this.phase=null;this.idle();}return;
  }
  if(p?.kind==='attack'){
   if(!p.released&&due(b,p.releaseAt)){p.released=true;p.pending=p.inputs.filter(x=>x.life===x.target.deploySeq&&canTargetEnemy(u,x.target,air)).map(x=>x.target);p.allLost=p.inputs.every(x=>!present(x.target)||x.life!==x.target.deploySeq);
    if(p.pending.length){this.accepting=true;try{b.forceAttack(u,p.pending);}finally{this.accepting=false;}}
   }
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;if(p.s1)this.finishSkill('cast-finished',p.allLost);this.phase=p=null;
  }
  if(u.atkCd>1e-9)return;const ts=this.enemies(false);if(!ts.length){this.idle();return;}
  if(this.record.index===0&&u.skill.ready&&this.canCast()){u.skill.activate('DEFAULT');return;}this.beginAttack(ts);
 }
 spec(){return {kind:this.record.index===1?'charges':'instant',silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},attack:{},completeOnAttack:false,pendingText:this.record.index===0?'Skill active · Marking shot':'Skill active · Protection',
  canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.ended()};}
 install(){if(this.handles.length||this.stopped)throw Error('Pedro cannot be reinstalled');this.resources.install();const{b,u}=this;
  this.handles.push(b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.facing=u.dir;const until=b.time+this.model().exactDurations.Start;
   u.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:u}),b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(true),{owner:u}));
 }
 stop(battleEnd=false){if(battleEnd){this.b.projectiles.remove(p=>this.flights.has(p));this.flights.clear();this.unwatchFlights();}if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;this.resources.stop();for(const h of this.handles)this.b.off(h);this.handles=[];
  delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;
 }
}
export function preparePedro(b,u,{contract}={}){
 if(contract!==PEDRO_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.pedro)throw Error('Fresh selected Pedro and explicit controller contract required');
 const n=pedroNativeInputs();if(n.ordinary._maxAnimScale!==1||n.s1Attack._maxAnimScale!==1||n.s1Attack._timeMode!==0||n.s2Heal._timeMode!==1
  ||n.s2Heal._affectedBySlowDown!==1||n.s1._recoverSpIfTargetDead!==1||n.s2._canCastDuringBorn!==1||n.s2._allowSpRecoveryWhenAffecting!==0||n.mixes.length)throw Error('Changed Pedro native clocks');
 const resources=preparePedroResources(b,u,{contract:PEDRO_RESOURCE_CONTRACT}),controller=new PedroController(b,u,resources);u.mem.pedro=controller;
 return{record:resources.record,resources,controller,kit:{install:null,talents:[],skill:controller.spec(),trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',projectile:'none',canHitFly:true,
  maxTargets:1,hits:1,hitsFn:null,chain:null,splashRadius:0,allInRange:false,hitAllBlocked:false,windup:0,requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,ts)=>controller.admissible(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>controller.release(ts,info)}}};
}
