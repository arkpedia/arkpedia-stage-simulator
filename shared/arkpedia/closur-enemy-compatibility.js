// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../data/arkpedia-closur-enemy-compatibility.json' with { type: 'json' };
import { REGULAR_ENEMIES } from './enemies.js';

export function assertClosurEnemyCompatibility(data) {
  if (review.policy !== 'source-stat-only-enemies-no-skill-clocks-v1' || review.frameParity !== false)
    throw Error('Missing Closure enemy-clock compatibility review');
  if (!data?.enemies || typeof data.enemies !== 'object' || Array.isArray(data.enemies))
    throw Error('Closure needs the active regular enemy records');
  for (const [id, enemy] of Object.entries(data.enemies)) {
    const checked = review.enemies[id];
    if (!checked || checked.policy !== 'basic-stats-and-attacks' || REGULAR_ENEMIES[id] !== checked.policy
      || checked.declaredSkills !== 0 || checked.enemyAbilityWrappers !== 0 || checked.activeGeneralOrCommonAbilities !== 0)
      throw Error(`Closure S3 needs native clock review for regular enemy: ${id}`);
    if (!enemy || typeof enemy !== 'object' || Array.isArray(enemy)
      || !Array.isArray(enemy.skills ?? []) || (enemy.skills?.length ?? 0) !== 0
      || !Array.isArray(enemy.abilities ?? []) || (enemy.abilities?.length ?? 0) !== 0)
      throw Error(`Closure S3 needs native clock review for enemy abilities: ${id}`);
  }
}
