// SPDX-License-Identifier: GPL-3.0-or-later
// Selectively reuse Stronghold Protocol's GPL enemy factories after primary-source review.
// Deliberately separate from shared/arkpedia/enemies.js public admission.
import review from '../../../data/arkpedia-upstream-enemy-review.json' with { type: 'json' };
import { installSelected } from './enemies.js';
export const UPSTREAM_ENEMY_CONTRACT = Object.freeze({
  scope: 'Held Wraith Leader permanent unblockability; no public catalogue admission',
  frameParity: false, compiledDispatchVerified: false,
});
export function installReviewedUpstreamEnemies(battle, { contract } = {}) {
  if (contract !== UPSTREAM_ENEMY_CONTRACT) throw Error('Explicit reviewed upstream enemy contract required');
  const keys = Object.keys(review.enemies);
  // Review the regular data view, not the upstream seasonal wave/template overrides.
  for (const id of keys) {
    const expected = review.enemies[id], def = battle.data.getEnemy(id);
    if (!def || def.id !== id || Object.entries(expected.stats).some(([k,v]) => def[k] !== v)
      || def.skills.length || Object.keys(def.talent).length
      || battle.enemyOverrides?.[id] != null) throw Error('Changed reviewed upstream enemy inputs: ' + id);
  }
  return installSelected(battle, keys);
}
