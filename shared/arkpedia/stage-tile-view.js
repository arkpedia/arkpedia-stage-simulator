// SPDX-License-Identifier: GPL-3.0-or-later
/** Legend numbers are local to a stage. Presentation follows semantic fields,
 * just like deployment/pathing, so arbitrary source palette ordering is safe. */
export function stageTileView(tile = {}) {
  const height = tile.height === 'high' ? .38 : 0;
  const water = ['tile_deepsea', 'tile_codpsea', 'tile_deepwater', 'tile_xbdpsea'].includes(tile.key);
  const entry = tile.key === 'tile_start', goal = tile.key === 'tile_end';
  const buildable = ['melee', 'ranged', 'all', 'any'].includes(tile.deployable);
  return {
    height,
    color: entry ? '#aa4b40' : goal ? '#377787' : water ? '#1d506b'
      : height ? '#59666b' : buildable || tile.walkable ? '#35464b' : '#172329',
    label: entry ? 'Enemy entry' : goal ? 'Defence objective' : water ? 'Deep water' : height ? 'Raised tile' : 'Ground tile',
    focusable: buildable || water,
  };
}
