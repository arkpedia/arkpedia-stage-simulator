// SPDX-License-Identifier: GPL-3.0-or-later
/** Original location strings are (row, column), with bottom-origin rows.
 * Arkpedia geometry and battle coordinates already use that same convention. */
export function forbiddenStageTiles(stage) {
  const tiles = stage.rules?.forbiddenLocations ?? [], g = stage.geometry;
  const seen = new Set();
  for (const p of tiles) {
    if (!Number.isSafeInteger(p.row) || !Number.isSafeInteger(p.col) || p.row < 0 || p.col < 0
      || p.row >= g.rows || p.col >= g.cols || seen.has(`${p.row},${p.col}`))
      throw Error('Invalid or duplicate stage deployment restriction');
    seen.add(`${p.row},${p.col}`);
  }
  return tiles;
}


/** The viewer calls native ALL buildability "any". Normalize once before
 * either source validation or runtime placement/blocking reads the tile. */
export function stageBuildableType(value) {
  const key = typeof value === 'number' ? ['NONE', 'MELEE', 'RANGED', 'ALL'][value] : String(value).toUpperCase();
  if (key === 'ANY') return 'ALL';
  if (['NONE', 'MELEE', 'RANGED', 'ALL'].includes(key)) return key;
  throw Error(`Unsupported stage buildability: ${value}`);
}
