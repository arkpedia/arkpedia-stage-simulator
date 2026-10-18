// SPDX-License-Identifier: GPL-3.0-or-later
import {TaraxaOrdinaryHeals,TARAXA_ORDINARY_CONTRACT,taraxaHealable} from './arkpedia-taraxa-ordinary.js';
import {TaraxaAura,TARAXA_AURA_CONTRACT} from './arkpedia-taraxa-aura.js';
import {TaraxaFlight,TARAXA_FLIGHT_CONTRACT} from './arkpedia-taraxa-flight.js';
import {selectedTaraxaInputs,taraxaNativeInputs,taraxaSourceComponent,TARAXA_ID as ID} from './arkpedia-taraxa-source.js';
import {COLS} from '../constants.js';
export const TARAXA_S1_CONTRACT=Object.freeze({
 scope:'Selected Taraxacum ordinary healing, owned aura, flight transitions and manual S1 random-recipient direct healing; no S2 or public admission.',
 mapping:'The original timed account starts at manual activation, including Begin, and holds all SP while active. An independently accepted mode buff starts takeoff; its finish starts landing. Mode2 independently admits the original FINAL_SCALER attack-time multiplier, applies ASPD once and acquires one random injured legal ally per sampled attack interval. The empty ability animation maps to a zero-offset direct heal receipt at acquisition; it neither creates the ordinary projectile nor restarts the continuously looping original Skill_1_Loop. A captured input life and one accepted receipt gate each heal. Control cancels unborn work with positive cooldown preserved; the source account and flight transitions continue. Mode/attack-time rejection and removal retain separate ownership. Skill account expiry begins original End; SP may recover after the account ends, during landing.',
 limitations:'Random selector23, native no-animation ability/zero event scheduling, account-versus-mode ordering, control/cooldown behavior and FINAL_SCALER interpretation are explicit local mappings. The flight, aura and ordinary contracts retain their limits. S2, original-art/data/browser admission, modules, native effects/audio and compiled/frame/pixel parity remain pending.',frameParity:false,
});
export function verifyTaraxaS1(n=taraxaNativeInputs()){
 const a=n.modes[2].attack,s=n.s1,selector=taraxaSourceComponent('characters',ID,'-2282049925449385796');
 const mod=n.modes[2].abilities[0]._buffs[0],events=n.templates['taraxa_s1[mode]'].eventToActions;
 if(a._animKey!==''||a._projectileKey!=null||a._faceToTarget!==0||a._timeMode!==0||a._waitForAttackEvent!==1
  ||a._selectTargetSource!==2||a._selectTargetTiming!==0||a._affectedBySlowDown!==0||a._ignoreHealFree!==0
  ||s._allowSpRecoveryWhenAffecting!==0||s._allowNoTarget!==1||s._canCastDuringBorn!==1||s._canSilenced!==0
  ||s._stopAffectOnInterrupt!==0||s._playSkillBeginAnim!==0||selector._postFilter!==23||selector._maxNum!==1
  ||selector._excludeOwner!==0||selector._ignoreHealFree!==0||mod.buffKey!=='taraxa_s1[atk_time]'
  ||mod.attributes.attributeModifiers[0].attributeType!==8||mod.attributes.attributeModifiers[0].formulaItem!==3
  ||events.ON_BUFF_START[0]._modeIndex!==1||events.ON_BUFF_FINISH[0]._modeIndex!==3)
  throw Error('Changed original Taraxacum S1 inputs');
}
export class TaraxaSkillOne extends TaraxaOrdinaryHeals{
 constructor(b,u,{contract}={}){
  if(contract!==TARAXA_S1_CONTRACT||selectedTaraxaInputs(u).index!==0)throw Error('Original selected Taraxacum S1 and exact contract required');
  super(b,u,{contract:TARAXA_ORDINARY_CONTRACT,mayBegin:()=>true});verifyTaraxaS1();
  this.aura=new TaraxaAura(b,u,{contract:TARAXA_AURA_CONTRACT});this.modeBuff=null;this.batBuff=null;this.castSerial=0;
  this.flight=new TaraxaFlight(b,u,{contract:TARAXA_FLIGHT_CONTRACT,onMode:m=>this.modeChanged(m)});
  this.mayBegin=()=>this.flight.mode===0||this.flight.mode===2&&this.u.skill.active;
  this.skillShot={isSkill:true,scale:this.record.bb['attack@heal_scale'],tag:'taraxa:s1'};
 }
 visual(clip,speed=1,loop=false){super.visual(clip,speed,loop);
  if(this.flight?.mode){this.u.mem.regularFormVisual=this.flight.decorate(this.u.mem.regularFormVisual);
   this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Skill_Die',duration:1};}}
 idle(){if(this.flight.mode===2){if(this.u.mem.regularFormVisual?.clip!=='Skill_1_Loop')this.flight.visual('Skill_1_Loop',true);}
  else super.idle();}
 modeChanged(mode){this.phase=null;
  if(mode!==2){const buff=this.batBuff;this.batBuff=null;if(buff?.data?.taraxaS1===this&&this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);return;}
  const buff=this.b.addBuff(this.u,{key:`taraxa_s1[atk_time]:${this.seq}`,source:this.u,refresh:'keep',
   mods:{batMul:this.record.bb['attack@base_attack_time']},data:{taraxaS1:this}});
  if(buff?.data?.taraxaS1!==this)return;
  if(!this.valid()||this.flight.mode!==2){this.b.removeBuff(this.u,buff);return;}this.batBuff=buff;
 }
 choices(){if(this.flight.mode!==2)return super.choices();
  if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const candidates=this.b.allyUnits.filter(t=>taraxaHealable(this.b,this.u,t)&&t.hp<t.s.maxHp-1e-8
   &&this.u.rangeKeySet.has(t.tileR*COLS+t.tileC));
  const t=this.b.rng.pick(candidates);return t?[t]:[];
 }
 begin(target){if(this.flight.mode!==2)return super.begin(target);
  this.phase={target,life:target.deploySeq,epoch:this.u.attackControlEpoch,shot:this.skillShot,speed:1,
   releaseAge:0,age:0,lastAt:this.b.time,untilAge:this.u.s.interval,released:true,accepted:false};
  this.u.atkCd=this.u.s.interval;this.accepting=true;
  try{this.b.forceAttack(this.u,[target]);}finally{this.accepting=false;}
 }
 release(ts,info){if(!this.phase?.shot.isSkill)return super.release(ts,info);
  if(!this.admit(ts)||this.flight.mode!==2||!this.u.skill.active)return false;
  const p=this.phase,t=ts[0];p.accepted=true;
  this.b.heal(this.u,t,this.u.s.atk*this.u.s.atkScaleMul*p.shot.scale,{isSkill:true,isAttack:true,
   attackId:info.attackId,tags:[p.shot.tag]});return true;
 }
 canCast(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active
  &&this.flight.mode===0&&!this.flight.phase;}
 startSkill(){if(!this.valid()||!this.u.skill.active)return;this.phase=null;this.facing=this.u.dir;
  const serial=++this.castSerial,token={owner:this,serial,finished:false};
  const buff=this.b.addBuff(this.u,{key:`taraxa_s1[mode]:${this.seq}:${serial}`,source:this.u,data:{taraxaS1Mode:token},
   onRemove:()=>{token.finished=true;if(this.modeBuff?.data?.taraxaS1Mode===token){this.modeBuff=null;this.flight.land();}}});
  if(buff?.data?.taraxaS1Mode!==token)return;
  if(token.finished||!this.u.buffs.includes(buff)||!this.valid()||!this.u.skill.active||this.castSerial!==serial){if(this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);return;}
  this.modeBuff=buff;this.flight.start();
 }
 skillEnded(){const buff=this.modeBuff;this.modeBuff=null;
  if(buff?.data?.taraxaS1Mode?.owner===this&&this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);
  this.phase=null;if(this.valid())this.flight.land();}
 spec(){const controller=this;return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},attack:{get isSkill(){return controller.phase?.shot.isSkill===true;}},
  canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.aura.install();this.flight.install();super.install();}
 stop(){if(this.stopped)return;super.stop();this.skillEnded();this.modeChanged(0);this.flight.stop();this.aura.stop();}
}
export function prepareTaraxaS1(b,u,{contract}={}){
 if(u.mem.taraxa)throw Error('Taraxacum already has a selected controller');
 const controller=new TaraxaSkillOne(b,u,{contract});u.mem.taraxa=controller;return{controller,attacks:controller,aura:controller.aura,flight:controller.flight,
  record:controller.record,kit:{trait:controller.trait(),talents:[],skill:controller.spec()}};
}
