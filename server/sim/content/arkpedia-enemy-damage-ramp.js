// SPDX-License-Identifier: GPL-3.0-or-later
import { enemyAttackTargets } from '../targeting.js';

/** Damage-driven stacks; the rest timer measures disengagement, not attack interval. */
export function stackingDamageRamp({ atkPct, aspd, maxStacks, resetAfter, key = 'ab:axeStack' }) {
  return {
    output(_c, b, e) {
      if (!e.alive) return;
      b.addBuff(e, { key, refresh: 'stack', stacks: 1, maxStacks, persist: true,
        visible: true, mods: { atkPct, aspd } });
    },
    tick(b, e, a, dt) {
      const f = e.s.flags, p = e.profile;
      const radius = (p?.melee ?? e.def.applyWay === 'MELEE') ? 0 : e.base.rangeRadius;
      const engaged = e.canAct && !e.hidden && !p?.noAttack && !f.disarm && !f.fear
        && !(f.tremble && e.blockedBy) && enemyAttackTargets(b, e, radius).length > 0;
      a.idle = engaged ? 0 : (a.idle ?? 0) + dt;
      if (a.idle + 1e-9 >= resetAfter) b.removeBuff(e, key);
    },
  };
}
