// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage enemy support is derived (data/arkpedia-enemy-support.json,
// tools/arkpedia/enemy-support.mjs): an enemy is admitted only when everything
// it uses has an approved implementation. Unsupported enemies stay refused.
// The full reasons are in data/arkpedia-enemy-support.json.
import registry from '../../data/arkpedia-regular-enemies.json' with { type: 'json' };
import candidate from '../../data/candidates/arkpedia-ch16-regular-enemies.json' with { type: 'json' };
export const REGULAR_ENEMIES = Object.freeze({ ...registry.enemies });
/** Enemies a supported enemy can spawn (death spawns); a stage must ship their records too. */
export const REGULAR_ENEMY_SPAWNS = Object.freeze({ ...registry.spawns });

export function assertRegularEnemies(data) {
  const candidateMode = data.stage.code === '16-2' && data.stage.testOnly === true && data.stage.enemyCatalogue === 'canonical-ch16-candidate-v1';
  const enemies = candidateMode ? candidate.enemies : REGULAR_ENEMIES;
  const spawns = candidateMode ? candidate.spawns : REGULAR_ENEMY_SPAWNS;
  for (const id of Object.keys(data.enemies)) {
    if (!enemies[id]) throw Error(`Unsupported regular-stage enemy: ${id} (see data/arkpedia-enemy-support.json)`);
    for (const child of spawns[id] ?? [])
      if (!data.enemies[child]) throw Error(`Missing record of an enemy ${id} spawns: ${child}`);
  }
  if (data.stage.devices?.some(d => d.key === 'trap_329_rift') && !data.enemies.enemy_10211_murad)
    throw Error('Missing canonical Leak Source record for Leak Marker device');
  for (const wave of data.stage.geometry.waves)
    for (const spawn of wave.spawns)
      if (!enemies[spawn.enemy_id] || !data.enemies[spawn.enemy_id])
        throw Error(`Missing supported enemy record: ${spawn.enemy_id}`);
}
