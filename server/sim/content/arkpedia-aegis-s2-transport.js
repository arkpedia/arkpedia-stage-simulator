// SPDX-License-Identifier: GPL-3.0-or-later
// Held S2 six original staged missiles and separate delayed-stop kick payload.
import {AEGIS_ID as ID,selectedAegisInputs,aegisNativeInputs} from './arkpedia-aegis-source.js';
import {canTargetEnemy} from '../targeting.js';
export const AEGIS_S2_TRANSPORT_CONTRACT=Object.freeze({
 scope:'Selected original Aegis S2 staged missile geometry, six distinct prefabs, live-ATK area impacts and separate immediate-position delayed kick; no account/animation/public admission.',
 mapping:'Each missile keeps its own original angle ratio and first-stage period, speed10, near-target1.2999999523162842 switch and inherited direction. The first stage maps source inertia to normalized direction blending by clamp(turnSpeed*dt,0,1), using 1/120-second maximum geometric substeps; the second stage homes directly. Angle ratio maps linearly across minus/plus40 degrees and left presentation mirrors that fan. Time and proximity switch the stage independently of ASPD/owner slowdown. Shared projectile speed auras scale movement, not the stage clock. Native forceReachedWhenTimeup1 explicitly reaches the retained destination at the ten-second boundary. Each reached missile performs one mixed-motion radius1.100000023841858 explosion. Kick reaches the current/captured input position immediately, does not follow it, and performs one radius2 stop explosion after .11999999731779099 seconds. It has its own invalidation ticket; no logical owner relocation or substitute body animation is introduced. Current same-life ATK/scale/typed modifiers are read per damage action. Departed/replaced source uses an irreversible launch-attribute view and old ledger. Born missiles/kick survive source departure, with finite interception/battle-end cleanup.',
 limitations:'Native angle/inertia/turn interpolation, staged-switch geometry, source mount offsets, callback/collider midpoint semantics, packet ordering and invalid-source uncached lookup are explicit local mappings, not compiled or game-frame parity. Source mount groups and effect keys are retained but not substituted with fake artwork. Kick body visibility remains in the original Spine/effect pipeline; this payload never moves the owner tile. Native FX/audio/modules, account, target selection, ability sequencing and public delivery remain separate.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.deploySeq===life&&t.side==='enemy';
const rows=(n,key)=>n.projectiles[key].flatMap(r=>r.components);
export function verifyAegisS2Transport(n=aegisNativeInputs()){
 const a=n.s2Missiles,k=n.s2Kick,periods=[.25,.30000001192092896,.25,.4000000059604645,.4000000059604645,.4000000059604645],ratios=[.375,.625,.25,.75,0,1],missiles=[];
 if(a._additionalTimes!==5||a._waitAttackEventForAllAttacks!==1||a._triggerDelta!==0||a._useMultiAdditionalProjectiles!==1
  ||a._projectileKey!=='projectile_chr_aigis_s2_1'||a._additionalProjectiles.join()!==[2,3,4,5,6].map(i=>'projectile_chr_aigis_s2_'+i).join()
  ||a._mountPointGroup.join()!=='18,21,19,22,20,23'||a._splitDamage!==0||a._useCachedAtkOnly!==0||a._transferSource!==0
  ||k._projectileKey!=='projectile_chr_aigis_s2_kick'||k._waitForProjectileInvalid!==1||k._useCachedAtkOnly!==0||k._atkScaleKey!=='kick_atk_scale')
  throw Error('Changed original Aegis S2 transport ability');
 for(let i=1;i<=7;i++){
  const kick=i===7,key='projectile_chr_aigis_s2_'+(kick?'kick':i),ps=rows(n,key),d=ps.map(p=>p.data),body=d.find(p=>p._lifeTime!=null),
   area=d.find(p=>p._onlyCheckHitWhenStop!=null),collider=ps.find(p=>p.type==='CircleCollider2D')?.data;
  if(body._hitNumType!==2||body._maxHitNum!==1||body._lifeTime!==10||body._managedBySource!==0||body._stopWhenSourceInvalid!==0
   ||body._alwaysHitTraceTargetInTheEnd!==0||body._alwaysHitTraceTargetWhenReached!==0||body._canHitSameTargetMultipleTimes!==0
   ||area._targetOptions.targetSide!==2||area._targetOptions.targetMotion!==3||area._targetOptions.ignoreTargetFree!==0||area._ignoreCamouflage!==1
   ||area._onlyTraceTarget!==0||area._onlyCheckHitWhenReachTarget!==(kick?0:1)||area._onlyCheckHitWhenStop!==(kick?1:0)
   ||collider.m_Radius!==(kick?2:1.100000023841858)||collider.m_IsTrigger!==true)throw Error('Changed original Aegis S2 area/life inputs');
  const effects=d.find(p=>p._effectsWhenReached!=null);
  if(kick){const move=d.find(p=>p._immediatelyReach!=null);
   if(move._immediatelyReach!==1||move._delayAfterReached!==1||move._delayTime!==.11999999731779099||move._followTarget!==0||move._keepUpdate!==0
    ||move._stopIfTargetDead!==0||move._stopIfTargetDisappeared!==0)throw Error('Changed original Aegis S2 kick inputs');
   return{missiles,kick:{key,radius:collider.m_Radius,delay:move._delayTime,lifeTime:body._lifeTime,effects}};
  }
  const move=d.find(p=>p._movements),at=id=>ps.find(p=>p.pathId===id)?.data,control=at(move._controller.m_PathID),stages=move._movements.map(ref=>at(ref.m_PathID));
  if(stages.length!==2||move._forceReachedWhenTimeup!==1||control._periodTimeSlots.length!==1||control._periodTimeSlots[0]!==periods[i-1]
   ||control._switchWhenNearTarget!==1||control._nearTargetDistance!==1.2999999523162842||control._inheritDirectionWhenSwitch!==1
   ||stages.some(s=>s._speed!==10||s._moveType!==1||s._delayToStart!==0||s._delayAfterReached!==0||s._clearTraceTargetWhenReached!==1)
   ||stages[0]._addInertia!==1||stages[0]._turnSpeed!==5||stages[0]._useSourceToTargetArcAngleWithRatio!==1
   ||stages[0]._sourceDirectionArcAngleRatio!==ratios[i-1]||stages[0]._sourceToTargetArcAngle!==40||stages[0]._adjustSourceToTargetArcAngleBySourceFace!==1
   ||stages[1]._addInertia!==0||stages[1]._useSourceToTargetArcAngleWithRatio!==0)throw Error('Changed original Aegis S2 staged mover');
  missiles.push({key,radius:collider.m_Radius,lifeTime:body._lifeTime,period:periods[i-1],ratio:ratios[i-1],angle:40,speed:10,turn:5,near:control._nearTargetDistance,
   mount:a._mountPointGroup[i-1],effects});
 }
}
function captureSource(u){const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
 profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;}
export class AegisSkillTwoTransport{
 constructor(b,u,{contract}={}){
  if(contract!==AEGIS_S2_TRANSPORT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||selectedAegisInputs(u).index!==1)throw Error('Fresh selected Aegis S2 and exact transport contract required');
  Object.assign(this,{b,u,record:selectedAegisInputs(u),native:verifyAegisS2Transport(),seq:null,flights:new Map(),watchers:[],retired:false,ended:false});
 }
 bind(){if(this.seq!==null||!present(this.u)||this.retired||this.ended)throw Error('Aegis S2 payload binds one living deployment');this.seq=this.u.deploySeq;}
 source(p){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;return !this.retired&&!p.retired?this.u:p.snapshot;}
 active(p){return !!p&&!p.finished&&this.flights.get(p.projectile)===p;}
 move(p,{projectile:q,dt,speedScale,expires}){
  if(expires)return{x:q.tx,y:q.ty,reached:true};let x=q.x,y=q.y,left=dt,m=p.motion;
  while(left>1e-10){let dx=q.tx-x,dy=q.ty-y,dist=Math.hypot(dx,dy);if(dist<1e-9)return{x:q.tx,y:q.ty,reached:true};
   if(m.stage===0&&(m.age>=p.native.period-1e-9||dist<=p.native.near))m.stage=1;
   let h=Math.min(left,1/120,m.stage===0?Math.max(0,p.native.period-m.age):Infinity);if(h<1e-10){m.stage=1;continue;}
   const tx=dx/dist,ty=dy/dist;if(m.stage===0){const alpha=Math.min(1,p.native.turn*h),vx=m.dx*(1-alpha)+tx*alpha,vy=m.dy*(1-alpha)+ty*alpha,n=Math.hypot(vx,vy);m.dx=n>1e-10?vx/n:tx;m.dy=n>1e-10?vy/n:ty;}
   else{m.dx=tx;m.dy=ty;}const step=p.native.speed*speedScale*h;
   if(dist<=step)return{x:q.tx,y:q.ty,reached:true};x+=m.dx*step;y+=m.dy*step;m.age+=h;left-=h;
  }return{x,y,reached:false};
 }
 launch({kind='missile',index=1,target,life=target?.deploySeq,x=target?.x,y=target?.y,attackId=null,facing=this.u.mem.regularVisualDirection??this.u.dir,track=true}={}){
  if(!['missile','kick'].includes(kind)||kind==='missile'&&(!Number.isInteger(index)||index<1||index>6))throw Error('Exact Aegis S2 projectile kind/index required');
  if(this.ended||this.retired||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq||!target||target.side!=='enemy'||!Number.isInteger(life)||![x,y].every(Number.isFinite)||typeof track!=='boolean')return null;
  const native=kind==='kick'?this.native.kick:this.native.missiles[index-1],valid=track&&retained(target,life),dest=valid?{x:target.x,y:target.y}:{x,y},
   angle=Math.atan2(dest.y-this.u.y,dest.x-this.u.x)+(kind==='kick'?0:(native.ratio*2-1)*native.angle*Math.PI/180*(facing==='LEFT'?-1:1)),
   p={kind,index,native,target,life,sourceLife:this.seq,snapshot:captureSource(this.u),scale:this.record.bb[kind==='kick'?'kick_atk_scale':'atk_scale'],attackId,
    retired:false,claimed:false,finished:false,motion:{stage:0,age:0,dx:Math.cos(angle),dy:Math.sin(angle)},projectile:null};
  const data={arkpediaTrackedVisual:true,projectileKey:native.key,aegisS2:true,kind,index,mount:native.mount,effects:native.effects};
  const options=kind==='kick'?{from:dest,to:dest,flightTime:native.delay,attached:true}:{from:this.u,target:valid?target:null,to:valid?undefined:dest,hitDead:true,speed:native.speed,advanceMotion:c=>this.move(p,c)};
  p.projectile=this.b.addProjectile({...options,source:this.u,maxAge:native.lifeTime,visual:'none',data,onHit:({x:atX,y:atY})=>{
   if(p.claimed||p.finished)return;p.claimed=true;p.finished=true;this.flights.delete(p.projectile);
   if(!this.ended&&!this.b.finished)this.explode(p,atX,atY);this.unwatch();}});
  this.flights.set(p.projectile,p);this.watch();return p;
 }
 explode(p,x,y){if(![x,y].every(Number.isFinite))return;const u=this.source(p),victims=this.b.enemiesInRadius(x,y,p.native.radius,true)
  .filter(t=>present(t)&&canTargetEnemy(u,t,{canHitFly:true,groundOnly:false})).map(t=>({target:t,life:t.deploySeq}));
  for(const{target:t,life}of victims){if(this.ended||this.b.finished)break;const source=this.source(p);
   if(!present(t)||t.deploySeq!==life||!canTargetEnemy(source,t,{canHitFly:true,groundOnly:false}))continue;
   this.b.dealDamage(source,t,{amount:source.s.atk*source.s.atkScaleMul*p.scale,type:'phys',isAttack:true,isSkill:true,isProjectile:true,
    isSplash:t!==p.target||life!==p.life,applyWay:'ranged',attackId:p.attackId,tags:['aegis:s2',`aegis:s2:${p.kind}`]});}
 }
 watch(){if(this.watchers.length||!this.flights.size)return;this.watchers=[this.b.on('tick',()=>{
  for(const[q,p]of this.flights){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;
   if(!this.b.projectiles.list.includes(q)&&!this.b.projectiles.arriving.includes(q)){p.finished=true;this.flights.delete(q);}}this.unwatch();}),
  this.b.on('removed',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('death',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 retire(){this.retired=true;for(const p of this.flights.values())p.retired=true;}
 drain(){this.ended=true;this.retire();for(const p of this.flights.values())p.finished=true;this.b.removeProjectiles(q=>this.flights.has(q));this.flights.clear();this.unwatch();}
}
