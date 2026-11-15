// SPDX-License-Identifier: GPL-3.0-or-later
/** Original levels can carry unused activation branches with no predefined
 * cards or instances at all. The native executor completes after the failed
 * alias lookup. Only zero-time, unconditional actions are folded here. */
export function emptyActivationBranches(level) {
  const groups = ['characterInsts', 'tokenInsts', 'characterCards', 'tokenCards'], p = level.predefines;
  if (!p || groups.some(k => !Array.isArray(p[k]) || p[k].length) || Object.keys(p).some(k => !groups.includes(k))) return {};
  const branches = {};
  for (const [key, branch] of Object.entries(level.branches ?? {})) {
    if (Object.keys(branch).some(k => k !== 'phases') || !branch.phases?.length) continue;
    const aliases = [];
    const valid = branch.phases.every(phase => phase.preDelay === 0 && phase.actions?.length > 0 && phase.actions.every(a => {
      if (![6, 'ACTIVATE_PREDEFINED'].includes(a.actionType) || typeof a.key !== 'string' || !a.key
        || a.managedByScheduler !== true || a.count !== 1 || a.preDelay !== 0 || a.interval !== 0
        || ['hiddenGroup', 'randomSpawnGroupKey', 'randomSpawnGroupPackKey', 'extraMeta', 'useExtraRoute',
          'blockFragment', 'dontBlockWave', 'forceBlockWaveInBranch', 'isUnharmfulAndAlwaysCountAsKilled',
          'autoPreviewRoute', 'autoDisplayEnemyInfo', 'notCountInTotal'].some(k => !!a[k])
        || a.isValid === false || ![undefined, 0].includes(a.weight)
        || ![undefined, 0, 'ALWAYS'].includes(a.randomType) || ![undefined, 0, 'ALWAYS'].includes(a.refreshType)) return false;
      aliases.push(a.key); return true;
    }));
    if (valid) branches[key] = { spawns: [], missingActivationAliases: [...new Set(aliases)], phaseCount: branch.phases.length };
  }
  return branches;
}
