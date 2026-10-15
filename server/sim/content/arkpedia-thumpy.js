// SPDX-License-Identifier: GPL-3.0-or-later
// Original selected attacks/casts. Public roster and browser approval are separate.
import evidence from '../../../data/arkpedia-native-operators/char_4235_thumpy.json' with {type:'json'};
import clocks from '../../../data/arkpedia-thumpy-clocks.json' with {type:'json'};
import {THUMPY_ID as ID,thumpyNativeInputs} from './arkpedia-thumpy-source.js';
import {prepareThumpyResources,THUMPY_RESOURCE_CONTRACT} from './arkpedia-thumpy-resources.js';
import {thumpyFieldTiles,THUMPY_TILE_CONTRACT} from './arkpedia-thumpy-tiles.js';
import {acquireTargets,effectiveProfile,resolveHit} from '../ai.js';
import {canTargetEnemy} from '../targeting.js';
import {PUSH_DIRECTIONAL_MIN_DIST} from '../constants.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
export const THUMPY_CONTRACT=Object.freeze({
 scope:'Selected Thumpy ordinary single-target, all-blocked S1/S3, S1 push, three timed modes, original cast markers, captured glue/conveyor and elemental resources; public admission remains separate',
 mapping:'Default and S2 use the source input alone (null ability selector). S1/S3 capture eligible own blockees, capped by current block capacity, or retain a sole ordinary input when no blockee exists. Lost inputs are omitted without replacements. A group produces one accepted attack receipt and shared attack ID. Ordinary clocks use the input-time modified interval with no max-animation-scale cap; native slow-down already affects ASPD and is not multiplied twice. All three stat modes start at activation, matching the first sequence child and waitForCasting0. S1 holds its unscaled root Begin. S2/S3 fixed Begin casts opt into current slow-down and release captured fields at their original markers. Skill duration accounts from activation. Native End mixes apply only from the corresponding skill Idle; Loop-to-Idle does not invent an absent mix. Positive ordinary cooldown survives mode/cast/end transitions. S1 damage and its non-missable radial push use the source force operand independently, with the retained one-level off-axis/near-distance reduction relative to deployment facing.',
 limits:'Tile and resource contracts preserve their explicit mappings, including stack/barrier dispatch, flood enum/anchors and conveyor movement. Attack blackboard prefix scope, block-only versus base-input fallback, input-time interval capture, S1 radial off-axis force reduction, cast/FSM interruption and End gameplay lock remain local interpretations. Modules, native effects/audio, original game-frame/pixel parity and public combat admission are not certified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const due=(b,t)=>b.time+1e-7>=t;
export class ThumpyController{
 constructor(b,u,resources){this.b=b;this.u=u;this.resources=resources;this.record=resources.record;this.seq=null;this.stopped=false;
  this.phase=null;this.accepting=false;this.facing=u.dir;this.visualSeq=0;this.lastClip=null;this.handles=[];this.lastTiles=[];}
 get mode(){return this.resources.mode;}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){const face=this.facing==='UP'?'Back':'Front';return {...evidence.models[ID][face],...clocks.models[face]};}
 visual(clip,speed=1,loop=false){if(this.model().exactDurations[clip]==null)throw Error('Missing original Thumpy clip: '+clip);
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`thumpy:${this.seq}:${++this.visualSeq}`}:{})};}
 idle(){this.facing=this.u.dir;this.visual(this.mode?`Skill_${this.mode}_Idle`:'Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(){const{b,u}=this;if(b.rangeChanged(u))b._refreshRange(u);
  if([1,3].includes(this.mode)){const blocked=u.blocking.filter(t=>live(t)&&t.blockedBy===u&&canTargetEnemy(u,t,{canHitFly:false}));if(blocked.length)return blocked.slice(0,Math.max(1,u.s.blockCnt));}
  return acquireTargets(b,u,{...effectiveProfile(u),hitAllBlocked:false,maxTargetsByBlock:false,maxTargets:1,allInRange:false}).slice(0,1);
 }
 canCast(){return this.valid()&&live(this.u)&&this.u.canAct&&!this.u.skill.active&&!['begin','cast','end'].includes(this.phase?.kind);}
 start(){const{b,u,record:r}=this;this.facing=u.dir;this.lastTiles=[];this.resources.beginMode();if(!this.valid())return;
  const clip=`Skill_${r.index+1}_Begin`,m=this.model();
  if(r.index===0){this.phase={kind:'begin',until:b.time+m.exactDurations[clip]};this.visual(clip);}
  else{this.phase={kind:'cast',epoch:u.attackControlEpoch,lastAt:b.time,age:0,releaseAge:m.eventPayloads[clip][0].time,
   untilAge:m.exactDurations[clip],released:false};this.visual(clip,u.s.slowDownRate);}
 }
 end(){const mode=this.mode,last=this.lastClip;this.resources.endMode();if(!this.valid())return;this.phase=null;
  if(mode&&last===`Skill_${mode}_Idle`){const clip=`Skill_${mode}_End`;this.phase={kind:'end',until:this.b.time+this.model().exactDurations[clip]};this.visual(clip);}
  else this.idle();
 }
 admissible(targets){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm
  &&p?.kind==='attack'&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&p.mode===this.mode&&due(this.b,p.releaseAt)&&targets.length>0
  &&new Set(targets).size===targets.length&&targets.every(t=>live(t)&&p.inputs.some(i=>i.target===t&&i.seq===t.deploySeq));}
 release(profile,targets,info){if(!this.admissible(targets))return false;const p=this.phase;p.accepted=true;
  for(const t of targets){if(!this.valid()||this.phase!==p||this.mode!==p.mode)break;if(!live(t))continue;
   resolveHit(this.b,this.u,{...profile,dmgMul:null},t,info,t.x,t.y);
   if(p.mode===1&&this.valid()&&this.phase===p&&live(t))this.push(t);
  }return true;
 }
 push(t){const dx=t.x-this.u.x,dy=t.y-this.u.y,d=Math.hypot(dx,dy),[dr,dc]=this.u.fwd;
  const reduction=d<PUSH_DIRECTIONAL_MIN_DIST||dx*dc+dy*dr<d*Math.SQRT1_2?1:0;
  this.b.push(t,this.record.bb['attack@force']-reduction,{from:this.u});
 }
 releaseField(p){if(!this.valid()||this.phase!==p||!this.u.skill.active||this.mode<2)return;
  this.lastTiles=thumpyFieldTiles(this.b,this.u,this.record,{contract:THUMPY_TILE_CONTRACT});this.resources.releaseField(this.lastTiles);
 }
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(p?.kind==='begin'){if(!u.skill.active){this.phase=null;return;}if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(!live(u)||!u.canAct||(p?.kind!=='cast'&&u.s.flags.disarm)||(p?.epoch!=null&&p.epoch!==u.attackControlEpoch)){
   this.phase=null;if(this.valid())this.idle();return;
  }
  if(p?.kind==='born'||p?.kind==='end'){if(!due(b,p.until))return;this.phase=p=null;this.idle();}
  if(p?.kind==='cast'){
   if(!u.skill.active){this.phase=null;this.idle();return;}
   p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true);p.lastAt=b.time;u.mem.regularFormVisual.speed=u.s.slowDownRate;
   if(!p.released&&p.age+1e-7>=p.releaseAge){p.released=true;this.releaseField(p);}
   if(this.phase!==p||!this.valid())return;if(p.age+1e-7<p.untilAge)return;this.phase=p=null;this.idle();
  }
  if(p?.kind==='attack'){
   if(!p.released&&due(b,p.releaseAt)){p.released=true;
    const targets=p.inputs.filter(i=>live(i.target)&&i.seq===i.target.deploySeq&&canTargetEnemy(u,i.target,{canHitFly:false})).map(i=>i.target);
    if(targets.length){this.accepting=true;try{b.forceAttack(u,targets);}finally{this.accepting=false;}}
   }
   if(this.phase!==p||!this.valid()||!due(b,p.until))return;this.phase=p=null;
  }
  if(u.atkCd>1e-9)return;const targets=this.targets();if(!targets.length){this.idle();return;}
  this.face(targets[0]);const clip=this.mode?`Skill_${this.mode}_Loop`:'Attack',m=this.model(),speed=u.base.bat/u.s.interval,
   releaseAt=b.time+m.eventPayloads[clip][0].time/speed,period=Math.max(u.s.interval,releaseAt-b.time);
  this.phase={kind:'attack',startedAt:b.time,mode:this.mode,inputs:targets.map(target=>({target,seq:target.deploySeq})),epoch:u.attackControlEpoch,
   releaseAt,until:b.time+period,released:false,accepted:false};u.atkCd=period;this.visual(clip,speed);
 }
 spec(){return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},attack:{},
  canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()};}
 install(){if(this.handles.length||this.stopped)throw Error('Thumpy cannot be reinstalled');this.resources.install();
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;
   const until=this.b.time+this.model().exactDurations.Start;unit.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));}
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.resources.stop();this.phase=null;this.accepting=false;delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareThumpy(b,u,{contract}={}){
 if(contract!==THUMPY_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.thumpy)throw Error('Fresh selected Thumpy and explicit held contract required');
 const n=thumpyNativeInputs();for(let i=0;i<4;i++){
  const a=n.attacks[i];if(a._animKey!==(i?`Skill_${i}_Loop`:'Attack')||a._timeMode!==0||a._waitForAttackEvent!==1
   ||a._selectTargetTiming!==0||a._maxAnimScale!==-1||a._affectedBySlowDown!==1)throw Error('Changed Thumpy attack clock');
  if(a._selector.m_PathID!==([0,2].includes(i)?'0':[null,'8630917796889839233',null,'5869759644012398209'][i]))throw Error('Changed Thumpy attack selector binding');
 }
 for(let i=0;i<3;i++)if(n.skillRoots[i]._canCastDuringBorn!==1||n.skillRoots[i]._canSilenced!==0||n.skillRoots[i]._allowSpRecoveryWhenAffecting!==0)throw Error('Changed Thumpy skill account');
 if(n.skillRoots[0]._playSkillBeginAnim!==1||n.skillRoots[0]._beginAnim!=='Skill_1_Begin')throw Error('Changed Thumpy root Begin');
 for(let i=0;i<2;i++){
  const a=n.casts[i],sequence=n.sequences[i];if(a._animKey!==`Skill_${i+2}_Begin`||a._timeMode!==1||a._affectedBySlowDown!==1
   ||a._selectTargetTiming!==0||sequence._alwaysNext!==1||sequence._forceNextIfCastFail!==1
   ||sequence._abilities[0].m_PathID!==['-3361177735884366166','7640544926271961971'][i])throw Error('Changed Thumpy mode-before-tile sequence');
 }
 const push=n.templates.thumpy_s_1.eventToActions.ON_BUFF_START[0];
 if(push._useSourceDirection!==false||push._decreaseForceLevelWhenNotInDirection!==1)throw Error('Changed Thumpy radial push');
 if(n.attacks[1]._activeBuffs[0].templateKey!=='thumpy_s_1'||n.attacks[1]._activeBuffs[0].isDamageMissable!==0)throw Error('Changed Thumpy non-missable S1 push');
 const resources=prepareThumpyResources(b,u,{contract:THUMPY_RESOURCE_CONTRACT}),controller=new ThumpyController(b,u,resources);u.mem.thumpy=controller;
 return{record:resources.record,resources,controller,kit:{talents:[],install:null,skill:controller.spec(),trait:{noAttack:true,attackDrivenSkill:true,
  attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,
  hits:1,chain:null,splashRadius:0,windup:0,requiresAcceptedLaunch:true,
  acceptAreaAttack:(_b,_u,_p,targets)=>controller.admissible(targets),launchAreaAttack:(_b,_u,p,targets,info)=>controller.release(p,targets,info)}}};
}
