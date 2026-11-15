// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (n, id) => n.prefabs[id]?.components.map(c => c.data) ?? [];
/** Gate the mine's source selector, ordered effects and real SP account. */
export function mineNativeReviewed(n = native) {
  const token = rows(n, 'trap_012_mine'), skill = rows(n, 'sktok_mine');
  const root = token.find(c => '_modes' in c), select = skill.find(c => '_targetSide' in c);
  const controller = skill.find(c => '_allowSpRecoveryWhenAffecting' in c);
  const cast = skill.find(c => c._activeBuffs?.length), buffs = cast?._activeBuffs;
  const circle = skill.find(c => 'm_Radius' in c), end = skill.find(c => '_onlyCheckOnStopAffect' in c);
  const scale = n.templates['damage_scale[input]']?.eventToActions.ON_TAKE_DAMAGE;
  const damage = n.templates.instant_damage_pure?.eventToActions.ON_BUFF_START;
  const withdraw = n.templates.suicide?.eventToActions.ON_BUFF_START;
  return root?._modes.length === 2 && root._sideType === 1 && root._category === 2
    && root._occupiedRemainingCharacterCnt === 0 && root._withdrawable === 1 && root._withdrawCostRecoverRatio === 0
    && root._buildCondition.buildableType === 1 && root._buildCondition.needSpecifyDirection === 0
    && root._buildCondition.isTryingOverlapCharacater === 0
    && select?._targetSide === 2 && select._targetMotion === 1 && select._targetCategory === 1
    && select._postFilter === 24 && select._ignoreTargetFree === 1 && select._limitTargetNum === 0
    && circle?.m_Radius === Math.fround(.55) && circle.m_Offset.x === 0 && circle.m_Offset.y === 0
    && controller?._canSilenced === 0 && controller._canUseInAbnormalState === 0
    && controller._allowSpRecoveryWhenAffecting === 0 && controller._defaultModeIndex === -1
    && cast?._preDelay === 0 && cast._affectedBySlowDown === 0 && cast._selectTargetTiming === 1
    && buffs?.length === 2 && buffs[0].buffKey === 'take_damage_scale_up[mine]'
    && buffs[0].templateKey === 'damage_scale[input]' && buffs[0].lifeTimeType === 1
    && buffs[0].disableOverride === 0 && buffs[0].overrideType === 0 && buffs[0].maxStackCnt === 1
    && buffs[0].independentCharacterSource === 0 && buffs[0].statusResistable === 2
    && buffs[1].templateKey === 'instant_damage_pure' && buffs[1].isDamageMissable === 0
    && end?._onlyCheckOnStopAffect === 0 && end._buffs[0]?.templateKey === 'suicide'
    && scale?.length === 1 && scale[0]._damageMask === 'ANY_ATTACK_EXCEPT_ELEMENT' && scale[0]._filterApplyWay === false
    && damage?.length === 1 && damage[0]._damageType === 'PURE' && damage[0]._damageKey === 'damage'
    && withdraw?.length === 1 && withdraw[0]._withdrawSource === true && withdraw[0]._switchToDeadState === true;
}
export function mineDefinition(instance) {
  if (!mineNativeReviewed() || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.elite !== 0 || instance.potential !== 0 || instance.skill_index !== 0 || instance.skill_level !== 1)
    throw Error('Unsupported Interference Mine instance');
  const record = tables.devices.trap_012_mine, stats = record.phases[0].attributesKeyFrames[0].data;
  const skill = tables.skills.sktok_mine.levels[0], sp = skill.spData;
  const bb = Object.fromEntries(skill.blackboard.map(p => [p.key, p.value]));
  if (skill.skillType !== 'AUTO' || sp.spCost !== 25 || sp.initSp !== 0 || sp.spType !== 'INCREASE_WITH_TIME'
    || bb.damage !== 2000 || bb.damage_scale !== 1.5 || bb.duration !== 15) throw Error('Changed Interference Mine parameters');
  return { kind: 'mine', supplyCard: true, obstacle: false, hp: stats.maxHp, cost: stats.cost,
    cooldown: stats.respawnTime, refundRatio: 0, groundBuildOnly: true, block: 0,
    spCost: sp.spCost, initSp: sp.initSp, spRecovery: stats.spRecoveryPerSec,
    damage: bb.damage, damageScale: bb.damage_scale, duration: bb.duration,
    radius: rows(native, 'sktok_mine').find(c => 'm_Radius' in c).m_Radius,
    range: tables.ranges[record.phases[0].rangeId].grids.map(p => [p.row, p.col]),
    description: 'Charges 25 SP, then detonates when a ground enemy enters its small radius. Increases damage taken by 50% for 15 seconds before dealing 2000 True damage. Consumed after use.' };
}

/** Preplaced bodies share the card mechanic, with source-validated build fields. */
export function predefinedMineDefinition(instance) {
  if (!instance) throw Error('Missing original Interference Mine instance');
  return { ...mineDefinition({ level: instance.level, skill_level: instance.skillLevel,
    elite: 0, potential: 0, skill_index: 0 }), unitId: 'trap_012_mine', name: 'Interference Mine' };
}
