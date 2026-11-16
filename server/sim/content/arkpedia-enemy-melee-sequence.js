// SPDX-License-Identifier: GPL-3.0-or-later
import {configureMarkedEnemyTargets,validateMarkedEnemyTargets} from './arkpedia-enemy-marked-targets.js';
import { ordinaryEnemyAttackSequence,validateEnemyAttackAnimation } from './arkpedia-enemy-attack-sequence.js';
export function ordinaryMeleeSequence(select,type='phys') {
  return ordinaryEnemyAttackSequence(select, (b, e, u, c) =>
    b.dealDamage(e, u, { amount: e.s.atk, type, isAttack: true, isSkill: false,
      attackId: c.attackId, applyWay: 'melee', tags: ['ordinaryMeleeSequence'] }));
}

/** A data-only ordinary melee cast: one shared transport and marker clock. */
export function animatedMeleeAttack({animation,type='phys'}){
  validateMelee({animation,type});
  return ordinaryMeleeSequence(()=>animation,type);
}
function validateMelee({animation,type='phys'}){validateEnemyAttackAnimation(animation);if(!['phys','arts','true'].includes(type))throw Error('Invalid animated melee damage type');}
animatedMeleeAttack.validate=validateMelee;

/** Ordinary blocker melee plus a marker-filtered ranged direct-hit mode. Both
 * use the same captured-target receipts, damage path and animation clocks. */
export function markedRangedMeleeAttack(params){
 validateMarked(params);const {meleeAnimation,rangedAnimation}=params;
 const sequence=ordinaryMeleeSequence((_b,e,_a,c)=>c.targets[0]===e.blockedBy?meleeAnimation:rangedAnimation);
 return{...sequence,spawn(b,e,a){
  sequence.spawn(b,e,a);configureMarkedEnemyTargets(e,params);
 }};
}
function validateMarked(params){
 const {meleeAnimation,rangedAnimation}=params;validateMarkedEnemyTargets(params);
 validateEnemyAttackAnimation(meleeAnimation);validateEnemyAttackAnimation(rangedAnimation);
}
markedRangedMeleeAttack.validate=validateMarked;
