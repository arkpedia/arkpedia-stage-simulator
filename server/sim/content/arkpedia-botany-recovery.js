// SPDX-License-Identifier: GPL-3.0-or-later
// S2 range resource only. The real account/mode controller is a separate admission.
import {BOTANY_ID as ID,selectedBotanyInputs,botanyNativeInputs,botanySourceComponent} from './arkpedia-botany-source.js';
import {canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';
export const BOTANY_RECOVERY_CONTRACT=Object.freeze({
 scope:'Selected Botany S2 erosion-only range parent and burst-recovery-speed attribute; no skill account or public admission.',
 mapping:'Native filterElementDamageType1/elementType2 maps to current erosion injury or erosion burst. The accepted mode-owned range parent maps native attribute35 ADDITION to extra elapsed erosion-burst recovery. The normal timer still advances once. Per-burst, per-tick maximum-source sampling applies only the highest extra recovery speed across overlapping producers; fixed duration reductions remain independent. Recipient/source life, current range, accepted parent, explicit caller mode/account predicate and actual current erosion-burst identity remain authoritative.',
 limitations:'Numeric attribute/element aliases, body/grid membership, priorityBBKeys strongest-source interpretation and sampled buff/timer ordering are explicit local mappings. Compiled callback/stack/frame parity, full S2 composition, modules, native effects/audio/shaders and public admission remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifyBotanyRecoverySource(n=botanyNativeInputs()){
 const a=n.modes[1].abilities[0],buff=a._buffs[0],v=botanySourceComponent('characters',ID,a._targetValidator.m_PathID),m=buff.attributes.attributeModifiers[0];
 if(a._metadata.namedAsAlias!=='RecoverAura'||a._removeBuffWhenTargetLeave!==1||a._removeBuffWhenAbilityDetached!==1
  ||buff.buffKey!=='botany_s2_recover'||buff.templateKey!=='empty'||buff.isSilenceable!==0||buff.isStunnable!==0
  ||buff.priorityBBKeys.join()!=='ep_break_recover_speed'||m.attributeType!==35||m.formulaItem!==1||m.loadFromBlackboard!==1
  ||v._filterElementDamageType!==1||v._elementType!==2||v._targetOptions.targetSide!==2||v._targetOptions.targetMotion!==3
  ||v._targetOptions.ignoreTargetFree!==0)throw Error('Changed original Botany S2 recovery inputs');
}
export class BotanyBurstRecovery{
 constructor(b,u,{contract,affecting}={}){
  if(contract!==BOTANY_RECOVERY_CONTRACT||typeof affecting!=='function'||u.def.charId!==ID||u.deploySeq!==0)
   throw Error('Fresh selected Botany S2, exact recovery contract and explicit account/mode predicate required');
  verifyBotanyRecoverySource();this.b=b;this.u=u;this.record=selectedBotanyInputs(u);
  if(this.record.index!==1)throw Error('Selected original Botany S2 required');
  this.affecting=affecting;this.seq=null;this.stopped=false;this.scanning=false;this.records=new Map();this.handles=[];
 }
 presentSource(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 valid(){return this.presentSource()&&!this.u.hidden&&this.affecting();}
 water(t){return (t.elem.erosion??0)>1e-9||!!t.findBuff('erosionBurst')||!!t.burstPending?.erosion;}
 eligible(t){return present(t)&&t.side==='enemy'&&this.water(t)&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&bodyInKeys(t,this.u.rangeKeySet);}
 identity(p){return !p.finished&&present(p.target)&&p.target.deploySeq===p.life&&p.buff?.data?.botanyRecovery===p&&p.target.buffs.includes(p.buff);}
 finish(p){if(p.finished)return;p.finished=true;
  if(p.buff?.data?.botanyRecovery===p&&p.target.buffs.includes(p.buff))this.b.removeBuff(p.target,p.buff);
  if(this.records.get(p.target)===p)this.records.delete(p.target);
 }
 recover(p,dt){
  if(!this.valid()||!this.identity(p)||!this.eligible(p.target)){this.finish(p);return;}
  const burst=p.target.findBuff('erosionBurst');if(!burst||!(dt>0))return;
  const sample=burst._epRecoverySample?.tick===this.b.tickCount?burst._epRecoverySample:{tick:this.b.tickCount,extra:0};
  const speed=this.record.bb['attack@ep_break_recover_speed'],delta=Math.max(0,speed-sample.extra);
  sample.extra=Math.max(sample.extra,speed);burst._epRecoverySample=sample;
  burst.timeLeft=Math.max(0,burst.timeLeft-delta*dt);if(burst.timeLeft<=1e-9)this.b.removeBuff(p.target,burst);
 }
 attach(t){const p={target:t,life:t.deploySeq,buff:null,finished:false};
  p.buff=this.b.addBuff(t,{key:`botany_s2_recover:${this.u.id}:${this.seq}`,source:this.u,refresh:'keep',data:{botanyRecovery:p},
   onTick:({dt})=>this.recover(p,dt),onRemove:()=>this.finish(p)});
  if(p.buff?.data?.botanyRecovery!==p)return null;
  if(!this.valid()||!this.identity(p)||!this.eligible(t)){this.finish(p);if(t.buffs.includes(p.buff))this.b.removeBuff(t,p.buff);return null;}
  this.records.set(t,p);return p;
 }
 clear(){for(const p of [...this.records.values()])this.finish(p);}
 tick(){if(this.scanning)return;if(!this.valid()){this.clear();return;}this.scanning=true;
  try{if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
   for(const p of [...this.records.values()])if(!this.identity(p)||!this.eligible(p.target))this.finish(p);
   for(const t of this.b.enemies){if(!this.valid())break;if(this.eligible(t)&&!this.records.has(t))this.attach(t);}
  }finally{this.scanning=false;}
 }
 install(){if(this.stopped||this.handles.length)throw Error('Botany recovery cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.seq=u.deploySeq;this.tick();}},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.presentSource())this.stop();else this.tick();},{owner:u}),
   b.on('elementBurst',({element})=>{if(element==='erosion')this.tick();},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.clear();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
