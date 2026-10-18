// SPDX-License-Identifier: GPL-3.0-or-later
// Held deployment trait only. Skill landing/block-mode transitions compose later.
import {regularVisualHeight} from '../../../shared/arkpedia/regular-form-visual.js';
import {SKYBOX_ID as ID,selectedSkyboxInputs,skyboxNativeInputs} from './arkpedia-skybox-source.js';
export const SKYBOX_TAKEOFF_CONTRACT=Object.freeze({
 scope:'Original selected Skybox deployment passive, air blocking and delayed graphic rise only; no attacks, skill landing or public admission.',
 mapping:'Native ON_BUFF_START maps to accepted deployment-parent admission and ON_OWNER_BORN to this deployment event. An independently admitted parent-derived 0.20000000298023224-second height timer releases its original 0.4000000059604645 rise over 0.800000011920929 seconds. The parent maps block FLY and ground-target evasion to blockFly/liftoff without changing motion or deployment tile height. Clock and original graphic height remain separate from combat state. Refused/removed/retired resources never synthesize a later command. Each component owns one deployment life.',
 limitations:'Compiled passive attachment/born/derived-buff-finish ordering and cancelled timer behavior remain explicit local mappings. Graphic interpolation is linear on the world clock; the original float32 timer uses the existing source-marker tolerance1e-7 and end-of-buff-step timestamp to avoid an extra30Hz tick. S1/S2 ground-evasion immunity, block-mode commands, landing, original attack/born/death clip dispatch, native effects/audio and frame parity remain unfinished. Parent retirement cancels its pending derived height command; an already issued graphic tween may finish while that owner life remains.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const bb=b=>Object.fromEntries(b.blackboard.map(x=>[x.key,x.value]));
export function verifySkyboxTakeoff(n=skyboxNativeInputs()){
 const a=n.takeoff,p=a._buffs[0],t=n.templates.skybx_t_0.eventToActions,
  create=t.ON_OWNER_BORN[0],child=create._buff,h=n.templates['skybx_t_0[height]'].eventToActions.ON_BUFF_FINISH;
 if(a._selector.m_PathID!=='0'||a._attachPassiveBuffsOnDummy!==1||a._buffs.length!==1
  ||p.buffKey!=='skybx_t_0'||p.templateKey!=='skybx_t_0'||p.lifeTimeType!==2||p.isSilenceable!==0||p.isStunnable!==0
  ||p.attributes.abnormalFlags.join()!=='35'||bb(p).height_offset!==0.4000000059604645||bb(p).height_duration!==0.800000011920929
  ||t.ON_BUFF_START.length!==1||!t.ON_BUFF_START[0].$type.includes('+ChangeCharBlockMode,')||t.ON_BUFF_START[0]._blockMode!=='FLY'
  ||t.ON_OWNER_BORN.length!==1||!create.$type.includes('+CreateBuff,')||create._isDerivedBuff!==true||create._finishDerivedBuffIfParentFinish!==true
  ||child.buffKey!=='skybx_t_0[height]'||child.templateKey!=='skybx_t_0[height]'||child.lifeTimeType!=='LIMITED'||child.lifeTime!==0.20000000298023224
  ||h.length!==1||!h[0].$type.includes('+ModifyGraphicHolderHeight,')||h[0]._OffsetKey!=='height_offset'||h[0]._durationKey!=='height_duration'
  ||h[0]._useGlobalPos!==false||n.root._motionMode!==0||n.root._buildCondition.buildableType!==2)
  throw Error('Changed original Skybox deployment takeoff inputs');
 return{delay:child.lifeTime,...bb(p)};
}
export class SkyboxTakeoff{
 constructor(b,u,{contract}={}){
  if(contract!==SKYBOX_TAKEOFF_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Skybox and exact takeoff contract required');
  selectedSkyboxInputs(u);this.source=verifySkyboxTakeoff();this.b=b;this.u=u;
  this.seq=null;this.parent=null;this.timer=null;this.height=null;this.heightOffset=0;this.handles=[];this.stopped=false;this.changed=false;this.started=false;this.visuals=new WeakSet();
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 owns(p){return !!p&&!p.finished&&p.buff?.data?.skyboxTakeoff===p&&this.u.buffs.includes(p.buff);}
 parentLive(){return this.valid()&&this.owns(this.parent);}
 heightNow(){return regularVisualHeight(this,this.b.time);}
 decorate(visual){const v={...visual,...(this.height?{height:{...this.height}}:{heightOffset:this.heightOffset})};this.visuals.add(v);return v;}
 syncVisual(){this.changed=true;this.u.mem.regularFormVisual=this.decorate(this.u.mem.regularFormVisual);}
 remove(p){if(!p)return;p.finished=true;if(p.buff?.data?.skyboxTakeoff===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 attach(kind,duration,flags,onRemove,onExpire=onRemove){
  const p={owner:this,kind,finished:false,buff:null},key=`skybx_t_0${kind==='parent'?'':'[height]'}:${this.u.id}:${this.seq}`;
  const admit=(_u,buff)=>this.valid()&&!p.finished&&(kind==='parent'||this.parentLive())
   &&(!buff||buff.key===key&&buff.source===this.u&&buff.data?.skyboxTakeoff===p
    &&(kind!=='parent'||buff.flags?.liftoff===true&&buff.flags?.blockFly===true))
   &&(!this.u.findBuff(key)||this.u.findBuff(key).data?.skyboxTakeoff===p);
  p.buff=this.b.addBuff(this.u,{key,duration,flags,source:this.u,refresh:'keep',data:{skyboxTakeoff:p},admit,
   onRemove:()=>{p.finished=true;(p.releasing?onExpire:onRemove)(p);},onExpire:()=>{p.finished=true;onExpire(p);},
   // Native float32 0.2 differs from six 30Hz ticks by about3e-9. Use the
   // same1e-7 source-marker tolerance rather than issuing the rise a tick late.
   onTick:({buff,dt})=>{if(kind==='height'&&this.timer===p&&!p.finished&&buff.timeLeft>0&&buff.timeLeft<=dt+1e-7){
    p.releasing=true;p.commandAt=this.b.time+dt;this.b.removeBuff(this.u,buff);}}});
  if(!admit()||!this.owns(p)){this.remove(p);return null;}return p;
 }
 start(){
  if(!this.valid()||this.started)return;this.started=true;
  this.parent=this.attach('parent',Infinity,{liftoff:true,blockFly:true},p=>{if(this.parent===p){this.parent=null;this.remove(this.timer);this.timer=null;}});
  if(!this.parentLive())return;
  const finish=p=>{if(this.timer===p)this.timer=null;};
  this.timer=this.attach('height',this.source.delay,null,finish,p=>{
   if(this.timer!==p)return;this.timer=null;
   if(this.parentLive()){
    this.height={start:p.commandAt??this.b.time,from:this.heightNow(),to:this.source.height_offset,duration:this.source.height_duration};this.syncVisual();
   }
  });
 }
 tick(){if(this.seq!==null&&!this.valid())this.stop();
  else if(this.parent&&!this.owns(this.parent)){this.parent=null;this.remove(this.timer);this.timer=null;}}

 install(){if(this.stopped||this.handles.length)throw Error('Skybox takeoff cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.seq=u.deploySeq;this.start();}},{owner:u}),
   b.on('tick',()=>this.tick(),{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;const timer=this.timer,parent=this.parent;this.timer=null;this.parent=null;
  this.remove(timer);this.remove(parent);for(const h of this.handles)this.b.off(h);this.handles=[];
  if(this.changed&&this.u.deploySeq===this.seq){const v=this.u.mem.regularFormVisual;
   if(this.visuals.has(v)){const next={...v};delete next.height;delete next.heightOffset;this.u.mem.regularFormVisual=next;}}
  this.height=null;this.heightOffset=0;
 }
}
