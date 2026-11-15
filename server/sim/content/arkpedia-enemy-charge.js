// SPDX-License-Identifier: GPL-3.0-or-later
/** Lancer's shared source behavior: acceleration is active while unblocked,
 * including route waits. A connected ordinary hit adds a separate damage packet
 * from CURRENT movement speed, then clears acceleration. This is not an ATK buff. */
export function lancerCharge({ increase, interval, limit, damagePerSpeed, predelay = 0 }) {
  const stop = (b, e, a) => {
    a.active = false; a.stacks = 0; a.elapsed = 0; a.triggers = 0;
    b.removeBuff(e, 'ab:rush');
  };
  return {
    iv: .1,
    spawn(b, _e, a) { a.active = true; a.stacks = 0; a.elapsed = 0; a.triggers = 0; a.readyAt = b.time + predelay; },
    tick(b, e, a, dt) {
      // The source checks STUNNED and UNMOVABLE. Frozen shares the engine's
      // action-stop flag but is not by itself the source's STUNNED status.
      const stunned = e.buffs.some(buff => buff.flags?.stun && !buff.flags?.freeze);
      if (stunned || e.s.flags.noMove) { stop(b, e, a); return; }
      if (!a.active) {
        if (e.blockedBy) return;
        a.active = true; a.elapsed = 0;
        return;
      }
      a.elapsed += dt;
      while (a.elapsed + 1e-9 >= interval && a.triggers < limit) {
        a.elapsed -= interval; a.triggers++;
        // The original trigger still fires while its birth-time predelay buff
        // suppresses CreateBuff. Those attempts consume the trigger budget.
        // Expiry at the same tick is resolved after that trigger, matching the
        // stage's 170-second / 365-attempt allocation of 25 speed additions.
        if (b.time - a.elapsed <= a.readyAt + 1e-9) continue;
        a.stacks++;
        b.addBuff(e, { key: 'ab:rush', mods: { movePct: increase * a.stacks }, persist: true });
      }
    },
    dealt(c, b, e, a) {
      if (!a.active || !c.dmg?.isAttack || c.dmg.tags?.includes('lancerCharge')) return;
      const amount = e.s.moveSpeed * damagePerSpeed;
      stop(b, e, a);
      if (c.target?.alive && amount > 0) b.dealDamage(e, c.target, { amount, type: 'phys',
        isAttack: true, applyWay: 'melee', noSp: true, tags: ['lancerCharge'] });
    },
  };
}
