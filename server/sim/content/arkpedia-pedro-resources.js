// SPDX-License-Identifier: GPL-3.0-or-later
// Selected resource graphs only. Attack/cast clocks and public admission are separate.
import {PEDRO_ID as ID,selectedPedroBuild,pedroNativeInputs} from './arkpedia-pedro-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
import {bodyInKeys} from '../body.js';
export const PEDRO_RESOURCE_CONTRACT=Object.freeze({
 scope:'Selected Pedro conditional ally-count talent, cached one-use Arts trigger marks, and two-charge-skill protection snapshots; no attack/cast/public admission',
 mapping:'The caller captures one original source ATK/target-life ticket per accepted S1 projectile and attaches its one-use mark at arrival. The mark consumes before an accepted Arts damage response, including fully shielded receipts, and rejects its own modifier tag. Extra damage is sourceless with Pedro credit and a frozen original ATK operand. The latest admitted S1 mark replaces rather than stacks. S2 accepts a current-ATK heal snapshot, replaces an existing mark only for an equal/stronger amount, and checks inclusive half HP immediately on attachment, then every .2 world seconds. Its consumed heal is sourced by the protected target and respects heal-free and healing multipliers. It then applies minus-one taunt for eight seconds, even if healing is rejected. Born recipient marks survive source retreat, control and range exit; recipient life/battle end remains authoritative. The talent counts accepted source-specific marks on other ordinary operators in current body-overlap range, with no healing/target-free gate, and owns a separately accepted additive ATK modifier when the count is at least two.',
 limits:'Projectile cache timing, latest-source S1 UNIQUE override, shared damage-hook priority, sourceless credit, S2 TARGET attribution, snapshot comparison/rejection order, polling phase and source-independent recipient lifetime are explicit local mappings of the recovered graphs. Compiled C# callback order, source selector enum parity, particles/shaders/audio, modules, original game-frame/pixel parity, attack/cast clocks and public admission remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const S1='pedro:s1:trigger',S2='pedro:s2:protection',TAUNT='pedro:s2:taunt';
const fields=new WeakMap();
function fieldFor(b){let f=fields.get(b);if(!f){f=new PedroField(b);fields.set(b,f);}return f;}
export function preparePedroResources(b,u,{contract}={}){
 if(contract!==PEDRO_RESOURCE_CONTRACT||u.def.charId!==ID||u.deployed||u.mem.pedroResources)throw Error('Fresh selected Pedro and explicit resource contract required');
 const r=selectedPedroBuild({...u.def.raw.arkpedia,skillId:u.def.skill?.id}),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration
  ||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete Pedro selected resource inputs');
 const n=pedroNativeInputs(),t=n.templates,mark=t.pedro_s1_debuff.eventToActions.ON_TAKE_DAMAGE,heal=t.pedro_s2_buff.eventToActions.ON_BUFF_TRIGGER;
 if(mark[0]._damageMask!=='MAGICAL'||mark[1]._customKey!=='pedro_s1_debuff_damage'||mark[4]._cachedAtkKey!=='cached_atk'||!mark[4]._noSource
  ||heal[0]._condType!=='LE'||heal[0]._value!==.5||heal[2]._sourceType!=='TARGET'||!heal[2]._useDynamicVar
  ||n.talentValidator._targetOptions.professionMask!==639||n.talentAura._removeBuffWhenAbilityDetached!==1)throw Error('Unreviewed Pedro native resource graph');
 const resources=new PedroResources(b,u,r);u.mem.pedroResources=resources;return resources;
}
class PedroField{
 constructor(b){this.b=b;this.owners=new Set();this.marks=new Set();this.tickets=new Set();this.busy=0;this.handles=[
  b.on('damaged',ctx=>this.react(ctx)),b.on('tick',()=>this.prune()),b.on('battleEnd',()=>this.end())];}
 register(r){this.owners.add(r);}
 idle(){if(this.owners.size||this.marks.size||this.tickets.size||this.busy)return;for(const h of this.handles)this.b.off(h);this.handles=[];fields.delete(this.b);}
 end(){this.busy++;this.tickets.clear();for(const r of [...this.owners])r.stop();for(const e of [...this.marks])this.b.removeBuff(e.target,e.buff);this.busy--;this.idle();}
 prune(){for(const t of this.tickets)if(this.b.finished||this.b.time>=t.expiresAt||!present(t.target)||t.target.deploySeq!==t.life)this.tickets.delete(t);
  for(const e of [...this.marks])if(!present(e.target)||e.target.deploySeq!==e.life||e.target.findBuff(e.kind==='s1'?S1:S2)!==e.buff){this.marks.delete(e);if(e.target.findBuff(e.kind==='s1'?S1:S2)===e.buff)this.b.removeBuff(e.target,e.buff);}this.idle();}
 remove(e){this.marks.delete(e);this.idle();}
 applyS1(ticket){if(!this.tickets.has(ticket))return false;this.tickets.delete(ticket);
  const {target:t,life}=ticket;if(this.b.finished||this.b.time>=ticket.expiresAt||!present(t)||t.deploySeq!==life){this.idle();return false;}
  const old=t.findBuff(S1)?.data?.pedro,e={...ticket,kind:'s1',buff:null};this.busy++;try{e.buff=this.b.addBuff(t,{key:S1,source:ticket.source,visible:true,data:{pedro:e},onRemove:()=>this.remove(e)});
  if(!e.buff||!present(t)||t.deploySeq!==life||this.b.finished||t.findBuff(S1)!==e.buff){if(e.buff)this.b.removeBuff(t,e.buff);this.idle();return false;}
  if(old)this.marks.delete(old);this.marks.add(e);return true;
  }finally{this.busy--;this.idle();}
 }
 react({target:t,type,dmg}){const e=t.findBuff(S1)?.data?.pedro;
  if(!e||!this.marks.has(e)||type!=='arts'||dmg?.tags?.includes('pedro_s1_debuff_damage')||!present(t)||t.deploySeq!==e.life||this.b.finished)return;
  this.b.removeBuff(t,e.buff);if(!present(t)||t.hp<=0||t.deploySeq!==e.life||this.b.finished)return;
  this.b.dealDamage(e.source,t,{amount:e.cachedAtk*e.scale,type:'arts',sourceless:true,isAttack:false,isSkill:true,canDodge:false,applyWay:'none',tags:['pedro_s1_debuff_damage']});
 }
 protect(r,t){if(!r.valid()||r.record.index!==1||!present(t)||t.side!=='ally')return false;
  const amount=r.u.s.atk*r.record.bb.atk_scale,old=t.findBuff(S2)?.data?.pedro;
  if(old&&old.amount>amount)return false;
  const e={kind:'s2',source:r.u,target:t,life:t.deploySeq,amount,taunt:r.record.bb.taunt_level,duration:r.record.bb.duration,buff:null};
  // Do not finish an existing accepted mark until replacement itself is accepted.
  // This preserves it when beforeBuff rejects the incoming attachment.
  this.busy++;try{e.buff=this.b.addBuff(t,{key:S2,source:r.u,visible:true,data:{pedro:e},interval:.20000000298023224,
   onTick:({buff})=>this.poll(e,buff),onRemove:()=>this.remove(e)});
  if(!e.buff||this.b.finished||!present(t)||t.deploySeq!==e.life||t.findBuff(S2)!==e.buff){if(e.buff)this.b.removeBuff(t,e.buff);this.idle();return false;}
  if(old)this.marks.delete(old);this.marks.add(e);this.poll(e,e.buff);return true;
  }finally{this.busy--;this.idle();}
 }
 poll(e,buff){const t=e.target;if(this.b.finished||!present(t)||t.deploySeq!==e.life||t.findBuff(S2)!==buff||!this.marks.has(e))return;
  if(t.hp>t.s.maxHp*.5)return;
  this.b.removeBuff(t,buff);if(this.b.finished||!present(t)||t.deploySeq!==e.life)return;
  this.b.heal(t,t,e.amount,{isSkill:true});if(this.b.finished||!present(t)||t.deploySeq!==e.life)return;
  this.b.addBuff(t,{key:TAUNT,source:e.source,mods:{taunt:e.taunt},duration:e.duration,visible:true});
 }
}
export class PedroResources{
 constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.handles=[];
  this.parentKey=`pedro:talent:${u.id}`;this.atkKey=`pedro:talent:atk:${u.id}`;this.allyKey=`pedro:talent:ally:${u.id}`;
  this.parent=null;this.allyMarks=new Map();this.age=0;this.field=null;}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 captureS1(t){if(!this.valid()||this.record.index!==0||!present(t)||t.side!=='enemy')return null;
  const ticket=Object.freeze({source:this.u,sourceLife:this.seq,target:t,life:t.deploySeq,cachedAtk:this.u.s.atk,scale:this.record.bb.debuff_atk_scale,expiresAt:this.b.time+10});
  this.field.tickets.add(ticket);return ticket;}
 applyS1(ticket){return !!this.field?.applyS1(ticket);}
 protect(t){return !!this.field?.protect(this,t);}
 clearAllies(){for(const[t,buff]of this.allyMarks)this.b.removeBuff(t,buff);this.allyMarks.clear();this.b.removeBuff(this.u,this.atkKey);}
 syncTalent(){if(!this.valid()||!this.parent||this.u.findBuff(this.parentKey)!==this.parent){this.clearAllies();return;}
  if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  const candidates=this.b.allyUnits.filter(t=>t!==this.u&&present(t)&&t.kind==='op'&&bodyInKeys(t,new Set(this.u.rangeKeys)));
  const wanted=new Set(candidates);
  for(const[t,buff]of this.allyMarks)if(!wanted.has(t)||t.findBuff(this.allyKey)!==buff){this.b.removeBuff(t,buff);this.allyMarks.delete(t);}
  for(const t of candidates){if(!this.valid()||this.u.findBuff(this.parentKey)!==this.parent){this.clearAllies();return;}
   if(this.allyMarks.has(t))continue;const buff=this.b.addBuff(t,{key:this.allyKey,source:this.u});
   if(buff&&this.valid()&&present(t)&&t.findBuff(this.allyKey)===buff)this.allyMarks.set(t,buff);else if(buff)this.b.removeBuff(t,buff);
  }
  if(!this.valid()||this.u.findBuff(this.parentKey)!==this.parent){this.clearAllies();return;}
  if(this.allyMarks.size>=this.record.talentBb[0].cnt){if(!this.u.findBuff(this.atkKey)){const buff=this.b.addBuff(this.u,{key:this.atkKey,source:this.u,mods:{atkPct:this.record.talentBb[0].atk}});if(buff&&(!this.valid()||this.u.findBuff(this.parentKey)!==this.parent))this.b.removeBuff(this.u,buff);}}
  else this.b.removeBuff(this.u,this.atkKey);
 }
 install(){if(this.handles.length||this.stopped)throw Error('Pedro resources cannot be reinstalled');this.field=fieldFor(this.b);this.field.register(this);
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;
   if(this.record.talentBb[0]){this.parent=this.b.addBuff(unit,{key:this.parentKey,source:unit});if(!this.valid()){if(this.parent)this.b.removeBuff(unit,this.parent);return;}this.syncTalent();}
  },{owner:this.u}),this.b.on('tick',({dt})=>{
   if(this.seq===null)return;if(!this.valid()){this.stop();return;}this.age+=dt;
   if(this.age+1e-9>=.20000000298023224){this.age=Math.max(0,this.age-.20000000298023224);this.syncTalent();}
  },{owner:this.u}),this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}));
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.clearAllies();this.b.removeBuff(this.u,this.parentKey);this.parent=null;this.field?.owners.delete(this);this.field?.idle();}
}
