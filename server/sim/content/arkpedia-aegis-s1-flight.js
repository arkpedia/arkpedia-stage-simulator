// SPDX-License-Identifier: GPL-3.0-or-later
// Held source state component. The ability/account owner supplies phase events.
import {AegisTakeoff,AEGIS_TAKEOFF_CONTRACT} from './arkpedia-aegis-takeoff.js';
import {selectedAegisInputs,aegisNativeInputs,aegisSourceComponent,AEGIS_ID as ID} from './arkpedia-aegis-source.js';
export const AEGIS_S1_FLIGHT_CONTRACT=Object.freeze({
 scope:'Selected original Aegis S1 holder, landing callbacks, independently owned resistible self-stun and explicit takeoff callbacks; no skill account, attacks or public admission.',
 mapping:'An accepted timed holder supplies additive ATK/DEF percentages and ground-evasion immunity, then selects mode1. The ability owner supplies native event2/3 at Begin/return entry and completion: each original zero-duration callback buff is admitted independently. Landing begins a .30000001192092896-second height tween; completion commands WALK, snaps height and selects mode2. Holder finish creates a non-derived, independently resistible self-stun with native MOTION_TARGET_FREE immunity: stun stops actions but does not acquire the shared catalogue noBlock flag. Accepted self-stun selects mode3. Its finish commands WALK; it does not itself command FLY. Takeoff entry commands FLY, explicitly triggers a still-live owned stun controller back to WALK, then raises graphic height. Completion after self-stun removal snaps height and restores mode0. No command is inferred from current height. One deployment life owns each buff/callback; dispel runs accepted native finish actions, while retirement cancels future actions.',
 limitations:'Native event enums, holder duration/start boundary, buff-enable/finish order, automatic resistance/immunity and mapped status callbacks remain explicit local mappings. The outer source ability/FSM owner must dispatch callbacks at verified animation clocks and wait for self-stun before completing return. This component does not invent missing Back stun tracks or implement derived visual-only effects. S1/S2 accounts, selectors, projectile damage, native FX/audio/modules and compiled/frame/pixel parity remain separate.',frameParity:false,
});
const bb=x=>Object.fromEntries(x.blackboard.map(p=>[p.key,p.value]));
const type=(x,key)=>x?.$type?.includes('+'+key+',');
export function verifyAegisS1Flight(n=aegisNativeInputs(),read=aegisSourceComponent){
 const holder=read('skills','skchr_aigis_1','2358012540008865552')._buffs[0],
  parts=['-3543158957696141307','3820189086648973317','-6682646823077857275','-2408147446057125883'].map(id=>read('characters',ID,id)),
  keys=['aigis_s1_landing[begin]','aigis_s1_landing[end]','aigis_s1_takeoff[begin]','aigis_s1_takeoff[end]'],
  t=n.templates,h=t.aigis_s1_holder.eventToActions,stun=h.ON_BUFF_FINISH[1]._buff,s=t.aigis_s1_stun_ctrl.eventToActions,
  [lb,le,tb,te]=keys.map(k=>t[k].eventToActions.ON_BUFF_START);
 if(holder.buffKey!=='aigis_s1_holder'||holder.templateKey!==holder.buffKey||holder.lifeTimeType!==1||holder.durationKey!=='duration'
  ||holder.isSilenceable!==0||holder.isStunnable!==0||holder.attributes.abnormalImmunes.join()!=='35'||bb(holder).mode!==1
  ||JSON.stringify(holder.attributes.attributeModifiers.map(m=>[m.attributeType,m.formulaItem,m.loadFromBlackboard]))!=='[[1,1,1],[2,1,1]]'
  ||parts.some((p,i)=>p._runActionOnEvent!==[2,3,2,3][i]||p._buffs.length!==1||p._buffs[0].buffKey!==keys[i]||p._buffs[0].lifeTimeType!==0)
  ||bb(parts[0]._buffs[0]).height_offset!==0||bb(parts[0]._buffs[0]).height_duration!==.30000001192092896
  ||bb(parts[1]._buffs[0]).height_offset!==0||bb(parts[1]._buffs[0]).mode!==2
  ||bb(parts[2]._buffs[0]).height_offset!==.4000000059604645||bb(parts[2]._buffs[0]).height_duration!==.30000001192092896
  ||bb(parts[3]._buffs[0]).height_offset!==.4000000059604645||bb(parts[3]._buffs[0]).height_duration!==0
  ||h.ON_BUFF_START.length!==1||!type(h.ON_BUFF_START[0],'SwitchMode')||!h.ON_BUFF_START[0]._loadModeFromBlackboard
  ||h.ON_BUFF_FINISH.length!==2||!type(h.ON_BUFF_FINISH[0],'CheckUnitAlive')||h.ON_BUFF_FINISH[1]._isDerivedBuff!==false
  ||stun.buffKey!=='aigis_s1_stun_ctrl'||stun.durationKey!=='stun'||stun.lifeTimeType!=='LIMITED'||stun.statusResistable!=='AUTOMATIC'
  ||stun.attributes.abnormalFlags.join()!=='STUNNED'||stun.attributes.abnormalImmunes.join()!=='MOTION_TARGET_FREE'||bb(stun).mode!==3
  ||s.ON_BUFF_ENABLE.length!==3||!type(s.ON_BUFF_ENABLE[0],'CheckUnitAlive')||!type(s.ON_BUFF_ENABLE[1],'SwitchMode')
  ||s.ON_BUFF_ENABLE[2]._isDerivedBuff!==true||s.ON_BUFF_ENABLE[2]._finishDerivedBuffIfParentFinish!==true
  ||s.ON_BUFF_TRIGGER.length!==4||s.ON_BUFF_TRIGGER[0]._blockMode!=='WALK'||!type(s.ON_BUFF_TRIGGER[2],'FinishDerivedBuff')
  ||s.ON_BUFF_FINISH.length!==1||s.ON_BUFF_FINISH[0]._blockMode!=='WALK'
  ||lb.length!==1||!type(lb[0],'ModifyGraphicHolderHeight')||lb[0]._durationKey!=='height_duration'
  ||le.length!==6||!type(le[0],'CheckUnitAlive')||le[1]._blockMode!=='WALK'||le[3]._durationKey!=='_'||!le[5]._loadModeFromBlackboard
  ||tb.length!==6||!type(tb[0],'CheckUnitAlive')||tb[1]._blockMode!=='FLY'||tb[3]._buffKeys.join()!=='aigis_s1_stun_ctrl'
  ||tb[3]._forceTrigger!==true||tb[3]._triggerAllBuffs!==false||tb[5]._durationKey!=='height_duration'
  ||te.length!==3||te[0]._durationKey!=='height_duration'||te[2]._restoreDefault!==true||te[2]._loadModeFromBlackboard!==false)
  throw Error('Changed original Aegis S1 state inputs');
 return{holder,stun,landingBegin:parts[0]._buffs[0],landingEnd:parts[1]._buffs[0],takeoffBegin:parts[2]._buffs[0],takeoffEnd:parts[3]._buffs[0]};
}
export class AegisSkillOneFlight extends AegisTakeoff{
 constructor(b,u,{contract,onMode=()=>{}}={}){
  if(contract!==AEGIS_S1_FLIGHT_CONTRACT||selectedAegisInputs(u).index!==0||typeof onMode!=='function')throw Error('Fresh selected S1 and exact Aegis state contract required');
  super(b,u,{contract:AEGIS_TAKEOFF_CONTRACT});this.record=selectedAegisInputs(u);this.s1=verifyAegisS1Flight();
  Object.assign(this,{mode:0,onMode,phase:null,holder:null,stun:null,grants:new Set(),serial:0});
 }
 phaseLive(p){return !!p&&this.valid()&&this.phase===p;}
 grantLive(p){return !!p&&!p.finished&&p.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisS1State===p&&this.u.buffs.includes(p.buff);}
 removeGrant(p){if(p?.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisS1State===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 modeTo(mode){if(!this.valid())return false;this.mode=mode;this.onMode(mode);return this.valid()&&this.mode===mode;}
 grant(raw,phase,{duration=0,mods=null,flags=null,status=null,onFinish=()=>{}}={}){
  if(!this.phaseLive(phase))return null;const p={phase,key:`${raw.buffKey}:${this.u.id}:${this.seq}:${++this.serial}`,finished:false,admitted:false,buff:null},
   flagJson=JSON.stringify(flags),modJson=JSON.stringify(mods);let descriptor;
  const admit=(_u,buff)=>this.phaseLive(phase)&&!p.finished&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.aegisS1State===p
   &&JSON.stringify(buff.flags??null)===flagJson&&JSON.stringify(buff.mods??null)===modJson&&(buff.status??null)===status
   &&(buff===descriptor||buff.stacks===1&&buff.timeLeft===duration&&buff.duration===duration))
   &&(!this.u.findBuff(p.key)||this.u.findBuff(p.key).data?.aegisS1State===p);
  const finish=()=>{if(p.finished)return;p.finished=true;this.grants.delete(p);if(p.admitted&&this.phaseLive(phase))onFinish(p);};
  descriptor={key:p.key,duration,mods,flags,status,source:this.u,refresh:'keep',data:{aegisS1State:p},admit,onRemove:finish,onExpire:finish};
  p.buff=this.b.addBuff(this.u,descriptor);
  if(!admit()||!this.grantLive(p)){p.finished=true;this.removeGrant(p);return null;}
  p.admitted=true;this.grants.add(p);return p;
 }
 instant(raw,phase,action){const p=this.grant(raw,phase);if(!p)return false;
  try{action();return this.phaseLive(phase);}finally{p.finished=true;this.grants.delete(p);this.removeGrant(p);}
 }
 beginSkillOne(){if(!this.valid()||this.mode!==0||this.phase)return false;const phase={kind:'landing',takeoffStarted:false};this.phase=phase;
  const p=this.grant(this.s1.holder,phase,{duration:this.record.source.duration,mods:{atkPct:this.record.bb.atk,defPct:this.record.bb.def},flags:{groundEvadeImmune:true},
   onFinish:()=>{if(this.holder===p)this.holder=null;this.createStun(phase);}});
  if(!p){if(this.phase===phase)this.phase=null;return false;}this.holder=p;
  if(!this.modeTo(1)||!this.phaseLive(phase)||!this.grantLive(p))return false;
  this.instant(this.s1.landingBegin,phase,()=>{const x=bb(this.s1.landingBegin);this.heightCommand(x.height_offset,x.height_duration);});
  return this.phaseLive(phase)&&this.grantLive(p);
 }
 completeLanding(){const phase=this.phase;if(!this.phaseLive(phase)||phase.kind!=='landing'||this.mode!==1||!this.grantLive(this.holder))return false;
  let done=false;this.instant(this.s1.landingEnd,phase,()=>{if(!this.blockCommand('WALK')||!this.phaseLive(phase))return;
   this.heightCommand(bb(this.s1.landingEnd).height_offset,0);if(!this.phaseLive(phase))return;
   if(this.modeTo(2)&&this.phaseLive(phase)){phase.kind='active';done=true;}});return done;
 }
 endSkillOne(){if(!this.valid()||!this.grantLive(this.holder))return false;this.removeGrant(this.holder);return true;}
 createStun(parentPhase){if(!this.phaseLive(parentPhase))return null;const phase={kind:'return',takeoffStarted:false};this.phase=phase;
  const u=this.u,b=this.b;if(u.def.immune?.has('stun'))return null;
  let duration=this.record.bb.stun;
  if(b._hooks.beforeStatus){const c=b.emit('beforeStatus',{source:u,target:u,status:'stun',duration,value:undefined,cancel:false,sourceStatusResistable:'AUTOMATIC'});
   if(c.cancel||!this.phaseLive(phase))return null;duration=Number(c.duration);}
  duration*=1-b.resistOf(u);if(!(duration>0)||!Number.isFinite(duration)||!this.phaseLive(phase))return null;
  const entered=!u.buffs.some(x=>x.status==='stun'),p=this.grant(this.s1.stun,phase,{duration,status:'stun',flags:{stun:true},
   onFinish:()=>{if(this.stun===p)this.stun=null;this.blockCommand('WALK');}});
  if(!p)return null;this.stun=p;if(!this.modeTo(3)||!this.phaseLive(phase)||!this.grantLive(p))return null;
  if(b._hooks.statusApplied)b.emit('statusApplied',{source:u,target:u,status:'stun',duration,value:undefined,entered});
  return this.grantLive(p)?p:null;
 }
 triggerStun(){if(!this.valid()||!this.grantLive(this.stun))return false;return this.blockCommand('WALK');}
 beginTakeoff(){const phase=this.phase;if(!this.phaseLive(phase)||phase.kind!=='return'||phase.takeoffStarted||this.mode!==3)return false;
  let done=false;this.instant(this.s1.takeoffBegin,phase,()=>{if(!this.blockCommand('FLY')||!this.phaseLive(phase))return;
   if(this.grantLive(this.stun))this.triggerStun();if(!this.phaseLive(phase))return;
   const x=bb(this.s1.takeoffBegin);this.heightCommand(x.height_offset,x.height_duration);phase.takeoffStarted=true;done=true;});return done;
 }
 completeTakeoff(){const phase=this.phase;if(!this.phaseLive(phase)||phase.kind!=='return'||!phase.takeoffStarted||this.mode!==3||this.grantLive(this.stun))return false;
  let done=false;this.instant(this.s1.takeoffEnd,phase,()=>{const x=bb(this.s1.takeoffEnd);this.heightCommand(x.height_offset,x.height_duration);
   if(this.phaseLive(phase)&&this.modeTo(0)&&this.phaseLive(phase)){this.phase=null;done=true;}});return done;
 }
 stop(){if(this.stopped)return;super.stop();this.phase=null;this.holder=null;this.stun=null;
  for(const p of [...this.grants]){p.finished=true;this.removeGrant(p);}this.grants.clear();
 }
}
