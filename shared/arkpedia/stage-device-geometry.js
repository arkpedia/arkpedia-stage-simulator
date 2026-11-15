// SPDX-License-Identifier: GPL-3.0-or-later
export function altarSelectsUnit(unit) {
  return unit.kind !== 'device' || !!unit.profile?.enemyTargetableDevice || !!unit.mem?.regularSummonCard;
}

/** Tiles hit by the Londinium artillery: a 3x3 core with one 1x3 extension on each side. */
export function artilleryTiles(row, col) {
  const out = [];
  for (let r = row - 2; r <= row + 2; r++) for (let c = col - 2; c <= col + 2; c++) {
    const dr = Math.abs(r - row), dc = Math.abs(c - col);
    if (dr <= 1 && dc <= 1) out.push([r, c]);
    else if (dr === 2 && dc <= 1) out.push([r, c]);
    else if (dc === 2 && dr <= 1) out.push([r, c]);
  }
  return out;
}

