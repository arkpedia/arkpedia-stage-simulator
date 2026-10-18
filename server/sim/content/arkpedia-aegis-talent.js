// SPDX-License-Identifier: GPL-3.0-or-later
// Held selected Physical output/resistance parent, independent of trait and skill.
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs} from './arkpedia-aegis-source.js';
export const AEGIS_TALENT_CONTRACT=Object.freeze({
 scope:'Original selected Aegis independently owned Physical output and incoming-resistance talent only; no attacks/skills/public admission.',
 mapping:'One accepted original infinite talent parent maps native Physical ON_OUTPUT_DAMAGE DamageScale to physDealtMul and Physical ON_TAKE_DAMAGE one-minus DamageScale to physTakenMul. Both shared channels act after ordinary DEF mitigation, preserve separate outgoing/incoming multipliers and do not affect Arts, True or direct HP loss. Selected E1/E2/potential values are not baked into printed ATK. Source nonstacking maps to one owned parent per deployment, not a repeated per-packet buff. The passive survives silence/stun/hiding while its source parent remains; dispel/retirement removes only that parent and listeners. Locked E0 has no talent parent. Refused, prefinished, transformed and stale-life admission cannot grant modifiers.',
 limitations:'Native damage-event/priority and nonstacking aggregation semantics map to existing typed multiplicative stat channels. Original projectile source lookup and post-retirement snapshot attributes are separate transport contracts. Native FX/audio/modules and compiled/frame/pixel parity are not claimed.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifyAegisTalent(n=aegisNativeInputs()){
 const a=n.talent,p=a._buffs[0],t=n.templates.aigis_t_1.eventToActions,events=Object.keys(t).sort();
 if(a._selector.m_PathID!=='0'||a._attachPassiveBuffsOnDummy!==1||a._buffs.length!==1||p.buffKey!=='aigis_t_1'||p.templateKey!=='aigis_t_1'
  ||p.lifeTimeType!==2||p.isSilenceable!==0||p.isStunnable!==0||p.isDamageMissable!==0
  ||events.join()!=='ON_OUTPUT_DAMAGE,ON_TAKE_DAMAGE')throw Error('Changed original Aegis Physical talent parent');
 for(const [key,minus]of[['ON_OUTPUT_DAMAGE',false],['ON_TAKE_DAMAGE',true]]){
  const nodes=t[key],[d]=nodes;if(nodes.length!==1||!d.$type.includes('+DamageScale,')||d._filterDamageType!==true||d._damageMask!=='PHYSICAL'
   ||d._filterApplyWay!==false||d._filterModifierKey!==false||d._isOneMinus!==minus||d._isStackable!==false||d._isValidStackCnt!==false)
   throw Error('Changed original Aegis Physical talent action');
 }
}
export class AegisPhysicalTalent{
 constructor(b,u,{contract}={}){
  if(contract!==AEGIS_TALENT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Aegis and exact talent contract required');
  verifyAegisTalent();this.b=b;this.u=u;this.record=selectedAegisInputs(u);this.bb=this.record.talentBb.find(bb=>Number.isFinite(bb.damage_scale)&&Number.isFinite(bb.damage_resistance));
  this.seq=null;this.parent=null;this.stopped=false;this.started=false;this.handles=[];
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 owns(p){return !!p&&!p.finished&&p.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisTalent===p&&this.u.buffs.includes(p.buff);}
 parentLive(){return this.valid()&&this.owns(this.parent);}
 remove(p){if(p?.buff?.source===this.u&&p.buff.key===p.key&&p.buff.data?.aegisTalent===p&&this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);}
 start(){if(!this.valid()||this.started)return;this.started=true;if(!this.bb)return;
  const p={key:`aigis_t_1:${this.u.id}:${this.seq}`,finished:false,buff:null},output=this.bb.damage_scale,incoming=1-this.bb.damage_resistance,mods={physDealtMul:output,physTakenMul:incoming};
  let descriptor;const admit=(_u,buff)=>this.valid()&&!p.finished&&(!buff||buff.key===p.key&&buff.source===this.u&&buff.data?.aegisTalent===p
   &&buff.mods?.physDealtMul===output&&buff.mods?.physTakenMul===incoming
   &&Object.keys(buff.mods).sort().join()==='physDealtMul,physTakenMul'&&Object.keys(buff.flags??{}).length===0&&buff.status==null&&(buff===descriptor||buff.stacks===1&&buff.timeLeft===Infinity))
   &&(!this.u.findBuff(p.key)||this.u.findBuff(p.key).data?.aegisTalent===p);
  const finish=()=>{p.finished=true;if(this.parent===p){this.parent=null;this.stop();}};
  descriptor={key:p.key,source:this.u,refresh:'keep',mods,data:{aegisTalent:p},admit,onRemove:finish,onExpire:finish};p.buff=this.b.addBuff(this.u,descriptor);
  if(!admit()||!this.owns(p)){p.finished=true;this.remove(p);return;}this.parent=p;
 }
 install(){if(this.stopped||this.handles.length)throw Error('Aegis talent cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq===null){this.seq=u.deploySeq;this.start();}else if(this.seq!==u.deploySeq)this.stop();},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&(!this.valid()||this.parent&&!this.owns(this.parent)))this.stop();},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;const p=this.parent;this.parent=null;if(p){p.finished=true;this.remove(p);}for(const h of this.handles)this.b.off(h);this.handles=[];}
}
