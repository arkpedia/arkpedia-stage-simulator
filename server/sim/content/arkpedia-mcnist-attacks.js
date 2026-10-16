// SPDX-License-Identifier: GPL-3.0-or-later
// Source-bound ordinary attacks. Owner skills and public admission are separate.
import e from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import clocks from '../../../data/arkpedia-mcnist-clocks.json' with {type:'json'};
import {MCNIST_ID as ID,MCGRAF_ID as TOKEN,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {prepareMechanistBarriers,MCNIST_BARRIER_CONTRACT} from './arkpedia-mcnist-barriers.js';
import {selectedMcGrafBuild} from './arkpedia-mcgraf-source.js';
import {acquireTargets,effectiveProfile} from '../ai.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {canTargetEnemy} from '../targeting.js';
export const MCNIST_ATTACK_CONTRACT=Object.freeze({
 scope:'Selected Mechanist ordinary single-target physical projectile attacks and deployment barriers; skills/public admission held',
 mapping:'One legal captured target life per ordinary windup, including blocked enemies. Owner selector allows ground and air. Original Attack_A/Attack_Down OnAttack supplies release; available Attack_B is not randomly substituted. Input-time attack interval determines capped animation/ability playback; the native affected-by-slow-down flag separately scales elapsed ability time using its current live channel. Normal cooldown is kept through interrupted windup. One accepted ordinary receipt produces one original speed-twenty homing projectile, maximum lifetime ten seconds and one hit. Live same-deployment ATK is used on impact, falling back to birth ATK after departure. Born shots survive source departure; target life changes invalidate them. Action-stop epochs cancel pending work even if control ends between ticks.',
 limits:'Input-time/capped-clock interaction, blocked-first native post-filter mapping, captured targeting, live/cached impact ATK, born/ordinary FSM and callback order remain local interpretations. Owner S1/S2/S3, McGraf skills, modules, native effects/audio and original game-frame/pixel parity remain unverified. This adapter does not publicly admit Mechanist.',frameParity:false,
});
export const MCGRAF_ATTACK_CONTRACT=Object.freeze({
 scope:'Original selected S1/S2 McGraf ordinary ground-only, single-target physical melee attacks composed with its diagnostic lifecycle',
 mapping:'Captured legal ground target life and blocked-first ordinary selection. Release uses original _waitForAttackEvent=0 and _preDelay=0.699999988079071, separate from the artwork OnAttack marker. Input-time interval scales capped ability/animation playback, with live native slow-down applied once to elapsed ability time. Source physical damage is direct at release with one accepted ordinary receipt, not a homing projectile or splash. Start holds attacks for its original duration. Interrupted pending work preserves positive cooldown. Current facing selects original Front/Back; missing Back death is explicitly hidden.',
 limits:'Compiled predelay/ASPD/slow-down interaction, target capture, blocked-first post-filter, birth and interruption order are local mappings. Source S3 charge/mark behavior, owner skills, native effects/audio, modules and game-frame parity are not implemented by this ordinary attack adapter. No public summon approval.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const due=(b,t)=>b.time+1e-7>=t;
function verify(token=false){const n=mechanistNativeInputs(),as=token?n.tokenAttacks:[n.ordinary,n.combat];
 if(as.some(a=>a._timeMode!==0||a._maxAnimScale!==1||a._affectedBySlowDown!==1||a._damageType!==1||a._faceToTarget!==1
  ||a._waitForAttackEvent!==(token?0:1)||a._preDelay!==(token ? 0.699999988079071 : 0)
  ||a._animKey!==(token?'Attack':'Attack_A')||!token&&a._projectileKey!=='projectile_chr_mcnist'))throw Error('Changed original Mechanist/McGraf attack clock');
 const selectors=token?['7564532284548269363','-6555075353190906573']:['6579225236802572760'];
 for(const id of selectors){const s=mechanistSourceComponent(token?'tokens':'characters',token?TOKEN:ID,id);
  if(s._targetMotion!==(token?1:3)||s._maxNum!==1||s._limitTargetNum!==1||s._postFilter!==4||s._ignoreTargetFree!==0)throw Error('Changed ordinary source selector');}
 if(!token){const root=mechanistSourceComponent('projectiles','projectile_chr_mcnist','-2694207506809862212'),move=mechanistSourceComponent('projectiles','projectile_chr_mcnist','-6862309177850902596');
  if(root._maxHitNum!==1||root._lifeTime!==10||root._stopWhenSourceInvalid!==0||move._speed!==20||move._moveType!==1||move._delayToStart!==0)throw Error('Changed ordinary Mechanist projectile');}
}
function attackProfile(token,admit,release){return{noAttack:true,attackDrivenSkill:true,attack:token?'melee':'ranged',dmgType:'phys',projectile:'none',canHitFly:!token,
 maxTargets:1,hits:1,hitsFn:null,chain:null,splashRadius:0,allInRange:false,hitAllBlocked:false,windup:0,requiresAcceptedLaunch:true,
 acceptAreaAttack:(_b,_u,_p,ts)=>admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>release(ts,info)};}
export class MechanistAttackClock{
 constructor(b,u,{token=false,resources=null}={}){Object.assign(this,{b,u,token,resources,seq:null,stopped:false,phase:null,handles:[],facing:u.dir,accepting:false,visualSeq:0,flights:new Set(),flightHandles:[]});}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq&&(!this.resources||this.resources.valid());}
 model(){const face=this.facing==='UP'?'Back':'Front',id=this.token?TOKEN:ID;return{...e.models[id][face],...(this.token?clocks.tokens[TOKEN]:clocks).models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original ordinary attack clip');
  delete this.u.mem.regularModelFacing;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`mcnist-ordinary:${this.seq}:${++this.visualSeq}`}:{})};
  if(this.token)this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{die:'Die',clip:'Die',duration:1};
 }
 idle(){this.facing=this.u.dir;this.visual('Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 legal(t){return canTargetEnemy(this.u,t,{canHitFly:!this.token})&&(!t.s.flags.camou||!!t.blockedBy);}
 choices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,{...effectiveProfile(this.u),canHitFly:!this.token,maxTargets:1,allInRange:false,hitAllBlocked:false,
  canTarget:(_u,t)=>!t.s.flags.camou||!!t.blockedBy}).slice(0,1);}
 begin(t){this.face(t);const clip=this.token?'Attack':this.facing==='DOWN'?'Attack_Down':'Attack_A',m=this.model(),speed=Math.min(1,this.u.base.bat/this.u.s.interval);
  const delay=this.token ? 0.699999988079071 : m.eventPayloads[clip][0].time,period=Math.max(this.u.s.interval,delay/speed),slow=this.u.s.slowDownRate;
  this.phase={kind:'attack',target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,startedAt:this.b.time,lastAt:this.b.time,age:0,speed,releaseAge:delay,untilAge:period*speed,
   releaseAt:slow>0?this.b.time+delay/speed/slow:Infinity,until:slow>0?this.b.time+period/slow:Infinity,released:false,accepted:false};this.u.atkCd=period;this.visual(clip,speed*slow);
 }
 admit(ts){const p=this.phase;return this.accepting&&this.valid()&&this.u.canAct&&!this.u.hidden&&!this.u.s.flags.disarm
  &&p?.kind==='attack'&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&p.age+1e-7>=p.releaseAge
  &&ts.length===1&&ts[0]===p.target&&ts[0].deploySeq===p.life&&this.legal(ts[0]);}
 watchFlights(){if(this.flightHandles.length)return;this.flightHandles=[this.b.on('tick',()=>{for(const p of this.flights)if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p))this.flights.delete(p);if(!this.flights.size)this.unwatchFlights();}),
  this.b.on('battleEnd',()=>{this.b.projectiles.remove(p=>this.flights.has(p));this.flights.clear();this.unwatchFlights();})];}
 unwatchFlights(){for(const h of this.flightHandles)this.b.off(h);this.flightHandles=[];}
 release(ts,info){if(!this.admit(ts))return false;this.phase.accepted=true;const t=ts[0],u=this.u,b=this.b;
  if(this.token){b.dealDamage(u,t,{amount:u.s.atk*u.s.atkScaleMul,type:'phys',isAttack:true,isSkill:false,attackId:info.attackId,applyWay:'melee',tags:['mcgraf:ordinary']});return true;}
  const life=t.deploySeq,sourceLife=u.deploySeq,birthAtk=u.s.atk*u.s.atkScaleMul;
  const p=b.addProjectile({from:u,target:t,source:u,speed:20,maxAge:10,visual:'bolt',data:{arkpediaTrackedVisual:true,mcnistOwner:u.id},onHit:({target})=>{
   this.flights.delete(p);if(!this.flights.size)this.unwatchFlights();if(b.finished||!target||target.deploySeq!==life||!canTargetEnemy(u,target,{canHitFly:true}))return;
   const atk=present(u)&&u.deploySeq===sourceLife?u.s.atk*u.s.atkScaleMul:birthAtk;
   b.dealDamage(u,target,{amount:atk,type:'phys',isAttack:true,isSkill:false,attackId:info.attackId,applyWay:'ranged',tags:['mcnist:ordinary']});
  }});this.flights.add(p);this.watchFlights();return true;
 }
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(p?.kind==='born'){if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(!u.canAct||u.hidden||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
  if(p?.kind==='attack'){
   p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true)*p.speed;p.lastAt=b.time;u.mem.regularFormVisual.speed=p.speed*u.s.slowDownRate;
   if(!p.released&&p.age+1e-7>=p.releaseAge){p.released=true;if(p.target.deploySeq===p.life&&this.legal(p.target)){
    this.accepting=true;try{b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}}
   if(!this.valid()||this.phase!==p||p.age+1e-7<p.untilAge)return;this.phase=p=null;
  }
  if(u.atkCd>1e-9)return;const t=this.choices()[0];if(!t){this.idle();return;}this.begin(t);
 }
 profile(){return attackProfile(this.token,ts=>this.admit(ts),(ts,info)=>this.release(ts,info));}
 install(){if(this.stopped||this.handles.length)throw Error('Ordinary Mechanist/McGraf clock cannot be reinstalled');const b=this.b,u=this.u;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.facing=u.dir;const until=b.time+this.model().exactDurations.Start;this.phase={kind:'born',until};u.mem.regularBornUntil=until;this.visual('Start');},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(true),{owner:u})];
 }
 stop(end=false){if(end){this.b.projectiles.remove(p=>this.flights.has(p));this.flights.clear();this.unwatchFlights();}if(this.stopped)return;
  this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];this.resources?.stop();
  delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;
 }
}
export function prepareMechanistAttacks(b,u,{contract}={}){
 if(contract!==MCNIST_ATTACK_CONTRACT||u.mem.mcnistAttacks)throw Error('Explicit ordinary Mechanist attack contract required');verify();
 const resources=prepareMechanistBarriers(b,u,{contract:MCNIST_BARRIER_CONTRACT}),controller=new MechanistAttackClock(b,u,{resources});u.mem.mcnistAttacks=controller;
 const install=controller.install.bind(controller);controller.install=()=>{resources.install();install();};
 return{resources,record:resources.record,controller,kit:{talents:[],trait:controller.profile(),skill:{kind:'duration',trigger:{rule:'NEVER'},canActivate:()=>false}}};
}
export function mcgrafAttackKit(b,owner,barriers,{contract}={}){
 if(contract!==MCGRAF_ATTACK_CONTRACT||barriers!==owner.mem.mcnistBarriers||!barriers.valid()||selectedMcGrafBuild(barriers.record.build).ownerIndex===2)throw Error('Explicit selected ordinary McGraf attack contract required');verify(true);
 // _setupUnit asks for a kit before its token exists; callbacks capture the
 // clock installed on that exact newly created source-linked instance.
 let c;return{talents:[],skill:null,trait:attackProfile(true,ts=>c?.admit(ts)===true,(ts,info)=>c?.release(ts,info)===true),
  install:(_b,t)=>{if(t.def.charId!==TOKEN||t.ownerUnit!==owner||t.deploySeq!==0||t.mem.mcgrafAttacks)throw Error('Fresh original McGraf attack instance required');c=new MechanistAttackClock(b,t,{token:true});t.mem.mcgrafAttacks=c;c.install();}};
}
