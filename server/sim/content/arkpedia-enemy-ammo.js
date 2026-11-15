// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack, projectileBoxAttack, taggedArtsBonus } from './arkpedia-enemy-projectiles.js';

/** A bounded enemy ammunition account, reusable by future native reloaders. */
export function enemyAmmo(max, initial) {
  if (!Number.isSafeInteger(max) || max < 1 || !Number.isFinite(initial)) throw Error('Invalid enemy ammunition account');
  let current = Math.max(0, Math.min(max, initial)), gained = 0;
  return { max, get current() { return current; }, get gained() { return gained; },
    modify(delta) {
      if (!Number.isFinite(delta)) throw Error('Invalid enemy ammunition adjustment');
      const before = current; current = Math.max(0, Math.min(max, current + delta));
      gained += Math.max(0, current - before);
      return current - before;
    } };
}

export function ammoAttack({ max, initial, type, lifetime, meleeWhenEmpty, damageScale, elementRatio,
  rangedOnlyWithAmmo = false, area = null, bonus = null, disarmDuration = 0 }) {
  const normal = projectileSingleAttack({ speed: 10, lifetime, type, noAir: true, meleeWhenBlocked: meleeWhenEmpty });
  const powered = (area ? projectileBoxAttack : projectileSingleAttack)({ speed: 10, lifetime, type,
    noAir: !area, ...area, damageScale,
    element: elementRatio > 0 ? { type: 'burn', ratio: elementRatio } : null,
    onImpact: bonus ? taggedArtsBonus(bonus) : null,
    onAcceptedImpact: disarmDuration > 0 ? (b, e, u) => {
      // One original compound buff is represented by ordinary status handles.
      // Either cleansing path removes the pair; each status retains immunity
      // and beforeStatus admission through the common pipeline.
      const keys = ['disarmed', 'disarmed:silence'];
      for (const [i, status] of ['disarm', 'silence'].entries()) b.applyStatus(u, status, {
        key: keys[i], source: e, duration: disarmDuration * (1 - b.resistOf(u)), resistApplied: true,
        sourceStatusResistable: true, onBuffRemove: () => b.removeBuff(u, keys[1 - i]),
      });
    } : null });
  return {
    iv: .1,
    spawn(b, e, a) {
      normal.spawn(b, e); a.account = e.mem.enemyAmmo = enemyAmmo(max, initial);
      if (rangedOnlyWithAmmo) e.profile.melee = true;
      if (disarmDuration > 0) {
        e.profile.targetPriority = 'withoutBuff'; e.profile.priorityBuff = 'disarmed';
      }
    },
    tick(b, e, a) {
      if (rangedOnlyWithAmmo && !e.blockedBy && !(e.atkStandUntil > b.time)) e.profile.melee = a.account.current < 1;
    },
    before(_c, _b, _e, a) { a.powered = a.account.current >= 1; },
    attack(c, b, e, a) {
      // Select before the attack. Payload owns that mode even after expenditure
      // or a later reload; a projectile already born survives its source.
      (a.powered ? powered : normal).attack(c, b, e);
      if (a.powered) a.account.modify(-1);
    },
  };
}
