// SPDX-License-Identifier: GPL-3.0-or-later
/** Persistent tile projectiles have no HP/card, survive source removal, and do
 * not hold victory. The shared projectile system owns their finite lifetime. */
export function enemyTileTriggerAt(b,row,col){
  return b.projectiles.list.some(p=>!p.removed&&p.data?.enemyTileTrigger?.row===row&&p.data.enemyTileTrigger.col===col);
}
export function addEnemyTileTrigger(b,{source,row,col,armDelay,interval,lifetime,select,onTrigger}){
  const state={row,col,armed:false},point={x:col,y:row};let next=armDelay;
  return b.addProjectile({source,from:point,to:point,maxAge:armDelay+lifetime,visual:'none',
    data:{enemyTileTrigger:state},advanceMotion:({projectile,expires})=>{
      if(expires){projectile.removed=true;return{...point,reached:false};}
      state.armed=projectile.age+1e-9>=armDelay;
      if(state.armed&&projectile.age+1e-9>=next){
        next+=interval;
        const target=select();
        if(target){projectile.removed=true;onTrigger(target);}
      }
      return{...point,reached:false};
    }});
}
