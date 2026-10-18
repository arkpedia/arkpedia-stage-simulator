// SPDX-License-Identifier: GPL-3.0-or-later
// Held deployment passive only. Native skill transitions compose separately.
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs} from './arkpedia-aegis-source.js';
import {regularVisualHeight} from '../../../shared/arkpedia/regular-form-visual.js';
import {commandBlockMode,clearBlockMode} from '../block-mode.js';
export const AEGIS_TAKEOFF_CONTRACT=Object.freeze({
 scope:'Original selected Aegis deployment parent, explicit FLY command and instantaneous graphic height only; no attacks/skills/public admission.',
 mapping:'Native ON_BUFF_START maps to accepted deployment-parent admission and ON_OWNER_BORN to this deployment event. The parent supplies ground-evasion flag35; its separate ChangeCharBlockMode command selects FLY without changing motion or tile height. The original owner-born height action has height_offset0.4000000059604645 and a missing height_duration blackboard key/default0, so it snaps rather than inheriting Skybox\'s timer/tween. Dispel removes the parent flag but does not undo an already issued persistent command or graphic offset. Commands, parent and decorated visuals have distinct identity and one source deployment life. Refusal or life replacement before a command cannot synthesize it; newer foreign commands/visuals are preserved.',
 limitations:'Compiled passive/born ordering, absent blackboard duration fallback and command persistence are explicit local mappings. Skill landing/stun/kick transitions and the trait\'s conditional skill-damage action are separate. Native FX/audio/shaders/modules and compiled/game-frame/pixel parity are not claimed.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifyAegisTakeoff(n=aegisNativeInputs()){
 const a=n.takeoff,p=a._buffs[0],t=n.templates.aigis_tr.eventToActions,[mode]=t.ON_BUFF_START,[height]=t.ON_OWNER_BORN,
  bb=Object.fromEntries(p.blackboard.map(v=>[v.key,v.value]));
 if(a._selector.m_PathID!=='0'||a._attachPassiveBuffsOnDummy!==1||a._buffs.length!==1||p.buffKey!=='aigis_tr'||p.templateKey!=='aigis_tr'
  ||p.lifeTimeType!==2||p.isSilenceable!==0||p.isStunnable!==0||p.attributes.abnormalFlags.join()!=='35'
  ||Object.keys(bb).join()!=='height_offset'||bb.height_offset!==0.4000000059604645
  ||t.ON_BUFF_START.length!==1||!mode.$type.includes('+ChangeCharBlockMode,')||mode._target!=='BUFF_OWNER'||mode._blockMode!=='FLY'||mode._resetToDefault!==false
  ||t.ON_OWNER_BORN.length!==1||!height.$type.includes('+ModifyGraphicHolderHeight,')||height._target!=='BUFF_OWNER'
  ||height._OffsetKey!=='height_offset'||height._durationKey!=='height_duration'||height._duration!==0||height._useGlobalPos!==false
  ||n.root._motionMode!==0||n.root._buildCondition.buildableType!==2)throw Error('Changed original Aegis deployment inputs');
 return{heightOffset:bb.height_offset,heightDuration:height._duration};
}
export class AegisTakeoff{
 constructor(b,u,{contract}={}){
  if(contract!==AEGIS_TAKEOFF_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Aegis and exact takeoff contract required');
  selectedAegisInputs(u);this.source=verifyAegisTakeoff();this.b=b;this.u=u;this.seq=null;this.started=false;this.stopped=false;
  this.parent=null;this.command=null;this.height=null;this.heightOffset=0;this.visuals=new WeakSet();this.handles=[];
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 owns(p){return !!p&&!p.finished&&p.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisTakeoff===p&&p.buff.flags?.liftoff===true&&this.u.buffs.includes(p.buff);}
 parentLive(){return this.valid()&&this.owns(this.parent);}
 heightNow(){return regularVisualHeight(this,this.b.time);}
 decorate(visual){const v={...visual,...(this.height?{height:{...this.height}}:{heightOffset:this.heightOffset})};this.visuals.add(v);return v;}
 syncVisual(){if(!this.valid())return;const v=this.u.mem.regularFormVisual;
  if(v==null)this.u.mem.regularFormVisual=this.decorate(v);
  else if(this.visuals.has(v)){delete v.height;delete v.heightOffset;
   Object.assign(v,this.height?{height:{...this.height}}:{heightOffset:this.heightOffset});}}
 heightCommand(to,duration=0,at=this.b.time){if(!this.valid()||![to,duration,at].every(Number.isFinite)||duration<0)return false;
  if(duration===0){this.height=null;this.heightOffset=to;}else this.height={start:at,from:regularVisualHeight(this,at),to,duration};this.syncVisual();return true;}
 blockCommand(mode){if(!this.valid())return false;const p=commandBlockMode(this.b,this.u,mode,this);this.command=p;
  if(!this.valid()){clearBlockMode(this.b,this.u,p);return false;}return true;}
 removeParent(p){if(p?.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisTakeoff===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 start(){if(!this.valid()||this.started)return;this.started=true;
  const p={key:`aigis_tr:${this.u.id}:${this.seq}`,finished:false,buff:null};
  let descriptor;const admit=(_u,buff)=>this.valid()&&!p.finished&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.aegisTakeoff===p&&buff.flags?.liftoff===true&&Object.keys(buff.flags).join()==='liftoff'&&Object.keys(buff.mods??{}).length===0&&buff.status==null&&(buff===descriptor||buff.stacks===1&&buff.timeLeft===Infinity))
   &&(!this.u.findBuff(p.key)||this.u.findBuff(p.key).data?.aegisTakeoff===p);
  const finish=()=>{p.finished=true;if(this.parent===p)this.parent=null;};
  descriptor={key:p.key,source:this.u,refresh:'keep',flags:{liftoff:true},data:{aegisTakeoff:p},admit,onRemove:finish,onExpire:finish};p.buff=this.b.addBuff(this.u,descriptor);
  if(!admit()||!this.owns(p)){p.finished=true;this.removeParent(p);return;}this.parent=p;
  if(!this.blockCommand('FLY')||!this.parentLive())return;
  this.heightCommand(this.source.heightOffset,this.source.heightDuration);
 }
 tick(){if(this.seq!==null&&!this.valid())this.stop();else if(this.parent&&!this.owns(this.parent))this.parent=null;}
 install(){if(this.stopped||this.handles.length)throw Error('Aegis takeoff cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq===null){this.seq=u.deploySeq;this.start();}else if(this.seq!==u.deploySeq)this.stop();},{owner:u}),
   b.on('tick',()=>this.tick(),{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;const p=this.parent;this.parent=null;if(p){p.finished=true;this.removeParent(p);}
  const c=this.command;this.command=null;clearBlockMode(this.b,this.u,c);for(const h of this.handles)this.b.off(h);this.handles=[];
  if(this.u.deploySeq===this.seq&&this.visuals.has(this.u.mem.regularFormVisual)){
   const owned=this.u.mem.regularFormVisual;delete owned.height;delete owned.heightOffset;}
  this.height=null;this.heightOffset=0;
 }
}
