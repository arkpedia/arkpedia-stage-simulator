// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original-stage controller; public roster admission remains separate.
import evidence from '../../../data/arkpedia-native-operators/char_4214_cairn.json' with {type:'json'};
import clocks from '../../../data/arkpedia-cairn-clocks.json' with {type:'json'};
import {CAIRN_ID as ID,cairnNativeInputs} from './arkpedia-cairn-source.js';
import {prepareCairnResources,CAIRN_RESOURCE_CONTRACT} from './arkpedia-cairn-resources.js';
import {acquireTargets,effectiveProfile,resolveHit} from '../ai.js';
import {absoluteRangeKeys,canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';
export const CAIRN_CONTRACT=Object.freeze({
 scope:'Held Cairn ordinary melee, timed HP S1 and one-shot shield/DOT S2 with selected blocked talent; public admission is separate',
 mapping:'One input-time ordinary target and one accepted attack receipt. S1 starts its thirty-second skill account at activation, enters its HP mode after the unscaled Begin and uses native Loop/Idle tracks. End transitions hold their source duration while preserving positive ordinary cooldown. S2 selects all current ground recipients in the source nine-cell range at its original marker, independently grants its shield even without a target and ends at the original clip end. S2 does not manufacture a normal attack receipt; its SP is held through that cast. Source max animation scale one caps firing speed; an ordinary cycle lasts at least its release time. Full Start represents birth, but native permitted skills can replace that window.',
 limits:'The resource timer/override policies are those of CAIRN_RESOURCE_CONTRACT. Numeric selector aliases, S1 account/buff start timing, ordinary cycle/FSM timing, S2 shield callback phase, control/End ordering and no-attack S2 accounting are explicit mappings rather than executable compiled Unity dispatch. Modules, native particles/shaders/audio, game-frame/pixel parity and public gameplay/art delivery remain separate.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const due=(b,t)=>b.time+1e-7>=t;
export class CairnController{
 constructor(b,u,resources){this.b=b;this.u=u;this.resources=resources;this.record=resources.record;this.seq=null;this.stopped=false;
  this.phase=null;this.mode=0;this.accepting=false;this.facing=u.dir;this.visualSeq=0;this.lastClip=null;this.handles=[];this.finishing=false;}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return {...evidence.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Cairn clip: '+clip);
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`cairn:${this.seq}:${++this.visualSeq}`}:{})};}
 idle(){this.facing=this.u.dir;this.visual(this.mode===1?'Skill_1_Idle':'Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,effectiveProfile(this.u)).slice(0,1);}
 canCast(){return this.valid()&&live(this.u)&&this.u.canAct&&!this.u.skill.active&&(this.record.index===0||!this.u.s.flags.disarm)&&!['begin','end','s2'].includes(this.phase?.kind);}
 start(){const{b,u,record:r}=this;this.facing=u.dir;
  if(r.index===0){this.phase={kind:'begin',until:b.time+this.model().exactDurations.Skill_1_Begin};this.visual('Skill_1_Begin');}
  else{const speed=Math.min(1,u.base.bat/u.s.interval),m=this.model();
   this.phase={kind:'s2',released:false,epoch:u.attackControlEpoch,releaseAt:b.time+m.eventPayloads.Skill_2[0].time/speed,
    until:b.time+m.exactDurations.Skill_2/speed};this.visual('Skill_2',speed);}
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
 releaseS2(p){if(!this.valid()||!live(this.u)||!this.u.skill.active||this.phase!==p)return;
  const{b,u,record:r}=this,keys=new Set(absoluteRangeKeys(r.skillRangeGrid,u.tileR,u.tileC,u.dir));
  const recipients=b.enemies.filter(t=>canTargetEnemy(u,t,{canHitFly:false})&&bodyInKeys(t,keys));
  // Same-marker order is explicit: finish recipient attachments before granting
  // the independent self shield, matching the scoped after-ability callback.
  for(const t of recipients){if(!this.valid()||this.phase!==p)break;this.resources.attachDot(t);}
  if(this.valid()&&this.phase===p)this.resources.grantShield();
 }
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(p?.kind==='begin'){
   if(!u.skill.active){this.phase=null;return;}if(!due(b,p.until))return;
   this.mode=this.resources.beginHp()?1:0;if(!this.valid())return;this.phase=p=null;this.idle();
  }
  if(!live(u)||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){
   this.phase=null;if(p?.kind==='s2')this.finishS2('interrupted');else if(this.valid())this.idle();return;
  }
  if(p?.kind==='born'||p?.kind==='end'){if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(p?.kind==='s2'){
   if(!u.skill.active){this.phase=null;this.idle();return;}
   if(!p.released&&due(b,p.releaseAt)){p.released=true;this.releaseS2(p);}
   if(this.phase!==p||!this.valid())return;if(due(b,p.until))this.finishS2('cast-finished');return;
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
  const target=targets[0];this.face(target);const clip=this.mode===1?'Skill_1_Loop':'Attack',m=this.model(),speed=Math.min(1,u.base.bat/u.s.interval);
  const releaseAt=b.time+m.eventPayloads[clip][0].time/speed,period=Math.max(u.s.interval,releaseAt-b.time);
  this.phase={kind:'attack',startedAt:b.time,mode:this.mode,target,targetSeq:target.deploySeq,epoch:u.attackControlEpoch,releaseAt,
   until:b.time+period,released:false,accepted:false};u.atkCd=period;this.visual(clip,speed);
 }
 spec(){return this.record.index===0?{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},attack:{},
   canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()}
  :{kind:'instant',silenceable:false,trigger:{rule:'NEVER'},attack:{},completeOnAttack:false,flags:{noSp:true},
   pendingText:'Skill casting',canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()};}
 install(){if(this.handles.length||this.stopped)throw Error('Cairn cannot be reinstalled');this.resources.install();
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;
   const until=this.b.time+this.model().exactDurations.Start;unit.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));}
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.resources.stop();this.phase=null;this.mode=0;this.accepting=false;delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareCairn(b,u,{contract}={}){
 if(contract!==CAIRN_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.cairn)throw Error('Fresh selected Cairn and explicit held contract required');
 const n=cairnNativeInputs();for(const a of[n.ordinary,n.s1Attack])if(a._waitForAttackEvent!==1||a._animKey!=='Attack'||a._selectTargetTiming!==0||a._maxAnimScale!==1)throw Error('Unreviewed Cairn ordinary clock');
 for(const s of[n.ordinarySelector,n.s1Selector])if(s._limitTargetNum!==1||s._maxNum!==1||s._limitedMaxTargetNumToBlockedCnt!==0)throw Error('Unreviewed Cairn single target selector');
 if(n.s1._beginAnim!=='Skill_1_Begin'||n.s1._playSkillBeginAnim!==1||n.s2Attack._animKey!=='Skill_2'||n.s2Attack._selectTargetTiming!==1
  ||n.s2Attack._maxAnimScale!==1||n.s2Attack._allowNoTarget!==1||n.s2Selector._targetMotion!==1||n.s2Selector._limitTargetNum!==0||n.s2Shield._runActionOnEvent!==4)
  throw Error('Unreviewed Cairn native skill hierarchy');
 const resources=prepareCairnResources(b,u,{contract:CAIRN_RESOURCE_CONTRACT}),controller=new CairnController(b,u,resources);u.mem.cairn=controller;
 return {record:resources.record,resources,controller,kit:{talents:[],install:null,skill:controller.spec(),
  trait:{noAttack:true,attackDrivenSkill:true,attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,maxTargets:1,
   maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,chain:null,splashRadius:0,windup:0,requiresAcceptedLaunch:true,
   acceptAreaAttack:(_b,_u,_p,targets)=>controller.admissible(targets),launchAreaAttack:(_b,_u,p,targets,info)=>controller.release(p,targets,info)}}};
}
