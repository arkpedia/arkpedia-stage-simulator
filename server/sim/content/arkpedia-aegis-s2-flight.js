// SPDX-License-Identifier: GPL-3.0-or-later
// Original S2 ability-owned WALK parent and separate End-entry FLY callback.
import {AegisTakeoff,AEGIS_TAKEOFF_CONTRACT} from './arkpedia-aegis-takeoff.js';
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs,aegisSourceComponent} from './arkpedia-aegis-source.js';
export const AEGIS_S2_FLIGHT_CONTRACT=Object.freeze({
 scope:'Selected original Aegis S2 ability-owned WALK/evasion-immunity parent, End-entry FLY/height callback and finish-reason cleanup only; no missiles, kick/account or public admission.',
 mapping:'The accepted infinite ability parent suppresses the deployment parent\'s ground evasion, lowers height to0 over .30000001192092896 seconds, then independently commands WALK. It does not change logical motion, tile height or native owner mode0. End entry independently admits its zero-duration command buff, commands FLY and raises height to .4000000059604645 over .30000001192092896 seconds while the WALK parent and its immunity are still alive. Native NORMAL_EXIT parent finish removes only that parent; its IfNot branch does not run. Any other accepted finish commands FLY and snaps height immediately, rather than replaying normal End. Refused or stale grants cannot synthesize commands. The outer source ability owner supplies End and exact finish reason, and receives one accepted parent-finish callback. One source deployment life owns all resources; retirement cancels actions and preserves foreign states.',
 limitations:'Native ability-affect lifetime, callback enums, finish-reason dispatch and linear height/world timestamps remain explicit local mappings. Normal completion without an admitted End callback cannot fabricate a return command. The kick\'s separate graphic flight, projectile travel/damage, account, selection/control/FSM, native FX/audio/modules and compiled/frame/pixel parity remain separate.',frameParity:false,
});
const bb=x=>Object.fromEntries(x.blackboard.map(p=>[p.key,p.value]));
export function verifyAegisS2Flight(n=aegisNativeInputs(),read=aegisSourceComponent){
 const owner=read('skills','skchr_aigis_2','-3561545585881019870')._buffs[0],fly=read('skills','skchr_aigis_2','-1310678009104856542'),
  w=n.templates.aigis_s2_block_walk.eventToActions,f=n.templates.aigis_s2_block_fly.eventToActions.ON_BUFF_START;
 if(owner.buffKey!=='aigis_s2_block_walk'||owner.templateKey!==owner.buffKey||owner.lifeTimeType!==2||owner.isSilenceable!==0||owner.isStunnable!==0
  ||owner.attributes.abnormalImmunes.join()!=='35'||owner.attributes.abnormalFlags.length!==0||owner.attributes.attributeModifiers.length!==0
  ||bb(owner).height_offset!==.4000000059604645||bb(owner).height_duration!==.30000001192092896
  ||w.ON_BUFF_START.length!==3||w.ON_BUFF_START[0]._OffsetKey!==''||w.ON_BUFF_START[0]._offset!==0||w.ON_BUFF_START[0]._durationKey!=='height_duration'
  ||w.ON_BUFF_START[2]._blockMode!=='WALK'||w.ON_BUFF_FINISH.length!==6||!w.ON_BUFF_FINISH[0].$type.includes('+CheckUnitAlive,')
  ||w.ON_BUFF_FINISH[1]._finishReason!=='NORMAL_EXIT'||w.ON_BUFF_FINISH[1]._useBuffAbility!==true||!w.ON_BUFF_FINISH[2].$type.includes('+IfNot,')
  ||w.ON_BUFF_FINISH[3]._blockMode!=='FLY'||w.ON_BUFF_FINISH[5]._OffsetKey!=='height_offset'||w.ON_BUFF_FINISH[5]._durationKey!=='_'
  ||fly._runActionOnEvent!==2||fly._buffs.length!==1||fly._buffs[0].buffKey!=='aigis_s2_block_fly'||fly._buffs[0].lifeTimeType!==0
  ||bb(fly._buffs[0]).height_offset!==.4000000059604645||bb(fly._buffs[0]).height_duration!==.30000001192092896
  ||f.length!==3||f[0]._blockMode!=='FLY'||f[2]._OffsetKey!=='height_offset'||f[2]._durationKey!=='height_duration')throw Error('Changed original Aegis S2 flight inputs');
 return{owner,fly:fly._buffs[0]};
}
export class AegisSkillTwoFlight extends AegisTakeoff{
 constructor(b,u,{contract,onFinish=()=>{}}={}){
  if(contract!==AEGIS_S2_FLIGHT_CONTRACT||selectedAegisInputs(u).index!==1||typeof onFinish!=='function')throw Error('Fresh selected S2 and exact Aegis flight contract required');
  super(b,u,{contract:AEGIS_TAKEOFF_CONTRACT});Object.assign(this,{s2:verifyAegisS2Flight(),onFinish,skillPhase:null,walkParent:null,grants:new Set(),serial:0});
 }
 phaseLive(p){return !!p&&this.valid()&&this.skillPhase===p;}
 grantLive(p){return !!p&&!p.finished&&p.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisS2Flight===p&&this.u.buffs.includes(p.buff);}
 removeGrant(p){if(p?.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisS2Flight===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 grant(raw,phase,{duration=0,flags=null,onFinish=()=>{}}={}){
  const p={key:`${raw.buffKey}:${this.u.id}:${this.seq}:${++this.serial}`,phase,buff:null,finished:false,admitted:false},flagJson=JSON.stringify(flags);let descriptor;
  const admit=(_u,buff)=>this.phaseLive(phase)&&!p.finished&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.aegisS2Flight===p
   &&JSON.stringify(buff.flags??null)===flagJson&&Object.keys(buff.mods??{}).length===0&&buff.status==null
   &&(buff===descriptor||buff.stacks===1&&buff.duration===duration&&buff.timeLeft===duration))
   &&(!this.u.findBuff(p.key)||this.u.findBuff(p.key).data?.aegisS2Flight===p);
  const finish=()=>{if(p.finished)return;p.finished=true;this.grants.delete(p);if(p.admitted&&this.phaseLive(phase))onFinish(p);};
  descriptor={key:p.key,duration,flags,source:this.u,refresh:'keep',data:{aegisS2Flight:p},admit,onRemove:finish,onExpire:finish};p.buff=this.b.addBuff(this.u,descriptor);
  if(!admit()||!this.grantLive(p)){p.finished=true;this.removeGrant(p);return null;}p.admitted=true;this.grants.add(p);return p;
 }
 beginSkillTwo(){if(!this.valid()||this.skillPhase)return false;const phase={ending:false,finishReason:null};this.skillPhase=phase;
  const p=this.grant(this.s2.owner,phase,{duration:Infinity,flags:{groundEvadeImmune:true},onFinish:()=>this.walkFinished(p,phase)});
  if(!p){if(this.skillPhase===phase)this.skillPhase=null;return false;}this.walkParent=p;
  this.heightCommand(0,bb(this.s2.owner).height_duration);if(!this.phaseLive(phase)||!this.grantLive(p))return false;
  this.blockCommand('WALK');return this.phaseLive(phase)&&this.grantLive(p);
 }
 walkFinished(p,phase){if(this.walkParent===p)this.walkParent=null;if(!this.phaseLive(phase))return;
  const reason=phase.finishReason??'INTERRUPTED';
  if(reason!=='NORMAL_EXIT'){if(!this.blockCommand('FLY')||!this.phaseLive(phase))return;this.heightCommand(bb(this.s2.owner).height_offset,0);}
  if(!this.phaseLive(phase))return;this.skillPhase=null;this.onFinish(reason);
 }
 beginEnd(){const phase=this.skillPhase;if(!this.phaseLive(phase)||phase.ending||!this.grantLive(this.walkParent))return false;phase.ending=true;
  const p=this.grant(this.s2.fly,phase);if(!p)return false;let done=false;
  try{if(!this.blockCommand('FLY')||!this.phaseLive(phase))return false;const x=bb(this.s2.fly);this.heightCommand(x.height_offset,x.height_duration);done=true;}
  finally{p.finished=true;this.grants.delete(p);this.removeGrant(p);}return done&&this.phaseLive(phase);
 }
 finishSkillTwo(reason='NORMAL_EXIT'){if(!['NORMAL_EXIT','INTERRUPTED','DISPELLED','TARGET_LOST'].includes(reason))throw Error('Explicit Aegis ability finish reason required');
  const phase=this.skillPhase;if(!this.phaseLive(phase)||!this.grantLive(this.walkParent))return false;phase.finishReason=reason;this.removeGrant(this.walkParent);return true;
 }
 stop(){if(this.stopped)return;super.stop();this.skillPhase=null;this.walkParent=null;for(const p of [...this.grants]){p.finished=true;this.removeGrant(p);}this.grants.clear();}
}
