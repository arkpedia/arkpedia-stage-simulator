// SPDX-License-Identifier: GPL-3.0-or-later
import {SKYBOX_ID as ID,selectedSkyboxInputs,skyboxNativeInputs,skyboxSourceComponent} from './arkpedia-skybox-source.js';
import {SkyboxOrdinaryAttacks,SKYBOX_ORDINARY_CONTRACT} from './arkpedia-skybox-ordinary.js';
import {SkyboxFirstModifierTalent,SKYBOX_TALENT_CONTRACT} from './arkpedia-skybox-talent.js';
import {SkyboxSkillFlight,SKYBOX_SKILL_FLIGHT_CONTRACT} from './arkpedia-skybox-skill-flight.js';
import {SkyboxSkillOneTransport,SKYBOX_S1_TRANSPORT_CONTRACT} from './arkpedia-skybox-s1-transport.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
export const SKYBOX_S1_CONTRACT=Object.freeze({
 scope:'Selected original Skybox automatic S1, source charge ranks, Begin/End clocks, landing/return, cached bomb, first-modifier talent and ordinary aerial attacks; no S2 or public admission.',
 mapping:'A ready time-SP account captures one legal ground/air input with own-block priority. Begin and End each use their original one-second fixed clocks, independent of ASPD and slowdown; End faces the retained current input or its captured position if that life is gone. Begin releases at0.5333333611488342 into the separate finite radius-two cached bomb. One charge stays committed once the valid input is captured; losing it before release uses the original input-position emission instead of refunding a born/point projectile. A search with no legal input preserves the charge. SP is held through both phases; positive ordinary cooldown is retained. Brief control/hiding before release invalidates that unborn output while the End/flight/account cleanup still completes. A born projectile survives account/end/source departure. Rank1-6 has one charge and rank7-10 two.',
 limitations:'Native selector aliases, cast/search/refund boundary, interrupt/End ordering, fixed sequence versus ordinary cooldown and source/recipient snapshots remain explicit local mappings. The original recoverSpIfTargetDead flag is retained; its compiled interaction with emitToInputPos is not recovered. The flight/transport/talent contracts retain their stated limits. S2, public build/runtime/browser approval, modules and native FX/audio/frame parity remain separate.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const due=(a,z)=>a>=z-1e-7;
export function verifySkyboxS1(n=skyboxNativeInputs(),read=skyboxSourceComponent){
 const s=n.s1,a=n.s1Attack,seq=read('skills','skchr_skybx_1','-4751883705071189594'),
  end=read('skills','skchr_skybx_1','2441541390163886502'),sel=read('skills','skchr_skybx_1','-3905108384030867034');
 if(s._allowSpRecoveryWhenAffecting!==0||s._canSilenced!==0||s._canUseInAbnormalState!==0||s._playSkillBeginAnim!==0
  ||s._earlySkillFinishAtAttackFinished!==0||s._recoverSpIfTargetDead!==1||s._cancelIfSearchTargetFailed!==1||s._stopAffectOnInterrupt!==0
  ||JSON.stringify(seq._abilities.map(p=>p.m_PathID))!==JSON.stringify(['-5325103701835529818','2441541390163886502'])
  ||seq._alwaysNext!==1||seq._timeMode!==1||seq._enableLoop!==0||seq._interruptIfTargetDead!==0
  ||a._animKey!=='Skill_1_Begin'||a._selectTargetSource!==2||a._timeMode!==1||a._maxAnimScale!==-1||a._affectedBySlowDown!==0
  ||end._animKey!=='Skill_1_End'||end._faceToTarget!==1||end._timeMode!==1||end._maxAnimScale!==-1||end._affectedBySlowDown!==0
  ||sel._targetSide!==2||sel._targetMotion!==3||sel._maxNum!==1||sel._postFilter!==4||sel._ignoreTargetFree!==0)
  throw Error('Changed original selected Skybox S1 sequence inputs');
}
export class SkyboxSkillOne extends SkyboxOrdinaryAttacks{
 constructor(b,u,talent,flight,{contract}={}){
  if(contract!==SKYBOX_S1_CONTRACT||selectedSkyboxInputs(u).index!==0)throw Error('Original selected Skybox S1 and exact contract required');
  super(b,u,{contract:SKYBOX_ORDINARY_CONTRACT,mayBegin:()=>true,takeoff:flight});verifySkyboxS1();
  this.talent=talent;this.flight=flight;this.payload=new SkyboxSkillOneTransport(b,u,{contract:SKYBOX_S1_TRANSPORT_CONTRACT});
  this.startingInput=null;this.finishing=false;this.accountHandles=[];
 }
 skillChoices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const eligible=t=>present(t)&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false}),
   ts=this.b.enemies.filter(t=>eligible(t)&&bodyInKeys(t,this.u.rangeKeySet));
  for(const t of this.b.blockedTargets(this.u,{canHitFly:true,canTarget:(_u,e)=>eligible(e)}))if(!ts.includes(t))ts.push(t);
  return sortEnemyTargets(this.b,this.u,ts,'normal').slice(0,1);
 }
 choices(){if(this.u.skill.ready&&!this.u.skill.active){const ts=this.skillChoices();if(ts.length)return ts;}return super.choices();}
 canStart(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active&&!this.phase
  &&due(this.b.time,this.bornUntil)&&this.u.atkCd<=1e-8&&this.skillChoices().length>0;}
 canCast(){return !!this.startingInput&&this.canStart();}
 begin(target){if(!this.u.skill.ready||!this.canStart()){super.begin(target);return;}
  const input=this.skillChoices()[0];this.startingInput={target:input,life:input.deploySeq,x:input.x,y:input.y};
  try{this.u.skill.activate('source-auto');}finally{this.startingInput=null;}
 }
 startSkill(){if(!this.valid()||!this.u.skill.active)return;const input=this.startingInput;if(!input)throw Error('Skybox S1 requires its captured input');
  this.face(input.target);const model=this.model(),p={...input,kind:'s1-begin',start:this.b.time,activation:this.u.skill.activations,
   epoch:this.u.attackControlEpoch,releaseAge:model.eventPayloads.Skill_1_Begin[0].time,
   duration:model.exactDurations.Skill_1_Begin,endDuration:model.exactDurations.Skill_1_End,released:false,accepted:false,interrupted:false};
  this.phase=p;this.u.atkCd=Math.max(this.u.atkCd,this.u.s.interval,p.duration+p.endDuration);
  this.flight.beginSkillOne();if(this.valid()&&this.phase===p)this.visual('Skill_1_Begin');
 }
 admit(ts){const p=this.phase;if(p?.kind!=='s1-begin')return super.admit(ts);
  return this.accepting&&this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!p.interrupted&&!p.accepted
   &&p.epoch===this.u.attackControlEpoch&&this.u.skill.active&&this.u.skill.pending&&p.activation===this.u.skill.activations
   &&due(this.b.time-p.start,p.releaseAge)&&ts.length===1&&ts[0]===p.target;
 }
 release(ts,info){const p=this.phase;if(p?.kind!=='s1-begin')return super.release(ts,info);if(!this.admit(ts))return false;
  p.accepted=true;return this.payload.launch({target:p.target,life:p.life,x:p.x,y:p.y,attackId:info.attackId});
 }
 trait(){return{...super.trait(),acceptAttackInput:t=>this.phase?.kind==='s1-begin'?t===this.phase.target:!!t.alive};}
 startEnd(p){if(!this.valid()||this.phase!==p||p.kind!=='s1-begin')return;
  p.kind='s1-end';p.endsAt=this.b.time+p.endDuration;
  this.face(p.target.deploySeq===p.life&&present(p.target)&&!p.target.hidden?p.target:{x:p.x,y:p.y});this.flight.endSkillOne();
  if(this.valid()&&this.phase===p)this.visual('Skill_1_End');
 }
 endAccount(reason){this.finishing=true;try{if(this.u.skill.active)this.u.skill.end(reason);}finally{this.finishing=false;}}
 skillEnded(){if(this.finishing)return;const p=this.phase;if(this.valid()&&p?.kind==='s1-begin')this.startEnd(p);}
 tick(){if(!this.valid())return;const p=this.phase;if(!p?.kind?.startsWith('s1-')){super.tick();return;}
  if(p.kind==='s1-begin'){
   if(this.u.hidden||!this.u.canAct||this.u.s.flags.disarm||p.epoch!==this.u.attackControlEpoch)p.interrupted=true;
   if(!p.released&&due(this.b.time-p.start,p.releaseAge)){p.released=true;
    if(!p.interrupted){this.accepting=true;try{this.b.forceAttack(this.u,[p.target]);}finally{this.accepting=false;}}
   }
   if(!this.valid()||this.phase!==p)return;if(due(this.b.time-p.start,p.duration))this.startEnd(p);return;
  }
  if(!due(this.b.time,p.endsAt))return;this.endAccount('source-sequence-finished');
  if(!this.valid()||this.phase!==p)return;this.flight.finishSkillOne();this.phase=null;this.idle();
 }
 spec(){return{kind:'instant',silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},holdSpWhileActive:true,
  attack:{isSkill:true},completeOnAttack:false,pendingText:'Skill active',canActivate:()=>this.canCast(),
  onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.talent.install();this.flight.install();this.accountHandles=[this.b.on('deploy',({unit,move})=>{
  if(unit===this.u&&!move)this.payload.bind();},{owner:this.u})];super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;
  try{if(this.u.deploySeq===this.seq&&this.u.skill.active&&this.phase?.activation===this.u.skill.activations)this.endAccount('controller-removed');
   super.stop();this.payload.retire();this.flight.stop();this.talent.stop();
   for(const h of this.accountHandles)this.b.off(h);this.accountHandles=[];
  }finally{this.stopping=false;}
 }
}
export function prepareSkyboxS1(b,u,{contract}={}){
 if(contract!==SKYBOX_S1_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.skybox)throw Error('Fresh selected Skybox S1 and exact controller contract required');
 const talent=new SkyboxFirstModifierTalent(b,u,{contract:SKYBOX_TALENT_CONTRACT}),flight=new SkyboxSkillFlight(b,u,{contract:SKYBOX_SKILL_FLIGHT_CONTRACT}),
  controller=new SkyboxSkillOne(b,u,talent,flight,{contract});u.mem.skybox=controller;
 return{record:controller.record,talent,flight,takeoff:flight,payload:controller.payload,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
