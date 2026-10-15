// SPDX-License-Identifier: GPL-3.0-or-later
// Held selected-source resources. The caller must bind original cast clocks.
import {TANYA_ID as ID,selectedTanyaBuild,tanyaNativeInputs} from './arkpedia-tanya-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
import {absoluteRangeKeys,canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {registerBerryProtection} from './arkpedia-five-star-medic-second.js';
export const TANYA_RESOURCE_CONTRACT=Object.freeze({
 scope:'Selected Crackborne elemental intake, S1 maximum HP/recovery and permanent S2 DEF stacks with HP-loss erosion response; no attack/cast/public admission',
 mapping:'The caller begins/ends S1 and releases S2. S1 attaches immediately (native waitForCasting zero), preserves HP ratio and uses delayed one-second fixed all-gauge recovery, respecting heal-free and burst lock. S2 adds five capped permanent additive DEF stacks. Each positive accepted HP-loss receipt spends one stack before a current-ATK erosion pulse to all legal ground bodies in the source nine cells. Fully absorbed/floored/blocked HP sets and elemental gauge receipts spend none; HP drain does spend one. Fatal accepted HP loss reacts before shared death bookkeeping. The talent shares the strongest nonstackable elemental-protection channel, with its general and WATER operands added for erosion only.',
 limits:'Compiled modifier priority, stack attribute aggregation, recovery expiry-frame dispatch, native HP-set versus direct assignment distinctions, selector/body aliases and reentrant source-removal order remain explicit mappings. Ordinary HP assignment/max-HP ratio maintenance does not fabricate a damage receipt. Source default nonstackable-channel identity is mapped consistently with existing protection adapters, not certified C# behavior. Source particles/shaders/audio, modules, original game-frame/pixel parity, cast/attack clocks and public admission remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function prepareTanyaResources(b,u,{contract}={}){
 if(contract!==TANYA_RESOURCE_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.tanyaResources)throw Error('Fresh selected Crackborne and explicit resource contract required');
 const r=selectedTanyaBuild({...u.def.raw.arkpedia,skillId:u.def.skill?.id}),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration
  ||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete Crackborne selected resource inputs');
 const n=tanyaNativeInputs(),t=n.templates,heal=t.tanya_s_1.eventToActions.ON_BUFF_TRIGGER[0],check=t['tanya_s_2[check]'].eventToActions.ON_APPLIED_MODIFIER;
 if(n.s1Buff._waitForCasting!==0||n.s1Buff._buffs[0].triggerInterval!==1||n.s1Buff._buffs[0].waitFirstTriggerInterval!==1
  ||heal._ignoreHealFree!==false||heal._valueKey!=='ep_heal'||check[0]._modifierTargetType!=='HP'||check[0]._condType!=='LT'
  ||check[2]._decCnt!==1||check[2]._decCntIfStack!==true||check[3]._rangeId!=='x-4'||check[3]._targetOptions.targetMotion!=='WALK_ONLY'
  ||check[3]._limitMaxTarget!==false||t['tanya_s_2[ep_damage]'].eventToActions.ON_BUFF_START[1]._elementDamageType!=='WATER'
  ||t.tanya_s_2.eventToActions.ON_BUFF_START[0]._stackCntKey!=='max_stack_cnt'
  ||r.index===1&&r.bb.cnt!==r.bb.max_stack_cnt)throw Error('Unreviewed Crackborne native resource graph');
 const resources=new TanyaResources(b,u,r);u.mem.tanyaResources=resources;return resources;
}
export class TanyaResources{
 constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.handles=[];
  this.hpKey=`tanya:s1:${u.id}`;this.stackKey=`tanya:s2:def:${u.id}`;this.talentKey=`tanya:talent:${u.id}`;this.talent=null;this.protection=null;this.s1Ticks=0;this.s1Recovered=0;this.responses=0;}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 beginHp(){if(!this.valid()||this.record.index!==0)return false;this.s1Ticks=0;this.s1Recovered=0;
  const buff=this.b.addBuff(this.u,{key:this.hpKey,source:this.u,mods:{hpPct:this.record.bb.max_hp},interval:1,onTick:({buff})=>{
   if(!this.valid()||this.u.findBuff(this.hpKey)!==buff)return;this.s1Ticks++;
   if(!this.u.s.flags.healFree)this.s1Recovered+=this.b.reduceElement(this.u,this.record.bb.ep_heal);
  }});
  if(!this.valid()){if(buff)this.b.removeBuff(this.u,buff);return false;}void this.u.s;return !!buff;
 }
 endHp(){this.b.removeBuff(this.u,this.hpKey);void this.u.s;}
 addStacks(){if(!this.valid()||this.record.index!==1)return false;
  const r=this.record,buff=this.b.addBuff(this.u,{key:this.stackKey,source:this.u,mods:{defPct:r.bb.def},stacks:r.bb.cnt,maxStacks:r.bb.max_stack_cnt,refresh:'stack',visible:true});
  if(!this.valid()){if(buff)this.b.removeBuff(this.u,buff);return false;}return !!buff;
 }
 stacks(){return this.u.findBuff(this.stackKey)?.stacks??0;}
 react({target,hpLoss}){if(target!==this.u||!(hpLoss>0)||!this.valid()||this.record.index!==1)return;
  const buff=this.u.findBuff(this.stackKey);if(!buff||buff.stacks<=0)return;
  // Native ON_APPLIED_MODIFIER filters real negative HP delta, not damage
  // amount, attack flags or elemental gauge buildup. Spend before the pulse.
  if(--buff.stacks===0)this.b.removeBuff(this.u,buff);else this.u.markDirty();this.responses++;
  const{b,u,record:r}=this,keys=new Set(absoluteRangeKeys(r.skillRangeGrid,u.tileR,u.tileC,u.dir));
  const recipients=b.enemies.filter(t=>canTargetEnemy(u,t,{canHitFly:false})&&bodyInKeys(t,keys));
  for(const t of recipients){if(!this.valid())break;
   b.dealDamage(u,t,{amount:u.s.atk*r.bb.ep_damage_ratio,type:'element',element:'erosion',isAttack:false,isSkill:true,
    canDodge:false,applyWay:'none',tags:['tanya:s2-response']});
  }
 }
 install(){if(this.handles.length||this.stopped)throw Error('Crackborne resources cannot be reinstalled');
  this.handles.push(this.b.on('deploy',({unit,move})=>{
   if(unit!==this.u||move)return;this.seq=unit.deploySeq;
   if(this.record.talentBb[0]){const buff=this.b.addBuff(unit,{key:this.talentKey,source:unit});
    if(!this.valid()){if(buff)this.b.removeBuff(unit,buff);return;}this.talent=buff;this.protection?.();}
  },{owner:this.u}),this.b.on('damaged',ctx=>this.react(ctx),{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));
  const t=this.record.talentBb[0];if(t){const general=t['ep_damage_resistance[other]'],water=t['ep_damage_resistance[water]'];
   this.protection=registerBerryProtection(this.b,this.u,general,a=>a===this.u,
    ()=>this.valid()&&this.talent!=null&&this.u.findBuff(this.talentKey)===this.talent,{elements:{erosion:general+water},self:true});}
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.endHp();this.b.removeBuff(this.u,this.stackKey);this.b.removeBuff(this.u,this.talentKey);this.talent=null;this.protection?.remove();}
}
