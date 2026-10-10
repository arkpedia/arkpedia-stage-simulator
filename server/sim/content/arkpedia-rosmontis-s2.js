// SPDX-License-Identifier: GPL-3.0-or-later
// Private S2 adapter. Public installation still requires the complete S3 kit.
import evidence from '../../../data/arkpedia-rosmontis-prefabs.json' with {type:'json'};
import { RosmontisAttackController, validateRosmontisSelection } from './arkpedia-rosmontis-attacks.js';
import { canTargetEnemy } from '../targeting.js';
export const ROSMONTIS_S2_CONTRACT=Object.freeze({
  selection:'CAST selection at each emission; one current ground primary, root centre retained by each born projectile',
  impact:'forced reach at each source 1.2-second lifetime; no literal animation event dispatch',
  clocks:'captured selected-S2 base interval/current interval scales .15 emission delta; capped visual speed; cooldown independently permits overlapping projectiles',
  transitions:'start cancels unborn ordinary input and resets attack cooldown; accepted volleys survive mode exit/control/owner finish',
  receipts:'one full-scale main and three half-scale Physical splashes; one independent native stun roll per eligible recipient per impact',
  limits:'CAST dispatch, lifetime-to-impact, mount-to-root geometry, animation/cadence mapping, damage/buff order and miss-flag transfer, mode-switch/reset and accepted-volley lifetime are local mappings; compiled callbacks/FSM/frame parity, modules, particles/audio remain unverified',
  frameParity:false,
});
const components=Object.values({...evidence.characters,...evidence.skills,...evidence.projectiles})
  .flatMap(rows=>rows.flatMap(r=>r.components));
const c=id=>components.find(r=>r.pathId===id)?.data;
const ability=c('8002166357578185499');
const body=c('-1377125626404420483'),afterBody=c('-4763532747056025036');
const movement=c('6438007646873896061');
const radius=c('6926444252901000317').m_Radius;
const trait=Object.fromEntries(evidence.tables.character.trait.candidates[0].blackboard.map(v=>[v.key,v.value]));
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
const model=u=>evidence.models.char_391_rosmon[['UP','LEFT'].includes(u.dir)?'Back':'Front'];
function reviewed(u,contract){
  const record=validateRosmontisSelection(u,contract,ROSMONTIS_S2_CONTRACT,1);
  const mods=c('-6342955037654950080')._buffs[0].attributes.attributeModifiers;
  const template=evidence.templates['rosmon_s_2[stun]'].eventToActions.ON_BUFF_START;
  const metadata=c('-8848171786002669760');
  if(ability._waitForAttackEvent!==0||ability._selectTargetTiming!==0||ability._additionalTimes!==3
    ||ability._castToFirstRoundTargetLocationsAtProjectileBirth!==0||ability._onlyFeedActiveBuffToFirstOne!==0
    ||ability._maxAnimScale!==1||ability._preDelay!==0||ability._triggerDelta<=0
    ||body._alwaysReachInTheEnd!==1||body._stopWhenSourceInvalid!==0||body._lifeTime!==afterBody._lifeTime
    ||body._lifeTimeType!==1||afterBody._lifeTimeType!==1||afterBody._alwaysReachInTheEnd!==1
    ||afterBody._stopWhenSourceInvalid!==0||movement._checkReached!==0||movement._immediatelyReach!==0
    ||movement._attachToMountPoint!==1||radius!==1.5
    ||!mods.some(m=>m.attributeType===8&&m.formulaItem===1&&m.loadFromBlackboard===1)
    ||template[0]._probKey!=='prob'||template[1]._buff.buffKey!=='stun'
    ||trait['attack@append_atk_scale']!==.5||record.bb.add_times!==2
    ||metadata._canSilenced!==0||metadata._canCastDuringBorn!==1||metadata._allowNoTarget!==1
    ||metadata._allowSpRecoveryWhenAffecting!==0||ability._activeBuffs[0].isDamageMissable!==0)
    throw Error('Unreviewed Rosmontis S2 native fields');
  return record;
}
export class RosmontisS2Controller extends RosmontisAttackController {
  cancelPhase(reason='control'){
    // Interrupting a timed S2 attack does not cancel the timed skill itself.
    if(this.phase?.kind==='s2-attack'){
      this.phase=null;this.b.removeBuff(this.u,'rosmontis:cast');return;
    }
    super.cancelPhase(reason);
  }
  start(){
    if(!this.valid())return;
    this.cancelPhase('mode-switch');this.epoch=this.u.attackControlEpoch;this.u.atkCd=0;
    // S2 can be activated during the original entrance; finish that entrance
    // before sending an attack rather than inventing a separate skill begin.
    const remaining=this.u.deployedAt+model(this.u).durations.Start-this.b.time;
    if(remaining>1e-9)this.phase={kind:'entrance',readyAt:this.b.time+remaining};
    else this.visual('Idle',1,true);
  }
  end(){
    if(this.phase?.kind==='s2-attack')this.phase=null;
    if(this.valid())this.visual('Idle',1,true);
  }
  tick(){
    const b=this.b,u=this.u;
    if(!this.valid()||!u.skill.active){super.tick();return;}
    this.aura.refresh();
    if(this.phase?.kind==='entrance'){
      this.epoch=u.attackControlEpoch;if(b.time+1e-9<this.phase.readyAt)return;this.phase=null;
    }
    if(!u.canAct||u.s.flags.disarm||this.epoch!==u.attackControlEpoch){
      this.cancelPhase('control');this.epoch=u.attackControlEpoch;this.visual('Idle',1,true);return;
    }
    if(this.phase){if(b.time+1e-9<this.phase.readyAt)return;this.phase=null;}
    if(u.atkCd>1e-9)return;
    const target=this.targets()[0];if(!target){this.visual('Idle',1,true);return;}
    const rate=u.base.bat*(1+this.record.bb.base_attack_time)/u.s.interval;
    this.phase={kind:'s2-attack',target,targetSeq:target.deploySeq,seq:u.deploySeq,epoch:u.attackControlEpoch,
      skill:true,accepted:false,rate,readyAt:b.time+u.s.interval};
    this.visual('Skill_2',Math.min(ability._maxAnimScale,rate));u.atkCd=u.s.interval;
    b.forceAttack(u,[target]);
    if(this.valid()&&!this.phase?.accepted)this.cancelPhase('rejected');
  }
  release(target,info){
    const p=this.phase,u=this.u,b=this.b;
    if(p?.kind!=='s2-attack')return super.release(target,info);
    if(!this.valid()||!u.skill.active||!u.canAct||u.s.flags.disarm||p.accepted
      ||p.target!==target||p.targetSeq!==target.deploySeq||p.epoch!==u.attackControlEpoch
      ||p.seq!==u.deploySeq||!info.isSkill||!canTargetEnemy(u,target,{groundOnly:true,canHitFly:false}))return false;
    p.accepted=true;
    const command={mode:'s2',attackId:info.attackId,isSkill:true,cancelled:false,timers:[],remaining:ability._additionalTimes+1,
      rate:p.rate,prob:this.record.bb['attack@prob'],stun:this.record.bb['attack@stun']};
    this.outputs.add(command);
    // The accepted volley owns its emissions and impacts. Each emission picks
    // again, while an already born projectile never follows that input's life.
    // Queue all emissions before exposing any callback to preserve cleanup.
    for(let index=1;index<=ability._additionalTimes;index++)command.timers.push(b.after(
      index*ability._triggerDelta/command.rate,()=>this.emitS2(command,index)));
    this.emitS2(command,0,target);return true;
  }
  complete(command){
    command.remaining--;if(command.remaining===0){this.outputs.delete(command);this.releaseFinishHook();}
  }
  emitS2(command,index,input=null){
    if(command.cancelled||this.b.finished)return;
    const target=input??this.targets()[0];
    if(!target){this.complete(command);return;}
    const projectile={index,x:target.x,y:target.y,bornAt:this.b.time,attackId:command.attackId,
      lifetime:body._lifeTime,scale:index?trait['attack@append_atk_scale']:1};
    // No damage at emission. Source lifetime forces a reached event even though
    // its mount-attached movement never performs a reached-distance check.
    command.timers.push(this.b.after(projectile.lifetime,()=>{
      this.impactS2(command,projectile);this.complete(command);
    }));
    this.b.emit('rosmontisS2Birth',{owner:this.u,command,projectile});
  }
  impactS2(command,projectile){
    const b=this.b,u=this.u;if(command.cancelled||b.finished)return;
    const targets=b.foesInRadius(projectile.x,projectile.y,radius,true)
      .filter(t=>canTargetEnemy(u,t,{groundOnly:true,canHitFly:false}));
    b.emit('rosmontisS2Impact',{owner:u,command,projectile});
    for(const target of targets){
      if(command.cancelled||b.finished)break;
      if(!canTargetEnemy(u,target,{groundOnly:true,canHitFly:false}))continue;
      const life=target.deploySeq;
      b.dealDamage(u,target,{amount:u.s.atk*u.s.atkScaleMul*projectile.scale,type:'phys',isAttack:true,
        isSkill:true,isSplash:true,applyWay:'ranged',attackId:command.attackId,tags:projectile.index?['aftershock']:[]});
      // The native nondamage-missable active buff carries its own Dice. Roll
      // even after dodged/shielded damage, then use ordinary status immunity,
      // resistance and refresh handling. Do not apply it to a replacement life.
      if(!command.cancelled&&!b.finished&&live(target)&&target.deploySeq===life){
        const rolled=b.rng(),success=rolled<command.prob;
        b.emit('rosmontisS2StunRoll',{owner:u,target,command,projectile,rolled,success});
        if(success&&!command.cancelled&&!b.finished&&live(target)&&target.deploySeq===life)
          b.applyStatus(target,'stun',{duration:command.stun,source:u});
      }
    }
  }
  cancelOutputs(){
    for(const command of this.outputs){command.cancelled=true;command.timer?.cancel();
      for(const timer of command.timers??[])timer.cancel();}
    this.outputs.clear();this.releaseFinishHook();
  }
}
export function prepareRosmontisS2(b,u,{contract}={}){
  const record=reviewed(u,contract),controller=new RosmontisS2Controller(b,u,record);
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,groundOnly:true,canHitFly:false,
    install:null,afterAttack:null,onHit:null,onEachHit:null,requiresAcceptedLaunch:true,attackVisual:'none',
    launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:'duration',duration:record.source.duration,trigger:{rule:'NEVER'},attack:{},
      mods:{atkPct:record.bb.atk,batPct:record.bb.base_attack_time},
      canActivate:()=>controller.valid()&&!u.skill.active&&u.canAct&&!u.s.flags.disarm,
      onStart:()=>controller.start(),onEnd:()=>controller.end()},talents:[],install:null};
  return {record,controller,kit};
}
