// SPDX-License-Identifier: GPL-3.0-or-later
import { enemyAmmo } from './arkpedia-enemy-ammo.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { remainingRoute, spawnChildren } from './arkpedia-enemy-spawn.js';
import { areaSelectable } from '../targeting.js';

export function ammoSummoner({ max, initial, cooldown, initialCooldown, child, meleeScale, windup, castTime }) {
  const shot = projectileSingleAttack({ speed: 5, lifetime: 10, type: 'phys', noAir: true });
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, 'ab:vendorCast');
  };
  return {
    cd: cooldown, icd: initialCooldown, affectedBySlowDown: true,
    spawn(b, e, a) { shot.spawn(b, e); a.account = e.mem.enemyAmmo = enemyAmmo(max, initial); },
    cond(_b, e, a) { return !a.cast && e.canAct && a.account.current >= 1; },
    fire(b, e, a) {
      a.account.modify(-1);
      a.cast = { elapsed: 0, released: false }; e.profile.noAttack = true;
      b.addBuff(e, { key: 'ab:vendorCast', flags: { noMove: true } });
      e.skillAnimUntil = b.time + castTime;
    },
    tick(b, e, a, dt) {
      if (!a.cast) return;
      if (!e.canAct) { finish(b, e, a); return; }
      a.cast.elapsed += dt * e.s.slowDownRate;
      if (!a.cast.released && a.cast.elapsed + 1e-9 >= windup) {
        a.cast.released = true;
        const route = remainingRoute(e), pos = [e.y, e.x];
        // Once released, the native scheduler owns the delayed summon.
        b.after(.1, () => spawnChildren(b, e, child, 1, { route, pos }), { holdsBattle: true });
      }
      e.skillAnimUntil = b.time + Math.max(0, castTime - a.cast.elapsed) / Math.max(.001, e.s.slowDownRate);
      if (a.cast.elapsed + 1e-9 >= castTime) finish(b, e, a);
    },
    status(_c, b, e, a) { if (a.cast && !e.canAct) finish(b, e, a); },
    attack(c, b, e) {
      if (!e.blockedBy) { shot.attack(c, b, e); return; }
      for (const target of c.targets) b.dealDamage(e, target, { amount: e.s.atk * meleeScale, type: 'phys',
        isAttack: true, attackId: b._attackSeq, applyWay: 'melee', tags: ['enemyVendorCombat'] });
    },
  };
}

export function blockedCartBlast({ damage, deviceDamage, element, range, windup }) {
  const arm = (e, a) => { if (e.blockedBy && !e.s.flags.silence) a.armed = true; };
  const finish = (b, e, a) => { a.cast = null; e.profile.noAttack = false; b.removeBuff(e, 'ab:cartCast'); };
  const explode = (b, e) => {
      const keys = new Set(range.map(([r, c]) => `${Math.round(e.y) + r},${Math.round(e.x) + c}`));
      const targets = new Set(b.allies(null, { includeTargetableDevices: true }).filter(u => !u.isFlying
        && areaSelectable(e, u) && keys.has(`${Math.round(u.y)},${Math.round(u.x)}`)));
      // The original separate Blockee action includes the blocker even when
      // the area selector would reject its motion or position.
      if (e.blockedBy?.alive && e.blockedBy.deployed) targets.add(e.blockedBy);
      for (const u of targets) {
        const station = u.tags.has('TAG_TRAP_WPNSTS');
        b.dealDamage(e, u, { amount: station ? deviceDamage : damage, type: 'arts', canDodge: false,
          isAttack: true, isSplash: true, applyWay: 'none', tags: ['enemyCartBlast'] });
        // Original AlwaysNext separates fixed elemental damage from the HP
        // result. BUFF_OWNER is the recipient of this derived buff.
        if (!station && u.alive) b.dealDamage(u, u, { amount: element, type: 'element', element: 'burn', tags: ['enemyCartBlast'] });
      }
      b.fx('explode', { x: e.x, y: e.y, r: 1.5, kind: 'arts' });
      b.kill(e, e);
  };
  return {
    spawn(_b, e, a) { e.profile.deferHit = true; e.profile.shot = 'none'; e.profile.dmgType = 'phys'; a.armed = false; a.check = 0; },
    tick(b, e, a, dt) {
      a.check += dt;
      if (a.check + 1e-9 >= .1) { a.check -= .1; arm(e, a); }
      if (!a.cast) return;
      if (!e.canAct) { finish(b, e, a); return; }
      if (a.cast.startedAt === b.time) return;
      a.cast.elapsed += dt * e.s.slowDownRate;
      if (a.cast.elapsed + 1e-9 >= windup) { finish(b, e, a); explode(b, e); }
    },
    status(_c, b, e, a) { if (a.cast && !e.canAct) finish(b, e, a); },
    before(_c, _b, e, a) { arm(e, a); },
    attack(c, b, e, a) {
      if (!a.armed) {
        for (const target of c.targets) b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true,
          attackId: b._attackSeq, applyWay: 'melee', tags: ['enemyCartCombat'] });
        return;
      }
      a.cast = { elapsed: 0, startedAt: b.time }; e.profile.noAttack = true;
      b.addBuff(e, { key: 'ab:cartCast', flags: { noMove: true } });
    },
  };
}
