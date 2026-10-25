// SPDX-License-Identifier: GPL-3.0-or-later
// Ordinary combat and firewall only; complete boss dispatch stays unregistered.
import contract from '../../../data/candidates/arkpedia-ch17-muama-combat-contract.json' with {type:'json'};
import {registerChapter17Firewall,crossedChapter17FirewallSides,chapter17FirewallBounds} from './chapter17.js';
import {canTargetAlly,sortAllyTargets} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {captureEnemySource} from './enemy-source-view.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),live=u=>u?.alive&&u.deployed&&!u.hidden;
const controlled=e=>['stun','freeze','sleep','levitate','fear','disarm'].some(k=>e.s.flags[k])||e.s.flags.tremble&&!!e.blockedBy;
export function installChapter17MuamaCombat(b,e){
 const proof=contract.enemies[e?.defId],r=e?.def?.raw;
 if(!proof||r?.key!==e.defId||r.prefabKey!==e.defId||!same(r.talents,proof.record.talents)||!same(r.skills,proof.record.skills)||!same(r.abilities,proof.record.abilities))
  throw Error('Unreviewed Muama/twin combat contract');
 if(b.finished||!live(e)||!Number.isFinite(e.deployedAt)||Math.abs(e.deployedAt-b.time)>1e-9)throw Error('Muama combat must attach to a fresh live deployment');
 const life=e.deploySeq,old=e.mem.ch17MuamaCombat;
 const inheritedNoAttack=old?.profile===e.profile&&e.profile.noAttack===true?old.originalNoAttack:e.profile.noAttack;
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one Muama combat controller');if(old?.active)old.stop();
 const d=proof.defaults,handles=[],profile=e.profile,oldNoAttack=inheritedNoAttack;
 const state={active:true,ownerLife:life,profile,originalNoAttack:oldNoAttack,suspended:false,pending:null,cooldown:0,buffs:[],wall:null,ramp:null,count:0,lastTarget:null,lastTargetLife:null,
  valid:()=>state.active&&!b.finished&&live(e)&&e.deploySeq===life,
  interrupt(){state.pending=null;},
  stop(){
   if(!state.active)return;const ownsSlot=e.mem.ch17MuamaCombat===state;state.active=false;state.interrupt();state.wall?.retire();
   if(b._takenMultipliers?.get(state)===state.multiplier)b._takenMultipliers.delete(state);
   for(const buff of state.buffs)b.removeBuff(e,buff);b.removeBuff(e,state.ramp);
   for(const h of handles)b.off(h);if(ownsSlot)delete e.mem.ch17MuamaCombat;
   if(ownsSlot&&e.deploySeq===life&&e.profile===profile)profile.noAttack=oldNoAttack;
  },
  choices(){
   const list=b.alliesInRadius(e.x,e.y,e.base.rangeRadius+ALLY_COLLIDER_RADIUS).filter(t=>canTargetAlly(e,t,true));
   if(live(e.blockedBy)&&!list.includes(e.blockedBy))list.push(e.blockedBy);
   return sortAllyTargets(e,list);
  },
  begin(){
   if(!state.valid()||state.suspended||state.pending||state.cooldown>1e-9||controlled(e))return false;
   const target=state.choices()[0];if(!target)return false;
   const epoch=e.attackControlEpoch,ctx={attacker:e,targets:[target],isSkill:false,profile};b.emit('beforeAttack',ctx);
   const selected=ctx.targets?.find(t=>state.choices().includes(t));
   if(!state.valid()||controlled(e)||e.attackControlEpoch!==epoch||!selected)return false;
   const rate=e.s.interval>0?Math.min(1,e.base.bat/e.s.interval):1;
   state.pending={target:selected,targetLife:selected.deploySeq,epoch,age:0,lastAt:b.time,rate,released:false};
   state.cooldown=Math.max(e.s.interval,d.duration/rate);return true;
  },
  release(q){
   if(!state.valid()||state.pending!==q||controlled(e)||q.epoch!==e.attackControlEpoch||!live(q.target)||q.target.deploySeq!==q.targetLife
    ||q.target!==e.blockedBy&&!canTargetAlly(e,q.target,true))return;
   const count=state.lastTarget===q.target&&state.lastTargetLife===q.targetLife?Math.min(d.maxStacks,state.count+1):1;
   const buff=b.addBuff(e,{key:proof.stack._stackBuff.buffKey,source:e,persist:true,mods:{atkFlat:count*d.increment}});
   if(!buff||!state.valid()||state.pending!==q||controlled(e)||q.epoch!==e.attackControlEpoch||!live(q.target)||q.target.deploySeq!==q.targetLife){b.removeBuff(e,buff);return;}
   state.ramp=buff;state.count=count;state.lastTarget=q.target;state.lastTargetLife=q.targetLife;
   const view=captureEnemySource(e),target=q.target,targetLife=q.targetLife,attackId=++b._attackSeq;
   e.stats.attacks++;e.lastAttackAt=b.time;
   b.addProjectile({from:e,target,speed:d.speed,maxAge:d.maxAge,visual:'none',source:view,
    data:{muamaOwnerId:e.id,muamaOwnerLife:life,nativeProjectile:proof.attack._projectileKey},onHit(ctx){
     if(b.finished||ctx.target!==target||!live(target)||target.deploySeq!==targetLife)return;
     const source=state.valid()?e:view;
     b.dealDamage(source,target,{amount:source.s.atk,type:d.type,isAttack:true,isSkill:false,attackId,applyWay:'ranged',canDodge:true,tags:['chapter17','muama-ordinary']});
    }});
   b._ev(['atk',e.id,target.id,'none']);b.emit('attack',{attacker:e,targets:[target],isSkill:false});
   b.emit('ch17MuamaOrdinaryReleased',{source:e,sourceLife:life,target,targetLife,count,attackId});
  },
  blocksDeployment(row,col){
   if(!state.valid()||!state.wall.current()||state.buffs.some(buff=>!e.buffs.includes(buff))){state.stop();return false;}
   const r=chapter17FirewallBounds(state.wall),dr=row-(r.y0+r.y1)/2,dc=col-(r.x0+r.x1)/2;
   if(Math.abs(dr)>1+1e-9||Math.abs(dc)>1+1e-9)return false;
   const touching=[];if(dr<-.5)touching.push(0);if(dc>.5)touching.push(1);if(dr>.5)touching.push(2);if(dc<-.5)touching.push(3);
   return !touching.some(side=>state.wall.sides[side].broken);
  },
  multiplier(source,target,dmg){
   if(!state.valid()||!state.wall.current()||state.buffs.some(buff=>!e.buffs.includes(buff))){state.stop();return 1;}
   return target===e&&['phys','arts'].includes(dmg.type)&&crossedChapter17FirewallSides(state.wall,source,e).length?1-d.resistance:1;
  },
 };
 e.mem.ch17MuamaCombat=state;profile.noAttack=true;
 try{
  state.wall=registerChapter17Firewall(b,e,{width:3,height:3,duration:proof.config.vulnerabilityButtonDuration,
   clicks:proof.config.vulnerabilityRequiredClickCount,onRetire:()=>state.stop()});state.wall.blocksDeployment=state.blocksDeployment;
  for(const spec of proof.passive){
   const buff=b.addBuff(e,{key:spec.buffKey,source:e,persist:true,flags:spec.attributes.abnormalFlags.includes(22)?{noMove:true}:null,onRemove:()=>state.stop()});
   if(!buff||!state.valid()){b.removeBuff(e,buff);throw Error('Muama passive admission failed');}state.buffs.push(buff);
  }
  b._takenMultipliers??=new Map();b._takenMultipliers.set(state,state.multiplier);
  handles.push(b.on('tick',({dt})=>{
   if(!state.valid()||!state.wall.current()||state.buffs.some(buff=>!e.buffs.includes(buff))){state.stop();return;}
   if(state.suspended){state.interrupt();return;}
   if(!e.s.flags.stun)state.cooldown=Math.max(0,state.cooldown-dt);
   const q=state.pending;
   if(q){
    if(controlled(e)||q.epoch!==e.attackControlEpoch){state.interrupt();return;}
    q.age+=sourceAbilityDelta(e,Math.max(0,b.time-q.lastAt),true)*q.rate;q.lastAt=b.time;
    if(!q.released&&q.age+1e-7>=d.hit){q.released=true;state.release(q);if(!state.valid()||state.pending!==q)return;}
    if(q.age+1e-7>=d.duration)state.interrupt();
   }else state.begin();
  },{owner:state}),b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),
  b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}));
  return state;
 }catch(error){state.stop();throw error;}
}
