// SPDX-License-Identifier: GPL-3.0-or-later
import {areaSelectable} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';

/** Counts the damage instances the unit takes (not those that give no SP,
 * which the engine marks `noSp`, nor elemental buildup). On the Nth it resets
 * the count and, around itself, stuns every selectable ally that is not
 * already stunned and deals them ATK-scaled damage. */
export function damageCountBurst(p){
 validate(p);
 return {
  spawn(_b,_e,a){a.count=0;},
  taken(c,b,e,a){
   if(c.target!==e||!e.alive||!c.dmg||c.dmg.noSp||c.dmg.type==='element'||!(c.amount>0||c.hpLoss>0))return;
   if(++a.count<p.count)return;
   a.count=0;
   for(const u of b.alliesInRadius(e.x,e.y,p.radius+ALLY_COLLIDER_RADIUS,null,{includeDevices:true}).filter(u=>areaSelectable(e,u)&&!u.s.flags.stun)){
    b.applyStatus(u,'stun',{duration:p.stun,source:e});
    b.dealDamage(e,u,{amount:e.s.atk*p.scale,type:p.type,isAttack:false,applyWay:'none',tags:['damageCountBurst','splash']});
   }
  },
 };
}
function validate(p){
 const pos=v=>Number.isFinite(v)&&v>0;
 if(!p||!Number.isSafeInteger(p.count)||p.count<1||p.count>1000||!pos(p.radius)||!pos(p.scale)||!pos(p.stun)||!['phys','arts','true'].includes(p.type))
  throw Error('Invalid damage count burst');
}
damageCountBurst.validate=validate;
