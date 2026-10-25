// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate compiler only. Inclusion requires an independent reviewed group
// list AND a normal-play enable rune in the retained canonical raw level.
export function applyReviewedHiddenGroups(geometry, source, expected) {
  const entries = source.conditional.filter(e => e.source === 'wave');
  const groups = [...new Set(entries.map(e => e.condition?.hidden_group).filter(Boolean))].sort();
  const included = expected.includedHiddenGroups ?? [], excluded = expected.excludedHiddenGroups;
  if (!Array.isArray(included) || !Array.isArray(excluded)
    || new Set([...included,...excluded]).size !== included.length + excluded.length
    || JSON.stringify(groups) !== JSON.stringify([...included,...excluded].sort()))
    throw Error('Unreviewed included/excluded hidden groups');
  const raw = source.rawLevel, defaults = raw.runes ?? [];
  const optional = Object.values(raw.optionalRunes ?? {}).flat();
  const targets = (r, group) => r.blackboard?.some(bb => bb.key === 'key' && bb.valueStr === group);
  for (const group of groups) {
    const enables = [...defaults,...optional].filter(r => r.key === 'level_hidden_group_enable' && targets(r,group));
    if (included.includes(group)) {
      if (!defaults.some(r => r.key === 'level_hidden_group_enable' && r.difficultyMask === 'ALL' && targets(r,group))
        || enables.some(r => !['ALL','SIX_STAR'].includes(r.difficultyMask))
        || optional.some(r => r.difficultyMask !== 'SIX_STAR' && targets(r,group))
        || defaults.some(r => r.key === 'level_hidden_group_disable' && r.difficultyMask !== 'SIX_STAR' && targets(r,group)))
        throw Error('Included hidden group lacks an unambiguous normal ALL enable: '+group);
    } else if (!enables.length || enables.some(r => r.difficultyMask !== 'SIX_STAR'))
      throw Error('Hidden group is not exclusively a source SIX_STAR option: '+group);
  }
  const additions = [];
  for (const e of entries) {
    if (!e.condition?.hidden_group || Object.keys(e.condition).length !== 1 || e.branch)
      throw Error('Unreviewed conditional wave expression');
    if (!included.includes(e.condition.hidden_group)) continue;
    const wave = geometry.waves?.[e.wave ?? 0];
    if (!wave || !Array.isArray(wave.spawns) || !geometry.routes?.[e.route] || !(e.count > 0))
      throw Error('Invalid reviewed hidden wave/route/count');
    const {condition,branch,wave:waveIndex,source:origin,...spawn} = e;
    additions.push({wave,spawn});
  }
  // Validate the entire contract before touching compiler output.
  for (const {wave,spawn} of additions) wave.spawns.push(structuredClone(spawn));
  return additions.length;
}
