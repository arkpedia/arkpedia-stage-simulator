// SPDX-License-Identifier: GPL-3.0-or-later
import { canSpawnCarapace, spawnCarapace } from './arkpedia-stage-carapaces.js';
export function depositor() {
  return { death(c, b, e, a) {
    if (a.spawned || c.reason !== 'killed') return; a.spawned = true;
    const row = Math.round(e.y), col = Math.round(e.x);
    if (canSpawnCarapace(b, row, col)) spawnCarapace(b, row, col);
  } };
}
