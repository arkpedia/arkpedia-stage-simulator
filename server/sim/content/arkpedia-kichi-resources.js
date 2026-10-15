// SPDX-License-Identifier: GPL-3.0-or-later
import {absoluteRangeKeys,canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';
const plain={canHitFly:true};
export class KichiResources{
 constructor(core){this.core=core;this.kills=new Set();this.skillStacks=0;this.cycle=0;this.marked=new Set();
  const id=core.u.id;this.frontKey=`kichi:front:${id}`;this.stackKey=`kichi:s1:${id}`;this.talentKey=`kichi:talent:${id}`;}
 syncMarks(){const{b,u,trait}=this.core,active=this.core.valid()&&!u.hidden;
  const keys=new Set(absoluteRangeKeys(trait.rangeGrid,u.tileR,u.tileC,u.dir));
  for(const e of new Set([...b.enemies,...this.marked])){const include=active&&this.core.valid()&&canTargetEnemy(u,e,plain)&&bodyInKeys(e,keys);
   if(include){if(!e.findBuff(this.frontKey))b.addBuff(e,{key:this.frontKey,source:u,data:{kichiFront:true}});
    if(this.core.valid())this.marked.add(e);else b.removeBuff(e,this.frontKey);}
   else if(this.marked.has(e)){b.removeBuff(e,this.frontKey);this.marked.delete(e);}
  }
 }
 frontScale(e){return e.buffs.some(b=>b.data.kichiFront)?this.core.trait.bb.atk_scale:1;}
 killed(killer,victim){const{b,u,record:r}=this.core,t=r.talentBb[0];
  if(!t||!this.core.valid()||killer!==u||victim.side!=='enemy'||this.kills.size>=t.max_stack_cnt)return;
  const id=victim.defId;if(typeof id!=='string'||this.kills.has(id))return;
  this.kills.add(id);b.addBuff(u,{key:this.talentKey,source:u,mods:{dmgDealtMul:1+this.kills.size*t.damage_scale}});
 }
 afterAttack(mode,activation){const{b,u,record:r}=this.core;
  if(!this.core.valid()||!u.skill.active||u.skill.activations!==activation)return;
  if(mode===1){this.skillStacks=Math.min(r.bb.max_stack_cnt,this.skillStacks+1);
   b.addBuff(u,{key:this.stackKey,source:u,mods:{atkPct:r.bb.atk*this.skillStacks}});
  }else if(mode===2)this.cycle=(this.cycle+1)%3;
 }
 status(target,cycle){const{b,u,record:r}=this.core;
  if(cycle===0)b.applyStatus(target,'sluggish',{source:u,duration:r.bb['attack@sluggish']});
  else if(cycle===1)b.applyStatus(target,'bind',{source:u,duration:r.bb['attack@unmoveable']});
  else b.applyStatus(target,'stun',{source:u,duration:r.bb['attack@stun']});
 }
 resetSkill(){this.skillStacks=0;this.cycle=0;this.core.b.removeBuff(this.core.u,this.stackKey);}
 clear(){this.resetSkill();this.core.b.removeBuff(this.core.u,this.talentKey);
  for(const e of this.marked)this.core.b.removeBuff(e,this.frontKey);this.marked.clear();}
}
