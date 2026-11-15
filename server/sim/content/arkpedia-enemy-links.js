// SPDX-License-Identifier: GPL-3.0-or-later
/** Shared travelling link: first pulse on contact, then fixed intervals for a
 * bounded contact lifetime. The owner decides eligibility and interruption. */
export function addEnemyPulseLink(b,{source,target,speed=10,duration,interval=1,valid,onPulse,onFinish,data={}}){
  let linked=false,elapsed=0,pulse=0,finished=false;
  const finish=()=>{if(!finished){finished=true;onFinish?.();}};
  return b.addProjectile({source,from:source,target,speed,maxAge:3600,visual:'arts',data,
    advanceMotion:({projectile,dt,expires})=>{
      if(!valid()||expires){projectile.removed=true;finish();return{x:projectile.x,y:projectile.y,reached:false};}
      const dx=projectile.tx-projectile.x,dy=projectile.ty-projectile.y,distance=Math.hypot(dx,dy);
      if(!linked&&distance<=speed*dt){linked=true;pulse=interval;}
      else if(linked){elapsed+=dt;pulse+=dt;}
      if(linked&&elapsed+1e-9>=duration){projectile.removed=true;finish();return{x:projectile.tx,y:projectile.ty,reached:false};}
      if(linked)while(pulse+1e-9>=interval){pulse-=interval;if(onPulse()===false){projectile.removed=true;finish();break;}}
      return{x:linked?projectile.tx:projectile.x+dx/distance*speed*dt,y:linked?projectile.ty:projectile.y+dy/distance*speed*dt,reached:false};
    },onHit:finish});
}
