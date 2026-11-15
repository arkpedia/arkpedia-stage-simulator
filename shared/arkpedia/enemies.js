// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage enemy support is derived (data/arkpedia-enemy-support.json,
// tools/arkpedia/enemy-support.mjs): an enemy is admitted only when everything
// it uses has an approved implementation. Unsupported enemies stay refused.
// The full reasons are in data/arkpedia-enemy-support.json.
import registry from '../../data/arkpedia-regular-enemies.json' with { type: 'json' };
import { isStageEnemyAlias } from './enemy-aliases.js';
import { stageEnemyKey } from './stage-rules.js';
export const REGULAR_ENEMIES = Object.freeze({ ...registry.enemies });
/** Enemies a supported enemy can spawn (death spawns); a stage must ship their records too. */
export const REGULAR_ENEMY_SPAWNS = Object.freeze({ ...registry.spawns });

export function assertRegularEnemies(data) {
  const aliases = data.stage.enemyAliases ?? {};
  for (const [id, base] of Object.entries(aliases))
    if (data.enemies[id]?.key !== id || !isStageEnemyAlias(data.enemies[id], base, REGULAR_ENEMIES[base]))
      throw Error(`Unsupported stage-local enemy alias: ${id}`);
  const approved = id => REGULAR_ENEMIES[id] || Object.hasOwn(aliases, id);
  for (const id of Object.keys(data.enemies)) {
    if (!approved(id)) throw Error(`Unsupported regular-stage enemy: ${id} (see data/arkpedia-enemy-support.json)`);
    for (const child of REGULAR_ENEMY_SPAWNS[id] ?? [])
      if (!data.enemies[child]) throw Error(`Missing record of an enemy ${id} spawns: ${child}`);
  }
  for (const wave of data.stage.geometry.waves)
    for (const spawn of wave.spawns) {
      const id = stageEnemyKey(data.stage.rules, spawn.enemy_id);
      if (!approved(id) || !data.enemies[id]) throw Error(`Missing supported enemy record: ${id}`);
    }
}
