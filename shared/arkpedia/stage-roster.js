// SPDX-License-Identifier: GPL-3.0-or-later
import { PROFESSION_BITS } from './stage-card-rules.js';
/** Empty tutorial benches are fixed too; preplaced actors alone do not replace
 * the player's roster in ordinary stages. Legacy programs contain fixed cards. */
export function stageUsesFixedSquad(stage) {
  const pre = stage?.waveProgram?.predefined;
  if (pre?.squadMode != null) {
    if (!['fixed', 'player'].includes(pre.squadMode)) throw Error('Invalid predefined squad mode');
    return pre.squadMode === 'fixed';
  }
  return !!(pre?.entries.some(e => e.kind === 'card') || stage?.fixedSquad?.length);
}
/** One contract for the picker and battle constructor, including support cards. */
export function excludedStageOperators(stage, operators = {}) {
  const ids = stage?.battle?.excluded_operator_ids;
  if (ids != null && (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !/^char_[a-z0-9_]+$/.test(id))
    || new Set(ids).size !== ids.length)) throw Error('Invalid stage operator exclusions');
  const result = new Set(ids ?? []), mask = stage?.battle?.excluded_profession_mask;
  if (mask != null) {
    if (!Number.isInteger(mask) || mask < 1 || mask > 1023) throw Error('Invalid stage profession exclusions');
    for (const op of Object.values(operators)) if ((mask & PROFESSION_BITS[op.profession]) !== 0) result.add(op.id);
  }
  return result;
}

export function stageSquadLimit(stage) {
  const value = stage?.battle?.squad_limit;
  if (value == null) return 13;
  if (!Number.isSafeInteger(value) || value < 1 || value > 13) throw Error('Invalid stage squad limit');
  return value;
}
