// SPDX-License-Identifier: GPL-3.0-or-later
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { addCorruptionField } from './arkpedia-corruption.js';

/** Native level progress is mapped to resolved counted enemies. Branch bodies
 * have no counter credit. Ordinary entry-point Rot Eaters retain full stats. */
export function countedLevelProgress(b) {
  return b.total > 0 ? Math.min(1, (b.killed + b.leakedCount) / b.total) : 1;
}
export function rotEater({ low, high, radius, guaranteed, max }) {
  return {
    spawn(b, e, a) {
      const progress = countedLevelProgress(b);
      const scale = e.mem.stageBranch && progress < 1 ? Math.max(guaranteed, Math.min(max, progress)) : 1;
      e.mem.rotEaterBirthScale = scale;
      b.addBuff(e, { key: 'ab:rotEaterBirth', persist: true,
        mods: { hpMul: scale, atkMul: scale, defMul: scale } });
      e.hp = e.s.maxHp;
      a.removeField = addCorruptionField(b, e, { low, high,
        contains: u => e.alive && e.deployed && !e.hidden && Math.hypot(u.x - e.x, u.y - e.y) <= radius + ALLY_COLLIDER_RADIUS + 1e-9 });
    },
    death(_c, _b, _e, a) { a.removeField?.(); },
  };
}
