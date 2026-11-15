// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
export function powerArmorDriver({sp,ranged,attackAnim}) {
  const shot=ranged?projectileSingleAttack({speed:10,lifetime:10,type:'phys',meleeWhenBlocked:true}):null;
  return {
    spawn(b,e){b.addBuff(e,{key:'lypa[driver_mark]',persist:true});e.def={...e.def,attackAnim};shot?.spawn(b,e);},
    ...(shot?{attack:shot.attack}:{}),
    death(c,_b,_e,a){
      if(c.reason!=='killed'||a.charged||!c.killer?.findBuff('lypa[car_mark]'))return;
      a.charged=true;c.killer.skill?.gainSp(sp,'powerArmorDriver');
    },
  };
}
export function unblockedSanctuary({reduction}) {
  const key='lysytc[damage_resistance]';
  const update=(b,e)=>{
    if(e.blockedBy)b.removeBuff(e,key);
    else if(!e.findBuff(key)&&!e.findBuff('lysytc[damage_reduce]'))b.applyStatus(e,'sanctuary',{key,source:e,value:reduction});
  };
  return {
    spawn(b,e){update(b,e);for(const event of ['blocked','unblocked'])b.on(event,({enemy})=>{if(enemy===e)update(b,e);},{owner:e});},
    tick:update,
  };
}
