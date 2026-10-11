// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered source-selected S3; publication and public lifecycle are separate gates.
import evidence from '../../../data/arkpedia-wisadel-prefabs.json' with {type:'json'};
import { WisadelAttackController,validateWisadelSelection } from './arkpedia-wisadel-attacks.js';
import { WisadelShadows,WISADEL_SHADOW_CONTRACT } from './arkpedia-wisadel-shadows.js';
import { absoluteRangeKeys,canTargetEnemy,sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
export const WISADEL_S3_TARGET='wisdel_s_3_mark[target]';
export const WISADEL_S3_TOKEN_MARK='wisdel_s_3[token_mark]';
export const WISADEL_S3_CONTRACT=Object.freeze({
  selection:'raw current all-motion priority target receives a two-second mark before windup; strike selects current marked targets first, then priority fallback; original-life input retained at birth',
  ammunition:'six rounds; one per accepted attack, with native resetWhenAttackFinished mapped to captured original OnAttackFinished for final exhaustion; no SP while active, manual discard supported',
  clocks:'original Begin/Loop/End clips and capped captured playback; additive BAT, independent cooldown with finished-event floor; mode exit cancels unborn output, born shots survive',
  shadows:'source one/two new Shadows up to three; owner token_mark grants three non-forced SP to the first successful new Shadow then is consumed; existing Shadows receive no fabricated gift and remain on skill expiry',
  projectile:'speed-ten five-second root homing, 2.5-tile ALL-motion main and separate .15 half-strength aftershock; cached ATK and captured rank/probability, live mitigation and independent live-source talent explosion',
  limits:'Unregistered full S3 component. Selection/mark dispatch, root/mount geometry, sampled homing, cached-ATK and probability transfer, Begin/End/FSM/event/cooldown and ammo-holder timing, spawn callback order and non-forced SP setter semantics are local mappings. Original Shadow publication, full selected-loadout/public lifecycle, browser, modules and original effects/audio remain gates; compiled Unity frame parity is unverified.',
  frameParity:false,
});
const components=Object.values({...evidence.characters,...evidence.skills,...evidence.projectiles})
  .flatMap(rows=>rows.flatMap(r=>r.components));
const c=id=>components.find(v=>v.pathId===id)?.data;
const attack=c('-6478552835978072609'),holder=c('2128818526141836767');
const metadata=c('1668951707761770651'),rawSelector=c('4682802530119347679');
const markedSelector=c('1301508814713417183'),mark=c('1941470665804115423')._activeBuffs[0];
const spawn=c('3508565157332123803');
const model=u=>evidence.models.char_1035_wisdel[['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const allMotion={canHitFly:true,groundOnly:false};
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
function reviewed(u,contract){
  const r=validateWisadelSelection(u,contract,WISADEL_S3_CONTRACT,2);
  if(metadata._canCastDuringBorn!==1||metadata._allowNoTarget!==1||metadata._canSilenced!==0
    ||metadata._allowSpRecoveryWhenAffecting!==0||metadata._beginAnim!=='Skill_3_Begin'
    ||metadata._finishSkillWithProgress!==1||metadata._canDiscardRemainingCount!==1
    ||attack._waitForAttackEvent!==1||attack._selectTargetSource!==1||attack._selectTargetTiming!==1
    ||attack._useCachedAtkOnly!==1||attack._transferSource!==1||attack._maxAnimScale!==1
    ||attack._projectileKey!=='projectile_chr_wisdel_s3'||holder._countEvent!==4
    ||holder._expendPerTrigger!==1||holder._resetWhenAttackFinished!==1||holder._resetImmediatelyWhenProgressEnd!==0
    ||rawSelector._targetMotion!==3||rawSelector._maxNum!==1||markedSelector._withoutThisBuff!==0
    ||markedSelector._buffKey!==WISADEL_S3_TARGET||markedSelector._filterBuffSource!==0
    ||mark.buffKey!==WISADEL_S3_TARGET||mark.lifeTime!==2||spawn._addBuffsIfOverlay!==0
    ||spawn._checkTokenMaxDeployCnt!==1||spawn._addBuffsToSpawnedToken!==1
    ||spawn._buffsToToken[0].buffKey!=='wisdel_s_3_token[add_sp]'
    ||c('-5829895523361613970')._stopWhenSourceInvalid!==0)
    throw Error('Unreviewed Wisadel S3 native fields');
  return r;
}
export class WisadelS3Controller extends WisadelAttackController {
  constructor(b,u,r){super(b,u,r);this.mode=false;this.tokenMark=null;this.selectionMarks=new Map();this.shadows=null;}
  install(){super.install();this.shadows.install();}
  transition(clip,until=0){
    this.phase={kind:'s3-transition',readyAt:Math.max(this.b.time+model(this.u).durations[clip],until)};
    this.visual(clip);
  }
  cancelPhase(reason='control'){
    if(this.phase?.kind==='s3-attack'||this.phase?.kind==='s3-transition'){
      this.phase=null;this.b.removeBuff(this.u,'wisadel:cast');return;
    }
    super.cancelPhase(reason);
  }
  start(){
    if(!this.valid())return;
    this.cancelPhase('mode-switch');this.mode=true;this.epoch=this.u.attackControlEpoch;this.u.atkCd=0;
    this.transition('Skill_3_Begin',this.u.deployedAt+model(this.u).durations.Start);
    const activation=this.u.skill.activations,seq=this.u.deploySeq;
    const valid=()=>this.valid()&&this.mode&&this.u.skill.active&&this.u.skill.activations===activation&&this.u.deploySeq===seq;
    const flag=this.b.addBuff(this.u,{key:WISADEL_S3_TOKEN_MARK,source:this.u,refresh:'keep'});
    if(!valid()){if(flag?.source===this.u)this.b.removeBuff(this.u,flag);return;}
    if(flag?.source===this.u)this.tokenMark=flag;
    for(let i=0;i<this.record.bb.max_cnt&&valid();i++){
      const t=this.shadows.spawn(1)[0];if(!t||!valid())break;
      // ON_BUFF_START CheckContainsBuff reads BUFF_SOURCE (the host). The
      // following FinishBuffsById consumes that host flag after the first gift.
      if(this.u.findBuff(WISADEL_S3_TOKEN_MARK)){
        t.skill.gainSp(this.record.bb.sp,'external',true);
        this.b.removeBuff(this.u,WISADEL_S3_TOKEN_MARK);this.tokenMark=null;
        if(valid())this.b.emit('wisadelS3ShadowSp',{owner:this.u,token:t,value:this.record.bb.sp});
      }
    }
  }
  end(){
    this.cancelPhase('mode-exit');this.mode=false;this.u.atkCd=0;
    const flag=this.tokenMark;this.tokenMark=null;if(flag)this.b.removeBuff(this.u,flag);
    if(this.valid())this.transition('Skill_3_End',this.u.deployedAt+model(this.u).durations.Start);
  }
  targetsS3(marked=false){
    const keys=new Set(absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir));
    const rows=this.b.enemies.filter(t=>canTargetEnemy(this.u,t,allMotion)&&(!t.s.flags.camou||t.blockedBy)
      &&(bodyInKeys(t,keys)||t.blockedBy===this.u));
    sortEnemyTargets(this.b,this.u,rows);
    return marked?[...rows.filter(t=>t.findBuff(WISADEL_S3_TARGET)),...rows.filter(t=>!t.findBuff(WISADEL_S3_TARGET))]:rows;
  }
  markInput(target){
    const seq=target.deploySeq;
    const buff=this.b.addBuff(target,{key:WISADEL_S3_TARGET,source:this.u,duration:mark.lifeTime,refresh:'keep',data:{wisadelS3Life:seq}});
    if(buff?.source===this.u&&buff.data.wisadelS3Life===seq)this.selectionMarks.set(target,buff);
    if(buff?.source===this.u&&(target.deploySeq!==seq||!live(target)))this.b.removeBuff(target,buff);
  }
  tick(){
    const b=this.b,u=this.u;
    for(const [t,m]of this.selectionMarks){
      if(t.deploySeq!==m.data.wisadelS3Life)b.removeBuff(t,m);
      if(t.findBuff(WISADEL_S3_TARGET)!==m)this.selectionMarks.delete(t);
    }
    if(!this.valid()){super.tick();return;}
    if(this.phase?.kind==='s3-transition'){
      this.epoch=u.attackControlEpoch;
      if(b.time+1e-9<this.phase.readyAt)return;
      this.phase=null;this.visual(this.mode?'Skill_3_Idle':'Idle',1,true);
    }
    if(!u.skill.active){super.tick();return;}
    if(!u.canAct||u.s.flags.disarm||this.epoch!==u.attackControlEpoch){
      if(u.skill.ammoLeft===0){u.skill.end('ammo');return;}
      this.cancelPhase('control');this.epoch=u.attackControlEpoch;this.visual('Skill_3_Idle',1,true);return;
    }
    const p=this.phase;
    if(p){
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;const target=this.targetsS3(true)[0];
        if(target){p.input=target;p.targetSeq=target.deploySeq;b.forceAttack(u,[target]);}
        if(!this.valid()||!u.skill.active||this.phase!==p)return;
      }
      if(p.accepted&&u.skill.ammoLeft===0&&b.time+1e-9>=p.finishedAt){u.skill.end('ammo');return;}
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;
    }
    if(u.atkCd>1e-9||u.skill.ammoLeft===0)return;
    const target=this.targetsS3()[0];if(!target){this.visual('Skill_3_Idle',1,true);return;}
    const epoch=u.attackControlEpoch,seq=u.deploySeq,activation=u.skill.activations;
    this.markInput(target);
    if(!this.valid()||!u.skill.active||!this.mode||u.deploySeq!==seq||u.skill.activations!==activation
      ||!u.canAct||u.s.flags.disarm||u.attackControlEpoch!==epoch)return;
    const clip='Skill_3_Loop',speed=Math.min(1,(u.base.bat+this.record.bb.base_attack_time)/u.s.interval);
    const events=model(u).eventPayloads[clip],event=n=>events.find(v=>v.name===n).time/speed;
    this.phase={kind:'s3-attack',seq,epoch,activation,speed,released:false,accepted:false,spent:false,
      input:null,targetSeq:null,releaseAt:b.time+event('OnAttack'),finishedAt:b.time+event('OnAttackFinished'),
      readyAt:b.time+Math.max(u.s.interval,event('OnAttackFinished'))};
    this.visual(clip,speed);u.atkCd=u.s.interval;
  }
  release(target,info){
    const p=this.phase,b=this.b,u=this.u;
    if(p?.kind!=='s3-attack')return super.release(target,info);
    if(!this.valid()||!u.skill.active||!this.mode||!u.canAct||u.s.flags.disarm||!info.isSkill||p.accepted
      ||p.seq!==u.deploySeq||p.epoch!==u.attackControlEpoch||p.activation!==u.skill.activations
      ||p.input!==target||p.targetSeq!==target.deploySeq||!canTargetEnemy(u,target,allMotion)
      ||b.time+1e-9<p.releaseAt||u.skill.ammoLeft<1)return false;
    p.accepted=true;
    this.projectiles.launch(target,info,true,{mode:'s3',scale:this.record.bb['attack@atk_scale_3']});
    return true;
  }
  consume(ctx){
    const noAmmo=ctx.noAmmo;ctx.noAmmo=true;
    const p=this.phase,u=this.u;
    if(noAmmo||!this.valid()||!this.mode||!u.skill.active||p?.kind!=='s3-attack'||!p.accepted||p.spent
      ||p.activation!==u.skill.activations||p.seq!==u.deploySeq)return;
    p.spent=true;u.skill.ammoLeft=Math.max(0,u.skill.ammoLeft-1);
    this.b.emit('ammoUsed',{unit:u,left:u.skill.ammoLeft,skill:u.skill,count:1});
  }
  stop(){
    if(this.b.finished&&this.u.skill.active)this.u.skill.end('battle-finish');
    this.mode=false;const flag=this.tokenMark;this.tokenMark=null;if(flag)this.b.removeBuff(this.u,flag);
    this.selectionMarks.clear();this.shadows?.stop(this.b.finished);super.stop();
  }
}
export function prepareWisadelS3(b,u,{contract}={}){
  const record=reviewed(u,contract),controller=new WisadelS3Controller(b,u,record);
  controller.shadows=new WisadelShadows(controller,{contract:WISADEL_SHADOW_CONTRACT});
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,groundOnly:true,canHitFly:false,
    install:null,afterAttack:null,onHit:null,onEachHit:null,requiresAcceptedLaunch:true,attackVisual:'none',
    launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:'ammo',ammo:record.bb['attack@trigger_time'],duration:0,trigger:{rule:'NEVER'},manualCancel:true,
      attack:{canHitFly:true,groundOnly:false},mods:{atkPct:record.bb.atk,batFlat:record.bb.base_attack_time},
      canActivate:()=>controller.valid()&&!u.skill.active&&u.canAct&&!u.s.flags.disarm&&controller.phase?.kind!=='s3-transition',
      onStart:()=>controller.start(),onEnd:()=>controller.end(),onAttack:ctx=>controller.consume(ctx)},
    talents:[],install:null};
  return {record,controller,kit,shadows:controller.shadows};
}
