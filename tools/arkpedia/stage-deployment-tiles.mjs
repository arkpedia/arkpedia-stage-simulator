// SPDX-License-Identifier: GPL-3.0-or-later
import { forbiddenStageTiles, stageBuildableType } from '../../shared/arkpedia/stage-deployment-tiles.js';
import { readOriginalLevel } from './original-level.mjs';

export function validateForbiddenTileGeometry(geometry, rules, level) {
  const tiles = forbiddenStageTiles({ geometry, rules }), map = level.mapData;
  if (map?.map?.length !== geometry.rows || map.map.some(row => row.length !== geometry.cols))
    throw Error('Original deployment-restriction map dimensions differ');
  for (const {row, col} of tiles) {
    // Native map arrays run top first; positions and exported grids run bottom first.
    const source = map.tiles[map.map[geometry.rows - 1 - row][col]];
    const exported = geometry.tileLegend[geometry.tileGrid[row][col]];
    const build = stageBuildableType(source?.buildableType);
    if (!source || source.tileKey !== exported?.key || build !== stageBuildableType(exported?.deployable))
      throw Error(`Original deployment restriction does not match exported tile: ${row},${col}`);
  }
}
export async function prepareStageDeploymentTiles({root, geometry, rules, compiledRules}) {
  if (!compiledRules?.forbiddenLocations?.length) return [];
  const {level, source} = await readOriginalLevel(root, rules);
  validateForbiddenTileGeometry(geometry, compiledRules, level);
  return [source];
}
