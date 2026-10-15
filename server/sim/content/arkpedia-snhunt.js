// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4211_snhunt.json' with {type:'json'};
import clocks from '../../../data/arkpedia-snhunt-clocks.json' with {type:'json'};
import {SNHUNT_ID as ID,selectedSnhuntBuild,selectedSnhuntTrait,snhuntNativeInputs} from './arkpedia-snhunt-source.js';
import {HunterMagazine} from './arkpedia-hunter-magazine.js';
import {SnhuntProjectiles} from './arkpedia-snhunt-projectiles.js';
import tier3 from './kits/tier3.js';
import {normalizeChess,normSpType} from '../simdata.js';
import {acquireTargets,effectiveProfile} from '../ai.js';
export const SNHUNT_CONTRACT=Object.freeze({
 scope:'Held original Snow Hunter magazine, ordinary/S1/S2 projectiles and beast/cold effects; public admission remains separate',
 reuse:'Shared bounded hunter magazine, inherited Stronghold S1 spec/coefficient and existing targeting/projectile/damage/status pipelines. Seasonal automatic S2/module and instant beast handlers are not installed.',
 mapping:'Current targets are selected at ordinary/S1 release and separately at both S2 launches. S2 preserves the magazine and uses the native additional-launch interval instead of the second visual marker. Sample base-BAT/current-interval speed at cast start; reload uses an unscaled 1.6-second loop. Its eventless refill maps to loop completion, not an invented Spine event. Beast uses a fixed one-tenth-second attached projectile and skips the actor trait scale. Current same-life ATK is read at impact; a retired source uses its launch snapshot and original ledger. Born shots survive skill end/source departure. A finite visual End mix adds no attack lock.',
 limits:'Numeric selector/trigger/event aliases, compiled reload fallback, stay-still classification, input/launch ordering, SP/refund/FSM clocks, speed sampling, two-dimensional root/muzzle geometry and source-only modifier dispatch remain explicit local mappings. Full Start represents birth. Float32 one-tenth lifetime maps to its exact tick boundary. Modules, native particles/shaders/audio and game-frame/pixel parity remain unverified. Public admission and original artwork compatibility are reviewed separately.',
 frameParity:false,
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const due=(b,t)=>b.time+1e-7>=t;
const models=Object.fromEntries(['Front','Back'].map(face=>[face,{...e.models[ID][face],durations:clocks.models[face].exactDurations}]));
function select(u,contract){
 if(contract!==SNHUNT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.snhunt)throw Error('Fresh selected Snow Hunter and explicit contract required');
 const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedSnhuntBuild(build),t=selectedSnhuntTrait(build),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==build.skillId||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)||!same(u.def.traitBb,t.bb)
  ||!same(s.bb,r.bb)||s.spType!==normSpType(r.source.spData.spType)||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp
  ||s.maxCharges!==r.source.spData.maxChargeTime||s.duration!==r.source.duration||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType
  ||!same(s.rangeGrid??[],r.skillRangeGrid)||![4,6,8].includes(t.bb.value)||t.bb.atk_scale!==1.2)throw Error('Incomplete selected Snow Hunter source');
 const n=snhuntNativeInputs();
 for(const a of[n.ordinaryA,n.ordinaryB,n.s1Shot])if(a._timeMode!==0||a._selectTargetTiming!==1||a._maxAnimScale!==-1||a._useCachedAtkOnly!==0)throw Error('Unreviewed Snow Hunter ordinary/S1 clock');
 if(n.reload._timeMode!==1||n.s1Shot._animKey!=='Skill_1'||n.s1._allowSpRecoveryWhenAffecting!==0||n.s1._recoverSpIfTargetDead!==1
  ||n.s2Shot._additionalTimes!==1||n.s2Shot._triggerDelta!==.18000000715255737||n.s2Shot._waitAttackEventForAllAttacks!==0
  ||n.s2Shot._selectTargetTiming!==2||n.s2._allowSpRecoveryWhenAffecting!==0||n.s2._allowNoTarget!==0
  ||n.s2._canCastDuringBorn!==1||n.beast._alwaysHitTraceTargetInTheEnd!==1||Math.abs(n.beast._lifeTime-.1)>1e-7)throw Error('Unreviewed Snow Hunter native skill clock');
 for(const p of[n.ordinaryProjectile,n.s1Projectile,n.s2Projectile])if(p._lifeTime!==10||p._stopWhenSourceInvalid!==0||p._alwaysHitTraceTargetInTheEnd!==1)throw Error('Unreviewed Snow Hunter native projectile');
 for(const m of[n.ordinaryMotion,n.s1Motion,n.s2Motion])if(m._speed!==10)throw Error('Unreviewed Snow Hunter native projectile speed');
 return{record:r,trait:t,native:n};
}
export class SnhuntController{
 constructor(b,u,{record,trait,native},upstream){this.b=b;this.u=u;this.record=record;this.trait=trait;this.native=native;this.upstream=upstream;
  this.magazine=new HunterMagazine(trait.bb.value);this.projectiles=new SnhuntProjectiles(this);this.seq=null;this.phase=null;this.stopped=false;
  this.handles=[];this.facing=u.dir;this.chain=false;this.reloadFlag=false;this.resetAt=null;this.accepting=false;this.visualSeq=0;this.lastClip=null;this.mixUntil=0;}
 valid(){return!this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){return models[['UP','LEFT'].includes(this.facing)?'Back':'Front'];}
 clip(part,suffix){return`${part}${this.facing==='DOWN'?'_Down':''}_${suffix}`;}
 visual(clip,speed=1,loop=false){if(!Object.hasOwn(this.model().durations,clip))throw Error('Missing original Snow Hunter clip: '+clip);
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;this.u.mem.regularFormVisual={clip,speed,loop,
   ...(!loop?{playId:`snhunt:${this.u.deploySeq}:${++this.visualSeq}`}:{})};}
 idle(mix=false){if(this.mixUntil>this.b.time+1e-7)return;
  const rule=mix&&this.native.mixes.find(m=>m.sourceAnimName===this.lastClip&&m.targetAnimName==='Idle');
  if(rule&&this.model().durations[rule.mixAnimName]!=null){this.mixUntil=this.b.time+this.model().durations[rule.mixAnimName];this.visual(rule.mixAnimName);return;}
  this.facing=this.u.dir;this.visual('Idle',1,true);}
 face(t){if(!t)return;const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,effectiveProfile(this.u)).slice(0,1);}
 canCast(){return this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active&&this.targets().length>0
  &&(this.record.index===1||!this.phase&&this.u.atkCd<=1e-9&&this.magazine.bullets>0);}
 beast(){if(this.record.talentBb.length){const target=this.targets()[0];if(target)this.projectiles.emit(target,'beast');}}
 startS2(){this.chain=false;this.mixUntil=0;this.resetAt=null;this.face(this.targets()[0]);const speed=this.u.base.bat/this.u.s.interval;
  // Skill_Down_2 and Skill_2 have a different naming order from ordinary/reload clips.
  const begin=this.facing==='DOWN'?'Skill_Down_2_Begin':'Skill_2_Begin';
  this.phase={kind:'s2-begin',epoch:this.u.attackControlEpoch,speed,until:this.b.time+this.model().durations[begin]/speed};this.visual(begin,speed);this.beast();}
 finishSkill(reason,refund=false){this.finishing=true;try{this.u.skill.end(reason);}finally{this.finishing=false;}
  if(refund&&this.valid())this.u.skill.setSpTotal(this.u.skill.spTotal+this.u.skill.spCost);}
 skillEnded(){if(this.finishing)return;this.phase=null;this.chain=false;this.mixUntil=0;if(this.valid())this.idle(true);}
 startS1(){this.phase=null;this.mixUntil=0;this.resetAt=null;this.chain=false;this.face(this.targets()[0]);
  const clip=this.facing==='DOWN'?'Skill_Down_1':'Skill_1',speed=this.u.base.bat/this.u.s.interval;
  this.phase={kind:'fire',s1:true,speed,releaseAt:this.b.time+this.model().eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed,
   until:this.b.time+Math.max(this.u.s.interval,this.model().durations[clip]/speed),epoch:this.u.attackControlEpoch,released:false,born:false};
  this.u.atkCd=this.phase.until-this.b.time;this.visual(clip,speed);this.beast();}
 startFire(target){this.face(target);this.mixUntil=0;this.resetAt=null;
  if(this.record.index===0&&this.u.skill.ready&&this.canCast()){
   this.u.skill.activate('DEFAULT');return;
  }
  const speed=this.u.base.bat/this.u.s.interval,begin=this.clip(this.reloadFlag?'Reload':'Attack',this.reloadFlag?'Break':'Begin');
  if(!this.chain){this.phase={kind:'fire-begin',speed,until:this.b.time+this.model().durations[begin]/speed,epoch:this.u.attackControlEpoch};this.visual(begin,speed);}
  else this.fireLoop(speed);
  this.chain=true;
 }
 fireLoop(speed){const clip=this.clip('Attack','Loop'),event=this.model().eventPayloads[clip].find(e=>e.name==='OnAttack');
  this.phase={kind:'fire',s1:false,speed,releaseAt:this.b.time+event.time/speed,until:this.b.time+this.u.s.interval,
   epoch:this.u.attackControlEpoch,released:false,born:false};this.u.atkCd=this.u.s.interval;this.visual(clip,speed,false);}
 startReload(first=true){if(this.magazine.bullets>=this.magazine.capacity){this.phase=null;this.idle(true);return;}
  this.facing=this.u.dir;this.chain=false;this.reloadFlag=true;this.resetAt=null;this.mixUntil=0;const clip=this.clip('Reload',first?'Begin':'Loop');
  this.phase={kind:first?'reload-begin':'reload',until:this.b.time+this.model().durations[clip],epoch:this.u.attackControlEpoch};this.visual(clip,1,false);}
 admissible(targets){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm
  &&p?.kind==='fire'&&!p.born&&p.epoch===this.u.attackControlEpoch&&due(this.b,p.releaseAt)&&targets.length===1
  &&targets[0]===p.releaseTarget&&this.magazine.bullets>0;}
 release(targets,info){if(!this.admissible(targets)||!this.magazine.consume())return false;const p=this.phase;p.born=true;
  if(p.s1)this.reloadFlag=false;this.projectiles.emit(targets[0],p.s1?'s1':'ordinary',info);return true;}
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(this.mixUntil>0&&due(b,this.mixUntil)){this.mixUntil=0;this.idle();}
  if(this.resetAt!=null&&due(b,this.resetAt)&&!p){this.reloadFlag=false;this.resetAt=null;}
  if(!live(u)||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){
   if(p||this.chain){this.phase=null;this.chain=false;if(u.skill.active)this.finishSkill('interrupted');this.resetAt=this.reloadFlag?b.time+.2:null;}
   this.idle(true);return;}
  if(p?.kind==='born'){if(!due(b,p.until))return;this.phase=p=null;}
  if(p?.kind==='s2-begin'){
   if(!due(b,p.until))return;const clip=this.facing==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop';
   const first=this.model().eventPayloads[clip].find(e=>e.name==='OnAttack').time/p.speed;
   this.phase=p={kind:'s2',speed:p.speed,index:0,events:[b.time+first,b.time+first+this.native.s2Shot._triggerDelta/p.speed],
    until:b.time+this.model().durations[clip]/p.speed,epoch:u.attackControlEpoch};this.visual(clip,p.speed);
  }
  if(p?.kind==='s2'){
   while(p.index<2&&due(b,p.events[p.index])&&this.valid()&&this.phase===p){const t=this.targets()[0];
    if(t)this.projectiles.emit(t,'s2',{attackId:p.attackId??(p.attackId=++b._attackSeq)});p.index++;}
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;
   this.phase=null;this.finishSkill('special-finished');this.idle(true);return;
  }
  const target=this.targets()[0];
  if(p?.kind.startsWith('reload')&&target&&this.magazine.bullets>0){this.phase=null;this.startFire(target);return;}
  if(p?.kind==='fire'){
   if(!p.released&&due(b,p.releaseAt)){
    p.released=true;p.releaseTarget=target;this.accepting=true;
    try{if(target)b.forceAttack(u,[target]);}finally{this.accepting=false;}
    if(p.s1)this.finishSkill(p.born?'arrow-born':'dead-input',!p.born);
   }
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;this.phase=null;
   this.chain=!p.s1;
  }else if(p?.kind==='fire-begin'){
   if(!due(b,p.until))return;this.fireLoop(p.speed);return;
  }else if(p?.kind==='reload-begin'){
   if(!due(b,p.until))return;this.startReload(false);return;
  }else if(p?.kind==='reload'){
   if(!due(b,p.until))return;this.magazine.refill();this.phase=null;
   if(target&&this.magazine.bullets>0){this.startFire(target);return;}
   if(this.magazine.bullets<this.magazine.capacity)this.startReload(false);
   else{this.resetAt=b.time+.2;this.idle(true);}return;
  }
  if(this.phase)return;
  if(target&&this.magazine.bullets>0&&u.atkCd<=1e-9)this.startFire(target);
  else if(this.magazine.bullets<this.magazine.capacity&&(!target||this.magazine.bullets===0))this.startReload();
  else this.idle(true);
 }
 spec(){const common={silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},completeOnAttack:false,canActivate:()=>this.canCast(),onEnd:()=>this.skillEnded()};
  return this.record.index===0?{...this.upstream,...common,pendingText:'Skill active · Power strike',onStart:()=>this.startS1()}
   :{...common,kind:this.record.source.spData.maxChargeTime>1?'charges':'instant',attack:{},pendingText:'Skill active · Special bullets',onStart:()=>this.startS2()};}
 install(){if(this.stopped||this.handles.length)throw Error('Snow Hunter cannot be reinstalled');
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;
   this.phase={kind:'born',until:this.b.time+this.model().durations.Start};unit.mem.regularBornUntil=this.phase.until;this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));}
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;this.magazine.remove();this.projectiles.retire();
  if(this.b.finished)this.projectiles.clear();for(const h of this.handles)this.b.off(h);this.handles=[];
  delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareSnhunt(b,u,{contract}={}){
 const selected=select(u,contract),r=selected.record;
 const inherited=tier3.chess_char_3_11_a(r.bb,u.def.raw,u.def).skills.skchr_snhunt_1;
 // S1's selected coefficient is reused. S2 owns a different native cast/projectile controller.
 const s1=r.index===0?inherited:null;
 if(r.index===0&&(s1.kind!=='instant'||s1.attack.atkScale!==r.bb.atk_scale))throw Error('Changed inherited Snow Hunter S1 spec');
 const controller=new SnhuntController(b,u,selected,s1);u.mem.snhunt=controller;u.mem.snhuntMagazine=controller.magazine;
 return{...selected,controller,magazine:controller.magazine,kit:{talents:[],install:null,skill:controller.spec(),
  trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',canHitFly:true,
   maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,chain:null,splashRadius:0,windup:0,
   requiresAcceptedLaunch:true,acceptAreaAttack:(_b,_u,_p,targets)=>controller.admissible(targets),
   launchAreaAttack:(_b,_u,_p,targets,info)=>controller.release(targets,info)}}};
}
