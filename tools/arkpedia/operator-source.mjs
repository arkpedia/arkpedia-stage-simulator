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
    let tables = channel === 'cn' ? cn : global;
    if (!tables) throw Error(`Missing pinned ${channel} operator tables: ${id}`);
    if (support.sourceForm) {
      if (channel !== 'global' || support.sourceForm !== 'patch')
        throw Error(`Unreviewed alternate-form channel: ${id}`);
      const patch = global.forms, owners = Object.entries(patch?.infos ?? {})
        .filter(([, info]) => info.tmplIds.includes(id));
      if (!patch?.patchChars?.[id] || owners.length !== 1 || !patch.unlockConds[id]
        || patch.patchDetailInfoList[id]?.patchId !== id)
        throw Error(`Missing complete Global alternate-form data: ${id}`);
      if (global.characters[id]) throw Error(`Conflicting Global alternate-form record: ${id}`);
      tables = { ...global, characters: { ...global.characters, [id]: patch.patchChars[id] } };
      const record = compileOperatorRecord(id, tables);
      record.formOf = owners[0][0];
      record.sourceName = record.name;
      record.formClass = patch.patchDetailInfoList[id].infoParam;
      record.name = `${record.name} (${record.formClass})`;
      record.formUnlock = patch.unlockConds[id];
      return [id, record];
    }
    const [key, record] = compileOperator(id, tables);
    if (support.displayNameFrom) {
      const appellation = tables.characters[id].appellation;
      if (channel !== 'cn' || !['appellation', 'assetName'].includes(support.displayNameFrom)
        || typeof appellation !== 'string' || !appellation.trim())
        throw Error(`Missing reviewed CN appellation: ${id}`);
      record.sourceName = record.name; record.name = appellation; record.sourceChannel = channel;
      if (support.displayNameFrom === 'assetName') {
        if (typeof support.assetName !== 'string' || !support.assetName.trim() || /[\\/]/.test(support.assetName))
          throw Error(`Missing reviewed CN asset name: ${id}`);
        record.sourceAppellation = appellation; record.name = support.assetName;
      }
    }
    if (support.skillIconFiles) {
      if (channel !== 'cn' || Object.keys(support.skillIconFiles).length !== record.skills.length)
        throw Error(`Incomplete reviewed CN skill artwork: ${id}`);
      for (const skill of record.skills) {
        const file = support.skillIconFiles[skill.id];
        if (typeof file !== 'string' || !file.endsWith('.webp') || /[\\/]/.test(file))
          throw Error(`Missing reviewed CN skill icon: ${id}/${skill.id}`);
        skill.assetIcon = `skill-icons/${file}`;
      }
    }
    if (support.secondaryFactions) {
      const c = tables.characters[id];
      record.factionTags = [...new Set([c, c.mainPower, ...(c.subPower ?? [])]
        .filter(Boolean).flatMap(power => ['nationId', 'groupId', 'teamId'].map(k => power[k]))
        .filter(value => typeof value === 'string' && value))];
    }
    return [key, record];
  }));
}
