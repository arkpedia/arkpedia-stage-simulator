// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4203_kichi.json' with {type:'json'};
import clocks from '../../../data/arkpedia-kichi-clocks.json' with {type:'json'};
import {KICHI_ID as ID,selectedKichiBuild,selectedKichiTrait,kichiNativeInputs,kichiSourceComponent} from './arkpedia-kichi-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
import {acquireTargets,effectiveProfile,resolveHit} from '../ai.js';
import {canTargetEnemy} from '../targeting.js';
import {KichiResources} from './arkpedia-kichi-resources.js';
export const KICHI_CONTRACT=Object.freeze({
 scope:'Held original Kichisei ordinary/S1/S2 direct spread attacks, front-row mark, attack-count stacks, status cycle and unique-enemy output-damage talent; public/art admission is separate',
 reuse:'Shared regular-stage area attack receipts, body/range/target selection, stat buffs, physical damage, kill attribution and status resistance/immunity. No inherited Kichisei kit is present in the frozen data/chess.json snapshot.',
 mapping:'One accepted wave is one attack even for multiple victims. Select current bodies at release; apply front-row ATK scale before mitigation. S1 gains at most one stack after a wave. S2 samples one Slow/Bind/Stun phase for the whole wave and advances after it; its source status attachment is not damage-missable. Distinct enemy definition IDs add capped output-damage stacks. Use selected skill BAT addition as the nominal animation clock and sample nominal BAT/current interval at attack start. Cast Begin uses its full source clip; positive cooldown survives mode changes. Original Idle-to-Idle End mixes add no attack lock.',
 limits:'Compiled action/FSM/event aliases, same-wave kill ordering, source front-mark/body geometry, empty-release accounting, S1 dynamic stack cap, Begin/control/timed-duration dispatch, animation speed sampling and cooldown preservation remain explicit local mappings. Full Start represents birth. Modules, native particles/shaders/audio and original game-frame/pixel parity remain unverified.',
 frameParity:false,
});
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z),present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden,due=(b,t)=>b.time+1e-7>=t;
const models=Object.fromEntries(['Front','Back'].map(face=>[face,{...e.models[ID][face],durations:clocks.models[face].exactDurations}]));
function selected(u,contract){
 if(contract!==KICHI_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.kichi)throw Error('Fresh selected Kichisei and explicit contract required');
 const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedKichiBuild(build),t=selectedKichiTrait(build),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==build.skillId||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)||!same(u.def.traitBb,t.bb)
  ||!same(s.bb,r.bb)||s.spType!==normSpType(r.source.spData.spType)||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp
  ||s.maxCharges!==1||s.duration!==r.source.duration||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType
  ||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete Kichisei selected source');
 const n=kichiNativeInputs();
 for(const a of[n.ordinary,n.s1Attack,n.s2Attack]){
  const selector=kichiSourceComponent('characters',ID,a._selector.m_PathID);
  if(a._timeMode!==0||a._maxAnimScale!==-1||a._selectTargetTiming!==1||a._waitForAttackEvent!==1||a._interuptIfTargetDead!==0
   ||a._damageType!==1||selector._targetMotion!==3||selector._limitTargetNum!==0||selector._postFilter!==4)throw Error('Unreviewed Kichisei native attack');
 }
 if(n.s1._beginAnim!=='Skill_1_Begin'||n.s2._beginAnim!=='Skill_2_Begin'||n.s1._allowNoTarget!==1||n.s2._allowNoTarget!==1
  ||n.s1._resetAbilityCooldownWhenCastEnd!==0||n.s2._resetAbilityCooldownWhenCastEnd!==0||n.s2Attack._activeBuffs[0].isDamageMissable!==0
  ||n.templates['kichi_skchr_01[listener]'].eventToActions.ON_AFTER_ATTACK.length!==1
  ||n.templates['kichi_skchr_02[listener]'].eventToActions.ON_AFTER_ATTACK.length!==1)throw Error('Unreviewed Kichisei native skill/listener');
 return {record:r,trait:t,native:n};
}
export class KichiController{
 constructor(b,u,{record,trait,native}){this.b=b;this.u=u;this.record=record;this.trait=trait;this.native=native;
  this.resources=new KichiResources(this);this.seq=null;this.phase=null;this.facing=u.dir;this.handles=[];this.stopped=false;
  this.accepting=false;this.visualSeq=0;this.lastClip=null;this.mixUntil=0;}
 valid(){return!this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 mode(){return this.u.skill.active?this.record.index+1:0;}
 model(){return models[this.facing==='UP'?'Back':'Front'];}
 visual(clip,speed=1,loop=false){if(!Object.hasOwn(this.model().durations,clip))throw Error('Missing original Kichisei clip: '+clip);
  if(loop&&this.lastClip===clip&&this.u.mem.regularVisualDirection===this.facing)return;
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,
   ...(!loop?{playId:`kichi:${this.u.deploySeq}:${++this.visualSeq}`}:{})};}
 idle(){if(this.mixUntil>this.b.time+1e-7)return;this.facing=this.u.dir;const mode=this.mode(),next=mode?`Skill_${mode}_Idle`:'Idle';
  const rule=this.native.mixes.find(m=>m.sourceAnimName===this.lastClip&&m.targetAnimName===next);
  if(rule&&this.model().durations[rule.mixAnimName]!=null){this.mixUntil=this.b.time+this.model().durations[rule.mixAnimName];this.visual(rule.mixAnimName);return;}
  this.visual(next,1,true);}
 targets(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,effectiveProfile(this.u));}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 beginSkill(){this.phase=null;this.mixUntil=0;this.resources.resetSkill();this.facing=this.u.dir;const clip=`Skill_${this.record.index+1}_Begin`;
  this.phase={kind:'begin',until:this.b.time+this.model().durations[clip]};this.visual(clip);}
 endSkill(){this.phase=null;this.resources.resetSkill();this.mixUntil=0;if(this.valid())this.idle();}
 attack(t){this.face(t);this.mixUntil=0;const mode=this.mode(),nominal=this.u.base.bat+(mode?this.record.bb.base_attack_time:0),speed=nominal/this.u.s.interval;
  const clip=mode?this.facing==='DOWN'?`Skill_Down_${mode}_Loop`:`Skill_${mode}_Loop`:this.facing==='DOWN'?'Attack_Down':'Attack';
  const event=this.model().eventPayloads[clip].find(e=>e.name==='OnAttack');
  this.phase={kind:'attack',mode,activation:this.u.skill.activations,releaseAt:this.b.time+event.time/speed,
   until:this.b.time+this.u.s.interval,epoch:this.u.attackControlEpoch,released:false,accepted:false};this.u.atkCd=this.u.s.interval;this.visual(clip,speed);}
 admissible(targets){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm
  &&p?.kind==='attack'&&!p.accepted&&p.epoch===this.u.attackControlEpoch&&due(this.b,p.releaseAt)
  &&new Set(targets).size===targets.length&&targets.every(t=>this.targets().includes(t));}
 release(targets,info){if(!this.admissible(targets))return false;const p=this.phase;p.accepted=true;this.resources.syncMarks();
  const cycle=this.resources.cycle,profile=effectiveProfile(this.u);
  for(const target of targets){if(!this.valid())break;if(!canTargetEnemy(this.u,target,profile))continue;
   if(p.mode===2)this.resources.status(target,cycle);
   if(!this.valid())break;
   resolveHit(this.b,this.u,{...profile,atkScale:this.resources.frontScale(target)},target,info,target.x,target.y);
  }
  return true;
 }
 afterAttack(){const p=this.phase;if(p?.kind==='attack'&&p.accepted)this.resources.afterAttack(p.mode,p.activation);}
 tick(){if(!this.valid())return;const{b,u}=this;this.resources.syncMarks();let p=this.phase;
  if(this.mixUntil>0&&due(b,this.mixUntil)){this.mixUntil=0;this.idle();}
  if(!live(u)||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){
   if(!['born','begin'].includes(p?.kind))this.phase=null;this.idle();return;}
  if(p?.kind==='born'||p?.kind==='begin'){if(!due(b,p.until))return;this.phase=p=null;}
  if(p?.kind==='attack'){
   if(!p.released&&due(b,p.releaseAt)){p.released=true;this.accepting=true;try{b.forceAttack(u,this.targets(),{allowEmpty:true});}finally{this.accepting=false;}}
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;this.phase=null;
  }
  if(u.atkCd>1e-9){this.idle();return;}const targets=this.targets();if(targets.length)this.attack(targets[0]);else this.idle();
 }
 spec(){const r=this.record;return {kind:'duration',duration:r.source.duration,silenceable:false,trigger:{rule:'NEVER'},attack:{},
  mods:{batFlat:r.bb.base_attack_time,...(r.index===1?{atkPct:r.bb.atk}:{})},
  onStart:()=>this.beginSkill(),onEnd:()=>this.endSkill()};}
 install(){if(this.stopped||this.handles.length)throw Error('Kichisei cannot be reinstalled');
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;
   this.phase={kind:'born',until:this.b.time+this.model().durations.Start};unit.mem.regularBornUntil=this.phase.until;this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('kill',({killer,victim})=>this.resources.killed(killer,victim),{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));}
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;this.resources.clear();for(const h of this.handles)this.b.off(h);this.handles=[];
  delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareKichi(b,u,{contract}={}){
 const selection=selected(u,contract),controller=new KichiController(b,u,selection);u.mem.kichi=controller;
 return {...selection,controller,resources:controller.resources,kit:{talents:[],install:null,skill:controller.spec(),trait:{
  noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',canHitFly:true,allInRange:true,
  // Source-owned front marks replace the profession's default front predicate.
  maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,dmgMul:null,tags:['kichi:attack'],
  requiresAcceptedLaunch:true,acceptAreaAttack:(_b,_u,_p,ts)=>controller.admissible(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>controller.release(ts,info),
  afterAttack:()=>controller.afterAttack()}}};
}
