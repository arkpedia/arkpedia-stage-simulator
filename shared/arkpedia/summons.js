// SPDX-License-Identifier: GPL-3.0-or-later
// Only explicitly reviewed regular-stage tokens may enter the deployment deck.
export const REGULAR_SUMMONS = Object.freeze({
  char_003_kalts: Object.freeze({ tokenId: 'token_10002_kalts_mon3tr',
    deploymentSlotCost: 1, chooseFacing: true, healFree: true,
    refundRatio: .5, attackClip: 'Attack', stockLimit: 1,
    rechargeOnFinish: true }),
  char_1031_slent2: Object.freeze({ tokenId: 'token_10029_slent2_protrb',
    deploymentSlotCost: 0, chooseFacing: false, healFree: false,
    refundRatio: .5, noAttack: true, skillId: 'skchr_slent2_2', stockLimit: 1,
    requiresActiveSkill: true, rechargeOnFinish: true }),
  char_250_phatom: Object.freeze({ tokenId: 'token_10007_phatom_twin',
    deploymentSlotCost: 1, chooseFacing: true, healFree: true,
    refundRatio: .5, minimumElite: 1, attackClip: 'Attack' }),
  char_108_silent: Object.freeze({ tokenId: 'token_10000_silent_healrb',
    deploymentSlotCost: 0, chooseFacing: false, healFree: false,
    refundRatio: .5, noAttack: true, skillId: 'skchr_silent_2', stockLimit: 1 }),
  char_179_cgbird: Object.freeze({ tokenId: 'token_10003_cgbird_bird',
    deploymentSlotCost: 0, chooseFacing: false, healFree: true,
    refundRatio: .5, noAttack: true, minimumElite: 2, talentIndex: 1, additiveBornStock: true }),
  char_110_deepcl: Object.freeze({ tokenId: 'token_10001_deepcl_tentac',
    deploymentSlotCost: 1, chooseFacing: false, healFree: true,
    refundRatio: .5, attackClip: 'Attack' }),
  char_484_robrta: Object.freeze({ tokenId: 'token_10018_robrta_mach',
    deploymentSlotCost: 0, chooseFacing: true, healFree: true,
    refundRatio: .5, noAttack: true }),
  char_452_bstalk: Object.freeze({ tokenId: 'token_10014_bstalk_crab',
    deploymentSlotCost: 0, chooseFacing: false, healFree: true,
    refundRatio: 0, attackClip: 'Y_Attack', tacticalPoint: true,
    limitByHostAttackRange: true }),
  char_254_vodfox: Object.freeze({ tokenId: 'token_10006_vodfox_doll',
    deploymentSlotCost: 0, chooseFacing: false, healFree: false,
    refundRatio: .5, noAttack: true, skillId: 'skchr_vodfox_2', stockLimit: 1 }),
});

// Automatic source spawns have no deployment-deck card, but their original
// models must load with the owner before battle can draw the spawned unit.
export const REGULAR_AUTOMATIC_TOKENS = Object.freeze({
  char_344_beewax: Object.freeze(['token_10011_beewax_oblisk']),
  char_2015_dusk: Object.freeze(['token_10015_dusk_drgn']),
  char_113_cqbw: Object.freeze(['token_10008_cqbw_box']),
  char_1014_nearl2: Object.freeze(['token_10019_nearl2_sword']),
});

export function regularTokenIdsFor(ownerIds) {
  return [...new Set(ownerIds.flatMap(id => [
    ...(REGULAR_SUMMONS[id] ? [REGULAR_SUMMONS[id].tokenId] : []),
    ...(REGULAR_AUTOMATIC_TOKENS[id] ?? []),
  ]))];
}

export const summonCardId = ownerId => `summon:${ownerId}`;
export const summonUnitId = unit => `token:${unit.id}`;
const blackboard = rows => Object.fromEntries((rows ?? []).map(row => [row.key, row.value]));
const phaseNumber = phase => Number(String(phase).replace('PHASE_', ''));
export function sourceCandidate(candidates, build) {
  return (candidates ?? []).filter(candidate => {
    const phase = phaseNumber(candidate.unlockCondition?.phase);
    return Number.isInteger(phase) && (build.elite > phase ||
      build.elite === phase && build.level >= candidate.unlockCondition.level)
      && build.potential - 1 >= (candidate.requiredPotentialRank ?? 0);
  }).at(-1);
}

/** Tokens use their own source keyframes at their owner's elite and level.
 * Trust bonuses and owner potential stat modifiers never transfer to them. */
export function summonRecordFor(ownerId, build, tokens) {
  const config = REGULAR_SUMMONS[ownerId], source = tokens?.[config?.tokenId];
  if (!config || !source || source.id !== config.tokenId)
    throw Error(`Missing reviewed summon source: ${ownerId}`);
  const phase = source.phases?.[build.elite];
  if (!phase || !Number.isSafeInteger(build.level) || build.level < 1 || build.level > phase.maxLevel)
    throw Error('Invalid summon owner promotion or level');
  const low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = high.level === low.level ? 0 : (build.level - low.level) / (high.level - low.level);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => [key, value + ((high.data[key] ?? value) - value) * ratio]));
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key]);
  const talents = (source.talents ?? []).map(talent => sourceCandidate(talent.candidates, build))
    .filter(Boolean).map(talent => ({ ...talent, bb: blackboard(talent.blackboard) }));
  for (const talent of talents) stats.maxDeployCount += talent.bb.max_deploy_count ?? 0;
  let skill = null;
  if (ownerId === 'char_250_phatom') {
    for (const talent of talents) stats.respawnTime += talent.bb.respawn_time ?? 0;
    const index = ['skchr_phatom_1', 'skchr_phatom_2', 'skchr_phatom_3'].indexOf(build.skillId);
    const id = ['sktok_phatom_1', 'sktok_phatom_2', 'sktok_phatom_3'][index];
    const entry = source.skills?.find(row => row.id === id);
    const unlock = entry?.unlockCondition;
    const elite = phaseNumber(unlock?.phase);
    if (!entry || !Number.isInteger(elite) || build.elite < elite
      || build.elite === elite && build.level < unlock.level
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error('Unsupported Phantom clone skill or rank');
    const level = entry.levels[build.skillRank - 1];
    if (level.skillType !== 'PASSIVE' || level.prefabId !== id || level.spData.spCost !== 0)
      throw Error('Unreviewed Phantom clone skill source');
    const bb = blackboard(level.blackboard);
    const keys = index === 0 ? ['prob', 'hp_ratio', 'duration'] : index === 1 ? ['times', 'atk']
      : ['atk_scale', 'force', 'sluggish', 'root', 'stun'];
    if (Object.keys(bb).length !== keys.length || keys.some(key => !Number.isFinite(bb[key]))
      || index === 1 && (!Number.isSafeInteger(bb.times) || bb.times < 1)
      || index === 2 && !level.rangeGrid?.length)
      throw Error('Unreviewed Phantom clone blackboard or range');
    skill = { skillId: id, name: level.name, skillType: level.skillType,
      durationType: level.durationType, duration: level.duration,
      rangeGrid: level.rangeGrid, ...level.spData, bb,
      trigger: { rule: 'NEVER' } };
  }
  if (config.tacticalPoint) stats.respawnTime = talents[0].bb.interval;
  if (!Number.isSafeInteger(stats.maxDeployCount) || stats.maxDeployCount < 1 || !phase.rangeGrid?.length)
    throw Error('Unsupported summon source limits or range');
  return { id: source.id, name: source.name, profession: source.profession,
    subProfessionId: source.subProfessionId, position: source.position, stats,
    rangeGrid: phase.rangeGrid, dmgType: 'phys', attackKind: 'melee', canHitFly: false,
    abnormal: config.healFree ? ['healFree'] : [], talents, skill,
    arkpedia: { elite: build.elite, level: build.level, potential: build.potential,
      ...(ownerId === 'char_250_phatom' ? { skillRank: build.skillRank } : {}) },
  };
}
