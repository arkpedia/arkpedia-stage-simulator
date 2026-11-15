// SPDX-License-Identifier: GPL-3.0-or-later
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const emptyAttributes = (a, modifiers = 0) => a && Object.entries(a).every(([k, v]) => Array.isArray(v) && v.length === (k === 'attributeModifiers' ? modifiers : 0));
const one = (n, key) => n[key]?.length === 1 ? n[key][0] : null;
function circle(n, ref, radius, limited) {
  const s = n.$ref(ref), siblings = n.$siblings(ref), c = siblings.find(c => 'm_Radius' in c), t = siblings.find(c => 'm_LocalScale' in c);
  return s?._targetSide === 2 && s._targetMotion === 1 && s._ignoreTargetFree === 0 && s._forceIgnoreCamouflage === 0
    && s._abnormalCombo === 2 && s._abnormalFlag === 44 && s._excludeAbnormalFlag === 46 && s._postFilter === 4
    && s._ignoreHitRange === 0 && s._limitTargetNum === Number(limited) && (!limited || s._maxNum === 4)
    && c && Math.abs(c.m_Radius - radius) < 1e-6 && c.m_Offset.x === 0 && c.m_Offset.y === 0
    && t && Object.values(t.m_LocalScale).every(v => v === 1) && Object.values(t.m_LocalPosition).every(v => v === 0);
}
function buff(b, key, template, life, modifiers = 0) {
  return b?.buffKey === key && b.templateKey === template && b.lifeTimeType === life && b.loadFromDB === 0
    && b.isSilenceable === 0 && b.isDamageMissable === 0 && b.maxStackCnt === 1 && emptyAttributes(b.attributes, modifiers);
}
function action(n, template, event, type, fields) {
  const events = n.$template(template)?.eventToActions, rows = events?.[event];
  return events && Object.keys(events).length === 1 && rows?.length === 1
    && rows[0].$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`
    && Object.entries(fields).every(([key, value]) => rows[0][key] === value);
}
export function pompeiiNative(r, n) {
  if (r.prefabKey !== 'enemy_1050_lslime' || r.applyWay !== 'RANGED' || r.skills.length) return false;
  const keys = Object.keys(r.talents.bb).sort(), expected = ['selfbuff.attack_speed', 'selfbuff.hp_ratio', 'dot.duration', 'dot.damage', 'dot.interval', 'rangedamage.interval', 'rangedamage.attack@damage'];
  if (r.talents.bb['selfbuff.atk'] != null) expected.push('selfbuff.atk'); // No native ATK modifier consumes this unused level-1 field.
  if (JSON.stringify(keys) !== JSON.stringify(expected.sort()) || expected.some(k => !Number.isFinite(r.talents.bb[k]) || r.talents.bb[k] <= 0)
    || r.talents.bb['selfbuff.hp_ratio'] > 1) return false;
  const root = one(n, r.prefabKey), mode = one(n, 'Default'), attack = one(n, 'Attack');
  if (root?._modes?.length !== 1 || n.$ref(root._modes[0]) !== mode || root._commonAbilities?.length !== 0
    || mode?._generalAbilities?.length !== 1 || n.$ref(mode._generalAbilities[0]) !== one(n, 'RangeDamageAbility')
    || n.$ref(mode._attack) !== attack || n.$ref(mode._combat) !== attack) return false;
  if (attack?._projectileKey !== 'projectile_lslime' || attack._atkScale !== 1 || attack._damageType !== 2 || attack._attackType !== 1
    || attack._useDynamicAttackType !== 0 || attack._timeMode !== 0 || attack._useCachedAtkOnly !== 0 || attack._waitForAttackEvent !== 1
    || attack._activeBuffs?.length !== 0 || attack._extraProjectileKeys?.length !== 0 || !circle(n, attack._selector, 3.5, true)) return false;
  const projectile = n.$projectile('projectile_lslime'), motion = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  if (motion?._speed !== 6 || motion._flyToTargetLocationOnly !== 0 || motion._forceReachedWhenTimeup !== 1 || motion._delayTime !== 0
    || life?._lifeTime !== 5 || life._hitNumType !== 1 || life._maxHitNum !== 1 || life._stopAfterMaxHit !== 1
    || life._stopWhenSourceInvalid !== 0 || life._alwaysHitTraceTargetInTheEnd !== 1 || life._canHitSameTargetMultipleTimes !== 0
    || life._actionController?._dontAddBuffs !== 0 || life._actionController?._extraBuffsInTheEnd?.length !== 0) return false;
  const dot = one(n, 'Dot'), burn = dot?._additiveActiveBuffs?.[0];
  if (dot?._additiveActiveBuffs?.length !== 1 || dot._buffs?.length !== 0 || dot._targetFamilyMask !== 3 || !zero(dot._targetValidator)
    || !zero(dot._selector) || dot._probKey !== '' || !buff(burn, 'lslime_t_dot', 'periodic_magic_damage', 1)
    || burn.overrideType !== 3 || burn.triggerLifeType !== 2 || burn.triggerInterval !== -1 || burn.waitFirstTriggerInterval !== 1
    || burn.takeSnapshotWhenExtend !== 0 || burn.blackboard?.length !== 0) return false;
  const self = one(n, 'SelfBuff'), hp = n.$ref(self?._checker), speed = self?._buffs?.[0], modifier = speed?.attributes?.attributeModifiers?.[0];
  if (self?._buffs?.length !== 1 || !zero(self._selector) || self._isInverseToggle !== 0 || self._buffsWhenToggleOff?.length !== 0
    || !buff(speed, 'lslime_t_buff', 'empty', 2, 1) || speed.blackboard?.length !== 0
    || modifier?.attributeType !== 7 || modifier.formulaItem !== 0 || modifier.loadFromBlackboard !== 1
    || hp?.m_Script?.m_PathID !== '2776920899325723445' || hp._toggleOnce !== 0 || hp._restoreDelay !== 0
    || hp._useLTForMax !== 0 || hp._minHpRatio !== 0 || hp._loadMinHpRatioFromBlackboard !== 0) return false;
  const held = one(n, 'RangeDamage'), block = n.$ref(held?._checker), clock = held?._buffs?.[0], cast = one(n, 'RangeDamageAbility'), blast = cast?._activeBuffs?.[0];
  if (held?._buffs?.length !== 1 || !zero(held._selector) || held._isInverseToggle !== 0 || held._buffsWhenToggleOff?.length !== 0
    || block?._blockMinCnt !== 1 || block._blockMaxCnt !== -1 || block._useBlockAsMin !== 1 || block._buffsToBlockee?.length !== 0
    || !buff(clock, 'lslime_t_damage[self]', 'lslime_t_damage[self]', 2) || clock.triggerLifeType !== 2 || clock.triggerInterval !== -1
    || clock.waitFirstTriggerInterval !== 1 || clock.isFreezable !== 1 || clock.isLevitatable !== 1 || clock.isStunnable !== 1
    || clock.blackboard?.length !== 1 || clock.blackboard[0].key !== 'ability_name' || clock.blackboard[0].valueStr !== 'rangedamage'
    || cast?._activeBuffs?.length !== 1 || cast._metadata?.namedAsAlias !== 'rangedamage' || cast._timeMode !== 2
    || cast._affectedBySlowDown !== 0 || cast._allowNoTarget !== 1 || cast._alwaysIncludeTarget !== 0 || cast._waitForAttackEvent !== 0
    || !circle(n, cast._selector, 1.4, false) || !buff(blast, 'lslime_t_damage[target]', 'instant_damage_magic[splash]', 0)
    || blast.blackboard?.length !== 0) return false;
  return n.$template('empty') && Object.keys(n.$template('empty').eventToActions).length === 0
    && action(n, 'periodic_magic_damage', 'ON_BUFF_TRIGGER', 'NoSourceDamage', { _damageType: 'MAGICAL', _damageKey: 'damage',
      _ignoreForSp: true, _damageWithoutModify: false, _attackType: 'BUFF', _isEnvDamage: false, _isUndeadable: false, _multiplierByKey: false })
    && action(n, 'instant_damage_magic[splash]', 'ON_BUFF_START', 'FixedValueDamage', { _damageType: 'MAGICAL', _damageKey: 'damage',
      _ignoreForSp: false, _attackType: 'SPLASH', _skipModifierEvent: false, _noSourceDamage: false, _multiplierByKey: false })
    && action(n, 'lslime_t_damage[self]', 'ON_BUFF_TRIGGER', 'TriggerAbility', { _ownerType: 'BUFF_OWNER', _targetType: 'BUFF_OWNER',
      _abilityName: '', _checkCanUseAblityFlag: false, _castDirectly: false, _useFirstActiveAbility: false });
}
export const POMPEII_ENEMY_FEATURES = Object.freeze({
  'talent:dot': { covers: pompeiiNative,
    stageOverrides: { 'dot.damage': v => Number.isFinite(v) && v > 0, 'rangedamage.attack@damage': v => Number.isFinite(v) && v > 0 },
    nativeClaim: () => ({ active: 1 }),
    ability: { kind: 'pompeii', params: r => ({ burnDamage: r.talents.bb['dot.damage'], burnDuration: r.talents.bb['dot.duration'],
      burnInterval: r.talents.bb['dot.interval'], blastDamage: r.talents.bb['rangedamage.attack@damage'],
      blastInterval: r.talents.bb['rangedamage.interval'], hpRatio: r.talents.bb['selfbuff.hp_ratio'], aspd: r.talents.bb['selfbuff.attack_speed'] }) },
    explains: text => ['Can attack up to 4 targets at once and ignites targets it attacks, dealing Immolation damage over time',
      'Self-immolates when blocked, dealing heavy damage', 'Gains significantly increased ASPD when HP drops to half'].includes(text),
    note: 'Four ground homing projectiles, independent refreshing sourceless burn, reversible HP/ASPD toggle and blocked-only fixed Arts blast.' },
  'talent:selfbuff': { covers: pompeiiNative, note: 'Shared Pompeii kit owns the HP checker; unused selfbuff.atk is not a native modifier.' },
  'talent:rangedamage': { covers: pompeiiNative, note: 'Shared Pompeii kit owns the control-paused blocked timer and fixed radius.' },
});
