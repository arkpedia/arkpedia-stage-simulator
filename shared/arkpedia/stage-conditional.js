// SPDX-License-Identifier: GPL-3.0-or-later
// Hidden groups require an explicit decision from original level rules. In
// particular, "raid" groups are often enabled only on challenge difficulty.
// Unknown activation, branches and random packs keep the stage refused.
export function mergePristineHiddenGroups(geometry, entries, groups = {}, { random = false } = {}) {
  if (!geometry?.hasConditionalSpawns || !entries?.length) return false;
  const isRandom = e => random && typeof e.condition?.random_group === 'string' && e.condition.random_group.length > 0
    && Object.keys(e.condition).every(k => ['random_group', 'weight'].includes(k))
    && Number.isSafeInteger(e.condition.weight) && e.condition.weight >= 0;
  const pristine = entries.every(e => ((e.condition?.hidden_group && Object.keys(e.condition).length === 1
    && Object.hasOwn(groups, e.condition.hidden_group) && typeof groups[e.condition.hidden_group] === 'boolean') || isRandom(e))
    && !e.branch && e.source === 'wave'
    && Number.isInteger(e.wave ?? 0) && (e.wave ?? 0) >= 0
    && Array.isArray(geometry.waves?.[e.wave ?? 0]?.spawns));
  if (!pristine) return false;
  let merged = 0;
  for (const entry of entries) {
    if (!isRandom(entry) && !groups[entry.condition.hidden_group]) continue;
    const { condition, branch, wave, ...spawn } = entry;
    const target = geometry.waves[wave ?? 0];
    target.spawns.push({ ...spawn, ...(isRandom(entry) ? { random: { group: condition.random_group, weight: condition.weight } } : {}) });
    merged++;
  }
  geometry.hasConditionalSpawns = false;
  geometry.hiddenGroupsMerged = merged;
  return true;
}
