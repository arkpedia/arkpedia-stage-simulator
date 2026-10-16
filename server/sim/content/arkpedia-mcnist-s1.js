// SPDX-License-Identifier: GPL-3.0-or-later
// Source-selected three-ammo, five-pulse area volleys. Public admission remains held.
import {MechanistAttackClock,prepareMechanistAttackInputs} from './arkpedia-mcnist-attacks.js';
import {MCNIST_ID as ID,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {canTargetEnemy} from '../targeting.js';
export const MCNIST_S1_CONTRACT=Object.freeze({
 scope:'Selected Mechanist offensive-auto S1 with three ammunition receipts, native five-pulse area projectiles and ordinary/McGraf lifecycle composition; no public admission',
 mapping:'SP-full automatic mode can start without an enemy or during birth. The native missing Begin strings remain recorded without a fabricated Spine track or invented wait. Its accepted mode buff adds selected base_attack_time to BAT. One current legal primary is selected again at the original Skill_1/Skill_Down_1 release marker. Each accepted projectile birth spends one ammo receipt, never one per area victim or pulse, and gains no attack SP. The final ammo mode stays active until its attack period finishes; manual discard ends pending work immediately. Born speed-twenty projectiles survive source departure and reach a last position after primary loss. Arrival creates a fixed 1.1-radius field with immediate first pulse and four later .2-second pulses within the retained 1.3-second lifetime. Each pulse independently selects current ground/air bodies, bypasses camouflage and preserves stealth/target-free/sleep legality. Born fields retain their captured selected coefficient and use live same-life ATK, falling back to birth ATK after source departure.',
 limits:'Missing native Begin dispatch, mode/FSM reset versus cooldown priority, final-ammo completion, arrival-first area sampling, last-position travel, five-pulse interpretation of limitedHitTimes/keepAlreadyHitTime, radial geometry, effect lifetime and live/cached damage transport are explicit local policies. Native selector checks during flight and exact compiled hit-budget dispatch are not certified. Native particles/audio, modules, S2/S3 and original game-frame/pixel parity remain unverified. No public roster approval.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
function verify(){const n=mechanistNativeInputs(),a=n.s1Attack,s=n.s1,count=mechanistSourceComponent('characters',ID,'-6010575035351756328');
 const c=(key,id)=>mechanistSourceComponent('projectiles',key,id),root=c('projectile_chr_mcnist_s1','3128562375961223714'),move=c('projectile_chr_mcnist_s1','6052593143831077410'),area=c('projectile_chr_mcnist_s1','2460901182510473762');
 if(s._showSpAsBulletMode!==1||s._canDiscardRemainingCount!==1||s._finishSkillWithProgress!==1||s._allowSpRecoveryWhenAffecting!==0
  ||s._beginAnim!=='mcnist_skill_01_start_01'||s._beginAnimDown!=='mcnist_skill_01_start_01_down'||s._canCastDuringBorn!==1||s._allowNoTarget!==1
  ||a._selectTargetSource!==1||a._selectTargetTiming!==1||a._animKey!=='Skill_1'||a._downAnimKey!=='Skill_Down_1'||a._waitForAttackEvent!==1||a._maxAnimScale!==1
  ||count._countEvent!==4||count._expendPerTrigger!==1||count._resetWhenAttackFinished!==1||move._speed!==20||root._stopWhenSourceInvalid!==0||root._alwaysReachInTheEnd!==1
  ||area._intervalBbKey!=='interval'||area._limitedHitTimesBbKey!=='times'||area._waitFirstPeriod!==0||area._stopWhenLimitedHitTimesUsedUp!==0
  ||c('projectile_chr_mcnist_s1','6315536701375062562')._forceIgnoreCamouflage!==1)throw Error('Changed Mechanist native S1 mode/projectile graph');
}
export class MechanistS1 extends MechanistAttackClock{
 constructor(b,u,resources){super(b,u,{resources});this.record=resources.record;this.modeBuff=null;this.modeKey=`mcnist:s1:${u.id}`;this.fields=new Set();this.fieldHandles=[];this.ending=false;}
 inMode(){return this.u.skill.active&&this.modeBuff!=null&&this.u.findBuff(this.modeKey)===this.modeBuff;}
 canCast(){return this.valid()&&this.u.canAct&&!this.u.hidden&&!this.u.skill.active;}
 start(){const{b,u}=this;const buff=b.addBuff(u,{key:this.modeKey,source:u,mods:{batFlat:this.record.bb.base_attack_time},onRemove:({buff})=>{
  if(this.modeBuff===buff){this.modeBuff=null;if(u.skill.active&&!this.ending)u.skill.end('mode-removed');}}});
  if(!buff||!this.valid()||!u.skill.active){if(buff)b.removeBuff(u,buff);if(u.skill.active)u.skill.end('mode-rejected');return;}
  this.modeBuff=buff;if(this.phase?.kind!=='born'){this.phase=null;this.idle();}
 }
 end(){this.ending=true;try{const old=this.modeBuff;this.modeBuff=null;if(old)this.b.removeBuff(this.u,old);if(this.phase?.s1)this.phase=null;if(this.valid())this.idle();}finally{this.ending=false;}}
 begin(t){if(!this.inMode())return super.begin(t);if(this.u.skill.ammoLeft<=0){this.u.skill.end('ammo-finished');return super.begin(t);}
  this.face(t);const clip=this.facing==='DOWN'?'Skill_Down_1':'Skill_1',delay=this.model().eventPayloads[clip][0].time,
   speed=Math.min(1,(this.u.base.bat+this.record.bb.base_attack_time)/this.u.s.interval),period=Math.max(this.u.s.interval,delay/speed),slow=this.u.s.slowDownRate;
  this.phase={kind:'attack',s1:true,activation:this.u.skill.activations,target:t,life:t.deploySeq,epoch:this.u.attackControlEpoch,startedAt:this.b.time,lastAt:this.b.time,age:0,speed,
   releaseAge:delay,untilAge:period*speed,releaseAt:slow>0?this.b.time+delay/speed/slow:Infinity,until:slow>0?this.b.time+period/slow:Infinity,released:false,accepted:false};
  this.u.atkCd=period;this.visual(clip,speed*slow);
 }
 admit(ts){const p=this.phase;if(!p?.s1)return super.admit(ts);return this.accepting&&this.valid()&&this.inMode()&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.hidden&&!p.accepted
  &&p.activation===this.u.skill.activations&&p.epoch===this.u.attackControlEpoch&&p.age+1e-7>=p.releaseAge&&this.u.skill.ammoLeft>0
  &&ts.length===1&&p.target===ts[0]&&p.life===ts[0].deploySeq&&this.legal(ts[0]);}
 release(ts,info){if(!this.phase?.s1)return super.release(ts,info);if(!this.admit(ts))return false;
  const phase=this.phase,u=this.u,b=this.b,t=ts[0],sourceLife=u.deploySeq,birthAtk=u.s.atk*u.s.atkScaleMul,scale=this.record.bb['attack@atk_scale'];phase.accepted=true;this.s1Receipt=true;
  const p=b.addProjectile({from:u,target:t,source:u,speed:20,maxAge:10,hitDead:true,visual:'bolt',data:{arkpediaTrackedVisual:true,mcnistOwner:u.id,mcnistS1:true},onHit:({x,y})=>{
   this.flights.delete(p);if(!this.flights.size)this.unwatchFlights();if(b.finished)return;this.field({x,y,sourceLife,birthAtk,scale,attackId:info.attackId});
  }});this.flights.add(p);this.watchFlights();return true;
 }
 spend(c){const p=this.phase;if(!p?.s1||!p.accepted||p.spent)return;p.spent=true;
  if(!c.noAmmo){this.u.skill.ammoLeft=Math.max(0,this.u.skill.ammoLeft-1);if(this.b._hooks.ammoUsed)this.b.emit('ammoUsed',{unit:this.u,left:this.u.skill.ammoLeft,skill:this.u.skill});}
  c.noAmmo=true;
 }
 field(values){const f={...values,bornAt:this.b.time,next:this.b.time,pulses:0,until:this.b.time+this.record.bb['attack@projectile_delay_time']};this.fields.add(f);this.fieldTick();this.watchFields();}
 watchFields(){if(this.fieldHandles.length||!this.fields.size)return;this.fieldHandles=[this.b.on('tick',()=>this.fieldTick()),this.b.on('battleEnd',()=>{this.fields.clear();this.unwatchFields();})];}
 unwatchFields(){for(const h of this.fieldHandles)this.b.off(h);this.fieldHandles=[];}
 fieldTick(){const b=this.b,u=this.u,r=this.record.bb;
  for(const f of [...this.fields]){
   while(!b.finished&&f.pulses<r['attack@times']&&b.time+1e-7>=f.next&&f.next<=f.until+1e-7){f.pulses++;f.next+=r['attack@interval'];
    const targets=b.foesInRadius(f.x,f.y,r['attack@projectile_range']);
    for(const t of targets){if(b.finished||!this.fields.has(f))break;if(!canTargetEnemy(u,t,{canHitFly:true}))continue;
     const atk=present(u)&&u.deploySeq===f.sourceLife?u.s.atk*u.s.atkScaleMul:f.birthAtk;
     b.dealDamage(u,t,{amount:atk*f.scale,type:'phys',isAttack:true,isSkill:true,isSplash:true,attackId:f.attackId,applyWay:'ranged',tags:['mcnist:s1-burst']});}
   }
   if(b.finished||b.time+1e-7>=f.until)this.fields.delete(f);
  }
  if(!this.fields.size)this.unwatchFields();
 }
 tick(){if(!this.valid())return;const u=this.u;if(u.skill.ready&&this.canCast())u.skill.activate('DEFAULT');let p=this.phase;
  // Native S1 selects at its release marker; base admission still owns the
  // exact accepted identity after that one late selection.
  if(p?.s1&&!p.released){const projected=p.age+Math.max(0,this.b.time-p.lastAt)*p.speed*u.s.slowDownRate;
   if(projected+1e-7>=p.releaseAge){const t=this.choices()[0];if(t){p.target=t;p.life=t.deploySeq;}else p.released=true;}}
  try{super.tick();}finally{this.s1Receipt=false;}
  if(this.valid()&&u.skill.active&&u.skill.ammoLeft<=0&&p?.s1&&p.released
   &&(p.age+1e-7>=p.untilAge||this.phase!==p))u.skill.end('ammo-finished');
 }
 install(){super.install();this.handles.push(this.b.on('spGain',c=>{
  // A post-launch callback can end the live mode before shared attack-SP
  // accounting. That receipt still belongs to S1 and cannot recharge itself.
  if(c.unit===this.u&&c.reason==='attack'&&this.s1Receipt)c.amount=0;
 },{owner:this.u,priority:-1000000}));}
 stop(end=false){if(end){this.fields.clear();this.unwatchFields();}if(!this.stopped){if(this.u.skill.active)this.u.skill.end('controller-stopped');this.ending=true;const old=this.modeBuff;this.modeBuff=null;if(old)this.b.removeBuff(this.u,old);this.ending=false;}super.stop(end);}
 spec(){return{kind:'ammo',ammo:this.record.bb['attack@trigger_time'],duration:0,silenceable:false,manualCancel:true,trigger:{rule:'NEVER'},attack:{},
  canActivate:()=>this.canCast(),onStart:()=>this.start(),onEnd:()=>this.end(),onAttack:c=>this.spend(c)};}
}
export function prepareMechanistS1(b,u,{contract}={}){
 if(contract!==MCNIST_S1_CONTRACT||u.def.charId!==ID||u.def.skill?.id!=='skchr_mcnist_1'||u.mem.mcnistAttacks)throw Error('Fresh selected Mechanist S1 and explicit contract required');verify();
 const resources=prepareMechanistAttackInputs(b,u),controller=new MechanistS1(b,u,resources);u.mem.mcnistAttacks=controller;
 const install=controller.install.bind(controller);controller.install=()=>{resources.install();install();};
 return{resources,record:resources.record,controller,kit:{talents:[],trait:controller.profile(),skill:controller.spec()}};
}
