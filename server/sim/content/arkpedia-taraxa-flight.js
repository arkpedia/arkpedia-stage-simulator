// SPDX-License-Identifier: GPL-3.0-or-later
// Selected transition component only; skill accounts and healing loops compose it.
import evidence from '../../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import clocks from '../../../data/arkpedia-taraxa-clocks.json' with {type:'json'};
import {regularVisualHeight} from '../../../shared/arkpedia/regular-form-visual.js';
import {TARAXA_ID as ID, selectedTaraxaInputs, taraxaNativeInputs, taraxaSourceComponent} from './arkpedia-taraxa-source.js';
export const TARAXA_FLIGHT_CONTRACT=Object.freeze({
 scope:'Selected original Taraxacum takeoff/landing modes, owned FLY state and graphic height; no skill account, healing loop or public admission.',
 mapping:'Native ExecuteBuff event2 maps to transition entry, event4 to the original Spine attack marker and event3 to animation completion. This is an explicit local callback mapping, not a recovered compiled enum. The source world clock advances one-second Begin/End transitions while control prevents healing acquisition elsewhere. Loop entry independently admits its original zero-duration height command. Accepted infinite fly-mode lifetime maps to the existing ally liftoff flag, separately from accepted height commands. Height is sampled on the simulation clock; mode2/5 follows Begin completion and mode0 follows End completion. A skill end during takeoff replaces the pending Begin with End. Each component owns only its admitted buffs and presentation for one deployment life.',
 limitations:'Compiled FSM/account ordering and interruption semantics remain local mappings. Native try-ground removes the buff family across sources; this component removes only owned instances and preserves foreign flight. Both healing loops, SP/skill composition, native effects/audio, original art delivery and frame/pixel parity remain pending.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const due=(a,z)=>a>=z-1e-7;
const callbackIds=[['2318190540492437692','4514369388736936124','3266230871279990972','7179158368387987644','-5832911320623482692'],
 ['-4832786741422655300','3282637733688309948','-7380137595504101188','6379363096944572604','3162419979509692604']];
export function verifyTaraxaFlight(n=taraxaNativeInputs(),owner=id=>taraxaSourceComponent('characters',ID,id)){
 for(let i=0;i<2;i++){
  const parts=callbackIds[i].map(owner), keys=['taraxa_fly_mode','taraxa_fly','taraxa_switch_mode','taraxa_fly_end','taraxa_switch_mode'];
  parts.forEach((p,j)=>{if(p._runActionOnEvent!==[2,4,3,4,3][j]||p._buffs[0]?.buffKey!==keys[j]
   ||p._buffs[0]?.isSilenceable!==0||p._buffs[0]?.isStunnable!==0)throw Error('Changed original Taraxacum flight callbacks');});
  if(parts[0]._buffs[0].lifeTimeType!==2||parts[2]._buffs[0].blackboard[0]?.value!==[2,5][i]
   ||parts[4]._buffs[0].blackboard[0]?.value!==0)throw Error('Changed original Taraxacum flight modes');
  const snap=n.modes[i?5:2].abilities.flatMap(a=>a._buffs??[]).find(b=>b.buffKey==='taraxa_fly');
  if(snap?.blackboard[0]?.key!=='fly_duration'||snap.blackboard[0].value!==0)
   throw Error('Changed original Taraxacum loop height command');
  for(const mode of[i?4:1,i?6:3]){const a=n.modes[mode].attack;
   if(a._animKey!==`Skill_${i+1}_${mode===(i?4:1)?'Begin':'End'}`||a._maxAnimScale!==1||a._affectedBySlowDown!==0)
    throw Error('Changed original Taraxacum transition clock');}
 }
 const t=n.templates,fly=t.taraxa_fly_mode.eventToActions,up=t.taraxa_fly.eventToActions.ON_BUFF_START[0],down=t.taraxa_fly_end.eventToActions.ON_BUFF_START[0];
 if(fly.ON_BUFF_START[0]._blockMode!=='FLY'||fly.ON_BUFF_FINISH[0]._resetToDefault!==true
  ||up._OffsetKey!=='fly_height'||up._durationKey!=='fly_duration'||down._offset!==0||down._durationKey!=='fly_end_duration'
  ||t.taraxa_switch_mode.eventToActions.ON_BUFF_START[1]._restartFSM!==true)
  throw Error('Changed original Taraxacum flight templates');
}
export class TaraxaFlight{
 constructor(b,u,{contract,onMode=()=>{}}={}){
  if(contract!==TARAXA_FLIGHT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||typeof onMode!=='function')
   throw Error('Fresh selected Taraxacum and exact flight contract required');
  verifyTaraxaFlight();this.b=b;this.u=u;this.record=selectedTaraxaInputs(u);this.skill=Number(u.def.skill.id.slice(-1));
  this.onMode=onMode;this.seq=null;this.mode=0;this.phase=null;this.flight=null;this.height=null;this.heightOffset=0;
  this.handles=[];this.stopped=false;this.serial=0;this.visualSeq=0;this.changed=false;
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 model(){return {...evidence.models[ID][this.u.dir==='UP'?'Back':'Front'],...clocks.models[this.u.dir==='UP'?'Back':'Front']};}
 heightNow(){return regularVisualHeight({height:this.height,heightOffset:this.heightOffset},this.b.time);}
 decorate(visual){return {...visual,...(this.height?{height:{...this.height}}:{heightOffset:this.heightOffset})};}
 visual(clip,loop=false){if(!this.valid())return;
  this.u.mem.regularVisualDirection=this.u.dir;
  this.u.mem.regularFormVisual=this.decorate({clip,speed:1,loop,...(loop?{replace:true}:{}),...(!loop?{playId:`taraxa:flight:${this.seq}:${++this.visualSeq}`}:{})});
  this.u.mem.regularDeathVisual=this.u.dir==='UP'?{hide:true,duration:1}:{clip:this.mode?'Skill_Die':'Die',duration:1};
 }
 setMode(mode){this.mode=mode;this.onMode(mode);}
 owns(buff){return buff?.data?.taraxaFlight===this&&this.u.buffs.includes(buff);}
 remove(buff){if(this.owns(buff))this.b.removeBuff(this.u,buff);}
 fly(){
  const buff=this.b.addBuff(this.u,{key:`taraxa_fly_mode:${this.u.id}:${this.seq}`,source:this.u,refresh:'keep',
   flags:{liftoff:true},data:{taraxaFlight:this}});
  if(!this.owns(buff))return;
  if(!this.valid()||!this.phase||this.phase.landing){this.remove(buff);return;}
  this.flight=buff;
 }
 commandHeight(p,snap=false){
  // The instant source command has its own admission. It does not grant FLY.
  const buff=this.b.addBuff(this.u,{key:`taraxa:${snap?'loop':p.landing?'lower':'rise'}:${this.seq}:${p.serial}`,source:this.u,
   data:{taraxaFlight:this}});
  if(!this.owns(buff))return;
  const accepted=this.valid()&&this.phase===p;
  this.remove(buff);
  if(!accepted||!this.valid()||this.phase!==p)return;
  if(snap){this.height=null;this.heightOffset=this.record.bb['attack@fly_height'];
   this.u.mem.regularFormVisual=this.decorate(this.u.mem.regularFormVisual);return;}
  const from=this.heightNow(),duration=this.record.bb[p.landing?'attack@fly_end_duration':'attack@fly_duration'];
  this.height={start:this.b.time,from,to:p.landing?0:this.record.bb['attack@fly_height'],duration};
  this.heightOffset=from;this.u.mem.regularFormVisual=this.decorate(this.u.mem.regularFormVisual);
 }
 transition(landing){
  if(!this.valid()||(landing?this.mode===0||this.phase?.landing:this.mode!==0))return false;
  const clip=`Skill_${this.skill}_${landing?'End':'Begin'}`;
  const p={landing,clip,start:this.b.time,serial:++this.serial,marker:this.model().eventPayloads[clip][0].time,
   duration:this.model().exactDurations[clip],heightSent:false};
  this.phase=p;this.changed=true;this.setMode(this.skill===1?landing?3:1:landing?6:4);
  if(!this.valid()||this.phase!==p)return false;
  this.visual(clip);if(!landing)this.fly();return this.valid()&&this.phase===p;
 }
 start(){return this.transition(false);}
 land(){return this.transition(true);}
 tick(){
  if(!this.valid())return;const p=this.phase;if(!p)return;
  const age=this.b.time-p.start;
  if(!p.heightSent&&due(age,p.marker)){p.heightSent=true;this.commandHeight(p);}
  if(!this.valid()||this.phase!==p||!due(age,p.duration))return;
  if(!p.landing){this.commandHeight(p,true);if(!this.valid()||this.phase!==p)return;}
  this.phase=null;
  if(p.landing){const buff=this.flight;this.flight=null;this.remove(buff);
   if(!this.valid())return;this.height=null;this.heightOffset=0;this.setMode(0);
   if(this.valid()&&this.mode===0)this.visual('Idle',true);
  }else{
   // Loop entry has independently admitted its source zero-duration height command.
   this.heightOffset=this.heightNow();this.height=null;this.setMode(this.skill===1?2:5);
   if(this.valid()&&!this.phase)this.visual(this.skill===1?'Skill_1_Loop':'Skill_2_Idle',true);
  }
 }
 install(){if(this.stopped||this.handles.length)throw Error('Taraxacum flight cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move)this.seq=u.deploySeq;},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),
   b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.phase=null;const buff=this.flight;this.flight=null;this.remove(buff);
  for(const h of this.handles)this.b.off(h);this.handles=[];
  if(this.changed&&this.u.deploySeq===this.seq){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
  this.height=null;this.heightOffset=0;
 }
}
