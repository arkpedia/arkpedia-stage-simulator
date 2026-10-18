// SPDX-License-Identifier: GPL-3.0-or-later
// Original selected S2 mode/flight resource. Account and attacks compose it.
import clocks from '../../../data/arkpedia-skybox-clocks.json' with {type:'json'};
import {SkyboxSkillFlight,SKYBOX_SKILL_FLIGHT_CONTRACT} from './arkpedia-skybox-skill-flight.js';
import {selectedSkyboxInputs,skyboxNativeInputs,skyboxSourceComponent,SKYBOX_ID as ID} from './arkpedia-skybox-source.js';
export const SKYBOX_S2_FLIGHT_CONTRACT=Object.freeze({
 scope:'Selected original S2 accepted mode parent, Begin predelay/landing, mode2 entry and End/FLY return; no account/damage/public admission.',
 mapping:'An independently admitted infinite switch-mode parent owns ground-evasion immunity and mode1. Its original Begin predelay precedes the one-second Begin clip; the accepted .15-second height timer issues the selected .65-second lowering command. Begin completion independently admits its zero-duration height/mode2 and WALK command buffs. Parent finish commands mode3 and FLY immediately; its separate .3-second timer issues the .5-second return rise, then End completion independently snaps height and mode0. These are world clocks, independent of control/ASPD. A replaced phase/life cannot issue a late command. Every original grant has its own admission; a refused mode or completion cannot synthesize its effects. The inherited deployment takeoff remains separate.',
 limitations:'Native ExecuteBuff event2/3, Begin predelay and phase/FSM interruption, zero-duration command admission and callback ordering remain explicit local mappings. Early parent finish retires pending Begin callbacks and enters End. Compiled aliases, mode1 missing Die2 dispatch, S2 account/transport/burst, native FX/audio/modules and original frame/pixel parity remain separate.',frameParity:false,
});
const due=(a,z)=>a>=z-1e-7;
const bb=x=>Object.fromEntries(x.blackboard.map(p=>[p.key,p.value]));
const owner=id=>skyboxSourceComponent('characters',ID,id);
export function verifySkyboxS2Flight(n=skyboxNativeInputs(),read=owner,readSkill=id=>skyboxSourceComponent('skills','skchr_skybx_2',id)){
 const mode=readSkill('-7641478267859200344')._buffs[0],
  parts=['-935185010594349809','1985564271953116431','3624636710682819855','415533828637785359'].map(read),
  [beginTimer,beginFinish,endTimer,endFinish]=parts;
 if(mode.buffKey!=='skybx_s_2[switch_mode]'||mode.lifeTimeType!==2||mode.attributes.abnormalImmunes.join()!=='35'
  ||mode.isSilenceable!==0||mode.isStunnable!==0||bb(mode).mode!==1
  ||n.modes[1].attack._animKey!=='Skill_2_Begin'||n.modes[1].attack._preDelay!==0.1333329975605011
  ||n.modes[3].attack._animKey!=='Skill_2_End'||n.modes[3].attack._preDelay!==0
  ||parts.some((p,i)=>p._runActionOnEvent!==[2,3,2,3][i])
  ||[beginTimer,endTimer].some(p=>p._buffs.length!==1||p._buffs[0].lifeTimeType!==1||p._buffs[0].buffKey!=='skybx_height_ctrl[tween]')
  ||[...beginFinish._buffs,...endFinish._buffs].some(p=>p.lifeTimeType!==0||p.lifeTime!==0)
  ||bb(beginFinish._buffs[0]).height_offset!==0||bb(beginFinish._buffs[0]).height_duration!==0
  ||bb(endFinish._buffs[0]).height_offset!==0.4000000059604645||bb(endFinish._buffs[0]).height_duration!==0
  ||beginTimer._buffs[0].lifeTime!==0.15000000596046448||bb(beginTimer._buffs[0]).height_duration!==0.6499999761581421
  ||bb(beginTimer._buffs[0]).height_offset!==0||bb(beginFinish._buffs[0]).mode!==2
  ||beginFinish._buffs[1].buffKey!=='sky_s2_landing_end[block_walk]'
  ||endTimer._buffs[0].lifeTime!==0.30000001192092896||bb(endTimer._buffs[0]).height_duration!==0.5
  ||bb(endTimer._buffs[0]).height_offset!==0.4000000059604645||bb(endFinish._buffs[0]).mode!==0)
  throw Error('Changed original Skybox S2 flight inputs');
 const t=n.templates,events=t['skybx_s_2[switch_mode]'].eventToActions;
 if(events.ON_BUFF_START[0]._modeIndex!==1||events.ON_BUFF_START[1]._copyFromKey!=='attack@trigger_time'
  ||events.ON_BUFF_FINISH[0]._modeIndex!==3||events.ON_BUFF_FINISH[2]._blockMode!=='FLY'
  ||t['sky_s2_landing_end[block_walk]'].eventToActions.ON_BUFF_START[0]._blockMode!=='WALK'
  ||t['skybx_height_ctrl[tween]'].eventToActions.ON_BUFF_FINISH[0]._durationKey!=='height_duration'
  ||t['skybx_height_ctrl[finish]'].eventToActions.ON_BUFF_START[2]._loadModeFromBlackboard!==true)
  throw Error('Changed original Skybox S2 flight templates');
 return{mode,beginTimer:beginTimer._buffs[0],beginFinish:beginFinish._buffs,endTimer:endTimer._buffs[0],endFinish:endFinish._buffs,
  preDelay:n.modes[1].attack._preDelay};
}
export class SkyboxSkillTwoFlight extends SkyboxSkillFlight{
 constructor(b,u,{contract,onMode=()=>{},onClip=()=>{}}={}){
  if(contract!==SKYBOX_S2_FLIGHT_CONTRACT||selectedSkyboxInputs(u).index!==1||typeof onMode!=='function'||typeof onClip!=='function')
   throw Error('Fresh selected S2 and exact flight contract/callbacks required');
  super(b,u,{contract:SKYBOX_SKILL_FLIGHT_CONTRACT});this.record=selectedSkyboxInputs(u);this.s2=verifySkyboxS2Flight();this.onMode=onMode;this.onClip=onClip;
  this.mode=0;this.s2phase=null;this.modeParent=null;this.s2Grants=new Set();
 }
 duration(clip){return clocks.models[this.u.dir==='UP'?'Back':'Front'].exactDurations[clip];}
 phaseLive(p){return this.valid()&&this.s2phase===p;}
 modeLive(){const p=this.modeParent;return !!p&&!p.finished&&p.buff?.data?.skyboxS2Flight===p&&this.u.buffs.includes(p.buff);}
 modeTo(mode){this.mode=mode;this.onMode(mode);}
 clip(name){if(this.valid())this.onClip(name);}
 finishGrant(p){if(p.finished)return;p.finished=true;this.s2Grants.delete(p);}
 removeGrant(p){if(p?.buff?.data?.skyboxS2Flight===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 cancelGrants(){for(const p of [...this.s2Grants]){p.finished=true;this.removeGrant(p);}this.s2Grants.clear();}
 grant(raw,phase,{flags=null,onFinish=()=>{},instant=false}={}){
  const p={phase,finished:false,admitted:false,buff:null},key=`${raw.buffKey}:${this.u.id}:${this.seq}:${++this.serial}`;
  const admit=(_u,buff)=>this.phaseLive(phase)&&!p.finished&&(!buff||buff.key===key&&buff.source===this.u&&buff.data?.skyboxS2Flight===p)
   &&(!this.u.findBuff(key)||this.u.findBuff(key).data?.skyboxS2Flight===p);
  const finish=()=>{if(p.finished)return;this.finishGrant(p);if(p.admitted&&this.phaseLive(phase))onFinish(p.at??this.b.time);};
  p.buff=this.b.addBuff(this.u,{key,source:this.u,duration:instant?0:raw.lifeTime,flags,data:{skyboxS2Flight:p},admit,
   onRemove:finish,onExpire:finish,onTick:({buff,dt})=>{if(p.admitted&&!p.finished&&this.phaseLive(phase)&&buff.timeLeft>0&&buff.timeLeft<=dt+1e-7){
    p.at=this.b.time+dt;this.b.removeBuff(this.u,buff);}}});
  if(!admit()||p.buff?.data?.skyboxS2Flight!==p){p.finished=true;this.removeGrant(p);return null;}
  p.admitted=true;this.s2Grants.add(p);
  if(instant)this.removeGrant(p);return p;
 }
 begin(){if(!this.valid()||this.mode!==0||this.s2phase||this.modeParent)return false;
  const phase={kind:'predelay',at:this.b.time+this.s2.preDelay};this.s2phase=phase;
  const p={phase,finished:false,admitted:false,buff:null,times:this.record.bb['attack@trigger_time']},key=`skybx_s_2[switch_mode]:${this.u.id}:${this.seq}:${++this.serial}`;
  const admit=(_u,buff)=>this.phaseLive(phase)&&!p.finished&&(!buff||buff.key===key&&buff.source===this.u
   &&buff.flags?.groundEvadeImmune===true&&buff.data?.skyboxS2Flight===p)
   &&(!this.u.findBuff(key)||this.u.findBuff(key).data?.skyboxS2Flight===p);
  const finish=()=>{if(p.finished)return;p.finished=true;if(!p.admitted||this.modeParent!==p)return;
   this.modeParent=null;if(this.valid())this.beginEnd();};
  p.buff=this.b.addBuff(this.u,{key,source:this.u,refresh:'keep',flags:{groundEvadeImmune:true},data:{skyboxS2Flight:p},admit,onRemove:finish,onExpire:finish});
  if(!admit()||p.buff?.data?.skyboxS2Flight!==p){p.finished=true;this.removeGrant(p);if(this.s2phase===phase)this.s2phase=null;return false;}
  p.admitted=true;this.modeParent=p;this.modeTo(1);if(!this.phaseLive(phase)||!this.modeLive()){p.finished=true;if(this.modeParent===p)this.modeParent=null;this.removeGrant(p);
   if(this.s2phase===phase)this.s2phase=null;return false;}return true;
 }
 beginEnd(){if(!this.valid())return false;const phase={kind:'end',at:this.b.time+this.duration('Skill_2_End')};this.s2phase=phase;this.cancelGrants();
  this.modeTo(3);if(!this.phaseLive(phase))return false;this.blockCommand('FLY');if(!this.phaseLive(phase))return false;
  this.clip('Skill_2_End');this.grant(this.s2.endTimer,phase,{onFinish:at=>{const p=bb(this.s2.endTimer);this.heightCommand(p.height_offset,p.height_duration,at);}});
  return this.phaseLive(phase);
 }
 end(){const p=this.modeParent;if(!p)return false;this.removeGrant(p);return !this.modeLive();}
 snapshotHeight(to){if(!this.valid())return;this.height=null;this.heightOffset=to;this.syncVisual();}
 complete(phase){const ending=phase.kind==='end',parts=ending?this.s2.endFinish:this.s2.beginFinish;
  for(const raw of parts){if(!this.phaseLive(phase))return;
   this.grant(raw,phase,{instant:true,onFinish:()=>{
    if(raw.buffKey==='sky_s2_landing_end[block_walk]'){this.blockCommand('WALK');return;}
    const p=bb(raw);this.snapshotHeight(p.height_offset);this.modeTo(p.mode);
   }});
  }
  if(!this.phaseLive(phase))return;
  // A refused source completion cannot fabricate its destination mode.
  if(this.mode===(ending?0:2)){this.s2phase=null;this.clip(ending?'Idle':'Skill_2_Idle');}
  else phase.kind='held';
 }
 tick(){super.tick();if(!this.valid())return;const phase=this.s2phase;if(!phase)return;
  if(phase.kind==='predelay'&&due(this.b.time,phase.at)){
   phase.kind='begin';phase.at=this.b.time+this.duration('Skill_2_Begin');this.clip('Skill_2_Begin');
   if(this.phaseLive(phase))this.grant(this.s2.beginTimer,phase,{onFinish:at=>this.heightCommand(0,bb(this.s2.beginTimer).height_duration,at)});
  }else if(['begin','end'].includes(phase.kind)&&due(this.b.time,phase.at))this.complete(phase);
 }
 stop(){if(this.stopped)return;super.stop();this.s2phase=null;this.cancelGrants();const p=this.modeParent;this.modeParent=null;
  if(p){p.finished=true;this.removeGrant(p);}}
}
