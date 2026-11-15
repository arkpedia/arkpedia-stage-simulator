// SPDX-License-Identifier: GPL-3.0-or-later

/** Standby is disarm plus a separate temporary movement lock, not stun. */
export function standbyRevive({ ratio, speed, unmove, targets }) {
  const wake = (b, e, a) => {
    if (a.done || !e.alive) return;
    a.done = true;
    b.removeBuff(e, 'ab:standby'); b.removeBuff(e, 'ab:standbyBind');
    b.addBuff(e, { key: 'ab:standbySpeed', persist: true, visible: true, mods: { movePct: speed } });
  };
  return {
    spawn(b, e, a) {
      a.done = false; a.nextCheck = b.time;
      e.profile.maxTargets = targets;
      b.addBuff(e, { key: 'ab:standby', persist: true, visible: true, flags: { disarm: true } });
      if (unmove > 0) b.addBuff(e, { key: 'ab:standbyBind', duration: unmove, flags: { noMove: true } });
      if (targets === 2) {
        e.profile.canTarget = u => !u.isFlying;
        // Native damage is direct and has a melee application path despite
        // selecting two targets at range; it is not a homing projectile.
        e.profile.deferHit = true; e.profile.shot = 'arts';
      }
    },
    wake(_c, b, e, a) { wake(b, e, a); },
    tick(b, e, a) {
      if (a.done || b.time + 1e-9 < a.nextCheck) return;
      a.nextCheck += .2;
      if (e.hpRatio < ratio) wake(b, e, a);
    },
    attack(c, b, e) {
      if (targets !== 2) return;
      for (const u of c.targets) b.dealDamage(e, u, { amount: e.s.atk, type: 'arts', isAttack: true,
        attackId: b._attackSeq, applyWay: 'melee', tags: ['sarkazGrudge'] });
    },
  };
}

export function sentinelAlarm({ ratio, atk, def, initialCooldown, leader }) {
  const finish = (b, e, a) => {
    a.finished = true; e.skillAnimUntil = b.time;
    b.removeBuff(e, 'ab:alarmCast'); b.removeBuff(e, 'ab:sentinelUndead');
  };
  return {
    spawn(b, e, a) {
      e.profile.noAttack = true; a.nextCheck = b.time;
      b.addBuff(e, { key: 'ab:sentinelUndead', persist: true, flags: { undeadable: true } });
    },
    tick(b, e, a, dt) {
      if (a.finished) return;
      if (!a.alert) {
        if (b.time + 1e-9 < a.nextCheck) return;
        a.nextCheck += .2;
        if (e.hpRatio >= ratio) return;
        a.alert = true; a.readyAt = b.time + initialCooldown;
        if (!leader) b.removeBuff(e, 'ab:sentinelUndead');
        return;
      }
      if (!a.cast) {
        if (b.time + 1e-9 < a.readyAt || !e.canAct || e.s.flags.silence) return;
        a.cast = true; a.elapsed = 0;
        b.addBuff(e, { key: 'ab:alarmCast', flags: { noMove: true } });
        // The cast does not wait for OnAttack. disableOverride gives every
        // alarm its own permanent, additive grant to the current recipients.
        for (const u of b.aliveEnemies()) if (!u.hidden && !u.s.flags.untargetable) {
          b.addBuff(u, { key: `ab:sarkazAlarm:${e.id}`, persist: true, visible: true, mods: { atkPct: atk, defPct: def } });
          b.emit('enemyStandbyWake', { unit: u, source: e });
        }
        b.fx('pulse', { x: e.x, y: e.y, id: e.id, kind: 'sarkazAlarm' });
      } else {
        if (!e.canAct) { finish(b, e, a); return; }
        a.elapsed += dt * e.s.slowDownRate;
      }
      // Original Skill -> Skill_Begin binding, exact 20/30-second clip.
      e.skillAnimUntil = b.time + Math.max(0, 2 / 3 - a.elapsed) / Math.max(.001, e.s.slowDownRate);
      if (a.elapsed + 1e-9 >= 2 / 3) finish(b, e, a);
    },
    status(_c, b, e, a) { if (a.cast && !a.finished && !e.canAct) finish(b, e, a); },
  };
}
