// SPDX-License-Identifier: GPL-3.0-or-later
// Owner mode only; the separate charge/replacement lifecycle remains held.
import evidence from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import {MechanistAttackClock,prepareMechanistAttackInputs} from './arkpedia-mcnist-attacks.js';
import {MCNIST_ID as ID,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {acquireTargets,effectiveProfile} from '../ai.js';
import {canTargetEnemy,sortEnemyTargets,absoluteRangeKeys} from '../targeting.js';
import {bodyKeys} from '../body.js';
export const MCNIST_S3_OWNER_CONTRACT=Object.freeze({
 scope:'Selected Mechanist S3 owner ATK/BAT mode, original animation clock and cross-tile Arts attacks; no token charge/lifecycle or public admission',
 mapping:'The forty-second manual mode adds selected ATK percentage and 2.3 seconds BAT. Original Begin reserves world time and remaining birth; original Loop OnAttack releases one accepted owner attack. A captured legal primary may come from the owner range or a current registered McGraf blocker. Release samples that primary current root tile and the original x-6 cross range. One area burst hits current legal ground/air bodies on those tiles, bypassing camouflage for collateral; primary selection retains ordinary camouflage rules. Area damage uses the selected owner attack coefficient and live same-life ATK, with a captured fallback after source departure. One accepted primary receipt remains one attack event regardless of victims. End preserves positive ordinary cooldown and uses only original exit mixes.',
 limits:'The original target-tile projectile maps to one immediate release-time cross sample; compiled projectile reach/lifetime dispatch, native token-blocked selection priority, root-tile/body overlap, area damage transport and callback order remain local interpretations. Native Begin/End world clocks and cooldown ordering are not game-frame parity. This component deliberately does not launch McGraf or admit a complete S3 skill, token lifecycle or public operator. Particles/audio and modules remain unverified.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
function verify(){const n=mechanistNativeInputs(),s=n.s3,a=n.s3Attack,mode=mechanistSourceComponent('skills','skchr_mcnist_3','3351811282839015816')._buffs[0],
 p=mechanistSourceComponent('projectiles','projectile_chr_mcnist_s3','6215136286840170807'),select=mechanistSourceComponent('projectiles','projectile_chr_mcnist_s3','9158941299939453239');
 const combat=n.s3Combat,blocked=mechanistSourceComponent('characters',ID,'7734260249030431192');
 if(['_animKey','_endAnimKey','_selectTargetSource','_selectTargetTiming','_waitForAttackEvent','_affectedBySlowDown','_timeMode','_maxAnimScale','_damageType','_projectileDestination','_projectileKey'].some(k=>combat[k]!==a[k])
  ||blocked._onlyBlockedTargets!==1||blocked._maxNum!==1||blocked._targetMotion!==3||blocked._withoutSecondaryFilter!==1
  ||s._attackBlackboardModeIndex!==4||s._rangeIdModeIndex!==4||s._beginAnim!=='Skill_3_Begin'||s._canCastDuringBorn!==1||s._allowNoTarget!==1||s._resetAbilityCooldownWhenCastEnd!==0
  ||mode.buffKey!=='mcnist_s_3'||mode.blackboard[0].value!==4||mode.attributes.attributeModifiers.map(v=>`${v.attributeType}:${v.formulaItem}`).join(',')!=='1:1,8:0'
  ||a._animKey!=='Skill_3_Loop'||a._endAnimKey!=='Skill_3_Idle'||a._selectTargetSource!==2||a._selectTargetTiming!==0||a._waitForAttackEvent!==1
  ||a._affectedBySlowDown!==1||a._timeMode!==0||a._maxAnimScale!==1||a._damageType!==2||a._projectileDestination!==3||a._projectileKey!=='projectile_chr_mcnist_s3'
  ||p._lifeTime!==0.800000011920929||p._canHitSameTargetMultipleTimes!==0||p._stopWhenSourceInvalid!==0
  ||select._onlyCheckHitWhenReachTarget!==1||select._ignoreCamouflage!==1||select._targetOptions.targetMotion!==3)throw Error('Changed native Mechanist S3 owner graph');
}
export class MechanistS3Owner extends MechanistAttackClock{
 constructor(b,u,resources){super(b,u,{resources});this.record=resources.record;this.modeKey=`mcnist:s3:owner:${u.id}`;this.modeBuff=null;this.modeLease=0;this.pendingModes=new Map();this.ending=false;this.bursts=0;}
 inMode(){return this.valid()&&this.u.skill.active&&this.modeBuff!=null&&this.u.findBuff(this.modeKey)===this.modeBuff;}
 idle(){if(!this.inMode())return super.idle();this.facing=this.u.dir;this.visual('Skill_3_Idle',1,true);}
 canCast(){return this.valid()&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active&&this.phase?.kind!=='transition';}
 transition(clip){this.facing=this.u.dir;this.phase={kind:'transition',until:Math.max(this.b.time+this.model().exactDurations[clip],this.u.mem.regularBornUntil??0)};this.visual(clip);}
 start(){const u=this.u,activation=u.skill.activations,lease=++this.modeLease,remove=({buff})=>{if(this.modeBuff===buff){this.modeBuff=null;if(u.skill.active&&!this.ending)u.skill.end('mode-removed');}};
  this.pendingModes.set(remove,{activation,lease,life:u.deploySeq});let buff;
  try{buff=this.b.addBuff(u,{key:this.modeKey,source:u,mods:{atkPct:this.record.bb.atk,batFlat:this.record.bb.base_attack_time},onRemove:remove});}finally{this.pendingModes.delete(remove);}
  if(activation!==u.skill.activations||lease!==this.modeLease){if(buff)this.b.removeBuff(u,buff);return;}
  if(!buff||!this.valid()||!u.skill.active){if(buff)this.b.removeBuff(u,buff);if(u.skill.active)u.skill.end('mode-rejected');return;}
  this.modeBuff=buff;this.transition('Skill_3_Begin');
 }
 end(){this.modeLease++;this.ending=true;const last=this.u.mem.regularFormVisual?.clip;
  try{const old=this.modeBuff;this.modeBuff=null;if(old)this.b.removeBuff(this.u,old);if(!this.valid())return;this.phase=null;
   if(['Skill_3_Idle','Skill_3_Loop'].includes(last))this.transition('Skill_3_End');else{super.idle();const until=this.u.mem.regularBornUntil??0;if(this.b.time+1e-7<until)this.phase={kind:'born',until};}
  }finally{this.ending=false;}
 }
 choices(){if(!this.inMode())return super.choices();if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const prof={...effectiveProfile(this.u),canHitFly:true,allInRange:true,hitAllBlocked:false,canTarget:(_u,t)=>!t.s.flags.camou||!!t.blockedBy};
  const ts=acquireTargets(this.b,this.u,prof);
  for(const[t,r]of this.resources.tokens)if(present(t)&&r.life===t.deploySeq)for(const e of t.blocking)if(e.blockedBy===t&&this.legal(e)&&!ts.includes(e))ts.push(e);
  return sortEnemyTargets(this.b,this.u,ts,prof.priority).slice(0,1);
 }
 begin(t){if(!this.inMode())return super.begin(t);this.face(t);const delay=this.model().eventPayloads.Skill_3_Loop[0].time,
  speed=Math.min(1,(this.u.base.bat+this.record.bb.base_attack_time)/this.u.s.interval),period=Math.max(this.u.s.interval,delay/speed),slow=this.u.s.slowDownRate;
  this.phase={kind:'attack',s3:true,activation:this.u.skill.activations,target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,startedAt:this.b.time,lastAt:this.b.time,age:0,speed,releaseAge:delay,untilAge:period*speed,
   releaseAt:slow>0?this.b.time+delay/speed/slow:Infinity,until:slow>0?this.b.time+period/slow:Infinity,released:false,accepted:false};this.u.atkCd=period;this.visual('Skill_3_Loop',speed*slow);
 }
 admit(ts){return(!this.phase?.s3||this.inMode()&&this.phase.activation===this.u.skill.activations)&&super.admit(ts);}
 release(ts,info){if(!this.phase?.s3)return super.release(ts,info);if(!this.admit(ts))return false;this.phase.accepted=true;this.bursts++;
  const u=this.u,b=this.b,sourceLife=u.deploySeq,birthAtk=u.s.atk*u.s.atkScaleMul,scale=this.record.bb['attack@atk_scale'],primary=ts[0],row=Math.round(primary.y),col=Math.round(primary.x),
   grid=evidence.tables.ranges[this.record.bb['attack@projectile_range']].grids.map(g=>[g.row,g.col]),keys=new Set(absoluteRangeKeys(grid,row,col,'RIGHT'));
  const targets=b.enemies.filter(t=>canTargetEnemy(u,t,{canHitFly:true})&&bodyKeys(t).some(k=>keys.has(k))).map(t=>({t,life:t.deploySeq}));
  for(const{t,life}of targets){if(b.finished)break;if(t.deploySeq!==life||!canTargetEnemy(u,t,{canHitFly:true}))continue;
   const atk=present(u)&&u.deploySeq===sourceLife?u.s.atk*u.s.atkScaleMul:birthAtk;
   b.dealDamage(u,t,{amount:atk*scale,type:'arts',isAttack:true,isSkill:true,isSplash:true,attackId:info.attackId,applyWay:'ranged',tags:['mcnist:s3-owner']});
  }return true;
 }
 tick(){if(!this.valid())return;if(this.phase?.kind==='transition'){if(this.b.time+1e-7<this.phase.until)return;this.phase=null;this.idle();}super.tick();}
 install(){super.install();this.handles.push(this.b.on('beforeBuff',c=>{const e=this.pendingModes.get(c.buff.onRemove);if(e&&(!this.valid()||!this.u.skill.active||e.life!==this.u.deploySeq||e.activation!==this.u.skill.activations||e.lease!==this.modeLease))c.cancel=true;},{owner:this.u,priority:-1000000}));}
 stop(end=false){if(!this.stopped&&this.u.skill.active)this.u.skill.end('controller-stopped');super.stop(end);}
 spec(){return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},attack:{dmgType:'arts'},canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end()};}
}
export function prepareMechanistS3Owner(b,u,{contract}={}){
 if(contract!==MCNIST_S3_OWNER_CONTRACT||u.def.charId!==ID||u.def.skill?.id!=='skchr_mcnist_3'||u.mem.mcnistAttacks)throw Error('Fresh selected Mechanist S3 owner and explicit partial owner contract required');verify();
 const resources=prepareMechanistAttackInputs(b,u),controller=new MechanistS3Owner(b,u,resources);u.mem.mcnistAttacks=controller;
 const install=controller.install.bind(controller);controller.install=()=>{resources.install();install();};
 return{resources,record:resources.record,controller,kit:{talents:[],trait:controller.profile(),skill:controller.spec()}};
}
