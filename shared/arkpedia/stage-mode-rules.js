// SPDX-License-Identifier: GPL-3.0-or-later
/** Individual-stage parameters, not a run/progression emulator. Only explicit
 * numeric effects are accepted; arbitrary relic IDs never become silent no-ops. */
export const STAGE_MODE_FIELDS = Object.freeze([
  { key: 'life', label: 'Life points', min: 1, max: 999, step: 1, battle: 'max_life' },
  { key: 'initialDp', label: 'Starting DP', min: 0, max: 999, step: 1, battle: 'initial_dp' },
  { key: 'deploymentLimit', label: 'Deployment limit', min: 1, max: 20, step: 1, battle: 'unit_limit' },
  { key: 'dpRate', label: 'DP per second', min: 0, max: 10, step: 0.1, battle: 'dp_per_second' },
  { key: 'enemyHp', label: 'Enemy HP multiplier', min: 0.1, max: 100, step: 0.1, attribute: 'maxHp' },
  { key: 'enemyAtk', label: 'Enemy ATK multiplier', min: 0.1, max: 100, step: 0.1, attribute: 'atk' },
  { key: 'enemyDef', label: 'Enemy DEF multiplier', min: 0, max: 100, step: 0.1, attribute: 'def' },
].map(Object.freeze));

export function stageModeDefaults(stage) {
  if (stage.mode?.kind !== 'integrated_strategies' || stage.mode.scope !== 'individual-stage')
    throw Error('This stage does not support configurable mode rules');
  return Object.fromEntries(STAGE_MODE_FIELDS.map(f => [f.key, f.battle ? stage.battle[f.battle] : 1]));
}
export function validateStageModeRules(stage, input = {}) {
  const defaults = stageModeDefaults(stage);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !Object.hasOwn(defaults, k)))
    throw Error('Unsupported individual-stage mode rule');
  const rules = { ...defaults, ...input };
  for (const f of STAGE_MODE_FIELDS) if (!Number.isFinite(rules[f.key]) || rules[f.key] < f.min || rules[f.key] > f.max
    || f.step === 1 && !Number.isSafeInteger(rules[f.key])) throw Error(`Invalid mode rule: ${f.label}`);
  if (rules.initialDp > stage.battle.max_dp) throw Error('Starting DP exceeds the stage DP capacity');
  return Object.freeze(rules);
}
export function applyStageModeRules(data, input) {
  if (!data.stage.mode && input == null) return data;
  const rules = validateStageModeRules(data.stage, input);
  const battle = { ...data.stage.battle };
  for (const f of STAGE_MODE_FIELDS) if (f.battle) battle[f.battle] = rules[f.key];
  battle.dp_recovery_interval_seconds = rules.dpRate === 0 ? null : 1 / rules.dpRate;
  const enemies = Object.fromEntries(Object.entries(data.enemies).map(([id, record]) => {
    const stats = { ...record.stats };
    for (const f of STAGE_MODE_FIELDS) if (f.attribute) {
      if (!Number.isFinite(stats[f.attribute])) throw Error(`Missing mode-scaled enemy attribute: ${id}.${f.attribute}`);
      stats[f.attribute] *= rules[f.key];
    }
    return [id, { ...record, stats }];
  }));
  return { ...data, enemies, stage: { ...data.stage, battle }, modeRules: rules };
}
