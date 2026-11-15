// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import animations from '../../data/arkpedia-gramophone-animations.json' with { type: 'json' };
const type = n => `Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
export function gramophoneNativeReviewed(n = native) {
  const rows = n.prefabs.trap_014_tower?.components.map(c => c.data) ?? [], root = rows.find(c => '_modes' in c);
  if (root?._modes.length !== 3 || root._sideType !== 2 || root._category !== 2 || root._withdrawable !== 0
    || root._occupiedRemainingCharacterCnt !== 0 || root._filterTag.join() !== 'tower' || root._rewriteTileOptions !== 1) return false;
  const modes = rows.filter(c => '_tileOptions' in c), attacks = rows.filter(c => '_projectileKey' in c);
  if (modes.length !== 3 || !modes.every(c => c._tileOptions.passableMask === 2 && c._tileOptions.buildableType === 0)
    || attacks.length !== 2 || !attacks.every((a, i) => a._projectileKey === `projectile_chr_tower_${2 - i}`
      && a._preDelay === Math.fround(.55) && a._timeMode === 0 && a._atkScale === 0 && a._damageType === 2 && a._affectedBySlowDown === 0)) return false;
  const selectors = rows.filter(c => '_postFilter' in c);
  if (selectors.length !== 4 || !selectors.every((s, i) => s._postFilter === (i % 2 ? 3 : 19)
    && s._targetSide === [1, 2, 2, 1][i] && s._targetCategory === 1 && s._targetMotion === 3
    && s._ignoreTargetFree === 0 && s._ignoreAllyTargetFree === 0 && s._ignoreHealFree === 0 && s._maxNum === 1)) return false;
  const aura = rows.find(c => c._buffs?.[0]?.templateKey === 'tower_t_1[charge]');
  const validator = rows.find(c => c._targetOptions?.professionMask === 767)?._targetOptions;
  if (aura?._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || validator?.targetSide !== 2 || validator.targetMotion !== 3 || validator.targetCategory !== 3 || validator.ignoreTargetFree !== 1) return false;
  const charge = aura._buffs[0], bb = Object.fromEntries(charge.blackboard.map(p => [p.key, p.value]));
  if (charge.lifeTimeType !== 2 || charge.isSilenceable !== 0 || bb.interval !== 1 || bb.sp !== 1) return false;
  const buffs = rows.flatMap(c => c._buffs ?? []);
  if (!buffs.some(b => b.buffKey === 'tower_c[invincible]' && b.attributes.abnormalFlags.join() === '5')) return false;
  for (const [key, mode, cond] of [['tower_t_2[max_sp]', 1, 'GE'], ['tower_t_3[min_sp]', 2, 'LE']]) {
    const buff = buffs.find(b => b.templateKey === key), actions = n.templates[key]?.eventToActions.ON_BUFF_TRIGGER;
    if (buff?.triggerInterval !== Math.fround(.1) || buff.waitFirstTriggerInterval !== 1
      || actions?.[0]?.$type !== type('FilterByTargetSpRatio') || actions[0]._condType !== cond
      || actions[3].$type !== type('SwitchMode') || actions[3]._modeIndex !== mode) return false;
  }
  const chargeAction = n.templates['tower_t_1[charge]']?.eventToActions.ON_BUFF_TRIGGER?.[0];
  const hit = n.templates['tower_t_4[attack]']?.eventToActions.ON_BUFF_FINISH?.[0];
  const heal = n.templates['instant_heal[hp_ratio]']?.eventToActions.ON_BUFF_START?.[0];
  if (chargeAction?.$type !== type('ModifySp') || chargeAction._targetType !== 'SOURCE' || chargeAction._forceFlag
    || hit?.$type !== type('DamageViaAttr') || hit._attributeType !== 'MAX_HP' || hit._damageType !== 'MAGICAL'
    || hit._applyWay !== 'RANGED' || hit._attackType !== 'NORMAL' || hit._blackboardKey !== 'atk_scale' || hit._skipModifierEvent
    || heal?.$type !== type('HealViaMaxHpRatio') || heal._ignoreHealFree || heal._skipModifierEvent) return false;
  for (const key of ['projectile_chr_tower_1', 'projectile_chr_tower_2']) {
    const parts = n.prefabs[key]?.components.map(c => c.data) ?? [], p = parts.find(c => '_lifeTime' in c), mover = parts.find(c => '_speed' in c);
    if (p?._managedBySource !== 0 || p._stopWhenSourceInvalid !== 0 || p._lifeTime !== 10 || p._maxHitNum !== 1
      || mover?._speed !== 10 || mover._moveType !== 1 || mover._delayToStart !== 0) return false;
  }
  return animations.animations.Actived.duration === 1 && animations.animations.Switch.duration === 1;
}
export function gramophoneDefinition(instance) {
  if (!gramophoneNativeReviewed() || !Number.isSafeInteger(instance?.level) || instance.level < 1 || instance.level > 30
    || ![1, 2, 3].includes(instance.skillLevel)) throw Error('Unsupported original Gramophone instance');
  const record = tables.devices.trap_014_tower, skill = tables.skills.sktok_tower.levels[instance.skillLevel - 1];
  const bb = Object.fromEntries(skill.blackboard.map(p => [p.key, p.value])), stats = record.phases[0].attributesKeyFrames[0].data;
  if (record.phases[0].rangeId !== 'x-2' || skill.rangeId !== 'x-5' || stats.maxHp !== 100 || stats.baseAttackTime !== 1.5
    || skill.spData.spCost !== 100 || skill.spData.increment !== 0 || skill.spData.initSp !== [50, 0, 100][instance.skillLevel - 1]
    || Object.keys(bb).length !== 4 || bb.talent_range_flag !== 1 || bb['talent@tower_t_4[magic_attack].atk_scale'] !== .05
    || bb['talent@tower_t_5[heal][persistent].interval'] !== 5 || bb['attack@tower_heal[target].hp_ratio'] !== .1)
    throw Error('Changed Gramophone skill');
  return { kind: 'gramophone', passive: true, hp: stats.maxHp, bat: stats.baseAttackTime, spCost: skill.spData.spCost,
    initSp: skill.spData.initSp, damageRatio: bb['talent@tower_t_4[magic_attack].atk_scale'], healRatio: bb['attack@tower_heal[target].hp_ratio'],
    healInterval: bb['talent@tower_t_5[heal][persistent].interval'], release: Math.fround(.55), poll: Math.fround(.1), speed: 10,
    captureDuration: animations.animations.Actived.duration, switchDuration: animations.animations.Switch.duration,
    chargeRange: tables.ranges[skill.rangeId].grids.map(p => [p.row, p.col]),
    range: tables.ranges[record.phases[0].rangeId].grids.map(p => [p.row, p.col]),
    description: 'Nearby operators and summons each add 1 control SP per second. At 100 SP it fights for you; at 0 SP it fights against you. It attacks the highest-max-HP target for 5% of maximum HP as Arts damage and heals a wounded friendly target for 10% every 5 seconds.' };
}
