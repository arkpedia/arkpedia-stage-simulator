// SPDX-License-Identifier: GPL-3.0-or-later
// Held original immediate-position, delayed-stop area payload.
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs} from './arkpedia-aegis-source.js';
import {canTargetEnemy} from '../targeting.js';
export const AEGIS_S1_TRANSPORT_CONTRACT=Object.freeze({
 scope:'Selected original Aegis S1 uncached Physical projectile, immediate captured-position reach, delayed stop and mixed-motion radius1.100000023841858 splash; no account/animation/public admission.',
 mapping:'The original immediate-reach/non-follow mover maps to a fixed input position at projectile birth. Its delayAfterReached and .20000000298023224 delay map to an attached fixed-time stop, unaffected by distance, ASPD or projectile speed auras. The area checker runs only at stop. One accepted impact snapshots recipient lives in the original radius and issues one Physical skill packet per still-legal life; it does not force an out-of-radius primary back into the explosion. Current same-life source ATK, attack scale, typed modifiers and penetration are read per damage action. A departed/replaced source uses the launch attribute view and original ledger, irreversibly for that born payload. Native managedBySource0/stopWhenSourceInvalid0 lets born payload survive source departure; battle end/interception drains it.',
 limitations:'Native immediateReach/reached-delay/stop event aliases, point/midpoint collision and uncached post-retirement source lookup are explicit local mappings. Native ten-second lifetime remains a source upper bound, not a fabricated ten-second homing impact. Retired source attributes use the documented launch view because compiled invalid-source lookup is not recovered. No native particles/audio/shaders, modules, compiled/frame/pixel or public gameplay claim.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export function verifyAegisS1Transport(n=aegisNativeInputs()){
 const a=n.modes[2].attack,ps=n.projectiles.projectile_chr_aigis_s1.flatMap(r=>r.components),d=ps.map(p=>p.data),
  body=d.find(p=>p._lifeTime!=null),move=d.find(p=>p._immediatelyReach!=null),area=d.find(p=>p._onlyCheckHitWhenStop!=null),collider=ps.find(p=>p.type==='CircleCollider2D')?.data;
 if(a._projectileKey!=='projectile_chr_aigis_s1'||a._useCachedAtkOnly!==0||a._transferSource!==0||a._damageType!==1||a._activeBuffs.length!==0
  ||a._emitToInputPosWhenTargetIsInvalid!==1||a._alwaysIncludeTarget!==1
  ||body._hitNumType!==2||body._maxHitNum!==1||body._lifeTime!==10||body._managedBySource!==0||body._stopWhenSourceInvalid!==0
  ||body._alwaysHitTraceTargetInTheEnd!==0||body._alwaysHitTraceTargetWhenReached!==0||body._canHitSameTargetMultipleTimes!==0
  ||move._immediatelyReach!==1||move._delayAfterReached!==1||move._delayTime!==.20000000298023224||move._extraDelayTime!==0||move._delayToStart!==0
  ||move._followTarget!==0||move._keepUpdate!==0||move._stopIfTargetDead!==0||move._stopIfTargetDisappeared!==0
  ||area._onlyCheckHitWhenReachTarget!==0||area._onlyCheckHitWhenStop!==1||area._onlyTraceTarget!==0||area._goThroughWall!==1||area._ignoreCamouflage!==1
  ||area._targetOptions.targetMotion!==3||area._targetOptions.targetSide!==2||area._targetOptions.ignoreTargetFree!==0
  ||collider?.m_Radius!==1.100000023841858||collider.m_IsTrigger!==true)throw Error('Changed original Aegis S1 transport inputs');
 return{delay:move._delayTime,radius:collider.m_Radius,lifeTime:body._lifeTime};
}
function captureSource(u){const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
 profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
 Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;}
export class AegisSkillOneTransport{
 constructor(b,u,{contract}={}){
  if(contract!==AEGIS_S1_TRANSPORT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||selectedAegisInputs(u).index!==0)
   throw Error('Fresh selected Aegis S1 and exact transport contract required');
  Object.assign(this,{b,u,sourceInputs:verifyAegisS1Transport(),seq:null,flights:new Map(),watchers:[],retired:false,ended:false});
 }
 bind(){if(this.seq!==null||!present(this.u)||this.retired||this.ended)throw Error('Aegis S1 transport binds one living deployment');this.seq=this.u.deploySeq;}
 source(p){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;return !this.retired&&!p.retired?this.u:p.snapshot;}
 launch({target,life=target?.deploySeq,x=target?.x,y=target?.y,attackId=null}={}){
  if(this.ended||this.retired||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq
   ||!target||target.side!=='enemy'||!Number.isInteger(life)||![x,y].every(Number.isFinite))return false;
  const p={target,life,sourceLife:this.seq,snapshot:captureSource(this.u),attackId,retired:false,claimed:false};let projectile;
  projectile=this.b.addProjectile({from:{x,y},to:{x,y},source:this.u,flightTime:this.sourceInputs.delay,attached:true,maxAge:this.sourceInputs.lifeTime,visual:'none',
   data:{arkpediaTrackedVisual:true,projectileKey:'projectile_chr_aigis_s1',aegisS1:true},onHit:({x:atX,y:atY})=>{
    if(p.claimed)return;p.claimed=true;this.flights.delete(projectile);
    if(!this.ended&&!this.b.finished)this.explode(p,atX,atY);this.unwatch();}});
  this.flights.set(projectile,p);this.watch();return true;
 }
 explode(p,x,y){if(![x,y].every(Number.isFinite))return;
  const source=this.source(p),victims=this.b.enemiesInRadius(x,y,this.sourceInputs.radius,true)
   .filter(t=>present(t)&&canTargetEnemy(source,t,{canHitFly:true,groundOnly:false})).map(t=>({target:t,life:t.deploySeq}));
  for(const{target:t,life}of victims){if(this.ended||this.b.finished)break;const u=this.source(p);
   if(!present(t)||t.deploySeq!==life||!canTargetEnemy(u,t,{canHitFly:true,groundOnly:false}))continue;
   this.b.dealDamage(u,t,{amount:u.s.atk*u.s.atkScaleMul,type:'phys',isAttack:true,isSkill:true,isProjectile:true,
    isSplash:t!==p.target||life!==p.life,applyWay:'ranged',attackId:p.attackId,tags:['aegis:s1']});
  }
 }
 watch(){if(this.watchers.length||!this.flights.size)return;this.watchers=[this.b.on('tick',()=>{
  for(const[projectile,p]of this.flights){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;
   if(!this.b.projectiles.list.includes(projectile)&&!this.b.projectiles.arriving.includes(projectile))this.flights.delete(projectile);}this.unwatch();}),
  this.b.on('removed',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('death',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 retire(){this.retired=true;for(const p of this.flights.values())p.retired=true;}
 drain(){this.ended=true;this.retire();this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.unwatch();}
}
