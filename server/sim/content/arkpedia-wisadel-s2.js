// SPDX-License-Identifier: GPL-3.0-or-later
// Private S2 adapter. Shadows/S3 and public lifecycle remain separate gates.
import evidence from '../../../data/arkpedia-wisadel-prefabs.json' with {type:'json'};
import { WisadelAttackController,validateWisadelSelection } from './arkpedia-wisadel-attacks.js';
import { canTargetEnemy } from '../targeting.js';

export const WISADEL_S2_CONTRACT=Object.freeze({
  selection:'strike-time priority selection of three normal targets; four overload emissions independently select uniform current ground targets with replacement',
  clocks:'two source-duration phases; original begin/overload/end clips; capped captured loop playback drives OnAttack and additional .1 emissions; independent BAT cooldown',
  projectile:'mount-to-root birth alias; .1 start delay then separate main/half-strength splash after .15; live ATK with captured emission coefficient',
  interruption:'control, mode exit and owner finish cancel unborn emissions; already-born projectiles survive; battle finish cancels all outputs',
  sp:'time SP; no automatic activation or SP recovery during either active phase; one attack event per accepted volley',
  limits:'Source-selected S2 component of the full no-module kit. Modules and original effects/audio remain unverified. Selection dispatch, uniform RNG ordering, mount geometry, animation/event/cooldown/FSM clocks and receipt order are local mappings; compiled Unity frame parity is unverified.',
  frameParity:false,
});
const components=Object.values({...evidence.characters,...evidence.skills,...evidence.projectiles})
  .flatMap(rows=>rows.flatMap(r=>r.components));
const c=id=>components.find(v=>v.pathId===id)?.data;
const normal=c('-3634096059350356513'),overload=c('2275143083200507359');
const normalSelector=c('-1616557734077108769'),randomSelector=c('-2173305061285597729');
const metadata=c('4210114535125638072'),movement=c('5684319367411220528');
const model=u=>evidence.models.char_1035_wisdel[['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const ground={groundOnly:true,canHitFly:false};

function reviewed(u,contract){
  const r=validateWisadelSelection(u,contract,WISADEL_S2_CONTRACT,1);
  if(metadata._isOverloadSkill!==1||metadata._canCastDuringBorn!==1||metadata._allowNoTarget!==1
    ||metadata._allowSpRecoveryWhenAffecting!==0||metadata._beginAnim!=='Skill_2_Begin'
    ||normal._waitForAttackEvent!==1||overload._waitForAttackEvent!==1
    ||normal._selectTargetSource!==1||overload._selectTargetSource!==1
    ||normal._selectTargetTiming!==1||overload._selectTargetTiming!==1
    ||normal._maxAnimScale!==1||overload._maxAnimScale!==1||overload._additionalTimes!==3
    ||overload._limitToOneTargetAfterFirstRound!==0||overload._triggerDelta<=0
    ||normal._interruptAbilityOnDetach!==1||overload._interruptAbilityOnDetach!==1
    ||normalSelector._maxNum!==3||randomSelector._maxNum!==1||randomSelector._postFilter!==14
    ||normalSelector._forceIgnoreCamouflage!==0||randomSelector._forceIgnoreCamouflage!==0
    ||movement._immediatelyReach!==1||movement._followTarget!==0||movement._keepUpdate!==0
    ||movement._attachToMountPoint!==1||movement._delayAfterReached!==1
    ||c('-3434333859528753104')._stopWhenSourceInvalid!==0
    ||!c('4787167229120109496')._buffs[0].attributes.attributeModifiers.some(v=>v.attributeType===8&&v.formulaItem===0))
    throw Error('Unreviewed Wisadel S2 native fields');
  return r;
}

export class WisadelS2Controller extends WisadelAttackController {
  constructor(b,u,r){super(b,u,r);this.mode=0;this.volleys=new Set();this.startedAt=null;}
  idle(){return this.mode===2?'Skill_2_Overload_Idle':this.mode===1?'Skill_2_Idle':'Idle';}
  transition(clip,until=0){
    const duration=model(this.u).durations[clip]??0;
    this.phase={kind:'s2-transition',readyAt:Math.max(this.b.time+duration,until)};
    this.visual(duration?clip:this.idle(),1,!duration);
  }
  cancelVolleys(){for(const v of this.volleys){v.cancelled=true;for(const t of v.timers)t.cancel();}this.volleys.clear();}
  cancelPhase(reason='control'){
    this.cancelVolleys();
    if(this.phase?.kind==='s2-attack'||this.phase?.kind==='s2-transition'){
      this.phase=null;this.b.removeBuff(this.u,'wisadel:cast');return;
    }
    super.cancelPhase(reason);
  }
  start(){
    if(!this.valid())return;
    this.cancelPhase('mode-switch');this.mode=1;this.startedAt=this.b.time;
    this.epoch=this.u.attackControlEpoch;this.u.atkCd=0;
    this.transition('Skill_2_Begin',this.u.deployedAt+model(this.u).durations.Start);
  }
  skillTick(){
    if(this.valid()&&this.u.skill.active&&this.mode===1&&this.b.time>=this.startedAt+this.record.source.duration-1e-9){
      this.cancelPhase('mode-switch');this.mode=2;this.u.atkCd=0;this.epoch=this.u.attackControlEpoch;
      this.transition('Skill_2_Overload_Begin');
    }
  }
  end(){
    const mode=this.mode;this.cancelPhase('mode-exit');this.mode=0;this.u.atkCd=0;
    if(this.valid())this.transition(mode===2?'Skill_2_Overload_End':'Skill_2_End',
      this.u.deployedAt+model(this.u).durations.Start);
  }
  tick(){
    const b=this.b,u=this.u;
    if(!this.valid()){super.tick();return;}
    if(this.phase?.kind==='s2-transition'){
      this.epoch=u.attackControlEpoch;
      if(b.time+1e-9<this.phase.readyAt)return;
      this.phase=null;this.visual(this.idle(),1,true);
    }
    if(!u.skill.active){super.tick();return;}
    if(!u.canAct||u.s.flags.disarm||this.epoch!==u.attackControlEpoch){
      this.cancelPhase('control');this.epoch=u.attackControlEpoch;this.visual(this.idle(),1,true);return;
    }
    const p=this.phase;
    if(p){
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;
        const targets=this.select(p.mode===2);
        p.inputs=new Map(targets.map(t=>[t,t.deploySeq]));
        if(targets.length)b.forceAttack(u,targets);
        if(!this.valid()||!u.skill.active||this.phase!==p)return;
      }
      if(b.time+1e-9<p.readyAt||!p.released)return;
      this.phase=null;
    }
    if(u.atkCd>1e-9)return;
    if(!this.targets().length){this.visual(this.idle(),1,true);return;}
    const clip=this.mode===2?'Skill_2_Overload_Loop':'Skill_2_Loop';
    const speed=Math.min(1,(u.base.bat+this.record.bb.base_attack_time)/u.s.interval);
    const event=model(u).eventPayloads[clip].find(v=>v.name==='OnAttack').time/speed;
    this.phase={kind:'s2-attack',mode:this.mode,seq:u.deploySeq,epoch:u.attackControlEpoch,
      activation:u.skill.activations,speed,clip,released:false,accepted:false,attackId:null,emitted:new Set(),inputs:new Map(),
      releaseAt:b.time+event,readyAt:b.time+u.s.interval};
    this.visual(clip,speed);u.atkCd=u.s.interval;
  }
  select(random){
    const rows=this.targets();
    if(!random)return rows.slice(0,normalSelector._maxNum);
    if(!rows.length)return [];
    const lives=new Map(rows.map(t=>[t,t.deploySeq]));
    const target=rows[Math.min(rows.length-1,Math.floor(this.b.rng()*rows.length))];
    return target.deploySeq===lives.get(target)&&canTargetEnemy(this.u,target,ground)?[target]:[];
  }
  release(target,info){
    const p=this.phase,b=this.b,u=this.u;
    if(p?.kind!=='s2-attack')return super.release(target,info);
    if(!this.valid()||!u.skill.active||!u.canAct||u.s.flags.disarm||!info.isSkill
      ||this.mode!==p.mode||p.seq!==u.deploySeq||p.epoch!==u.attackControlEpoch
      ||p.activation!==u.skill.activations||p.inputs.get(target)!==target.deploySeq||p.emitted.has(target)
      ||!canTargetEnemy(u,target,ground)||b.time+1e-9<p.releaseAt
      ||p.attackId!=null&&p.attackId!==info.attackId)return false;
    p.accepted=true;p.attackId=info.attackId;p.emitted.add(target);
    if(p.mode===1)this.projectiles.launch(target,info,true,{mode:'s2',scale:1,emission:info.index});
    else {
      const v={mode:2,seq:p.seq,epoch:p.epoch,activation:p.activation,speed:p.speed,info,
        cancelled:false,timers:[],remaining:overload._additionalTimes+1};
      this.volleys.add(v);
      for(let index=1;index<=overload._additionalTimes;index++)v.timers.push(b.after(
        index*overload._triggerDelta/v.speed,()=>this.emitOverload(v,index)));
      this.emitOverload(v,0,target);
    }
    return true;
  }
  emitOverload(v,index,input=null){
    const u=this.u,b=this.b;
    if(v.cancelled)return;
    const valid=()=>!v.cancelled&&this.valid()&&u.skill.active&&this.mode===v.mode&&u.canAct&&!u.s.flags.disarm
      &&u.attackControlEpoch===v.epoch&&u.deploySeq===v.seq&&u.skill.activations===v.activation
      &&b.time<this.startedAt+2*this.record.source.duration-1e-9;
    if(!valid()){
      v.cancelled=true;for(const t of v.timers)t.cancel();this.volleys.delete(v);return;
    }
    const target=input??this.select(true)[0];
    if(!valid()){v.cancelled=true;for(const t of v.timers)t.cancel();this.volleys.delete(v);return;}
    if(target&&canTargetEnemy(u,target,ground))this.projectiles.launch(target,v.info,true,{
      mode:'s2',scale:this.record.bb['attack@atk_scale_ol'],emission:index });
    if(--v.remaining===0)this.volleys.delete(v);
  }
}

export function prepareWisadelS2(b,u,{contract}={}){
  const record=reviewed(u,contract),controller=new WisadelS2Controller(b,u,record);
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,groundOnly:true,canHitFly:false,
    install:null,afterAttack:null,onHit:null,onEachHit:null,requiresAcceptedLaunch:true,attackVisual:'none',
    launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:'duration',duration:2*record.source.duration,trigger:{rule:'NEVER'},manualCancel:true,
      overloadState:()=>controller.mode===2,attack:{},mods:{atkPct:record.bb.atk,batFlat:record.bb.base_attack_time},
      canActivate:()=>controller.valid()&&!u.skill.active&&u.canAct&&!u.s.flags.disarm,
      onStart:()=>controller.start(),onTick:()=>controller.skillTick(),onEnd:()=>controller.end()},
    talents:[],install:null};
  return {record,controller,kit};
}
