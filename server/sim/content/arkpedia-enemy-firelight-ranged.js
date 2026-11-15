// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack, projectileBoxAttack, chargedAttacks } from './arkpedia-enemy-projectiles.js';
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

export function cannoneer({ attackAnim, initialSp, cost, increment, maxSp }) {
  const normal = projectileSingleAttack({ speed: 5, lifetime: 10, type: 'phys' });
  const splash = projectileBoxAttack({ speed: 5, lifetime: 10, width: 3, height: 3 });
  const attacks = chargedAttacks(normal, splash, { initialSp, cost, increment, maxSp });
  return { ...attacks, spawn(b, e, a) { attacks.spawn(b, e, a); e.def = { ...e.def, attackAnim }; } };
}

export function flamecaller({ attackAnim, radius, delay, scale }) {
  const shot = projectileSingleAttack({ speed: 10, lifetime: 5, type: 'arts',
    // ON_HIT_TILE is independent of HP damage acceptance and target survival.
    onTileImpact(b, _e, { x, y }) { b.stageReeds?.ignite(Math.round(y), Math.round(x)); },
  });
  return {
    ...shot,
    spawn(b, e) { shot.spawn(b, e); e.def = { ...e.def, attackAnim }; },
    death(c, b, e) {
      if (c.reason !== 'killed') return;
      const x = Math.round(e.x), y = Math.round(e.y), amount = e.s.atk * scale;
      // The source-root-tile projectile reaches at its original lifetime. It
      // persists after its owner dies and selects units and tiles separately.
      b.after(delay, () => {
        b.fx('explode', { x, y, r: radius, kind: 'flamecaller' });
        for (const unit of b.allies(null, { includeTargetableDevices: true })) {
          if (!areaSelectable(e, unit) || unit.isFlying || Math.hypot(unit.x - x, unit.y - y) > radius + ALLY_COLLIDER_RADIUS + 1e-9) continue;
          b.dealDamage(e, unit, { amount, type: 'arts', isSplash: true, applyWay: 'none', tags: ['flamecallerDeath'] });
        }
        b.stageReeds?.igniteNear(x, y, radius);
      }, { holdsBattle: true });
    },
  };
}
