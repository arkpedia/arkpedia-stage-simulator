// SPDX-License-Identifier: GPL-3.0-or-later
// Selected talent component only; this does not admit Botany or either skill.
import {BOTANY_ID as ID,selectedBotanyInputs,botanyNativeInputs,botanySourceComponent} from './arkpedia-botany-source.js';
import {bodyInKeys} from '../body.js';
import {canTargetEnemy} from '../targeting.js';

export const BOTANY_TALENT_CONTRACT=Object.freeze({
 scope:'Selected Botany enemy-range erosion-burst parent and independently earned source ASPD; no attacks, skills or public admission.',
 mapping:'Native WATER and ON_BEFORE_EP_BREAK_START map explicitly to erosion and the existing pre-burst elementBurst receipt. Native range/target aliases map to current body/grid enemy selection, including ground and air. Accepted enemy parents own only their event eligibility. Each accepted burst grants a nonderived permanent source stack, using selected attack_speed and max_stack_cnt; enemy range exit, death or parent removal does not remove earned stacks. Source removal ends owned parents, stacks and callbacks.',
 limitations:'Native enum aliases, parent refresh scheduling, implicit max_stack_cnt resolution and buff/event ordering remain local mappings. Compiled client, original art delivery, both skills, modules, native effects/audio and game-frame/pixel parity remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifyBotanyTalentSource(n=botanyNativeInputs()){
 const a=n.talent,parent=a._buffs[0],selector=botanySourceComponent('characters',ID,a._targetValidator.m_PathID)._targetOptions;
 const actions=n.templates.botany_t_1.eventToActions.ON_BEFORE_EP_BREAK_START,[filter,gift]=actions;
 if(a._selector.m_PathID!=='0'||a._removeBuffWhenTargetLeave!==1||a._removeBuffWhenAbilityDetached!==1
  ||parent.templateKey!=='botany_t_1'||parent.isDurableBuff!==1||parent.isSilenceable!==0||parent.isStunnable!==0
  ||selector.targetSide!==2||selector.targetMotion!==3||selector.targetCategory!==1||selector.ignoreTargetFree!==0
  ||actions.length!==2||!filter.$type.includes('FilterEPBreakRecoveryType')||filter._recoveryType!=='WATER'||filter._skipInEPBreakRecoveryCheck!==true
  ||!gift.$type.includes('CreateBuff')||gift._buffOwner!=='BUFF_SOURCE'||gift._isDerivedBuff!==false
  ||gift._buff.lifeTimeType!=='INFINITY'||gift._buff.overrideType!=='STACK'||gift._buff.templateKey!=='empty'
  ||gift._buff.attributes.attributeModifiers[0].attributeType!=='ATTACK_SPEED'
  ||gift._buff.attributes.attributeModifiers[0].formulaItem!=='ADDITION')throw Error('Changed original Botany talent inputs');
}
export class BotanyBurstTalent{
 constructor(b,u,{contract}={}){
  if(contract!==BOTANY_TALENT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Botany and exact talent contract required');
  verifyBotanyTalentSource();this.b=b;this.u=u;this.record=selectedBotanyInputs(u);this.bb=this.record.talentBb[0];
  this.seq=null;this.stopped=false;this.scanning=false;this.granting=false;this.records=new Map();this.handles=[];this.gift=null;
 }
 presentSource(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 valid(){return this.presentSource()&&!this.u.hidden&&!!this.bb;}
 key(){return `botany_t_1[attack_speed]:${this.u.id}:${this.seq}`;}
 eligible(t){return present(t)&&t.side==='enemy'&&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&bodyInKeys(t,this.u.rangeKeySet);}
 identity(p){return !p.finished&&present(p.target)&&p.target.deploySeq===p.life&&p.parent?.data?.botanyParent===p&&p.target.buffs.includes(p.parent);}
 finish(p){if(p.finished)return;p.finished=true;
  if(p.parent?.data?.botanyParent===p&&p.target.buffs.includes(p.parent))this.b.removeBuff(p.target,p.parent);
  if(this.records.get(p.target)===p)this.records.delete(p.target);
 }
 attach(t){const p={target:t,life:t.deploySeq,parent:null,finished:false};
  p.parent=this.b.addBuff(t,{key:`botany_t_1[parent]:${this.u.id}:${this.seq}`,source:this.u,refresh:'keep',data:{botanyParent:p},onRemove:()=>this.finish(p)});
  if(p.parent?.data?.botanyParent!==p)return null;
  if(!this.valid()||!this.identity(p)||!this.eligible(t)){this.finish(p);if(t.buffs.includes(p.parent))this.b.removeBuff(t,p.parent);return null;}
  this.records.set(t,p);return p;
 }
 clearParents(){for(const p of [...this.records.values()])this.finish(p);}
 tick(){if(this.scanning)return;if(!this.valid()){this.clearParents();return;}this.scanning=true;
  try{if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
   for(const p of [...this.records.values()])if(!this.identity(p)||!this.eligible(p.target))this.finish(p);
   for(const t of this.b.enemies){if(!this.valid())break;if(this.eligible(t)&&!this.records.has(t))this.attach(t);}
  }finally{this.scanning=false;}
 }
 burst({target,element}){
  if(element!=='erosion'||this.granting||!this.valid())return;
  this.tick();const p=this.records.get(target);if(!p||!this.identity(p)||!this.eligible(target))return;
  const existing=this.u.findBuff(this.key());if(existing&&existing.data?.botanyGift!==this)return;
  this.granting=true;let buff;
  try{buff=this.b.addBuff(this.u,{key:this.key(),source:this.u,refresh:'stack',stacks:1,maxStacks:this.bb.max_stack_cnt,
   mods:{aspd:this.bb.attack_speed},data:{botanyGift:this}});
  }finally{this.granting=false;}
  if(buff?.data?.botanyGift!==this)return;
  // Once accepted, the gift is nonderived: a callback removing its enemy
  // parent must not erase it. A replaced/retired source may not receive it.
  if(!this.presentSource()){if(this.u.buffs.includes(buff))this.b.removeBuff(this.u,buff);return;}
  this.gift=buff;
 }
 install(){if(this.stopped||this.handles.length)throw Error('Botany talent cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.seq=u.deploySeq;this.tick();}},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.presentSource())this.stop();else this.tick();},{owner:u}),
   b.on('elementBurst',ctx=>this.burst(ctx),{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.clearParents();const gift=this.gift;this.gift=null;
  if(gift?.data?.botanyGift===this&&this.u.buffs.includes(gift))this.b.removeBuff(this.u,gift);
  for(const h of this.handles)this.b.off(h);this.handles=[];
 }
}
