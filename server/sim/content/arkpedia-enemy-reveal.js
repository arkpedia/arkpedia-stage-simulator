// SPDX-License-Identifier: GPL-3.0-or-later
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { bodyInRadius } from '../body.js';

/** An aura owns suppression, not the underlying camouflage/stealth producers.
 * Multiple emitters compose and leaving the final one restores live sources. */
export function visibilityAura({ range }) {
  const clear = (b, a) => {
    for (const [unit, receipt] of a.targets ?? []) if (unit.buffs.includes(receipt.buff)) b.removeBuff(unit, a.key);
    a.targets?.clear();
  };
  const update = (b, e, a) => {
    if (!e.alive || !e.deployed || e.hidden || e.deploySeq !== a.life) { clear(b, a); return; }
    const current = new Set(b.units.filter(u => u.side !== e.side && u.alive && u.deployed && !u.hidden && !u.removed
      && bodyInRadius(u, e.x, e.y, range + ALLY_COLLIDER_RADIUS)));
    for (const [unit, receipt] of a.targets) if (!current.has(unit) || unit.deploySeq !== receipt.life) {
      if (unit.buffs.includes(receipt.buff)) b.removeBuff(unit, a.key);
      a.targets.delete(unit);
    }
    for (const unit of current) if (!a.targets.has(unit) || !unit.buffs.includes(a.targets.get(unit).buff)) {
      const life = unit.deploySeq;
      const buff = b.addBuff(unit, { key: a.key, source: e, flagImmunities: ['stealth', 'camou'],
        admit: () => e.alive && e.deployed && !e.hidden && e.deploySeq === a.life
          && unit.alive && unit.deployed && !unit.hidden && unit.deploySeq === life
          && bodyInRadius(unit, e.x, e.y, range + ALLY_COLLIDER_RADIUS) });
      if (buff) a.targets.set(unit, { life, buff });
    }
  };
  return {
    spawn(b, e, a) {
      a.key = `ab:visibilityAura:${e.id}:${e.deploySeq}`; a.life = e.deploySeq; a.targets = new Map(); update(b, e, a);
      b.on('deploy', () => update(b, e, a), { owner: e });
    },
    tick: update,
    death(_c, b, _e, a) { clear(b, a); },
  };
}
