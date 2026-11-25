// SPDX-License-Identifier: GPL-3.0-or-later
// Bloodcalling Altar (trap_125_bonore, PRTS 唤血祭坛; chapter 13). An enemy-side trap (side 2, category 2: no character
// selector takes it, so it cannot be attacked), HEAL_FREE. Skill sktok_bonore (AUTO, 20 SP at 1 SP/s from 0): its
// ability fires projectile_trap_bonore along the Altar's facing (the model's direction, PRTS). The pulse:
// - moves at 8 tiles/s for at most 10 s. Its 3 x 1 box is read as a wave front 3 tiles across the travel and 1 along it
//   (an inference): the Altar's own range validators (SpnwizInRange, SpnwizInRange2) take the Altar's line and one line
//   either side (`_offset` 1) from the Altar's tile onward (`_includeSameLine`), and PRTS describes the affected range
//   as what the pulse sweeps, drawn three lanes wide;
// - every 0.03 s checks the box for enemy-side units (ground and air) carrying `enemy_bonore_mark`;
// - one hit (`_maxHitNum` 1, stop after it) takes every such unit in the box, up to `max_target` (10).
// Each hit unit gets trap_bonore_s: its mark stacks are counted into `buff_cnt`, the mark is finished (Blood Amber:
// enemy_dseed_bonore[action] kills it), and trap_bonore_branch[dfello] is stacked that many times; each stack runs
// PickRandomBranchPhase on the Altar's branch (`talent@branch_id`, set per instance), which never blocks the end.
// Blood Collectors carry one mark per held Amber (enemy-blood-collector-features.js): the pulse turns those into Spawn
// and the Collector survives. A Bone Drifter in its drifting form (enemy_spnwiz_ghost_mark) and Sarkaz pilots react
// differently; stages with them are refused until those reactions are built (server runtime). The bomb's KillBmbcar trigger (radius
// 1) is checked by the bomb (arkpedia-enemy-bombs.js), which then destroys the Altar (destroy()).
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const BLOOD_ALTAR_MARK = 'enemy_bonore_mark';
export const BLOOD_AMBER = 'enemy_1367_dseed';
/** KillBmbcar: a radius-1 trigger circle around the Altar that forces a bomb carrying enemy_bmbcar1_passive to explode. */
export const BLOOD_ALTAR_BOMB_RADIUS = 1;
/** Records the pulse reacts to in ways this runtime does not model yet. */
export const BLOOD_ALTAR_UNMODELLED = Object.freeze(['enemy_1365_spnwiz', 'enemy_1365_spnwiz_2', 'enemy_1368_spilot']);

export function bloodAltarNativeReviewed(e = native, t = tables) {
  const P = k => e.prefabs?.[k]?.components ?? [], rows = k => P(k).map(c => c.data);
  const root = rows('trap_125_bonore').find(c => '_modes' in c);
  const passive = P('trap_125_bonore').find(c => c.object === 'Passive' && c.data._buffs)?.data._buffs?.[0];
  const main = rows('sktok_bonore').find(c => c._projectileKey === 'projectile_trap_bonore');
  const tileSelector = P('sktok_bonore').find(c => c.pathId === String(main?._selector?.m_PathID))?.data;
  const account = rows('sktok_bonore').find(c => '_canCastWithNoSp' in c);
  const pr = rows('projectile_trap_bonore');
  const life = pr.find(c => '_lifeTime' in c), move = pr.find(c => '_speed' in c), check = pr.find(c => '_hitPasserby' in c);
  const box = pr.find(c => c.m_Size), select = pr.find(c => c._buffKey === BLOOD_ALTAR_MARK);
  const T = e.templates ?? {}, s = T.trap_bonore_s?.eventToActions?.ON_BUFF_START?.[0];
  const fail = (s?._failNodes ?? []).map(n => n.$type.split('+')[1].split(',')[0]);
  const stacked = s?._failNodes?.[2], pick = T['trap_bonore_branch[dfello]']?.eventToActions?.ON_BUFF_START?.[0];
  const kill = P('trap_125_bonore').find(c => c.object === 'KillBmbcar' && c.data.m_Radius !== undefined)?.data;
  const killSelect = P('trap_125_bonore').find(c => c.object === 'KillBmbcar' && c.data._buffs)?.data;
  const lines = P('trap_125_bonore').filter(c => c.object === 'Validators' && '_offset' in c.data).map(c => c.data);
  const record = t.devices?.trap_125_bonore, frames = record?.phases?.[0]?.attributesKeyFrames ?? [];
  const skill = t.skills?.sktok_bonore?.levels, bb = Object.fromEntries((skill?.[0]?.blackboard ?? []).map(x => [x.key, x.valueStr ?? x.value]));
  return root?._sideType === 2 && root._category === 2 && root._withdrawable === 0 && root._modes?.length === 1
    && passive?.attributes?.abnormalFlags?.join() === '7' && passive.lifeTimeType === 2
    && account?._canCastWithNoSp === 0
    && main?._cooldown === 1 && main._allowNoTarget === 0 && main._activeBuffs?.length === 1 && main._activeBuffs[0].templateKey === 'trap_bonore_s'
    && tileSelector?._filterType === 12 && tileSelector._maxNum === 1
    && life?._lifeTime === 10 && life._maxHitNum === 1 && life._stopAfterMaxHit === 1
    && move?._speed === 8 && move._moveType === 1 && move._comeBack === 0 && move._delayToStart === 0 && move._rotateToTarget !== 0
    && check?._interval === f32(.03) && check._hitPasserby === 1
    && same(box?.m_Size, { x: 3, y: 1 }) && same(box.m_Offset, { x: 0, y: 0 })
    && lines.length === 2 && lines.every(v => v._offset === 1 && v._includeSameLine === 1)
    && select?._targetSide === 1 && select._targetMotion === 3 && select._buffKeyExcluded === 0 && select._maxTargetKey === 'max_target'
    && same(fail, ['AssignBuffCountIntoBlackboard', 'FinishBuffsById', 'CreateBuffStacked'])
    && s._failNodes[0]._buffKey === BLOOD_ALTAR_MARK && s._failNodes[1]._buffKey === BLOOD_ALTAR_MARK
    && stacked?._buff?.templateKey === 'trap_bonore_branch[dfello]' && stacked._buff.maxStackCnt === 10
    && pick?.$type.includes('PickRandomBranchPhase') && pick._blockGameFinish === false
    && kill?.m_Radius === 1 && killSelect?._buffs?.[0]?.templateKey === 'trap_bonore_kill[bmbcar]'
    && record?.profession === 'TRAP' && frames.length === 2 && ['maxHp', 'def', 'magicResistance'].every(k => frames[0].data[k] === frames[1].data[k])
    && skill?.length === 1 && skill[0].skillType === 'AUTO' && skill[0].spData.spType === 'INCREASE_WITH_TIME'
    && skill[0].spData.spCost === 20 && skill[0].spData.initSp === 0 && skill[0].spData.increment === 1
    && bb['talent@enemy_key'] === BLOOD_AMBER && bb.max_target === 10 && typeof bb['talent@branch_id'] === 'string';
}

/** One instance: its facing and its own branch (instance `branch_id` override). Level and skill level change nothing. */
export function bloodAltarDefinition(instance) {
  if (!bloodAltarNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)
    || typeof instance.branchId !== 'string' || !instance.branchId) throw Error('Unsupported original Bloodcalling Altar instance');
  const d = tables.devices.trap_125_bonore.phases[0].attributesKeyFrames[0].data;
  return { kind: 'bloodAltar', hp: d.maxHp, def: d.def, res: d.magicResistance, direction: instance.direction, branchId: instance.branchId,
    spCost: 20, initSp: 0, spPerSecond: 1, speed: 8, lifetime: 10, interval: f32(.03), length: 1, width: 3, maxTargets: 10,
    mark: BLOOD_ALTAR_MARK,
    description: 'Every 20 s sends a pulse along its facing; the first Blood Amber it reaches (and any others in the pulse, up to 10) become Bloodborn Spawn on the Altar\'s route.' };
}
