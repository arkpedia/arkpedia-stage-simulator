// SPDX-License-Identifier: GPL-3.0-or-later
import {SKYBOX_ID as ID,selectedSkyboxInputs,skyboxNativeInputs,skyboxSourceComponent} from './arkpedia-skybox-source.js';
import {SkyboxOrdinaryAttacks,SKYBOX_ORDINARY_CONTRACT} from './arkpedia-skybox-ordinary.js';
import {SkyboxFirstModifierTalent,SKYBOX_TALENT_CONTRACT} from './arkpedia-skybox-talent.js';
import {SkyboxSkillTwoFlight,SKYBOX_S2_FLIGHT_CONTRACT} from './arkpedia-skybox-s2-flight.js';
import {SkyboxSkillTwoTransport,SKYBOX_S2_TRANSPORT_CONTRACT} from './arkpedia-skybox-s2-transport.js';
import {canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
export const SKYBOX_S2_CONTRACT=Object.freeze({
 scope:'Held original selected S2 manual ammo account, mode2 ground acquisition, original loop/Close clocks, overload remaining-ammo burst, landing/return, cached shells and first-modifier talent; no public admission.',
 mapping:'A manual time-SP cast may begin during Born without a target. Its accepted mode parent separately drives Begin/landing and End/FLY. Mode2 alone uses the selected skill grid and one ground input, with original Skill_2_Loop or Skill_Down_2_Loop marker and source-capped ASPD playback. One accepted shell receipt spends one shared ammo unless an existing free-shot hook applies; an independently admitted native counter command then copies actual remaining ammo to the owned mode parent. Final ammo waits for the accepted loop to finish before End. Manual discard above half enters End without a burst. At or below half, a separately admitted ammo_assign command copies actual remaining ammo, replacing the serialized additionalTimes default. Close lasts its original fixed second; the first shell uses its original marker and later slots use the source .05-second interval, reselecting a seeded random legal ground input per birth. Empty or vetoed slots produce no shell or ammo receipt; End discards any remainder. Born shells survive cancellation/retirement, while control changes cancel unborn slots. SP is held through accepted Close and End. Cooldown is preserved.',
 limitations:'Native numeric selector aliases (ground acquisition versus mixed-motion collider), overload/progress/FSM ordering, shared free-shot/extra-ammo interaction, instant command admission, event4 counter timing, random selection and no-target burst slots remain explicit local mappings. End holds the source account until mode0 as a local account/animation boundary. Original mode1 Die2 has no matching art track and is hidden rather than replaced by a guessed clip; Back death is also hidden, while Front mode2/3 uses literal Die_2. Flight/transport/talent contracts retain their limits. Public build/runtime/browser gates, compiled callback semantics, modules, native FX/audio and frame/pixel parity remain separate.',frameParity:false,
});
const due=(a,z)=>a>=z-1e-7;
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const owner=id=>skyboxSourceComponent('characters',ID,id);
export function verifySkyboxS2(n=skyboxNativeInputs(),read=owner){
 const root=n.s2,a=read('-3554859342631338737'),burst=read('-7408980494276821745'),sel=read('-7960479113723446001'),random=read('6385093638462045455'),
  counter=read('-10982645048738545'),wrapper=n.modes[2].attack,assign=wrapper._buffBeforeBurstAttackToOwner[0];
 if(root._fetchFromMainAttack!==1||root._modeIndex!==2||root._attackBlackboardModeIndex!==2||root._rangeIdModeIndex!==2
  ||root._finishSkillWithProgress!==1||root._canDiscardRemainingCount!==1||root._isOverloadSkill!==1||root._burstOnOverload!==1
  ||root._canCastDuringBorn!==1||root._canSwitchDuringBorn!==1||root._allowNoTarget!==1||root._checkHasTargetBeforeDoCast!==0
  ||root._resetAbilityCooldownWhenCastEnd!==0||root._allowSpRecoveryWhenAffecting!==0||root._canSilenced!==0
  ||wrapper._category!==4||wrapper._abilityConfigs[0]._ability.m_PathID!=='-3554859342631338737'
  ||wrapper._burstAttack._ability.m_PathID!=='-7408980494276821745'
  ||a._animKey!=='Attack'||a._downAnimKey!=='Attack_Down'||a._endAnimKey!=='Idle'||a._timeMode!==0||a._maxAnimScale!==1
  ||a._affectedBySlowDown!==0||a._waitForAttackEvent!==1||a._selectTargetSource!==2||a._selectTargetTiming!==0
  ||burst._animKey!=='Skill_2_Close'||burst._timeMode!==1||burst._maxAnimScale!==-1||burst._affectedBySlowDown!==0
  ||burst._selectTargetTiming!==1||burst._selectTargetSource!==1||burst._additionalTimes!==7||burst._triggerDelta!==0.05000000074505806
  ||burst._refreshTimesOnCastStart!==1||burst._limitToOneTargetAfterFirstRound!==0||burst._waitAttackEventForAllAttacks!==0||burst._allowNoTarget!==1
  ||sel._targetSide!==2||sel._targetMotion!==3||sel._postFilter!==4||sel._maxNum!==1||sel._ignoreTargetFree!==0
  ||random._targetSide!==2||random._targetMotion!==3||random._postFilter!==14||random._maxNum!==1||random._ignoreTargetFree!==0
  ||counter._runActionOnEvent!==4||counter._buffs[0].buffKey!=='skybx_s_2[counter]'||counter._buffs[0].lifeTimeType!==0
  ||assign.buffKey!=='skybx_s_2[ammo_assign]'||assign.lifeTimeType!==0)
  throw Error('Changed original Skybox S2 account/attack inputs');
 const aliases=n.modes.slice(1).map(m=>read(m.mode._animatorHooker.m_PathID)._replaceAnimPairs),
  expected=[[['Die','Die2']],[['Idle','Skill_2_Idle'],['Attack','Skill_2_Loop'],['Attack_Down','Skill_Down_2_Loop'],['Die','Die_2']],
   [['Idle','Skill_2_Idle'],['Die','Die_2']]];
 if(aliases.some((ps,i)=>JSON.stringify(ps.map(p=>[p.fromAnimKey,p.toAnimKey]))!==JSON.stringify(expected[i])))
  throw Error('Changed original Skybox S2 animation aliases');
 const t=n.templates,c=t['skybx_s_2[counter]'].eventToActions.ON_BUFF_START,s=t['skybx_s_2[ammo_assign]'].eventToActions.ON_BUFF_START;
 if(c.length!==2||c[0]._blackboardKey!=='times'||!c[0].$type.includes('+AssignAmmoSkillRemainingCountToBB,')
  ||c[1]._buffKey!=='skybx_s_2[switch_mode]'||c[1]._blackboardKey!=='times'||c[1]._valueKey!=='times'||c[1]._assignFirstBuff!==true
  ||s.length!==2||!s[0].$type.includes('+AssignAmmoSkillRemainingCountToBB,')||s[0]._blackboardKey!=='times'
  ||s[1]._abilityName!=='S2_Burst'||s[1]._blackboardKeys!=='times'||s[1]._fromBlackboardKeys!=='times'||s[1]._useOtherAbility!==true)
  throw Error('Changed original Skybox S2 counter templates');
 return{attack:a,burst,counter:counter._buffs[0],assign};
}
export class SkyboxSkillTwo extends SkyboxOrdinaryAttacks{
 constructor(b,u,talent,flight,{contract}={}){
  if(contract!==SKYBOX_S2_CONTRACT||selectedSkyboxInputs(u).index!==1)throw Error('Original selected Skybox S2 and exact contract required');
  super(b,u,{contract:SKYBOX_ORDINARY_CONTRACT,mayBegin:()=>true,takeoff:flight});this.native=verifySkyboxS2();
  this.talent=talent;this.flight=flight;this.payload=new SkyboxSkillTwoTransport(b,u,{contract:SKYBOX_S2_TRANSPORT_CONTRACT});
  this.activation=null;this.commandSerial=0;this.accountHandles=[];
  this.mayBegin=()=>this.flight.mode===0&&!this.u.skill.active||this.inMode();
  flight.onMode=m=>this.modeChanged(m);flight.onClip=c=>this.visual(c,1,c==='Idle'||c==='Skill_2_Idle');
 }
 accountLive(){return this.valid()&&this.u.skill.active&&this.u.skill.activations===this.activation;}
 inMode(){return this.accountLive()&&this.flight.mode===2&&this.flight.modeLive();}
 canCast(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.skill.active&&this.flight.mode===0&&!this.flight.s2phase;}
 canCancel(){return this.accountLive()&&[1,2].includes(this.flight.mode)&&this.flight.modeLive()&&this.phase?.kind!=='s2-close';}
 overloaded(){return this.accountLive()&&this.u.skill.ammoLeft<=this.u.skill.ammoMax/2;}
 deathVisual(){this.u.mem.regularDeathVisual=this.facing==='UP'||this.flight.mode===1?{hide:true,duration:1}:
  this.flight.mode>=2?{clip:'Die_2',die:'Die_2',duration:1}:{clip:'Die',die:'Die',duration:1};}
 visual(...args){super.visual(...args);this.deathVisual();}
 idle(){this.facing=this.u.dir;this.visual(this.flight.mode===2?'Skill_2_Idle':'Idle',1,true);}
 modeChanged(mode){if(!this.valid())return;
  if(mode===1||mode===3)this.phase=null;this.deathVisual();this.b._refreshRange(this.u);
  if(mode===0&&this.accountLive())this.u.skill.end('source-end-finished');
 }
 startSkill(){if(!this.valid()||!this.u.skill.active)return;this.activation=this.u.skill.activations;
  if(!this.flight.begin()&&this.accountLive())this.u.skill.end('mode-rejected');
 }
 choices({limit=1}={}){if(!this.inMode())return super.choices({limit});
  if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const eligible=t=>present(t)&&canTargetEnemy(this.u,t,{canHitFly:false,groundOnly:true}),
   ts=this.b.enemies.filter(t=>eligible(t)&&bodyInKeys(t,this.u.rangeKeySet));
  for(const t of this.b.blockedTargets(this.u,{canHitFly:false,canTarget:(_u,e)=>eligible(e)}))if(!ts.includes(t))ts.push(t);
  return sortEnemyTargets(this.b,this.u,ts,'normal').slice(0,limit);
 }
 begin(target){if(!this.inMode()){super.begin(target);return;}this.face(target);
  super.begin(target,{clip:this.facing==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop',isSkill:true});
  Object.assign(this.phase,{s2:true,activation:this.activation,spent:false});
 }
 input(){return this.phase?.kind==='s2-close'?this.phase.input:this.phase?.s2?this.phase:null;}
 admit(ts){const p=this.phase,input=this.input();if(!input)return this.flight.mode===0&&!this.u.skill.active&&super.admit(ts);
  return this.accepting&&this.inMode()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!input.accepted
   &&p.activation===this.activation&&p.epoch===this.u.attackControlEpoch&&this.u.skill.ammoLeft>0
   &&(p.kind==='s2-close'||due(p.age,p.releaseAge))&&ts.length===1&&ts[0]===input.target
   &&ts[0].deploySeq===input.life&&present(ts[0])&&!ts[0].hidden;
 }
 release(ts,info){const input=this.input();if(!input)return super.release(ts,info);if(!this.admit(ts))return false;
  const accepted=this.payload.launch({target:ts[0],life:input.life,attackId:info.attackId,burst:this.phase.kind==='s2-close'});
  if(accepted)input.accepted=true;return accepted;
 }
 command(raw,phase,run){const p={finished:false,admitted:false,buff:null},key=`${raw.buffKey}:${this.u.id}:${this.seq}:${++this.commandSerial}`;
  const valid=()=>this.accountLive()&&this.phase===phase&&phase.activation===this.activation&&this.flight.modeLive();
  const admit=(_u,buff)=>valid()&&!p.finished&&(!buff||buff.key===key&&buff.source===this.u&&buff.data?.skyboxS2Command===p)
   &&(!this.u.findBuff(key)||this.u.findBuff(key).data?.skyboxS2Command===p);
  const finish=()=>{if(p.finished)return;p.finished=true;if(p.admitted&&valid())run();};
  p.buff=this.b.addBuff(this.u,{key,source:this.u,duration:0,data:{skyboxS2Command:p},admit,onRemove:finish,onExpire:finish});
  if(!admit()||p.buff?.data?.skyboxS2Command!==p){p.finished=true;
   if(p.buff?.data?.skyboxS2Command===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);return false;}
  p.admitted=true;this.b.removeBuff(this.u,p.buff);return p.finished&&valid();
 }
 spend(c){const p=this.phase,input=this.input();if(!input?.accepted||input.spent)return;
  input.spent=true;const free=c.noAmmo;c.noAmmo=true;
  if(!free){this.u.skill.ammoLeft=Math.max(0,this.u.skill.ammoLeft-1);
   if(this.b._hooks.ammoUsed)this.b.emit('ammoUsed',{unit:this.u,left:this.u.skill.ammoLeft,skill:this.u.skill});}
  if(p.s2&&this.accountLive()&&this.phase===p)this.command(this.native.counter,p,()=>{this.flight.modeParent.times=this.u.skill.ammoLeft;});
 }
 endMode(){if(!this.accountLive())return false;this.phase=null;
  if(this.flight.modeLive())this.flight.end();else if(this.flight.mode!==3)this.u.skill.end('mode-missing');return true;
 }
 discard(){if(!this.canCancel())return false;if(!this.overloaded()||this.flight.mode!==2||this.u.skill.ammoLeft<=0)return this.endMode();
  const old=this.phase,p={kind:'s2-close',activation:this.activation,epoch:this.u.attackControlEpoch,start:this.b.time,
   duration:this.model().exactDurations.Skill_2_Close,marker:this.model().eventPayloads.Skill_2_Close[0].time,
   count:null,next:0,input:null};this.phase=p;
  const assigned=this.command(this.native.assign,p,()=>{p.count=this.u.skill.ammoLeft;});
  if(!assigned||!Number.isInteger(p.count)||p.count<=0){if(this.valid()&&this.phase===p)this.phase=old;return false;}
  if(!this.inMode()||this.phase!==p)return false;this.u.atkCd=Math.max(this.u.atkCd,p.duration);this.visual('Skill_2_Close');return true;
 }
 completed(p){if(p.s2&&this.inMode()&&this.u.skill.ammoLeft<=0)this.endMode();}
 tick(){if(!this.valid())return;const p=this.phase;
  if(p?.kind==='s2-close'){
   if(!this.inMode())return;
   if(this.u.hidden||!this.u.canAct||this.u.s.flags.disarm||p.epoch!==this.u.attackControlEpoch){this.endMode();return;}
   while(this.phase===p&&this.inMode()&&p.next<p.count&&due(this.b.time-p.start,p.marker+p.next*this.native.burst._triggerDelta)){
    const slot=p.next++,ts=this.choices({limit:Infinity});if(!ts.length)continue;
    const target=ts[Math.min(ts.length-1,Math.floor(this.b.rng()*ts.length))];p.input={target,life:target.deploySeq,slot,accepted:false,spent:false};
    this.face(target);this.u.mem.regularVisualDirection=this.facing;this.deathVisual();this.accepting=true;
    try{this.b.forceAttack(this.u,[target]);}finally{this.accepting=false;p.input=null;}
   }
   if(this.phase===p&&this.inMode()&&due(this.b.time-p.start,p.duration))this.endMode();return;
  }
  if(this.flight.mode===1||this.flight.mode===3)return;
  if(this.flight.mode===2&&!this.inMode())return;
  if(this.inMode()&&this.u.skill.ammoLeft<=0&&!p){this.endMode();return;}super.tick();
 }
 skillEnded(){if(!this.valid())return;this.phase=null;if(this.flight.modeLive())this.flight.end();}
 spec(){const self=this;return{kind:'ammo',ammo:this.record.bb['attack@trigger_time'],duration:0,silenceable:false,manualCancel:true,trigger:{rule:'NEVER'},attack:{isSkill:true},
  targeting:{get rangeGrid(){return self.flight.mode===2?self.record.skillRangeGrid:null;}},
  canActivate:()=>this.canCast(),canManualCancel:()=>this.canCancel(),onManualCancel:()=>this.discard(),overloadState:()=>this.overloaded(),
  onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded(),onAttack:c=>this.spend(c)};}
 install(){this.talent.install();this.flight.install();this.accountHandles=[this.b.on('deploy',({unit,move})=>{
  if(unit===this.u&&!move)this.payload.bind();},{owner:this.u})];super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;
  try{if(this.u.deploySeq===this.seq&&this.u.skill.active&&this.u.skill.activations===this.activation)this.u.skill.end('controller-removed');
   super.stop();this.payload.retire();this.flight.stop();this.talent.stop();for(const h of this.accountHandles)this.b.off(h);this.accountHandles=[];
  }finally{this.stopping=false;}
 }
}
export function prepareSkyboxS2(b,u,{contract}={}){
 if(contract!==SKYBOX_S2_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.skybox)throw Error('Fresh selected Skybox S2 and exact controller contract required');
 const talent=new SkyboxFirstModifierTalent(b,u,{contract:SKYBOX_TALENT_CONTRACT}),flight=new SkyboxSkillTwoFlight(b,u,{contract:SKYBOX_S2_FLIGHT_CONTRACT}),
  controller=new SkyboxSkillTwo(b,u,talent,flight,{contract});u.mem.skybox=controller;
 return{record:controller.record,talent,flight,takeoff:flight,payload:controller.payload,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
