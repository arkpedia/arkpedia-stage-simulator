// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original-stage controller; public roster admission remains separate.
import evidence from '../../../data/arkpedia-native-operators/char_4225_tanya.json' with {type:'json'};
import clocks from '../../../data/arkpedia-tanya-clocks.json' with {type:'json'};
import {TANYA_ID as ID,tanyaNativeInputs} from './arkpedia-tanya-source.js';
import {prepareTanyaResources,TANYA_RESOURCE_CONTRACT} from './arkpedia-tanya-resources.js';
import {acquireTargets,effectiveProfile,resolveHit} from '../ai.js';
import {canTargetEnemy} from '../targeting.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const TANYA_CONTRACT=Object.freeze({
 scope:'Selected Crackborne ordinary melee, timed HP/recovery S1, fixed one-shot S2 DEF stacks and permanent elemental resources; public admission is separate',
 mapping:'One input-time ordinary target and one accepted attack receipt. Native selectMethod1 maps locally to alternating Attack_1/Attack_2 attempts without consuming gameplay RNG; both original clocks and damage agree. S1 attaches its HP/recovery mode immediately because waitForCasting is zero, while the unscaled Begin still occupies its original window. S1 account starts at activation and native End holds its duration with positive ordinary cooldown preserved. S2 has a retained self input, no ordinary attack receipt and source fixed-time Skill_2 markers independent of ASPD. Its elapsed clock and playback opt into current native slow_down through the recovered affectedBySlowDown flag. Permanent DEF stacks and HP-loss responses survive skill finish until used or owner removal.',
 limits:'The resource contract records accepted HP-delta, recovery and protection-channel mappings. Native multi-ability selection/RNG, self-trigger aliases, S1 mode versus Begin ordering, fixed-time/slow_down conversion, cooldown/FSM transitions and End gameplay lock remain explicit local interpretations. Modules, native effects/audio, original game-frame/pixel parity and public admission are not certified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const due=(b,t)=>b.time+1e-7>=t;
export class TanyaController{
 constructor(b,u,resources){this.b=b;this.u=u;this.resources=resources;this.record=resources.record;this.seq=null;this.stopped=false;
  this.phase=null;this.mode=0;this.ordinaryIndex=0;this.accepting=false;this.facing=u.dir;this.visualSeq=0;this.lastClip=null;this.handles=[];this.finishing=false;}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return {...evidence.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Crackborne clip: '+clip);
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`tanya:${this.seq}:${++this.visualSeq}`}:{})};}
 idle(){this.facing=this.u.dir;this.visual(this.mode===1?'Skill_1_Idle':'Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,effectiveProfile(this.u)).slice(0,1);}
 canCast(){return this.valid()&&live(this.u)&&this.u.canAct&&!this.u.skill.active&&!['begin','end','s2'].includes(this.phase?.kind);}
 start(){const{b,u,record:r}=this;this.facing=u.dir;
  if(r.index===0){this.mode=this.resources.beginHp()?1:0;if(!this.valid())return;
   this.phase={kind:'begin',until:b.time+this.model().exactDurations.Skill_1_Begin};this.visual('Skill_1_Begin');}
  else{const m=this.model();this.phase={kind:'s2',released:false,epoch:u.attackControlEpoch,lastAt:b.time,age:0,
    releaseAge:m.eventPayloads.Skill_2[0].time,untilAge:m.exactDurations.Skill_2};this.visual('Skill_2',u.s.slowDownRate);}
 }
 end(){this.mode=0;this.resources.endHp();if(this.finishing||!this.valid())return;
  this.phase=null;
  if(this.record.index===0&&['Skill_1_Idle','Skill_1_Loop'].includes(this.lastClip)){
   this.phase={kind:'end',until:this.b.time+this.model().exactDurations.Skill_1_End};this.visual('Skill_1_End');
  }else this.idle();
 }
 finishS2(reason){if(!this.u.skill.active)return;this.finishing=true;
  try{this.u.skill.end(reason);}finally{this.finishing=false;}
  this.phase=null;if(this.valid())this.idle();
 }
 admissible(targets){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm
  &&p?.kind==='attack'&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&p.mode===this.mode&&due(this.b,p.releaseAt)
  &&targets.length===1&&targets[0]===p.target&&targets[0].deploySeq===p.targetSeq&&live(targets[0]);}
 release(profile,targets,info){if(!this.admissible(targets))return false;this.phase.accepted=true;
  resolveHit(this.b,this.u,{...profile,dmgMul:null},targets[0],info,targets[0].x,targets[0].y);return true;}
 releaseS2(p){if(this.valid()&&live(this.u)&&this.u.skill.active&&this.phase===p)this.resources.addStacks();}

 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(p?.kind==='begin'){
   if(!u.skill.active){this.phase=null;return;}if(!due(b,p.until))return;
   this.phase=p=null;this.idle();
  }
  if(!live(u)||!u.canAct||(p?.kind!=='s2'&&u.s.flags.disarm)||(p?.epoch!=null&&p.epoch!==u.attackControlEpoch)){
   this.phase=null;if(p?.kind==='s2')this.finishS2('interrupted');else if(this.valid())this.idle();return;
  }
  if(p?.kind==='born'||p?.kind==='end'){if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(p?.kind==='s2'){
   if(!u.skill.active){this.phase=null;this.idle();return;}
   p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true);p.lastAt=b.time;u.mem.regularFormVisual.speed=u.s.slowDownRate;
   if(!p.released&&p.age+1e-7>=p.releaseAge){p.released=true;this.releaseS2(p);}
   if(this.phase!==p||!this.valid())return;if(p.age+1e-7>=p.untilAge)this.finishS2('cast-finished');return;
  }
  if(p?.kind==='attack'){
   if(!p.released&&due(b,p.releaseAt)){p.released=true;
    if(live(p.target)&&p.target.deploySeq===p.targetSeq&&canTargetEnemy(u,p.target,{canHitFly:false})){
     this.accepting=true;try{b.forceAttack(u,[p.target]);}finally{this.accepting=false;}
    }
   }
   if(this.phase!==p||!this.valid()||!due(b,p.until))return;this.phase=p=null;
  }
  if(u.atkCd>1e-9)return;const targets=this.targets();if(!targets.length){this.idle();return;}
  const target=targets[0];this.face(target);const clip=this.mode===1?'Skill_1_Loop':`Attack_${1+(this.ordinaryIndex++%2)}`,m=this.model(),speed=Math.min(1,u.base.bat/u.s.interval);
  const releaseAt=b.time+m.eventPayloads[clip][0].time/speed,period=Math.max(u.s.interval,releaseAt-b.time);
  this.phase={kind:'attack',startedAt:b.time,mode:this.mode,target,targetSeq:target.deploySeq,epoch:u.attackControlEpoch,releaseAt,
   until:b.time+period,released:false,accepted:false};u.atkCd=period;this.visual(clip,speed);
 }
 spec(){return this.record.index===0?{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},attack:{},
   canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()}
  :{kind:'instant',silenceable:false,trigger:{rule:'NEVER'},attack:{},completeOnAttack:false,flags:{noSp:true},
   pendingText:'Skill casting',canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()};}
 install(){if(this.handles.length||this.stopped)throw Error('Crackborne cannot be reinstalled');this.resources.install();
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;this.ordinaryIndex=0;
   const until=this.b.time+this.model().exactDurations.Start;unit.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));}
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.resources.stop();this.phase=null;this.mode=0;this.accepting=false;delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareTanya(b,u,{contract}={}){
 if(contract!==TANYA_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.tanya)throw Error('Fresh selected Crackborne and explicit held contract required');
 const n=tanyaNativeInputs();for(const[a,clip]of[[n.ordinaryOne,'Attack_1'],[n.ordinaryTwo,'Attack_2'],[n.s1Attack,'Attack']])
  if(a._waitForAttackEvent!==1||a._animKey!==clip||a._selectTargetTiming!==0||a._maxAnimScale!==1)throw Error('Unreviewed Crackborne ordinary clock');
 for(const s of[n.ordinarySelector,n.s1Selector])if(s._limitTargetNum!==1||s._maxNum!==1||s._limitedMaxTargetNumToBlockedCnt!==0)throw Error('Unreviewed Crackborne single target selector');
 if(n.choice._selectMethod!==1||n.choice._abilities.map(p=>p.m_PathID).join()!=='6791374229816730892,-1801412996564982516'
  ||n.s1._beginAnim!=='Skill_1_Begin'||n.s1._playSkillBeginAnim!==1||n.s1Buff._waitForCasting!==0
  ||n.s2Attack._animKey!=='Skill_2'||n.s2Attack._timeMode!==1||n.s2Attack._affectedBySlowDown!==1
  ||n.s2._useTriggerInManualMode!==1||n.s2Attack._activeBuffs[0].templateKey!=='tanya_s_2'||n.s2Attack._actions.SerializedState!=='null')
  throw Error('Unreviewed Crackborne native skill hierarchy');
 const resources=prepareTanyaResources(b,u,{contract:TANYA_RESOURCE_CONTRACT}),controller=new TanyaController(b,u,resources);u.mem.tanya=controller;
 return {record:resources.record,resources,controller,kit:{talents:[],install:null,skill:controller.spec(),
  trait:{noAttack:true,attackDrivenSkill:true,attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,maxTargets:1,
   maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,chain:null,splashRadius:0,windup:0,requiresAcceptedLaunch:true,
   acceptAreaAttack:(_b,_u,_p,targets)=>controller.admissible(targets),launchAreaAttack:(_b,_u,p,targets,info)=>controller.release(p,targets,info)}}};
}
