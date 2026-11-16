// SPDX-License-Identifier: GPL-3.0-or-later
import {changeEnemyEnergy,enemyEnergy} from './arkpedia-enemy-energy.js';
import {areaSelectable,characterLikeTarget} from '../targeting.js';
import {ALLY_COLLIDER_RADIUS} from '../constants.js';
/** A stationary death projectile reaches at its lifetime boundary. Reached
 * actions run before the area's hit behavior. Its cached packet and deadline
 * survive the source deployment's retirement. */
export function deathEnergyPulse(params){
 validate(params);const{delay,radius,scale,type,energy,markerKey,parentKey,silenceable}=params;
 return{spawn(b,e,a){
  if(!e.alive||!e.deployed)return;a.life=e.deploySeq;a.parent=b.addBuff(e,{key:parentKey,source:e,refresh:'independent'});
  if((!e.alive||!e.deployed||e.deploySeq!==a.life)&&a.parent){b.removeBuff(e,a.parent);a.parent=null;}
 },death(c,b,e,a){
  const attached=a.parent&&e.buffs.includes(a.parent);if(a.parent)b.removeBuff(e,a.parent);a.parent=null;
  if(!attached||e.deploySeq!==a.life||c.reason!=='killed'||silenceable&&e.s.flags.silence)return;
  const{x,y}=e,amount=e.s.atk*scale,side=e.side;
  b.fx('explode',{x,y,r:radius,t:delay,kind:'nativeDeathEnergy',id:e.id});
  b.after(delay,()=>{
   for(const donor of [...b.units]){
    if(donor.side!==side||!donor.alive||!donor.deployed||!donor.findBuff(markerKey))continue;
    const state=enemyEnergy(b,donor);if(state&&!state.overloaded)changeEnemyEnergy(b,donor,energy);
   }
   for(const u of b.allies(null,{includeTargetableDevices:true})){
    if(!characterLikeTarget(u)||!areaSelectable(e,u)||u.isFlying||Math.hypot(u.x-x,u.y-y)>radius+ALLY_COLLIDER_RADIUS+1e-9)continue;
    b.dealDamage(e,u,{amount,type,isAttack:false,isSkill:true,applyWay:'none',canDodge:false,tags:['nativeDeathEnergy']});
   }
  });
 }};
}
function validate({delay,radius,scale,type,energy,markerKey,parentKey,silenceable}){
 if(!Number.isFinite(delay)||delay<=0||!Number.isFinite(radius)||radius<=0||radius>128||!Number.isFinite(scale)||scale<0
  ||!['phys','arts','true'].includes(type)||!Number.isSafeInteger(energy)||energy<1||energy>1024||typeof markerKey!=='string'||!markerKey||markerKey.length>256||typeof parentKey!=='string'||!parentKey||parentKey.length>256||parentKey===markerKey||typeof silenceable!=='boolean')throw Error('Invalid death energy pulse');
}
deathEnergyPulse.validate=validate;
