// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage enemy feature runtime: applies the declarative features of
// shared/arkpedia/enemy-features.js to every spawned enemy. Spawn traits set
// flags or attack fields; ability features attach the shared Stronghold
// abilities (content/enemies.js) through its features-only dispatch, never its
// per-enemy kits.
import { enemyFeature, recordFeatureIds } from '../../../shared/arkpedia/enemy-features.js';
import { installFeatureDispatch, attach, abOf, rebornAbility, featureAbilities } from './enemies.js';
import { periodicDamage } from '../damage.js';

const ABILITIES = Object.freeze({
  reborn: params => rebornAbility(params),
  ...featureAbilities,
  // 持续损失生命: `amount` HP every second, sourceless.
  periodicLoss: ({ amount }) => ({ iv: 1, tick(b, e) { if (amount > 0) b.dealDamage(null, e, periodicDamage(amount)); } }),
});

/** Apply one spawned enemy's feature traits and abilities (its record is `e.def.raw`). */
export function applyEnemyFeatures(battle, e) {
  const record = e.def?.raw;
  // Only compiled catalogue records (shared/arkpedia/enemy-records.js) carry features.
  if (!record?.abilities || !record.talents?.groups) return;
  const abilities = [];
  for (const id of recordFeatureIds(record)) {
    const f = enemyFeature(id);
    if (!f) continue;
    if (f.trait?.flags) battle.addBuff(e, { key: `feature:${id}`, persist: true, flags: { ...f.trait.flags } });
    if (f.trait?.maxTargets) e.profile.maxTargets = Math.max(e.profile.maxTargets ?? 1, f.trait.maxTargets);
    if (f.ability) {
      const make = ABILITIES[f.ability.kind];
      if (!make) throw Error(`Unknown enemy feature ability: ${f.ability.kind}`);
      abilities.push(make(f.ability.params(record)));
    }
  }
  if (abilities.length) { installFeatureDispatch(battle); abOf(battle, e); attach(battle, e, abilities); }
}

/** Apply features to every enemy this battle spawns; the shared dispatch is installed only when an ability needs it. */
export function installEnemyFeatures(battle) {
  if (battle.regularEnemyFeatures) return;
  battle.regularEnemyFeatures = true;
  battle.on('enemySpawn', ({ enemy }) => applyEnemyFeatures(battle, enemy), { priority: 90 });
}
