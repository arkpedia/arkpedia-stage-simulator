// SPDX-License-Identifier: GPL-3.0-or-later
/** Shared reporting for the source inventory and deployable library. One stage
 * can need several capabilities, including previously registered stages. */
export function groupStageBlockers(stages) {
  const requirements = new Map();
  for (const stage of stages) {
    const keys = new Set();
    for (const blocker of stage.blockers ?? []) {
      const identity = blocker.message ? { kind: blocker.kind, reason: blocker.message } : { kind: blocker.kind, id: blocker.id };
      const key = JSON.stringify(identity);
      if (!requirements.has(key)) requirements.set(key, { ...identity, stages: new Set(), soleReportedBlockerStages: [] });
      requirements.get(key).stages.add(stage.id); keys.add(key);
    }
    if (keys.size === 1) requirements.get([...keys][0]).soleReportedBlockerStages.push(stage.id);
  }
  return [...requirements.values()].map(row => ({ ...row, stages: [...row.stages] }))
    .sort((a, b) => b.stages.length - a.stages.length);
}
