// SPDX-License-Identifier: GPL-3.0-or-later
import { readOriginalLevel } from './original-level.mjs';

export async function prepareStageMode({ root, rules, source }) {
  if (source.stage_type !== 'integrated_strategies') return { mode: null, sources: [] };
  const { level, source: original } = await readOriginalLevel(root, rules), o = level.options;
  if (!o || o.functionDisableMask !== 'NONE' || o.isPredefinedCardsSelectable !== false
    || o.isTrainingLevel !== false || o.isHardTrainingLevel !== false || o.configBlackBoard != null
    || o.steeringEnabled !== true || o.reachableCheckIgnoreStartTile !== false)
    throw Error('Unsupported individual-stage mode options');
  for (const [field, key] of [['max_life', 'maxLifePoint'], ['unit_limit', 'characterLimit'], ['initial_dp', 'initialCost'], ['max_dp', 'maxCost'],
    ['dp_recovery_interval_seconds', 'costIncreaseTime']])
    if (source.battle[field] !== o[key]) throw Error(`Original/viewer mode budget mismatch: ${field}`);
  return { mode: { kind: 'integrated_strategies', scope: 'individual-stage' }, sources: [original] };
}
