// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import {TaraxaOrdinaryHeals,TARAXA_ORDINARY_CONTRACT} from './arkpedia-taraxa-ordinary.js';
import {TaraxaAura,TARAXA_AURA_CONTRACT} from './arkpedia-taraxa-aura.js';
import {TaraxaFlight,TARAXA_FLIGHT_CONTRACT} from './arkpedia-taraxa-flight.js';
import {TaraxaSkillTwoHeals,TARAXA_S2_HEALS_CONTRACT} from './arkpedia-taraxa-s2-heals.js';
import {selectedTaraxaInputs,taraxaNativeInputs,taraxaSourceComponent,TARAXA_ID as ID} from './arkpedia-taraxa-source.js';
export const TARAXA_S2_CONTRACT=Object.freeze({
 scope:'Selected original Taraxacum ordinary heals, aura, original flight modes and manual S2 primary/secondary/splash healing; no public admission.',
 mapping:'The original timed manual account includes unscaled Begin and holds all SP until its selected duration expires. Its independently accepted mode buff owns takeoff/landing. Mode5 separately admits source additive-percentage ATK and the second-heal passive. Each primary acquisition retains one legal injured input life; the source-capped sampled BAT/interval clock releases one accepted attack at the original Skill_2_Loop .6 marker. An air-blocking retained primary may emit one distinct current secondary through the accepted passive; primary-only arrival splash remains an independent payload. The original looping Skill_2_Loop track is retained; Idle maps to Skill_2_Idle and Die to Skill_Die while mode5. Loop presentation returns to Idle at its actual source animation end even while the existing cooldown remains positive. Control cancels unfired work without resetting an existing cooldown; the timed account and world-clock flight continue. Mode/attribute/passive veto or dispel retains separate ownership; account expiry starts End and allows SP recovery during landing. Born payloads survive account/mode/source retirement with explicit source-life snapshots.',
 limitations:'The ordinary, aura, flight and S2-healing contracts retain their local mappings. Account/animation/FSM scheduling, cooldown continuity, native selector aliases and source-invalid dispatch remain bounded simulator interpretations. Modules, original public art/data/browser acceptance, native effects/audio and compiled/game-frame/pixel parity remain pending.',frameParity:false,
});
export function verifyTaraxaS2(n=taraxaNativeInputs()){
 const a=n.modes[5].attack,s=n.s2,atk=n.modes[5].abilities[1]._buffs[0],events=n.templates['taraxa_s2[mode]'].eventToActions;
 const hook=taraxaSourceComponent('characters',ID,'-8897142289103914820'),passive=taraxaSourceComponent('characters',ID,'8114612629470640316')._buffs[0];
 if(a._animKey!=='Skill_2_Loop'||a._endAnimKey!=='Idle'||a._selectTargetSource!==1||a._selectTargetTiming!==0
  ||a._timeMode!==0||a._affectedBySlowDown!==0||a._maxAnimScale!==1||a._useCachedAtkOnly!==0
  ||a._waitForAttackEvent!==1||a._projectileKey!=='projectile_chr_taraxa_s2_1'
  ||evidence.chararts[ID][0].data._animations.find(a=>a.animKey==='Skill_2_Loop')?.loop!==1
  ||s._playSkillBeginAnim!==0||s._allowSpRecoveryWhenAffecting!==0||s._allowNoTarget!==1||s._canCastDuringBorn!==1
  ||s._canSilenced!==0||s._stopAffectOnInterrupt!==0||atk.buffKey!=='taraxa_s2[atk]'
  ||atk.attributes.attributeModifiers[0].attributeType!==1||atk.attributes.attributeModifiers[0].formulaItem!==1
  ||passive.buffKey!=='taraxa_s2[second_heal]'||passive.lifeTimeType!==2||passive.isSilenceable!==0
  ||events.ON_BUFF_START[0]._modeIndex!==4||events.ON_BUFF_FINISH[0]._modeIndex!==6
  ||JSON.stringify(hook._replaceAnimPairs)!==JSON.stringify([{fromAnimKey:'Idle',toAnimKey:'Skill_2_Idle'},{fromAnimKey:'Die',toAnimKey:'Skill_Die'}]))
  throw Error('Changed original Taraxacum S2 controller inputs');
}
export class TaraxaSkillTwo extends TaraxaOrdinaryHeals{
 constructor(b,u,{contract}={}){
  if(contract!==TARAXA_S2_CONTRACT||selectedTaraxaInputs(u).index!==1)throw Error('Original selected Taraxacum S2 and exact contract required');
  super(b,u,{contract:TARAXA_ORDINARY_CONTRACT,mayBegin:()=>true});verifyTaraxaS2();
  this.aura=new TaraxaAura(b,u,{contract:TARAXA_AURA_CONTRACT});this.modeBuff=null;this.atkBuff=null;this.secondaryBuff=null;this.castSerial=0;
  this.payload=new TaraxaSkillTwoHeals(b,u,{contract:TARAXA_S2_HEALS_CONTRACT});
  this.flight=new TaraxaFlight(b,u,{contract:TARAXA_FLIGHT_CONTRACT,onMode:m=>this.modeChanged(m)});
  this.mayBegin=()=>this.flight.mode===0||this.flight.mode===5&&this.u.skill.active;
  this.skillShot={clip:'Skill_2_Loop',isSkill:true,scale:this.record.bb['attack@heal_scale'],tag:'taraxa:s2-primary'};
 }
 owns(buff){return buff?.data?.taraxaS2===this&&this.u.buffs.includes(buff);}
 clearModeResources(){for(const buff of[this.atkBuff,this.secondaryBuff])if(this.owns(buff))this.b.removeBuff(this.u,buff);
  this.atkBuff=this.secondaryBuff=null;}
 visual(clip,speed=1,loop=false){if(clip==='Skill_2_Loop')loop=true;
  if(this.flight?.mode===5&&clip==='Idle')clip='Skill_2_Idle';super.visual(clip,speed,loop);
  if(clip==='Skill_2_Loop')this.u.mem.regularFormVisual.playId=`taraxa:s2:${this.seq}:${++this.visualSeq}`;
  if(this.flight?.mode){this.u.mem.regularFormVisual=this.flight.decorate(this.u.mem.regularFormVisual);
   this.u.mem.regularDeathVisual=this.facing==='UP'?{hide:true,duration:1}:{clip:'Skill_Die',duration:1};}}
 modeResource(key,mods){const buff=this.b.addBuff(this.u,{key:`${key}:${this.seq}`,source:this.u,refresh:'keep',mods,data:{taraxaS2:this}});
  if(!this.owns(buff))return null;if(!this.valid()||this.flight.mode!==5){this.b.removeBuff(this.u,buff);return null;}return buff;}
 modeChanged(mode){this.phase=null;if(mode!==5){this.clearModeResources();if(mode===0)this.aura.tick();return;}
  this.atkBuff=this.modeResource('taraxa_s2[atk]',{atkPct:this.record.bb['attack@atk']});
  if(this.valid()&&this.flight.mode===5)this.secondaryBuff=this.modeResource('taraxa_s2[second_heal]');
 }
 choices(){if(this.flight.mode!==5)return super.choices();const t=this.payload.primary();return t?[t]:[];}
 begin(target){super.begin(target,this.flight.mode===5?this.skillShot:undefined);}
 release(ts,info){if(!this.phase?.shot.isSkill)return super.release(ts,info);
  if(!this.admit(ts)||this.flight.mode!==5||!this.u.skill.active)return false;
  this.phase.accepted=true;return this.payload.launch(ts[0],{attackId:info.attackId,secondary:this.owns(this.secondaryBuff)});
 }
 tick(){super.tick();const p=this.phase;
  if(this.valid()&&p?.shot.isSkill&&this.flight.mode===5&&p.age+1e-7>=this.model().exactDurations.Skill_2_Loop
   &&this.u.mem.regularFormVisual?.clip==='Skill_2_Loop')this.visual('Skill_2_Idle',1,true);
 }
 canCast(){return this.valid()&&!this.u.hidden&&this.u.canAct&&!this.u.s.flags.disarm&&!this.u.skill.active
  &&this.flight.mode===0&&!this.flight.phase;}
 startSkill(){if(!this.valid()||!this.u.skill.active)return;this.phase=null;this.facing=this.u.dir;
  const serial=++this.castSerial,token={owner:this,serial,finished:false};
  const buff=this.b.addBuff(this.u,{key:`taraxa_s2[mode]:${this.seq}:${serial}`,source:this.u,data:{taraxaS2Mode:token},
   onRemove:()=>{token.finished=true;if(this.modeBuff?.data?.taraxaS2Mode===token){this.modeBuff=null;this.flight.land();}}});
  if(buff?.data?.taraxaS2Mode!==token)return;
  if(token.finished||!this.u.buffs.includes(buff)||!this.valid()||!this.u.skill.active||this.castSerial!==serial){if(this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);return;}
  this.modeBuff=buff;this.flight.start();if(this.valid())this.aura.tick();
 }
 skillEnded(){const buff=this.modeBuff;this.modeBuff=null;
  if(buff?.data?.taraxaS2Mode?.owner===this&&this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);
  this.phase=null;if(this.valid())this.flight.land();}
 spec(){const controller=this;return{kind:'duration',duration:this.record.source.duration,silenceable:false,trigger:{rule:'NEVER'},flags:{noSp:true},
  attack:{get isSkill(){return controller.phase?.shot.isSkill===true;}},canActivate:()=>this.canCast(),onStart:()=>this.startSkill(),onEnd:()=>this.skillEnded()};}
 install(){this.aura.install();this.flight.install();super.install();
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move)this.payload.bind();},{owner:this.u}));}
 drain(){super.drain();this.payload.drain();}
 stop(){if(this.stopped)return;super.stop();this.skillEnded();this.clearModeResources();this.flight.stop();this.aura.stop();}
}
export function prepareTaraxaS2(b,u,{contract}={}){
 if(u.mem.taraxa)throw Error('Taraxacum already has a selected controller');
 const controller=new TaraxaSkillTwo(b,u,{contract});u.mem.taraxa=controller;
 return{controller,attacks:controller,aura:controller.aura,flight:controller.flight,payload:controller.payload,
  record:controller.record,kit:{trait:controller.trait(),talents:[],skill:controller.spec()}};
}
