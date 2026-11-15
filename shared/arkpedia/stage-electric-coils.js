// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (e, key) => e.prefabs[key]?.components.map(c => c.data) ?? [];
export function electricCoilNativeReviewed(e = native) {
  const r = rows(e, 'trap_019_electric'), s = rows(e, 'sktok_electric'), p = rows(e, 'projectile_chr_electric_shock');
  const root = r.find(c => '_modes' in c), selection = r.find(c => '_compareWithOwnerCreatedTime' in c);
  const attack = r.find(c => c._metadata?.namedAsAlias === 'ElectricShock');
  const aura = s.find(c => '_selfOption' in c), life = p.find(c => '_lifeTime' in c), laser = p.find(c => '_laserWidth' in c);
  const actions = e.templates['electric[attack]']?.eventToActions.ON_BUFF_START;
  const periodic = e.templates.electric_s?.eventToActions.ON_BUFF_TRIGGER;
  return root?._category === 2 && root._sideType === 1 && root._occupiedRemainingCharacterCnt === 0
    && root._buildCondition.buildableType === 2 && !root._buildCondition.isTryingOverlapCharacater
    && root._withdrawable === 1 && root._ignoreParentWithdrawable === 0 && root._withdrawCostRecoverRatio === .5 && root._cardPolicy === 0
    && selection?._compareWithOwnerCreatedTime === 0 && selection._filterTag === 'electric' && selection._excludeOwner === 1
    && selection._targetSide === 1 && selection._targetMotion === 1 && selection._targetCategory === 2
    && selection._ignoreTargetFree === 1 && selection._limitTargetNum === 1 && selection._maxNum === 1
    && attack?._projectileKey === 'projectile_chr_electric_shock' && attack._waitForAttackEvent === 0 && attack._affectedBySlowDown === 0
    && attack._atkScale === 0 && attack._activeBuffs.length === 1 && attack._activeBuffs[0].templateKey === 'electric[attack]'
    && attack._activeBuffs[0].isDamageMissable === 0 && attack._activeBuffs[0].isSilenceable === 0
    && r.some(c => c._buffs?.some(b => b.buffKey === 'invincible' && b.attributes.abnormalFlags.join() === '5'))
    && aura?._selfOption === 2 && aura._removeBuffWhenTargetLeave === 1 && aura._removeBuffWhenAbilityDetached === 1
    && periodic?.length === 3 && periodic[0]._abilityName === 'ElectricShock' && !periodic[0]._checkCanUseAblityFlag
    && aura._passiveBuffs[0]?.templateKey === 'electric_s' && aura._passiveBuffs[0].waitFirstTriggerInterval === 1
    && life?._lifeTime === Math.fround(.7) && life._canHitSameTargetMultipleTimes === 0 && life._maxHitTimes === -1
    && life._managedBySource === 0 && life._ignoreTargetDead === 0 && life._isSilenceable === 0
    && laser?._laserWidth === Math.fround(.65) && laser._targetOptions.targetSide === 2 && laser._targetOptions.targetMotion === 3
    && laser._targetOptions.targetCategory === 1 && laser._targetOptions.ignoreTargetFree === 0 && laser._ignoreCamouflage === 0
    && actions?.length === 2 && actions[0]._buffKey === 'sluggish' && !actions[0]._isDerivedBuff
    && actions[1]._damageType === 'MAGICAL' && actions[1]._damageKey === 'value' && actions[1]._attackType === 'BUFF'
    && !actions[1]._isEnvDamage && !actions[1]._noSourceDamage && !actions[1]._ignoreForSp;
}
export function electricCoilDefinition(instance) {
  if (!electricCoilNativeReviewed() || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || (instance.elite ?? 0) !== 0 || (instance.potential ?? 0) !== 0 || (instance.skill_index ?? 0) !== 0
    || (instance.skill_level ?? instance.skillLevel) !== 1) throw Error('Unsupported Mieszko Coil instance');
  const record = tables.devices.trap_019_electric, skill = tables.skills.sktok_electric.levels[0];
  const bb = Object.fromEntries(skill.blackboard.map(p => [p.key, p.value]));
  if (skill.skillType !== 'PASSIVE' || Object.keys(bb).sort().join() !== 'attack@sluggish,attack@value,interval') throw Error('Changed Mieszko Coil skill');
  return { rangedBuildOnly: true, supplyCard: true, obstacle: false, passive: true, kind: 'electric-coil',
    cooldown: record.phases[0].attributesKeyFrames[0].data.respawnTime, refundRatio: .5,
    interval: bb.interval, damage: bb['attack@value'], slow: bb['attack@sluggish'], beamDuration: Math.fround(.7), width: Math.fround(.65),
    maxTargets: 1, range: tables.ranges[skill.rangeId].grids.map(p => [p.row, p.col]),
    description: 'Links to an earlier coil in range every 2.3 seconds. Each beam deals 250 Arts damage and slows each enemy it touches for 1.5 seconds.' };
}
