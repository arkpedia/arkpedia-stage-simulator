// SPDX-License-Identifier: GPL-3.0-or-later
import {animatedProjectileAttack,projectileSingleAttack} from './arkpedia-enemy-projectiles.js';
import {timedEnemyCasts} from './arkpedia-enemy-timed-casts.js';
import {validateEnemyAttackAnimation} from './arkpedia-enemy-attack-sequence.js';
import {flipHuiMingTileUnder} from './arkpedia-hui-ming-tiles.js';
import {enemyAttackRadius,enemyAttackTargets,sortAllyTargets} from '../targeting.js';
/** Native 'Envy' skill: a cooldown cast that charges for a fixed time on one
 * ground ally holding the tile scale buff (an ally standing on a Hui-Ming mark
 * tile), then releases one projectile. On arrival the projectile deals scaled
 * damage and flips the mark tile under its recipient. Interrupting the charge
 * ends it without a release. Ordinary projectiles share the cast scheduler. */
export function huiMingChargedShift(params){
 validate(params);const {attack,charge}=params;
 const shot=animatedProjectileAttack(attack);
 const special=projectileSingleAttack({type:charge.type,speed:charge.speed,lifetime:charge.lifetime,noAir:true,damageScale:charge.scale,
  // The tile action belongs to the hit event, not to accepted damage.
  onImpact:(b,_e,target)=>{flipHuiMingTileUnder(b,target);}});
 const spec={initial:charge.initial,cooldown:charge.cooldown,duration:charge.duration,release:charge.release,clip:charge.clip,slowDown:false,
  select:(b,e)=>sortAllyTargets(e,enemyAttackTargets(b,e,enemyAttackRadius(e)).filter(u=>!u.isFlying&&!!u.findBuff(charge.requiredBuff))).slice(0,1),
  fire:(b,e,targets)=>{const target=targets[0];if(target?.alive&&target.deployed)special.attack({targets:[target],attackId:b._attackSeq},b,e);},
  visual(_b,e,c){if(e.mem.regularFormVisual&&e.mem.regularFormVisual.clip===charge.clip)e.mem.regularFormVisual.speed=charge.clipDuration/charge.duration;}};
 const casts=timedEnemyCasts([spec],{silenceable:true,beforeCast:(b,e,_index,a)=>shot.cancel(b,e,a.shot)});
 return{
  spawn(b,e,a){a.shot={};shot.spawn(b,e,a.shot);casts.spawn(b,e,a);const prior=e.profile.canTarget;e.profile.canTarget=u=>(!u.isFlying||u===e.blockedBy)&&(!prior||prior(u));},
  attack(c,b,e,a){shot.attack(c,b,e,a.shot);},tick(b,e,a,dt){casts.tick(b,e,a,dt);shot.tick(b,e,a.shot,dt);},
  status(c,b,e,a){casts.status(c,b,e,a);shot.status(c,b,e,a.shot);},death(c,b,e,a){casts.death(c,b,e,a);shot.death(c,b,e,a.shot);},
 };
}
function validate({attack,charge}){
 validateEnemyAttackAnimation(attack?.animation);
 const positive=v=>Number.isFinite(v)&&v>0&&v<=1e4,type=v=>['phys','arts','true'].includes(v),text=v=>typeof v==='string'&&!!v&&v.length<=256;
 if(!attack||!type(attack.type)||!positive(attack.speed)||!positive(attack.lifetime)||attack.noAir!==true
  ||!charge||Object.keys(charge).sort().join()!=='clip,clipDuration,cooldown,duration,initial,lifetime,release,requiredBuff,scale,speed,type'
  ||!type(charge.type)||!Number.isFinite(charge.initial)||charge.initial<0||![charge.cooldown,charge.duration,charge.clipDuration,charge.speed,charge.lifetime].every(positive)
  ||!Number.isFinite(charge.release)||charge.release<0||charge.release>charge.duration||!Number.isFinite(charge.scale)||charge.scale<0||charge.scale>1e3||!text(charge.clip)||!text(charge.requiredBuff))throw Error('Invalid Hui-Ming charged shift');
}
huiMingChargedShift.validate=validate;
