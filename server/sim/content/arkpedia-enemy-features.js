// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage enemy feature runtime: applies the declarative features of
// shared/arkpedia/enemy-features.js to every spawned enemy. Spawn traits set
// flags or attack fields; ability features attach the shared Stronghold
// abilities (content/enemies.js) through its features-only dispatch, never its
// per-enemy kits.
import { ENEMY_FEATURES, recordFeatureIds } from '../../../shared/arkpedia/enemy-features.js';
import { installFeatureDispatch, attach, abOf, rebornAbility } from './enemies.js';

const ABILITIES = Object.freeze({
  reborn: params => rebornAbility(params),
});

/** Apply one spawned enemy's feature traits and abilities (its record is `e.def.raw`). */
export function applyEnemyFeatures(battle, e) {
  const record = e.def?.raw;
  if (!record?.abilities) return;
  const abilities = [];
  for (const id of recordFeatureIds(record)) {
    const f = ENEMY_FEATURES[id];
    if (!f) continue;
    if (f.trait?.flags) battle.addBuff(e, { key: `feature:${id}`, persist: true, flags: { ...f.trait.flags } });
    if (f.trait?.maxTargets) e.profile.maxTargets = Math.max(e.profile.maxTargets ?? 1, f.trait.maxTargets);
    if (f.ability) {
      const make = ABILITIES[f.ability.kind];
      if (!make) throw Error(`Unknown enemy feature ability: ${f.ability.kind}`);
      abilities.push(make(f.ability.params(record)));
    }
  }
  if (abilities.length) { abOf(battle, e); attach(battle, e, abilities); }
}

/** Install the features-only dispatch and apply features to every enemy this battle spawns. */
export function installEnemyFeatures(battle) {
  if (battle.regularEnemyFeatures) return;
  battle.regularEnemyFeatures = true;
  installFeatureDispatch(battle);
  battle.on('enemySpawn', ({ enemy }) => applyEnemyFeatures(battle, enemy), { priority: 90 });
}
