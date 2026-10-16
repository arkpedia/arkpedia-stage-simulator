// SPDX-License-Identifier: GPL-3.0-or-later
// Selected S2 recipient barriers. The owner controller owns mode/ammo, not the damage packet.
import {canTargetEnemy} from '../targeting.js';
const present=t=>t?.alive&&t.deployed&&!t._removing;
export class MechanistS2Shields{
 constructor(core){this.core=core;this.b=core.b;this.u=core.u;this.base=core.resources;this.record=core.record;this.entries=new Map();this.handles=[];this.stopped=false;this.bursts=0;this.refills=0;this.nextAdmission=0;this.admissions=new Map();this.pendingAdmissions=new Map();}
 targetValid(t,life){return !this.stopped&&!this.b.finished&&present(t)&&t.deploySeq===life&&this.core.valid()
  &&(t===this.u||this.base.tokens.get(t)?.life===life);}
 clear(t){const old=this.entries.get(t);if(old)this.b.removeBuff(t,old.buff);if(this.entries.get(t)===old)this.entries.delete(t);this.admissions.delete(t);}
 start(){for(const t of [...this.entries.keys()])this.clear(t);const targets=[...this.base.tokens].filter(([t,r])=>r.life===t.deploySeq&&present(t)).map(([t])=>t);
  // Native mode initialization grants current tokens first, then its owner.
  for(const t of [...targets,this.u]){if(!this.core.inMode())break;this.attach(t,t.deploySeq);}
 }
 attach(t,life){if(!this.targetValid(t,life))return false;const sourceLife=this.u.deploySeq,activation=this.u.skill.activations,key=`mcnist:s2:shield:${this.u.id}:${t.id}`,
  e={target:t,life,sourceLife,activation,key,admission:++this.nextAdmission,buff:null,handled:false,resolving:false,absorbed:0};
  const absorb=c=>this.absorb(e,c);this.admissions.set(t,e.admission);this.pendingAdmissions.set(absorb,e);let buff;
  try{buff=this.b.addBuff(t,{key,source:this.u,shield:t.s.maxHp*this.record.bb.hp_ratio,visible:true,onShieldAbsorbWhenEmpty:true,keepDepletedShield:true,
   onShieldAbsorb:absorb,onRemove:({buff})=>{if(this.entries.get(t)?.buff===buff)this.entries.delete(t);if(this.admissions.get(t)===e.admission)this.admissions.delete(t);}});
  }finally{this.pendingAdmissions.delete(absorb);}
  e.buff=buff;if(!buff||!this.targetValid(t,life)||sourceLife!==this.u.deploySeq||activation!==this.u.skill.activations||this.admissions.get(t)!==e.admission||t.findBuff(key)!==buff){if(buff)this.b.removeBuff(t,buff);if(this.admissions.get(t)===e.admission)this.admissions.delete(t);return false;}
  this.entries.set(t,e);return true;
 }
 ownedRemaining(e){return e.target.buffs.reduce((n,s)=>n+((s.source===this.u||s.source===e.target)&&Number.isFinite(s.shield)?Math.max(0,s.shield):0),0);}
 absorb(e,c){const t=e.target;if(!this.targetValid(t,e.life)||this.u.deploySeq!==e.sourceLife||this.entries.get(t)!==e||t.findBuff(e.key)!==c.buff)return;
  if(e.resolving){c.remaining=0;return;}if(e.handled){if(this.ownedRemaining(e)===0)c.remaining=0;return;}e.absorbed+=c.absorbed;if(!c.depleted)return;e.handled=true;
  if(this.ownedRemaining(e)===0)c.remaining=0;
  try{
   if(this.core.inMode()&&this.u.skill.activations===e.activation){
    e.resolving=true;try{this.burst(e);}finally{e.resolving=false;}
   }
   // Read the remaining count after burst callbacks, then preserve the native
   // check -> manual-count event -> replacement order, including the last one.
   if(this.targetValid(t,e.life)&&this.entries.get(t)===e&&this.core.inMode()&&this.u.skill.activations===e.activation&&this.u.skill.ammoLeft>0){
    const activation=this.u.skill.activations;this.u.skill.ammoLeft--;
    if(this.b._hooks.ammoUsed)this.b.emit('ammoUsed',{unit:this.u,left:this.u.skill.ammoLeft,skill:this.u.skill});
    if(this.u.skill.activations===activation&&this.core.inMode()&&this.u.skill.ammoLeft<=0)this.u.skill.end('ammo');
    if(this.targetValid(t,e.life)&&this.u.skill.activations===activation){if(this.attach(t,e.life)){this.refills++;}}
   }
  }finally{e.resolving=false;this.b.removeBuff(t,e.buff);if(this.entries.get(t)===e)this.entries.delete(t);}
 }
 burst(e){const b=this.b,u=this.u,bb=this.record.bb,center={x:e.target.x,y:e.target.y},atk=u.s.atk*u.s.atkScaleMul,attackId=++b._attackSeq;
  const targets=b.foesInRadius(center.x,center.y,bb.range_radius).filter(t=>canTargetEnemy(u,t,{canHitFly:true})).map(target=>({target,life:target.deploySeq}));
  this.bursts++;const accepted=new Set(),hook=b.on('calculatedDamage',c=>{if(c.credit===u&&c.dmg.attackId===attackId&&c.dmg.tags?.includes('mcnist:s2-break'))accepted.add(c.target);});
  try{for(const{target:t,life}of targets){if(b.finished)break;if(!present(t)||t.deploySeq!==life||!canTargetEnemy(u,t,{canHitFly:true}))continue;
    b.dealDamage(u,t,{amount:atk*bb.atk_scale,type:'arts',isAttack:true,isSkill:true,isSplash:true,attackId,applyWay:'none',tags:['mcnist:s2-break']});
    if(!b.finished&&accepted.has(t)&&present(t)&&t.deploySeq===life)b.applyStatus(t,'tremble',{duration:bb.not_combat,source:u});
  }}finally{b.off(hook);}
 }
 install(){if(this.stopped||this.handles.length)throw Error('Mechanist S2 shields cannot be reinstalled');const b=this.b;
  this.handles=[b.on('beforeBuff',c=>{const e=this.pendingAdmissions.get(c.buff.onShieldAbsorb);if(e&&(!this.targetValid(e.target,e.life)||e.sourceLife!==this.u.deploySeq||e.activation!==this.u.skill.activations||this.admissions.get(e.target)!==e.admission))c.cancel=true;},{owner:this.u,priority:-1000000}),
   b.on('deploy',({unit,move})=>{if(!move&&unit!==this.u&&this.core.inMode()&&this.base.tokens.get(unit)?.life===unit.deploySeq)this.attach(unit,unit.deploySeq);},{owner:this.u,priority:-1000}),
   b.on('removed',({unit})=>this.clear(unit),{owner:this.u}),b.on('death',({unit})=>this.clear(unit),{owner:this.u}),
   b.on('tick',()=>{for(const[t,e]of this.entries)if(!this.targetValid(t,e.life))this.clear(t);},{owner:this.u}),b.on('battleEnd',()=>this.stop(),{owner:this.u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const t of [...this.entries.keys()])this.clear(t);for(const h of this.handles)this.b.off(h);this.handles=[];}
}
