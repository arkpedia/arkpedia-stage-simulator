// SPDX-License-Identifier: GPL-3.0-or-later
import { canTargetEnemy } from '../targeting.js';
import { applySourceCold } from './arkpedia-source-cold.js';
const present=u=>u?.alive&&u.deployed&&!u._removing;
const PROFILE=Object.freeze({canHitFly:true});
export class SnhuntProjectiles {
 constructor(core){this.core=core;this.flights=new Set();this.endHook=null;}
 source(f){const u=this.core.u;return!f.retired&&present(u)&&u.deploySeq===f.seq?u:f.snapshot;}
 release(f){f.expiry?.cancel();this.flights.delete(f);if(!this.flights.size&&this.endHook){this.core.b.off(this.endHook);this.endHook=null;}}
 emit(target,kind,info={}){
  const{b,u,record:r,trait}=this.core;if(!this.core.valid()||!target?.alive)return false;
  const beast=kind==='beast',snapshot={...u,base:{...u.base},mem:{},tags:new Set(u.tags),s:structuredClone(u.s),
   profile:{hitSleep:u.profile.hitSleep},stats:u.stats};
  const f={seq:u.deploySeq,targetSeq:target.deploySeq,snapshot,retired:false,kind};this.flights.add(f);
  if(!this.endHook)this.endHook=b.on('battleEnd',()=>this.clear());
  const life=beast?.1:10;
  f.expiry=b.after(life+b.dt,()=>this.release(f));
  f.projectile=b.addProjectile({from:beast?{x:target.x,y:target.y}:u,source:u,target,
   ...(beast?{flightTime:life,attached:true}:{}),speed:10,maxAge:life,visual:beast?'none':'arrow',
   data:{arkpediaTrackedVisual:true,projectileKey:beast?'projectile_chr_snhunt_animal':kind==='s1'?'projectile_chr_snhunt_01':kind==='s2'?'projectile_chr_snhunt_02':'projectile_chr_snhunt'},
   onHit:({target:t})=>{
    this.release(f);if(b.finished||t!==target||t.deploySeq!==f.targetSeq||!canTargetEnemy(u,t,PROFILE))return;
    const source=this.source(f);let scale=beast?r.talentBb[0].atk_scale:trait.bb.atk_scale;
    if(kind==='s1')scale*=r.bb.atk_scale;
    if(kind==='s2'){
     // Selected mapping of native CheckEnemyIsStayStill; TRAP is a separate explicit native OR branch.
     const stationary=t.blockedBy||!t.moving||!t.canAct||t.s.flags.noMove;
     scale*=stationary||t.def.profession==='TRAP'?r.bb.atk_scale_2:r.bb.atk_scale_1;
    }
    b.dealDamage(source,t,{amount:source.s.atk*(beast?1:source.s.atkScaleMul)*scale,type:'phys',
     isAttack:true,isSkill:kind!=='ordinary',isProjectile:true,applyWay:'ranged',attackId:info.attackId??0,
     tags:[`snhunt:${kind}`]});
    // The native attached cold is explicitly not damage-missable, independent of dodge/shield HP loss.
    if(beast&&t.alive&&t.deployed)applySourceCold(b,source,t,r.talentBb[0].cold);
   }});
  return true;
 }
 retire(){for(const f of this.flights)f.retired=true;}
 clear(){for(const f of this.flights){f.expiry?.cancel();f.projectile.removed=true;}this.flights.clear();
  if(this.endHook)this.core.b.off(this.endHook);this.endHook=null;}
}
