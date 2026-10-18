// SPDX-License-Identifier: GPL-3.0-or-later
// Original S1 finite bomb payload only; account/animation controller composes it.
import {SKYBOX_ID as ID,selectedSkyboxInputs,skyboxNativeInputs} from './arkpedia-skybox-source.js';
import {canTargetEnemy} from '../targeting.js';
export const SKYBOX_S1_TRANSPORT_CONTRACT=Object.freeze({
 scope:'Selected original S1 cached-ATK Physical bomb, finite speed-eight transport, retained-input position fallback and radius-two explosion; no account or public registration.',
 mapping:'Original hitNumType2/maxHitNum1 maps to one explosion, not one victim. One accepted launch caches ATK/attack-scale and the selected atk_scale. Its current matching source life supplies outgoing modifiers and penetration at each arrival action; a retired/replaced source uses its launch view and old ledger. The original retained primary is included once if still alive in the same life, even after ordinary selection changes; other victims use normal ground/air splash selectability and midpoint radius2. Dead/replaced/hidden input falls back to the last retained position, without redirecting its identity to a new life. Explosion recipients/lives are captured before callbacks, one-shot arrival is claimed before damage, and each recipient life is rechecked. Born transport survives source departure and ends at the original ten-second boundary.',
 limitations:'Native parabolic geometry, delayTime alias, collider/midpoint interpretation, cached-attribute timing, retained-target inclusion and post-retirement dispatch remain explicit local mappings. The mover maps to two-dimensional homing at the original speed; native0.30000001192092896 raise and1.2999999523162842 no-raise threshold remain retained source facts. No compiled/game-frame/pixel, native effects/audio, module or public delivery claim.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.deploySeq===life&&t.side==='enemy';
export function verifySkyboxS1Transport(n=skyboxNativeInputs()){
 const a=n.s1Attack,ps=n.projectiles.projectile_chr_skybx_s1.flatMap(r=>r.components),ds=ps.map(p=>p.data),
  body=ds.find(p=>p._lifeTime!=null),move=ds.find(p=>p._speed!=null),area=ds.find(p=>p._onlyCheckHitWhenReachTarget!=null),
  collider=ps.find(p=>p.type==='CircleCollider2D')?.data;
 if(a._projectileKey!=='projectile_chr_skybx_s1'||a._useCachedAtkOnly!==1||a._transferSource!==1||a._damageType!==1
  ||a._alwaysIncludeTarget!==1||a._emitToInputPosWhenTargetIsInvalid!==1||a._activeBuffs.length!==0
  ||body._hitNumType!==2||body._maxHitNum!==1||body._lifeTime!==10||body._managedBySource!==0||body._stopWhenSourceInvalid!==0
  ||body._alwaysHitTraceTargetInTheEnd!==1||body._fixDealHitTargetLeft!==1||body._canHitSameTargetMultipleTimes!==0
  ||move._speed!==8||move._raiseHeight!==0.30000001192092896||move._noRaiseHeightThreshold!==1.2999999523162842||move._delayTime!==1
  ||area._onlyCheckHitWhenReachTarget!==1||area._goThroughWall!==1||area._onlyTraceTarget!==0||area._ignoreCamouflage!==1
  ||area._targetOptions.targetMotion!==3||area._targetOptions.targetSide!==2||area._targetOptions.ignoreTargetFree!==0
  ||collider?.m_Radius!==2||collider.m_IsTrigger!==true)throw Error('Changed original Skybox S1 transport inputs');
}
function captureSource(u){const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
 profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
 Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;}
export class SkyboxSkillOneTransport{
 constructor(b,u,{contract}={}){
  if(contract!==SKYBOX_S1_TRANSPORT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||selectedSkyboxInputs(u).index!==0)
   throw Error('Fresh selected Skybox S1 and exact transport contract required');
  verifySkyboxS1Transport();this.b=b;this.u=u;this.record=selectedSkyboxInputs(u);this.seq=null;
  this.flights=new Map();this.watchers=[];this.retired=false;this.ended=false;
 }
 bind(){if(this.seq!==null||!present(this.u))throw Error('S1 transport binds one living deployment');this.seq=this.u.deploySeq;}
 source(p){return !this.retired&&!p.retired&&present(this.u)&&this.u.deploySeq===p.sourceLife?this.u:p.snapshot;}
 launch({target,life=target?.deploySeq,x=target?.x,y=target?.y,attackId=null}={}){
  if(this.ended||this.retired||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq
   ||!target||target.side!=='enemy'||!Number.isInteger(life)||![x,y].every(Number.isFinite))return false;
  const valid=retained(target,life),p={target,life,sourceLife:this.seq,snapshot:captureSource(this.u),
   atk:this.u.s.atk*this.u.s.atkScaleMul,scale:this.record.bb.atk_scale,attackId,retired:false,claimed:false};
  let projectile;projectile=this.b.addProjectile({from:this.u,target:valid?target:null,to:valid?undefined:{x,y},source:this.u,
   hitDead:true,speed:8,maxAge:10,visual:'shell',data:{arkpediaTrackedVisual:true,projectileKey:'projectile_chr_skybx_s1',skyboxS1:true},
   onHit:({x:atX,y:atY})=>{if(p.claimed)return;p.claimed=true;this.flights.delete(projectile);
    if(!this.ended&&!this.b.finished)this.explode(p,atX,atY);this.unwatch();}});
  this.flights.set(projectile,p);this.watch();return true;
 }
 explode(p,x,y){if(![x,y].every(Number.isFinite))return;const u=this.source(p),primary=retained(p.target,p.life)?p.target:null;
  const ts=this.b.enemiesInRadius(x,y,2,true).filter(t=>canTargetEnemy(u,t,{canHitFly:true,groundOnly:false}));
  if(primary&&!ts.includes(primary))ts.unshift(primary);
  const victims=ts.map(t=>({target:t,life:t.deploySeq}));
  for(const{target:t,life}of victims){if(this.ended||this.b.finished)break;if(!retained(t,life))continue;
   const source=this.source(p);this.b.dealDamage(source,t,{amount:p.atk*p.scale,type:'phys',isAttack:true,isSkill:true,isProjectile:true,
    isSplash:t!==primary,applyWay:'ranged',attackId:p.attackId,tags:['skybox:s1']});
  }
 }
 watch(){if(this.watchers.length||!this.flights.size)return;this.watchers=[this.b.on('tick',()=>{
  for(const [projectile,p]of this.flights){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;
   if(!this.b.projectiles.list.includes(projectile)&&!this.b.projectiles.arriving.includes(projectile))this.flights.delete(projectile);}
  this.unwatch();}),this.b.on('removed',({unit})=>{if(unit===this.u)this.retire();}),
  this.b.on('death',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 retire(){this.retired=true;for(const p of this.flights.values())p.retired=true;}
 drain(){this.ended=true;this.retire();this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.unwatch();}
}
