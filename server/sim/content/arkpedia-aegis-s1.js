// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../../data/arkpedia-aegis-clocks.json' with{type:'json'};
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs,aegisSourceComponent} from './arkpedia-aegis-source.js';
import {AegisOrdinaryAttacks,AEGIS_ORDINARY_CONTRACT} from './arkpedia-aegis-ordinary.js';
import {AegisPhysicalTalent,AEGIS_TALENT_CONTRACT} from './arkpedia-aegis-talent.js';
import {AegisSkillOneFlight,AEGIS_S1_FLIGHT_CONTRACT} from './arkpedia-aegis-s1-flight.js';
import {AegisSkillOneTransport,AEGIS_S1_TRANSPORT_CONTRACT} from './arkpedia-aegis-s1-transport.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';import {bodyInKeys} from '../body.js';
export const AEGIS_S1_CONTRACT=Object.freeze({
 scope:'Selected original manual S1 account, landing/ground random attacks, independent self-stun/return, original facing clocks and ordinary aerial attacks; no S2 or public admission.',
 mapping:'One manual time-SP charge can cast without a target, during Born or an ordinary windup, while preserving positive ordinary cooldown. The duration account and separately admitted native holder end together; dispel commits the spent charge and ends the account without a refund. SP is held only while the account is active and recovers during self-stun. Begin and return use original fixed clocks with affectedBySlowDown1, independent of ASPD. Mode2 captures one legal ground/air input: own blocker first, otherwise uniform seeded random choice, once per attack. Original capped Attack/Skill_1_Loop playback releases at .5666666626930237 and launches the separate live-ATK delayed point payload. A lost/replaced input uses its captured point, never a new life. Control/hiding interrupts unborn output and preserves positive cooldown; a controlled Begin/return retries from its start after action returns. Front aliases/mixes retain their original n-prefixed stun tracks; missing Back stun clips are ignored without substituting a facing. Return waits for own and foreign action-stopping controls, then ends in mode0/ordinary aerial behavior.',
 limitations:'Native postFilter14 random/blocked priority, charge/refund, duration/holder ordering, restart FSM, ability-source capture and post-retirement attributes are explicit local mappings. Missing Back return animation uses the original Front one-second ability clock while leaving Back presentation unchanged; compiled missing-animation duration is unresolved. The original trait skill/WALK AtkScaleUp has default1 and no selected S1 atk_scale parameter, so it adds no invented damage bonus. Visual-only S1Effect/derived stun effects, native FX/audio/modules, original compiled/frame/pixel parity, S2 and public admission remain separate.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const due=(a,z)=>a>=z-1e-7;
export function verifyAegisS1(n=aegisNativeInputs(),read=aegisSourceComponent){
 const s=n.s1,begin=n.modes[1].attack,a=n.modes[2].attack,end=n.modes[3].attack,
  selector=read('characters',ID,'3075325240047253509'),effect=read('characters',ID,'539941508882184197')._buffs[0],trait=n.templates.aigis_tr.eventToActions.ON_CALCULATE_DAMAGE,
  attach=n.templates.aigis_s_1_effect.eventToActions.ON_BUFF_START;
 if(s._allowSpRecoveryWhenAffecting!==0||s._canSilenced!==0||s._canUseInAbnormalState!==0||s._allowNoTarget!==1||s._checkHasTargetBeforeDoCast!==0
  ||s._canCastDuringBorn!==1||s._canSwitchDuringBorn!==1||s._resetAbilityCooldownWhenCastEnd!==0||s._recoverSpIfNoTarget!==0
  ||begin._animKey!=='Skill_1_Begin'||begin._timeMode!==1||begin._affectedBySlowDown!==1||begin._maxAnimScale!==1||begin._allowNoTarget!==1
  ||a._timeMode!==0||a._affectedBySlowDown!==1||a._maxAnimScale!==1||a._waitForAttackEvent!==1||a._interuptIfTargetDead!==0
  ||a._selectTargetSource!==1||a._animKey!=='Attack'||a._downAnimKey!=='Skill_Down_1_Loop'
  ||selector._targetSide!==2||selector._targetMotion!==3||selector._postFilter!==14||selector._maxNum!==1||selector._forceIgnoreCamouflage!==0||selector._ignoreTargetFree!==0
  ||end._animKey!=='Skill_1_Stun_End'||end._timeMode!==1||end._affectedBySlowDown!==1||end._maxAnimScale!==1
  ||effect.buffKey!=='aigis_s_1_effect'||effect.attributes.attributeModifiers.length!==0||effect.attributes.abnormalFlags.length!==0
  ||attach.length!==3||attach[0]._buffKey!=='aigis_s1_holder'||attach[0]._finishDerivedBuffIfParentFinish!==true||attach[0]._finishDerivedBuffIfNoParent!==true
  ||trait.length!==3||trait[0]._checkSpShowedBuff!==false||trait[1]._mode!=='WALK'||trait[2]._defaultValue!==1||trait[2]._atkScaleKey!=='atk_scale')
  throw Error('Changed original Aegis S1 composition inputs');
}
export class AegisSkillOne extends AegisOrdinaryAttacks{
 constructor(b,u,talent,flight,{contract}={}){
  if(contract!==AEGIS_S1_CONTRACT||selectedAegisInputs(u).index!==0)throw Error('Original selected Aegis S1 and exact controller contract required');
  super(b,u,{contract:AEGIS_ORDINARY_CONTRACT,flight,mayBegin:()=>flight.mode===0&&!u.skill.active});verifyAegisS1();
  Object.assign(this,{talent,payload:new AegisSkillOneTransport(b,u,{contract:AEGIS_S1_TRANSPORT_CONTRACT}),accountHandles:[],finishing:false,stopping:false});
 }
 valid(){return super.valid()&&!this.flight.stopped;}
 canCast(){return this.valid()&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active&&this.flight.mode===0&&!this.flight.phase;}
 skillLegal(t){return present(t)&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&(!t.s.flags.camou||!!t.blockedBy);}
 skillChoices(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const blocked=this.b.blockedTargets(this.u,{canHitFly:true,canTarget:(_u,t)=>this.skillLegal(t)});
  if(blocked.length)return sortEnemyTargets(this.b,this.u,blocked,'normal').slice(0,1);
  const ts=this.b.enemies.filter(t=>this.skillLegal(t)&&bodyInKeys(t,this.u.rangeKeySet));
  return ts.length?[ts[ts.length===1?0:Math.min(ts.length-1,Math.floor(this.b.rng()*ts.length))]]:[];
 }
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)return null;const v=super.visual(clip,speed,loop);
  if(v&&this.flight.mode!==0)this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Skill_1_Die',die:'Skill_1_Die',duration:1};return v;
 }
 idle(){if(this.flight.mode!==2){super.idle();return;}this.facing=this.u.dir;this.visual('Skill_1_Idle',1,true);}
 transition(kind,clip,duration){const p={kind,clip,duration,age:0,lastAt:this.b.time,epoch:this.u.attackControlEpoch,interrupted:false};this.phase=p;
  p.visual=this.visual(clip,this.u.s.slowDownRate);return p;
 }
 modeChanged(mode){if(!this.valid()||this.stopping)return;
  if(mode===1){this.phase=null;this.bornUntil=this.b.time;this.u.mem.regularBornUntil=this.b.time;this.transition('s1-begin','Skill_1_Begin',this.model().exactDurations.Skill_1_Begin);}
  if(mode===2){this.phase=null;this.idle();}
  if(mode===3){const from=this.u.mem.regularFormVisual?.clip,mix=aegisNativeInputs().artController._mixSettings.find(m=>m.sourceAnimName===from&&m.targetAnimName==='nSkill_1_Stun');
   this.endAccount('source-holder-finished');if(!this.valid())return;this.phase={kind:'s1-stun',mixAge:0,lastAt:this.b.time};
   if(mix&&this.model().exactDurations[mix.mixAnimName]!=null){this.phase.mix=mix.mixAnimName;this.visual(mix.mixAnimName);}
   else this.visual('nSkill_1_Stun',1,true);
  }
  if(mode===0){this.phase=null;this.bornUntil=this.b.time;this.idle();}
 }
 startSkill(){if(!this.valid()||!this.u.skill.active)return;this.phase=null;
  if(!this.flight.beginSkillOne()&&this.valid()&&this.flight.mode===0)this.endAccount('source-holder-refused');
 }
 endAccount(reason){if(this.finishing)return;this.finishing=true;try{if(this.u.skill.active)this.u.skill.end(reason);}finally{this.finishing=false;}}
 holderFinished(){if(!this.valid()||this.stopping)return;this.phase=null;this.endAccount('source-holder-finished');}
 skillEnded(){if(this.stopping||this.finishing)return;this.phase=null;this.flight.endSkillOne();}
 begin(t){if(this.flight.mode!==2){super.begin(t);return;}this.face(t);const m=this.model(),clip=this.facing==='DOWN'?'Skill_Down_1_Loop':'Skill_1_Loop',
  speed=Math.min(1,this.u.base.bat/this.u.s.interval),releaseAge=m.eventPayloads[clip][0].time,period=Math.max(this.u.s.interval,releaseAge/speed);
  this.phase={kind:'s1-loop',target:t,life:t.deploySeq,x:t.x,y:t.y,epoch:this.u.attackControlEpoch,age:0,lastAt:this.b.time,speed,releaseAge,untilAge:period*speed,released:false,accepted:false};
  this.u.atkCd=period;this.phase.visual=this.visual(clip,speed*this.u.s.slowDownRate);
 }
 admit(ts){const p=this.phase;if(p?.kind!=='s1-loop')return super.admit(ts);
  return this.accepting&&this.valid()&&this.u.canAct&&!this.u.hidden&&!this.u.s.flags.disarm&&this.flight.mode===2&&this.flight.grantLive(this.flight.holder)
   &&this.u.skill.active&&p.epoch===this.u.attackControlEpoch&&!p.accepted&&due(p.age,p.releaseAge)&&ts.length===1&&ts[0]===p.target;
 }
 release(ts,info){const p=this.phase;if(p?.kind!=='s1-loop')return super.release(ts,info);if(!this.admit(ts))return false;p.accepted=true;
  const valid=p.target.deploySeq===p.life&&this.skillLegal(p.target);return this.payload.launch({target:p.target,life:p.life,x:valid?p.target.x:p.x,y:valid?p.target.y:p.y,attackId:info.attackId});
 }
 tickTransition(p){const u=this.u,dt=Math.max(0,this.b.time-p.lastAt);p.lastAt=this.b.time;
  if(!u.canAct||u.hidden||p.epoch!==u.attackControlEpoch)p.interrupted=true;
  if(!u.canAct||u.hidden)return;
  if(p.interrupted){p.interrupted=false;p.epoch=u.attackControlEpoch;p.age=0;p.completed=false;
   const accepted=p.kind==='s1-begin'?this.flight.beginLanding():this.flight.beginTakeoff({restart:true});
   if(!accepted||!this.valid()||this.phase!==p)return;p.visual=this.visual(p.clip,u.s.slowDownRate);return;
  }
  p.age+=sourceAbilityDelta(u,dt,true);if(u.mem.regularFormVisual===p.visual&&p.visual)p.visual.speed=u.s.slowDownRate;
  if(!due(p.age,p.duration))return;
  // A refused completion remains held; it is not replayed every world tick.
  if(p.completed)return;p.completed=true;
  if(p.kind==='s1-begin')this.flight.completeLanding();else this.flight.completeTakeoff();
 }
 tick(){if(!this.valid())return;const p=this.phase,u=this.u;
  if(p?.kind==='s1-begin'||p?.kind==='s1-return'){this.tickTransition(p);return;}
  if(this.flight.mode===3){if(this.flight.grantLive(this.flight.stun)||!u.canAct||u.hidden){
    if(p?.kind==='s1-stun'&&p.mix){p.mixAge+=Math.max(0,this.b.time-p.lastAt);p.lastAt=this.b.time;
     if(due(p.mixAge,this.model().exactDurations[p.mix]??Infinity)){p.mix=null;this.visual('nSkill_1_Stun',1,true);}}return;
   }
   if(p?.returnAttempted)return;if(p)p.returnAttempted=true;
   if(this.flight.beginTakeoff()&&this.valid())this.transition('s1-return','nSkill_1_Stun_End',clocks.models.Front.exactDurations.nSkill_1_Stun_End);return;
  }
  if(this.flight.mode!==2){super.tick();return;}
  if(!u.skill.active||!this.flight.grantLive(this.flight.holder)){this.phase=null;return;}
  if(!u.canAct||u.hidden||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
  if(p?.kind==='s1-loop'){
   p.age+=sourceAbilityDelta(u,Math.max(0,this.b.time-p.lastAt),true)*p.speed;p.lastAt=this.b.time;
   if(u.mem.regularFormVisual===p.visual&&p.visual)p.visual.speed=p.speed*u.s.slowDownRate;
   if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;try{this.b.forceAttack(u,[p.target]);}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;
  }
  if(u.atkCd>1e-8)return;const t=this.skillChoices()[0];if(t)this.begin(t);else this.idle();
 }
 trait(){return{...super.trait(),acceptAttackInput:t=>this.phase?.kind==='s1-loop'?t===this.phase.target:!!t.alive};}
 spec(){return{kind:'duration',silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},holdSpWhileActive:true,attack:{isSkill:true},
  canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.talent.install();this.flight.install();this.accountHandles=[this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move&&this.payload.seq===null)this.payload.bind();},{owner:this.u})];super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;try{
  if(this.seq===this.u.deploySeq)this.endAccount('controller-removed');super.stop();this.payload.retire();this.flight.stop();this.talent.stop();
  for(const h of this.accountHandles)this.b.off(h);this.accountHandles=[];
 }finally{this.stopping=false;}}
}
export function prepareAegisS1(b,u,{contract}={}){
 if(contract!==AEGIS_S1_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.aegis)throw Error('Fresh selected Aegis S1 and exact controller contract required');
 const talent=new AegisPhysicalTalent(b,u,{contract:AEGIS_TALENT_CONTRACT});let controller;
 const flight=new AegisSkillOneFlight(b,u,{contract:AEGIS_S1_FLIGHT_CONTRACT,onMode:mode=>controller?.modeChanged(mode),onHolderFinish:()=>controller?.holderFinished()});
 controller=new AegisSkillOne(b,u,talent,flight,{contract});u.mem.aegis=controller;
 return{record:controller.record,talent,flight,takeoff:flight,payload:controller.payload,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
