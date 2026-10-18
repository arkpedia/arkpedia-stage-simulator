// SPDX-License-Identifier: GPL-3.0-or-later
// Original independent healing and source-derived camouflage are separate resources.
import {turdusNativeInputs,selectedTurdusInputs} from './arkpedia-turdus-source.js';
export const TURDUS_CAMOU='turdus_s2[camouflage]';
export const TURDUS_RESOURCE_CONTRACT=Object.freeze({
 scope:'Selected Ukusik S2 current-HP loss, independent ATK-snapshot healing and .1-second blocked-dependent derived camouflage; public admission is separate',
 mapping:'The source cast loses its rank fraction of current HP, bypassing damage modifiers/shields and attack SP without killing the caster. Each captured chain receiver independently gets its own duration/one-second ATK-snapshot healing and a source-dependent .1-second camouflage checker. Healing uses AdvancedApplyHeal, respects HealFree and ordinary healing modifiers, and does not become a regeneration attribute. Camouflage is first checked after .1 seconds, is removed while the recipient blocks and may return on a later check. A native same-key camouflage is shared across checker producers: contains/finish actions explicitly ignore buff source. Finishing a checker removes that native family, while unrelated camouflage is preserved. The independent healing survives caster retirement; its recipient life, duration and ATK snapshot remain fixed. A matching live source supplies its current output-healing multiplier; after retirement/replacement the accepted attachment keeps its own output snapshot. Same-producer reapplication replaces its own timers/snapshot; separate producers keep independent healing. Born S2 transport can finish independent attachments after source retirement but cannot keep a new source-dependent checker alive.',
 limits:'Numeric override type 3, source-invalid attachment dispatch, self-cost event timing and HP-loss equivalence, buff tick/expiry boundaries and callbacks are local mappings, not recovered compiled Unity methods. Public art/data/browser gates, modules, native effects/audio and game-frame/pixel parity remain unverified.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
export function verifyTurdusResources(){const n=turdusNativeInputs(),heal=n.templates['turdus_s2[continues_heal]'].eventToActions,camou=n.templates['turdus_s2[try_camouflage]'].eventToActions,self=n.templates['turdus_s2[self_damage]'].eventToActions.ON_BUFF_START[0],buffs=n.s2Heal._activeBuffs;
 if(buffs.length!==2||buffs[0].buffKey!=='turdus_s2[try_camouflage]'||buffs[0].triggerInterval!==0.10000000149011612||buffs[0].waitFirstTriggerInterval!==1||buffs[0].independentCharacterSource!==0
  ||buffs[1].buffKey!=='turdus_s2[continues_heal]'||buffs[1].triggerInterval!==1||buffs[1].waitFirstTriggerInterval!==1||buffs[1].independentCharacterSource!==1
  ||buffs.some(b=>b.durationKey!=='bonus_duration'||b.lifeTimeType!==1||b.isDamageMissable!==0||b.overrideType!==3)
  ||heal.ON_BUFF_START[0]._attributeType!=='ATK'||heal.ON_BUFF_START[0]._targetType!=='BUFF_SOURCE'||!heal.ON_BUFF_TRIGGER[0]._useDynamicVar||heal.ON_BUFF_TRIGGER[0]._ignoreHealFree!==false
  ||self._damageType!=='PURE'||!self._ignoreForSp||!self._isUndeadable||!self._skipModifierEvent||n.s2Self._runActionOnEvent!==2||n.s2Self._buffs[0].buffKey!=='turdus_s2[self_damage]')throw Error('Changed original Ukusik healing or self-cost resources');
 const check=camou.ON_BUFF_TRIGGER[0],remove=check._succeedNodes[0],contains=check._failNodes[0]._conditionNode,create=check._failNodes[0]._failNodes[0],finish=camou.ON_BUFF_FINISH[0];
 if(check._conditionNode._checkBlockedBySource!==false||remove._buffKey!==TURDUS_CAMOU||remove._checkBuffSource!==false||contains._checkBuffSource!==false||contains._buffKeys.join()!==TURDUS_CAMOU
  ||create._buff.buffKey!==TURDUS_CAMOU||create._buff.attributes.abnormalFlags.join()!=='CAMOUFLAGE'||!create._isDerivedBuff||!create._finishDerivedBuffIfParentFinish
  ||finish._buffKey!==TURDUS_CAMOU||finish._checkBuffSource!==false)throw Error('Changed original Ukusik shared camouflage lifecycle');return n;
}
export class TurdusResources{
 constructor(b,u,{contract}={}){if(contract!==TURDUS_RESOURCE_CONTRACT)throw Error('Exact selected Ukusik resource contract required');verifyTurdusResources();Object.assign(this,{b,u,record:selectedTurdusInputs(u),seq:null,stopped:false,ended:false,parents:new Map(),regens:new Map(),watchers:[],attaching:new Set()});}
 install(){this.seq=this.u.deploySeq;}
 valid(){return !this.stopped&&!this.ended&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq;}
 target(t,life){return !this.ended&&!this.b.finished&&present(t)&&t.side==='ally'&&t.deploySeq===life;}
 selfCost(){if(!this.valid()||this.record.index!==1)return;const amount=Math.min(Math.max(0,this.u.hp-1),this.u.hp*this.record.bb['turdus_s2[self_damage].hp_ratio']);if(amount>0)this.b.loseHp(this.u,amount,{source:this.u,tags:['turdus:s2-cost']});}
 removeCamou(p){const own=p.child;if(p.t.deploySeq===p.life)this.b.removeBuff(p.t,TURDUS_CAMOU);else if(own&&p.t.findBuff(TURDUS_CAMOU)===own)this.b.removeBuff(p.t,own);p.child=null;}
 finishParent(p){if(p.finished)return;p.finished=true;if(this.parents.get(p.t)===p)this.parents.delete(p.t);this.removeCamou(p);this.unwatch();}
 removeParent(p){if(p.finished)return;if(p.buff&&p.t.findBuff(p.key)===p.buff)this.b.removeBuff(p.t,p.buff);this.finishParent(p);}
 checkParent(p){if(p.finished)return;if(!this.valid()||!this.target(p.t,p.life)||p.t.findBuff(p.key)!==p.buff){this.removeParent(p);return;}
  const blocked=p.t.blocking.some(t=>present(t)&&t.blockedBy===p.t);if(blocked){this.removeCamou(p);return;}
  if(p.t.findBuff(TURDUS_CAMOU))return;
  const child=this.b.addBuff(p.t,{key:TURDUS_CAMOU,source:this.u,flags:{camou:true},visible:true});
  if(!child)return;
  if(!this.valid()||!this.target(p.t,p.life)||p.t.findBuff(p.key)!==p.buff){if(p.t.findBuff(TURDUS_CAMOU)===child)this.b.removeBuff(p.t,child);return;}
  p.child=child;
 }
 attach(t,ctx){if(this.ended||this.b.finished||this.record.index!==1||!present(t)||t.side!=='ally'||this.attaching.has(t))return;
  const life=t.deploySeq,{b,u,record:r}=this,duration=r.bb.bonus_duration,atk=present(u)&&u.deploySeq===ctx.sourceLife?u.s.atk:ctx.atk;this.attaching.add(t);
  try{
   if(this.valid()){
    const old=this.parents.get(t);if(old)this.removeParent(old);
    if(this.valid()&&this.target(t,life)){
     const p={t,life,key:`turdus:s2:checker:${u.id}:${ctx.sourceLife}`,buff:null,child:null,finished:false};
     p.buff=b.addBuff(t,{key:p.key,source:u,duration,interval:.1,data:{nativeKey:'turdus_s2[try_camouflage]'},onTick:()=>this.checkParent(p),onRemove:()=>this.finishParent(p)});
     if(p.buff){if(this.valid()&&this.target(t,life)&&t.findBuff(p.key)===p.buff)this.parents.set(t,p);else if(t.findBuff(p.key)===p.buff)b.removeBuff(t,p.buff);}
    }
   }
   // Independent non-missable attachment follows even when the checker was vetoed or its source retired in a callback.
   if(this.target(t,life)){
    const old=this.regens.get(t);if(old){this.regens.delete(t);if(t.findBuff(old.key)===old.buff)b.removeBuff(t,old.buff);}
    if(this.target(t,life)){
     const p={t,life,key:`turdus:s2:heal:${u.id}:${ctx.sourceLife}`,atk,sourceLife:ctx.sourceLife,healingDealtMul:present(u)&&u.deploySeq===ctx.sourceLife?u.s.healingDealtMul:ctx.healingDealtMul??1,buff:null};
     p.buff=b.addBuff(t,{key:p.key,source:u,duration,interval:1,data:{nativeKey:'turdus_s2[continues_heal]',snapshotAtk:atk},onTick:()=>{
      if(this.target(t,life)&&t.findBuff(p.key)===p.buff)b.heal(u,t,p.atk*r.bb['turdus_s2[continues_heal].heal_scale'],{isSkill:true,tags:['turdus:s2-periodic'],...(!(present(u)&&u.deploySeq===p.sourceLife)?{sourceHealingDealtMul:p.healingDealtMul}:{})});
     },onRemove:()=>{if(this.regens.get(t)===p)this.regens.delete(t);this.unwatch();}});
     if(p.buff){p.atk=present(u)&&u.deploySeq===ctx.sourceLife?u.s.atk:ctx.atk;p.healingDealtMul=present(u)&&u.deploySeq===ctx.sourceLife?u.s.healingDealtMul:ctx.healingDealtMul??p.healingDealtMul;p.buff.data.snapshotAtk=p.atk;if(this.target(t,life)&&t.findBuff(p.key)===p.buff)this.regens.set(t,p);else if(t.findBuff(p.key)===p.buff)b.removeBuff(t,p.buff);}
    }
   }
  }finally{this.attaching.delete(t);this.watch();}
 }
 watch(){if(this.watchers.length||!this.parents.size&&!this.regens.size)return;this.watchers=[this.b.on('tick',()=>{
  for(const p of this.parents.values())if(!this.valid()||!this.target(p.t,p.life)||p.t.findBuff(p.key)!==p.buff)this.removeParent(p);
  for(const[t,p]of this.regens)if(!this.target(t,p.life)||t.findBuff(p.key)!==p.buff){this.regens.delete(t);if(t.findBuff(p.key)===p.buff)this.b.removeBuff(t,p.buff);}
  this.unwatch();
 }),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.parents.size||this.regens.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 stop(){if(this.stopped)return;this.stopped=true;for(const p of this.parents.values())this.removeParent(p);this.unwatch();}
 drain(){this.ended=true;this.stop();for(const[t,p]of this.regens){this.regens.delete(t);if(t.findBuff(p.key)===p.buff)this.b.removeBuff(t,p.buff);}this.unwatch();}
}
