// SPDX-License-Identifier: GPL-3.0-or-later

/** Attack recovery charges a separate, fixed-duration projectile cast. This
 * shares targeting, projectiles, damage and status resistance with the engine. */
export function chargedStatusProjectile({ chargeCost, duration, cooldown, initialCooldown, release, castDuration, speed, lifetime }) {
  const key = 'ab:chargedProjectileCast';
  const finish = (b, e, a) => {
    a.cast = null;
    e.profile.noAttack = false;
    e.skillAnimUntil = b.time;
    e.atkCd = e.s.interval;
    b.removeBuff(e, key);
  };
  return {
    spawn(b, e, a) {
      a.charge = 0; a.readyAt = b.time + initialCooldown;
      const previous = e.profile.canTarget;
      e.profile.canTarget = target => !target.isFlying && (!previous || previous(target));
    },
    before(c, b, e, a) {
      if (a.cast || a.charge < chargeCost || b.time + 1e-9 < a.readyAt || e.s.flags.silence) return;
      const target = c.targets[0];
      if (!target) return;
      a.charge = 0; a.readyAt = b.time + cooldown;
      a.cast = { target, elapsed: 0, last: b.time, launched: false };
      e.profile.noAttack = true;
      b.addBuff(e, { key, flags: { noMove: true } });
      e.skillAnimUntil = b.time + castDuration;
      c.targets = []; // The ordinary attack is replaced, not dealt a second time.
    },
    attack(_c, _b, _e, a) { a.charge = Math.min(chargeCost, a.charge + 1); },
    tick(b, e, a) {
      const cast = a.cast;
      if (!cast) return;
      // Control interrupts the cast. A projectile already released is independent.
      if (e.s.flags.stun || e.hidden) { finish(b, e, a); return; }
      cast.elapsed += (b.time - cast.last) * e.s.slowDownRate;
      cast.last = b.time;
      e.skillAnimUntil = b.time + Math.max(0, castDuration - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
      if (!cast.launched && cast.elapsed + 1e-7 >= release) {
        cast.launched = true;
        const snapshot = e.s.atk;
        b._ev(['atk', e.id, cast.target.id, 'enemy']);
        b.addProjectile({ from: e, target: cast.target, speed, maxAge: lifetime, source: e, visual: 'enemy',
          onHit({ target }) {
            if (!target?.alive || !target.deployed || target.hidden) return;
            b.dealDamage(e, target, { amount: e.alive ? e.s.atk : snapshot, type: 'phys',
              isSkill: true, applyWay: 'ranged', tags: ['enemyAbility', 'chargedStatusProjectile'] });
            if (target.alive) b.applyStatus(target, 'stun', { duration, source: e, sourceStatusResistable: 2 });
          } });
      }
      if (cast.elapsed + 1e-7 >= castDuration) finish(b, e, a);
    },
    status(_c, b, e, a) { if (a.cast && e.s.flags.stun) finish(b, e, a); },
  };
}
