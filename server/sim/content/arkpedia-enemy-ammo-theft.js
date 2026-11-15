// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';

/** The resource check happens on impact. Ordinary trait magazines are not
 * AmmoSkill accounts and therefore do not protect the target from damage. */
export function ammoTheftAttack({ count, speed, lifetime }) {
  return projectileSingleAttack({ speed, lifetime, type: 'phys', noAir: true,
    resolveHit(b, e, unit, { amount, attackId }) {
      if (unit.skill?.consumeAmmo(count) > 0) {
        b.fx('steal', { x: unit.x, y: unit.y, id: unit.id, from: e.id });
      } else {
        b.dealDamage(e, unit, { amount, type: 'phys', isAttack: true, attackId,
          applyWay: 'ranged', tags: ['enemyAmmoTheft'] });
      }
    },
  });
}
