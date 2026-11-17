// SPDX-License-Identifier: GPL-3.0-or-later
import {areaSelectable} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';

/** A death projectile that hits ground units of both sides. When the unit is
 * killed (not when it leaves), unless it is silenced, every selectable ground
 * ally and every other ground enemy within `radius` of its tile takes
 * `scale` x ATK damage and, optionally, Cold for `cold` seconds. */
export function bothSidesDeathBlast(p){
 validate(p);
 return {
  // Silence-aware: the ability runtime skips this ability while the owner is silenced.
  sil:true,
  death(c,b,e){
   if(c.reason!=='killed')return;
   const amount=e.s.atk*p.scale,dmg={amount,type:p.type,isAttack:false,applyWay:'none',tags:['deathBlast','splash']};
   b.fx?.('explode',{x:e.x,y:e.y,r:p.radius,kind:'deathBlast',id:e.id});
   const allies=b.alliesInRadius(e.x,e.y,p.radius+ALLY_COLLIDER_RADIUS).filter(u=>areaSelectable(e,u)&&!u.isFlying);
   const enemies=b.enemiesInRadius(e.x,e.y,p.radius).filter(u=>u!==e&&u.alive&&!u.isFlying);
   for(const u of [...allies,...enemies]){
    b.dealDamage(e,u,{...dmg});
    if(p.cold>0&&u.alive)b.applyStatus(u,'cold',{duration:p.cold,source:e});
   }
  },
 };
}
function validate(p){
 const pos=v=>Number.isFinite(v)&&v>0;
 if(!p||!pos(p.radius)||!pos(p.scale)||!['phys','arts','true'].includes(p.type)||!(Number.isFinite(p.cold)&&p.cold>=0))throw Error('Invalid death blast');
}
bothSidesDeathBlast.validate=validate;
