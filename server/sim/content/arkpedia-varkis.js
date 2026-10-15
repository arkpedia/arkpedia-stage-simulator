// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original-stage controller; public roster and artwork admission remain separate.
import e from '../../../data/arkpedia-native-operators/char_4166_varkis.json' with { type:'json' };
import { VARKIS_ID as ID, selectedVarkisBuild, varkisNativeInputs } from './arkpedia-varkis-source.js';
import { prepareVarkisResources, VARKIS_RESOURCE_CONTRACT } from './arkpedia-varkis-resources.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
export const VARKIS_CONTRACT=Object.freeze({
 scope:'Held original CN ordinary attacks, three-event S1, manual S2 and selected Minos talent; public admission remains separate',
 mapping:'Input-time targets retain their deployment identities. One accepted attack owns all three S1 event releases; subsequent strikes do not create extra attack/SP receipts. S1 holds SP until its third marker, or refunds on a wholly dead input before its first marker. S2 enters source mode after the unscaled Begin and restarts ordinary attack cadence; its thirty-second skill account starts at activation. One accepted S2 attack supplies one self-heal. Minos HP-ratio scaling runs in the shared pre-mitigation hit channel.',
 limits:'Numeric selector aliases and body geometry, cast/cooldown/FSM ordering, S1 refund/finish timing, S2 heal event alias, aura hidden-state/attachment ordering and native ES intermediaries are explicit mappings, not recovered compiled Unity dispatch. Elemental gauge output is not mapped to the Minos damage talent. Full Start represents birth. Modules, native particles/shaders/audio, game-frame/pixel parity and public artwork delivery remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const due=(b,t)=>b.time+1e-7>=t;
function selected(u,contract) {
 if(contract!==VARKIS_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.varkis)throw Error('Fresh selected Varkáris and explicit contract required');
 const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedVarkisBuild(build),s=u.def.skill,n=varkisNativeInputs();
 if(u.def.raw.arkpedia.skillId!==build.skillId||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType
  ||s.spType!==normSpType(r.source.spData.spType)||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp
  ||s.duration!==r.source.duration||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete selected Varkáris source');
 for(const [a,clip]of[[n.ordinary,'Attack'],[n.modeAttack,'Skill_2_Loop'],[n.burst,'Skill']])
  if(a._animKey!==clip||a._waitForAttackEvent!==1||a._selectTargetTiming!==0||a._timeMode!==0||a._maxAnimScale!==1)throw Error('Unreviewed Varkáris native attack');
 for(const s of[n.ordinarySelector,n.modeSelector,n.burstSelector])
  if(s._targetMotion!==1||s._limitedMaxTargetNumToBlockedCnt!==1||s._allowZeroBlockCntLimit!==0)throw Error('Unreviewed Varkáris native target cap');
 if(n.burst._additionalTimes!==2||n.burst._waitAttackEventForAllAttacks!==1||n.burst._refreshInputTargetOnCheckSpell!==0
  ||n.s1._recoverSpIfTargetDead!==1||n.s2._beginAnim!=='Skill_2_Begin'||n.s2._playSkillBeginAnim!==1
  ||n.s2._allowSpRecoveryWhenAffecting!==0||n.s2._attackBlackboardModeIndex!==1
  ||!same(n.talentValidator._tags,['minos'])||n.attackHeal._maxTarget!==1
  ||n.attackHeal._runActionOnEvent!==4||n.templates['varkis_s2[attack_add_hp]'].eventToActions.ON_BUFF_START[0]._ignoreHealFree!==false)
  throw Error('Unreviewed Varkáris native skill/talent inputs');
 return r;
}
export class VarkisController {
 constructor(b,u,r,resources){this.b=b;this.u=u;this.record=r;this.resources=resources;this.seq=null;this.phase=null;this.stopped=false;
  this.accepting=false;this.handles=[];this.facing=u.dir;this.visualSeq=0;this.lastClip=null;this.mixUntil=0;}
 valid(){return!this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 s2(){return this.record.index===1&&this.u.skill.active;}
 model(){return e.models[ID][this.facing==='UP'?'Back':'Front'];}
 visual(clip,speed=1,loop=false){if(this.model().durations[clip]==null)throw Error('Missing original Varkáris clip: '+clip);
  this.lastClip=clip;this.u.mem.regularVisualDirection=this.facing;
  this.u.mem.regularFormVisual={clip,speed,loop,...(!loop?{playId:`varkis:${this.u.deploySeq}:${++this.visualSeq}`}:{})};}
 idle(){if(this.mixUntil>this.b.time+1e-7)return;this.facing=this.u.dir;this.visual(this.s2()&&this.resources.mode===1?'Skill_2_Idle':'Idle',1,true);}
 face(t){const x=t.x-this.u.x,y=t.y-this.u.y;if(Math.hypot(x,y)>1e-8)this.facing=Math.abs(y)>Math.abs(x)?y>0?'UP':'DOWN':x<0?'LEFT':'RIGHT';}
 targets(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);return acquireTargets(this.b,this.u,effectiveProfile(this.u));}
 canCast(){return this.valid()&&live(this.u)&&this.u.canAct&&!this.u.skill.active
  &&(this.record.index===1||!this.u.s.flags.disarm&&!this.phase&&this.u.atkCd<=1e-9&&this.targets().length>0);}
 startS2(){this.facing=this.u.dir;this.mixUntil=0;this.u.atkCd=0;
  this.phase={kind:'begin',until:this.b.time+this.model().durations.Skill_2_Begin};this.visual('Skill_2_Begin');}
 endS2(){this.resources.setSourceMode(0);this.phase=null;this.u.atkCd=0;
  if(!this.valid())return;
  if(['Skill_2_Idle','Skill_2_Loop'].includes(this.lastClip)){this.mixUntil=this.b.time+this.model().durations.Skill_2_End;this.visual('Skill_2_End');}
  else{this.mixUntil=0;this.idle();}}
 inputs(p){return p.inputs.filter(({unit,seq})=>live(unit)&&unit.deploySeq===seq).map(x=>x.unit);}
 admissible(targets){const p=this.phase;return this.accepting&&this.valid()&&live(this.u)&&this.u.canAct&&!this.u.s.flags.disarm
  &&p?.kind==='attack'&&!p.accepted&&p.index===0&&p.epoch===this.u.attackControlEpoch
  &&(!p.s1||this.u.skill.active)&&p.s2===this.s2()&&due(this.b,p.events[0])&&targets.length>0&&new Set(targets).size===targets.length
  &&targets.every(t=>p.releaseTargets.includes(t));}
 strike(p,targets){for(const t of targets){if(!this.valid()||!live(this.u)||this.phase!==p)break;
  if(live(t))resolveHit(this.b,this.u,p.profile,t,p.info,t.x,t.y);}}
 release(profile,targets,info){if(!this.admissible(targets))return false;const p=this.phase;p.accepted=true;p.info=info;p.profile=profile;
  this.strike(p,targets);
  if(p.s2&&this.valid()&&this.phase===p)this.b.heal(this.u,this.u,this.u.s.maxHp*this.record.bb['attack@hp_ratio'],{tags:['varkis:s2-attack']});
  return true;}
 finishS1(p,refund=false){if(!p.s1||!this.u.skill.active)return;
  this.finishingS1=true;
  try{this.u.skill.end(refund?'dead-input-refund':'third-marker');}finally{this.finishingS1=false;}
  if(refund&&this.valid())this.u.skill.setSpTotal(this.u.skill.spTotal+this.u.skill.spCost);}
 talent({source,target,dmg}){const scale=this.record.talentBb[0]?.talent_atk_scale;
  if(!scale||!this.valid()||!live(this.u)||!live(source)||source.side!=='ally'||!live(target)||target.side!=='enemy'
   ||!source.tags.has('minos')||!this.b.allySelectable(source,this.u)||dmg.tags?.includes('hpLoss'))return;
  if(source.hp/source.s.maxHp>=target.hp/target.s.maxHp)dmg.amount*=scale;
 }
 tick(){if(!this.valid())return;const{b,u}=this;let p=this.phase;
  // Native S2 predelay is uninterruptible; mode entry still occurs while control blocks attacks.
  if(p?.kind==='begin'){if(!this.s2()){this.phase=null;return;}if(!due(b,p.until))return;
   this.resources.setSourceMode(1);this.phase=p=null;}
  if(!live(u)||!u.canAct||u.s.flags.disarm||p?.epoch!=null&&p.epoch!==u.attackControlEpoch){
   this.phase=null;this.mixUntil=0;if(p?.s1)this.finishS1(p);this.idle();return;}
  if(p?.kind==='born'){if(!due(b,p.until))return;this.phase=p=null;}
  if(p?.kind==='attack'){
   while(p.index<p.events.length&&due(b,p.events[p.index])&&this.phase===p&&this.valid()){
    const targets=this.inputs(p);
    if(p.index===0){p.releaseTargets=targets;this.accepting=true;
     try{if(targets.length)b.forceAttack(u,targets);}finally{this.accepting=false;}
     if(p.s1&&!targets.length){this.finishS1(p,true);this.phase=null;return;}}
    else if(p.accepted)this.strike(p,targets);
    p.index++;if(p.s1&&p.index===p.events.length)this.finishS1(p);
   }
   if(!this.valid()||this.phase!==p||!due(b,p.until))return;this.phase=p=null;
  }
  if(this.mixUntil>0&&due(b,this.mixUntil)){this.mixUntil=0;this.idle();}
  if(u.atkCd>1e-9)return;const targets=this.targets();if(!targets.length){this.idle();return;}
  if(this.record.index===0&&u.skill.ready&&this.canCast())u.skill.activate('DEFAULT');
  this.face(targets[0]);this.mixUntil=0;const s1=this.record.index===0&&u.skill.active,s2=this.s2();
  const clip=s1?'Skill':s2?'Skill_2_Loop':this.facing==='DOWN'?'Attack_Down':'Attack',speed=Math.min(1,u.base.bat/u.s.interval);
  const events=this.model().eventPayloads[clip].filter(x=>x.name==='OnAttack').map(x=>b.time+x.time/speed);
  const period=Math.max(u.s.interval,events.at(-1)-b.time);
  this.phase={kind:'attack',s1,s2,inputs:targets.map(unit=>({unit,seq:unit.deploySeq})),events,index:0,epoch:u.attackControlEpoch,
   until:b.time+period,accepted:false,releaseTargets:[]};u.atkCd=period;this.visual(clip,speed);
 }
 spec(){return this.record.index===0?{kind:'instant',silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},attack:{atkScale:this.record.bb.atk_scale},
  completeOnAttack:false,canActivate:()=>this.canCast(),onEnd:()=>{
   if(this.finishingS1)return;this.phase=null;this.mixUntil=0;if(this.valid())this.idle();}}
  :{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},attack:{atkScale:this.record.bb['attack@s2_atk_scale']},
   canActivate:()=>this.canCast(),onStart:()=>this.startS2(),onEnd:()=>this.endS2()};}
 install(){if(this.handles.length||this.stopped)throw Error('Varkáris cannot be reinstalled');this.resources.install();
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;this.facing=unit.dir;
   const until=this.b.time+this.model().durations.Start;unit.mem.regularBornUntil=until;this.phase={kind:'born',until};this.visual('Start');},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('hit',ctx=>this.talent(ctx),{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));}
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.resources.stop();this.phase=null;this.accepting=false;delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
}
export function prepareVarkis(b,u,{contract}={}){
 const record=selected(u,contract),resources=prepareVarkisResources(b,u,{contract:VARKIS_RESOURCE_CONTRACT}),controller=new VarkisController(b,u,record,resources);
 u.mem.varkis=controller;
 return{record,controller,resources,kit:{talents:[],install:null,skill:controller.spec(),
  trait:{noAttack:true,attackDrivenSkill:true,attack:'melee',dmgType:'phys',projectile:'none',canHitFly:false,
   maxTargetsByBlock:true,allowZeroBlockTargetLimit:false,hitAllBlocked:false,allInRange:false,hits:1,chain:null,splashRadius:0,windup:0,
   requiresAcceptedLaunch:true,acceptAreaAttack:(_b,_u,_p,targets)=>controller.admissible(targets),
   launchAreaAttack:(_b,_u,p,targets,info)=>controller.release(p,targets,info)}}};
}
