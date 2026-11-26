// SPDX-License-Identifier: GPL-3.0-or-later
// Charles Lynch (trap_158_lrsteam, PRTS 查尔斯·林奇; 14-10): an ally-side device a wave action deploys. Reviewed from the
// pinned prefab, its skill prefab sktok_lrsteam, the projectile projectile_trap_lrsteam and the record.
// - Root: side 1 (ally), category 1, one mode; block 99 (record), block radius² 0.5.
// - Default mode: an ordinary attack (`_attackType` 1, `_damageType` 1 Physical, ATK x1) on one ground enemy it blocks
//   (`_maxNum` 1 limited to its block count) in range 1-1 (its own tile and the one it faces), paced by the record's
//   3.75 s attack interval.
// - Common ability `trap_lrsteam_passive` (for life): HEAL_FREE (flag 7: it cannot be healed) and immunity to STUNNED (0),
//   SILENCED (12) and FROZEN (16).
// - Skill sktok_lrsteam 誓死 (AUTO, 116/120 SP, +1 SP/s, `atk_scale` 2.05): it casts 4 s after it is deployed. After a
//   2.83 s wind-up it fires three volleys 0.3 s apart (`_additionalTimes` 2, `_triggerDelta` 0.3). Each volley selects
//   up to 5 targets (`_maxNum` 5, random beyond that) inside a 3x3 box centred two tiles ahead (collider offset y 2, size
//   3x3), ground enemies (`_targetMotion` 1) [inference: filter type 23 is read as tiles holding an enemy]. Each target
//   takes one shell, Physical, ATK x2.05, 0.3 s after it is fired (`_delayTime`). The skill's 4 s `duration` is its cast
//   cycle; it does not attack normally meanwhile.
// - Record (level 1): 20000 HP, 1500 ATK, 600 DEF, 50 RES.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const CHARLES_LYNCH = 'trap_158_lrsteam';

export function charlesLynchNativeReviewed(e = native, t = tables) {
  const P = e.prefabs?.[CHARLES_LYNCH]?.components ?? [], K = e.prefabs?.sktok_lrsteam?.components ?? [];
  const R = e.prefabs?.projectile_trap_lrsteam?.components ?? [], S = e.statusDefinitions ?? {};
  const at = (rows, id) => rows.find(c => c.pathId === String(id))?.data;
  const root = P.map(c => c.data).find(c => '_modes' in c);
  const mode = at(P, root?._modes?.[0]?.m_PathID), attack = at(P, mode?._attack?.m_PathID);
  const selector = at(P, attack?._selector?.m_PathID), trigger = at(P, mode?._attackTrigger?.m_PathID);
  const range = P.map(c => c.data).find(c => '_rangeId' in c);
  const passive = at(P, root?._commonAbilities?.[0]?.m_PathID)?._buffs;
  const skillRoot = K.map(c => c.data).find(c => '_rangeIdUsageType' in c);
  const shot = K.map(c => c.data).find(c => c._projectileKey);
  const box = K.map(c => c.data).find(c => c.m_Size), pick = at(K, shot?._selector?.m_PathID);
  const splash = R.map(c => c.data).find(c => c.m_Radius !== undefined);
  const hit = R.map(c => c.data).find(c => '_alwaysHitTraceTargetInTheEnd' in c);
  const delay = R.map(c => c.data).find(c => '_delayTime' in c);
  const record = t.devices?.[CHARLES_LYNCH], frames = record?.phases?.[0]?.attributesKeyFrames ?? [];
  const skill = t.skills?.sktok_lrsteam?.levels;
  return root?._sideType === 1 && root._category === 1 && root._modes.length === 1 && root._blockRadiusSquare === .5
    && root._commonAbilities?.length === 1
    && mode._generalAbilities?.length === 0 && attack?._attackType === 1 && attack._damageType === 1 && attack._atkScale === 1
    && attack._cooldown === 0 && attack._activeBuffs?.length === 0
    && selector?._targetSide === 2 && selector._targetMotion === 1 && selector._maxNum === 1 && selector._limitedMaxTargetNumToBlockedCnt === 1
    && trigger?._minTargetNum === 1 && range?._rangeId === '1-1' && same(t.ranges?.['1-1']?.grids, [{ row: 0, col: 0 }, { row: 0, col: 1 }])
    && passive?.length === 1 && passive[0].lifeTimeType === 2 && same(passive[0].attributes.abnormalFlags, [S.HEAL_FREE]) && S.HEAL_FREE === 7
    && same(passive[0].attributes.abnormalImmunes, [S.STUNNED, S.SILENCED, S.FROZEN]) && S.STUNNED === 0 && S.SILENCED === 12 && S.FROZEN === 16
    && passive[0].attributes.attributeModifiers.length === 0
    && skillRoot?._allowNoTarget === 1 && skillRoot._canCastDuringBorn === 1
    && shot?._projectileKey === 'projectile_trap_lrsteam' && shot._damageType === 1 && shot._atkScaleKey === 'atk_scale' && shot._attackType === 1
    && Math.abs(shot._preDelay - 2.83) < 1e-6 && shot._additionalTimes === 2 && Math.abs(shot._triggerDelta - .3) < 1e-6 && shot._cooldownKey === 'duration'
    && same(box?.m_Offset, { x: 0, y: 2 }) && same(box?.m_Size, { x: 3, y: 3 })
    && pick?._filterType === 23 && pick._maxNum === 5 && pick._limitTargetNum === 1 && pick._targetSide === 2 && pick._targetMotion === 1
    && pick._alwaysRandomInTheEnd === 1
    && splash?.m_Radius === 1.5 && hit?._alwaysHitTraceTargetInTheEnd === 1 && Math.abs(delay?._delayTime - .3) < 1e-6
    && record?.profession === 'TRAP' && record.phases.length === 1 && record.phases[0].rangeId === '1-1'
    && frames[0]?.level === 1 && same([frames[0].data.maxHp, frames[0].data.atk, frames[0].data.def, frames[0].data.magicResistance,
      frames[0].data.blockCnt, frames[0].data.baseAttackTime], [20000, 1500, 600, 50, 99, 3.75])
    && skill?.length === 1 && skill[0].skillType === 'AUTO' && skill[0].spData.spType === 'INCREASE_WITH_TIME'
    && skill[0].spData.spCost === 120 && skill[0].spData.initSp === 116 && skill[0].spData.increment === 1 && skill[0].duration === 4
    && same(skill[0].blackboard.map(x => [x.key, x.value]), [['atk_scale', 2.05]]);
}

/** Level 1 only (the one instance the source places). */
export function charlesLynchDefinition(instance) {
  if (!charlesLynchNativeReviewed() || !instance || instance.level !== 1 || instance.skillLevel !== 1
    || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)) throw Error('Unsupported original Charles Lynch instance');
  return { kind: 'charlesLynch', hp: 20000, atk: 1500, def: 600, res: 50, block: 99, bat: 3.75, direction: instance.direction,
    immune: ['stun', 'silence', 'frozen'], sp: 116, spCost: 120, castEvery: 4, windUp: 2.83, volleys: 3, volleyGap: .3,
    shellDelay: .3, atkScale: 2.05, maxTargets: 5, box: { ahead: 2, half: 1 },
    description: 'Blocks every enemy and strikes one it blocks; 4 s after it arrives it bombards up to five enemies in the 3×3 area two tiles ahead with three volleys (205% ATK each).' };
}
