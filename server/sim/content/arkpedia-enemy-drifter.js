// SPDX-License-Identifier: GPL-3.0-or-later
// Toxocellular and Allotropic Drifters (enemy_1435_dsflys[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-drifter-features.js).
import { animatedProjectileAttack } from './arkpedia-enemy-projectiles.js';
import { elem } from './arkpedia-enemy-effects.js';

export function drifter(p) {
  if (!(p?.neural >= 0) || !(p.speed > 0) || !(p.lifetime > 0)) throw Error('Invalid Drifter parameters');
  const { neural, ...transport } = p;
  const shot = animatedProjectileAttack(transport);
  return {
    ...shot,
    spawn(b, e, a) {
      shot.spawn(b, e, a);
      // dsflys_immune: UNBALANCE_IMMUNE, never shifted.
      b.addBuff(e, { key: 'dsflys_immune', persist: true, flags: { noDisplace: true } });
      // Selector _postFilter 52: operators on high ground first, then the ordinary order.
      const high = u => b.grid.tile(u.tileR, u.tileC)?.height === 'HIGH' ? 1 : 0;
      e.profile.targetPriority = (x, y) => high(y) - high(x);
    },
    dealt(c, b, e) {
      if (!c.dmg?.isAttack || !c.target || neural <= 0) return;
      elem(b, e, c.target, 'neural', e.s.atk * neural);
    },
  };
}
