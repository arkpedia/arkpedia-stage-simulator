// SPDX-License-Identifier: GPL-3.0-or-later
import { twigsDefinition, TWIGS } from '../../shared/arkpedia/stage-twigs.js';

/** Normalize the observed lower/initial-capital pollution-key spellings at import,
 * rejecting ambiguous duplicate spellings instead of overwriting a value. */
export function compileTwigsInstance(predefined, level) {
  const inst = predefined?.inst, rows = predefined?.overrideSkillBlackboard;
  if (inst?.characterKey !== TWIGS || !Array.isArray(rows) || predefined.overrideTalents != null
    || ![0, 'PHASE_0'].includes(inst.phase) || inst.potentialRank !== 0 || inst.favorPoint !== 0
    || predefined.skillIndex !== 0 || predefined.mainSkillLvl !== 1
    || predefined.uniEquipIds?.length || predefined.masterInfos?.length
    || typeof predefined.hidden !== 'boolean' || !predefined.alias)
    throw Error('Unsupported original Twigs instance');
  const bb = new Map();
  for (const row of rows) {
    if (typeof row.key !== 'string') throw Error('Invalid Twigs blackboard key');
    const key = row.key.toLowerCase();
    if (!['branch_id', 'action_index', 'polluted_damage_low', 'polluted_damage_high'].includes(key) || bb.has(key))
      throw Error('Unknown or duplicate Twigs blackboard key');
    bb.set(key, row);
  }
  const branch = bb.get('branch_id');
  if (branch?.value !== 0 || typeof branch.valueStr !== 'string' || !branch.valueStr || !level.branches?.[branch.valueStr])
    throw Error('Missing Twigs branch binding');
  const number = (key, fallback) => {
    const row = bb.get(key);
    if (!row) return fallback;
    if (row.valueStr != null && row.valueStr !== '' || !Number.isSafeInteger(row.value) || row.value < 0)
      throw Error(`Invalid Twigs blackboard operand: ${key}`);
    return row.value;
  };
  const instance = { level: inst.level, skillLevel: predefined.mainSkillLvl, branchId: branch.valueStr,
    actionIndex: number('action_index', 0), pollutionLow: number('polluted_damage_low', 50),
    pollutionHigh: number('polluted_damage_high', 25) };
  twigsDefinition(instance);
  const phases = level.branches[instance.branchId].phases;
  const action = phases?.[0]?.actions?.[instance.actionIndex];
  if (phases?.length !== 1 || phases[0].preDelay !== 0 || !action || action.actionType !== 'SPAWN'
    || action.count !== 1 || action.preDelay !== 0 || action.managedByScheduler !== true
    || action.key !== 'enemy_1266_nhapos') throw Error('Unsupported Twigs death branch action');
  const route = level.extraRoutes?.[action.routeIndex];
  if (route?.startPosition?.row !== predefined.position?.row || route?.startPosition?.col !== predefined.position?.col)
    throw Error('Twigs branch starts at another device');
  return instance;
}
