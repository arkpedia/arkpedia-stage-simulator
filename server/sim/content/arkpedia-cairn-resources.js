// SPDX-License-Identifier: GPL-3.0-or-later
// Held resource layer; the caller must supply independently reviewed cast clocks.
import {CAIRN_ID as ID,selectedCairnBuild,cairnNativeInputs} from './arkpedia-cairn-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
export const CAIRN_RESOURCE_CONTRACT=Object.freeze({
 scope:'Selected maximum-HP S1, capped S2 shield, snapshotted recipient DOT and blocked-enemy neural injury; no attack/cast/public admission',
 mapping:'The caller explicitly begins/ends S1 and releases S2. Shared maximum-HP modifiers retain HP ratio. Shield refresh adds current-max-HP value, caps it and keeps the greater remaining lifetime. The ten-second table duration admits ten delayed one-second DOT ticks including the expiry tick; native raw triggerCnt4/lifeTime4/triggerLifeType2 remain preserved rather than interpreted as a four-tick cap. Default recipient override replaces the single shared skill DOT and snapshots ATK again. Talent attachment samples current block membership, checks invincibility once, then uses current source ATK at each delayed one-second pulse. Unblock/reblock starts a fresh clock.',
 limits:'Compiled lifetime/counter/override dispatch, shield priority, cast-to-shield callback phase, simultaneous block changes and original event ordering remain unverified. The resource-only API is diagnostic: no original attack clocks, ready skills or public gameplay are enabled. DOT Arts uses the retained source object after removal; neural injury becomes source-free when the original deployment is absent. Default body/selector eligibility must be supplied by a future controller. Modules, native particles/shaders/audio and frame/pixel parity are unsupported.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const live=u=>present(u)&&!u.hidden;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function prepareCairnResources(b,u,{contract}={}){
 if(contract!==CAIRN_RESOURCE_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.cairnResources)
  throw Error('Fresh selected Cairn and explicit held resource contract required');
 const r=selectedCairnBuild({...u.def.raw.arkpedia,skillId:u.def.skill?.id}),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType
  ||s.spType!==normSpType(r.source.spData.spType)||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp
  ||s.duration!==r.source.duration||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))
  throw Error('Incomplete Cairn selected resource inputs');
 const n=cairnNativeInputs(),t=n.templates,d=t['cairn_s_2[damage]'].eventToActions;
 if(n.talent._buffsToBlockee[0].templateKey!=='cairn_t_1[check_target]'||d.ON_BUFF_START[0]._attributeType!=='ATK'
  ||d.ON_BUFF_TRIGGER[0]._getCachedAtkFromBlackboard!==true||d.ON_BUFF_TRIGGER[0]._cachedAtkKey!=='atk'
  ||d.ON_BUFF_TRIGGER[2]._failNodes[0]._noSource!==true||n.s2Attack._activeBuffs[0].durationKey!=='buff_duration'
  ||n.s2Attack._activeBuffs[0].triggerInterval!==1||n.s2Attack._activeBuffs[0].firstTriggerInterval!==1
  ||t['cairn_s_2[create_shield]'].eventToActions.ON_BUFF_START[0]._succeedNodes[3]._maxValueKey!=='shield_max')
  throw Error('Unreviewed Cairn native resource hierarchy');
 const resources=new CairnResources(b,u,r);u.mem.cairnResources=resources;return resources;
}
export class CairnResources{
 constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.handles=[];this.blocked=new Map();
  this.hpKey=`cairn:s1:hp:${u.id}`;this.shieldKey='cairn:s2:shield';this.dotKey='cairn_s_2[damage]';this.talentKey=`cairn:talent:${u.id}`;}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 beginHp(){if(!this.valid()||this.record.index!==0)return false;
  const buff=this.b.addBuff(this.u,{key:this.hpKey,source:this.u,mods:{hpPct:this.record.bb.max_hp}});
  if(!this.valid()){if(buff)this.b.removeBuff(this.u,buff);return false;}void this.u.s;return !!buff;}
 endHp(){this.b.removeBuff(this.u,this.hpKey);void this.u.s;}
 grantShield(){if(!this.valid()||this.record.index!==1)return false;
  const{b,u,record:r}=this,old=u.findBuff(this.shieldKey),max=u.s.maxHp;
  const shield=Math.min(max*r.bb.shield_max_hp_ratio,(old?.shield??0)+max*r.bb.shield_hp_ratio);
  const buff=b.addBuff(u,{key:this.shieldKey,source:u,shield,duration:r.bb.buff_duration,refresh:'extend',visible:true});
  if(!this.valid()){if(buff)b.removeBuff(u,buff);return false;}
  // The shared extend policy keeps a larger old shield. The native cap also
  // applies when maximum HP has fallen, so explicitly reduce it after extension.
  if(buff){buff.shield=shield;u.markDirty();}return !!buff;
 }
 attachDot(target){if(!this.valid()||this.record.index!==1||!live(target)||target.side!=='enemy')return null;
  const{b,u,record:r}=this,seq=this.seq,atk=u.s.atk,life=target.deploySeq;
  const buff=b.addBuff(target,{key:this.dotKey,source:u,duration:r.bb.buff_duration,interval:1,
   data:{cairnSnapshotAtk:atk},onTick:({buff})=>{
    if(b.finished||!live(target)||target.deploySeq!==life||target.findBuff(this.dotKey)!==buff)return;
    const info={isAttack:false,isSkill:true,applyWay:'all',tags:['cairn:s2-dot']};
    b.dealDamage(u,target,{...info,amount:atk*r.bb.atk_scale,type:'arts',canDodge:true});
    // AlwaysNext in the original graph keeps neural injury independent of an
    // absorbed, dodged or cancelled Arts output. Dead recipients still reject it.
    b.dealDamage(present(u)&&u.deploySeq===seq?u:null,target,{...info,amount:atk*r.bb.ep_damage_ratio,
     type:'element',element:'neural',canDodge:false,tags:['cairn:s2-injury']});
   }});
  if(!this.valid()||!live(target)||target.deploySeq!==life){if(buff)b.removeBuff(target,buff);return null;}
  return buff;
 }
 clearBlocked(target){const p=this.blocked.get(target);if(!p)return;this.blocked.delete(target);this.b.removeBuff(target,p.key);}
 tick(){if(!this.valid())return;
  const{b,u,record:r}=this,ratio=r.talentBb[0]?.ep_damage_ratio;
  const current=new Set(ratio&&!u.hidden?b.enemies.filter(e=>live(e)&&e.blockedBy===u):[]);
  for(const target of this.blocked.keys())if(!current.has(target))this.clearBlocked(target);
  for(const target of current){let p=this.blocked.get(target);
   if(!p){p={key:this.talentKey,life:target.deploySeq,next:b.time+1,child:!target.s.flags.invulnerable};this.blocked.set(target,p);
    if(p.child){const buff=b.addBuff(target,{key:p.key,source:u});
     if(!this.valid()||!live(target)||target.blockedBy!==u||target.deploySeq!==p.life){if(buff)b.removeBuff(target,buff);this.blocked.delete(target);continue;}
     p.buff=buff;p.child=!!buff;}
   }
   if(target.deploySeq!==p.life){this.clearBlocked(target);continue;}
   if(!p.child||target.findBuff(p.key)!==p.buff)continue;
   while(b.time+1e-7>=p.next){p.next+=1;
    if(!this.valid()||!live(target)||target.blockedBy!==u||target.findBuff(p.key)!==p.buff)break;
    b.dealDamage(u,target,{amount:u.s.atk*ratio,type:'element',element:'neural',isAttack:false,isSkill:false,
     applyWay:'none',canDodge:false,tags:['cairn:talent-injury']});
   }
  }
 }
 install(){if(this.handles.length||this.stopped)throw Error('Cairn resources cannot be reinstalled');
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit===this.u&&!move)this.seq=unit.deploySeq;},{owner:this.u}),
   this.b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),
   this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();},{owner:this.u}),this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  for(const target of this.blocked.keys())this.clearBlocked(target);this.endHp();this.b.removeBuff(this.u,this.shieldKey);
  // Recipient-owned nonderived DOTs deliberately survive source removal.
 }
}
