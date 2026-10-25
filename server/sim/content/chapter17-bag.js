// SPDX-License-Identifier: GPL-3.0-or-later
// Exact-record experimental controller; original compiled dispatch is not claimed.
import review from '../../../data/candidates/arkpedia-ch17-reviewed-bag.json' with {type:'json'};
import {leakSourceTrace} from './chapter17-trace.js';
import {areaSelectable} from '../targeting.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const live=e=>e?.alive&&e.deployed&&!e.hidden;
const controlled=e=>['stun','freeze','sleep','levitate','fear'].some(k=>e.s.flags[k]);
const PARENT='enemy_mubag_kill_murad',FLAG=PARENT+'[flag]',FEED='enemy_mubag_atk_up',STACK=FEED+'[atk]';
const d=review.defaults;
export function pollutionBag(r){
 const proof=review.enemies[r.key];
 if(!proof||r.prefabKey!==r.key||!same(r.talents.groups,proof.groups)||!same(r.talents.bb,proof.bb)
   ||!same(r.skills,proof.skills)||!same(r.abilities,proof.abilities))throw Error('Unreviewed pollution Bag contract');
 const skill=r.skills[0],bb=r.talents.bb;
 return{
  spawn(b,e,a){
   const life=e.deploySeq,valid=()=>a.active&&e.alive&&e.deployed&&e.deploySeq===life;
   a.active=true;a.valid=valid;a.contacts=new Map();a.phase=null;a.flag=null;a.cooldown=skill.initCooldown;a.lastAt=b.time;
   e.profile.noAttack=true;
   const source=t=>live(t)&&t.defId==='enemy_10211_murad';
   const inContact=t=>source(t)&&Math.hypot(t.x-e.x,t.y-e.y)<=d.contactRadius+1e-8;
   a.trace=leakSourceTrace(b,e,{radius:d.contactRadius,searchPeriod:d.searchPeriod,defaultSearchPeriod:d.defaultSearchPeriod});
   a.trace.refresh(true);
   a.release=c=>{
    if(!c.active)return;c.active=false;
    if(a.contacts.get(c.target)===c)a.contacts.delete(c.target);
    b.removeBuff(c.target,c.parent);
    // A retired older parent cannot erase a later parent's replacement flag.
    b.removeBuff(e,c.flag);if(a.flag===c.flag)a.flag=null;
   };
   a.syncContacts=()=>{
    for(const c of [...a.contacts.values()])if(!valid()||e.hidden||!inContact(c.target)
      ||c.target.deploySeq!==c.targetLife||!c.target.buffs.includes(c.parent))a.release(c);
    if(!valid()||e.hidden)return;
    for(const t of b.enemies.filter(inContact).sort((a,z)=>a.spawnSeq-z.spawnSeq)){
     if(a.contacts.has(t))continue;
     const c={active:true,target:t,targetLife:t.deploySeq,parent:null,flag:null};a.contacts.set(t,c);
     c.parent=b.addBuff(t,{key:PARENT,source:e,persist:true,refresh:'independent',maxStacks:2147483647,
      data:{bagSourceLife:life,targetLife:c.targetLife},onRemove:()=>a.release(c)});
     if(!c.parent||!c.active||!valid()||!inContact(t)||t.deploySeq!==c.targetLife){b.removeBuff(t,c.parent);a.release(c);continue;}
     if(a.flag)b.removeBuff(e,a.flag);
     c.flag=b.addBuff(e,{key:FLAG,source:t,persist:true,data:{bagSourceLife:life,targetLife:c.targetLife}});
     a.flag=c.flag;
     if(c.flag&&(!c.active||!valid()||!inContact(t)||t.deploySeq!==c.targetLife)){
      b.removeBuff(e,c.flag);if(a.flag===c.flag)a.flag=null;a.release(c);
     }
    }
   };
   a.currentContact=()=>{
    const flag=e.findBuff(FLAG);if(!flag)return null;
    const c=[...a.contacts.values()].find(c=>c.flag===flag);
    return flag===a.flag&&c?.active&&flag===c.flag&&a.contacts.get(c.target)===c&&source(c.target)
     &&c.target.deploySeq===c.targetLife&&c.target.buffs.includes(c.parent)?c:null;
   };
   a.phaseValid=p=>valid()&&!e.hidden&&a.phase===p&&!controlled(e)&&p.epoch===e.actionControlEpoch;
   a.finish=p=>{
    if(a.phase!==p)return;a.phase=null;b.removeBuff(e,p.feed);b.removeBuff(e,p.hold);
    b.emit('ch17BagFeedingEnd',{source:e,elapsed:b.time-p.startedAt});
   };
   a.begin=()=>{
    if(!valid()||e.hidden||a.phase||a.cooldown>1e-9||controlled(e)||e.s.flags.silence||!a.currentContact())return false;
    const p={startedAt:b.time,epoch:e.actionControlEpoch,feed:null,hold:null};a.phase=p;
    p.hold=b.addBuff(e,{key:'ch17:bag-feeding',source:e,persist:true,flags:{noMove:true}});
    if(!p.hold||!a.phaseValid(p)){b.removeBuff(e,p.hold);a.finish(p);return false;}
    p.feed=b.addBuff(e,{key:FEED,source:e,duration:d.feedingDuration,interval:d.feedingInterval,
     onTick:()=>{
      if(!a.phaseValid(p)){a.finish(p);return;}
      a.syncContacts();if(!a.currentContact()){a.finish(p);return;}
      const buff=b.addBuff(e,{key:STACK,source:e,persist:true,refresh:'stack',maxStacks:skill.bb.max_stack_cnt,mods:{atkPct:skill.bb.atk}});
      b.emit('ch17BagStack',{source:e,stacks:buff?.stacks??0});
     },
     onExpire:()=>{
      if(!a.phaseValid(p)){a.finish(p);return;}
      a.syncContacts();const c=a.currentContact();
      if(c&&a.phaseValid(p)){
       const target=c.target;
       // Follow the current derived flag to its own still-live parent. Do not
       // reselect a nearby source or run this callback after early removal.
       b.kill(target,e);a.release(c);b.emit('ch17BagConsumed',{source:e,target});
      }
     }});
    if(!p.feed||!a.phaseValid(p)){b.removeBuff(e,p.feed);a.finish(p);return false;}
    a.cooldown=skill.cooldown;b.emit('ch17BagFeedingStart',{source:e,target:a.currentContact()?.target});return true;
   };
   a.detach=()=>{
    if(!a.active)return;a.active=false;if(a.phase)a.finish(a.phase);
    for(const c of [...a.contacts.values()])a.release(c);a.trace.stop();b.removeBuff(e,a.aura);
   };
   b.on('death',({unit})=>{if(unit===e)a.detach();else a.syncContacts();},{owner:e});
   b.on('removed',({unit})=>{if(unit===e)a.detach();else a.syncContacts();},{owner:e});
   b.on('battleEnd',a.detach,{owner:e});
   a.aura=b.addBuff(e,{key:'enemy_mubag_aoe_damage',source:e,persist:true,interval:bb['AoeDamage.interval'],onTick:()=>{
    if(!valid()||e.hidden)return;
    const targets=[...b.allyUnits,...b.enemies.filter(t=>t.profile?.neutral)].filter(t=>live(t)&&areaSelectable(e,t)
     &&Math.hypot(t.x-e.x,t.y-e.y)<=bb['AoeDamage.range_radius']+(t.profile?.neutral?(t.mem.ch16BodyRadius??.1):.25)+1e-8);
    for(const t of new Set(targets)){
     if(!valid()||e.hidden)break;
     b.dealDamage(e,t,{amount:e.s.atk*bb['AoeDamage.atk_scale'],type:'arts',isAttack:false,canDodge:false,applyWay:'none',tags:['chapter17','bag-aura']});
    }
   }});
   if(!valid())b.removeBuff(e,a.aura);
  },
  tick(b,e,a){
   if(!a.active)return;
   if(!a.valid()){a.detach();return;}
   const dt=Math.max(0,b.time-a.lastAt);a.lastAt=b.time;a.cooldown=Math.max(0,a.cooldown-dt);
   a.syncContacts();a.trace.refresh();
   if(a.phase){const p=a.phase;if(!a.phaseValid(p)||b.time-p.startedAt>=skill.bb.anim_duration-1e-8)a.finish(p);}
   else a.begin();
  },
  death(c,b,e,a){a.detach();},
 };
}
