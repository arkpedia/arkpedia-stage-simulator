// SPDX-License-Identifier: GPL-3.0-or-later
// Node compatibility for existing raw snapshots and synchronous tooling.
import { enemyFeature,recordFeatureIds,enemyRuntimeRecord } from '../../../shared/arkpedia/enemy-features.js';
import { installFeatureDispatch,attach,abOf } from './arkpedia-enemy-ability-runtime.js';
export { enemyRuntimeRecord };
export function applyLegacyEnemyFeatures(battle,e,factoryFor){
  const record=e.def?.raw;
  // Only compiled catalogue records (shared/arkpedia/enemy-records.js) carry features.
  if (!record?.abilities || !record.talents?.groups) return;
  const abilities = [];
  for (const id of recordFeatureIds(record)) {
    const f = enemyFeature(id);
    if (!f || f.matchesRecord && !f.matchesRecord(record)) continue;
    const trait=typeof f.trait==='function'?f.trait(record):f.trait;
    if (trait?.flags) battle.addBuff(e, { key: `feature:${id}`, persist: true, flags: { ...trait.flags } });
    if (trait?.maxTargets) e.profile.maxTargets = Math.max(e.profile.maxTargets ?? 1, trait.maxTargets);
    const ability = typeof f.ability === 'function' ? f.ability(record) : f.ability;
    if (ability) {
      const make = factoryFor(ability.kind);
      if (!make) throw Error(`Unknown enemy feature ability: ${ability.kind}`);
      const made = make(ability.params(record), abOf(battle, e));
      abilities.push(...(Array.isArray(made) ? made : [made]));
    }
  }
  if (abilities.length) { installFeatureDispatch(battle); abOf(battle, e); attach(battle, e, abilities); }
}
