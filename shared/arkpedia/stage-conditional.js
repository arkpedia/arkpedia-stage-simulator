// SPDX-License-Identifier: GPL-3.0-or-later
// Pristine `hidden_group` wave entries are hidden from the preview but still
// spawn. Anything with a branch, random pack or weight is a real condition and
// must keep the stage refused.
export function mergePristineHiddenGroups(geometry, entries) {
  if (!geometry?.hasConditionalSpawns || !entries?.length) return false;
  const pristine = entries.every(e => e.condition?.hidden_group && Object.keys(e.condition).length === 1
    && !e.branch && e.source === 'wave');
  if (!pristine) return false;
  for (const entry of entries) {
    const { condition, branch, wave, ...spawn } = entry;
    const target = geometry.waves?.[wave ?? 0] ?? geometry.waves?.[0];
    if (target) target.spawns.push(spawn);
  }
  geometry.hasConditionalSpawns = false;
  geometry.hiddenGroupsMerged = entries.length;
  return true;
}
