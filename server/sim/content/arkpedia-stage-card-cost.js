// SPDX-License-Identifier: GPL-3.0-or-later
import { stageCardMultiplier, stageCardAddition } from '../../../shared/arkpedia/stage-card-rules.js';

/** Stage runes change the initial cost; native source records remain immutable. */
export function stageCardBaseCost(battle, record) {
  if (!record) return Infinity;
  const initial = battle.stageInitialCosts?.get(record.charId ?? record.id)
    ?? record.baseCardStats?.cost ?? record.raw?.baseCardStats?.cost ?? record.stats.cost;
  return record.stats.cost + initial * (stageCardMultiplier(battle.stageCardRules, record, 'cost') - 1);
}
/** Summons have no ordinary operator redeployment penalty. */
export function stageSummonCost(battle, record) {
  return Math.max(0, Math.floor(stageCardBaseCost(battle, record)));
}

/** Initial redeployment time is scaled before talent reductions/multipliers. */
export function stageCardRespawnTime(battle, record, current = record.stats.respawnTime) {
  const initial = record.baseCardStats?.respawnTime ?? record.raw?.baseCardStats?.respawnTime ?? record.stats.respawnTime;
  return Math.max(0, current + initial * (stageCardMultiplier(battle.stageCardRules, record, 'respawnTime') - 1)
    + stageCardAddition(battle.stageCardRules, record, 'respawnTime'));
}
