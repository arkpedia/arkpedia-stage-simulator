// SPDX-License-Identifier: GPL-3.0-or-later
// Native Attack targets marked NEUTRAL units; Combat attacks the blocker.
import { canTargetAlly } from '../targeting.js';
import review from '../../../data/candidates/arkpedia-ch16-reviewed-patrol.json' with { type: 'json' };
export function patrolCaptain(r) {
  if (r.key !== review.enemy.key || r.prefabKey !== review.enemy.prefabKey) throw Error('Unreviewed Patrol Captain identity');
  return {
    spawn(b, e) {
      e.profile.deferHit = true; e.base.rangeRadius = review.defaults.radius; e.markDirty();
      e.profile.attackCooldowns = { attack: 0, combat: 0 };
      e.profile.attackMode = () => {
        e.profile.melee = !!e.blockedBy;
        return e.blockedBy ? 'combat' : 'attack';
      };
      e.profile.canTarget = u => e.blockedBy ? u === e.blockedBy
        : u.alive && u.deployed && !u.hidden && u.profile?.neutral && !!u.findBuff('mark_neutral[effect]')
          && !u.isFlying && canTargetAlly(e, u, true)
          && Math.hypot(u.x - e.x, u.y - e.y) <= review.defaults.radius + (u.mem.ch16BodyRadius ?? .1) + 1e-9;

    },
    attack(c, b, e) {
      for (const target of c.targets) {
        const hit = (u, applyWay) => b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true,
          canDodge: true, applyWay, tags: ['chapter16'] });
        if (target === e.blockedBy) hit(target, 'melee');
        else b.addProjectile({ from: e, target, source: e, speed: review.defaults.projectileSpeed,
          maxAge: review.defaults.projectileLife, onHit: c => { if (c.target) hit(c.target, 'ranged'); } });
      }
    },
  };
}
