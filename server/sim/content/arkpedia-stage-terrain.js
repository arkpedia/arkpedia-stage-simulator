// SPDX-License-Identifier: GPL-3.0-or-later
import { touchInfection } from './terrain-infection.js';

/** Explicit level terrain, independent of the full-mode device installation. */
export function installStageTerrain(battle, tiles = []) {
  if (!tiles.length) return;
  const byTile = new Map(tiles.map(tile => [`${tile.row},${tile.col}`, tile]));
  const contact = unit => {
    if (!unit?.alive || !unit.deployed || unit.hidden || unit.kind === 'device' || unit.isFlying) return;
    const row = unit.side === 'enemy' ? Math.round(unit.y) : unit.tileR;
    const col = unit.side === 'enemy' ? Math.round(unit.x) : unit.tileC;
    const tile = byTile.get(`${row},${col}`);
    if (tile?.kind === 'infection') touchInfection(battle, { infection: tile }, unit);
  };
  battle.on('deploy', ({ unit }) => contact(unit), { priority: 90 });
  battle.on('enemySpawn', ({ enemy }) => contact(enemy), { priority: 90 });
  battle.on('tick', () => {
    for (const unit of battle.allyUnits) contact(unit);
    for (const enemy of battle.enemies) contact(enemy);
  });
}
