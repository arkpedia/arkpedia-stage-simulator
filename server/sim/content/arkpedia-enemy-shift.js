// SPDX-License-Identifier: GPL-3.0-or-later
// One reusable state-conditioned periodic damage controller. The native parent
// polls UNBALANCED; the child waits one interval before its first damage tick.
// Both inherit the talent interval. Polls win ties with damage in this engine.
export function unbalancedPeriodicDamage({ damage, interval }) {
  return {
    spawn(b, e, a) { a.pollAt = b.time + interval; a.damageAt = Infinity; },
    tick(b, e, a, dt) {
      if (!b.regularDisplacement) throw Error('Unbalanced damage requires continuous regular-stage displacement');
      const end = b.time + dt;
      for (let n = 0; n < 4 && e.alive; n++) {
        const at = Math.min(a.pollAt, a.damageAt);
        if (at > end + 1e-9) break;
        if (a.pollAt <= a.damageAt + 1e-9) {
          a.pollAt += interval;
          if (e.mem.regularShift && !e.hidden) {
            if (!Number.isFinite(a.damageAt)) a.damageAt = at + interval;
          } else a.damageAt = Infinity;
        } else {
          a.damageAt += interval;
          b.dealDamage(null, e, { amount: damage, type: 'true', sourceless: true, canDodge: false,
            unmodified: true, noSp: true, tags: ['dot', 'periodic', 'unbalanced-bleed'] });
        }
      }
    },
  };
}
