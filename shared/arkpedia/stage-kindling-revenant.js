// SPDX-License-Identifier: GPL-3.0-or-later
// 14-18 "Roaring Inferno": the Kindling Revenant's devices and beam system (PRTS 引火的死魂灵, 核心增幅器, 洪流束激发器).
// The enemy's two forms are reviewed in enemy-kindling-revenant-features.js; the runtime is
// server/sim/content/arkpedia-stage-kindling-revenant.js. The beam system's rule and reach are in
// stage-kindling-revenant-beams.js (the battle imports that file; this one reads the device evidence).
//
// Torrent Beam Activator `trap_160_lrlgun` (enemy side, trap category: no selector takes it; INVINCIBLE):
// - Five modes. Default, S1, S2 and S3 each hold one `laser` ability: after 0.5 s it fires a beam down its row to the
//   left (projectile_enemy_lrdead_p1: through walls, 0.65 wide, every non-trap ally unit, re-hit after 1 s). A hit
//   deals Arts damage of the gun's ATK only when no ally character stands to the right of the target, so the first
//   unit in the row takes it. S4 has no ability (the guns are shut down).
// - When the laser ends in Default, S1 and S3 (not S2), `trap_lrlgun[clearBuff]` removes the captured-soul ATK.
// Core Amplifier `trap_159_lrcore` (enemy side, default category: operators can attack it):
// - Common: immune to Stun, Freeze, Silence, Cold and Disarm, HEAL_FREE, ALLY_TARGET_FREE, no environment damage.
// - Mode Default (the first form): talent `1` holds SKILL_NOT_ACTIVATABLE, UNDEADABLE and SP_RECOVER_STOPPED, and
//   INVINCIBLE through `trap_lrcore[invincible_ctrl]` (its `unlock` value is the skill level's: the order in which the
//   first form exposes the cores). Talent `2`: a Soul Maelstrom (`enemy_lrsoul[mark]`, ground) within `range_radius`
//   0.7 is absorbed (killed); every gun gains `atk` 20 ATK (`trap_lrcore[soulBuff]`, stacking).
// - Mode S1 (the second form): `trap_lrcore[set_hp_full]` heals it fully; `trap_lrcore_hp_dont_decrease` scales all
//   damage to 0; every 0.5 s `trap_lrcore[p2_taunt_ctrl]` gives taunt -1 while its SP is full.
// - Skill sktok_lrcore (MANUAL, 25 SP from 25, charged by hits taken): `Mainline14TriggerSkill` on the beam system and
//   SKILL_NOT_ACTIVATABLE on the other cores for 1.8 s.
// Beam system `env_v050_mainline14_lrdeadP2Ctrl` (a compiled controller; its prefab holds effects only, its numbers come
// from the level's `env_system_new` rune). PRTS and the EN wiki describe it:
// - The second form's casts raise the enemy energy; each core skill raises the ally energy.
// - Five red beams run right from `enemy_eff_start_col`; five gold beams run left from the guns. They do not overlap;
//   where they meet depends on the energy difference.
// - Every `dmg_interval` s a non-device ally unit in red takes min(bound, base + step x (enemy energy - 1)) Arts
//   damage and an enemy in gold the same from the ally numbers as true damage, both without a source; the Revenant
//   takes the gold damage x `atk_scale_to_boss`.
// [inference] The meeting rule is not in any data. `revenantBeamReach` reads `difs`/`offsets` as: with the allies ahead
// by d (0 to 6; behind counts as 0) the gold beams reach `offsets[d]` columns from the guns and the red beams the rest;
// before the first core skill the red beams reach the guns; the gold beams reach the Revenant only at their furthest
// (d at the last `difs` entry). Why this reading: the cores start charged, so four skills put the allies 3 ahead, and
// the Revenant's extra cast at low HP then pushes the gold beams off it once. The other reading (the red beams reach
// `offsets[enemy lead]` columns and any ally lead reaches the Revenant) would end the form with those four skills.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import { REVENANT_SYSTEM } from './stage-kindling-revenant-beams.js';

const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
const keys = list => (list ?? []).map(b => b.buffKey).join();
export const REVENANT_CORE = 'trap_159_lrcore', REVENANT_GUN = 'trap_160_lrlgun';
const CORE_HP = Object.freeze([5000, 15000, 22500, 30000]);

export function revenantGunNativeReviewed(e = native, t = tables) {
  const P = k => e.prefabs?.[k]?.components ?? [], T = k => e.templates?.[k]?.eventToActions;
  const rows = P(REVENANT_GUN), root = rows.find(c => '_modes' in c.data)?.data;
  const byId = ref => rows.find(c => c.pathId === String(ref?.m_PathID))?.data;
  const modes = (root?._modes ?? []).map(byId);
  const lasers = modes.map(m => (m?._generalAbilities ?? []).map(byId));
  const clears = rows.filter(c => c.object === 'laser' && keys(c.data._buffs) === 'trap_lrlgun[clearBuff]').map(c => c.data);
  // The clearBuff component shares its game object with its mode's laser.
  const clearsFor = l => clears.filter(c => c.m_GameObject?.m_PathID === l?.m_GameObject?.m_PathID).length;
  const passive = rows.find(c => c.object === 'Passive')?.data._buffs;
  const extra = l => { try { return JSON.parse(l._extraActions.SerializedState); } catch { return null; } };
  const tick = T('enemy_lrdead_p1_inattack')?.ON_BUFF_TRIGGER, clear = T('trap_lrlgun[clearBuff]')?.ON_BUFF_START;
  const beam = k => P(k).map(c => c.data), record = t.devices?.[REVENANT_GUN], frames = record?.phases?.[0]?.attributesKeyFrames ?? [];
  const beamOk = k => {
    const b = beam(k), life = b.find(c => '_keepAlreadyHitTime' in c), laser = b.find(c => '_laserWidth' in c), hit = b.find(c => '_goThroughWall' in c);
    return life?._keepAlreadyHitTime === 1 && life._lifeTimeType === 2 && life._hitNumType === 1
      && laser?._laserWidth === f32(.65) && laser._targetOptions?.targetSide === 2 && laser._targetOptions.targetCategory === 1
      && laser._targetOptions.targetMotion === 3 && hit?._goThroughWall === 1 && hit._ignoreCamouflage === 1;
  };
  return root?._sideType === 2 && root._category === 2 && modes.length === 5
    && same(lasers.map(l => l.length), [1, 1, 1, 1, 0])
    && lasers.slice(0, 4).every(([l], i) => l?._preDelay === .5 && l._cooldown === 9999 && l._damageType === 2 && l._atkScale === 1
      && l._useOwnerDirection === 1 && l._projectileKey === (i === 3 ? 'projectile_enemy_lrdead_p1_2' : 'projectile_enemy_lrdead_p1')
      && keys(l._activeBuffs) === 'enemy_lrdead_p1_inattack'
      && (x => x?.length === 1 && type(x[0]) === 'IfElse' && type(x[0]._conditionNode) === 'HasCharacterInCertainDirection'
        && x[0]._conditionNode._direction === 'RIGHT' && x[0]._conditionNode._target === 'TARGET' && x[0]._conditionNode._checkSameSide === true
        && x[0]._conditionNode._excludeTrapCategory === true && x[0]._succeedNodes.length === 0
        && types(x[0]._failNodes) === 'AdvancedApplyDamage' && x[0]._failNodes[0]._damageType === 'MAGICAL'
        && x[0]._failNodes[0]._atkScaleVar === 'atk_scale' && x[0]._failNodes[0]._defaultAtkScale === 1)(extra(l)))
    && same(lasers.slice(0, 4).map(([l]) => clearsFor(l)), [1, 1, 0, 1])
    && clears.every(c => c._runActionOnEvent === 3)
    && keys(passive) === 'lrlgun_passive,trap_lrlgun[mark]' && same(passive[0].attributes?.abnormalFlags, [5])
    && type(tick?.[0]) === 'IfElse'
    && types(clear) === 'FinishBuffsById' && clear[0]._buffKey === 'trap_lrcore[soulBuff]' && clear[0]._targetType === 'BUFF_OWNER'
    && beamOk('projectile_enemy_lrdead_p1') && beamOk('projectile_enemy_lrdead_p1_2')
    && record?.name === '洪流束激发器' && frames[0]?.level === 1 && frames[0].data.maxHp === 20000 && frames[0].data.atk === 0
    && frames[0].data.baseAttackTime === 1 && same(record.skills.map(s => s.skillId), ['sktok_lrlgun']);
}

export function revenantCoreNativeReviewed(e = native, t = tables) {
  const P = k => e.prefabs?.[k]?.components ?? [], T = k => e.templates?.[k]?.eventToActions;
  const rows = P(REVENANT_CORE), root = rows.find(c => '_modes' in c.data)?.data;
  const byId = ref => rows.find(c => c.pathId === String(ref?.m_PathID))?.data;
  const buffs = name => rows.find(c => c.object === name && c.data._buffs)?.data._buffs ?? [];
  const one = buffs('1'), two = rows.find(c => c.object === '2' && c.data._buffs)?.data, three = buffs('3'), taunt = buffs('TauntAdjust');
  const soulFilter = byId(two?._targetValidator), soulCircle = rows.find(c => c.object === '2' && c.data.m_Radius !== undefined)?.data;
  const scale = rows.find(c => c.object === '2' && '_scaleble' in c.data)?.data, common = buffs('AbnormalImmunes');
  const modes = (root?._modes ?? []).map(byId), config = rows.find(c => '_config' in c.data)?.data._config;
  const capture = T('trap_lrcore[captureSoul]')?.ON_BUFF_START, eat = T('trap_lrcore[eatSoul]')?.ON_BUFF_START;
  const immortal = T('trap_lrcore_hp_dont_decrease')?.ON_TAKE_DAMAGE, full = T('trap_lrcore[set_hp_full]')?.ON_BUFF_START;
  const tauntRun = T('trap_lrcore[p2_taunt_ctrl]')?.ON_BUFF_TRIGGER, trigger = T('trap_lrcore[triggerSkill]')?.ON_BUFF_START;
  const skill = P('sktok_lrcore').find(c => c.data._buffs)?.data, lock = trigger?.[0]?._failNodes?.[1]?._buff;
  const record = t.devices?.[REVENANT_CORE], frames = record?.phases?.[0]?.attributesKeyFrames ?? [];
  const talent = i => record?.talents?.[i]?.candidates, levels = t.skills?.sktok_lrcore?.levels ?? [];
  const soulBuff = eat?.[0]?._buff;
  return root?._sideType === 2 && root._category === 1 && modes.length === 2 && same(root._filterTag, ['mainline14_tower'])
    && modes[0]?._generalAbilities?.length === 0 && modes[1]?._generalAbilities?.length === 1
    && keys(one) === 'trap_lrcore[passive_p1],trap_lrcore[invincible_ctrl]'
    && same(one[0].attributes?.abnormalFlags, [24, 6, 1]) && same(one[1].attributes?.abnormalFlags, [5]) && one.every(b => b.lifeTimeType === 2)
    && keys(two?._buffs) === 'trap_lrcore[captureSoul]' && two._removeBuffWhenTargetLeave === 1
    && soulFilter?._targetOptions?.targetSide === 1 && soulFilter._targetOptions.targetMotion === 1 && same(soulFilter._buffs, ['enemy_lrsoul[mark]'])
    && soulCircle?.m_Radius === .25 && scale !== undefined
    && keys(three) === 'trap_lrcore_hp_dont_decrease,trap_lrcore[set_hp_full],trap_lrcore[decrease_lifpoint_when_dead]'
    && same(three[0].blackboard.map(x => [x.key, x.value]), [['min_hp_ratio', 1], ['damage_scale', 0]])
    && keys(taunt) === 'trap_lrcore[p2_taunt_ctrl]' && taunt[0].triggerInterval === .5 && taunt[0].triggerLifeType === 2
    && same(taunt[0].blackboard.map(x => [x.key, x.value]), [['sp_ratio', 1]])
    && keys(common) === 'lrcore_abnormalimmunes,trap_lrcore[mark]' && same(common[0].attributes?.abnormalFlags, [8, 21, 7, 15])
    && same(common[0].attributes?.abnormalImmunes, [0, 16, 12, 23, 11]) && common[0].templateKey === 'immu_environment_damage'
    && same(config?.map(c => [c._sourceKey, c._targetTalentKey, c._targetKey]), [['unlock', '1', 'unlock'], ['branch_id', '1', 'branch_id']])
    && types(capture) === 'CheckContainsBuff,IfNot,CreateBuff,CreateEffect,InstantKill' && same(capture[0]._buffKeys, ['enemy_lrking[disableAbsorb]'])
    && capture[2]._buff.templateKey === 'trap_lrcore[eatSoul]' && capture[4]._targetType === 'BUFF_OWNER'
    && types(eat) === 'CreateBuffUseAbilitySelector' && eat[0]._abilityName === 'SelectGun' && soulBuff?.buffKey === 'trap_lrcore[soulBuff]'
    && soulBuff.maxStackCnt === 999 && soulBuff.attributes?.attributeModifiers?.[0]?.attributeType === 'ATK'
    && soulBuff.attributes.attributeModifiers[0].formulaItem === 'ADDITION' && soulBuff.attributes.attributeModifiers[0].loadFromBlackboard === true
    && types(immortal) === 'CheckModifierContainsKey,IfNot,DamageScale' && immortal[0]._customKey === 'lrdead'
    && types(full) === 'HealViaMaxHpRatio,FinishBuffsById' && full[1]._buffKey === 'trap_lrcore[p1_invincible]'
    && type(tauntRun?.[0]) === 'IfElse' && type(tauntRun[0]._conditionNode) === 'FilterByTargetSpRatio' && tauntRun[0]._conditionNode._condType === 'GE'
    && tauntRun[0]._succeedNodes[0]._buff.attributes.attributeModifiers[0].attributeType === 'TAUNT_LEVEL'
    && tauntRun[0]._succeedNodes[0]._buff.attributes.attributeModifiers[0].value === -1
    && keys(skill?._buffs) === 'trap_lrcore[triggerSkill],trap_lrcore[skill_fx]'
    && type(trigger?.[0]) === 'IfElse' && types(trigger[0]._failNodes) === 'Mainline14TriggerSkill,CreateBuffUseAbilitySelector'
    && trigger[0]._failNodes[0]._evnSysKey === REVENANT_SYSTEM && trigger[0]._failNodes[1]._abilityName === 'SelectCore'
    && trigger[0]._failNodes[1]._excludeTarget === true && lock?.lifeTime === f32(1.8) && same(lock.attributes?.abnormalFlags, ['SKILL_NOT_ACTIVATABLE'])
    && record?.name === '核心增幅器' && same(frames.slice(0, 4).map(f => [f.level, f.data.maxHp, f.data.def, f.data.magicResistance]),
      CORE_HP.map((hp, i) => [i + 1, hp, 200, 20]))
    && same((talent(1)?.[0]?.blackboard ?? []).map(x => [x.key, x.value]), [['atk', 20], ['range_radius', .7]])
    && levels.length === 4 && levels.every((l, i) => l.skillType === 'MANUAL' && l.spData.spType === 'INCREASE_WHEN_TAKEN_DAMAGE'
      && l.spData.spCost === 25 && l.spData.initSp === 25 && l.blackboard.find(x => x.key === 'unlock')?.value === i + 1)
    && same(levels.map(l => l.blackboard.find(x => x.key === 'branch_id')?.valueStr), ['branch_1', 'null', 'null', 'null']);
}

export function revenantGunDefinition(instance) {
  if (!revenantGunNativeReviewed() || instance?.level !== 1 || instance.skillLevel !== 1 || instance.direction !== 'LEFT')
    throw Error('Unsupported Torrent Beam Activator instance');
  // Echo modes whose end clears the captured-soul ATK (Default, S1, S3; not S2).
  return { hp: 20000, direction: 'LEFT', windUp: .5, rehit: 1, clearsSouls: [true, true, false, true] };
}

/** `branchId` is the level branch whose next phase runs when this core is broken (`MoveNextLevelBranch`), or absent. */
export function revenantCoreDefinition(instance) {
  if (!revenantCoreNativeReviewed() || !Number.isSafeInteger(instance?.level) || instance.level < 1 || instance.level > 4
    || !Number.isSafeInteger(instance.skillLevel) || instance.skillLevel < 1 || instance.skillLevel > 4 || !(instance.branchId == null || typeof instance.branchId === 'string' && instance.branchId))
    throw Error('Unsupported Core Amplifier instance');
  return { hp: CORE_HP[instance.level - 1], def: 200, res: 20, unlock: instance.skillLevel, spCost: 25, initSp: 25, lock: f32(1.8),
    soulRadius: .7, soulAtk: 20, tauntWhenFull: -1, tauntCheck: .5, immune: ['stun', 'frozen', 'silence', 'cold', 'disarm'],
    ...(instance.branchId != null ? { branchId: instance.branchId } : {}) };
}
