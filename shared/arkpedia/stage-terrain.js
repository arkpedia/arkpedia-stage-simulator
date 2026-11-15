// SPDX-License-Identifier: GPL-3.0-or-later
/** Retain the level's terrain parameters instead of substituting mode defaults. */
export function compileStageTerrain(geometry) {
  const tiles = [];
  for (const [row, cells] of geometry.tileGrid.entries()) for (const [col, type] of cells.entries()) {
    const tile = geometry.tileLegend[type];
    if (tile?.key !== 'tile_infection') continue;
    const bb = tile.blackboard;
    if (!bb || Object.keys(bb).sort().join() !== 'atk,attack_speed,damage,duration'
      || !Object.values(bb).every(Number.isFinite) || bb.damage < 0 || bb.duration <= 0)
      throw Error(`Unsupported Active Originium parameters at ${row},${col}`);
    tiles.push({ row, col, kind: 'infection', damage: bb.damage, atk: bb.atk, aspd: bb.attack_speed, duration: bb.duration });
  }
  // The shared contact effect has one value set per unit. Refuse mixed tile
  // strengths until replacement/priority semantics have their own source review.
  if (new Set(tiles.map(({ row, col, ...params }) => JSON.stringify(params))).size > 1)
    throw Error('Unsupported mixed Active Originium strengths');
  return tiles;
}
