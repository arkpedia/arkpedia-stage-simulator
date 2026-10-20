// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage enemy support is derived (data/arkpedia-enemy-support.json,
// tools/arkpedia/enemy-support.mjs): an enemy is admitted only when everything
// it uses has an approved implementation. Unsupported enemies stay refused.
// The full reasons are in data/arkpedia-enemy-support.json.
import registry from '../../data/arkpedia-regular-enemies.json' with { type: 'json' };
export const REGULAR_ENEMIES = Object.freeze({ ...registry.enemies });

export function assertRegularEnemies(data) {
  for (const id of Object.keys(data.enemies))
    if (!REGULAR_ENEMIES[id]) throw Error(`Unsupported regular-stage enemy: ${id} (see data/arkpedia-enemy-support.json)`);
  for (const wave of data.stage.geometry.waves)
    for (const spawn of wave.spawns)
      if (!REGULAR_ENEMIES[spawn.enemy_id] || !data.enemies[spawn.enemy_id])
        throw Error(`Missing supported enemy record: ${spawn.enemy_id}`);
}
