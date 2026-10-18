// SPDX-License-Identifier: GPL-3.0-or-later
// Original S2 finite shell payload only; account/animation controller composes it.
import {SKYBOX_ID as ID,selectedSkyboxInputs,skyboxNativeInputs,skyboxSourceComponent} from './arkpedia-skybox-source.js';
import {canTargetEnemy} from '../targeting.js';
export const SKYBOX_S2_TRANSPORT_CONTRACT=Object.freeze({
 scope:'Selected original S2 cached-ATK Physical shell, finite speed-ten transport and radius1.100000023841858 explosion; no account or public registration.',
 mapping:'Both original mode2 attacks and remaining-ammo burst use one shell implementation. An invalid same-life input before projectile birth rejects the launch, matching emitToInputPosWhenTargetIsInvalid0. Accepted birth caches ATK/attack scale and selected attack@atk_scale. Current matching source life supplies outgoing modifiers and penetration per arrival action; departure permanently switches that payload to its launch view and old ledger. Born shells retain the last valid input location, survive source departure and have a ten-second lifetime. One claimed explosion snapshots recipient lives before callbacks; normal-loop retained same-life primary is included once; the burst uses collider selectability without forced primary inclusion. Other ground/air victims follow normal splash selectability within the original circular radius. Primary acquisition is separate from collision: this transport does not grant aerial selection to S2.',
 limitations:'Native numeric target-motion aliases, midpoint collision, straight homing/last-location retention, cached-attribute timing and retired-source dispatch remain explicit local mappings. Original target selection, ammo/account/burst scheduling, compiled callbacks, native FX/audio/modules, public delivery and frame/pixel parity remain separate.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.deploySeq===life&&t.side==='enemy';
export function verifySkyboxS2Transport(n=skyboxNativeInputs(),read=id=>skyboxSourceComponent('characters',ID,id)){
 const attacks=['-3554859342631338737','-7408980494276821745'].map(read),
  ps=n.projectiles.projectile_chr_skybx_s2.flatMap(r=>r.components),ds=ps.map(p=>p.data),
  body=ds.find(p=>p._lifeTime!=null),move=ds.find(p=>p._speed!=null),area=ds.find(p=>p._onlyCheckHitWhenReachTarget!=null),
  collider=ps.find(p=>p.type==='CircleCollider2D')?.data;
 if(attacks.some(a=>a._projectileKey!=='projectile_chr_skybx_s2'||a._useCachedAtkOnly!==1||a._transferSource!==1||a._damageType!==1
   ||a._emitToInputPosWhenTargetIsInvalid!==0||a._activeBuffs.length!==0||a._atkScaleKey!=='atk_scale')
  ||attacks[0]._alwaysIncludeTarget!==1||attacks[1]._alwaysIncludeTarget!==0
  ||body._hitNumType!==2||body._maxHitNum!==1||body._lifeTime!==10||body._managedBySource!==0||body._stopWhenSourceInvalid!==0
  ||body._alwaysHitTraceTargetInTheEnd!==1||body._fixDealHitTargetLeft!==1||body._canHitSameTargetMultipleTimes!==0||body._stopAfterMaxHit!==1
  ||move._speed!==10||move._moveType!==1||move._delayToStart!==0||move._delayAfterReached!==0||move._flyToTargetLocationOnly!==0
  ||area._onlyCheckHitWhenReachTarget!==1||area._goThroughWall!==1||area._onlyTraceTarget!==0||area._ignoreCamouflage!==1
  ||area._targetOptions.targetMotion!==3||area._targetOptions.targetSide!==2||area._targetOptions.ignoreTargetFree!==0
  ||collider?.m_Radius!==1.100000023841858||collider.m_IsTrigger!==true)throw Error('Changed original Skybox S2 transport inputs');
}
function captureSource(u){const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
 profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});
 Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;}
export class SkyboxSkillTwoTransport{
 constructor(b,u,{contract}={}){
  if(contract!==SKYBOX_S2_TRANSPORT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||selectedSkyboxInputs(u).index!==1)
   throw Error('Fresh selected Skybox S2 and exact transport contract required');
  verifySkyboxS2Transport();this.b=b;this.u=u;this.record=selectedSkyboxInputs(u);this.seq=null;
  this.flights=new Map();this.watchers=[];this.retired=false;this.ended=false;
 }
 bind(){if(this.seq!==null||!present(this.u))throw Error('S2 transport binds one living deployment');this.seq=this.u.deploySeq;}
 source(p){return !this.retired&&!p.retired&&present(this.u)&&this.u.deploySeq===p.sourceLife?this.u:p.snapshot;}
 launch({target,life=target?.deploySeq,x=target?.x,y=target?.y,attackId=null,burst=false}={}){
  if(this.ended||this.retired||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq
   ||typeof burst!=='boolean'||!target||target.side!=='enemy'||!Number.isInteger(life)||![x,y].every(Number.isFinite)||!retained(target,life))return false;
  const p={target,life,sourceLife:this.seq,snapshot:captureSource(this.u),
   atk:this.u.s.atk*this.u.s.atkScaleMul,scale:this.record.bb['attack@atk_scale'],attackId,burst,retired:false,claimed:false};
  let projectile;projectile=this.b.addProjectile({from:this.u,target,source:this.u,
   hitDead:true,speed:10,maxAge:10,visual:'orb',data:{arkpediaTrackedVisual:true,projectileKey:'projectile_chr_skybx_s2',skyboxS2:true},
   onHit:({x:atX,y:atY})=>{if(p.claimed)return;p.claimed=true;this.flights.delete(projectile);
    if(!this.ended&&!this.b.finished)this.explode(p,atX,atY);this.unwatch();}});
  this.flights.set(projectile,p);this.watch();return true;
 }
 explode(p,x,y){if(![x,y].every(Number.isFinite))return;const u=this.source(p),primary=retained(p.target,p.life)?p.target:null;
  const ts=this.b.enemiesInRadius(x,y,1.100000023841858,true).filter(t=>canTargetEnemy(u,t,{canHitFly:true,groundOnly:false}));
  if(!p.burst&&primary&&!ts.includes(primary))ts.unshift(primary);
  const victims=ts.map(t=>({target:t,life:t.deploySeq}));
  for(const{target:t,life}of victims){if(this.ended||this.b.finished)break;if(!retained(t,life))continue;
   const source=this.source(p);this.b.dealDamage(source,t,{amount:p.atk*p.scale,type:'phys',isAttack:true,isSkill:true,isProjectile:true,
    isSplash:t!==primary,applyWay:'ranged',attackId:p.attackId,tags:['skybox:s2']});
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
