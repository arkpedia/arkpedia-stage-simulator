// SPDX-License-Identifier: GPL-3.0-or-later
// One table channel per operator: never silently fill gaps from another region.
export function compileOperator(id, { characters, skills, ranges }) {
    const c = characters[id];
    const rarity = Number(c?.rarity?.replace("TIER_", ""));
    const shape = { 1: [1, [0]], 2: [1, [0]], 3: [2, [1]],
      4: [3, [2]], 5: [3, [2, 3]], 6: [3, [3]] }[rarity];
    if (!c || !shape || c.phases.length !== shape[0] || !shape[1].includes(c.skills.length))
      throw new Error(`Unsupported operator shape: ${id}`);
    return [
      id,
      {
        id,
        name: c.name,
        description: c.description,
        rarity,
        profession: c.profession,
        subProfessionId: c.subProfessionId,
        position: c.position,
        nationId: c.nationId,
        groupId: c.groupId,
        teamId: c.teamId,
        phases: c.phases.map((p) => ({
          maxLevel: p.maxLevel,
          attributesKeyFrames: p.attributesKeyFrames,
          rangeGrid: ranges[p.rangeId].grids.map((p) => [p.row, p.col]),
        })),
        favorKeyFrames: c.favorKeyFrames,
        potentialRanks: c.potentialRanks.map(
          (p) => p.buff?.attributes?.attributeModifiers ?? [],
        ),
        trait: c.trait ? {
          ...c.trait,
          candidates: c.trait.candidates.map((candidate) => candidate.rangeId
            ? { ...candidate, rangeGrid: ranges[candidate.rangeId].grids.map((p) => [p.row, p.col]) }
            : candidate),
        } : null,
        talents: c.talents.map((talent) => ({
          ...talent,
          candidates: (talent.candidates ?? []).map((candidate) => candidate.rangeId
            ? { ...candidate, rangeGrid: ranges[candidate.rangeId].grids.map((p) => [p.row, p.col]) }
            : candidate),
        })),
        skills: c.skills.map((s) => ({
          id: s.skillId,
          unlockCondition: s.unlockCond,
          levels: skills[s.skillId].levels.map(level => level.rangeId
            ? { ...level, rangeGrid: ranges[level.rangeId].grids.map(p => [p.row, p.col]) } : level),
        })),
      },
    ];
}
export function compileOperatorRecord(id, tables) {
  return compileOperator(id, tables)[1];
}
export function operatorChannel(id, support) {
  const channel = support?.sourceChannel ?? 'global';
  if (!['global', 'cn'].includes(channel)) throw Error(`Unknown operator source channel: ${id} (${channel})`);
  return channel;
}
export function compileReviewedOperators({ registry, global, cn }) {
  return Object.fromEntries(Object.entries(registry).map(([id, support]) => {
    const channel = operatorChannel(id, support);
    const tables = channel === 'cn' ? cn : global;
    if (!tables) throw Error(`Missing pinned ${channel} operator tables: ${id}`);
    return compileOperator(id, tables);
  }));
}
