// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { addCorruptionField } from './arkpedia-corruption.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

/** A travelling pollution carrier owns its field until interception or expiry.
 * Arrival stops motion while the source lifespan continues from emission. */
export function movingCorruptionProjectile(b, source, target, p) {
  let arrived = false;
  const projectile = b.addProjectile({ source, from: source, target, speed: p.speed,
    maxAge: p.life, hitDead: true, visual: 'lob', data: { witherTankPollution: true },
    advanceMotion: ({ projectile: shot, dt, speedScale, expires }) => {
      if (expires) return { x: shot.x, y: shot.y, reached: true };
      const dx = shot.tx - shot.x, dy = shot.ty - shot.y, distance = Math.hypot(dx, dy);
      if (distance <= p.speed * speedScale * dt) arrived = true;
      if (arrived) { shot.target = null; return { x: shot.tx, y: shot.ty, reached: false }; }
      return { x: shot.x + dx / distance * p.speed * speedScale * dt,
        y: shot.y + dy / distance * p.speed * speedScale * dt, reached: false };
    } });
  const remove = addCorruptionField(b, source, { low: p.low, high: p.high,
    until: b.time + p.life,
    eligible: u => u.alive && u.deployed && !u.hidden && u.kind !== 'device' && u.def.profession !== 'TRAP',
    contains: u => !projectile.removed && Math.hypot(u.x - projectile.x, u.y - projectile.y) <= p.radius + ALLY_COLLIDER_RADIUS });
  const off = b.on('tick', () => {
    if (projectile.removed || projectile.age >= p.life) { remove(); b.off(off); }
  });
  return projectile;
}

export function witherTank(p) {
  const shot = projectileSingleAttack({ speed: 4, lifetime: 20, type: 'phys', noAir: true });
  const marker = (b, e, a) => {
    if (a.sp >= p.cost && !e.findBuff('nhtank_s_effect')) b.addBuff(e, { key: 'nhtank_s_effect', persist: true });
    if (a.sp < p.cost) b.removeBuff(e, 'nhtank_s_effect');
  };
  return {
    spawn(b, e, a) {
      shot.spawn(b, e); a.sp = p.initial;
      e.def = { ...e.def, attackAnim: p.rangedAnim };
      e.profile.canTarget = t => e.blockedBy ? t === e.blockedBy
        : !t.isFlying && !t.s.flags.liftoff && b.grid.isLow(t.tileR, t.tileC);
      marker(b, e, a);
    },
    before(_c, _b, e) {
      e.profile.attackVisual = e.blockedBy ? 'Attack2' : 'Attack';
      e.def.attackAnim = e.blockedBy ? p.meleeAnim : p.rangedAnim;
    },
    attack(c, b, e, a) {
      if (e.blockedBy) {
        const t = c.targets.find(t => t === e.blockedBy);
        if (t) b.dealDamage(e, t, { amount: e.s.atk * p.meleeScale, type: 'phys', isAttack: true,
          attackId: b._attackSeq, applyWay: 'melee' });
        a.sp = Math.min(p.cost, a.sp + p.increment);
      } else {
        const charged = a.sp >= p.cost;
        a.sp = charged ? a.sp - p.cost : Math.min(p.cost, a.sp + p.increment);
        shot.attack(c, b, e);
        if (charged) for (const t of c.targets) movingCorruptionProjectile(b, e, t, p);
      }
      marker(b, e, a);
    },
  };
}
