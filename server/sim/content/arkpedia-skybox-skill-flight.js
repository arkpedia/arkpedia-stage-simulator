// SPDX-License-Identifier: GPL-3.0-or-later
// Original S1 landing/return commands; attacks and skill accounts compose later.
import {SkyboxTakeoff,SKYBOX_TAKEOFF_CONTRACT} from './arkpedia-skybox-takeoff.js';
import {SKYBOX_ID as ID,skyboxNativeInputs,skyboxSourceComponent} from './arkpedia-skybox-source.js';
import {commandBlockMode,clearBlockMode} from '../block-mode.js';
import {regularVisualHeight} from '../../../shared/arkpedia/regular-form-visual.js';
export const SKYBOX_SKILL_FLIGHT_CONTRACT=Object.freeze({
 scope:'Selected original deployment takeoff plus S1 temporary ground-evasion immunity, delayed WALK/FLY commands and independent graphic height; no damage/account/public admission.',
 mapping:'Native ExecuteBuff event2 maps to Begin/End phase entry. The accepted Begin timer suppresses ground evasion immediately; its finish after0.20000000298023224 seconds lowers height to0 over0.27000001072883606 and commands WALK. End entry finishes any still-owned Begin timer, then admits the separate0.3499999940395355-second return timer. Its finish commands FLY and rises to0.4000000059604645 over0.5 seconds. Persistent mode commands are distinct from their initiating buff lifetime. WALK masks the held takeoff parent without deleting it. Parent motion stays GROUND, high tiles cannot acquire ground blocking, and incompatible old blockers are released. Source timers/commands/height belong to one deployment life; foreign states are not removed.',
 limitations:'Native action enum, buff-finish/cancellation order, effective ground-evasion immunity after WALK, linear height and world-step timestamps remain explicit local mappings. A command overwrites the current block mode, as a command rather than a stacking buff; cleanup clears only the current owned command and does not restore overwritten foreign commands. S2, account/attack clocks, original public delivery and compiled/frame/particle/audio parity remain separate.',frameParity:false,
});
const source=(group,key,id)=>skyboxSourceComponent(group,key,id);
const bb=b=>Object.fromEntries(b.blackboard.map(p=>[p.key,p.value]));
export function verifySkyboxSkillFlight(n=skyboxNativeInputs(),read=source){
 const walk=read('skills','skchr_skybx_1','5418191453246374310'),fly=read('skills','skchr_skybx_1','-5799333374329831002');
 for(const[a,key,delay,immune]of[[walk,'skybx_s_1[block_walk]',0.20000000298023224,'35'],[fly,'skybx_s_1[block_fly]',0.3499999940395355,'']]){
  const b=a._buffs[0];if(a._runActionOnEvent!==2||a._buffs.length!==1||b.buffKey!==key||b.templateKey!==key
   ||b.lifeTimeType!==1||b.lifeTime!==delay||b.isSilenceable!==0||b.isStunnable!==0||b.attributes.abnormalImmunes.join()!==immune)
   throw Error('Changed original Skybox S1 flight inputs');
 }
 const w=n.templates['skybx_s_1[block_walk]'].eventToActions.ON_BUFF_FINISH,
  f=n.templates['skybx_s_1[block_fly]'].eventToActions,move=w[0],take=f.ON_BUFF_FINISH;
 if(w.length!==3||move._OffsetKey!==''||move._offset!==0||move._durationKey!=='height_duration'
  ||!w[1].$type.includes('+AlwaysNext,')||w[2]._blockMode!=='WALK'||w[2]._resetToDefault!==false
  ||f.ON_BUFF_START.length!==1||f.ON_BUFF_START[0]._buffKey!=='skybx_s_1[block_walk]'
  ||take.length!==3||take[0]._blockMode!=='FLY'||!take[1].$type.includes('+AlwaysNext,')
  ||take[2]._OffsetKey!=='height_offset'||take[2]._durationKey!=='height_duration'
  ||bb(walk._buffs[0]).height_duration!==0.27000001072883606||bb(fly._buffs[0]).height_duration!==0.5
  ||bb(fly._buffs[0]).height_offset!==0.4000000059604645)throw Error('Changed original Skybox S1 flight templates');
 return{walk:walk._buffs[0],fly:fly._buffs[0]};
}
export class SkyboxSkillFlight extends SkyboxTakeoff{
 constructor(b,u,{contract}={}){
  if(contract!==SKYBOX_SKILL_FLIGHT_CONTRACT)throw Error('Exact Skybox skill-flight contract required');
  super(b,u,{contract:SKYBOX_TAKEOFF_CONTRACT});this.transitions=verifySkyboxSkillFlight();
  this.skillPhase=null;this.skillTimers=new Map();this.command=null;this.serial=0;
 }
 timerLive(p){return !p.finished&&p.buff?.data?.skyboxSkillFlight===p&&this.u.buffs.includes(p.buff);}
 removeTimer(p){if(!p)return;if(p.buff?.data?.skyboxSkillFlight===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 heightCommand(to,duration,at){if(!this.valid())return;
  this.height={start:at,from:regularVisualHeight(this,at),to,duration};this.syncVisual();}
 blockCommand(mode){if(!this.valid())return;const p=commandBlockMode(this.b,this.u,mode,this);this.command=p;
  if(!this.valid())clearBlockMode(this.b,this.u,p);}
 grantSkillTimer(kind,phase){
  const raw=this.transitions[kind],p={owner:this,kind,phase,finished:false,admitted:false,buff:null},key=`${raw.buffKey}:${this.u.id}:${this.seq}:${++this.serial}`;
  const flags=kind==='walk'?{groundEvadeImmune:true}:null;
  const admit=(_u,buff)=>this.valid()&&this.skillPhase===phase&&!p.finished
   &&(!buff||buff.key===key&&buff.source===this.u&&buff.data?.skyboxSkillFlight===p
    &&(kind!=='walk'||buff.flags?.groundEvadeImmune===true))
   &&(!this.u.findBuff(key)||this.u.findBuff(key).data?.skyboxSkillFlight===p);
  const finish=()=>{if(p.finished)return;p.finished=true;this.skillTimers.delete(p);
   if(!p.admitted||!this.valid()||this.skillPhase!==phase)return;const params=bb(raw),at=p.commandAt??this.b.time;
   if(kind==='walk'){this.heightCommand(0,params.height_duration,at);this.blockCommand('WALK');}
   else{this.blockCommand('FLY');if(this.valid()&&this.skillPhase===phase)this.heightCommand(params.height_offset,params.height_duration,at);}
  };
  p.buff=this.b.addBuff(this.u,{key,duration:raw.lifeTime,source:this.u,flags,refresh:'keep',data:{skyboxSkillFlight:p},admit,
   onRemove:finish,onExpire:finish,onTick:({buff,dt})=>{if(this.timerLive(p)&&buff.timeLeft>0&&buff.timeLeft<=dt+1e-7){
    p.commandAt=this.b.time+dt;this.b.removeBuff(this.u,buff);}}});
  if(!admit()||!this.timerLive(p)){p.finished=true;this.removeTimer(p);return null;}
  p.admitted=true;this.skillTimers.set(p,kind);
  if(kind==='fly')for(const [t,k]of [...this.skillTimers])if(k==='walk')this.removeTimer(t);
  return p;
 }
 beginSkillOne(){if(!this.valid()||this.u.def.skill.id!=='skchr_skybx_1'||this.skillPhase)return false;
  const p={id:++this.serial,ending:false};this.skillPhase=p;this.grantSkillTimer('walk',p);return this.valid()&&this.skillPhase===p;}
 endSkillOne(){const p=this.skillPhase;if(!this.valid()||!p||p.ending)return false;p.ending=true;
  this.grantSkillTimer('fly',p);return this.valid()&&this.skillPhase===p;}
 finishSkillOne(){if(!this.valid()||!this.skillPhase)return false;const p=this.skillPhase;
  // Only the account/animation owner may finish a completed transition. Refused
  // return timers do not synthesize another flight command.
  if([...this.skillTimers].some(([t])=>t.phase===p))return false;this.skillPhase=null;return true;}
 stop(){if(this.stopped)return;super.stop();const timers=[...this.skillTimers.keys()];this.skillPhase=null;
  for(const p of timers){p.finished=true;this.removeTimer(p);}this.skillTimers.clear();
  const command=this.command;this.command=null;clearBlockMode(this.b,this.u,command);
 }
}
