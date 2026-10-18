// SPDX-License-Identifier: GPL-3.0-or-later
import {BOTANY_ID as ID,selectedBotanyInputs,botanyNativeInputs,botanySourceComponent} from './arkpedia-botany-source.js';
import {BotanyOrdinaryAttacks,BOTANY_ORDINARY_CONTRACT} from './arkpedia-botany-ordinary.js';
import {BotanyBurstTalent,BOTANY_TALENT_CONTRACT} from './arkpedia-botany-talent.js';
import {BotanyBurstRecovery,BOTANY_RECOVERY_CONTRACT} from './arkpedia-botany-recovery.js';
import {hasHp} from '../damage.js';
export const BOTANY_S2_CONTRACT=Object.freeze({
 scope:'Selected original Botany manual S2 account, owned mode/range, up to two retained attack inputs, Arts/physical/erosion transport and erosion recovery; no public admission.',
 mapping:'The account includes the original Begin; Begin completion admits the original mode buff for remaining account time. Only that accepted mode expands the source range, enables its two-target selector and owns recovery. No ATK bonus exists. One retained attack receipt releases independent speed-twelve projectiles to its surviving input lives. Arrivals use primary Arts, independent instant physical-extra admission and then erosion based on source ATK. Positive cooldown is retained across mode changes. A mode exit chooses the next actual local task; only literal Idle-to-Idle or Loop-to-Attack End edges play the half-second End before that task. Other edges have no invented End. Born transport preserves its original skill payload after mode/account/source departure.',
 limitations:'Account/Begin/mode timing, selector4, max_target blackboard injection, primary/buff/element ordering and End task/cooldown scheduling are explicit local mappings. Compiled per-mode cooldown/FSM/marker dispatch and per-callback source attributes remain unverified. The talent/recovery/ordinary contracts retain their limits. Modules, native effects/audio/shaders, public gameplay and game-frame/pixel parity remain separate.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const retained=t=>present(t)&&!t.hidden&&t.side==='enemy';
const due=(a,z)=>a>=z-1e-7;
export function verifyBotanyS2(n=botanyNativeInputs()){
 const s=n.s2,a=n.modes[1].attack,selector=botanySourceComponent('characters',ID,a._selector.m_PathID),
  mode=botanySourceComponent('skills','skchr_botany_2','-7386278003063235833')._buffs[0],
  alias=botanySourceComponent('characters',ID,n.modes[1].mode._animatorHooker.m_PathID)._replaceAnimPairs,
  parts=n.projectiles.projectile_chr_botany_s2.flatMap(r=>r.components.map(c=>c.data)),p=parts.find(d=>d._lifeTime!=null),m=parts.find(d=>d._speed!=null),
  node=n.templates.botany_s2_extra.eventToActions.ON_BUFF_START;
 if(s._playSkillBeginAnim!==1||s._beginAnim!=='Skill_2_Begin'||s._canCastDuringBorn!==1||s._allowNoTarget!==1
  ||s._allowSpRecoveryWhenAffecting!==0||s._rangeIdModeIndex!==1||s._attackBlackboardModeIndex!==1||s._resetAbilityCooldownWhenCastEnd!==0
  ||a._animKey!=='Attack'||a._endAnimKey!=='Idle'||a._selectTargetSource!==1||a._selectTargetTiming!==0||a._waitForAttackEvent!==1
  ||a._maxAnimScale!==1||a._affectedBySlowDown!==0||a._projectileKey!=='projectile_chr_botany_s2'||a._atkScale!==1||a._elementDamageType!==2
  ||a._activeBuffs[0].templateKey!=='botany_s2_extra'||a._activeBuffs[0].isDamageMissable!==0
  ||selector._postFilter!==4||selector._maxTargetKey!=='max_target'||selector._targetMotion!==3
  ||mode.buffKey!=='botany_s_2'||mode.templateKey!=='switch_mode_restart_fsm'||mode.blackboard[0].value!==1
  ||JSON.stringify(alias)!==JSON.stringify([{fromAnimKey:'Idle',toAnimKey:'Skill_2_Idle'},{fromAnimKey:'Attack',toAnimKey:'Skill_2_Loop'}])
  ||n.artController._mixSettings.length!==2||!n.artController._mixSettings.some(v=>v.sourceAnimName==='Skill_2_Idle'&&v.targetAnimName==='Idle'&&v.mixAnimName==='Skill_2_End')
  ||!n.artController._mixSettings.some(v=>v.sourceAnimName==='Skill_2_Loop'&&v.targetAnimName==='Attack'&&v.mixAnimName==='Skill_2_End')
  ||p._stopWhenSourceInvalid!==0||p._lifeTime!==10||p._maxHitNum!==1||p._alwaysHitTraceTargetInTheEnd!==1||m._speed!==12
  ||node.length!==1||node[0]._damageType!=='PHYSICAL'||node[0]._atkScaleVar!=='extra_atk_scale')throw Error('Changed original Botany S2 inputs');
}
export class BotanySkillTwo extends BotanyOrdinaryAttacks{
 constructor(b,u,talent,{contract}={}){
  if(contract!==BOTANY_S2_CONTRACT||selectedBotanyInputs(u).index!==1)throw Error('Original selected Botany S2 and exact contract required');
  super(b,u,{contract:BOTANY_ORDINARY_CONTRACT,mayBegin:()=>true});verifyBotanyS2();
  if('atk'in this.record.bb||'attack@atk'in this.record.bb)throw Error('Unexpected Botany S2 ATK bonus');
  this.talent=talent;this.modeBuff=null;this.wasMode=false;this.castActivation=null;
  this.recovery=new BotanyBurstRecovery(b,u,{contract:BOTANY_RECOVERY_CONTRACT,affecting:()=>this.mode&&u.skill.active});
  this.skillShot=Object.freeze({clip:'Skill_2_Loop',scale:1,projectileSpeed:12,projectileKey:'projectile_chr_botany_s2',isSkill:true,tag:'botany:s2'});
 }
 get mode(){return !!(this.u.deploySeq===this.seq&&this.modeBuff?.data?.botanyMode?.owner===this&&!this.modeBuff.data.botanyMode.finished&&this.u.buffs.includes(this.modeBuff));}
 choices(){return super.choices({limit:this.mode?this.record.bb['attack@max_target']:1});}
 canCast(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active&&!['begin','end'].includes(this.phase?.kind);}
 startSkill(){if(!this.valid()||!this.u.skill.active)return;this.castActivation=this.u.skill.activations;
  this.phase={kind:'begin',until:this.b.time+this.model().exactDurations.Skill_2_Begin};this.bornUntil=Math.min(this.bornUntil,this.b.time);
  this.facing=this.u.dir;this.visual('Skill_2_Begin');}
 refreshMode(){if(this.u.deploySeq!==this.seq)return;this.b.refreshRange(this.u);this.talent.tick();this.recovery.tick();}
 grantMode(){if(!this.valid()||!this.u.skill.active)return;const token={owner:this,life:this.seq,finished:false};
  const buff=this.b.addBuff(this.u,{key:'botany_s_2',source:this.u,duration:this.u.skill.timeLeft,refresh:'keep',data:{botanyMode:token},
   onRemove:()=>{token.finished=true;if(this.modeBuff?.data?.botanyMode===token){this.modeBuff=null;this.wasMode=false;this.refreshMode();this.exitTransition();}}});
  if(buff?.data?.botanyMode!==token)return;
  if(token.finished||!this.valid()||!this.u.skill.active||this.u.skill.activations!==this.castActivation){if(this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);return;}
  this.modeBuff=buff;this.wasMode=true;this.refreshMode();
 }
 clearMode(){const buff=this.modeBuff;this.modeBuff=null;this.wasMode=false;
  if(buff?.data?.botanyMode?.owner===this&&this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);
  this.recovery.clear();if(this.u.deploySeq===this.seq)this.b.refreshRange(this.u);if(this.valid())this.talent.tick();}
 exitTransition(){if(this.phase?.kind==='end')return;const from=this.u.mem.regularFormVisual?.clip;this.phase=null;if(!this.valid())return;
  const target=this.u.canAct&&!this.u.hidden&&this.u.atkCd<=1e-8?this.choices()[0]:null,destination=target?'Attack':'Idle';
  const edge=botanyNativeInputs().artController._mixSettings.find(v=>v.sourceAnimName===from&&v.targetAnimName===destination);
  if(edge){this.phase={kind:'end',until:this.b.time+this.model().exactDurations.Skill_2_End,destination};this.visual(edge.mixAnimName);}
  else if(target)super.begin(target);else this.idle();
 }
 endSkill(){this.clearMode();this.exitTransition();}
 idle(){this.facing=this.u.dir;this.visual(this.mode?'Skill_2_Idle':'Idle',1,true);}
 begin(target){if(!this.mode){super.begin(target);return;}const targets=this.choices();if(!targets.length)return;
  this.face(targets[0]);const speed=Math.min(1,this.u.base.bat/this.u.s.interval),releaseAge=this.model().eventPayloads.Skill_2_Loop[0].time,
   period=Math.max(this.u.s.interval,releaseAge/speed);
  this.phase={kind:'s2',targets,lives:targets.map(t=>t.deploySeq),epoch:this.u.attackControlEpoch,shot:this.skillShot,speed,releaseAge,
   age:0,lastAt:this.b.time,untilAge:period*speed,released:false,accepted:false};this.u.atkCd=period;this.visual('Skill_2_Loop',speed);
 }
 admit(ts){const p=this.phase;if(p?.kind!=='s2')return super.admit(ts);
  return this.accepting&&this.valid()&&this.mode&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!p.accepted
   &&p.epoch===this.u.attackControlEpoch&&due(p.age,p.releaseAge)&&ts.length>0&&new Set(ts).size===ts.length
   &&ts.every(t=>{const i=p.targets.indexOf(t);return i>=0&&t.deploySeq===p.lives[i]&&retained(t);});
 }
 release(ts,info){const p=this.phase;if(p?.kind!=='s2')return super.release(ts,info);if(!this.admit(ts))return false;
  p.accepted=true;for(const t of ts){if(this.ended||this.b.finished)break;this.emit(t,p.lives[p.targets.indexOf(t)],p.shot,info);}return true;
 }
 impact(ctx){if(!ctx.shot.isSkill)return super.impact(ctx);const{target,life,source,info}=ctx,b=this.b,bb=this.record.bb;
  const valid=()=>!b.finished&&hasHp(target)&&target.deployed&&!target.removed&&!target.hidden&&target.deploySeq===life;
  super.impact(ctx);if(!valid())return;let buff;const token={owner:this,finished:false};
  try{buff=b.addBuff(target,{key:`botany_s2_extra:${this.u.id}:${this.seq}:${info.attackId}`,source:source(),duration:0,refresh:'keep',
    data:{botanyExtra:token},onRemove:()=>{token.finished=true;}});
   if(buff?.data?.botanyExtra===token&&!token.finished&&valid()){const u=source();b.dealDamage(u,target,{amount:u.s.atk*u.s.atkScaleMul*bb['attack@extra_atk_scale'],
    type:'phys',isSkill:true,isAttack:false,isProjectile:true,applyWay:'ranged',attackId:info.attackId,tags:['botany:s2-extra']});}
  }finally{if(buff?.data?.botanyExtra===token&&target.buffs.includes(buff))b.removeBuff(target,buff);}
  if(valid()){const u=source();b.dealDamage(u,target,{amount:u.s.atk*bb['attack@ep_damage_ratio'],type:'element',element:'erosion',
   isSkill:true,isAttack:false,isProjectile:true,canDodge:false,attackId:info.attackId,tags:['botany:s2-injury']});}
 }
 tick(){if(!this.valid())return;let p=this.phase;
  if(p?.kind==='begin'){if(!this.u.skill.active){this.phase=null;this.idle();return;}if(!due(this.b.time,p.until))return;
   this.grantMode();if(!this.valid()||this.phase!==p)return;this.phase=p=null;this.idle();}
  if(p?.kind==='end'){if(!due(this.b.time,p.until))return;this.phase=p=null;this.idle();}
  if(this.wasMode!==!!this.mode){this.wasMode=!!this.mode;this.phase=null;this.refreshMode();this.exitTransition();return;}
  if(p?.kind!=='s2'){super.tick();return;}const u=this.u;
  if(!this.mode||u.hidden||!u.canAct||u.s.flags.disarm||p.epoch!==u.attackControlEpoch){this.phase=null;this.idle();return;}
  p.age+=Math.max(0,this.b.time-p.lastAt)*p.speed;p.lastAt=this.b.time;
  if(!p.released&&due(p.age,p.releaseAge)){p.released=true;const ts=p.targets.filter((t,i)=>t.deploySeq===p.lives[i]&&retained(t));
   this.accepting=true;try{this.b.forceAttack(u,ts);}finally{this.accepting=false;}}
  if(!this.valid()||this.phase!==p||!due(p.age,p.untilAge))return;this.phase=null;if(u.atkCd>1e-8)return;
  const target=this.choices()[0];if(target)this.begin(target);else this.idle();
 }
 spec(){const c=this;return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},
  targeting:{get rangeGrid(){return c.mode?c.record.skillRangeGrid:null;}},attack:{get isSkill(){return c.phase?.kind==='s2';}},
  canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.endSkill()};}
 install(){this.talent.install();this.recovery.install();super.install();}
 stop(){if(this.stopped||this.stopping)return;this.stopping=true;
  try{if(this.u.deploySeq===this.seq&&this.u.skill.active&&this.u.skill.activations===this.castActivation)this.u.skill.end('controller-removed');
   super.stop();this.clearMode();this.recovery.stop();this.talent.stop();}finally{this.stopping=false;}
 }
}
export function prepareBotanyS2(b,u,{contract}={}){
 if(contract!==BOTANY_S2_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.botany)throw Error('Fresh selected Botany S2 and exact controller contract required');
 const talent=new BotanyBurstTalent(b,u,{contract:BOTANY_TALENT_CONTRACT}),controller=new BotanySkillTwo(b,u,talent,{contract});u.mem.botany=controller;
 return{record:controller.record,talent,recovery:controller.recovery,controller,kit:{install:null,talents:[],trait:controller.trait(),skill:controller.spec()}};
}
