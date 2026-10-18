// SPDX-License-Identifier: GPL-3.0-or-later
// Selected companion ordinary attacks only. Initial birth combat is separate.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {PALAMUTE_ID as TOKEN,reconNativeInputs,reconSourceComponent} from './arkpedia-recon-source.js';
import {prepareReconLifecycle,PALAMUTE_LIFECYCLE_CONTRACT} from './arkpedia-palamute-lifecycle.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const PALAMUTE_ATTACK_CONTRACT=Object.freeze({
 scope:'Selected Palamute ordinary sequential Attack_A/Attack_B, composed with the selected tactical-point lifecycle; no owner/birth/bomb attacks or public admission',
 mapping:'The native active combat sequence alternates its two one-target Physical abilities. Each captures one eligible enemy life and releases once at the original Single-facing OnAttack marker. Normal priority includes blocked targets. Playback samples nominal BAT/current interval without a cap; live slow_down scales only the opted-in ability clock. Controls invalidate an unfired phase without erasing positive cooldown. A rejected receipt consumes its release opportunity. Rest, withdrawal, source departure and recipient life replacement cannot redirect a stale strike. Recovery starts a new sequence after the authored Stun_End mix.',
 limits:'Native multi-ability category/order, cooldown combination, block priority, target retention, motion-mask and face-to-target aliases, sampled ASPD and interrupted/rejected sequence advancement are explicit local mappings. Initial Born projectile/pull, Recon attacks, bombs and trait resources remain held. Original Single-art delivery, native hit effects/audio, modules, devices and game-frame/pixel parity are unverified.',
 frameParity:false,
});
const air={canHitFly:true},due=(a,z)=>a+1e-7>=z,present=u=>u?.alive&&u.deployed&&!u._removing;
function verify(){const n=reconNativeInputs(),combat=reconSourceComponent('tokens',TOKEN,'2352382312724066812'),selector=reconSourceComponent('tokens',TOKEN,'-7943715338337160708');
 if(combat._selectAbilitySequentially!==1||combat._timeMode!==0||combat._coolDownAbilityIndex!==0||combat._clearInternalCooldownWhenFinish!==1
  ||combat._selector.m_PathID!=='-7943715338337160708'||combat._abilityConfigs.map(c=>c._ability.m_PathID).join()!=='5452024281888551420,-1857973228909202948'
  ||combat._abilityConfigs.some(c=>c._useInputTarget!==1)||selector._targetMotion!==3||selector._targetSide!==2||selector._targetCategory!==1||selector._postFilter!==4||selector._maxNum!==1||selector._limitTargetNum!==1)throw Error('Changed original Palamute combat sequence');
 for(const[a,clip]of n.tokenAttacks.map((a,i)=>[a,['Attack_A','Attack_B'][i]]))if(a._animKey!==clip||a._timeMode!==0||a._damageType!==1||a._attackType!==1||a._atkScale!==1||a._affectedBySlowDown!==1||a._waitForAttackEvent!==1||a._maxAnimScale!==-1||a._faceToTarget!==1
  ||e.models[TOKEN].Single.eventPayloads[clip].length!==1||e.models[TOKEN].Single.eventPayloads[clip][0].name!=='OnAttack')throw Error('Changed original Palamute ordinary strike');
}
export function preparePalamuteAttacks(b,u,{contract}={}){
 if(contract!==PALAMUTE_ATTACK_CONTRACT)throw Error('Exact selected Palamute attack contract required');verify();
 const prepared=prepareReconLifecycle(b,u,{contract:PALAMUTE_LIFECYCLE_CONTRACT}),attacks=new PalamuteAttacks(prepared.controller);prepared.controller.combat=attacks;return{...prepared,attacks};
}
export class PalamuteAttacks{
 constructor(point){Object.assign(this,{point,b:point.b,phase:null,next:0,sequenceLife:null,accepting:false,stopped:false,handles:[]});
  this.trait={noAttack:true,attackDrivenSkill:true,attack:'melee',projectile:'none',dmgType:'phys',canHitFly:true,maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,onHit:null,onEachHit:null,windup:0,install:null,dmgMul:null,requiresAcceptedLaunch:true,
   acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};
 }
 active(p){return !this.stopped&&this.point.current(p)&&p.mode==='active'&&!p.visualPending&&due(this.b.time,p.attackReadyAt??0)&&!p.unit.hidden&&p.unit.canAct&&!p.unit.s.flags.disarm;}
 legal(u,t){return present(t)&&t.kind==='enemy'&&canTargetEnemy(u,t,air)&&(!t.s.flags.camou||!!t.blockedBy);}
 choices(p){const u=p.unit;if(this.b.rangeChanged(u))this.b._refreshRange(u);const out=this.b.enemiesInKeys(u.rangeKeys,u,air).filter(t=>this.legal(u,t));
  for(const t of this.b.blockedTargets(u,air))if(this.legal(u,t)&&!out.includes(t))out.push(t);sortEnemyTargets(this.b,u,out);return out;
 }
 idle(p){if(this.point.current(p)&&p.mode==='active'&&!p.visualPending)this.point.visual(p,'Idle',true);}
 begin(p,target){const u=p.unit,clip=['Attack_A','Attack_B'][this.next],speed=u.base.bat/u.s.interval,marker=e.models[TOKEN].Single.eventPayloads[clip][0].time,period=Math.max(u.s.interval,marker/speed);
  this.next=(this.next+1)%2;this.phase={point:p,seq:p.seq,target,life:target.deploySeq,epoch:u.attackControlEpoch,clip,speed,age:0,lastAt:this.b.time,releaseAge:marker,untilAge:period*speed,released:false,accepted:false};
  const x=target.x-u.x;if(Math.abs(x)>1e-8)u.mem.regularVisualDirection=x<0?'LEFT':'RIGHT';
  u.atkCd=period;this.point.visual(p,clip);u.mem.regularFormVisual.speed=speed*u.s.slowDownRate;
 }
 admit(ts){const q=this.phase,p=q?.point;return this.accepting&&q&&!q.accepted&&this.active(p)&&p.seq===q.seq&&p.unit.attackControlEpoch===q.epoch&&due(q.age,q.releaseAge)&&ts.length===1&&ts[0]===q.target&&ts[0].deploySeq===q.life&&this.legal(p.unit,ts[0]);}
 release(ts,info){if(!this.admit(ts))return false;const q=this.phase,u=q.point.unit;q.accepted=true;
  this.b.dealDamage(u,ts[0],{amount:u.s.atk*u.s.atkScaleMul,type:'phys',isAttack:true,isSkill:false,attackId:info.attackId,applyWay:'melee',tags:['palamute:ordinary',`palamute:${q.clip}`]});return true;
 }
 clear(p){if(this.phase?.point===p)this.phase=null;if(this.sequenceLife===p?.seq)this.sequenceLife=null;}
 tick(){const p=this.point.point;if(!p||!this.point.current(p)){this.phase=null;this.sequenceLife=null;return;}
  if(this.sequenceLife!==p.seq){this.phase=null;this.next=0;this.sequenceLife=p.seq;}
  let q=this.phase;
  if(!this.active(p)||q&&q.epoch!==p.unit.attackControlEpoch){this.phase=null;this.idle(p);return;}
  if(q){q.age+=sourceAbilityDelta(p.unit,Math.max(0,this.b.time-q.lastAt),true)*q.speed;q.lastAt=this.b.time;p.unit.mem.regularFormVisual.speed=q.speed*p.unit.s.slowDownRate;
   if(!q.released&&due(q.age,q.releaseAge)){q.released=true;this.accepting=true;try{this.b.forceAttack(p.unit,[q.target]);}finally{this.accepting=false;}}
   if(!this.point.current(p)||this.phase!==q||!due(q.age,q.untilAge))return;this.phase=null;this.idle(p);
  }
  if(p.unit.atkCd>1e-9)return;const t=this.choices(p)[0];if(t)this.begin(p,t);else this.idle(p);
 }
 install(){if(this.handles.length||this.stopped)throw Error('Palamute attacks cannot be reinstalled');this.handles=[this.b.on('tick',()=>this.tick(),{owner:this.point.u})];}
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.sequenceLife=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];}
}
