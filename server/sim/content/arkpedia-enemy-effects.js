// SPDX-License-Identifier: GPL-3.0-or-later
// Shared elemental and tile-selection helpers without concrete enemy kits.
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

