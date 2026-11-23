// SPDX-License-Identifier: GPL-3.0-or-later
/** Original levels can carry unused activation branches whose aliases name no
 * predefined card or instance of the level (H7-4 keeps a frstar_frosts branch
 * with no Ice Crystal). The native executor completes after the failed alias
 * lookup. Only zero-time, unconditional actions are folded here. */
export function emptyActivationBranches(level) {
  const groups = ['characterInsts', 'tokenInsts', 'characterCards', 'tokenCards'], p = level.predefines ?? {};
  if (groups.some(k => p[k] != null && !Array.isArray(p[k])) || Object.keys(p).some(k => !groups.includes(k))) return {};
  const present = new Set(groups.flatMap(k => (p[k] ?? []).map(e => e?.alias).filter(Boolean)));
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
    if (valid && aliases.every(alias => !present.has(alias)))
      branches[key] = { spawns: [], missingActivationAliases: [...new Set(aliases)], phaseCount: branch.phases.length };
  }
  return branches;
}

/** Activation-only branches whose phases switch on hidden predefined devices: Turrets (trap_007_ballis, Faust's
 * SummonBallis) and Originium Ice Crystals (trap_010_frosts, FrostNova's SummonFrosts). The skill runs
 * MoveNextLevelBranch on its branch_id: one phase per cast, no loop. Each alias must be a unique hidden instance
 * of one of these keys; it is validated like the static device and compiled as a hidden device the stage
 * activates by alias. Branches of any other shape are left to their owners. */
const ACTIVATED_DEVICES = { trap_007_ballis: 'Turret', trap_010_frosts: 'Originium Ice Crystal' };
export function turretActivationBranches(level, originalDeviceDirection) {
  const insts = level.predefines?.tokenInsts ?? [], branches = {}, devices = [], instances = {}, used = new Set();
  for (const [key, branch] of Object.entries(level.branches ?? {})) {
    if (Object.keys(branch).some(k => k !== 'phases') || !branch.phases?.length) continue;
    const phases = [];
    const valid = branch.phases.every(phase => {
      if (phase.preDelay !== 0 || !phase.actions?.length) return false;
      const aliases = [];
      for (const a of phase.actions) {
        if (![6, 'ACTIVATE_PREDEFINED'].includes(a.actionType) || typeof a.key !== 'string' || !a.key
          || a.managedByScheduler !== true || a.count !== 1 || a.preDelay !== 0 || a.interval !== 0
          || ['hiddenGroup', 'randomSpawnGroupKey', 'randomSpawnGroupPackKey', 'extraMeta', 'useExtraRoute',
            'blockFragment', 'dontBlockWave', 'forceBlockWaveInBranch', 'isUnharmfulAndAlwaysCountAsKilled',
            'notCountInTotal'].some(k => !!a[k])
          || a.isValid === false || ![undefined, 0].includes(a.weight)
          || ![undefined, 0, 'ALWAYS'].includes(a.randomType) || ![undefined, 0, 'ALWAYS'].includes(a.refreshType)) return false;
        const matches = insts.filter(p => p.alias === a.key);
        if (matches.length !== 1 || !Object.hasOwn(ACTIVATED_DEVICES, matches[0].inst?.characterKey) || matches[0].hidden !== true) return false;
        aliases.push(a.key);
      }
      phases.push(aliases); return true;
    });
    if (!valid) continue;
    for (const alias of phases.flat()) {
      if (used.has(alias)) throw Error(`Turret alias activated by more than one branch: ${alias}`);
      used.add(alias);
      const p = insts.find(e => e.alias === alias);
      const key = p.inst.characterKey, turret = key === 'trap_007_ballis';
      // A Turret is instanced (level 1-90, direction); a static Ice Crystal is level 1 (as validateStaticDeviceInstances).
      if (p.skillIndex !== 0 || p.mainSkillLvl !== 1 || ![0, 'PHASE_0'].includes(p.inst.phase)
        || (turret ? !Number.isSafeInteger(p.inst.level) || p.inst.level < 1 || p.inst.level > 90 : p.inst.level !== 1)
        || p.overrideSkillBlackboard != null || p.overrideTalents != null || p.uniEquipIds?.length || p.masterInfos?.length
        || !Number.isInteger(p.position?.row) || !Number.isInteger(p.position?.col))
        throw Error(`Unimplemented hidden device instance override: ${alias}`);
      const device = { key, kind: 'device', name: ACTIVATED_DEVICES[key], row: p.position.row, col: p.position.col, hidden: true, alias, branchActivated: true };
      devices.push(device);
      if (turret) instances[`${device.key}:${device.row}:${device.col}`] = { level: p.inst.level, skillLevel: p.mainSkillLvl,
        direction: originalDeviceDirection(p.direction) };
    }
    branches[key] = { spawns: [], phases };
  }
  return { branches, devices, instances };
}
