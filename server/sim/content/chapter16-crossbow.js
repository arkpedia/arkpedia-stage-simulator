// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate mobile crossbowman controller. Retained-source review is separate
// from this implementation; importing it never admits an enemy or stage.
const live = u => u?.alive && u.deployed && !u.hidden;
// The test-only contract uses centers for direct radius queries, separately
// from the weapon collision selector. Original collider-edge parity is unverified.
export function mobileCrossbow(r) {
  const bb = r.talents.bb, prefix = 'ExtraPowerListener.';
  const radius = bb[prefix + 'radius_1'], orderedRadius = bb[prefix + 'radius_2'];
  const scale = bb[prefix + 'attack@atk_scale_2'];
  if (![radius, orderedRadius, scale].every(v => Number.isFinite(v) && v > 0)) throw Error('Invalid native crossbowman parameters');
  return {
    spawn(b, e, a) {
      a.scan = 0; a.ranged = false;
      e.profile.melee = true; e.profile.deferHit = true;
      e.profile.attackCooldowns = { attack: 0, combat: 0 };
      e.profile.attackMode = () => {
        e.profile.melee = !!e.blockedBy;
        return e.blockedBy ? 'combat' : 'attack';
      };
      e.profile.canTarget = u => (e.blockedBy ? u === e.blockedBy : a.ranged) && !u.isFlying && !u.s.flags.liftoff;
      b.addBuff(e, { key: 'enemy_field_army_self_mark', persist: true });
    },
    tick(b, e, a, dt) {
      a.scan += dt;
      while (a.scan >= .1 - 1e-9) {
        a.scan -= .1;
        const ordered = !!e.findBuff('enemy_uacomd_extra_power');
        const reach = ordered ? orderedRadius : radius;
        // ALLY is the absolute player side, not the enemy owner's side.
        // The second native query separately names marked NEUTRAL miners.
        a.ranged = ![...b.allyUnits, ...b.enemies.filter(u => u.profile?.neutral && u.findBuff('enemy_mcreep_self_mark'))]
          .some(u => live(u)
          && Math.hypot(u.x - e.x, u.y - e.y) <= reach + 1e-9);
        if (ordered && !e.findBuff('uacomd_t[extra_effect]')) b.addBuff(e, { key: 'uacomd_t[extra_effect]', persist: true });
        else if (!ordered) b.removeBuff(e, 'uacomd_t[extra_effect]');
        if (a.ranged && !e.findBuff('uasnip_no_ally_nearby_able_attack'))
          b.addBuff(e, { key: 'uasnip_no_ally_nearby_able_attack', persist: true });
        else if (!a.ranged) b.removeBuff(e, 'uasnip_no_ally_nearby_able_attack');
      }
    },
    attack(c, b, e) {
      for (const target of c.targets) {
        const hit = (t, factor, applyWay) => b.dealDamage(e, t, { amount: e.s.atk * factor,
          type: 'phys', isAttack: true, canDodge: true, applyWay, tags: ['chapter16'] });
        if (e.blockedBy === target) hit(target, 1, 'melee');
        else b.addProjectile({ from: e, target, source: e, speed: 10, maxAge: 10,
          onHit: c => { if (c.target) hit(c.target, scale, 'ranged'); } });
      }
    },
  };
}
