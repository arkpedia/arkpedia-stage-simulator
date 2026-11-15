// SPDX-License-Identifier: GPL-3.0-or-later
/** Enemy-owned reaction to the source's continuing rope trigger. Device geometry,
 * contact selection, slow and result counters belong to the stage element. */
export function triggerEnemyRopeContact(b,enemy){
  if(!enemy?.alive||!enemy.deployed)return;
  for(const a of enemy.mem.ab?.list??[])a.ropeContact?.(b,enemy,a);
}
export function ropeBreakableDodge({prob}){
  const key='enemy_mmelee_physical_evade';
  return{
    spawn(b,e){b.addBuff(e,{key,persist:true,mods:{dodgePhys:prob}});},
    ropeContact(b,e){b.removeBuff(e,key);},
  };
}
