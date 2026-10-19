// SPDX-License-Identifier: GPL-3.0-or-later
// Held real all-out damage. The owning return chain supplies a claimed entry.
import {MAKOTO_ID as ID,selectedMakotoInputs,makotoAllOutInputs} from './arkpedia-makoto-source.js';
import {absoluteRangeKeys,canTargetEnemy,sortEnemyTargets} from '../targeting.js';import {bodyInKeys} from '../body.js';
export const MAKOTO_ALLOUT_CONTRACT=Object.freeze({
 scope:'Selected original all-out group grants, source-clock one-participant pulse and live Makoto-ATK True damage only.',
 mapping:'An explicit owning-return predicate and unique object ticket authorize each native on-enter-normal broadcast once. Present visible deployed S.E.E.S. operator lives are captured; another Makoto UID is excluded by the original FilterId/UID guard. Each receiver independently admits an infinite nonderived original damage buff, snapshots selected talent operands, and polls once after original1.600000023841858 world seconds, unaffected by ASPD/slowdown/control. The selected source has one multi-attack count and final ratio1; no unrecovered general split algorithm is guessed. Each source keeps one pending damage buff per receiver: a later accepted broadcast replaces that own instance while a refused replacement preserves it. Each receiver samples live Makoto ATK/attack-scale once at its pulse, searches all legal ground/air enemies in its current nonextended selected talent x-1 range and emits one selected-coefficient True melee normal-type buff-damage instance per enemy. Makoto own participation retains source modifiers; other squad participation uses the original sourceless branch with Makoto credit. Overlapping participants stack independent hits. One attempted pulse finishes even without victims. Mode departure alone does not erase born nonderived grants; source retirement/owner-finish, receiver exit/replacement, dispel and battle end cancel owned pending grants.',
 limitations:'Native group broadcast and UID lookup, range-selector context centered on each receiver, return ticket/predicate, grant/claim/callback order, float32 boundary tolerance and invalid-source checks remain explicit local mappings. Single-count selected operands are required. No inferred multi-hit splitting, ordinary attack receipt, generic skill account, owner return/fatal/passive composition, original public art, native effects/audio/modules or compiled/frame/pixel/RNG parity is granted.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.deploySeq===life&&t.side==='ally';
const due=(a,z)=>a>=z-1e-7;
const origins=new WeakMap();
export function verifyMakotoAllOut(n=makotoAllOutInputs()){
 const {selectorAbility:a,selector:s,range:r,templates:ts}=n,start=ts.makoto_on_enter_normal.eventToActions.ON_BUFF_START[0]._succeedNodes[0],buff=start._buffData,
  actions=ts.makoto_allout_attack_damage.eventToActions,guard=actions.ON_BUFF_START,branch=actions.ON_BUFF_TRIGGER[0],self=branch._succeedNodes[0],other=branch._failNodes[0];
 if(start._groupId!=='sees'||start._isDerivedBuff!==false||buff.buffKey!=='makoto_allout_attack_damage'||buff.templateKey!=='makoto_allout_attack_damage'
  ||buff.lifeTimeType!=='INFINITY'||buff.triggerLifeType!=='INFINITY'||buff.triggerInterval!==1.600000023841858||buff.waitFirstTriggerInterval!==true
  ||buff.overrideType!=='DEFAULT'||buff.maxStackCnt!==1||buff.independentCharacterSource!==true
  ||buff.isSilenceable!==false||buff.isStunnable!==false||buff.isDamageMissable!==false||guard[0]._buffKey!=='makoto_talent_2'
  ||guard[4]._filterId!==ID||guard[5]._conditionNode._anotherKeyToCompare!=='owner_uid'||!guard[5]._failNodes[0].$type.includes('+FinishBuff,'))throw Error('Changed original Makoto all-out group/clock/UID inputs');
 for(const [node,sourceless]of[[self,false],[other,true]]){
  const d=node._damageConfig,o=d.targetOptions;
  if(!node.$type.includes('+SplitDamageByMultiAttack,')||node._atkScaleKey!=='atk_scale'||node._totalCntKey!=='multi_attack_total_cnt'||node._triggeredCntKey!=='triggered_cnt'
   ||node._finalDamageRatioKey!=='final_damage_different_ratio'||d.sourceType!=='BUFF_SOURCE'||d.damageType!=='PURE'||d.sourceApplyWay!=='MELEE'||d.attackType!=='NORMAL'
   ||d.isNoSourceDamage!==sourceless||d.ignoreForSp!==false||d.skipModifierEvent!==false||d.useAbilitySelector!==true||d.abilityName!=='PassiveT2Selector'
   ||o.targetSide!=='ENEMY'||o.targetMotion!=='ALL'||o.ignoreTargetFree!==false||o.purposeMask!=='DAMAGE')throw Error('Changed original Makoto all-out damage branch');
 }
 if(a._selector.m_PathID!=='7710524458763865637'||a._interruptAbilityOnDetach!==0||a._activeBuffs.length||a._animKey!==''
  ||s._targetSide!==2||s._targetMotion!==3||s._targetCategory!==1||s._postFilter!==4||s._limitTargetNum!==0||s._ignoreTargetFree!==0
  ||s._ignoreMotionMode!==0||s._ignoreHitRange!==0||r._useBlackboardRangeId!==1||r._extendable!==0)throw Error('Changed original Makoto all-out selector');
 const finish=ts.makoto_talent_2.eventToActions.ON_OWNER_FINISH[0];
 if(finish._buffKey!=='makoto_allout_attack_damage'||finish._checkBuffSource!==true||finish._sourceType!=='BUFF_OWNER')throw Error('Changed original Makoto all-out owner-finish cleanup');
}
export class MakotoAllOutCombat{
 constructor(b,u,{contract,mayBegin}={}){
  if(contract!==MAKOTO_ALLOUT_CONTRACT||typeof mayBegin!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto, exact all-out contract and explicit return predicate required');
  const record=selectedMakotoInputs(u),bb=record.talentBb[1];verifyMakotoAllOut();
  if(!bb||bb.multi_attack_total_cnt!==1||bb.final_damage_different_ratio!==1||!Number.isFinite(bb.atk_scale))throw Error('Unreviewed Makoto all-out split operands');
  const raw=makotoAllOutInputs().ranges[bb.range_id];if(!raw?.grids)throw Error('Missing selected Makoto all-out range');
  Object.assign(this,{b,u,record,bb,grid:raw.grids.map(p=>[p.row,p.col]),mayBegin,seq:null,stopped:false,busy:false,starting:false,
   tickets:new WeakSet(),grants:new Set(),handles:[],issuing:null});
 }
 valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&present(this.u)&&!this.u.hidden&&this.u.deploySeq===this.seq;}
 origin(p){const r=origins.get(p);return r?.manager===this?r:null;}
 matches(p,r=this.origin(p)){return !!r&&p.owner===r.owner&&p.life===r.life&&p.key===r.key&&p.sourceLife===r.sourceLife&&p.sourceLess===r.sourceLess
  &&p.nextAt===r.nextAt&&JSON.stringify(p.bb)===JSON.stringify(r.bb);}
 owns(p){const r=this.origin(p);return this.matches(p,r)&&p.buff===r.buff&&!!r.buff&&r.buff.key===r.key&&r.buff.source===this.u&&r.buff.data?.makotoAllout===p&&r.owner.buffs.includes(r.buff);}
 ownerLive(p){return retained(p.owner,p.life)&&this.b.allyUnits.includes(p.owner);}
 finish(p){const r=this.origin(p);if(!r||p.finished)return;p.finished=true;this.grants.delete(p);
  if(r.buff&&r.buff.key===r.key&&r.buff.source===this.u&&r.buff.data?.makotoAllout===p&&r.owner.buffs.includes(r.buff))this.b.removeBuff(r.owner,r.buff);}
 begin(ticket){if(this.starting||!ticket||typeof ticket!=='object'||this.tickets.has(ticket)||!this.valid())return false;this.starting=true;
  try{if(this.mayBegin(ticket)!==true||!this.valid()||this.tickets.has(ticket))return false;this.tickets.add(ticket);
   const owners=this.b.allyUnits.filter(t=>retained(t,t.deploySeq)&&t.kind==='op'&&t.tags.has('sees')&&(t.def.charId!==ID||t===this.u)).map(t=>({owner:t,life:t.deploySeq}));
   let accepted=false;for(const input of owners){if(!this.valid())break;this.issuing=input;if(this.attach(input))accepted=true;}return accepted;
  }finally{this.issuing=null;this.starting=false;}
 }
 attach(input){if(this.issuing!==input||!this.starting||!this.valid())return null;this.issuing=null;const{owner,life}=input;if(!retained(owner,life))return null;
  const p={owner,life,key:`makoto:allout:${this.u.id}:${this.seq}:${owner.id}`,sourceLife:this.seq,sourceLess:owner!==this.u,bb:{...this.bb},buff:null,
   nextAt:this.b.time+1.600000023841858,finished:false,admitted:false,claimed:false};
  const origin={manager:this,owner,life,key:p.key,sourceLife:p.sourceLife,sourceLess:p.sourceLess,bb:{...p.bb},nextAt:p.nextAt,buff:null};origins.set(p,origin);
  const permit=(_t,buff)=>this.valid()&&!p.finished&&!p.admitted&&!p.claimed&&this.matches(p,origin)&&retained(owner,life)&&buff.key===origin.key&&buff.source===this.u&&buff.data?.makotoAllout===p
   &&buff.data?.nativeKey==='makoto_allout_attack_damage'&&buff.duration===Infinity&&Object.keys(buff.mods??{}).length===0&&Object.keys(buff.flags??{}).length===0;
  p.buff=this.b.addBuff(owner,{key:p.key,source:this.u,duration:Infinity,data:{makotoAllout:p,nativeKey:'makoto_allout_attack_damage'},admit:permit,onRemove:()=>this.finish(p)});
  origin.buff=p.buff;
  if(!p.buff||!permit(owner,p.buff)||!this.owns(p)){this.finish(p);return null;}p.admitted=true;this.grants.add(p);
  // Shared replace swaps the actual buff without invoking the displaced
  // instance's callback. Retire only displaced records after new admission;
  // a refused replacement must leave its accepted predecessor intact.
  for(const old of [...this.grants])if(old!==p&&old.owner===owner&&old.key===p.key&&!this.owns(old))this.finish(old);
  return p;
 }
 targets(p){const keys=new Set(absoluteRangeKeys(this.grid,p.owner.tileR,p.owner.tileC,p.owner.dir));
  return sortEnemyTargets(this.b,p.owner,this.b.enemies.filter(t=>present(t)&&!t.hidden&&!t.s.flags.invulnerable
   &&canTargetEnemy(this.u,t,{canHitFly:true,groundOnly:false})&&bodyInKeys(t,keys)),'normal');}
 pulse(p){if(p.claimed||!p.admitted||p.finished||!this.valid()||p.sourceLife!==this.seq||!this.ownerLive(p)||!this.owns(p)||!due(this.b.time,p.nextAt))return false;
  p.claimed=true;
  try{const inputs=this.targets(p).map(target=>({target,life:target.deploySeq})),amount=this.u.s.atk*this.u.s.atkScaleMul*p.bb.atk_scale;
   for(const {target,life}of inputs){if(!this.valid()||p.finished||!this.ownerLive(p)||!this.owns(p))break;
    if(!present(target)||target.hidden||target.deploySeq!==life||target.side!=='enemy')continue;
    this.b.dealDamage(this.u,target,{amount,type:'true',isAttack:true,isSkill:false,isProjectile:false,applyWay:'melee',sourceless:p.sourceLess,
     tags:['makoto:allout']});
   }return true;
  }finally{this.finish(p);}
 }
 tick(){if(this.busy)return;this.busy=true;try{if(!this.valid()){this.stop();return;}
  for(const p of [...this.grants]){if(!this.ownerLive(p)||!this.owns(p))this.finish(p);else if(due(this.b.time,p.nextAt))this.pulse(p);}
 }finally{this.busy=false;}}
 install(){if(this.stopped||this.handles.length||this.u.mem.makotoAllout&&this.u.mem.makotoAllout!==this)throw Error('Makoto all-out cannot be reinstalled');
  this.u.mem.makotoAllout=this;const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null)this.tick();},{owner:u}),...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();else for(const p of [...this.grants])if(p.owner===unit)this.finish(p);},{owner:u})),
   b.on('battleEnd',()=>this.stop(),{owner:u})];}
 stop(){if(this.stopped)return;this.stopped=true;for(const p of [...this.grants])this.finish(p);for(const h of this.handles)this.b.off(h);this.handles=[];}
}
