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

/** A native attack buff that spends the source's own ammunition on arrival:
 * each paid hit adds one permanent flat-stat stack to the target. The source
 * must still be the same live deployment; an empty magazine leaves the hit an
 * ordinary one. Accounts are bound per deployment by `bind`. */
export function ammoHitBuff({ cost, buffKey, mods }) {
  validateAmmoHit({ cost, buffKey, mods });
  const accounts = new WeakMap();
  return {
    bind(e, account) { accounts.set(e, { account, life: e.deploySeq }); },
    impact(b, e, target) {
      const entry = accounts.get(e);
      if (!entry || !e.alive || !e.deployed || e.deploySeq !== entry.life || entry.account.current < cost) return;
      b.addBuff(target, { key: buffKey, source: e, refresh: 'stack', stacks: 1, maxStacks: 1e6, mods: { ...mods }, visible: true });
      entry.account.modify(-cost);
    },
  };
}
export function validateAmmoHit({ cost, buffKey, mods }) {
  if (!Number.isSafeInteger(cost) || cost < 1 || cost > 1024 || typeof buffKey !== 'string' || !buffKey || buffKey.length > 256
    || !mods || typeof mods !== 'object' || Array.isArray(mods) || Object.keys(mods).join() !== 'defFlat'
    || !Number.isFinite(mods.defFlat) || Math.abs(mods.defFlat) > 1e6) throw Error('Invalid ammunition hit buff');
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
