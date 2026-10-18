// SPDX-License-Identifier: GPL-3.0-or-later
// Held first-modifier talent only; no operator, attacks or skills are admitted.
import {SKYBOX_ID as ID,selectedSkyboxInputs,skyboxNativeInputs} from './arkpedia-skybox-source.js';
import {isCurrentTargetModifierReceipt} from '../damage.js';

export const SKYBOX_TALENT_CONTRACT=Object.freeze({
 scope:'Selected Skybox self parent, first-recipient modifier event, independent Silence and derived source-specific mark; no attacks, skills or public admission.',
 mapping:'The original before-target-modifier event maps to one local receipt after accuracy/evasion resolution and before HP arithmetic. Accepted packets apply the selected missable Silence and then the non-missable mark; missed packets skip Silence but still spend the mark. Protected/cancelled packets do not enter this local talent event. Full shields do not cancel an accepted modifier. An owned current self parent and source/recipient lives gate new work. A parent-derived infinite mark, rather than a permanent JS seen-set, owns the first-target memory. Removed marks permit another attempt. Accepted Silence is separately timed and nonderived, survives owner/parent departure, and uses normal immunity/status admission. Foreign effects are never adopted or removed. Reentrant packets to a currently processing recipient cannot duplicate the action list.',
 limitations:'Native event/accuracy/protection order, inherited miss context, callback recursion and parent attachment/dispel timing remain explicit local mappings. Independent source-specific Silence instances reproduce effective duration, not compiled buff-priority internals. Hidden-source event suspension, original attacks/height modes/skills, public delivery, modules, native VFX/audio and compiled/frame/pixel parity remain separate.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifySkyboxTalentSource(n=skyboxNativeInputs()){
 const a=n.talent,p=a._buffs[0],nodes=n.templates.skybx_t_1.eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER,
  [target,check,not,silence,next,mark]=nodes,db=n.buffDatabase.silence;
 if(a._selector.m_PathID!=='0'||a._attachPassiveBuffsOnDummy!==1||p.buffKey!=='skybx_t_1'||p.templateKey!=='skybx_t_1'
  ||p.lifeTimeType!==2||p.isSilenceable!==0||p.isStunnable!==0||p.isDamageMissable!==0
  ||nodes.length!==6||!target.$type.includes('+IfTarget,')||target._unitType!=='ENEMY'||!target._checkTargetUnitType||target._checkTargetFree
  ||!check.$type.includes('+CheckContainsBuff,')||check._buffKeys.join()!=='skybx_t_1[mark]'||!check._checkBuffSource||check._buffSourceType!=='BUFF_OWNER'
  ||!not.$type.includes('+IfNot,')||!silence.$type.includes('+CreateBuffById,')||silence._buffKey!=='silence'||silence._isDerivedBuff!==false
  ||!next.$type.includes('+AlwaysNext,')||!mark.$type.includes('+CreateBuff,')||mark._buff.buffKey!=='skybx_t_1[mark]'
  ||mark._isDerivedBuff!==true||mark._finishDerivedBuffIfParentFinish!==true||mark._buff.lifeTimeType!=='INFINITY'||mark._buff.isDamageMissable!==false
  ||db.isDamageMissable!==true||db.durationKey!=='silence'||db.lifeTimeType!=='LIMITED'||db.attributes.abnormalFlags.join()!=='SILENCED')
  throw Error('Changed original Skybox first-modifier talent inputs');
}
export class SkyboxFirstModifierTalent{
 constructor(b,u,{contract}={}){
  if(contract!==SKYBOX_TALENT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Skybox and exact talent contract required');
  verifySkyboxTalentSource();this.b=b;this.u=u;this.record=selectedSkyboxInputs(u);
  this.bb=this.record.talentBb.find(bb=>Number.isFinite(bb.silence));this.seq=null;this.stopped=false;
  this.parent=null;this.records=new Map();this.silences=new Map();this.watchers=[];this.processing=new Set();this.handles=[];
 }
 presentSource(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 parentLive(){const p=this.parent;return this.presentSource()&&!!this.bb&&p&&!p.finished&&this.u.buffs.includes(p.buff)&&p.buff.data.skyboxParent===p;}
 valid(){return this.parentLive()&&!this.u.hidden;}
 target(t,life){return !this.b.finished&&present(t)&&t.side==='enemy'&&t.deploySeq===life;}
 markKey(t,life=t.deploySeq){return `skybx_t_1[mark]:${this.u.id}:${this.seq}:${life}`;}
 silenceKey(t,life){return `skybx_t_1[silence]:${this.u.id}:${this.seq}:${life}`;}
 finish(p){if(p.finished)return;p.finished=true;
  if(p.buff?.data?.skyboxMark===p&&p.target.buffs.includes(p.buff))this.b.removeBuff(p.target,p.buff);
  if(this.records.get(p.target)===p)this.records.delete(p.target);
 }
 prune(){for(const p of [...this.records.values()])if(!present(p.target)||p.target.deploySeq!==p.life||p.finished
  ||!p.target.buffs.includes(p.buff)||p.buff.data.skyboxMark!==p)this.finish(p);}
 marked(t){return t.buffs.some(b=>b.source===this.u&&(b.key==='skybx_t_1[mark]'||b.key===this.markKey(t))
  &&(!b.data?.skyboxMark||!b.data.skyboxMark.finished&&b.data.skyboxMark.life===t.deploySeq));}
 start(){if(!this.presentSource()||!this.bb)return;const p={owner:this,life:this.seq,finished:false,buff:null},key=`skybx_t_1:${this.u.id}:${this.seq}`;
  const admit=(_unit,buff)=>this.presentSource()&&!p.finished&&(!buff||buff.key===key&&buff.source===this.u&&buff.data.skyboxParent===p)
   &&(!this.u.findBuff(key)||this.u.findBuff(key).data.skyboxParent===p);
  p.buff=this.b.addBuff(this.u,{key,source:this.u,refresh:'keep',data:{skyboxParent:p},admit,
   onRemove:()=>{p.finished=true;this.stop();}});
  if(p.buff?.data?.skyboxParent!==p)return;
  if(!admit()){if(this.u.buffs.includes(p.buff))this.b.removeBuff(this.u,p.buff);return;}this.parent=p;
 }
 silence(t,life){const key=this.silenceKey(t,life),existing=t.findBuff(key);
  if(existing&&existing.data?.skyboxSilence?.owner!==this)return;
  const token=existing?.data.skyboxSilence??{owner:this,life,finished:false};
  const admit=(_unit,buff)=>this.target(t,life)&&!token.finished&&(!buff||buff.key===key&&buff.source===this.u&&buff.data.skyboxSilence===token&&buff.flags?.silence===true)
   &&(!t.findBuff(key)||t.findBuff(key).data.skyboxSilence===token);
  this.b.applyStatus(t,'silence',{key,duration:this.bb.silence,source:this.u,refresh:'extend',buffData:{skyboxSilence:token},
   admit,onBuffRemove:()=>{token.finished=true;}});
  // Already admitted Silence is nonderived. Only a recipient life ending can
  // invalidate that old instance; parent/source departure must not remove it.
  const buff=t.findBuff(key);if(buff?.data?.skyboxSilence!==token)return;
  if(!this.target(t,life)){this.b.removeBuff(t,buff);return;}
  this.silences.set(buff,{target:t,life,token,buff});this.watch();
 }
 finishSilence(p){if(p.buff.data.skyboxSilence===p.token&&p.target.buffs.includes(p.buff))this.b.removeBuff(p.target,p.buff);
  this.silences.delete(p.buff);this.unwatch();}
 pruneSilences(){for(const p of [...this.silences.values()])if(!this.target(p.target,p.life)||p.token.finished
  ||!p.target.buffs.includes(p.buff)||p.buff.data.skyboxSilence!==p.token)this.finishSilence(p);}
 clearSilences(){for(const p of [...this.silences.values()])this.finishSilence(p);}
 watch(){if(this.watchers.length||!this.silences.size)return;const b=this.b;
  const removed=({unit})=>{for(const p of [...this.silences.values()])if(p.target===unit)this.finishSilence(p);};
  this.watchers=[b.on('tick',()=>this.pruneSilences()),b.on('removed',removed),b.on('death',removed),b.on('battleEnd',()=>this.clearSilences())];}
 unwatch(){if(this.silences.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 mark(t,life){if(!this.parentLive()||!this.target(t,life)||this.marked(t))return;
  const p={owner:this,target:t,life,finished:false,buff:null},key=this.markKey(t,life);
  const admit=(_unit,buff)=>this.parentLive()&&this.target(t,life)&&!p.finished&&(!buff||buff.key===key&&buff.source===this.u&&buff.data.skyboxMark===p)
   &&(!t.findBuff(key)||t.findBuff(key).data.skyboxMark===p);
  p.buff=this.b.addBuff(t,{key,source:this.u,refresh:'keep',data:{skyboxMark:p},admit,onRemove:()=>this.finish(p)});
  if(p.buff?.data?.skyboxMark!==p)return;
  if(!admit()){if(t.buffs.includes(p.buff))this.b.removeBuff(t,p.buff);return;}this.records.set(t,p);
 }
 modifier(ctx){if(!isCurrentTargetModifierReceipt(ctx))return;const{source,target:t,targetLife:life,outcome}=ctx;
  if(source!==this.u||!['accepted','missed'].includes(outcome)||!this.valid()||!this.target(t,life)||t.hidden||this.processing.has(t))return;
  this.prune();if(this.marked(t))return;this.processing.add(t);
  try{if(outcome==='accepted')this.silence(t,life);this.mark(t,life);}finally{this.processing.delete(t);}
 }
 install(){if(this.stopped||this.handles.length)throw Error('Skybox talent cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.seq=u.deploySeq;this.start();}},{owner:u}),
   b.on('beforeTargetModifier',c=>this.modifier(c),{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&(!this.presentSource()||this.parent&&!this.u.buffs.includes(this.parent.buff)))this.stop();else this.prune();},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;const parent=this.parent;this.parent=null;
  for(const p of [...this.records.values()])this.finish(p);
  if(parent?.buff?.data?.skyboxParent===parent&&this.u.buffs.includes(parent.buff))this.b.removeBuff(this.u,parent.buff);
  if(this.b.finished)this.clearSilences();
  for(const h of this.handles)this.b.off(h);this.handles=[];
 }
}
