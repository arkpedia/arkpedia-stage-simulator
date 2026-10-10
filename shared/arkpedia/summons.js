// SPDX-License-Identifier: GPL-3.0-or-later
// Only explicitly reviewed regular-stage tokens may enter the deployment deck.
export const REGULAR_SUMMONS = Object.freeze({
  char_4123_ela: Object.freeze({ tokenId: 'token_10033_ela_grzmot',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: true,
    refundRatio: 0, noAttack: true, sourceStockLimit: true,
    includeReadyCardInStock: true, excludeWalkingEnemy: true }),
  char_4117_ray: Object.freeze({ tokenId: 'token_10034_ray_sndbst',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: false,
    refundRatio: .5, noAttack: true, minimumElite: 1, rechargeOnFinish: true,
    stockLimit: 1, limitByHostAttackRange: true }),
  char_4055_bgsnow: Object.freeze({ tokenId: 'token_10026_bgsnow_subbow',
    deploymentSlotCost: 0, chooseFacing: true, healFree: true,
    refundRatio: 0, rechargeOnFinish: true, preserveCooldown: true }),
  char_1012_skadi2: Object.freeze({ tokenId: 'token_10017_skadi2_dedant',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: false,
    refundRatio: 0, noAttack: true, minimumElite: 1, rechargeOnFinish: true }),
  char_4048_doroth: Object.freeze({ tokenId: 'token_10025_doroth_recttp',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: true,
    refundRatio: 0, noAttack: true, sourceStockLimit: true,
    includeReadyCardInStock: true, excludeWalkingEnemy: true }),
  char_4140_lasher: Object.freeze({ tokenId: 'token_10036_lasher_mcbird',
    deploymentSlotCost: 1, chooseFacing: true, healFree: true,
    refundRatio: .5, attackClip: 'Attack', sourceStockLimit: true, readyCardPlusStack: true }),
  char_1034_jesca2: Object.freeze({ tokenId: 'token_10032_jesca2_jckshd',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: true,
    refundRatio: .5, noAttack: true, rechargeOnFinish: true, adjacentToHost: true }),
  char_400_weedy: Object.freeze({ tokenId: 'token_10009_weedy_cannon',
    deploymentSlotCost: 0, chooseFacing: true, healFree: false, refundRatio: .5,
    minimumElite: 1, rechargeOnFinish: true, preserveCooldown: true }),
  char_4171_wulfen: Object.freeze({ tokenId: 'token_10044_wulfen_mine',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: true,
    refundRatio: 0, noAttack: true, sourceStockLimit: true,
    includeReadyCardInStock: true, excludeWalkingEnemy: true }),
  char_242_otter: Object.freeze({ tokenId: 'token_10004_otter_motter',
    deploymentSlotCost: 1, chooseFacing: false, healFree: true, refundRatio: .5,
    attackClip: 'Attack', additiveBornStock: true, bornStockBudget: true }),
  char_458_rfrost: Object.freeze({ tokenId: 'token_10016_rfrost_mine',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: true,
    refundRatio: 0, noAttack: true, sourceStockLimit: true,
    includeReadyCardInStock: true, excludeWalkingEnemy: true }),
  char_451_robin: Object.freeze({ tokenId: 'token_10013_robin_mine',
    deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true, healFree: true,
    refundRatio: 0, noAttack: true, sourceStockLimit: true,
    includeReadyCardInStock: true, excludeWalkingEnemy: true }),
  char_4162_cathy: Object.freeze({ tokenId: 'token_10041_cathy_catsld',
    deploymentSlotCost: 0, chooseFacing: true, healFree: true, refundRatio: .5, noAttack: true }),
  char_4178_alanna: Object.freeze({ tokenId: 'token_10045_alanna_crane',
    deploymentSlotCost: 0, chooseFacing: true, healFree: true,
    refundRatio: .5, noAttack: true, additiveBornStock: true }),
  char_433_windft: Object.freeze({ tokenId: 'token_10023_windft_wrench',
    deploymentSlotCost: 0, chooseFacing: true, healFree: true,
    refundRatio: 0, noAttack: true }),
  char_427_vigil: Object.freeze({ tokenId: 'token_10028_vigil_wolf',
    deploymentSlotCost: 0, chooseFacing: false, healFree: true, refundRatio: 0,
    attackClip: 'Attack', stockLimit: 1, tacticalPoint: true, limitByHostAttackRange: true }),
  char_476_blkngt: Object.freeze({ tokenId: 'token_10021_blkngt_hypnos',
    deploymentSlotCost: 0, chooseFacing: false, healFree: true,
    refundRatio: 0, attackClip: 'Attack', stockLimit: 1, tacticalPoint: true,
    limitByHostAttackRange: true }),
  char_336_folivo: Object.freeze({ tokenId: 'token_10010_folivo_car',
    deploymentSlotCost: 1, chooseFacing: true, healFree: true,
    refundRatio: .5, attackClip: 'Attack', sourceStockLimit: true }),
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
  char_391_rosmon: Object.freeze(['token_10012_rosmon_shield']),
  char_1033_swire2: Object.freeze(['token_10031_swire2_gdtrap']),
  char_1019_siege2: Object.freeze(['token_10040_siege2_vlion']),
  char_4046_ebnhlz: Object.freeze(['token_10024_ebnhlz_rcube']),
  char_4164_tecno: Object.freeze(['token_10042_tecno_puppet']),
  char_4016_kazema: Object.freeze(['token_10022_kazema_shadow']),
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
  for (const talent of talents) {
    stats.maxDeployCount += talent.bb.max_deploy_count ?? 0;
    if (config.sourceStockLimit) stats.maxDeckStackCnt += talent.bb.max_deck_stack_cnt ?? 0;
  }
  let skill = null;
  if (ownerId === 'char_4123_ela') {
    const index = ['skchr_ela_1', 'skchr_ela_2', 'skchr_ela_3'].indexOf(build.skillId);
    const id = `sktok_ela_${index + 1}`, entry = source.skills?.find(s => s.id === id);
    if (!entry || index < 0 || index > build.elite || !Number.isSafeInteger(build.skillRank)
      || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
      || !Number.isSafeInteger(build.potential) || build.potential < 1 || build.potential > 6
      || build.module && build.module !== 'none') throw Error('Unsupported Ela mine build');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    if (!level || level.prefabId !== id || bb.projectile_range !== 1.7
      || stats.cost !== 5 || stats.respawnTime !== 5 || stats.maxDeployCount !== [2, 3, 4][build.elite])
      throw Error('Unreviewed Ela mine source');
    skill = { skillId: id, name: level.name, bb, trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_400_weedy' && build.skillId === 'skchr_weedy_3') {
    const entry = source.skills?.find(s => s.id === 'sktok_weedy_token');
    if (!entry || build.elite !== 2 || !Number.isSafeInteger(build.skillRank)
      || build.skillRank < 1 || build.skillRank > 10) throw Error('Unsupported Weedy cannon skill rank');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = ['force', 'stun', 'atk_scale', 'duration', 'dist', 'value', 'interval'];
    if (level.prefabId !== entry.id || level.skillType !== 'MANUAL' || !level.rangeGrid?.length
      || Object.keys(bb).length !== keys.length || keys.some(k => !Number.isFinite(bb[k])))
      throw Error('Unreviewed Weedy cannon source');
    skill = { skillId: entry.id, name: level.name, bb, rangeGrid: level.rangeGrid,
      trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_4171_wulfen') {
    const index = ['skchr_wulfen_1', 'skchr_wulfen_2'].indexOf(build.skillId);
    const id = ['sktok_wulfen_1', 'sktok_wulfen_2'][index];
    const entry = source.skills?.find(row => row.id === id);
    const elite = phaseNumber(entry?.unlockCondition?.phase);
    if (!entry || !Number.isInteger(elite) || build.elite < elite
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error('Unsupported Wulfenite trap skill or rank');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = index ? ['cnt', 'atk_scale', 'def', 'duration'] : ['cnt', 'atk_scale', 'stun'];
    if (level.skillType !== 'MANUAL' || level.prefabId !== id
      || level.spData.spType !== 'INCREASE_WITH_TIME' || level.spData.spCost !== 8
      || level.spData.initSp !== 0 || level.spData.maxChargeTime !== 1
      || Object.keys(bb).length !== keys.length || keys.some(k => !Number.isFinite(bb[k]))
      || index === 1 && !level.rangeGrid?.length)
      throw Error('Unreviewed Wulfenite trap source');
    skill = { skillId: id, name: level.name, skillType: level.skillType,
      durationType: level.durationType, duration: level.duration, description: level.description,
      rangeGrid: level.rangeGrid, ...level.spData, bb, trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_4055_bgsnow') {
    const index = ['skchr_bgsnow_1', 'skchr_bgsnow_2', 'skchr_bgsnow_3'].indexOf(build.skillId);
    const id = ['sktok_bgsnow_1', 'sktok_bgsnow_2', 'sktok_bgsnow_3'][index];
    const entry = source.skills?.find(row => row.id === id);
    if (!entry || index > build.elite || !Number.isSafeInteger(build.skillRank)
      || build.skillRank < 1 || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error('Unsupported Typewriter skill or rank');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = index === 0 ? ['atk', 'prob', 'atk_scale'] : index === 1 ? ['atk_scale', 'respawn_time']
      : ['attack@atk_scale', 'base_attack_time'];
    if (level.skillType !== 'MANUAL' || level.prefabId !== id || level.spData.spType !== 8
      || level.spData.spCost !== 0 || Object.keys(bb).length !== keys.length
      || keys.some(k => !Number.isFinite(bb[k])) || index === 2 && !level.rangeGrid?.length
      || stats.cost !== 5 || stats.respawnTime !== 40 || stats.maxDeployCount !== 1
      || stats.blockCnt !== 0 || talents[0]?.bb.interval !== [15, 20, 25][build.elite])
      throw Error('Unreviewed Typewriter source');
    skill = { skillId: id, name: level.name, bb, rangeGrid: level.rangeGrid,
      trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_1012_skadi2') {
    const index = ['skchr_skadi2_1', 'skchr_skadi2_2', 'skchr_skadi2_3'].indexOf(build.skillId);
    const id = ['sktok_skadi2_1', 'sktok_skadi2_2', 'sktok_skadi2_3'][index];
    const entry = source.skills?.find(row => row.id === id);
    if (!entry || build.elite < 1 || index === 2 && build.elite < 2
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error('Unsupported Skadi Seaborn skill or rank');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = index === 0 ? ['max_hp', 'attack@atk_to_hp_recovery_ratio', 'damage_resistance']
      : index === 1 ? ['atk', 'def', 'attack@atk_to_hp_recovery_ratio'] : ['atk_scale', 'atk'];
    if (level.skillType !== 'PASSIVE' || level.prefabId !== id || level.duration !== -1
      || level.spData.spCost !== 0 || level.spData.spType !== 8
      || Object.keys(bb).length !== keys.length || keys.some(k => !Number.isFinite(bb[k]))
      || stats.cost !== 5 || stats.respawnTime !== 30 || stats.maxDeployCount !== 1
      || talents[0]?.bb.duration !== [0, 15, 25][build.elite])
      throw Error('Unreviewed Skadi Seaborn source');
    skill = { skillId: id, name: level.name, bb, trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_4048_doroth') {
    const index = ['skchr_doroth_1', 'skchr_doroth_2', 'skchr_doroth_3'].indexOf(build.skillId);
    const id = ['sktok_doroth_1', 'sktok_doroth_2', 'sktok_doroth_3'][index];
    const entry = source.skills?.find(row => row.id === id);
    const elite = phaseNumber(entry?.unlockCondition?.phase);
    if (!entry || !Number.isInteger(elite) || build.elite < elite
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error('Unsupported Dorothy Resonator skill or rank');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = index === 0 ? ['cnt', 'atk_scale', 'def', 'duration']
      : index === 1 ? ['cnt', 'atk_scale', 'cnt_2', 'duration', 'duration_2']
      : ['cnt', 'atk_scale', 'sluggish', 'interval'];
    if (level.skillType !== 'AUTO' || level.prefabId !== id || level.spData.spCost !== 0
      || Object.keys(bb).length !== keys.length || keys.some(k => !Number.isFinite(bb[k]))
      || index === 2 && !level.rangeGrid?.length)
      throw Error('Unreviewed Dorothy Resonator source');
    skill = { skillId: id, name: level.name, bb, rangeGrid: level.rangeGrid, trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_4162_cathy') {
    const ids = ['sktok_cathy_catsld_1', 'sktok_cathy_catsld_2'];
    if (source.skills?.length !== ids.length || source.skills.some((s, i) =>
      s.id !== ids[i] || s.levels?.length !== 1 || s.levels[0].prefabId !== ids[i]
      || s.levels[0].skillType !== 'PASSIVE' || s.levels[0].spData.spCost !== 0
      || s.levels[0].duration !== 0 || s.levels[0].blackboard?.length !== 0))
      throw Error('Unreviewed Catherine passive device skill');
    // Both original token prefabs are empty passives. No recycle button or
    // charge-replenishment ability is inferred from an unused DB template.
  }
  if (['char_451_robin', 'char_458_rfrost'].includes(ownerId)) {
    const name = ownerId === 'char_451_robin' ? 'robin' : 'rfrost';
    const index = [`skchr_${name}_1`, `skchr_${name}_2`].indexOf(build.skillId);
    const id = [`sktok_${name}_1`, `sktok_${name}_2`][index];
    const entry = source.skills?.find(row => row.id === id);
    const elite = phaseNumber(entry?.unlockCondition?.phase);
    if (!entry || !Number.isInteger(elite) || build.elite < elite
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error(`Unsupported ${name === 'robin' ? 'Robin' : 'Frost'} trap skill or rank`);
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = name === 'rfrost' && index === 0 ? ['cnt', 'atk_scale', 'stun']
      : index === 0 || name === 'rfrost' ? ['cnt', 'atk_scale', 'constraint'] : ['cnt', 'atk_scale', 'force'];
    if (level.skillType !== 'AUTO' || level.prefabId !== id || level.spData.spCost !== 0
      || Object.keys(bb).length !== keys.length || keys.some(key => !Number.isFinite(bb[key])))
      throw Error(`Unreviewed ${name === 'robin' ? 'Robin' : 'Frost'} trap source`);
    skill = { skillId: id, name: level.name, bb, trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_242_otter') {
    const index = ['skchr_otter_1', 'skchr_otter_2'].indexOf(build.skillId);
    const id = ['sktok_motter_1', 'sktok_motter_2'][index];
    const entry = source.skills?.find(row => row.id === id);
    const elite = phaseNumber(entry?.unlockCondition?.phase);
    if (!entry || !Number.isInteger(elite) || build.elite < elite
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > Math.min([4, 7, 10][build.elite], entry.levels.length))
      throw Error('Unsupported Mayer Robotter skill or rank');
    const level = entry.levels[build.skillRank - 1], bb = blackboard(level.blackboard);
    const keys = index ? ['atk_scale', 'stun'] : ['prob'];
    if (level.prefabId !== id || level.skillType !== (index ? 'MANUAL' : 'PASSIVE')
      || level.spData.spCost !== 0 || !level.rangeGrid?.length
      || Object.keys(bb).length !== keys.length || keys.some(key => !Number.isFinite(bb[key])))
      throw Error('Unreviewed Mayer Robotter skill source');
    skill = { skillId: id, name: level.name, bb, rangeGrid: level.rangeGrid,
      trigger: { rule: 'NEVER' } };
  }
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
  if (ownerId === 'char_4117_ray') {
    const index = ['skchr_ray_1', 'skchr_ray_2', 'skchr_ray_3'].indexOf(build.skillId);
    if (![1, 2].includes(build.elite) || index < 0 || index > build.elite
      || !Number.isSafeInteger(build.skillRank) || build.skillRank < 1
      || build.skillRank > [4, 7, 10][build.elite]
      || stats.cost !== 3 || stats.respawnTime !== 30 || stats.maxDeployCount !== 1
      || stats.blockCnt !== 0 || talents[0]?.bb.duration !== (build.elite === 1 ? 15 : 25))
      throw Error('Unreviewed Ray Sandbeast build or stats');
    if (source.skills?.length !== 3 || source.skills[0].id !== null || source.skills[0].levels.length
      || source.skills[2].id !== null || source.skills[2].levels.length
      || source.skills[1].id !== 'sktok_ray_2' || source.skills[1].levels.length !== 10
      || source.skills[1].levels.some(l => l.prefabId !== 'sktok_ray_2'
        || l.skillType !== 'PASSIVE' || l.spData.spCost !== 0 || l.blackboard.length !== 0))
      throw Error('Unreviewed Sandbeast original skill slots');
    if (index === 1) skill = { skillId: 'sktok_ray_2', name: source.skills[1].levels[build.skillRank - 1].name,
      bb: {}, trigger: { rule: 'NEVER' } };
  }
  if (ownerId === 'char_427_vigil') {
    const index = ['skchr_vigil_1', 'skchr_vigil_2', 'skchr_vigil_3'].indexOf(build.skillId);
    if (index < 0 || index > build.elite || !Number.isSafeInteger(build.skillRank)
      || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
      || stats.cost !== 0 || stats.respawnTime !== 10 || stats.maxDeployCount !== 1
      || stats.blockCnt !== 0 || talents[0]?.bb.interval !== [30, 27, 25][build.elite])
      throw Error('Unreviewed Vigil Wolfpack build or stats');
    const ids = ['sktok_vigil_wolf_1', 'sktok_vigil_wolf_2', 'sktok_vigil_wolf_3'];
    if (source.skills?.length !== 3 || source.skills.some((s, i) => s.id !== ids[i]
      || s.levels.length !== [1, 1, 10][i] || s.levels.some(l => l.prefabId !== ids[i]
        || l.skillType !== 'PASSIVE' || l.spData.spCost !== 0
        || i < 2 && l.blackboard.length !== 0))) throw Error('Unreviewed Wolfpack source skills');
    const bb = blackboard(source.skills[2].levels[build.skillRank - 1].blackboard);
    if (Object.keys(bb).length !== 1 || !Number.isFinite(bb['attack@vigil_wolf_s_3.atk_scale']))
      throw Error('Unreviewed Wolfpack S3 coefficient');
  }
  if (config.tacticalPoint) stats.respawnTime = talents[0].bb.interval;
  // Reviewed trap stock combines the ready card with native stacked cards:
  // Robin/Frost 6/8/10, Wulfenite 2/3/4. Other summons retain their semantics.
  if (config.includeReadyCardInStock) {
    if (stats.maxDeckStackCnt + 1 !== stats.maxDeployCount
      || stats.maxDeployCount !== (['char_4171_wulfen', 'char_4123_ela'].includes(ownerId) ? [2, 3, 4] : [6, 8, 10])[build.elite])
      throw Error('Unreviewed trap total stored capacity');
    stats.maxDeckStackCnt++;
  }
  if (config.sourceStockLimit && (!Number.isSafeInteger(stats.maxDeckStackCnt) || stats.maxDeckStackCnt < 1))
    throw Error('Unsupported summon source stock limit');
  if (config.readyCardPlusStack) {
    if (ownerId !== 'char_4140_lasher' || stats.maxDeckStackCnt !== 4 || stats.maxDeployCount !== 5)
      throw Error('Unreviewed Clockwork Fowlbeast stored capacity');
    stats.maxDeckStackCnt++;
  }
  if (!Number.isSafeInteger(stats.maxDeployCount) || stats.maxDeployCount < 1 || !phase.rangeGrid?.length)
    throw Error('Unsupported summon source limits or range');
  return { id: source.id, name: source.name, profession: source.profession,
    subProfessionId: source.subProfessionId, position: source.position, stats,
    rangeGrid: phase.rangeGrid, dmgType: 'phys', attackKind: 'melee', canHitFly: ownerId === 'char_4055_bgsnow',
    abnormal: config.healFree ? ['healFree'] : [], talents, skill,
    arkpedia: { elite: build.elite, level: build.level, potential: build.potential,
      ...(['char_250_phatom', 'char_400_weedy'].includes(ownerId) ? { skillRank: build.skillRank } : {}) },
  };
}
