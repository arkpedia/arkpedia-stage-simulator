// SPDX-License-Identifier: GPL-3.0-or-later
// Held source ordinary attack clock; selected skill controllers compose separately.
import e from '../../../data/arkpedia-native-operators/char_4218_aigis.json' with {type:'json'};
import clocks from '../../../data/arkpedia-aegis-clocks.json' with {type:'json'};
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs} from './arkpedia-aegis-source.js';
import {AegisTakeoff} from './arkpedia-aegis-takeoff.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
export const AEGIS_ORDINARY_CONTRACT=Object.freeze({
 scope:'Selected original Aegis single aerial input and direct Physical ordinary attack, original marker/capped clock and independent deployment height; no skills/public admission.',
 mapping:'The original direct ability has no projectile key. One captured enemy life releases one ranged Physical packet and shared attack receipt at original Attack OnAttack0.6666666865348816. Source maxAnimScale1 caps the sampled BAT/interval playback; affectedBySlowDown1 separately applies its current live elapsed-clock channel. No shell/travel delay is borrowed from Skybox. Legal aerial selection uses ordinary priority and an own blocked input outside the range grid. Current ATK/attack scale are read at direct release, with shared typed outgoing/recipient damage rules. A lost or changed input before release is not replaced during that phase; interruption preserves positive cooldown. One-second original Start is the ordinary acquisition lock. Both facings use literal Attack; absent Back death is hidden. The caller explicitly gates native skill composition.',
 limitations:'Native numeric selector aliases, source1 capture/search, input-time interval versus live slow-down, born/ordinary FSM, attack receipt and damage callback order remain local mappings. Presentation uses the retained target quadrant; source forceFaceToDirection1 is retained but its compiled direction alias is unresolved. Skill-specific projectiles/modes/stun/kick, public delivery, native effects/audio/modules and original frame/pixel parity are not claimed.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const due=(a,z)=>a>=z-1e-7;
export function verifyAegisOrdinary(n=aegisNativeInputs()){
 const a=n.modes[0].attack,s=n.ordinarySelector;
 if(a._animKey!=='Attack'||a._endAnimKey!=='Idle'||a._downAnimKey!==''||a._timeMode!==0||a._maxAnimScale!==1||a._affectedBySlowDown!==1
  ||a._waitForAttackEvent!==1||a._preDelay!==0||a._selectTargetSource!==1||a._selectTargetTiming!==0||a._faceToTarget!==1||a._forceFaceToDirection!==1
  ||a._damageType!==1||a._elementDamageType!==0||a._epDamageRatio!==0||a._activeBuffs.length!==0||'_projectileKey'in a
  ||s._targetSide!==2||s._targetMotion!==2||s._maxNum!==1||s._limitTargetNum!==1||s._postFilter!==4
  ||s._ignoreTargetFree!==0||s._ignoreMotionMode!==0||s._forceIgnoreCamouflage!==0)throw Error('Changed original Aegis ordinary attack inputs');
 for(const [key,name]of[['Born','Start'],['Attack','Attack'],['Idle','Idle'],['Die','Die']])
  if(n.artController._animations.find(a=>a.animKey===key)?.animName!==name)throw Error('Changed original Aegis ordinary artwork aliases');
}
export class AegisOrdinaryAttacks{
 constructor(b,u,{contract,flight,mayBegin}={}){
  if(contract!==AEGIS_ORDINARY_CONTRACT||!(flight instanceof AegisTakeoff)||flight.stopped||flight.b!==b||flight.u!==u||typeof mayBegin!=='function'
   ||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Aegis, original flight, explicit composition predicate and exact ordinary contract required');
  verifyAegisOrdinary();this.record=selectedAegisInputs(u);Object.assign(this,{b,u,flight,mayBegin,seq:null,stopped:false,phase:null,accepting:false,handles:[],facing:u.dir,
   bornUntil:Infinity,visualSeq:0,visuals:new WeakSet()});
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return{...e.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(!this.valid())return null;if(this.model().exactDurations[clip]==null)throw Error('Missing original Aegis clip: '+clip);
  const v=this.flight.decorate({clip,speed,loop,...(loop?{replace:true}:{playId:`aegis:ordinary:${this.seq}:${++this.visualSeq}`})});
  this.visuals.add(v);this.u.mem.regularFormVisual=v;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Die',die:'Die',duration:1};return v;
 }
 idle(){this.facing=this.u.dir;this.visual('Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 legal(t){return present(t)&&t.isFlying&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&(!t.s.flags.camou||!!t.blockedBy);}
 choices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);const ts=this.b.enemies.filter(t=>this.legal(t)&&bodyInKeys(t,this.u.rangeKeySet));
  for(const t of this.b.blockedTargets(this.u,{canHitFly:true,canTarget:(_u,e)=>this.legal(e)}))if(!ts.includes(t))ts.push(t);
  return sortEnemyTargets(this.b,this.u,ts,'normal').slice(0,1);
 }
 begin(t){this.face(t);const m=this.model(),speed=Math.min(1,this.u.base.bat/this.u.s.interval),releaseAge=m.eventPayloads.Attack[0].time,
  period=Math.max(this.u.s.interval,releaseAge/speed);
  this.phase={target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,age:0,lastAt:this.b.time,speed,releaseAge,untilAge:period*speed,released:false,accepted:false};
  this.u.atkCd=period;this.phase.visual=this.visual('Attack',speed*this.u.s.slowDownRate);
 }
 admit(ts){const p=this.phase;return this.accepting&&this.valid()&&this.mayBegin()&&this.u.canAct&&!this.u.hidden&&!this.u.s.flags.disarm&&p&&!p.accepted
  &&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&ts.length===1&&ts[0]===p.target&&ts[0].deploySeq===p.life&&this.legal(ts[0]);}
 release(ts,info){if(!this.admit(ts))return false;const p=this.phase;p.accepted=true;const u=this.u;
  this.b.dealDamage(u,ts[0],{amount:u.s.atk*u.s.atkScaleMul,type:'phys',isAttack:true,isSkill:false,isProjectile:false,
   attackId:info.attackId,applyWay:'ranged',tags:['aegis:ordinary']});return true;
 }
 tick(){if(!this.valid())return;if(!this.mayBegin()){this.phase=null;return;}if(!due(this.b.time,this.bornUntil))return;
  const u=this.u,p=this.phase;
  if(u.hidden||!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
  if(p){p.age+=sourceAbilityDelta(u,Math.max(0,this.b.time-p.lastAt),true)*p.speed;p.lastAt=this.b.time;
   if(u.mem.regularFormVisual===p.visual)p.visual.speed=p.speed*u.s.slowDownRate;
   if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;try{this.b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;
  }
  if(u.atkCd>1e-8)return;const t=this.choices()[0];if(t)this.begin(t);else this.idle();
 }
 trait(){return{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',canHitFly:true,groundOnly:false,heal:null,projectile:'none',priority:'normal',
  maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,attackVisual:'none',
  requiresAcceptedLaunch:true,acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};}
 install(){if(this.stopped||this.handles.length)throw Error('Aegis ordinary attacks cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}
   this.seq=u.deploySeq;this.facing=u.dir;this.bornUntil=b.time+this.model().exactDurations.Start;u.mem.regularBornUntil=this.bornUntil;this.visual('Start');},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];
  if(this.seq===this.u.deploySeq&&this.visuals.has(this.u.mem.regularFormVisual)){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}}
}
