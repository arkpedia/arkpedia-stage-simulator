// SPDX-License-Identifier: GPL-3.0-or-later
import {MechanistAttackClock,prepareMechanistAttackInputs} from './arkpedia-mcnist-attacks.js';
import {MCNIST_ID as ID,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {MechanistS2Shields} from './arkpedia-mcnist-s2-shields.js';
import evidence from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
export const MCNIST_S2_CONTRACT=Object.freeze({
 scope:'Selected Mechanist manual S2 mode, physical ordinary attacks, owner/current McGraf reactive barriers, Arts break burst and Tremble; no public admission',
 mapping:'Selected ATK percentage and one free 10%-recipient-max-HP barrier on the owner/current registered McGraf at accepted activation. The original common token passive also forwards the active host S2 operands and grants a host-sourced barrier to a newly deployed McGraf without spending ammo. Ordinary S2 shots keep single-target physical damage and never consume manual-break ammo or roll attack-ammo effects. Accepted shield exhaustion checks source/recipient shield budgets before cancelling overflow, then snapshots a source-ATK Arts area burst and applies missable, resistance/immunity-aware Tremble. A zero-budget source guard blocks reentrant damage at its actual shield position during that burst. After burst callbacks, a positive owner ammo count and live mode permit one manual count event followed by one replacement barrier. The last pre-consumption positive count can therefore leave a nonreactive replacement after mode exit. Manual discard also leaves accepted barriers; without the source mode they cannot burst or refill. New casts replace old S2 barriers, while independent T2/foreign barriers remain.',
 limits:'Initial-cast ignoreTriggerOnce, shield ordering across external sources, source-filter aliases, burst ATK snapshot and damage/Tremble callback order, final-count replacement after mode exit, mode admission/refund and token-passive attachment priority after T2 are local mappings. Begin/End reserve original world-time clips and keep birth/positive ordinary cooldown; down mode uses its literal Front-only tracks. Native C# dispatch, modules, particles/audio, S3 and original game-frame/pixel parity remain unverified. No public roster approval.',frameParity:false,
});
function verify(){const n=mechanistNativeInputs(),s=n.s2,c=mechanistSourceComponent('skills','skchr_mcnist_2','-303181639577658262'),mode=n.templates.mcnist_s_2_mode.eventToActions,
 take=n.templates.mcnist_s_2_shield.eventToActions.ON_TAKE_DAMAGE,actions=take[1]._succeedNodes;
 if(s._showSpAsBulletMode!==1||s._canDiscardRemainingCount!==1||s._canCastDuringBorn!==1||s._allowSpRecoveryWhenAffecting!==0||s._beginAnim!=='Skill_2_Begin'
  ||c._countEvent!==7||c._ignoreTriggerOnce!==1||c._resetImmediatelyWhenProgressEnd!==1||c._resetWhenAttackFinished!==0
  ||mode.ON_BUFF_START[5]._finishDerivedBuffIfParentFinish!==false||mode.ON_BUFF_START[6]._finishDerivedBuffIfParentFinish!==false
  ||take[0]._filterDamageType!==false||!take[0]._useDynamicVar||take[0]._allowNegativeDynamicVar!==false
  ||actions[3]._conditionNode._buffKeys[0]!=='mcnist_s_2'||actions[3]._succeedNodes[1]._damageType!=='MAGICAL'
  ||actions[6]._succeedNodes[1].$type.split('+')[1].split(',')[0]!=='CharSkillManualTriggerCountEvent'
  ||actions[6]._succeedNodes[2]._finishDerivedBuffIfParentFinish!==false
  ||evidence.buffDatabase.disarmed_combat.durationKey!=='not_combat'
  ||evidence.buffDatabase.disarmed_combat.attributes.abnormalFlags.join(',')!=='DISARMED_COMBAT'
  ||evidence.buffDatabase.disarmed_combat.isDamageMissable!==true)throw Error('Changed native Mechanist S2 mode/counter/barrier graph');
 const passive=n.templates.mcgraf_s_3_passive.eventToActions.ON_BUFF_START,forward=passive[1]._succeedNodes;
 if(!passive[0]._checkTargetHost||passive[1]._conditionNode._skillIndex!==1
  ||forward.slice(0,4).map(a=>a._fromBlackboardKey).join(',')!=='hp_ratio,atk_scale,not_combat,range_radius'
  ||forward.slice(0,4).some(a=>a._hostBuffKey!=='mcnist_s_2')||forward[4]._createOnTargetHost!==false
  ||mechanistSourceComponent('tokens','token_10069_mcnist_mcgraf','5608835379773326643')._buffs[1].templateKey!=='mcgraf_s_3_passive')throw Error('Changed McGraf common-passive S2 forwarding');
 for(const a of[n.s2Attack,n.s2Combat,n.s2DownAttack,n.s2DownCombat])if(a._timeMode!==0||a._waitForAttackEvent!==1||a._maxAnimScale!==1||a._affectedBySlowDown!==1||a._projectileKey!=='projectile_chr_mcnist_s2'||a._damageType!==1)throw Error('Changed S2 attack clock');
 const root=mechanistSourceComponent('projectiles','projectile_chr_mcnist_s2','-6998982708267155420'),move=mechanistSourceComponent('projectiles','projectile_chr_mcnist_s2','-7561636101003050972');
 if(move._speed!==20||root._maxHitNum!==1||root._lifeTime!==10||root._stopWhenSourceInvalid!==0)throw Error('Changed S2 ordinary projectile');
}
export class MechanistS2 extends MechanistAttackClock{
 constructor(b,u,resources){super(b,u,{resources});this.record=resources.record;this.modeKey=`mcnist:s2:mode:${u.id}`;this.modeBuff=null;this.ending=false;this.modeLease=0;this.pendingModes=new Map();this.shields=new MechanistS2Shields(this);}
 inMode(){return this.valid()&&this.u.skill.active&&this.modeBuff!=null&&this.u.findBuff(this.modeKey)===this.modeBuff;}
 prefix(){return this.u.dir==='DOWN'?'Skill_Down_2_':'Skill_2_';}
 modeFace(){this.facing=this.u.dir==='DOWN'?'DOWN':this.u.dir;}
 idle(){if(!this.inMode())return super.idle();this.modeFace();this.visual(this.prefix()+'Idle',1,true);}
 canCast(){return this.valid()&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active&&this.phase?.kind!=='transition';}
 transition(clip){this.modeFace();const until=Math.max(this.b.time+this.model().exactDurations[clip],this.u.mem.regularBornUntil??0);this.phase={kind:'transition',until};this.visual(clip);}
 start(){const b=this.b,u=this.u,activation=u.skill.activations,lease=++this.modeLease,remove=({buff})=>{if(this.modeBuff===buff){this.modeBuff=null;if(u.skill.active&&!this.ending)u.skill.end('mode-removed');}};
  this.pendingModes.set(remove,{activation,lease,life:u.deploySeq});let buff;
  try{buff=b.addBuff(u,{key:this.modeKey,source:u,mods:{atkPct:this.record.bb.atk},onRemove:remove});}finally{this.pendingModes.delete(remove);}
  if(activation!==u.skill.activations||lease!==this.modeLease){if(buff)b.removeBuff(u,buff);return;}
  if(!buff||!this.valid()||!u.skill.active){if(buff)b.removeBuff(u,buff);if(u.skill.active)u.skill.end('mode-rejected');return;}
  this.modeBuff=buff;this.transition(this.prefix()+'Begin');this.shields.start();
 }
 end(){this.modeLease++;const last=this.u.mem.regularFormVisual?.clip,prefix=this.prefix();this.ending=true;try{const old=this.modeBuff;this.modeBuff=null;if(old)this.b.removeBuff(this.u,old);
   if(!this.valid())return;this.phase=null;if([prefix+'Idle',prefix+'Loop'].includes(last))this.transition(prefix+'End');else{
    super.idle();const until=this.u.mem.regularBornUntil??0;if(this.b.time+1e-7<until)this.phase={kind:'born',until};
   }
  }finally{this.ending=false;}}
 begin(t){if(!this.inMode())return super.begin(t);this.face(t);if(this.u.dir==='DOWN')this.facing='DOWN';const clip=this.prefix()+'Loop',delay=this.model().eventPayloads[clip][0].time,
   speed=Math.min(1,this.u.base.bat/this.u.s.interval),period=Math.max(this.u.s.interval,delay/speed),slow=this.u.s.slowDownRate;
  this.phase={kind:'attack',s2:true,activation:this.u.skill.activations,target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,startedAt:this.b.time,lastAt:this.b.time,age:0,speed,releaseAge:delay,untilAge:period*speed,
   releaseAt:slow>0?this.b.time+delay/speed/slow:Infinity,until:slow>0?this.b.time+period/slow:Infinity,released:false,accepted:false};this.u.atkCd=period;this.visual(clip,speed*slow);
 }
 admit(ts){return(!this.phase?.s2||this.inMode()&&this.phase.activation===this.u.skill.activations)&&super.admit(ts);}
 performReceipt(ts){return this.b.forceAttack(this.u,ts,{noAmmo:this.inMode()});}
 tick(){if(!this.valid())return;if(this.phase?.kind==='transition'){if(this.b.time+1e-7<this.phase.until)return;this.phase=null;this.idle();}super.tick();}
 install(){super.install();this.shields.install();this.handles.push(this.b.on('beforeBuff',c=>{const e=this.pendingModes.get(c.buff.onRemove);
  if(e&&(!this.valid()||!this.u.skill.active||e.life!==this.u.deploySeq||e.activation!==this.u.skill.activations||e.lease!==this.modeLease))c.cancel=true;
 },{owner:this.u,priority:-1000000}));}
 stop(end=false){if(!this.stopped){if(this.u.skill.active)this.u.skill.end('controller-stopped');this.shields.stop();}super.stop(end);}
 spec(){return{kind:'ammo',ammo:this.record.bb.trigger_time,duration:0,silenceable:false,manualCancel:true,trigger:{rule:'NEVER'},attack:{},
  canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end(),onAttack:c=>{c.noAmmo=true;}};}
}
export function prepareMechanistS2(b,u,{contract}={}){
 if(contract!==MCNIST_S2_CONTRACT||u.def.charId!==ID||u.def.skill?.id!=='skchr_mcnist_2'||u.mem.mcnistAttacks)throw Error('Fresh selected Mechanist S2 and explicit contract required');verify();
 const resources=prepareMechanistAttackInputs(b,u),controller=new MechanistS2(b,u,resources);u.mem.mcnistAttacks=controller;
 const install=controller.install.bind(controller);controller.install=()=>{resources.install();install();};
 return{resources,record:resources.record,controller,shields:controller.shields,kit:{talents:[],trait:controller.profile(),skill:controller.spec()}};
}
