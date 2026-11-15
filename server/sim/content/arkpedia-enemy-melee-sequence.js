// SPDX-License-Identifier: GPL-3.0-or-later
import { ordinaryEnemyAttackSequence,validateEnemyAttackAnimation } from './arkpedia-enemy-attack-sequence.js';
export function ordinaryMeleeSequence(select) {
  return ordinaryEnemyAttackSequence(select, (b, e, u, c) =>
    b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true, isSkill: false,
      attackId: c.attackId, applyWay: 'melee', tags: ['ordinaryMeleeSequence'] }));
}

/** A data-only ordinary melee cast: one shared transport and marker clock. */
export function animatedMeleeAttack({animation}){
  validateEnemyAttackAnimation(animation);
  return ordinaryMeleeSequence(()=>animation);
}
animatedMeleeAttack.validate=({animation})=>validateEnemyAttackAnimation(animation);

/** Ordinary blocker melee plus a marker-filtered ranged direct-hit mode. Both
 * use the same captured-target receipts, damage path and animation clocks. */
export function markedRangedMeleeAttack(params){
 validateMarked(params);const {radius,markerKey,groundOnly,meleeAnimation,rangedAnimation}=params;
 const sequence=ordinaryMeleeSequence((_b,e,_a,c)=>c.targets[0]===e.blockedBy?meleeAnimation:rangedAnimation);
 return{...sequence,spawn(b,e,a){
  sequence.spawn(b,e,a);const prior=e.profile.canTarget;
  e.base.rangeRadius=radius;e.profile.melee=false;
  e.profile.canTarget=u=>(u===e.blockedBy||(!groundOnly||!u.isFlying)&&!!u.findBuff(markerKey))&&(!prior||prior(u));
  e.markDirty();
 }};
}
function validateMarked({radius,markerKey,groundOnly,meleeAnimation,rangedAnimation}){
 if(!Number.isFinite(radius)||radius<=0||typeof markerKey!=='string'||!markerKey||typeof groundOnly!=='boolean')throw Error('Invalid marked ranged melee attack');
 validateEnemyAttackAnimation(meleeAnimation);validateEnemyAttackAnimation(rangedAnimation);
}
markedRangedMeleeAttack.validate=validateMarked;
