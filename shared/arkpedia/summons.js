// SPDX-License-Identifier: GPL-3.0-or-later
// Only explicitly reviewed regular-stage tokens may enter the deployment deck.
export const REGULAR_SUMMONS = Object.freeze({
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
  if (config.tacticalPoint) stats.respawnTime = talents[0].bb.interval;
  if (!Number.isSafeInteger(stats.maxDeployCount) || stats.maxDeployCount < 1 || !phase.rangeGrid?.length)
    throw Error('Unsupported summon source limits or range');
  return { id: source.id, name: source.name, profession: source.profession,
    subProfessionId: source.subProfessionId, position: source.position, stats,
    rangeGrid: phase.rangeGrid, dmgType: 'phys', attackKind: 'melee', canHitFly: false,
    abnormal: config.healFree ? ['healFree'] : [], talents, skill: null,
    arkpedia: { elite: build.elite, level: build.level, potential: build.potential },
  };
}
