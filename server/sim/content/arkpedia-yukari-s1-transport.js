// SPDX-License-Identifier: GPL-3.0-or-later
// Four source S1 payloads only; the caller owns account, markers and selection.
import {YUKARI_ID as ID,selectedYukariInputs,yukariNativeInputs} from './arkpedia-yukari-source.js';
import {canTargetEnemy} from '../targeting.js';
export const YUKARI_S1_TRANSPORT_CONTRACT=Object.freeze({
 scope:'Selected Yukari S1 three direct Arts arrows and a distinct final radius1.100000023841858 Arts/levitation arrow only; no account/marker/selector or public admission.',
 mapping:'The caller explicitly releases indices0..3 at the original markers. Each release creates its own speed20/ten-second independent homing projectile; index3 uses the native hookTheLastProjectile with overwritten final actions, not an extra ordinary multi_atk_scale packet. A retained missing/dead/hidden/replaced input uses its captured release position; after flight the final projectile checks the current mixed-motion area, including camouflage, and snapshots recipient lives. Ordinary S1 arrows read multi_atk_scale; the final uses final_atk_scale with applyWay NONE, then separately attempts resistible levitation only on each surviving same recipient life. Damage cancellation/dodge does not replace the native alive check. Flying/already-levitated/immune/heavy targets follow shared levitation rules. Each action reads live same-source ATK/typed attributes; source retirement irreversibly uses its launch view and old ledger/team. Already born payloads and nonderived levitation survive skill/source finish. Battle end/interception drains finite transport without damage.',
 limitations:'Native projectile source/retained-point, midpoint collision/range-scale, final trace-target inclusion, selector/reselection, callback ordering, status override and invalid-source attribute lookup remain explicit local mappings. Direct S1 arrows retain target-free input lives; final area rechecks normal enemy eligibility and ignores camouflage. The caller must own source activation and prevent duplicate marker releases. No automatic cast, fabricated attack receipt, native trail/hit/levitation particles, audio, modules, compiled/frame/pixel parity or public admission.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
const retained=t=>present(t)&&!t.hidden&&t.side==='enemy';
export function verifyYukariS1Transport(n=yukariNativeInputs()){
 const a=n.s1Attack;
 if(a._projectileKey!=='projectile_chr_yukari_s1'||a._additionalProjectile!=='projectile_chr_yukari_s1'||a._hookTheLastProjectile!=='projectile_chr_yukari_s1_final'
  ||a._additionalTimes!==3||a._waitAttackEventForAllAttacks!==1||a._triggerDelta!==0||a._atkScaleKey!=='multi_atk_scale'||a._damageType!==2||a._useCachedAtkOnly!==0||a._transferSource!==0
  ||a._emitToInputPosWhenTargetIsInvalid!==1||a._activeBuffs.length!==0)throw Error('Changed original Yukari S1 transport inputs');
 const parts=key=>n.projectiles[key].flatMap(r=>r.components),base=parts('projectile_chr_yukari_s1'),final=parts('projectile_chr_yukari_s1_final');
 for(const[rows,last]of[[base,false],[final,true]]){const p=rows.find(c=>c.data._lifeTime!=null).data,m=rows.find(c=>c.data._speed!=null).data;
  if(p._lifeTime!==10||p._managedBySource!==0||p._stopWhenSourceInvalid!==0||p._canHitSameTargetMultipleTimes!==0||p._alwaysHitTraceTargetInTheEnd!==1
   ||p._maxHitNum!==1||p._hitNumType!==(last?2:1)||p._stopAfterMaxHit!==(last?0:1)||p._stopAfterFirstHit!==(last?1:0)
   ||m._speed!==20||m._moveType!==1||m._addInertia!==0||m._delayToStart!==0||m._forceReachedWhenTimeup!==1)throw Error('Changed original Yukari S1 projectile inputs');
 }
 const area=final.find(c=>c.data._onlyCheckHitWhenReachTarget!=null).data,collider=final.find(c=>c.type==='CircleCollider2D').data,
  action=final.find(c=>c.data._overwriteActions!=null)?.data,actions=JSON.parse(action._actions.SerializedState),[damage,alive,levitate]=actions,grant=levitate?._buff;
 if(area._targetOptions.targetSide!==2||area._targetOptions.targetMotion!==3||area._targetOptions.ignoreTargetFree!==0||area._onlyCheckHitWhenReachTarget!==1||area._onlyCheckHitWhenStop!==0
  ||area._goThroughWall!==1||area._ignoreCamouflage!==1||area._onlyTraceTarget!==0||area._exceptTraceTarget!==0||area._ignoreRangeScale!==0
  ||collider.m_Radius!==1.100000023841858||collider.m_IsTrigger!==true||collider.m_Offset.x!==0||collider.m_Offset.y!==0
  ||action._overwriteActions!==1||actions.length!==3||!damage.$type.endsWith('+AdvancedApplyDamage')||damage._sourceType!=='SOURCE'||damage._targetType!=='TARGET'
  ||damage._damageType!=='MAGICAL'||damage._atkScaleVar!=='final_atk_scale'||damage._applyWay!=='NONE'||damage._forceUseProjectileCachedAtk!==false||damage._attackType!=='NORMAL'
  ||!alive.$type.endsWith('+CheckUnitAlive')||alive._ownerType!=='TARGET'||!levitate.$type.endsWith('+CreateBuffAllowAll')||levitate._buffOwner!=='TARGET'
  ||levitate._useSpecialBuffSource!==true||levitate._specialBuffSource!=='SOURCE'||levitate._isDerivedBuff!==false||levitate._finishDerivedBuffIfParentFinish!==false
  ||grant.attributes.abnormalFlags.join()!=='LEVITATE'||grant.lifeTimeType!=='LIMITED'||grant.durationKey!=='levitate'||grant.statusResistable!=='AUTOMATIC'||grant.templateKey!=='empty')throw Error('Changed original Yukari final S1 actions');
 return{radius:collider.m_Radius,lifeTime:10,speed:20};
}
function captureSource(u){const v=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});Object.defineProperty(v,'s',{value:structuredClone(u.s),enumerable:true});return v;}
export class YukariSkillOneTransport{
 constructor(b,u,{contract}={}){
  if(contract!==YUKARI_S1_TRANSPORT_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||selectedYukariInputs(u).index!==0)throw Error('Fresh selected Yukari S1 and exact transport contract required');
  Object.assign(this,{b,u,record:selectedYukariInputs(u),inputs:verifyYukariS1Transport(),seq:null,serial:0,flights:new Map(),watchers:[],retired:false,ended:false});
 }
 bind(){if(this.seq!==null||!present(this.u)||this.retired||this.ended)throw Error('Yukari S1 transport binds one living deployment');this.seq=this.u.deploySeq;}
 source(p){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;return !this.retired&&!p.retired?this.u:p.snapshot;}
 launch({target,life=target?.deploySeq,x=target?.x,y=target?.y,index,attackId=null}={}){
  if(this.ended||this.retired||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq||!target||target.side!=='enemy'||!Number.isInteger(life)||!Number.isInteger(index)||index<0||index>3||![x,y].every(Number.isFinite))return false;
  const current=target.deploySeq===life&&retained(target),p={target,life,index,sourceLife:this.seq,snapshot:captureSource(this.u),attackId,retired:false,claimed:false,serial:++this.serial};let projectile;
  projectile=this.b.addProjectile({from:this.u,...(current?{target,hitDead:true}:{to:{x,y}}),source:this.u,speed:this.inputs.speed,maxAge:this.inputs.lifeTime,visual:'arrow',
   data:{arkpediaTrackedVisual:true,projectileKey:index===3?'projectile_chr_yukari_s1_final':'projectile_chr_yukari_s1',yukariS1:index},onHit:({x:atX=projectile.x,y:atY=projectile.y}={})=>{
    if(p.claimed||projectile.removed||!this.flights.has(projectile))return;p.claimed=true;this.flights.delete(projectile);
    if(!this.ended&&!this.b.finished){if(index===3)this.explode(p,atX,atY);else if(target.deploySeq===life&&retained(target))this.damage(p,target,life,false);}
    this.unwatch();}});
  this.flights.set(projectile,p);this.watch();return true;
 }
 damage(p,t,life,final){if(this.ended||this.b.finished||!retained(t)||t.deploySeq!==life)return;
  const src=this.source(p);this.b.dealDamage(src,t,{amount:src.s.atk*src.s.atkScaleMul*this.record.bb[final?'final_atk_scale':'multi_atk_scale'],type:'arts',isAttack:true,isSkill:true,isProjectile:true,
   isSplash:final&&(t!==p.target||life!==p.life),applyWay:final?'none':'ranged',attackId:p.attackId,tags:[final?'yukari:s1-final':'yukari:s1-arrow']});
  if(final&&!this.ended&&!this.b.finished&&retained(t)&&t.deploySeq===life){const source=this.source(p),key=`yukari:s1-levitate:${this.u.id}:${this.seq}:${p.serial}`,token={payload:p,life};
   this.b.applyStatus(t,'levitate',{source,duration:this.record.bb.levitate,key,sourceStatusResistable:true,buffData:{yukariLevitate:token},
    admit:(_t,buff)=>!this.ended&&!this.b.finished&&retained(t)&&t.deploySeq===life&&(!buff||buff.key===key&&buff.source===source&&buff.data?.yukariLevitate===token&&buff.status==='levitate'
     &&Object.keys(buff.mods??{}).length===0&&Object.keys(buff.flags??{}).sort().join()==='levitate,noDisplace,stun,unblockable'&&Object.values(buff.flags).every(v=>v===true))});}
 }
 explode(p,x,y){if(![x,y].every(Number.isFinite))return;const src=this.source(p),legal=t=>retained(t)&&canTargetEnemy(src,t,{canHitFly:true,groundOnly:false}),
  victims=this.b.enemiesInRadius(x,y,this.inputs.radius,true).filter(legal).map(t=>({target:t,life:t.deploySeq}));
  for(const{target:t,life}of victims){if(this.ended||this.b.finished)break;if(legal(t)&&t.deploySeq===life)this.damage(p,t,life,true);}
 }
 watch(){if(this.watchers.length||!this.flights.size)return;this.watchers=[this.b.on('tick',()=>{for(const[projectile,p]of this.flights){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;if(!this.b.projectiles.list.includes(projectile)&&!this.b.projectiles.arriving.includes(projectile))this.flights.delete(projectile);}this.unwatch();}),
  this.b.on('removed',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('death',({unit})=>{if(unit===this.u)this.retire();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 retire(){this.retired=true;for(const p of this.flights.values())p.retired=true;}
 drain(){this.ended=true;this.retire();this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.unwatch();}
}
