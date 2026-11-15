// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { areaSelectable } from '../targeting.js';

/** One kit for every database level and the legacy catalogue. Values come from
 * the record; native admission owns the projectile, selectors and templates. */
export function pompeii({ burnDamage, burnDuration, burnInterval, blastDamage, blastInterval, hpRatio, aspd }) {
  const syncHp = (b, e) => {
    const active = e.hp / e.s.maxHp <= hpRatio;
    if (active && !e.findBuff('ab:lowhp')) b.addBuff(e, { key: 'ab:lowhp', persist: true, visible: true, mods: { aspd } });
    else if (!active) b.removeBuff(e, 'ab:lowhp');
  };
  return [
    projectileSingleAttack({ speed: 6, lifetime: 5, type: 'arts', noAir: true,
      onImpact(b, e, unit) {
        b.addBuff(unit, { key: 'ab:burnDot', duration: burnDuration, refresh: 'extend', interval: burnInterval, visible: true,
          onTick: ({ battle, unit: target }) => battle.dealDamage(null, target, { amount: burnDamage, type: 'arts',
            sourceless: true, noSp: true, canDodge: false, ignoreSelect: true, tags: ['dot', 'periodic', 'pompeiiBurn'] }) });
      } }),
    { spawn(b, e) { e.profile.maxTargets = 4; syncHp(b, e); }, tick: syncHp, taken(_c, b, e) { syncHp(b, e); } },
    { unblocked(_c, _b, _e, a) { a.held = 0; },
      tick(b, e, a, dt) {
        if (!e.blockedBy) { a.held = 0; return; }
        if (!e.canAct) return;
        a.held = (a.held ?? 0) + dt;
        if (a.held + 1e-9 < blastInterval) return;
        a.held -= blastInterval;
        b.fx('explode', { x: e.x, y: e.y, r: 1.4, kind: 'selfBlast' });
        for (const u of b.alliesInRadius(e.x, e.y, 1.4)) if (!u.isFlying && areaSelectable(e, u))
          b.dealDamage(e, u, { amount: blastDamage, type: 'arts', canDodge: false, isSkill: true,
            isSplash: true, tags: ['splash', 'pompeiiBlast'] });
      } },
  ];
}
