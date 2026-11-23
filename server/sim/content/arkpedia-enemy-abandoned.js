// SPDX-License-Identifier: GPL-3.0-or-later
// 'The Abandoned' and 'The Cursed' (enemy_1440_dselec[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-abandoned-features.js).
import { areaSelectable } from '../targeting.js';

export function abandonedSplash(p) {
  if (!Array.isArray(p?.tiles) || !p.tiles.length || !(p.rangedAnim?.dur > 0) || !(p.meleeAnim?.dur > 0)) throw Error('Invalid Abandoned parameters');
  const clip = e => { e.def = { ...e.def, attackAnim: e.blockedBy ? p.meleeAnim : p.rangedAnim }; };
  return {
    spawn(b, e) { e.profile.deferHit = true; e.profile.shot = 'none'; clip(e); },
    tick(_b, e) { clip(e); },
    attack(c, b, e) {
      const attackId = c.attackId ?? b._attackSeq;
      for (const target of c.targets) {
        if (!target?.alive) continue;
        if (target === e.blockedBy) {
          // Combat: the blocker alone.
          b.dealDamage(e, target, { amount: e.s.atk, type: 'arts', isAttack: true, attackId, applyWay: 'melee' });
          continue;
        }
        // Attack: projectile_enemy_dselec lands at once on the x-5 cross around the target's tile.
        const r = Math.round(target.y), col = Math.round(target.x);
        b.fx('explode', { x: col, y: r, r: 1, kind: 'enemyArea' });
        for (const u of b.allies(null, { includeTargetableDevices: true })) {
          if (!areaSelectable(e, u)) continue;
          if (!p.tiles.some(t => u.tileR === r + t.row && u.tileC === col + t.col)) continue;
          b.dealDamage(e, u, { amount: e.s.atk, type: 'arts', isAttack: true, attackId, applyWay: 'ranged', isSplash: u !== target, tags: ['abandonedSplash'] });
        }
      }
    },
  };
}
