// SPDX-License-Identifier: GPL-3.0-or-later
// Held S3 P1 attacks only; the owning persona/skill state composes separately.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import clocks from '../../../data/arkpedia-makoto-clocks.json' with {type:'json'};
import {MAKOTO_ID as ID,selectedMakotoInputs,makotoS3AssaultInputs} from './arkpedia-makoto-source.js';
import {absoluteRangeKeys,canTargetEnemy,sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {weaknessType,WEAKNESS_PRIORITY} from './garrisons/battle.js';
export const MAKOTO_S3_ASSAULT_CONTRACT=Object.freeze({
 scope:'Selected original S3 P1 max-target all-motion attacks and common weakness damage only.',
 mapping:'Explicit owning-form and original A/B dispatchers are required. Selected nonextended x-1 acquisition retains input lives. Literal Front/Back OnAttack clocks use sampled uncapped base-BAT/current-interval playback and live slowdown once; acquisition is bounded by interval and release, not the longer clip tail. One accepted multi-input receipt issues one ordinary Arts instance per retained recipient. Its common WeakDamage mapping runs after default hit modifiers, respects a logical common_weak_damage_flag data.weak_damage_type of1/2, and otherwise reuses the existing shared Physical/Arts mitigation comparison; ties preserve Arts. Each instance passes the normal accuracy, evasion, shield, floor, damage and attack accounting exactly once.',
 limitations:'Numeric selectors, input retention, A/B dispatcher, cadence, facing, weakness hook priority and logical flag representation are explicit local mappings. The shared comparison includes DEF/RES ignore and typed dealt/taken multipliers; it does not execute conditional damage hooks twice, preview shields, or claim recovered compiled WeakDamage internals. Entry/free-cast permission, persona passive stats, P2 support, fatal/return/all-out ownership, public art, modules, native particles/audio and compiled/game-frame/pixel parity compose separately.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.side==='enemy'&&t.deploySeq===life;
const due=(a,z)=>a>=z-1e-7,same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
export function verifyMakotoS3Assault(n=makotoS3AssaultInputs()){
 const {mode:m,attack:a,trigger:t,selector:s,replacement:r,templates:ts,weakBuff:w}=n;
 if(m._attack.m_PathID!=='-9190855073522201051'||m._attackTrigger.m_PathID!=='5322279708059291173'
  ||a._selector.m_PathID!=='-8827268357953565147'||a._animKey!=='Doll_Skill_3_P1_Attack_A'||a._waitForAttackEvent!==1
  ||a._timeMode!==0||a._maxAnimScale!==-1||a._affectedBySlowDown!==1||a._preDelay!==0||a._escapeTime!==0
  ||a._selectTargetSource!==1||a._selectTargetTiming!==0||a._alwaysIncludeTarget!==1||a._allowNoTarget!==0
  ||a._interuptIfTargetDead!==0||a._ignorePalsyInterrupt!==0||a._faceToTarget!==1||a._faceToFront!==0
  ||a._atkScale!==1||a._atkScaleKey!=='atk_scale'||a._damageType!==2||a._attackType!==1
  ||t._keepTarget!==0||t._minTargetNum!==1||t._overrideSearchTargetTick!==-1)throw Error('Changed original Makoto S3 assault attack clock');
 if(s._targetSide!==2||s._targetMotion!==3||s._targetCategory!==1||s._postFilter!==4||s._ignoreTargetFree!==0
  ||s._ignoreMotionMode!==0||s._forceIgnoreCamouflage!==0||s._limitTargetNum!==1||s._maxNum!==4||s._maxTargetKey!=='max_target'
  ||s._ignoreHitRange!==0||s._excludeOwner!==0||r._sourceAnimKey!=='Doll_Skill_3_P1_Attack_A'||r._loopType!==0||r._recalculatePlaybackSpeed!==0
  ||!same(r._replaceGroup.map(v=>v.anim),['Doll_Skill_3_P1_Attack_A','Doll_Skill_3_P1_Attack_B']))throw Error('Changed original Makoto S3 assault selection/dispatch');
 const stand=ts.makoto_s3_1_standin.eventToActions.ON_BUFF_START,create=stand[2],actions=ts.common_weak_damage_buff.eventToActions.ON_CALCULATE_DAMAGE,
  flag=actions[1]._conditionNode,forced=actions[1]._succeedNodes[1],fallback=actions.at(-1),defaults=ts.common_weak_damage_flag.eventToActions.ON_BUFF_START[0]._defaultSettings;
 if(create._buffKey!=='common_weak_damage'||create._isDerivedBuff!==true||create._finishDerivedBuffIfParentFinish!==true
  ||w.templateKey!=='common_weak_damage_buff'||w.lifeTimeType!=='INFINITY'||flag._buffKeys.join()!=='common_weak_damage_flag'||flag._checkBuffSource!==false
  ||forced._conditionNode._valueToCompare!==1||forced._succeedNodes[0]._damageType!=='PHYSICAL'
  ||forced._failNodes[0]._conditionNode._valueToCompare!==2||forced._failNodes[0]._succeedNodes[0]._damageType!=='MAGICAL'
  ||!fallback.$type.includes('+WeakDamage,')||fallback._sourceType!=='BUFF_OWNER'
  ||defaults.length!==1||defaults[0].key!=='weak_damage_type'||defaults[0].val!==0||defaults[0].overrideIfExists!==false)
   throw Error('Changed original Makoto S3 common weakness actions');
}
export class MakotoSkillThreeAssault {
  constructor(b,u,{contract,inPersona,pickClip}={}) {
    if(contract!==MAKOTO_S3_ASSAULT_CONTRACT||typeof inPersona!=='function'||typeof pickClip!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto S3 assault, exact combat contract and explicit form predicate required');
    const record=selectedMakotoInputs(u);if(record.index!==2)throw Error('Fresh selected Makoto S3 assault required');
    verifyMakotoS3Assault();
    Object.assign(this,{b,u,record,inPersona,pickClip,visualSeq:0,seq:null,stopped:false,busy:false,accepting:false,phase:null,
      handles:[],weakHits:new WeakMap(),visuals:new WeakSet(),facing:u.dir,range:null,starting:false});
  }
  valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&present(this.u)&&this.u.deploySeq===this.seq;}
  active(){if(!this.valid())return false;try{const yes=this.inPersona();return this.valid()&&yes===true&&!this.u.hidden;}catch(error){this.phase=null;throw error;}}
  keys(){const{tileR:r,tileC:c,dir}=this.u;if(!this.range||this.range.r!==r||this.range.c!==c||this.range.dir!==dir)
    this.range={r,c,dir,keys:new Set(absoluteRangeKeys(this.record.skillRangeGrid,r,c,dir))};return this.range.keys;}
  legal(t){return present(t)&&!t.hidden&&t.side==='enemy'&&!t.s.flags.invulnerable&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})
    &&(!t.s.flags.camou||!!t.blockedBy);}
  choices(){const keys=this.keys();return sortEnemyTargets(this.b,this.u,this.b.enemies.filter(t=>this.legal(t)&&bodyInKeys(t,keys)),'normal').slice(0,this.record.bb['attack@max_target']);}
  model(){const face=this.facing==='UP'?'Back':'Front';return {...evidence.models[ID][face],...clocks.models[face]};}
  visual(clip,speed=1,loop=false){if(!this.valid())return null;if(!Object.hasOwn(this.model().exactDurations,clip))throw Error('Missing original Makoto S3 assault clip');
    const v={clip,speed,loop,...(loop?{replace:true}:{playId:`makoto:s3-p1:${this.seq}:${++this.visualSeq}`})};
    this.visuals.add(v);this.u.mem.regularFormVisual=v;this.u.mem.regularVisualDirection=this.facing;return v;}
  idle(){this.facing=this.u.dir;this.visual('Doll_Skill_3_P1_Idle',1,true);}
  face(t){const dx=t.x-this.u.x,dy=t.y-this.u.y;if(Math.hypot(dx,dy)>1e-8)this.facing=Math.abs(dy)>Math.abs(dx)?dy>0?'UP':'DOWN':dx<0?'LEFT':'RIGHT';this.u.mem.regularVisualDirection=this.facing;}
  begin(){if(this.starting||this.phase||!this.valid()||this.u.atkCd>1e-8)return false;this.starting=true;
    try{const epoch=this.u.attackControlEpoch;if(!this.active()||!this.valid()||!this.u.canAct||this.u.s.flags.disarm||this.phase||epoch!==this.u.attackControlEpoch)return false;
      const targets=this.choices();if(!targets.length||!this.valid()||this.phase||epoch!==this.u.attackControlEpoch)return false;
      const inputs=targets.map(t=>({target:t,life:t.deploySeq})),clip=this.pickClip();
      if(!['Doll_Skill_3_P1_Attack_A','Doll_Skill_3_P1_Attack_B'].includes(clip))throw Error('Explicit Makoto dispatcher must return an original S3 P1 clip');
      if(!this.active()||!this.valid()||this.phase||epoch!==this.u.attackControlEpoch||!this.u.canAct||this.u.s.flags.disarm
        ||inputs.some(i=>!retained(i.target,i.life)||!this.legal(i.target))||!same(this.choices().map(t=>t.id),targets.map(t=>t.id)))return false;
      this.face(targets[0]);const {u}=this,marker=this.model().eventPayloads[clip];
      if(marker?.length!==1||marker[0].name!=='OnAttack'||marker[0].time!==0.800000011920929)throw Error('Changed original Makoto S3 assault marker');
      const speed=u.base.bat/u.s.interval,releaseAge=marker[0].time,period=Math.max(u.s.interval,releaseAge/speed);
      this.phase={clip,inputs,epoch,speed,releaseAge,untilAge:period*speed,
        age:0,lastAt:this.b.time,released:false,accepted:false};u.atkCd=period;this.phase.visual=this.visual(clip,speed*u.s.slowDownRate);return true;
    }finally{this.starting=false;}}
  admit(targets){const p=this.phase;if(!(this.accepting&&this.active()&&this.valid()&&this.phase===p&&p&&!p.accepted
    &&this.u.canAct&&!this.u.s.flags.disarm&&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&targets.length))return false;
    let previous=-1;return targets.every(t=>{const i=p.inputs.findIndex(input=>input.target===t),input=p.inputs[i];
      if(i<=previous||!input||!retained(t,input.life)||!this.legal(t))return false;previous=i;return true;});}
  release(targets,info){if(!this.admit(targets))return false;const p=this.phase;p.accepted=true;
    const inputs=targets.map(t=>p.inputs.find(input=>input.target===t));
    for(const input of inputs){if(!this.active()||!this.valid()||this.phase!==p||this.u.attackControlEpoch!==p.epoch||!this.u.canAct||this.u.s.flags.disarm)break;
      const t=input.target;if(!retained(t,input.life)||!this.legal(t))continue;
      const dmg=this.b.makeDamage({amount:this.u.s.atk*this.u.s.atkScaleMul*this.record.bb['attack@atk_scale'],type:'arts',isAttack:true,
        isSkill:false,isProjectile:false,applyWay:'ranged',attackId:info.attackId,tags:['makoto:s3-p1']});
      // Only this exact issued instance participates in the common WeakDamage
      // mapping. Foreign/reentrant attacks cannot borrow the persona modifier.
      this.weakHits.set(dmg,{target:t,life:input.life,sourceLife:this.seq});
      try{this.b.dealDamage(this.u,t,dmg);}finally{this.weakHits.delete(dmg);}
    }
    return true;
  }
  retype({source,target,dmg}){const hit=this.weakHits.get(dmg);
    if(!hit||source!==this.u||hit.target!==target||!this.valid()||hit.sourceLife!==this.seq||!retained(target,hit.life)||!this.active()||!this.valid()||!retained(target,hit.life))return;
    if(dmg.type!=='phys'&&dmg.type!=='arts')return;
    const flag=target.buffs.find(buff=>buff.key==='common_weak_damage_flag'),forced=flag?.data?.weak_damage_type??0;
    dmg.type=forced===1?'phys':forced===2?'arts':weaknessType(source,target,dmg);
  }
  tick(){if(this.busy||!this.valid())return;this.busy=true;
    try{
      if(!this.active()){this.phase=null;return;}
      if(!this.valid())return;
      const {u,b}=this,p=this.phase;
      if(!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;return;}
      if(p){if(u.mem.regularFormVisual===p.visual)p.visual.speed=p.speed*u.s.slowDownRate;p.age+=sourceAbilityDelta(u,Math.max(0,b.time-p.lastAt),true)*p.speed;p.lastAt=b.time;
        if(!p.released&&due(p.age,p.releaseAge)){p.released=true;this.accepting=true;
          try{b.forceAttack(u,p.inputs.filter(i=>retained(i.target,i.life)&&this.legal(i.target)).map(i=>i.target));}finally{this.accepting=false;}}
        if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;this.idle();
      }
      if(u.atkCd<=1e-8)this.begin();
    }finally{this.busy=false;}
  }
  trait(){return{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',heal:null,projectile:'none',canHitFly:true,groundOnly:false,
    maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,allInRange:false,hits:1,hitsFn:null,chain:null,splashRadius:0,windup:0,attackVisual:'none',requiresAcceptedLaunch:true,
    acceptAreaAttack:(_b,_u,_p,ts)=>this.admit(ts),launchAreaAttack:(_b,_u,_p,ts,info)=>this.release(ts,info)};}
  install(){if(this.stopped||this.handles.length||this.u.mem.makotoS3Assault&&this.u.mem.makotoS3Assault!==this)throw Error('Makoto S3 assault combat cannot be reinstalled');
    this.u.mem.makotoS3Assault=this;const{b,u}=this;this.handles=[
      b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
      b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),
      ...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();},{owner:u})),
      b.on('hit',h=>this.retype(h),{owner:u,priority:WEAKNESS_PRIORITY}),
      b.on('palsyTriggered',({unit})=>{if(unit===u)this.phase=null;},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.phase=null;this.accepting=false;for(const h of this.handles)this.b.off(h);this.handles=[];
    if(this.seq===this.u.deploySeq&&this.visuals.has(this.u.mem.regularFormVisual)){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}}
}
