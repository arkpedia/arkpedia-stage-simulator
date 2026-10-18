// SPDX-License-Identifier: GPL-3.0-or-later
// Held selected source S2 account and three-subability sequence.
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs,aegisSourceComponent} from './arkpedia-aegis-source.js';
import {AegisOrdinaryAttacks,AEGIS_ORDINARY_CONTRACT} from './arkpedia-aegis-ordinary.js';
import {AegisPhysicalTalent,AEGIS_TALENT_CONTRACT} from './arkpedia-aegis-talent.js';
import {AegisSkillTwoFlight,AEGIS_S2_FLIGHT_CONTRACT} from './arkpedia-aegis-s2-flight.js';
import {AegisSkillTwoTransport,AEGIS_S2_TRANSPORT_CONTRACT} from './arkpedia-aegis-s2-transport.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';import {bodyInKeys} from '../body.js';
export const AEGIS_S2_CONTRACT=Object.freeze({
 scope:'Selected original manual S2 account, six marker-owned missiles, separate kick/invalidation wait, End return and ordinary aerial attacks; no public admission.',
 mapping:'One target-requiring manual time-SP charge can interrupt Born or an ordinary windup. Initial normal-priority ground/air selection captures one life and input point. No input at accepted start refunds the source charge; subsequent target loss retains its captured point, never a replacement life. Original Skill_2_Begin releases six distinct missiles at its six OnAttack markers and completes at2.4000000953674316 seconds, independent of ASPD and affected by live slowdown. One accepted missile ability owns all six releases and one shared attack receipt; kick owns a second receipt. Original zero-duration/no-marker Skill_2_Loop dispatches its separate kick once on entry, then waits for that projectile to become invalid before original one-second Skill_2_End. The ability-owned WALK parent stays alive through End-entry FLY/height return. The account holds SP until completion/interruption, resets ordinary cooldown on finish and preserves born payloads. Accepted action-stopping control, actual palsy-trigger bridge, hiding or external ability/parent removal interrupt unborn sequence output. Disarm alone stops ordinary attacks but does not stop this skill ability. Foreign states and original zero-duration invisible body track are preserved.',
 limitations:'Numeric selector/input aliases, one-receipt multi-event ownership, zero-marker kick entry dispatch, charge/refund and interruption order are explicit local mappings. The actual ally PALSYING generator is not recovered; granted/decaying stacks do not fabricate a palsy-trigger edge. Original invisible Loop is not replaced with Idle or invented owner translation. Transport angle/inertia/mount/collider and retired-attribute mappings remain separately documented. Native FX/audio/modules, original compiled/frame/pixel parity and public delivery remain separate.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing,due=(a,z)=>a>=z-1e-7;
export function verifyAegisS2(n=aegisNativeInputs(),read=aegisSourceComponent){
 const s=n.s2,a=n.s2Missiles,k=n.s2Kick,end=n.s2End,sequence=read('skills','skchr_aigis_2','-618453496724616670'),
  selector=read('skills','skchr_aigis_2','-7523144579431822814'),trigger=read('skills','skchr_aigis_2','-4917732959508002270');
 if(s._allowSpRecoveryWhenAffecting!==0||s._canSilenced!==0||s._canUseInAbnormalState!==0||s._allowNoTarget!==0||s._checkHasTargetBeforeDoCast!==1
  ||s._useTriggerInManualMode!==1||s._canCastDuringBorn!==1||s._canSwitchDuringBorn!==1||s._recoverSpIfNoTarget!==1||s._resetAbilityCooldownWhenCastEnd!==1||s._stopAffectOnInterrupt!==0
  ||sequence._abilities.map(p=>p.m_PathID).join()!=='3458929326777535010,-6574393273308116446,3101406417099328034'
  ||sequence._alwaysNext!==0||sequence._forceNextIfCastFail!==0||sequence._alsoInterruptCurrentSubAbility!==1||sequence._interruptableSubAbilityIndice.join()!=='0,1,2'
  ||sequence._alsoStopSubAbilityAffect!==0||sequence._alsoResetSubAbilityCooldown!==1||sequence._interruptIfTargetDead!==0||sequence._castToInputPosIfTargetInvalid!==1||sequence._enableLoop!==0||sequence._timeMode!==1
  ||selector._targetSide!==2||selector._targetMotion!==3||selector._postFilter!==4||selector._maxNum!==1||selector._ignoreTargetFree!==0||selector._forceIgnoreCamouflage!==0
  ||trigger._keepTarget!==0||trigger._minTargetNum!==1
  ||a._animKey!=='Skill_2_Begin'||a._endAnimKey!=='Skill_2_Loop'||a._selectTargetSource!==2||a._waitAttackEventForAllAttacks!==1||a._additionalTimes!==5||a._triggerDelta!==0
  ||k._animKey!=='Skill_2_Loop'||k._selectTargetSource!==3||k._waitForProjectileInvalid!==1||k._waitForAttackEvent!==1
  ||end._animKey!=='Skill_2_End'||end._endAnimKey!=='Idle'||end._waitForAttackEvent!==0
  ||[a,k,end].some(x=>x._timeMode!==1||x._maxAnimScale!==1||x._affectedBySlowDown!==1||x._interuptIfTargetDead!==0||x._allowNoTarget!==1||x._ignorePalsyInterrupt!==0))
  throw Error('Changed original Aegis S2 composition inputs');
}
export class AegisSkillTwo extends AegisOrdinaryAttacks{
 constructor(b,u,talent,flight,{contract}={}){
  if(contract!==AEGIS_S2_CONTRACT||selectedAegisInputs(u).index!==1)throw Error('Original selected Aegis S2 and exact controller contract required');
  super(b,u,{contract:AEGIS_ORDINARY_CONTRACT,flight,mayBegin:()=>!u.skill.active&&!flight.skillPhase});verifyAegisS2();
  Object.assign(this,{talent,payload:new AegisSkillTwoTransport(b,u,{contract:AEGIS_S2_TRANSPORT_CONTRACT}),accountHandles:[],finishing:false,stopping:false});
 }
 valid(){return super.valid()&&!this.flight.stopped;}
 skillLegal(t){return present(t)&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&(!t.s.flags.camou||!!t.blockedBy);}
 skillChoices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const ts=this.b.enemies.filter(t=>this.skillLegal(t)&&bodyInKeys(t,this.u.rangeKeySet));
  for(const t of this.b.blockedTargets(this.u,{canHitFly:true,canTarget:(_u,t)=>this.skillLegal(t)}))if(!ts.includes(t))ts.push(t);
  return sortEnemyTargets(this.b,this.u,ts,'normal').slice(0,1);
 }
 canCast(){return this.valid()&&!this.finishing&&!this.stopping&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active&&!this.flight.skillPhase&&this.skillChoices().length===1;}
 sequenceOwned(p){return this.valid()&&this.phase===p&&this.u.skill.active&&p.activation===this.u.skill.activations&&this.u.canAct&&!this.u.hidden&&p.epoch===this.u.actionControlEpoch;}
 sequenceLive(p){return this.sequenceOwned(p)&&this.flight.grantLive(this.flight.walkParent);}
 startSkill(){if(!this.valid()||!this.u.skill.active)return;const t=this.skillChoices()[0],activation=this.u.skill.activations;
  this.phase=null;this.bornUntil=this.b.time;this.u.mem.regularBornUntil=this.b.time;
  if(!t){this.finishAccount('TARGET_LOST');if(this.valid()&&!this.u.skill.active&&this.u.skill.activations===activation)this.u.skill.setSpTotal(this.u.skill.spCost);return;}
  this.face(t);const p={kind:'s2-missiles',target:t,life:t.deploySeq,x:t.x,y:t.y,activation,epoch:this.u.actionControlEpoch,age:0,lastAt:this.b.time,next:0,accepted:false};this.phase=p;
  if(!this.flight.beginSkillTwo({permit:()=>this.sequenceOwned(p)})||!this.sequenceLive(p)){this.finishAccount('INTERRUPTED');return;}
  p.visual=this.visual('Skill_2_Begin',this.u.s.slowDownRate);
 }
 finishAccount(reason='INTERRUPTED'){if(this.finishing)return;this.finishing=true;try{
  this.phase=null;if(this.flight.skillPhase)this.flight.finishSkillTwo(reason);
  if(this.u.skill.active)this.u.skill.end(reason);
  if(this.seq===this.u.deploySeq){this.u.atkCd=0;if(this.valid()&&!this.stopping)this.idle();}
 }finally{this.finishing=false;}}
 flightFinished(){if(!this.finishing&&!this.stopping)this.finishAccount('INTERRUPTED');}
 skillEnded(){if(!this.finishing&&!this.stopping)this.finishAccount('INTERRUPTED');}
 admit(ts){const p=this.phase;if(!p?.kind?.startsWith('s2-'))return super.admit(ts);
  return this.accepting&&this.sequenceLive(p)&&!p.accepted&&['s2-missiles','s2-kick'].includes(p.kind)&&ts.length===1&&ts[0]===p.target;
 }
 launch(p,kind,index,attackId){return this.payload.launch({kind,index,target:p.target,life:p.life,x:p.x,y:p.y,attackId,facing:this.facing,track:p.target.deploySeq===p.life&&this.skillLegal(p.target)});}
 release(ts,info){const p=this.phase;if(!p?.kind?.startsWith('s2-'))return super.release(ts,info);if(!this.admit(ts))return false;
  p.accepted=true;p.attackId=info.attackId;const ticket=this.launch(p,p.kind==='s2-kick'?'kick':'missile',1,info.attackId);if(p.kind==='s2-kick')p.ticket=ticket;
  if(!ticket)p.accepted=false;return !!ticket;
 }
 acceptReceipt(p){this.accepting=true;try{this.b.forceAttack(this.u,[p.target]);}finally{this.accepting=false;}
  if(this.sequenceLive(p)&&!p.accepted)this.finishAccount('INTERRUPTED');
 }
 beginKick(p){if(!this.sequenceLive(p))return;const q={...p,kind:'s2-kick',accepted:false,age:0,lastAt:this.b.time,ticket:null};this.phase=q;
  q.visual=this.visual('Skill_2_Loop',this.u.s.slowDownRate);this.acceptReceipt(q);
 }
 beginEnd(p){if(!this.sequenceLive(p))return;const q={...p,kind:'s2-end',age:0,lastAt:this.b.time};this.phase=q;
  if(!this.flight.beginEnd()||!this.sequenceLive(q)){this.finishAccount('INTERRUPTED');return;}q.visual=this.visual('Skill_2_End',this.u.s.slowDownRate);
 }
 tick(){if(!this.valid())return;const p=this.phase;if(!p?.kind?.startsWith('s2-')){super.tick();return;}
  if(!this.sequenceLive(p)){this.finishAccount('INTERRUPTED');return;}
  p.age+=sourceAbilityDelta(this.u,Math.max(0,this.b.time-p.lastAt),true);p.lastAt=this.b.time;
  if(this.u.mem.regularFormVisual===p.visual)p.visual.speed=this.u.s.slowDownRate;
  if(p.kind==='s2-missiles'){
   const m=this.model(),markers=m.eventPayloads.Skill_2_Begin.filter(e=>e.name==='OnAttack');while(p.next<markers.length&&due(p.age,markers[p.next].time)){
    const index=++p.next;if(index===1)this.acceptReceipt(p);else if(this.sequenceLive(p)&&!this.launch(p,'missile',index,p.attackId))this.finishAccount('INTERRUPTED');
    if(!this.sequenceLive(p))return;
   }
   if(due(p.age,m.exactDurations.Skill_2_Begin))this.beginKick(p);
  }else if(p.kind==='s2-kick'){if(!this.payload.active(p.ticket))this.beginEnd(p);}
  else if(due(p.age,this.model().exactDurations.Skill_2_End))this.finishAccount('NORMAL_EXIT');
 }
 trait(){return{...super.trait(),acceptAttackInput:t=>this.phase?.kind?.startsWith('s2-')?t===this.phase.target:!!t.alive};}
 spec(){return{kind:'instant',silenceable:false,completeOnAttack:false,trigger:{rule:'NEVER'},flags:{noSp:true},holdSpWhileActive:true,attack:{isSkill:true},
  canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.talent.install();this.flight.install();this.accountHandles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move&&this.payload.seq===null)this.payload.bind();},{owner:this.u}),
  this.b.on('palsyTriggered',({unit})=>{if(unit===this.u&&this.phase?.kind?.startsWith('s2-'))this.finishAccount('INTERRUPTED');},{owner:this.u})];super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;try{
  if(this.seq===this.u.deploySeq)this.finishAccount('INTERRUPTED');super.stop();this.payload.retire();this.flight.stop();this.talent.stop();
  for(const h of this.accountHandles)this.b.off(h);this.accountHandles=[];
 }finally{this.stopping=false;}}
}
export function prepareAegisS2(b,u,{contract}={}){
 if(contract!==AEGIS_S2_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.aegis)throw Error('Fresh selected Aegis S2 and exact controller contract required');
 const talent=new AegisPhysicalTalent(b,u,{contract:AEGIS_TALENT_CONTRACT});let controller;
 const flight=new AegisSkillTwoFlight(b,u,{contract:AEGIS_S2_FLIGHT_CONTRACT,onFinish:()=>controller?.flightFinished()});
 controller=new AegisSkillTwo(b,u,talent,flight,{contract});u.mem.aegis=controller;
 return{record:controller.record,talent,flight,takeoff:flight,payload:controller.payload,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
