// SPDX-License-Identifier: GPL-3.0-or-later
import {enemyEnergy,changeEnemyEnergy} from './arkpedia-enemy-energy.js';
import {auraSelectable} from '../targeting.js';
/** One native pulse captures its recipients before transfers. Reaching the
 * source capacity during that pulse does not rewrite the captured recipient
 * list; the parent program's overload guard runs on the next pulse. */
export function nativeEnergySiphon(params){
 validate(params);const{interval,radius,amount,parentKey,markerKey,immuneKey,motion}=params;
 return{
  spawn(b,e,a){
   if(!e.alive||!e.deployed)return;
   if(!enemyEnergy(b,e))throw Error('Missing native energy owner');
   a.life=e.deploySeq;const live=()=>e.alive&&e.deployed&&e.deploySeq===a.life;
   a.immune=b.addBuff(e,{key:immuneKey,source:e});
   if(!live()){if(a.immune)b.removeBuff(e,a.immune);return;}
   a.parent=b.addBuff(e,{key:parentKey,source:e,interval,onTick:()=>{
    if(!e.alive||!e.deployed||e.deploySeq!==a.life||!a.parent||!e.buffs.includes(a.parent)||enemyEnergy(b,e)?.overloaded)return;
    const donors=b.enemies.filter(u=>u!==e&&u.side===e.side&&u.findBuff(markerKey)&&!u.findBuff(immuneKey)&&auraSelectable(e,u)
     &&(motion==='all'||(motion==='fly')===u.isFlying)&&Math.hypot(u.x-e.x,u.y-e.y)<=radius+1e-9);
    for(const donor of donors){
     if(!e.alive||!e.deployed||e.deploySeq!==a.life||!e.buffs.includes(a.parent))break;
     const state=enemyEnergy(b,donor);if(!state||state.overloaded||state.count<=0)continue;
     const spent=-changeEnemyEnergy(b,donor,-Math.min(amount,state.count));if(spent>0)changeEnemyEnergy(b,e,spent);
    }
   }});
   if(!live()){if(a.parent)b.removeBuff(e,a.parent);if(a.immune)b.removeBuff(e,a.immune);}
  },
  death(_c,b,e,a){if(a.parent)b.removeBuff(e,a.parent);if(a.immune)b.removeBuff(e,a.immune);},
 };
}
function validate({interval,radius,amount,parentKey,markerKey,immuneKey,motion}){
 if(!Number.isFinite(interval)||interval<=0||!Number.isFinite(radius)||radius<=0||radius>128||!Number.isSafeInteger(amount)||amount<1||amount>1024
  ||![parentKey,markerKey,immuneKey].every(k=>typeof k==='string'&&k.length>0&&k.length<=256)||new Set([parentKey,markerKey,immuneKey]).size!==3
  ||!['ground','fly','all'].includes(motion))throw Error('Invalid native energy siphon');
}
nativeEnergySiphon.validate=validate;

nativeEnergySiphon.requires=Object.freeze(['native-energy']);
