// SPDX-License-Identifier: GPL-3.0-or-later
import { layeredBarrier } from './arkpedia-enemy-barriers.js';
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
import { projectileSingleAttack, inProjectileBox } from './arkpedia-enemy-projectiles.js';
import { canTargetAlly, areaSelectable, sortAllyTargets } from '../targeting.js';

export function ratKing(p, ab) {
  const barrier = layeredBarrier({ layers: 3, amount: p.shield, defense: p.defense, type: 'arts' });
  const shot = projectileSingleAttack({ speed: p.speed, lifetime: 10, type: 'arts', noAir: true });
  const eligible = (b, e) => sortAllyTargets(e, b.allies(null, { includeTargetableDevices: true })
    .filter(u => !u.isFlying && canTargetAlly(e, u, true)));
  const choose = (b, e, high) => eligible(b, e).sort((a, z) => (high ? -1 : 1) * (a.s.maxHp - z.s.maxHp)).slice(0, 1);
  const cast = (spec, high) => ({ ...spec, select: (b, e) => choose(b, e, high), fire(b, e) {
    const target = choose(b, e, high)[0]; if (!target) return;
    const center = { x: target.x, y: target.y }, sourceLife = e.deploySeq;
    const retiredScale = e.s.dmgDealtMul * (e.hpRatio < p.threshold ? p.enrage : 1);
    const damage = (u, amount, type, noSp) => {
      const live = e.alive && e.deployed && e.deploySeq === sourceLife;
      b.dealDamage(live ? e : null, u, { amount: amount * (live ? 1 : retiredScale), type,
        isAttack: false, isSkill: true, isSplash: high, canDodge: false, applyWay: 'none', noSp,
        tags: [high ? 'ratKingCross' : 'ratKingSand'] });
    };
    if (high) {
      b.addProjectile({ from: center, to: center, source: e, visual: 'none', maxAge: 10, onHit() {
        b.fx('explode', { ...center, r: 3, tiles: 'plus', kind: 'ratKingCross' });
        for (const u of b.allies(null, { includeTargetableDevices: true }))
          if (areaSelectable(e, u) && (inProjectileBox(u, center.x, center.y, 7, 1)
            || inProjectileBox(u, center.x, center.y, 1, 7))) damage(u, p.crossDamage, 'phys', true);
      } });
      return;
    }
    const pulse = () => {
      for (const u of b.allies(null, { includeTargetableDevices: true })) {
        if (!canTargetAlly(e, u, true) || !inProjectileBox(u, center.x, center.y, 3, 3)) continue;
        damage(u, p.sandDamage, 'arts', false);
        if (u.alive && u.deployed) b.addBuff(u, { key: 'ab:ratKingAtkDown', duration: p.debuffDuration,
          refresh: 'keep', visible: true, sourceStatusResistable: false, mods: { atkMul: 1 + p.atkDown } });
      }
    };
    let next = 1;
    b.addProjectile({ from: center, to: center, source: e, visual: 'none', maxAge: p.fieldDuration,
      data: { ratKingSand: true }, advanceMotion({ projectile, expires }) {
        while (next < p.fieldDuration && projectile.age + 1e-9 >= next) { pulse(); next++; }
        return { ...center, reached: expires };
      } });
    b.fx('telegraph', { ...center, r: 1, tiles: 'box', dur: p.fieldDuration, kind: 'ratKingSand' });
    pulse();
  } });
  const casts = timedEnemyCasts([cast(p.cross, true), cast(p.sand, false)].sort((a, z) => z.priority - a.priority || a.order - z.order), { silenceable: false });
  const marked = [null, null];
  const mark = (b, e, i, target) => {
    const key = `ab:ratKingMark:${e.id}:${i}`;
    if (target === marked[i]) return;
    if (marked[i]) b.removeBuff(marked[i], key);
    marked[i] = target;
    if (target) b.addBuff(target, { key, source: e, visible: true, data: { ratKingMark: i ? 'highestHp' : 'lowestHp' } });
  };
  return { ...casts,
    spawn(b, e, a) {
      barrier.spawn(b, e); shot.spawn(b, e); casts.spawn(b, e, a); (ab.immune ??= new Set()).add('sleep');
      e.def = { ...e.def, attackAnim: p.attackAnim }; a.markAt = b.time + p.markInitial;
      e.mem.ratKing = a;
    },
    attack: shot.attack,
    hitOut(c, _b, e) { if (e.hpRatio < p.threshold && !e.s.flags.silence) c.dmg.amount *= p.enrage; },
    tick(b, e, a, dt) {
      casts.tick(b, e, a, dt);
      if (b.time + 1e-9 < a.markAt || !e.canAct) return;
      for (let i = 0; i < 2; i++) mark(b, e, i, choose(b, e, !!i)[0] ?? null);
    },
    death(c, b, e, a) { casts.death(c, b, e, a); for (let i = 0; i < 2; i++) mark(b, e, i, null); },
  };
}
