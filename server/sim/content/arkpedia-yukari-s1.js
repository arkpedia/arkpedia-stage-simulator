// SPDX-License-Identifier: GPL-3.0-or-later
// Held selected S1 account, source markers, payloads, finish healing and bow.
import {YUKARI_ID as ID,selectedYukariInputs,yukariNativeInputs,yukariSourceComponent} from './arkpedia-yukari-source.js';
import {YukariOrdinaryAttacks,YUKARI_ORDINARY_CONTRACT} from './arkpedia-yukari-ordinary.js';
import {YukariFinishHealing,YUKARI_TALENT_CONTRACT} from './arkpedia-yukari-talent.js';
import {YukariSkillOneTransport,YUKARI_S1_TRANSPORT_CONTRACT} from './arkpedia-yukari-s1-transport.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const YUKARI_S1_CONTRACT=Object.freeze({
 scope:'Selected original manual/time-SP S1, original four marker sequence, separately owned arrow/final payloads, finish-healing talent and ordinary bow only; no S2 or public admission.',
 mapping:'The native manual trigger requires one current normal-priority ground/air input. One charge can interrupt Born or an ordinary phase; the instant account holds SP through the full original Skill_1 clock, independent of ASPD and affected once by current slowdown. Each of its four original markers selects the current normal-priority input; no legal replacement retains the last captured input life/point. The first accepted marker owns one shared attack receipt for the multi-event ability, and all later markers reuse its attack ID without spending another charge or inventing another receipt. Three direct Arts arrows and a separate final radius/levitation arrow retain their transport contracts. The account finishes at the original clip end rather than at first/last arrow impact. Positive ordinary cooldown is preserved, Born is not restarted, and ordinary attacks reopen with their original Begin. Same-account finish invokes the selected source talent once, including an interrupted living source; actual withdrawal/death excludes new healing. Action-control epochs, actual palsy-trigger bridge, hiding and external account end cancel unborn markers; ordinary-only disarm does not interrupt S1. Already born payloads and nonderived statuses remain independent.',
 limitations:'Native source1/selectTiming2 marker reselection, trigger/input/FSM and one-receipt multi-event mapping, missing-target spend, facing at cast start, controller finish and callback ordering remain explicit local contracts. An accepted start losing its input before onStart spends the charge without refund because recoverSpIfNoTarget0. No inferred ally palsy generator, native audio/persona/trails/particles, original public artwork approval, modules or compiled/frame/pixel parity.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
// Float32 source markers can lie just above their original integer frame.
// Avoid adding a whole simulator tick for sub-microsecond representation error.
const due=(a,z)=>a>=z-1e-6;
export function verifyYukariS1(n=yukariNativeInputs(),read=yukariSourceComponent){
 const s=n.s1,a=n.s1Attack,selector=read('skills','skchr_yukari_1','6907655210490132085'),trigger=read('skills','skchr_yukari_1','7682281569967928949');
 if(s._allowSpRecoveryWhenAffecting!==0||s._canSilenced!==0||s._canUseInAbnormalState!==0||s._allowNoTarget!==0||s._checkHasTargetBeforeDoCast!==0||s._useTriggerInManualMode!==1
  ||s._canSwitchDuringBorn!==1||s._canCastDuringBorn!==1||s._recoverSpIfNoTarget!==0||s._resetAbilityCooldownWhenCastEnd!==0||s._earlySkillFinishAtAttackFinished!==0||s._stopAffectOnInterrupt!==0
  ||s._trigger.m_PathID!=='7682281569967928949'||trigger._keepTarget!==0||trigger._minTargetNum!==1||trigger._overrideSearchTargetTick!==-1
  ||a._animKey!=='Skill_1'||a._endAnimKey!=='Idle'||a._timeMode!==1||a._maxAnimScale!==1||a._affectedBySlowDown!==1||a._waitForAttackEvent!==1||a._ignorePalsyInterrupt!==0
  ||a._selectTargetSource!==1||a._selectTargetTiming!==2||a._interuptIfTargetDead!==0||a._allowNoTarget!==1||a._additionalTimes!==3||a._triggerDelta!==0||a._waitAttackEventForAllAttacks!==1
  ||a._limitToOneTargetAfterFirstRound!==0||a._castToFirstRoundTargetLocationsAtProjectileBirth!==0||a._splitDamage!==0||a._faceToTarget!==1||a._preDelay!==0
  ||selector._targetSide!==2||selector._targetMotion!==3||selector._postFilter!==4||selector._maxNum!==1||selector._limitTargetNum!==1||selector._ignoreTargetFree!==0||selector._forceIgnoreCamouflage!==0||selector._ignoreHitRange!==0)
  throw Error('Changed original Yukari S1 composition inputs');
}
export class YukariSkillOne extends YukariOrdinaryAttacks{
 constructor(b,u,talent,{contract}={}){
  if(contract!==YUKARI_S1_CONTRACT||selectedYukariInputs(u).index!==0)throw Error('Original selected Yukari S1 and exact controller contract required');
  super(b,u,{contract:YUKARI_ORDINARY_CONTRACT,mayBegin:()=>!u.skill.active});verifyYukariS1();Object.assign(this,{talent,payload:new YukariSkillOneTransport(b,u,{contract:YUKARI_S1_TRANSPORT_CONTRACT}),finishing:false,stopping:false,accountHandles:[]});
 }
 canCast(){return this.valid()&&!this.finishing&&!this.stopping&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active&&this.choices().length===1;}
 liveSkill(p){return this.valid()&&this.phase===p&&this.u.skill.active&&this.u.skill.activations===p.activation&&this.u.canAct&&!this.u.hidden&&this.u.actionControlEpoch===p.epoch;}
 startSkill(){if(!this.valid()||!this.u.skill.active)return;const target=this.choices()[0];this.phase=null;this.ending=null;this.chain=false;this.bornUntil=this.b.time;this.u.mem.regularBornUntil=this.b.time;
  if(!target){this.finishAccount('TARGET_LOST');return;}this.face(target);
  const p={kind:'s1',target,life:target.deploySeq,x:target.x,y:target.y,activation:this.u.skill.activations,epoch:this.u.actionControlEpoch,age:0,lastAt:this.b.time,next:0,accepted:false,attackId:null,index:null};this.phase=p;
  p.visual=this.visual('Skill_1',this.u.s.slowDownRate);
 }
 finishAccount(reason='INTERRUPTED'){
  if(this.finishing)return;this.finishing=true;try{this.phase=null;this.ending=null;this.chain=false;
   if(this.u.skill.active)this.u.skill.end(reason);if(this.valid()&&!this.stopping&&!this.u.skill.active)this.idle();
  }finally{this.finishing=false;}
 }
 skillEnded(){if(!this.finishing&&!this.stopping)this.finishAccount('INTERRUPTED');}
 admit(ts){const p=this.phase;if(p?.kind!=='s1')return super.admit(ts);return this.accepting&&this.liveSkill(p)&&!p.accepted&&Number.isInteger(p.index)&&ts.length===1&&ts[0]===p.target;}
 launch(p,index,attackId){return this.payload.launch({target:p.target,life:p.life,x:p.x,y:p.y,index,attackId});}
 release(ts,info){const p=this.phase;if(p?.kind!=='s1')return super.release(ts,info);if(!this.admit(ts))return false;
  p.accepted=true;p.attackId=info.attackId;return this.launch(p,p.index,info.attackId);
 }
 tick(){if(!this.valid())return;const p=this.phase;if(p?.kind!=='s1'){super.tick();return;}
  if(!this.liveSkill(p)){this.finishAccount('INTERRUPTED');return;}p.age+=sourceAbilityDelta(this.u,Math.max(0,this.b.time-p.lastAt),true);p.lastAt=this.b.time;
  if(this.u.mem.regularFormVisual===p.visual)p.visual.speed=this.u.s.slowDownRate;
  const model=this.model(),markers=model.eventPayloads.Skill_1.filter(e=>e.name==='OnAttack');while(p.next<markers.length&&due(p.age,markers[p.next].time)){
   const index=p.next++,target=this.choices()[0];if(target){p.target=target;p.life=target.deploySeq;p.x=target.x;p.y=target.y;}
   p.index=index;if(!p.accepted){this.accepting=true;try{this.b.forceAttack(this.u,[p.target]);}finally{this.accepting=false;}
    if(this.liveSkill(p)&&!p.accepted){this.finishAccount('INTERRUPTED');return;}
   }else if(this.liveSkill(p)&&!this.launch(p,index,p.attackId)){this.finishAccount('INTERRUPTED');return;}
   if(!this.liveSkill(p))return;
  }
  if(due(p.age,model.exactDurations.Skill_1))this.finishAccount('NORMAL_EXIT');
 }
 trait(){return{...super.trait(),acceptAttackInput:t=>this.phase?.kind==='s1'?t===this.phase.target:!!t.alive};}
 spec(){return{kind:'instant',silenceable:false,completeOnAttack:false,pendingText:'Skill active',trigger:{rule:'NEVER'},flags:{noSp:true},holdSpWhileActive:true,attack:{isSkill:true},canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.talent.install();this.accountHandles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move&&this.payload.seq===null)this.payload.bind();},{owner:this.u}),
  this.b.on('palsyTriggered',({unit})=>{if(unit===this.u&&this.phase?.kind==='s1')this.finishAccount('INTERRUPTED');},{owner:this.u})];super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;try{if(this.seq===this.u.deploySeq)this.finishAccount('INTERRUPTED');super.stop();this.payload.retire();if(this.b.finished)this.payload.drain();this.talent.stop();for(const h of this.accountHandles)this.b.off(h);this.accountHandles=[];}finally{this.stopping=false;}}
}
export function prepareYukariS1(b,u,{contract}={}){
 if(contract!==YUKARI_S1_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.yukari)throw Error('Fresh selected Yukari S1 and exact controller contract required');
 const talent=new YukariFinishHealing(b,u,{contract:YUKARI_TALENT_CONTRACT}),controller=new YukariSkillOne(b,u,talent,{contract});u.mem.yukari=controller;
 return{record:controller.record,talent,payload:controller.payload,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
