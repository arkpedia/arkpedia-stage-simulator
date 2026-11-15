// SPDX-License-Identifier: GPL-3.0-or-later
// Shared elemental and tile-selection helpers without concrete enemy kits.
import {areaSelectable} from '../targeting.js';
export const EROSION = 'erosion';

/** Element damage (erosion mapped onto the engine gauge); `ignoreSelect` / `tags` as hurt(). */
export function elem(b, src, tgt, el, amount, { ignoreSelect = false, tags = [] } = {}) {
  if (!tgt || !tgt.alive || !(amount > 0)) return 0;
  const element = el === 'erosion' ? EROSION : el;
  return b.dealDamage(src, tgt, { type: 'element', element, amount, ignoreSelect, tags: ['enemyAbility', ...tags] });
}

/** Allies whose tile is within `n` of (r, c): 'plus' = Manhattan (周围四格), 'box' = Chebyshev (周围8格). */
export function alliesInTiles(b, r, c, shape = 'plus', n = 1) {
  const out = [];
  for (const a of b.allies(null, { includeTargetableDevices: true })) {
    if (a.hidden) continue;
    const dr = Math.abs(a.tileR - r), dc = Math.abs(a.tileC - c);
    if (shape === 'plus' ? dr + dc <= n : Math.max(dr, dc) <= n) out.push(a);
  }
  return out;
}

/**
 * Skill / ability damage (no dodge unless asked). `ignoreSelect` = no selection the target's 无法选择 effects stop
 * (abilities that "无视无法选择", direct picks, a flying unit's blast credited to a ground leader): it also reaches an
 * airborne 起飞 ally, which a ground enemy's damage otherwise skips (damage.js, targeting.js evadesGround).
 */
export function hurt(b, src, tgt, amount, type = 'phys', { canDodge = false, tags = [], isSkill = true, ignoreSelect = false } = {}) {
  if (!tgt || !tgt.alive || !(amount > 0)) return 0;
  return b.dealDamage(src, tgt, { amount, type, canDodge, isSkill, ignoreSelect, tags: ['enemyAbility', ...tags] });
}

/** alliesInTiles for an area effect of `src` (周围四格 / 周围八格 / cross / 3×3 areas — 格子判定): areaSelectable. */
export function areaAlliesInTiles(b, src, r, c, shape = 'plus', n = 1) {
  return alliesInTiles(b, r, c, shape, n).filter((a) => areaSelectable(src, a));
}
