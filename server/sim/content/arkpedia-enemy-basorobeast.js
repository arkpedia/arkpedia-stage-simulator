// SPDX-License-Identifier: GPL-3.0-or-later
// Basorobeast and Gravorobeast (enemy_1307_mhrhcr[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-basorobeast-features.js).
// The Weakness DamageScale uses the common conditional Sanctuary channel (server/sim/damage.js sourceSanctuaryRatio):
// Physical and Arts damage whose source stands in a column strictly ahead of the beast's facing is scaled by
// 1 - reduction. The facing (e.mem.nativeFacing, also the sprite's) follows its own horizontal movement and turns to the
// target when it attacks; vertical legs and waits keep it.
import { spriteFacing } from '../../../shared/arkpedia/facing.js';

const pos = v => Number.isFinite(v) && v > 0;

export function rearWeakness(p) {
  if (!(p?.reduction > 0 && p.reduction <= 1) || !pos(p.attackAnim?.dur) || !pos(p.attackAnim.hit) || p.attackAnim.hit > p.attackAnim.dur)
    throw Error('Invalid Basorobeast parameters');
  return {
    spawn(b, e, a) {
      e.def = { ...e.def, attackAnim: p.attackAnim };
      // Face the first horizontal route segment, as the sprite does before its first step.
      e.mem.nativeFacing = spriteFacing({ ...e, mem: {} });
      a.px = e.x;
      b.addBuff(e, { key: 'ab:basorobeastWeakness', persist: true, status: 'sanctuary',
        data: { frontSourceSanctuary: p.reduction } });
      b.on('beforeAttack', ({ attacker, targets }) => {
        if (attacker !== e || !targets?.[0]) return;
        const dx = targets[0].x - e.x;
        if (Math.abs(dx) > 1e-8) e.mem.nativeFacing = Math.sign(dx);
      }, { owner: e });
    },
    tick(b, e, a) {
      const dx = e.x - a.px; a.px = e.x;
      if (e.moving && Math.abs(dx) > 1e-8) e.mem.nativeFacing = Math.sign(dx);
    },
  };
}
