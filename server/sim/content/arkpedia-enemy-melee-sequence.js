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
