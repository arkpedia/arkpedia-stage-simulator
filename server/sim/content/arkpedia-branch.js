// SPDX-License-Identifier: GPL-3.0-or-later
// Reuses the inherited GPL Stronghold Vetochki factory; original-stage differences are explicit below.
import e from '../../../data/arkpedia-native-operators/char_4207_branch.json' with { type: 'json' };
import tier2 from './kits/tier2.js';
import { BRANCH_ID as ID, selectedBranchBuild, branchNativeInputs } from './arkpedia-branch-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { enemiesInGrid } from './kits/tier1.js';
export const BRANCH_CONTRACT = Object.freeze({
 scope:'Selected source Vetochki S1/S2 and reused Stronghold stat buffs, resistance and skill-end heal; public admission is checked by its separate runtime receipt',
 reuse:'Stronghold tier2 chess_char_2_17_a factory, its S1 resistance callback, both stat-modifier specs, its skill-end healing calculation, target selection and core hit pipeline. S2 pulse timing/selection and native attack clocks are adapted; no seasonal module or fallback kit is enabled.',
 limits:'Native enum aliases, root/body tile geometry, input/strike selection timing, cooldown/FSM dispatch and marker consumption at accepted initial pulse are simulator mappings. Windup speed is sampled at cast start; full Start represents birth because the compiled Born clock is not recovered. Removing or hiding the caster cancels unlaunched actions; an already applied Tremble keeps its own lifetime. The native damage-missable zero-damage pulse dispatch is not recovered; the selected non-damage pulse applies status without inventing an independent dodge roll. Native compiled transitions, particles/audio/modules and original frame/pixel parity remain unverified. Public source/art/browser admission is separate.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Native animation inputs are float32; tolerate their sub-microsecond conversion when sampling a fixed tick.
const due=(b,t)=>b.time+1e-7>=t;
function selected(u,contract){
 if(contract!==BRANCH_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.branch)throw Error('Fresh selected Vetochki and explicit contract required');
 const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedBranchBuild(build),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==build.skillId
  ||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)
  ||!same(u.def.talents.map(t=>t.bb),r.talentBb)||!same(s.bb,r.bb)||s.skillType!==r.source.skillType
  ||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration
  ||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete selected Vetochki source');
 const n=branchNativeInputs();
 if(n.ordinary._animKey!=='Attack'||n.ordinary._maxAnimScale!==1||n.ordinary._selectTargetTiming!==0
  ||n.modeAttack._animKey!=='Skill_2_Loop'||n.modeAttack._maxAnimScale!==1||n.modeAttack._selectTargetTiming!==1
  ||n.modeSelector._limitedMaxTargetNumToBlockedCnt!==1||n.modeSelector._allowZeroBlockCntLimit!==0
  ||n.first._animKey!=='Skill_2_Begin'||n.first._maxAnimScale!==1||n.first._allowNoTarget!==1
  ||n.pulse._waitForAttackEvent!==0||n.pulse._animKey!==''||n.pulse._timeMode!==2
  ||n.pulse._activeBuffs[0].buffKey!=='disarmed_combat'||n.pulse._activeBuffs[0].loadFromDB!==1
  ||n.pulseSelector._targetMotion!==1||n.pulseSelector._limitTargetNum!==0
  ||n.ordinary._timeMode!==0||n.modeAttack._timeMode!==0||n.first._timeMode!==0
  ||n.markerEnd._runActionOnEvent!==2
  ||JSON.parse(n.first._actions.SerializedState)[0]._abilityName!=='SpAttack'
  ||JSON.parse(n.markerEnd._actions.SerializedState)[0]._buffKey!=='branch_s_2[first]'
  ||n.s2._playSkillBeginAnim!==0||n.s2._attackBlackboardModeIndex!==-1
  ||!same(n.tremble.attributes.abnormalFlags,['DISARMED_COMBAT'])
  ||n.resistance.attributes.attributeModifiers[0].attributeType!=='ONE_MINUS_STATUS_RESISTANCE'
  ||n.resistance.attributes.attributeModifiers[0].formulaItem!=='FINAL_SCALER'
  ||n.talent._ignoreHealFree!==true||n.talent._skipModifierEvent!==false||n.talent._getMaxHpFromTarget!==false
  ||n.talent._healTarget!=='BUFF_OWNER'||n.passive._buffs[0].buffKey!=='unhealable'
  ||n.s1._allowSpRecoveryWhenAffecting!==0||n.s2._allowSpRecoveryWhenAffecting!==0
  ||n.s1._canCastDuringBorn!==1||n.s2._canCastDuringBorn!==1
  ||n.resistance.overrideKey!=='status_resistance[bonus]'||n.tremble.durationKey!=='not_combat'
  ||!same(n.mixes.map(m=>[m.sourceAnimName,m.targetAnimName,m.mixAnimName]),[
   ['Skill_2_Idle','Idle','Skill_2_End'],['Skill_2_Loop','Idle','Skill_2_End']]))throw Error('Unreviewed Vetochki native inputs');
 return r;
}
export class BranchController{
 constructor(b,u,r,upstream){this.b=b;this.u=u;this.record=r;this.upstream=upstream;this.seq=null;this.phase=null;this.stopped=false;
  this.handles=[];this.facing=u.dir;this.visualSeq=0;this.lastClip=null;this.firstPending=false;this.accepting=false;this.mixUntil=0;}
 valid(){return!this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 model(){return e.models[ID][this.facing==='UP'?'Back':'Front'];}
 s2(){return this.record.index===1&&this.u.skill.active;}
 visual(clip,speed=1,loop=false){if(this.model().durations[clip]==null)throw Error('Missing original Vetochki clip: '+clip);
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`branch:${this.u.deploySeq}:${++this.visualSeq}`}:{})};}
 idle(){if(this.mixUntil>this.b.time+1e-8)return;this.facing=this.u.dir;this.visual(this.s2()?'Skill_2_Idle':'Idle',1,true);}
 face(t){if(!t)return;const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,effectiveProfile(this.u));}
 admissible(targets){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm
  &&p?.kind==='attack'&&!p.accepted&&due(this.b,p.releaseAt)&&p.epoch===this.u.attackControlEpoch
  &&p.skill===this.s2()&&targets.length>0&&new Set(targets).size===targets.length
  &&targets.every(t=>p.releaseTargets.includes(t));}
 release(profile,targets,info){if(!this.admissible(targets))return false;this.phase.accepted=true;let emitted=false;
  for(let i=0;i<targets.length&&this.valid();i++){
   const t=targets[i];if(!t.alive||!t.deployed||t.hidden)continue;
   resolveHit(this.b,this.u,profile,t,{...info,index:i},t.x,t.y);emitted=true;
  }return emitted;}
 beginS1(ctx){const key=`branch:s1:resist:${this.u.id}`;
  const view={applyStatus:(target,status,options)=>{if(target!==this.u||status!=='resist')throw Error('Unreviewed upstream Vetochki resistance');
   return this.b.applyStatus(target,status,{...options,key});}};
  this.upstream.skills.skchr_branch_1.onStart({...ctx,battle:view});
 }
 endS1(){this.b.removeBuff(this.u,`branch:s1:resist:${this.u.id}`);}
 beginS2(){this.firstPending=true;this.phase=null;this.mixUntil=0;this.u.atkCd=0;this.beginFirst();}
 beginFirst(){this.facing=this.u.dir;this.mixUntil=0;const speed=Math.min(1,this.u.base.bat/this.u.s.interval),clip='Skill_2_Begin';
  this.phase={kind:'first',startedAt:this.b.time,epoch:this.u.attackControlEpoch,
   releaseAt:this.b.time+this.model().eventPayloads[clip].find(x=>x.name==='OnAttack').time/speed,
   until:this.b.time+this.model().durations[clip]/speed,released:false};this.visual(clip,speed);}

 endS2(){this.firstPending=false;this.phase=null;
  if(!this.valid())return;
  // The original art controller has these two literal transition mixes only.
  if(['Skill_2_Loop','Skill_2_Idle'].includes(this.lastClip)){
   this.mixUntil=this.b.time+this.model().durations.Skill_2_End;this.visual('Skill_2_End');
  }else{this.mixUntil=0;this.idle();}}
 pulse(){for(const t of enemiesInGrid(this.b,this.u,this.record.skillRangeGrid,{canHitFly:false,groundOnly:true})){
  if(!this.valid()||!this.s2())break;
  this.b.applyStatus(t,'tremble',{duration:this.record.bb.not_combat,source:this.u});
 }}
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  if(!live(u)||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){this.phase=null;this.mixUntil=0;this.idle();return;}
  if(p?.kind==='born'){if(!due(b,p.until))return;this.phase=p=null;}
  if(p?.kind==='first'){
   if(!this.s2()){this.phase=null;return;}
   if(!p.released&&due(b,p.releaseAt)){p.released=true;this.firstPending=false;this.pulse();}
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;this.phase=p=null;
  }
  if(p?.kind==='attack'){
   if(!p.released&&due(b,p.releaseAt)){
    p.released=true;const targets=p.skill?this.targets():p.inputs.filter(t=>t.unit.deploySeq===t.seq&&t.unit.alive&&t.unit.deployed&&!t.unit.hidden).map(t=>t.unit);
    p.releaseTargets=targets;this.accepting=true;
    try{if(targets.length)b.forceAttack(u,targets);}finally{this.accepting=false;}
   }
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;this.phase=p=null;
  }
  if(this.firstPending&&this.s2()){
   this.beginFirst();return;
  }
  if(this.mixUntil>0&&due(b,this.mixUntil)){this.mixUntil=0;this.idle();}
  if(u.atkCd>1e-9)return;const targets=this.targets();if(!targets.length){this.idle();return;}
  this.face(targets[0]);this.mixUntil=0;const skill=this.s2(),clip=skill?'Skill_2_Loop':'Attack',speed=Math.min(1,u.base.bat/u.s.interval);
  const hit=this.model().eventPayloads[clip].find(x=>x.name==='OnAttack').time/speed,period=Math.max(u.s.interval,hit);
  this.phase={kind:'attack',skill,epoch:u.attackControlEpoch,inputs:targets.map(unit=>({unit,seq:unit.deploySeq})),
   releaseAt:b.time+hit,until:b.time+period,released:false,accepted:false,releaseTargets:[]};
  u.atkCd=period;this.visual(clip,speed);
 }
 install(){if(this.handles.length||this.stopped)throw Error('Vetochki cannot be reinstalled');
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;
   const until=this.b.time+this.model().durations.Start;unit.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));
  // Keep the original upstream talent calculation/listener. This narrow view
  // adapts its native ignoreHealFree flag and retirement eligibility explicitly.
  const view={on:(name,fn,options)=>{if(name!=='skillEnd')throw Error('Unreviewed upstream Vetochki listener');
   const h=this.b.on(name,ctx=>{if(this.valid()&&live(this.u))fn(ctx);},options);this.handles.push(h);return h;},
   heal:(source,target,amount,options)=>{if(source!==this.u||target!==this.u||!options?.tags?.includes('talent'))throw Error('Unreviewed upstream Vetochki heal');
    return this.b.heal(source,target,amount,{...options,ignoreHealFree:true});}};
  try{for(const talent of this.upstream.talents)talent.install(view,this.u);}catch(error){this.stop();throw error;}
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];this.phase=null;this.firstPending=false;
  delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareBranch(b,u,{contract}={}){
 const r=selected(u,contract),upstream=tier2.chess_char_2_17_a(r.bb,{...u.def.raw,talents:u.def.talents,trait:{bb:{}}},u.def);
 const source=r.index===0?upstream.skills.skchr_branch_1:upstream.skill;
 if(upstream.talents.length!==1||source.kind!=='duration'||typeof source.onStart!=='function'
  ||!same(source.mods,r.index===0?{defPct:r.bb.def}:{atkPct:r.bb.atk,defPct:r.bb.def}))throw Error('Changed upstream Vetochki spec');
 const c=new BranchController(b,u,r,upstream);u.mem.branch=c;
 const skill={...source,duration:r.source.duration,silenceable:false,trigger:{rule:'NEVER'},
  canActivate:()=>c.valid()&&live(u)&&u.canAct,
  ...(r.index===1?{attack:{hitAllBlocked:false,maxTargetsByBlock:true,allowZeroBlockTargetLimit:false},onStart:()=>c.beginS2(),onEnd:()=>c.endS2()}
   :{onStart:ctx=>c.beginS1(ctx),onEnd:()=>c.endS1()}),};
 return{record:r,controller:c,upstream,kit:{talents:[],install:null,skill,
  trait:{noAttack:true,attackDrivenSkill:true,noHeal:true,attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,
   maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,chain:null,splashRadius:0,windup:0,requiresAcceptedLaunch:true,
   acceptAreaAttack:(_b,_u,_p,targets)=>c.admissible(targets),launchAreaAttack:(_b,_u,p,targets,info)=>c.release(p,targets,info)}}};
}
