// SPDX-License-Identifier: GPL-3.0-or-later
// Held ordinary bow controller only. Both skill accounts compose separately.
import evidence from '../../../data/arkpedia-native-operators/char_4219_yukari.json' with {type:'json'};
import clocks from '../../../data/arkpedia-yukari-clocks.json' with {type:'json'};
import {YUKARI_ID as ID,selectedYukariInputs,yukariNativeInputs,yukariSourceComponent} from './arkpedia-yukari-source.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const YUKARI_ORDINARY_CONTRACT=Object.freeze({
 scope:'Selected original Yukari single-input Physical bow attack, original Begin/Loop/End families and independent arrow transport only; no source skill controller or public admission.',
 mapping:'Native source2/normal-priority/max-one selection retains one ground-or-air enemy life. A fresh chain adds the original Begin mix before the Loop OnAttack0.03333333507180214 marker; continuing chains omit Begin, and an exhausted chain plays its original End before Idle. Front downward attacks use the separate Down family; Back has no Down/death track. One-second Start locks acquisition. Source maxAnimScale1 samples min(1,BAT/interval); affectedBySlowDown1 applies the live elapsed clock once, including Begin/End. Cooldown lasts at least the phase release. One accepted shared attack receipt creates one finite ten-second speed20 homing arrow. A present matching source supplies live ATK and typed attributes at impact; retirement/replacement uses an explicit launch-attribute view with the old ledger/team. An accepted input leaving range or gaining target-free flags is retained; a dead/hidden/replaced input is never redirected. Born transport survives source exit and claims impact before callbacks.',
 limitations:'Native selector aliases, input/reacquisition, chain/mix/cooldown ordering, direction dispatch, source-invalid attribute lookup and launch snapshot fallback remain explicit local mappings, not compiled/native-frame parity. Original mix tracks are retained without certifying native blend pixels. No borrowed Arts splash, on-arrow healing, skill substitution, module, original public art approval, native particles/audio or pixel parity.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const retained=t=>present(t)&&!t.hidden&&t.side==='enemy';
const due=(a,z)=>a>=z-1e-7;
const mixRows=[['Idle','Attack_Loop','Attack_Begin'],['Idle','Attack_Down_Loop','Attack_Down_Begin'],['Attack_Loop','Idle','Attack_End'],['Attack_Down_Loop','Idle','Attack_Down_End'],['Born','Attack_Loop','Attack_Begin'],['Born','Attack_Down_Loop','Attack_Down_Begin']];
export function verifyYukariOrdinary(n=yukariNativeInputs(),read=yukariSourceComponent){
 const a=n.ordinary,s=n.ordinarySelector,parts=n.projectiles.projectile_chr_yukari.flatMap(r=>r.components.map(c=>c.data)),p=parts.find(d=>d._lifeTime!=null),m=parts.find(d=>d._speed!=null),
  mode=read('characters',ID,'-743992934372203767'),trigger=read('characters',ID,'9047055651020743433');
 if(n.root._modes.map(p=>p.m_PathID).join()!=='-743992934372203767'||n.root._clearProjectileWhenDead!==0||mode._attack.m_PathID!=='2501127350376276745'||mode._attackTrigger.m_PathID!=='9047055651020743433'
  ||trigger._keepTarget!==0||trigger._minTargetNum!==1||trigger._overrideSearchTargetTick!==-1
  ||a._animKey!=='Attack_Loop'||a._endAnimKey!=='Idle'||a._downAnimKey!=='Attack_Down_Loop'||a._downEndAnimKey!=='Idle'||a._maxAnimScale!==1||a._timeMode!==0||a._affectedBySlowDown!==1
  ||a._waitForAttackEvent!==1||a._preDelay!==0||a._selectTargetSource!==2||a._selectTargetTiming!==0||a._interuptIfTargetDead!==0||a._faceToTarget!==1||a._forceFaceToDirection!==0
  ||a._projectileKey!=='projectile_chr_yukari'||a._useCachedAtkOnly!==0||a._damageType!==1||a._elementDamageType!==0||a._epDamageRatio!==0||a._transferSource!==0||a._activeBuffs.length!==0
  ||s._targetSide!==2||s._targetMotion!==3||s._limitTargetNum!==1||s._maxNum!==1||s._postFilter!==4||s._ignoreTargetFree!==0||s._ignoreMotionMode!==0||s._ignoreHitRange!==0||s._forceIgnoreCamouflage!==0
  ||p._managedBySource!==0||p._stopWhenSourceInvalid!==0||p._lifeTime!==10||p._maxHitNum!==1||p._canHitSameTargetMultipleTimes!==0||p._stopAfterMaxHit!==1||p._fixDealHitTargetLeft!==1||p._alwaysHitTraceTargetInTheEnd!==1
  ||m._speed!==20||m._moveType!==1||m._addInertia!==0||m._delayToStart!==0||m._forceReachedWhenTimeup!==1
  ||JSON.stringify(n.artController._mixSettings.map(m=>[m.sourceAnimName,m.targetAnimName,m.mixAnimName]))!==JSON.stringify(mixRows))throw Error('Changed original Yukari ordinary inputs');
 for(const[key,name]of[['Born','Start'],['Idle','Idle'],['Die','Die'],...['Attack_Begin','Attack_Loop','Attack_End','Attack_Down_Begin','Attack_Down_Loop','Attack_Down_End'].map(n=>[n,n])])
  if(n.artController._animations.find(a=>a.animKey===key)?.animName!==name)throw Error('Changed original Yukari ordinary artwork aliases');
}
function captureSource(u){
 const v=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
 Object.defineProperty(v,'s',{value:structuredClone(u.s),enumerable:true});return v;
}
export class YukariOrdinaryAttacks{
 constructor(b,u,{contract,mayBegin}={}){
  if(contract!==YUKARI_ORDINARY_CONTRACT||typeof mayBegin!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Yukari, exact ordinary contract and explicit skill composition predicate required');
  verifyYukariOrdinary();this.record=selectedYukariInputs(u);Object.assign(this,{b,u,mayBegin,seq:null,stopped:false,ended:false,phase:null,ending:null,chain:false,accepting:false,facing:u.dir,
   bornUntil:Infinity,visualSeq:0,visuals:new WeakSet(),handles:[],watchers:[],flights:new Map()});
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return{...evidence.models[ID][face],...clocks.models[face]};}
 family(){return this.facing==='DOWN'?'Attack_Down':'Attack';}
 visual(clip,speed=1,loop=false){if(!this.valid())return null;if(this.model().exactDurations[clip]==null)throw Error('Missing original Yukari clip: '+clip);
  const v={clip,speed,loop,...(loop?{replace:true}:{playId:`yukari:ordinary:${this.seq}:${++this.visualSeq}`})};this.visuals.add(v);this.u.mem.regularFormVisual=v;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Die',die:'Die',duration:1};return v;
 }
 idle(){this.chain=false;this.facing=this.u.dir;this.visual('Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 choices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);const legal=t=>present(t)&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&(!t.s.flags.camou||!!t.blockedBy),
  ts=this.b.enemies.filter(t=>legal(t)&&bodyInKeys(t,this.u.rangeKeySet));
  for(const t of this.b.blockedTargets(this.u,{canHitFly:true,canTarget:(_u,e)=>legal(e)}))if(!ts.includes(t))ts.push(t);return sortEnemyTargets(this.b,this.u,ts,'normal').slice(0,1);
 }
 begin(t){this.face(t);const family=this.family(),model=this.model(),speed=Math.min(1,this.u.base.bat/this.u.s.interval),beginAge=this.chain?0:model.exactDurations[family+'_Begin'],
  loop=family+'_Loop',releaseAge=beginAge+model.eventPayloads[loop][0].time,period=Math.max(this.u.s.interval,releaseAge/speed);
  this.phase={target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,speed,age:0,lastAt:this.b.time,beginAge,releaseAge,untilAge:period*speed,loop,stage:beginAge?'begin':'loop',released:false,accepted:false};
  this.chain=true;this.u.atkCd=period;this.phase.visual=this.visual(beginAge?family+'_Begin':loop,speed*this.u.s.slowDownRate);
 }
 endChain(){if(!this.chain){this.idle();return;}this.chain=false;const clip=this.family()+'_End',speed=Math.min(1,this.u.base.bat/this.u.s.interval);
  this.ending={age:0,lastAt:this.b.time,duration:this.model().exactDurations[clip],speed,epoch:this.u.attackControlEpoch,visual:this.visual(clip,speed*this.u.s.slowDownRate)};
 }
 admit(ts){const p=this.phase;return this.accepting&&this.valid()&&this.mayBegin()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&p&&!p.accepted&&p.epoch===this.u.attackControlEpoch
  &&due(p.age,p.releaseAge)&&ts.length===1&&ts[0]===p.target&&ts[0].deploySeq===p.life&&retained(ts[0]);}
 release(ts,info){if(!this.admit(ts))return false;const p=this.phase;p.accepted=true;this.emit(p.target,p.life,info);return true;}
 emit(target,life,info){const{b,u}=this,sourceLife=this.seq,snapshot=captureSource(u),flight={target,life,retired:false};let projectile,claimed=false;
  projectile=b.addProjectile({from:u,target,source:u,speed:20,maxAge:10,visual:'arrow',data:{arkpediaTrackedVisual:true,projectileKey:'projectile_chr_yukari',yukariOrdinary:true},onHit:()=>{
   if(claimed||projectile.removed||!this.flights.has(projectile))return;claimed=true;this.flights.delete(projectile);
   if(!this.ended&&!b.finished&&target.deploySeq===life&&retained(target)){const src=!flight.retired&&present(u)&&u.deploySeq===sourceLife?u:snapshot;
    b.dealDamage(src,target,{amount:src.s.atk*src.s.atkScaleMul,type:'phys',isAttack:true,isSkill:false,isProjectile:true,attackId:info.attackId,applyWay:'ranged',tags:['yukari:ordinary']});}
   this.unwatch();}});this.flights.set(projectile,flight);if(b.finished)this.drain();else this.watch();
 }
 clock(p){p.age+=sourceAbilityDelta(this.u,Math.max(0,this.b.time-p.lastAt),true)*p.speed;p.lastAt=this.b.time;if(this.u.mem.regularFormVisual===p.visual)p.visual.speed=p.speed*this.u.s.slowDownRate;}
 tick(){if(!this.valid())return;const{u}=this;if(!this.mayBegin()){this.phase=null;this.ending=null;this.chain=false;return;}if(!due(this.b.time,this.bornUntil))return;
  const p=this.phase,e=this.ending;if(u.hidden||!u.canAct||u.s.flags.disarm||(p??e)&&u.attackControlEpoch!==(p??e).epoch){this.phase=null;this.ending=null;this.idle();return;}
  if(e){this.clock(e);if(!due(e.age,e.duration))return;this.ending=null;this.idle();}
  if(p){this.clock(p);if(p.stage==='begin'&&due(p.age,p.beginAge)){p.stage='loop';p.visual=this.visual(p.loop,p.speed*u.s.slowDownRate);}
   if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;try{this.b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;
  }
  if(u.atkCd>1e-8)return;const t=this.choices()[0];if(t)this.begin(t);else if(!this.ending)this.endChain();
 }
 trait(){return{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',canHitFly:true,groundOnly:false,heal:null,projectile:'none',priority:'normal',maxTargets:1,maxTargetsByBlock:false,
  hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,attackVisual:'none',requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};}
 watch(){if(this.watchers.length||!this.flights.size)return;this.watchers=[this.b.on('tick',()=>{for(const p of this.flights.keys())if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p))this.flights.delete(p);this.unwatch();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 drain(){this.ended=true;this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.unwatch();}
 install(){if(this.stopped||this.handles.length)throw Error('Yukari ordinary attacks cannot be reinstalled');const{b,u}=this;this.handles=[
  b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;this.facing=u.dir;
   this.bornUntil=b.time+this.model().exactDurations.Start;u.mem.regularBornUntil=this.bornUntil;this.visual('Start');},{owner:u}),
  b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
  b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>{this.stop();this.drain();},{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.ending=null;this.chain=false;this.accepting=false;for(const f of this.flights.values())f.retired=true;
  for(const h of this.handles)this.b.off(h);this.handles=[];if(this.seq===this.u.deploySeq&&this.visuals.has(this.u.mem.regularFormVisual)){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
  if(this.b.finished)this.drain();}
}
